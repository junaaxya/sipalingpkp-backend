const { Op, QueryTypes } = require('sequelize');
const {
  HousingDevelopment,
  Province,
  Regency,
  District,
  Village,
  User,
  AuditLog,
  sequelize,
} = require('../models');
const { findLocationByCoordinates } = require('./locationService');
const {
  queryUtils, paginationUtils,
} = require('../utils/lodashUtils');
const { errorFactory } = require('../errors/errorUtils');
const { getYearExpression, getMonthExpression } = require('../utils/sqlDateUtils');
const {
  createNotification,
  createNotificationsForUsers,
  findReviewerUsersForScope,
} = require('./notificationService');
const { enforceExportLocationScope } = require('./exportScopeUtils');
const {
  parseGisLayerFilters,
  buildSpatialLayerIntersectsSql,
  buildSpatialLayerWhereSql,
  formatGisLayerLabel,
} = require('./spatialExportUtils');
const {
  isMasyarakat,
  isSuperAdmin,
  isVerifikator,
} = require('../utils/accessControl');

const normalizeCoordinateValue = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPointGeom = (latitude, longitude) => {
  if (latitude === undefined && longitude === undefined) return undefined;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return sequelize.fn('ST_SetSRID', sequelize.fn('ST_MakePoint', longitude, latitude), 4326);
};

const applyUserDisplayName = (user) => {
  if (!user) return;
  const fullName = user.fullName || user.get?.('fullName');
  if (fullName && !user.name) {
    if (typeof user.setDataValue === 'function') {
      user.setDataValue('name', fullName);
    } else {
      user.name = fullName;
    }
  }
};

const loadHousingDevelopmentGisLayerMap = async (developmentIds, gisLayerFilters) => {
  if (!Array.isArray(developmentIds) || developmentIds.length === 0) {
    return new Map();
  }

  const whereSql = buildSpatialLayerWhereSql(gisLayerFilters);
  if (!whereSql) {
    return new Map();
  }

  const results = new Map();
  const chunkSize = 1000;

  for (let i = 0; i < developmentIds.length; i += chunkSize) {
    const chunk = developmentIds.slice(i, i + chunkSize);
    const rows = await sequelize.query(
      `SELECT hd.id AS "id",
        ARRAY_AGG(DISTINCT sl.category || ':' || sl.layer_name) AS "layers"
      FROM housing_developments hd
      JOIN spatial_layers sl
        ON ${whereSql}
        AND sl.geom IS NOT NULL
        AND ST_Intersects(
          COALESCE(hd.geom, ST_SetSRID(ST_MakePoint(hd.longitude, hd.latitude), 4326)),
          sl.geom
        )
      WHERE hd.id IN (:ids)
      GROUP BY hd.id`,
      {
        replacements: { ids: chunk },
        type: QueryTypes.SELECT,
      },
    );

    rows.forEach((row) => {
      results.set(row.id, Array.isArray(row.layers) ? row.layers : []);
    });
  }

  return results;
};

/**
 * Get housing developments with filtering and pagination
 */
