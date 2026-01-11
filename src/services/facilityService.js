const { Op, QueryTypes } = require('sequelize');
const {
  FacilitySurvey,
  FacilityVillageInfo,
  FacilityCommercial,
  FacilityPublicServices,
  FacilityEducation,
  FacilityHealth,
  FacilityReligious,
  FacilityRecreation,
  FacilityCemetery,
  FacilityGreenSpace,
  FacilityParking,
  UtilityElectricity,
  UtilityWater,
  UtilityTelecom,
  UtilityGas,
  UtilityTransportation,
  UtilityFireDepartment,
  UtilityStreetLighting,
  Province,
  Regency,
  District,
  Village,
  User,
  AuditLog,
  sequelize,
} = require('../models');
const {
  queryUtils, paginationUtils,
} = require('../utils/lodashUtils');
const { errorFactory } = require('../errors/errorUtils');
const { getMonthExpression } = require('../utils/sqlDateUtils');
const {
  createNotification,
  createNotificationsForUsers,
  findReviewerUsersForScope,
} = require('./notificationService');
const { findSearchIndexEntry } = require('./searchIndexService');
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
  isAdminDesa,
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

const resolveFacilityCoordinates = (surveyData = {}) => {
  const location = surveyData?.location || {};
  const hasInput = [
    location.latitude,
    location.longitude,
    location.lat,
    location.lng,
    location.lon,
    surveyData.latitude,
    surveyData.longitude,
    surveyData.lat,
    surveyData.lng,
    surveyData.lon,
  ].some((value) => value !== undefined);

  if (!hasInput) {
    return {
      latitude: undefined,
      longitude: undefined,
      geom: undefined,
    };
  }

  const latitude = normalizeCoordinateValue(
    location.latitude ?? location.lat ?? surveyData.latitude ?? surveyData.lat,
  );
  const longitude = normalizeCoordinateValue(
    location.longitude ?? location.lng ?? location.lon ?? surveyData.longitude ?? surveyData.lng ?? surveyData.lon,
  );

  return {
    latitude,
    longitude,
    geom: buildPointGeom(latitude, longitude),
  };
};

const loadFacilityLocationNames = async (surveyData = {}) => {
  const villageId = surveyData.villageId || null;
  const districtId = surveyData.districtId || null;
  const regencyId = surveyData.regencyId || null;
  const provinceId = surveyData.provinceId || null;

  const village = villageId
    ? await Village.findByPk(villageId, { attributes: ['id', 'name', 'districtId'] })
    : null;

  const resolvedDistrictId = districtId || village?.districtId || null;
  const district = resolvedDistrictId
    ? await District.findByPk(resolvedDistrictId, { attributes: ['id', 'name', 'regencyId'] })
    : null;

  const resolvedRegencyId = regencyId || district?.regencyId || null;
  const regency = resolvedRegencyId
    ? await Regency.findByPk(resolvedRegencyId, { attributes: ['id', 'name', 'provinceId'] })
    : null;

  const resolvedProvinceId = provinceId || regency?.provinceId || null;
  const province = resolvedProvinceId
    ? await Province.findByPk(resolvedProvinceId, { attributes: ['id', 'name'] })
    : null;

  return {
    villageName: village?.name || null,
    districtName: district?.name || null,
    regencyName: regency?.name || null,
    provinceName: province?.name || null,
  };
};

const resolveFacilitySearchCoordinates = async ({
  villageName,
  districtName,
  regencyName,
  provinceName,
}) => {
  let searchEntry = null;

  if (villageName) {
    searchEntry = await findSearchIndexEntry({
      type: 'Desa',
      name: villageName,
      parentParts: {
        district: districtName,
        regency: regencyName,
      },
    });
  }

  if (!searchEntry && districtName) {
    searchEntry = await findSearchIndexEntry({
      type: 'Kecamatan',
      name: districtName,
      parentParts: {
        regency: regencyName,
      },
    });
  }

  if (!searchEntry && regencyName) {
    searchEntry = await findSearchIndexEntry({
      type: 'Kabupaten',
      name: regencyName,
      parentParts: {
        province: provinceName,
      },
    });
  }

  if (!searchEntry || !Array.isArray(searchEntry.coords)) {
    return null;
  }

  const latitude = Number(searchEntry.coords[0]);
  const longitude = Number(searchEntry.coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
};

const normalizeFacilityItems = (items = []) => {
  if (!Array.isArray(items)) return null;
  return items
    .map((item) => {
      const type = String(item?.type || '').trim();
      const name = String(item?.name || '').trim();
      return {
        id: item?.id || null,
        type,
        name,
      };
    })
    .filter((item) => item.name.length > 0 && item.type.length > 0);
};

const syncFacilityItems = async (Model, facilitySurveyId, items, transaction) => {
  if (!Array.isArray(items)) return;
  const normalized = normalizeFacilityItems(items);
  const existingItems = await Model.findAll({
    where: { facilitySurveyId },
    transaction,
  });
  const existingIds = new Set(existingItems.map((item) => item.id));
  const incomingIds = new Set(
    normalized.map((item) => item.id).filter(Boolean),
  );

  const idsToDelete = existingItems
    .filter((item) => !incomingIds.has(item.id))
    .map((item) => item.id);

  if (idsToDelete.length > 0) {
    await Model.destroy({
      where: {
        id: { [Op.in]: idsToDelete },
        facilitySurveyId,
      },
      transaction,
    });
  }

  const toUpdate = normalized.filter(
    (item) => item.id && existingIds.has(item.id),
  );
  const toCreate = normalized.filter(
    (item) => !item.id || !existingIds.has(item.id),
  );

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((item) => Model.update(
        {
          type: item.type,
          name: item.name,
        },
        {
          where: { id: item.id, facilitySurveyId },
          transaction,
        },
      )),
    );
  }

  if (toCreate.length > 0) {
    await Model.bulkCreate(
      toCreate.map((item) => ({
        facilitySurveyId,
        type: item.type,
        name: item.name,
      })),
      { transaction },
    );
  }
};