async function getHousingDevelopments(userLocationScope, options = {}) {
  const {
    page = 1, limit = 20, status, housingType, villageId, districtId, regencyId, provinceId, surveyYear,
  } = options;

  const normalizedLimit = Number.parseInt(limit, 10);
  const usePagination = Number.isFinite(normalizedLimit) && normalizedLimit > 0;
  const paginationOptions = usePagination
    ? queryUtils.buildPaginationOptions(page, normalizedLimit)
    : {};
  const normalizedStatus = status ? String(status).toLowerCase() : null;
  const statusFilter = normalizedStatus === 'under_review'
    ? { [Op.in]: ['under_review', 'verified'] }
    : normalizedStatus;

  // Build where clause
  const whereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    status: statusFilter,
    housingType,
    villageId,
    districtId,
    regencyId,
    provinceId,
  });

  if (surveyYear) {
    const parsedYear = Number.parseInt(surveyYear, 10);
    if (Number.isFinite(parsedYear)) {
      const dateExpression = sequelize.fn(
        'COALESCE',
        sequelize.col('HousingDevelopment.submitted_at'),
        sequelize.col('HousingDevelopment.created_at'),
      );
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.where(getYearExpression(dateExpression), parsedYear),
      ];
    }
  }

  const gisLayerFilters = parseGisLayerFilters(options);
  const gisLayerLabel = gisLayerFilters.length > 0 ? formatGisLayerLabel(gisLayerFilters) : '';
  if (gisLayerFilters.length > 0) {
    const pointExpression = `COALESCE("HousingDevelopment"."geom", ST_SetSRID(ST_MakePoint("HousingDevelopment"."longitude", "HousingDevelopment"."latitude"), 4326))`;
    const spatialSql = buildSpatialLayerIntersectsSql(gisLayerFilters, pointExpression);
    if (spatialSql) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(spatialSql),
      ];
    }
  }

  if (normalizedStatus === 'rejected') {
    delete whereClause.status;
    whereClause.verificationStatus = 'Rejected';
  }

  if (isMasyarakat(userLocationScope)) {
    whereClause.createdBy = userLocationScope.id;
  }

  const developments = await HousingDevelopment.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Village,
        as: 'village',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: District,
        as: 'district',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Regency,
        as: 'regency',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Province,
        as: 'province',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'email'],
        required: false,
      },
      {
        model: User,
        as: 'verifier',
        attributes: ['id', 'fullName', 'email'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
    ...paginationOptions,
  });

  const pagination = paginationUtils.calculatePagination(
    usePagination ? page : 1,
    usePagination ? normalizedLimit : Math.max(developments.count, 1),
    developments.count,
  );

  developments.rows.forEach((development) => {
    applyUserDisplayName(development.creator);
    applyUserDisplayName(development.verifier);
  });

  return {
    developments: developments.rows,
    pagination,
  };
}

/**
 * Export housing developments without pagination
 */
async function exportHousingDevelopments(userLocationScope, options = {}) {
  const {
    status, housingType, villageId, districtId, regencyId, provinceId, surveyYear,
  } = options;

  const normalizedStatus = status ? String(status).toLowerCase() : null;
  const statusFilter = normalizedStatus === 'under_review'
    ? { [Op.in]: ['under_review', 'verified'] }
    : normalizedStatus;
  const scopedLocation = await enforceExportLocationScope(userLocationScope, {
    villageId,
    districtId,
    regencyId,
    provinceId,
  });
  const whereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    status: statusFilter,
    housingType,
    ...scopedLocation,
  });

  if (surveyYear) {
    const parsedYear = Number.parseInt(surveyYear, 10);
    if (Number.isFinite(parsedYear)) {
      const dateExpression = sequelize.fn(
        'COALESCE',
        sequelize.col('HousingDevelopment.submitted_at'),
        sequelize.col('HousingDevelopment.created_at'),
      );
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.where(getYearExpression(dateExpression), parsedYear),
      ];
    }
  }

  const gisLayerFilters = parseGisLayerFilters(options);
  const gisLayerLabel = gisLayerFilters.length > 0 ? formatGisLayerLabel(gisLayerFilters) : '';
  if (gisLayerFilters.length > 0) {
    const pointExpression = `COALESCE("HousingDevelopment"."geom", ST_SetSRID(ST_MakePoint("HousingDevelopment"."longitude", "HousingDevelopment"."latitude"), 4326))`;
    const spatialSql = buildSpatialLayerIntersectsSql(gisLayerFilters, pointExpression);
    if (spatialSql) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(spatialSql),
      ];
    }
  }

  if (normalizedStatus === 'rejected') {
    delete whereClause.status;
    whereClause.verificationStatus = 'Rejected';
  }

  if (isMasyarakat(userLocationScope)) {
    whereClause.createdBy = userLocationScope.id;
  }

  const developments = await HousingDevelopment.findAll({
    where: whereClause,
    include: [
      {
        model: Village,
        as: 'village',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: District,
        as: 'district',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Regency,
        as: 'regency',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Province,
        as: 'province',
        attributes: ['id', 'name'],
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
  });

  if (gisLayerFilters.length > 0) {
    if (gisLayerFilters.length === 1 && gisLayerLabel) {
      developments.forEach((development) => {
        development.setDataValue('gisAreaLabel', gisLayerLabel);
      });
    } else if (developments.length > 0) {
      const developmentIds = developments.map((development) => development.id);
      const gisLayerMap = await loadHousingDevelopmentGisLayerMap(
        developmentIds,
        gisLayerFilters,
      );
      const labelOrder = gisLayerFilters.map((filter) => ({
        key: `${filter.category}:${filter.layerName}`,
        label: formatGisLayerLabel([filter]),
      }));
      developments.forEach((development) => {
        const matched = gisLayerMap.get(development.id) || [];
        if (!matched.length) {
          return;
        }
        const matchedSet = new Set(matched);
        const labels = labelOrder
          .filter((entry) => matchedSet.has(entry.key))
          .map((entry) => entry.label)
          .filter(Boolean);
        if (labels.length > 0) {
          development.setDataValue('gisAreaLabel', labels.join(', '));
        }
      });
    }
  }

  return developments;
}

const countExportHousingDevelopments = async (userLocationScope, options = {}) => {
  const {
    status, housingType, villageId, districtId, regencyId, provinceId, surveyYear,
  } = options;

  const normalizedStatus = status ? String(status).toLowerCase() : null;
  const statusFilter = normalizedStatus === 'under_review'
    ? { [Op.in]: ['under_review', 'verified'] }
    : normalizedStatus;
  const scopedLocation = await enforceExportLocationScope(userLocationScope, {
    villageId,
    districtId,
    regencyId,
    provinceId,
  });
  const whereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    status: statusFilter,
    housingType,
    ...scopedLocation,
  });

  if (surveyYear) {
    const parsedYear = Number.parseInt(surveyYear, 10);
    if (Number.isFinite(parsedYear)) {
      const dateExpression = sequelize.fn(
        'COALESCE',
        sequelize.col('HousingDevelopment.submitted_at'),
        sequelize.col('HousingDevelopment.created_at'),
      );
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.where(getYearExpression(dateExpression), parsedYear),
      ];
    }
  }

  const gisLayerFilters = parseGisLayerFilters(options);
  if (gisLayerFilters.length > 0) {
    const pointExpression = `COALESCE("HousingDevelopment"."geom", ST_SetSRID(ST_MakePoint("HousingDevelopment"."longitude", "HousingDevelopment"."latitude"), 4326))`;
    const spatialSql = buildSpatialLayerIntersectsSql(gisLayerFilters, pointExpression);
    if (spatialSql) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(spatialSql),
      ];
    }
  }

  if (normalizedStatus === 'rejected') {
    delete whereClause.status;
    whereClause.verificationStatus = 'Rejected';
  }

  if (isMasyarakat(userLocationScope)) {
    whereClause.createdBy = userLocationScope.id;
  }

  const match = await HousingDevelopment.findOne({
    where: whereClause,
    attributes: ['id'],
    raw: true,
  });

  return match ? 1 : 0;
};

/**
 * Get housing development by ID
 */
async function getHousingDevelopmentById(developmentId, userLocationScope = null) {
  const development = await HousingDevelopment.findByPk(developmentId, {
    include: [
      {
        model: Village,
        as: 'village',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: District,
        as: 'district',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Regency,
        as: 'regency',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: Province,
        as: 'province',
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'fullName', 'email'],
        required: false,
      },
      {
        model: User,
        as: 'updater',
        attributes: ['id', 'fullName', 'email'],
        required: false,
      },
      {
        model: User,
        as: 'verifier',
        attributes: ['id', 'fullName', 'email'],
        required: false,
      },
    ],
  });

  if (!development) {
    throw errorFactory('NOT_FOUND', 'Housing development not found');
  }

  if (userLocationScope && isMasyarakat(userLocationScope)) {
    const createdBy = development.createdBy || development.get?.('createdBy');
    if (createdBy !== userLocationScope.id) {
      throw errorFactory.authorization('Access denied for this development');
    }
  }

  applyUserDisplayName(development.creator);
  applyUserDisplayName(development.updater);
  applyUserDisplayName(development.verifier);

  return development;
}