const buildFacilityAdminMatchSql = () => {
  const villageExpr = `COALESCE(sl_admin.properties->>'DESA', sl_admin.properties->>'KELURAHAN', sl_admin.properties->>'NAMOBJ', sl_admin.properties->>'WADMKD', sl_admin.properties->>'VILLAGE')`;
  const districtExpr = `COALESCE(sl_admin.properties->>'KECAMATAN', sl_admin.properties->>'WADMKC', sl_admin.properties->>'DISTRICT')`;
  const regencyExpr = `COALESCE(sl_admin.properties->>'KAB_KOTA', sl_admin.properties->>'KABUPATEN', sl_admin.properties->>'WADMKK', sl_admin.properties->>'REGENCY')`;

  return `(
    ("village"."name" IS NOT NULL
      AND sl_admin.category = 'administrasi'
      AND sl_admin.layer_name = 'batas_desa'
      AND UPPER(${villageExpr}) = UPPER("village"."name")
      AND UPPER(${districtExpr}) = UPPER("district"."name")
      AND UPPER(${regencyExpr}) = UPPER("regency"."name")
    )
    OR ("village"."name" IS NULL
      AND "district"."name" IS NOT NULL
      AND sl_admin.category = 'administrasi'
      AND sl_admin.layer_name = 'batas_kecamatan'
      AND UPPER(${districtExpr}) = UPPER("district"."name")
      AND UPPER(${regencyExpr}) = UPPER("regency"."name")
    )
    OR ("village"."name" IS NULL
      AND "district"."name" IS NULL
      AND "regency"."name" IS NOT NULL
      AND sl_admin.category = 'administrasi'
      AND sl_admin.layer_name = 'batas_kabupaten'
      AND UPPER(${regencyExpr}) = UPPER("regency"."name")
    )
  )`;
};

const buildFacilityAdminIntersectsSql = (gisLayerFilters) => {
  const hazardSql = buildSpatialLayerIntersectsSql(gisLayerFilters, 'sl_admin.geom');
  if (!hazardSql) {
    return null;
  }

  const adminMatchSql = buildFacilityAdminMatchSql();

  return `EXISTS (
    SELECT 1
    FROM spatial_layers sl_admin
    WHERE ${adminMatchSql}
      AND ${hazardSql}
  )`;
};

const loadFacilityGisLayerMap = async (surveyIds, gisLayerFilters) => {
  if (!Array.isArray(surveyIds) || surveyIds.length === 0) {
    return new Map();
  }

  const pointWhereSql = buildSpatialLayerWhereSql(gisLayerFilters, 'sl');
  const hazardWhereSql = buildSpatialLayerWhereSql(gisLayerFilters, 'sl_hazard');
  if (!pointWhereSql || !hazardWhereSql) {
    return new Map();
  }

  const results = new Map();
  const chunkSize = 500;

  for (let i = 0; i < surveyIds.length; i += chunkSize) {
    const chunk = surveyIds.slice(i, i + chunkSize);
    const pointRows = await sequelize.query(
      `SELECT fs.id AS "id",
        ARRAY_AGG(DISTINCT sl.category || ':' || sl.layer_name) AS "layers"
      FROM facility_surveys fs
      JOIN spatial_layers sl
        ON ${pointWhereSql}
        AND sl.geom IS NOT NULL
        AND ST_Intersects(
          COALESCE(fs.geom, ST_SetSRID(ST_MakePoint(fs.longitude, fs.latitude), 4326)),
          sl.geom
        )
      WHERE fs.id IN (:ids)
        AND (
          fs.geom IS NOT NULL
          OR (fs.latitude IS NOT NULL AND fs.longitude IS NOT NULL)
        )
      GROUP BY fs.id`,
      {
        replacements: { ids: chunk },
        type: QueryTypes.SELECT,
      },
    );

    pointRows.forEach((row) => {
      results.set(row.id, Array.isArray(row.layers) ? row.layers : []);
    });

    const adminMatchSql = buildFacilityAdminMatchSql();
    const adminRows = await sequelize.query(
      `SELECT fs.id AS "id",
        ARRAY_AGG(DISTINCT sl_hazard.category || ':' || sl_hazard.layer_name) AS "layers"
      FROM facility_surveys fs
      LEFT JOIN villages village ON fs.village_id = village.id
      LEFT JOIN districts district ON fs.district_id = district.id
      LEFT JOIN regencies regency ON fs.regency_id = regency.id
      JOIN spatial_layers sl_admin
        ON ${adminMatchSql}
      JOIN spatial_layers sl_hazard
        ON ${hazardWhereSql}
        AND sl_hazard.geom IS NOT NULL
        AND sl_admin.geom IS NOT NULL
        AND ST_Intersects(sl_admin.geom, sl_hazard.geom)
      WHERE fs.id IN (:ids)
        AND fs.geom IS NULL
        AND (fs.latitude IS NULL OR fs.longitude IS NULL)
      GROUP BY fs.id`,
      {
        replacements: { ids: chunk },
        type: QueryTypes.SELECT,
      },
    );

    adminRows.forEach((row) => {
      results.set(row.id, Array.isArray(row.layers) ? row.layers : []);
    });
  }

  return results;
};