/**
 * Create housing development
 */
async function createHousingDevelopment(developmentData, userId) {
  const developmentLatitude = normalizeCoordinateValue(developmentData.latitude);
  const developmentLongitude = normalizeCoordinateValue(developmentData.longitude);
  const developmentGeom = buildPointGeom(developmentLatitude, developmentLongitude);
  const coordsProvided = Number.isFinite(developmentLatitude) && Number.isFinite(developmentLongitude);
  let resolvedLocation = null;
  if (coordsProvided) {
    resolvedLocation = await findLocationByCoordinates(
      developmentLatitude,
      developmentLongitude,
    );

    const mismatch = (expected, actual) => expected && actual && expected !== actual;
    if (
      mismatch(developmentData.villageId, resolvedLocation.village?.id)
      || mismatch(developmentData.districtId, resolvedLocation.district?.id)
      || mismatch(developmentData.regencyId, resolvedLocation.regency?.id)
      || mismatch(developmentData.provinceId, resolvedLocation.province?.id)
    ) {
      throw errorFactory.validation(
        'Koordinat tidak sesuai dengan wilayah yang dipilih.',
        'coordinates',
      );
    }
  }

  const requestedStatus = String(developmentData?.status || '').toLowerCase();
  const initialStatus = requestedStatus === 'draft' ? 'draft' : 'submitted';
  const requestedSubmittedAt = developmentData?.submittedAt
    ? new Date(developmentData.submittedAt)
    : null;
  const submittedAt = initialStatus === 'submitted'
    ? (Number.isNaN(requestedSubmittedAt?.getTime?.()) ? new Date() : requestedSubmittedAt)
    : null;

  const development = await HousingDevelopment.create({
    developmentName: developmentData.developmentName,
    developerName: developmentData.developerName,
    landArea: developmentData.landArea,
    latitude: developmentLatitude,
    longitude: developmentLongitude,
    geom: developmentGeom,
    housingType: developmentData.housingType,
    plannedUnitCount: developmentData.plannedUnitCount,
    hasRoadAccess: developmentData.hasRoadAccess,
    roadLengthMeters: developmentData.roadLengthMeters,
    landStatus: developmentData.landStatus,
    villageId: resolvedLocation?.village?.id || developmentData.villageId,
    districtId: resolvedLocation?.district?.id || developmentData.districtId,
    regencyId: resolvedLocation?.regency?.id || developmentData.regencyId,
    provinceId: resolvedLocation?.province?.id || developmentData.provinceId,
    notes: developmentData.notes,
    status: initialStatus,
    verificationStatus: 'Pending',
    submittedAt,
    createdBy: userId,
    updatedBy: userId,
  });

  // Log audit
  const auditLog = await AuditLog.create({
    userId,
    action: 'CREATE',
    resourceType: 'housing_development',
    resourceId: development.id,
    details: { developmentName: development.developmentName },
  });

  if (development.status !== 'draft') {
    try {
      const reviewers = await findReviewerUsersForScope({
        villageId: development.villageId,
        districtId: development.districtId,
        regencyId: development.regencyId,
        provinceId: development.provinceId,
      });
      await createNotificationsForUsers(
        reviewers.map((reviewer) => reviewer.id),
        {
          type: 'info',
          title: 'Data Perumahan Baru',
          message: `Data perumahan "${development.developmentName || '-'}" menunggu verifikasi.`,
          link: `/housing-development-data?developmentId=${development.id}`,
        },
      );
    } catch (notifyError) {
      console.warn('Failed to notify housing development reviewers:', notifyError.message);
    }
  }

  return getHousingDevelopmentById(development.id);
}

/**
 * Update housing development
 */
async function updateHousingDevelopment(developmentId, developmentData, user) {
  const development = await HousingDevelopment.findByPk(developmentId);
  if (!development) {
    throw errorFactory('NOT_FOUND', 'Housing development not found');
  }

  const updaterId = typeof user === 'object' ? user.id : user;
  const canReviewEdit = typeof user === 'object' && (isSuperAdmin(user) || isVerifikator(user));

  // Check if development can be updated (only draft status)
  if (development.status !== 'draft' && !(canReviewEdit && ['submitted', 'under_review', 'verified'].includes(development.status))) {
    throw errorFactory('BAD_REQUEST', 'Only draft developments can be updated');
  }

  const nextLatitude = normalizeCoordinateValue(
    developmentData.latitude ?? development.latitude,
  );
  const nextLongitude = normalizeCoordinateValue(
    developmentData.longitude ?? development.longitude,
  );
  const nextGeom = buildPointGeom(nextLatitude, nextLongitude);
  const updatePayload = {
    developmentName: developmentData.developmentName ?? development.developmentName,
    developerName: developmentData.developerName ?? development.developerName,
    landArea: developmentData.landArea ?? development.landArea,
    latitude: nextLatitude,
    longitude: nextLongitude,
    housingType: developmentData.housingType ?? development.housingType,
    plannedUnitCount: developmentData.plannedUnitCount ?? development.plannedUnitCount,
    hasRoadAccess: developmentData.hasRoadAccess ?? development.hasRoadAccess,
    roadLengthMeters: developmentData.roadLengthMeters ?? development.roadLengthMeters,
    landStatus: developmentData.landStatus ?? development.landStatus,
    villageId: developmentData.villageId ?? development.villageId,
    districtId: developmentData.districtId ?? development.districtId,
    regencyId: developmentData.regencyId ?? development.regencyId,
    provinceId: developmentData.provinceId ?? development.provinceId,
    notes: developmentData.notes ?? development.notes,
    updatedBy: updaterId,
  };

  if (nextGeom !== undefined) {
    updatePayload.geom = nextGeom;
  }

  await development.update(updatePayload);

  // Log audit
  await AuditLog.create({
    userId: updaterId,
    action: 'UPDATE',
    resourceType: 'housing_development',
    resourceId: development.id,
    details: { developmentName: development.developmentName },
  });

  return getHousingDevelopmentById(development.id);
}

/**
 * Submit housing development (change status to submitted)
 */
async function submitHousingDevelopment(developmentId, userId) {
  const development = await HousingDevelopment.findByPk(developmentId);
  if (!development) {
    throw errorFactory('NOT_FOUND', 'Housing development not found');
  }

  if (development.status !== 'draft') {
    throw errorFactory('BAD_REQUEST', 'Only draft developments can be submitted');
  }

  await development.update({
    status: 'submitted',
    submittedAt: new Date(),
    updatedBy: userId,
  });

  // Log audit
  const auditLog = await AuditLog.create({
    userId,
    action: 'SUBMIT',
    resourceType: 'housing_development',
    resourceId: development.id,
    details: { developmentName: development.developmentName },
  });

  try {
    const reviewers = await findReviewerUsersForScope({
      villageId: development.villageId,
      districtId: development.districtId,
      regencyId: development.regencyId,
      provinceId: development.provinceId,
    });
      await createNotificationsForUsers(
        reviewers.map((reviewer) => reviewer.id),
        {
          type: 'info',
          category: 'verification',
          title: 'Data Perumahan Baru',
          message: `Data perumahan "${development.developmentName || '-'}" menunggu verifikasi.`,
          link: `/housing-development-data?developmentId=${development.id}`,
          auditLogId: auditLog?.id,
        },
    );
  } catch (notifyError) {
    console.warn('Failed to notify housing development reviewers:', notifyError.message);
  }

  return getHousingDevelopmentById(development.id);
}

/**
 * Verify housing development (review workflow)
 */