/**
 * Get facility surveys with filtering and pagination
 */
async function getFacilitySurveys(userLocationScope, options = {}) {
  const {
    page = 1, limit = 20, status, surveyYear, surveyPeriod, villageId, districtId, regencyId, provinceId,
  } = options;

  const normalizedLimit = Number.parseInt(limit, 10);
  const usePagination = Number.isFinite(normalizedLimit) && normalizedLimit > 0;
  const paginationOptions = usePagination
    ? queryUtils.buildPaginationOptions(page, normalizedLimit)
    : {};
  const normalizedStatus = status ? String(status).toLowerCase() : null;
  const statusFilter = normalizedStatus === 'under_review' ? 'verified' : normalizedStatus;

  // Build where clause based on user's location access
  const whereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    status: statusFilter,
    surveyYear,
    surveyPeriod,
    villageId,
    districtId,
    regencyId,
    provinceId,
  });

  if (normalizedStatus === 'rejected') {
    delete whereClause.status;
    whereClause.verificationStatus = 'Rejected';
  }

  if (isMasyarakat(userLocationScope)) {
    whereClause.createdBy = userLocationScope.id;
  }

  const surveys = await FacilitySurvey.findAndCountAll({
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
    usePagination ? normalizedLimit : Math.max(surveys.count, 1),
    surveys.count,
  );

  return {
    surveys: surveys.rows,
    pagination,
  };
}

/**
 * Export facility surveys without pagination
 */
async function exportFacilitySurveys(userLocationScope, options = {}) {
  const {
    status, surveyYear, surveyPeriod, villageId, districtId, regencyId, provinceId,
  } = options;

  const normalizedStatus = status ? String(status).toLowerCase() : null;
  const statusFilter = normalizedStatus === 'under_review' ? 'verified' : normalizedStatus;
  const scopedLocation = await enforceExportLocationScope(userLocationScope, {
    villageId,
    districtId,
    regencyId,
    provinceId,
  });
  const whereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    status: statusFilter,
    surveyYear,
    surveyPeriod,
    ...scopedLocation,
  });

  if (normalizedStatus === 'rejected') {
    delete whereClause.status;
    whereClause.verificationStatus = 'Rejected';
  }

  if (isMasyarakat(userLocationScope)) {
    whereClause.createdBy = userLocationScope.id;
  }

  const gisLayerFilters = parseGisLayerFilters(options);
  const gisLayerLabel = gisLayerFilters.length > 0 ? formatGisLayerLabel(gisLayerFilters) : '';
  if (gisLayerFilters.length > 0) {
    const pointExpression = `COALESCE("FacilitySurvey"."geom", ST_SetSRID(ST_MakePoint("FacilitySurvey"."longitude", "FacilitySurvey"."latitude"), 4326))`;
    const pointSql = buildSpatialLayerIntersectsSql(gisLayerFilters, pointExpression);
    const adminSql = buildFacilityAdminIntersectsSql(gisLayerFilters);
    const fallbackSql = adminSql
      ? `(("FacilitySurvey"."geom" IS NULL AND ("FacilitySurvey"."latitude" IS NULL OR "FacilitySurvey"."longitude" IS NULL)) AND ${adminSql})`
      : null;
    const spatialSql = pointSql && fallbackSql
      ? `(${pointSql} OR ${fallbackSql})`
      : (pointSql || adminSql);
    if (spatialSql) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(spatialSql),
      ];
    }
  }

  const surveys = await FacilitySurvey.findAll({
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
        model: FacilityVillageInfo,
        as: 'villageInfo',
        required: false,
      },
      {
        model: FacilityCommercial,
        as: 'commercial',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityPublicServices,
        as: 'publicServices',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityEducation,
        as: 'education',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityHealth,
        as: 'health',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityReligious,
        as: 'religious',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityRecreation,
        as: 'recreation',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityCemetery,
        as: 'cemetery',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityGreenSpace,
        as: 'greenSpace',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: FacilityParking,
        as: 'parking',
        attributes: ['id', 'name', 'quantity'],
        required: false,
      },
      {
        model: UtilityElectricity,
        as: 'electricity',
        required: false,
      },
      {
        model: UtilityWater,
        as: 'water',
        required: false,
      },
      {
        model: UtilityTelecom,
        as: 'telecom',
        required: false,
      },
      {
        model: UtilityGas,
        as: 'gas',
        required: false,
      },
      {
        model: UtilityTransportation,
        as: 'transportation',
        required: false,
      },
      {
        model: UtilityFireDepartment,
        as: 'fireDepartment',
        required: false,
      },
      {
        model: UtilityStreetLighting,
        as: 'streetLighting',
        required: false,
      },
    ],
    order: [['created_at', 'DESC']],
  });

  if (gisLayerFilters.length > 0) {
    if (gisLayerFilters.length === 1 && gisLayerLabel) {
      surveys.forEach((survey) => {
        survey.setDataValue('gisAreaLabel', gisLayerLabel);
      });
    } else if (surveys.length > 0) {
      const surveyIds = surveys.map((survey) => survey.id);
      const gisLayerMap = await loadFacilityGisLayerMap(
        surveyIds,
        gisLayerFilters,
      );
      const labelOrder = gisLayerFilters.map((filter) => ({
        key: `${filter.category}:${filter.layerName}`,
        label: formatGisLayerLabel([filter]),
      }));
      surveys.forEach((survey) => {
        const matched = gisLayerMap.get(survey.id) || [];
        if (!matched.length) {
          return;
        }
        const matchedSet = new Set(matched);
        const labels = labelOrder
          .filter((entry) => matchedSet.has(entry.key))
          .map((entry) => entry.label)
          .filter(Boolean);
        if (labels.length > 0) {
          survey.setDataValue('gisAreaLabel', labels.join(', '));
        }
      });
    }
  }

  return surveys;
}