async function verifyHousingDevelopment(developmentId, verifierId, reviewData = {}, reviewerContext = null) {
  const development = await HousingDevelopment.findByPk(developmentId);
  if (!development) {
    throw errorFactory('NOT_FOUND', 'Housing development not found');
  }

  if (development.status === 'approved' || development.verificationStatus === 'Rejected') {
    throw errorFactory.conflict('Housing development has already been finalized');
  }

  const normalizedStatus = String(reviewData.status || '').toLowerCase();
  const reviewNotes = reviewData.reviewNotes ? String(reviewData.reviewNotes).trim() : null;
  const isImplicitSubmitted = development.status === 'draft' && development.verificationStatus === 'Pending';
  const effectiveStatus = isImplicitSubmitted ? 'submitted' : development.status;

  if (!normalizedStatus) {
    throw errorFactory.validation('Status review wajib diisi');
  }

  if (normalizedStatus === 'rejected' && !reviewNotes) {
    throw errorFactory.validation('Alasan penolakan wajib diisi.', 'reviewNotes');
  }

  const normalizedVerifierId = verifierId ? String(verifierId) : null;
  const assignedVerifierId = development.verifiedBy ? String(development.verifiedBy) : null;
  const isLockedByOther = ['under_review', 'verified'].includes(development.status)
    && assignedVerifierId
    && assignedVerifierId !== normalizedVerifierId
    && development.verificationStatus === 'Pending';

  if (isLockedByOther && !isSuperAdmin(reviewerContext)) {
    throw errorFactory.conflict('Housing development sedang ditinjau oleh verifikator lain');
  }

  let nextStatus = development.status;
  let verificationStatus = development.verificationStatus || 'Pending';

  if (['under_review', 'verified', 'reviewed'].includes(normalizedStatus)) {
    if (!['submitted', 'under_review', 'verified'].includes(effectiveStatus)) {
      throw errorFactory.conflict('Housing development tidak bisa masuk tahap review');
    }
    nextStatus = 'under_review';
    verificationStatus = 'Pending';
  } else if (normalizedStatus === 'approved') {
    if (!['submitted', 'under_review', 'verified'].includes(effectiveStatus)) {
      throw errorFactory.conflict('Housing development tidak bisa disetujui pada status saat ini');
    }
    nextStatus = 'approved';
    verificationStatus = 'Verified';
  } else if (normalizedStatus === 'rejected') {
    if (!['submitted', 'under_review', 'verified'].includes(effectiveStatus)) {
      throw errorFactory.conflict('Housing development tidak bisa ditolak pada status saat ini');
    }
    nextStatus = 'rejected';
    verificationStatus = 'Rejected';
  } else {
    throw errorFactory.validation('Invalid status for review');
  }

  const oldValues = {
    status: development.status,
    verificationStatus: development.verificationStatus,
    reviewNotes: development.reviewNotes,
    verifiedAt: development.verifiedAt,
    verifiedBy: development.verifiedBy,
  };

  const reviewedAt = new Date();
  await development.update({
    status: nextStatus,
    verificationStatus,
    reviewNotes,
    verifiedBy: verifierId,
    verifiedAt: reviewedAt,
    updatedBy: verifierId,
  });

  // Log audit
  const auditLog = await AuditLog.create({
    userId: verifierId,
    action: 'VERIFY',
    resourceType: 'housing_development',
    resourceId: development.id,
    oldValues,
    newValues: {
      status: nextStatus,
      verificationStatus,
      reviewNotes,
      verifiedAt: reviewedAt,
      verifiedBy: verifierId,
    },
  });

  try {
    const statusLabel = normalizedStatus === 'approved'
      ? 'disetujui'
      : normalizedStatus === 'rejected'
        ? 'ditolak'
        : 'dalam tinjauan';
    await createNotification(development.createdBy, {
      type: normalizedStatus === 'approved' ? 'success' : normalizedStatus === 'rejected' ? 'warning' : 'info',
      category: 'status',
      title: 'Pembaruan Status Perumahan',
      message: `Data perumahan Anda ${statusLabel}. ${reviewNotes ? `Catatan: ${reviewNotes}` : ''}`.trim(),
      link: `/housing-development-data?developmentId=${development.id}`,
      auditLogId: auditLog?.id,
    });
  } catch (notifyError) {
    console.warn('Failed to notify housing development submitter:', notifyError.message);
  }

  return getHousingDevelopmentById(development.id);
}

const reviewHousingDevelopment = async (developmentId, reviewData, reviewerId, reviewerContext = null) =>
  verifyHousingDevelopment(developmentId, reviewerId, reviewData, reviewerContext);

/**
 * Get housing development statistics
 */
const getHousingDevelopmentStatistics = async (userLocationScope, options = {}) => {
  const {
    villageId, districtId, regencyId, provinceId, surveyYear,
  } = options;

  const baseWhereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    villageId, districtId, regencyId, provinceId,
  });
  const whereClause = isMasyarakat(userLocationScope)
    ? { ...baseWhereClause, createdBy: userLocationScope.id }
    : baseWhereClause;

  if (surveyYear) {
    const parsedYear = Number.parseInt(surveyYear, 10);
    if (Number.isFinite(parsedYear)) {
      const dateExpression = sequelize.fn(
        'COALESCE',
        sequelize.col('HousingDevelopment.submitted_at'),
        sequelize.col('HousingDevelopment.created_at'),
      );
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.where(getYearExpression(dateExpression), parsedYear),
      ];
    }
  }

  const statusScope = { [Op.in]: ['approved', 'submitted', 'under_review'] };
  const statsWhereClause = {
    ...whereClause,
    status: statusScope,
  };

  const stats = await HousingDevelopment.findAll({
    where: statsWhereClause,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('HousingDevelopment.id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  });

  const totalDevelopments = await HousingDevelopment.count({ where: statsWhereClause });

  const now = new Date();
  const monthKeys = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const dateExpression = sequelize.fn(
    'COALESCE',
    sequelize.col('HousingDevelopment.submitted_at'),
    sequelize.col('HousingDevelopment.created_at'),
  );

  const monthlyWhere = { ...statsWhereClause };
  const monthlyAnd = monthlyWhere[Op.and] ? [...monthlyWhere[Op.and]] : [];
  monthlyAnd.push(
    sequelize.where(dateExpression, {
      [Op.gte]: startDate,
      [Op.lt]: endDate,
    }),
  );
  monthlyWhere[Op.and] = monthlyAnd;

  const monthlyRows = await HousingDevelopment.findAll({
    where: monthlyWhere,
    attributes: [
      [getMonthExpression(dateExpression), 'month'],
      [sequelize.fn('COUNT', sequelize.col('HousingDevelopment.id')), 'count'],
    ],
    group: ['month'],
    raw: true,
  });

  const monthlyCounts = monthKeys.map(() => 0);
  monthlyRows.forEach((row) => {
    const idx = monthKeys.indexOf(String(row.month));
    if (idx >= 0) {
      monthlyCounts[idx] = parseInt(row.count, 10);
    }
  });

  const statusBreakdown = stats.reduce((acc, stat) => {
    const key = String(stat.status || '').toLowerCase();
    acc[key] = parseInt(stat.count, 10);
    return acc;
  }, {});

  const statusSummary = {
    verified: statusBreakdown.approved || 0,
    pending:
      (statusBreakdown.submitted || 0)
      + (statusBreakdown.under_review || 0),
    rejected: statusBreakdown.rejected || 0,
  };

  return {
    total: totalDevelopments,
    totalDevelopments,
    statusBreakdown,
    statusSummary,
    monthlySubmissions: {
      labels: monthKeys,
      counts: monthlyCounts,
    },
  };
};

/**
 * Delete housing development
 */
async function deleteHousingDevelopment(developmentId, userId) {
  const development = await HousingDevelopment.findByPk(developmentId);
  if (!development) {
    throw errorFactory('NOT_FOUND', 'Housing development not found');
  }

  // Only allow deletion of draft developments
  if (development.status !== 'draft') {
    throw errorFactory('BAD_REQUEST', 'Only draft developments can be deleted');
  }

  const { developmentName } = development;

  await development.destroy();

  // Log audit
  await AuditLog.create({
    userId,
    action: 'DELETE',
    resourceType: 'housing_development',
    resourceId: developmentId,
    details: { developmentName },
  });

  return { message: 'Housing development deleted successfully' };
}

module.exports = {
  getHousingDevelopments,
  getHousingDevelopmentById,
  createHousingDevelopment,
  updateHousingDevelopment,
  submitHousingDevelopment,
  verifyHousingDevelopment,
  reviewHousingDevelopment,
  getHousingDevelopmentStatistics,
  deleteHousingDevelopment,
  exportHousingDevelopments,
  countExportHousingDevelopments,
};