const countExportFacilitySurveys = async (userLocationScope, options = {}) => {
  const {
    status, surveyYear, surveyPeriod, villageId, districtId, regencyId, provinceId,
  } = options;

  const normalizedStatus = status ? String(status).toLowerCase() : null;
  const statusFilter = normalizedStatus === 'under_review' ? 'verified' : normalizedStatus;
  const scopedLocation = await enforceExportLocationScope(userLocationScope, {
    villageId,
    districtId,
    regencyId,
    provinceId,
  });
  const whereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    status: statusFilter,
    surveyYear,
    surveyPeriod,
    ...scopedLocation,
  });

  if (normalizedStatus === 'rejected') {
    delete whereClause.status;
    whereClause.verificationStatus = 'Rejected';
  }

  if (isMasyarakat(userLocationScope)) {
    whereClause.createdBy = userLocationScope.id;
  }

  const gisLayerFilters = parseGisLayerFilters(options);
  if (gisLayerFilters.length > 0) {
    const pointExpression = `COALESCE("FacilitySurvey"."geom", ST_SetSRID(ST_MakePoint("FacilitySurvey"."longitude", "FacilitySurvey"."latitude"), 4326))`;
    const pointSql = buildSpatialLayerIntersectsSql(gisLayerFilters, pointExpression);
    const adminSql = buildFacilityAdminIntersectsSql(gisLayerFilters);
    const fallbackSql = adminSql
      ? `(("FacilitySurvey"."geom" IS NULL AND ("FacilitySurvey"."latitude" IS NULL OR "FacilitySurvey"."longitude" IS NULL)) AND ${adminSql})`
      : null;
    const spatialSql = pointSql && fallbackSql
      ? `(${pointSql} OR ${fallbackSql})`
      : (pointSql || adminSql);
    if (spatialSql) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(spatialSql),
      ];
    }
  }

  const include = [];
  if (gisLayerFilters.length > 0) {
    include.push(
      {
        model: Village,
        as: 'village',
        attributes: [],
        required: false,
      },
      {
        model: District,
        as: 'district',
        attributes: [],
        required: false,
      },
      {
        model: Regency,
        as: 'regency',
        attributes: [],
        required: false,
      },
    );
  }

  const match = await FacilitySurvey.findOne({
    where: whereClause,
    include,
    attributes: ['id'],
    raw: true,
  });

  return match ? 1 : 0;
};

/**
 * Get facility survey by ID with all related data
 */
async function getFacilitySurveyById(surveyId, userLocationScope = null) {
  const survey = await FacilitySurvey.findByPk(surveyId, {
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
      {
        model: FacilityVillageInfo,
        as: 'villageInfo',
        required: false,
      },
      {
        model: FacilityCommercial,
        as: 'commercial',
        required: false,
      },
      {
        model: FacilityPublicServices,
        as: 'publicServices',
        required: false,
      },
      {
        model: FacilityEducation,
        as: 'education',
        required: false,
      },
      {
        model: FacilityHealth,
        as: 'health',
        required: false,
      },
      {
        model: FacilityReligious,
        as: 'religious',
        required: false,
      },
      {
        model: FacilityRecreation,
        as: 'recreation',
        required: false,
      },
      {
        model: FacilityCemetery,
        as: 'cemetery',
        required: false,
      },
      {
        model: FacilityGreenSpace,
        as: 'greenSpace',
        required: false,
      },
      {
        model: FacilityParking,
        as: 'parking',
        required: false,
      },
      {
        model: UtilityElectricity,
        as: 'electricity',
        required: false,
      },
      {
        model: UtilityWater,
        as: 'water',
        required: false,
      },
      {
        model: UtilityTelecom,
        as: 'telecom',
        required: false,
      },
      {
        model: UtilityGas,
        as: 'gas',
        required: false,
      },
      {
        model: UtilityTransportation,
        as: 'transportation',
        required: false,
      },
      {
        model: UtilityFireDepartment,
        as: 'fireDepartment',
        required: false,
      },
      {
        model: UtilityStreetLighting,
        as: 'streetLighting',
        required: false,
      },
    ],
  });

  if (!survey) {
    throw errorFactory('NOT_FOUND', 'Facility survey not found');
  }

  if (userLocationScope && isMasyarakat(userLocationScope)) {
    const createdBy = survey.createdBy || survey.get?.('createdBy');
    if (createdBy !== userLocationScope.id) {
      throw errorFactory.authorization('Access denied for this survey');
    }
  }

  return survey;
}

/**
 * Create facility survey
 */
async function createFacilitySurvey(surveyData, userId) {
  const transaction = await sequelize.transaction();

  try {
    const requestedStatus = String(surveyData?.status || '').toLowerCase();
    const initialStatus = requestedStatus === 'draft' ? 'draft' : 'submitted';
    const requestedSubmittedAt = surveyData?.submittedAt
      ? new Date(surveyData.submittedAt)
      : null;
    const submittedAt = initialStatus === 'submitted'
      ? (Number.isNaN(requestedSubmittedAt?.getTime?.()) ? new Date() : requestedSubmittedAt)
      : null;
    let { latitude, longitude, geom } = resolveFacilityCoordinates(surveyData);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const locationNames = await loadFacilityLocationNames(surveyData);
      const derivedCoords = await resolveFacilitySearchCoordinates(locationNames);
      if (derivedCoords) {
        latitude = derivedCoords.latitude;
        longitude = derivedCoords.longitude;
        geom = buildPointGeom(latitude, longitude);
      }
    }
    const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude);

    // Create facility survey
    const survey = await FacilitySurvey.create({
      surveyYear: surveyData.surveyYear,
      surveyPeriod: surveyData.surveyPeriod,
      villageId: surveyData.villageId,
      districtId: surveyData.districtId,
      regencyId: surveyData.regencyId,
      provinceId: surveyData.provinceId,
      latitude: hasValidCoords ? latitude : null,
      longitude: hasValidCoords ? longitude : null,
      geom: hasValidCoords ? geom : null,
      status: initialStatus,
      verificationStatus: 'Pending',
      submittedAt,
      createdBy: userId,
      updatedBy: userId,
    }, { transaction });

    // Create facility village info if provided
    if (surveyData.villageInfo) {
      await FacilityVillageInfo.create({
        facilitySurveyId: survey.id,
        ...surveyData.villageInfo,
      }, { transaction });
    }

    await syncFacilityItems(
      FacilityCommercial,
      survey.id,
      surveyData.commercial,
      transaction,
    );
    await syncFacilityItems(
      FacilityPublicServices,
      survey.id,
      surveyData.publicServices,
      transaction,
    );
    await syncFacilityItems(
      FacilityEducation,
      survey.id,
      surveyData.education,
      transaction,
    );
    await syncFacilityItems(
      FacilityHealth,
      survey.id,
      surveyData.health,
      transaction,
    );
    await syncFacilityItems(
      FacilityReligious,
      survey.id,
      surveyData.religious,
      transaction,
    );
    await syncFacilityItems(
      FacilityRecreation,
      survey.id,
      surveyData.recreation,
      transaction,
    );
    await syncFacilityItems(
      FacilityCemetery,
      survey.id,
      surveyData.cemetery,
      transaction,
    );
    await syncFacilityItems(
      FacilityGreenSpace,
      survey.id,
      surveyData.greenSpace,
      transaction,
    );
    await syncFacilityItems(
      FacilityParking,
      survey.id,
      surveyData.parking,
      transaction,
    );

    // Create utility electricity if provided
    if (surveyData.electricity) {
      await UtilityElectricity.create({
        facilitySurveyId: survey.id,
        ...surveyData.electricity,
      }, { transaction });
    }

    // Create utility water if provided
    if (surveyData.water) {
      await UtilityWater.create({
        facilitySurveyId: survey.id,
        ...surveyData.water,
      }, { transaction });
    }

    // Create utility telecom if provided
    if (surveyData.telecom) {
      await UtilityTelecom.create({
        facilitySurveyId: survey.id,
        ...surveyData.telecom,
      }, { transaction });
    }

    // Create utility gas if provided
    if (surveyData.gas) {
      await UtilityGas.create({
        facilitySurveyId: survey.id,
        ...surveyData.gas,
      }, { transaction });
    }

    // Create utility transportation if provided
    if (surveyData.transportation) {
      await UtilityTransportation.create({
        facilitySurveyId: survey.id,
        ...surveyData.transportation,
      }, { transaction });
    }

    // Create utility fire department if provided
    if (surveyData.fireDepartment) {
      await UtilityFireDepartment.create({
        facilitySurveyId: survey.id,
        ...surveyData.fireDepartment,
      }, { transaction });
    }

    // Create utility street lighting if provided
    if (surveyData.streetLighting) {
      await UtilityStreetLighting.create({
        facilitySurveyId: survey.id,
        ...surveyData.streetLighting,
      }, { transaction });
    }

    await transaction.commit();

    // Log audit
    const auditLog = await AuditLog.create({
      userId,
      action: 'CREATE',
      resourceType: 'facility_survey',
      resourceId: survey.id,
      details: { surveyYear: survey.surveyYear, surveyPeriod: survey.surveyPeriod },
    });

    if (survey.status !== 'draft') {
      try {
        const reviewers = await findReviewerUsersForScope({
          villageId: survey.villageId,
          districtId: survey.districtId,
          regencyId: survey.regencyId,
          provinceId: survey.provinceId,
        });
      await createNotificationsForUsers(
        reviewers.map((reviewer) => reviewer.id),
        {
          type: 'info',
          category: 'verification',
          title: 'Survei Infrastruktur Baru',
          message: `Survei infrastruktur baru periode ${survey.surveyPeriod || '-'} ${survey.surveyYear || ''} menunggu verifikasi.`,
          link: `/infrastructure-data?surveyId=${survey.id}`,
          auditLogId: auditLog?.id,
        },
      );
      } catch (notifyError) {
        console.warn('Failed to notify facility reviewers:', notifyError.message);
      }
    }

    return getFacilitySurveyById(survey.id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Update facility survey
 */
async function updateFacilitySurvey(surveyId, surveyData, user) {
  const transaction = await sequelize.transaction();

  try {
    const survey = await FacilitySurvey.findByPk(surveyId);
    if (!survey) {
      throw errorFactory('NOT_FOUND', 'Facility survey not found');
    }

    const updaterId = typeof user === 'object' ? user.id : user;
    const canReviewEdit = typeof user === 'object' && (isSuperAdmin(user) || isVerifikator(user));
    let { latitude, longitude, geom } = resolveFacilityCoordinates(surveyData);
    const hasCoordinateInput = latitude !== undefined || longitude !== undefined || geom !== undefined;
    const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
    let shouldUpdateCoords = hasCoordinateInput;
    if (!hasValidCoords) {
      const locationNames = await loadFacilityLocationNames({
        villageId: surveyData.villageId ?? survey.villageId,
        districtId: surveyData.districtId ?? survey.districtId,
        regencyId: surveyData.regencyId ?? survey.regencyId,
        provinceId: surveyData.provinceId ?? survey.provinceId,
      });
      const derivedCoords = await resolveFacilitySearchCoordinates(locationNames);
      if (derivedCoords) {
        latitude = derivedCoords.latitude;
        longitude = derivedCoords.longitude;
        geom = buildPointGeom(latitude, longitude);
        shouldUpdateCoords = true;
      }
    }

    // Check if survey can be updated (only draft status)
    if (survey.status !== 'draft' && !(canReviewEdit && ['submitted', 'verified'].includes(survey.status))) {
      throw errorFactory('BAD_REQUEST', 'Only draft surveys can be updated');
    }

    // Update facility survey
    const updatePayload = {
      surveyYear: surveyData.surveyYear ?? survey.surveyYear,
      surveyPeriod: surveyData.surveyPeriod ?? survey.surveyPeriod,
      villageId: surveyData.villageId ?? survey.villageId,
      districtId: surveyData.districtId ?? survey.districtId,
      regencyId: surveyData.regencyId ?? survey.regencyId,
      provinceId: surveyData.provinceId ?? survey.provinceId,
      updatedBy: updaterId,
    };

    if (shouldUpdateCoords) {
      updatePayload.latitude = Number.isFinite(latitude) ? latitude : null;
      updatePayload.longitude = Number.isFinite(longitude) ? longitude : null;
      updatePayload.geom = Number.isFinite(latitude) && Number.isFinite(longitude) ? geom : null;
    }

    await survey.update(updatePayload, { transaction });

    // Update or create facility village info
    if (surveyData.villageInfo) {
      const villageInfo = await FacilityVillageInfo.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (villageInfo) {
        await villageInfo.update(surveyData.villageInfo, { transaction });
      } else {
        await FacilityVillageInfo.create({
          facilitySurveyId: survey.id,
          ...surveyData.villageInfo,
        }, { transaction });
      }
    }

    await syncFacilityItems(
      FacilityCommercial,
      survey.id,
      surveyData.commercial,
      transaction,
    );
    await syncFacilityItems(
      FacilityPublicServices,
      survey.id,
      surveyData.publicServices,
      transaction,
    );
    await syncFacilityItems(
      FacilityEducation,
      survey.id,
      surveyData.education,
      transaction,
    );
    await syncFacilityItems(
      FacilityHealth,
      survey.id,
      surveyData.health,
      transaction,
    );
    await syncFacilityItems(
      FacilityReligious,
      survey.id,
      surveyData.religious,
      transaction,
    );
    await syncFacilityItems(
      FacilityRecreation,
      survey.id,
      surveyData.recreation,
      transaction,
    );
    await syncFacilityItems(
      FacilityCemetery,
      survey.id,
      surveyData.cemetery,
      transaction,
    );
    await syncFacilityItems(
      FacilityGreenSpace,
      survey.id,
      surveyData.greenSpace,
      transaction,
    );
    await syncFacilityItems(
      FacilityParking,
      survey.id,
      surveyData.parking,
      transaction,
    );

    // Update or create utility electricity
    if (surveyData.electricity) {
      const electricity = await UtilityElectricity.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (electricity) {
        await electricity.update(surveyData.electricity, { transaction });
      } else {
        await UtilityElectricity.create({
          facilitySurveyId: survey.id,
          ...surveyData.electricity,
        }, { transaction });
      }
    }

    // Update or create utility water
    if (surveyData.water) {
      const water = await UtilityWater.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (water) {
        await water.update(surveyData.water, { transaction });
      } else {
        await UtilityWater.create({
          facilitySurveyId: survey.id,
          ...surveyData.water,
        }, { transaction });
      }
    }

    // Update or create utility telecom
    if (surveyData.telecom) {
      const telecom = await UtilityTelecom.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (telecom) {
        await telecom.update(surveyData.telecom, { transaction });
      } else {
        await UtilityTelecom.create({
          facilitySurveyId: survey.id,
          ...surveyData.telecom,
        }, { transaction });
      }
    }

    // Update or create utility gas
    if (surveyData.gas) {
      const gas = await UtilityGas.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (gas) {
        await gas.update(surveyData.gas, { transaction });
      } else {
        await UtilityGas.create({
          facilitySurveyId: survey.id,
          ...surveyData.gas,
        }, { transaction });
      }
    }

    // Update or create utility transportation
    if (surveyData.transportation) {
      const transportation = await UtilityTransportation.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (transportation) {
        await transportation.update(surveyData.transportation, { transaction });
      } else {
        await UtilityTransportation.create({
          facilitySurveyId: survey.id,
          ...surveyData.transportation,
        }, { transaction });
      }
    }

    // Update or create utility fire department
    if (surveyData.fireDepartment) {
      const fireDepartment = await UtilityFireDepartment.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (fireDepartment) {
        await fireDepartment.update(surveyData.fireDepartment, { transaction });
      } else {
        await UtilityFireDepartment.create({
          facilitySurveyId: survey.id,
          ...surveyData.fireDepartment,
        }, { transaction });
      }
    }

    // Update or create utility street lighting
    if (surveyData.streetLighting) {
      const streetLighting = await UtilityStreetLighting.findOne({
        where: { facilitySurveyId: survey.id },
      });
      if (streetLighting) {
        await streetLighting.update(surveyData.streetLighting, { transaction });
      } else {
        await UtilityStreetLighting.create({
          facilitySurveyId: survey.id,
          ...surveyData.streetLighting,
        }, { transaction });
      }
    }

    await transaction.commit();

    // Log audit
    await AuditLog.create({
      userId: updaterId,
      action: 'UPDATE',
      resourceType: 'facility_survey',
      resourceId: survey.id,
      details: { surveyYear: survey.surveyYear, surveyPeriod: survey.surveyPeriod },
    });

    return getFacilitySurveyById(survey.id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Submit facility survey (change status to submitted)
 */
async function submitFacilitySurvey(surveyId, userId) {
  const survey = await FacilitySurvey.findByPk(surveyId);
  if (!survey) {
    throw errorFactory('NOT_FOUND', 'Facility survey not found');
  }

  if (survey.status !== 'draft') {
    throw errorFactory('BAD_REQUEST', 'Only draft surveys can be submitted');
  }

  await survey.update({
    status: 'submitted',
    submittedAt: new Date(),
    updatedBy: userId,
  });

  // Log audit
  const auditLog = await AuditLog.create({
    userId,
    action: 'SUBMIT',
    resourceType: 'facility_survey',
    resourceId: survey.id,
    details: { surveyYear: survey.surveyYear, surveyPeriod: survey.surveyPeriod },
  });

  try {
    const reviewers = await findReviewerUsersForScope({
      villageId: survey.villageId,
      districtId: survey.districtId,
      regencyId: survey.regencyId,
      provinceId: survey.provinceId,
    });
    await createNotificationsForUsers(
      reviewers.map((reviewer) => reviewer.id),
      {
        type: 'info',
        category: 'verification',
        title: 'Survei Infrastruktur Baru',
        message: `Survei infrastruktur baru periode ${survey.surveyPeriod || '-'} ${survey.surveyYear || ''} menunggu verifikasi.`,
        link: `/infrastructure-data?surveyId=${survey.id}`,
        auditLogId: auditLog?.id,
      },
    );
  } catch (notifyError) {
    console.warn('Failed to notify facility reviewers:', notifyError.message);
  }

  return getFacilitySurveyById(survey.id);
}

/**
 * Verify facility survey (review workflow)
 */
async function verifyFacilitySurvey(surveyId, verifierId, reviewData = {}, reviewerContext = null) {
  const survey = await FacilitySurvey.findByPk(surveyId);
  if (!survey) {
    throw errorFactory('NOT_FOUND', 'Facility survey not found');
  }

  if (survey.status === 'approved' || survey.verificationStatus === 'Rejected') {
    throw errorFactory.conflict('Facility survey has already been finalized');
  }

  const normalizedStatus = String(reviewData.status || '').toLowerCase();
  const reviewNotes = reviewData.reviewNotes ? String(reviewData.reviewNotes).trim() : null;
  const isImplicitSubmitted = survey.status === 'draft' && survey.verificationStatus === 'Pending';
  const effectiveStatus = isImplicitSubmitted ? 'submitted' : survey.status;

  if (!normalizedStatus) {
    throw errorFactory.validation('Status review wajib diisi');
  }

  if (normalizedStatus === 'rejected' && !reviewNotes) {
    throw errorFactory.validation('Alasan penolakan wajib diisi.', 'reviewNotes');
  }

  const normalizedVerifierId = verifierId ? String(verifierId) : null;
  const assignedVerifierId = survey.verifiedBy ? String(survey.verifiedBy) : null;
  const isLockedByOther = survey.status === 'verified'
    && assignedVerifierId
    && assignedVerifierId !== normalizedVerifierId
    && survey.verificationStatus === 'Pending';

  if (isLockedByOther && !isSuperAdmin(reviewerContext)) {
    throw errorFactory.conflict('Facility survey sedang ditinjau oleh verifikator lain');
  }

  let nextStatus = survey.status;
  let verificationStatus = survey.verificationStatus || 'Pending';

  if (['under_review', 'verified', 'reviewed'].includes(normalizedStatus)) {
    if (!['submitted', 'verified'].includes(effectiveStatus)) {
      throw errorFactory.conflict('Facility survey tidak bisa masuk tahap review');
    }
    nextStatus = 'verified';
    verificationStatus = 'Pending';
  } else if (normalizedStatus === 'approved') {
    if (!['submitted', 'verified'].includes(effectiveStatus)) {
      throw errorFactory.conflict('Facility survey tidak bisa disetujui pada status saat ini');
    }
    nextStatus = 'approved';
    verificationStatus = 'Verified';
  } else if (normalizedStatus === 'rejected') {
    if (!['submitted', 'verified'].includes(effectiveStatus)) {
      throw errorFactory.conflict('Facility survey tidak bisa ditolak pada status saat ini');
    }
    nextStatus = 'verified';
    verificationStatus = 'Rejected';
  } else {
    throw errorFactory.validation('Invalid status for review');
  }

  const oldValues = {
    status: survey.status,
    verificationStatus: survey.verificationStatus,
    reviewNotes: survey.reviewNotes,
    verifiedAt: survey.verifiedAt,
    verifiedBy: survey.verifiedBy,
  };

  const reviewedAt = new Date();
  await survey.update({
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
    resourceType: 'facility_survey',
    resourceId: survey.id,
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
    await createNotification(survey.createdBy, {
      type: normalizedStatus === 'approved' ? 'success' : normalizedStatus === 'rejected' ? 'warning' : 'info',
      category: 'status',
      title: 'Pembaruan Status Infrastruktur',
      message: `Survei infrastruktur Anda ${statusLabel}. ${reviewNotes ? `Catatan: ${reviewNotes}` : ''}`.trim(),
      link: `/infrastructure-data?surveyId=${survey.id}`,
      auditLogId: auditLog?.id,
    });
  } catch (notifyError) {
    console.warn('Failed to notify facility submitter:', notifyError.message);
  }

  return getFacilitySurveyById(survey.id);
}

const reviewFacilitySurvey = async (surveyId, reviewData, reviewerId, reviewerContext = null) =>
  verifyFacilitySurvey(surveyId, reviewerId, reviewData, reviewerContext);

/**
 * Get facility survey statistics
 */
const getFacilityStatistics = async (userLocationScope, options = {}) => {
  const {
    villageId, districtId, regencyId, provinceId, surveyYear, surveyPeriod,
  } = options;

  const baseWhereClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    villageId, districtId, regencyId, provinceId, surveyYear, surveyPeriod,
  });
  const whereClause = isMasyarakat(userLocationScope)
    ? { ...baseWhereClause, createdBy: userLocationScope.id }
    : baseWhereClause;

  const stats = await FacilitySurvey.findAll({
    where: whereClause,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('FacilitySurvey.id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  });

  const totalSurveys = await FacilitySurvey.count({ where: whereClause });

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
    sequelize.col('FacilitySurvey.submitted_at'),
    sequelize.col('FacilitySurvey.created_at'),
  );

  const monthlyRows = await FacilitySurvey.findAll({
    where: {
      ...whereClause,
      [Op.and]: [
        sequelize.where(dateExpression, {
          [Op.gte]: startDate,
          [Op.lt]: endDate,
        }),
      ],
    },
    attributes: [
      [getMonthExpression(dateExpression), 'month'],
      [sequelize.fn('COUNT', sequelize.col('FacilitySurvey.id')), 'count'],
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
      + (statusBreakdown.under_review || 0)
      + (statusBreakdown.reviewed || 0),
    rejected: statusBreakdown.rejected || 0,
  };

  let villageInfo = null;
  if (isAdminDesa(userLocationScope) && baseWhereClause.villageId) {
    const locationOnlyClause = ['provinceId', 'regencyId', 'districtId', 'villageId']
      .reduce((acc, key) => {
        if (baseWhereClause[key]) {
          acc[key] = baseWhereClause[key];
        }
        return acc;
      }, {});

    const baseVillageWhere = {
      ...locationOnlyClause,
      status: ['approved', 'verified'],
    };
    let latestSurvey = await FacilitySurvey.findOne({
      where: baseVillageWhere,
      include: [
        {
          model: FacilityVillageInfo,
          as: 'villageInfo',
          attributes: ['populationCount', 'householdCount'],
        },
      ],
      order: [
        [sequelize.literal('verified_at'), 'DESC'],
        [sequelize.literal('submitted_at'), 'DESC'],
        [sequelize.literal('created_at'), 'DESC'],
      ],
    });

    if (!latestSurvey) {
      latestSurvey = await FacilitySurvey.findOne({
        where: {
          ...locationOnlyClause,
          status: 'submitted',
        },
        include: [
          {
            model: FacilityVillageInfo,
            as: 'villageInfo',
            attributes: ['populationCount', 'householdCount'],
          },
        ],
        order: [
          [sequelize.literal('submitted_at'), 'DESC'],
          [sequelize.literal('created_at'), 'DESC'],
        ],
      });
    }

    villageInfo = latestSurvey?.villageInfo || null;
  }

  return {
    total: totalSurveys,
    totalSurveys,
    statusBreakdown,
    statusSummary,
    villageInfo,
    monthlySubmissions: {
      labels: monthKeys,
      counts: monthlyCounts,
    },
  };
};

module.exports = {
  getFacilitySurveys,
  getFacilitySurveyById,
  createFacilitySurvey,
  updateFacilitySurvey,
  submitFacilitySurvey,
  verifyFacilitySurvey,
  reviewFacilitySurvey,
  getFacilityStatistics,
  exportFacilitySurveys,
  countExportFacilitySurveys,
};
