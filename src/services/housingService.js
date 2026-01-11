const { Op, QueryTypes } = require('sequelize');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const turf = require('@turf/turf');
const {
  FormRespondent,
  HouseholdOwner,
  HouseData,
  WaterAccess,
  SanitationAccess,
  WasteManagement,
  RoadAccess,
  EnergyAccess,
  FormSubmission,
  Province,
  Regency,
  District,
  Village,
  AuditLog,
  User,
  HousingPhoto,
  sequelize,
} = require('../models');
const {
  queryUtils, paginationUtils,
} = require('../utils/lodashUtils');
const { errorFactory } = require('../errors/errorUtils');
const { saveFile, getPublicUrl } = require('../utils/fileUpload');
const { getYearExpression, getMonthExpression } = require('../utils/sqlDateUtils');
const {
  createNotification,
  createNotificationsForUsers,
  findReviewerUsersForScope,
} = require('./notificationService');
const { findLocationByCoordinates } = require('./locationService');
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
  shouldBypassLocationScope,
  isAdminKabupaten,
} = require('../utils/accessControl');

let formSubmissionSchemaChecked = false;
let formSubmissionSchemaError = null;
const GEOJSON_BASE_DIR = path.join(__dirname, '../../data_peta_profesional');
const GIS_LAYER_CACHE = new Map();

const pickDefined = (payload) => Object.fromEntries(
  Object.entries(payload || {}).filter(([, value]) => value !== undefined),
);

const normalizeBoolean = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'ya', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'tidak', 'no'].includes(normalized)) return false;
  }
  return fallback;
};

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

const attachPhotoUrls = (photos) => {
  if (!Array.isArray(photos)) return;
  photos.forEach((photo) => {
    const relativePath = photo?.file_path || photo?.filePath || photo?.relativePath || '';
    if (!relativePath || photo?.fileUrl) return;
    photo.fileUrl = getPublicUrl(relativePath);
  });
};

const appendNonHistoryFilter = (whereClause, alias = 'FormSubmission') => {
  if (sequelize.getDialect() === 'postgres') {
    const historyValue = sequelize.escape('history');
    whereClause[Op.and] = [
      ...(whereClause[Op.and] || []),
      sequelize.literal(`"${alias}"."status"::text != ${historyValue}`),
    ];
    return;
  }

  whereClause.status = { [Op.ne]: 'history' };
};

const resolveGisLayerPath = (layerName) => {
  if (!layerName) return null;
  const normalized = String(layerName).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) return null;
  const match = normalized.match(/^([a-z0-9_-]+)[/:]([a-z0-9_-]+)$/i);
  const toPayload = (category, filename) => ({
    key: `${category}/${filename}`,
    filePath: path.join(GEOJSON_BASE_DIR, category, `${filename}.geojson`),
    label: filename.replace(/_/g, ' '),
  });

  if (match) {
    const category = match[1];
    const filename = match[2].replace(/\.geojson$/i, '');
    return toPayload(category, filename);
  }

  const filenameOnly = normalized.replace(/\.geojson$/i, '');
  const categories = ['administrasi', 'tata_ruang', 'bencana', 'infrastruktur'];
  for (const category of categories) {
    const filePath = path.join(GEOJSON_BASE_DIR, category, `${filenameOnly}.geojson`);
    if (fsSync.existsSync(filePath)) {
      return toPayload(category, filenameOnly);
    }
  }

  return null;
};

const loadGisLayer = async (layerName) => {
  const resolved = resolveGisLayerPath(layerName);
  if (!resolved) {
    throw errorFactory.validation('Layer GIS tidak valid.');
  }

  if (GIS_LAYER_CACHE.has(resolved.key)) {
    return GIS_LAYER_CACHE.get(resolved.key);
  }

  try {
    const raw = await fs.readFile(resolved.filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.features)) {
      throw errorFactory.validation('Format GeoJSON tidak valid.');
    }
    const payload = {
      geojson: parsed,
      label: resolved.label,
      key: resolved.key,
    };
    GIS_LAYER_CACHE.set(resolved.key, payload);
    return payload;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw errorFactory.notFound('Layer GIS');
    }
    throw error;
  }
};

const resolveGisFeatureLabel = (feature, fallback) => {
  const props = feature?.properties || {};
  const candidates = [
    props.NAMOBJ,
    props.namobj,
    props.NAME,
    props.name,
    props.NAMA,
    props.nama,
    props.DESA,
    props.desa,
    props.KELURAHAN,
    props.kelurahan,
    props.KECAMATAN,
    props.kecamatan,
    props.KAB_KOTA,
    props.kab_kota,
    props.KABUPATEN,
    props.kabupaten,
    props.WILAYAH,
    props.wilayah,
    props.KAWASAN,
    props.kawasan,
  ];
  return candidates.find((value) => value) || fallback || '';
};

async function ensureFormSubmissionSchema() {
  if (formSubmissionSchemaChecked) {
    if (formSubmissionSchemaError) {
      throw formSubmissionSchemaError;
    }
    return;
  }

  try {
    const table = await sequelize.getQueryInterface().describeTable('form_submissions');
    const requiredColumns = [
      'status',
      'verification_status',
      'is_livable',
      'created_by',
      'updated_by',
      'created_at',
      'updated_at',
    ];
    const missingColumns = requiredColumns.filter((column) => !table[column]);

    if (missingColumns.length) {
      formSubmissionSchemaError = errorFactory.database(
        `Skema database tidak sesuai untuk form_submissions. Kolom hilang: ${missingColumns.join(', ')}. Jalankan migrasi terlebih dahulu.`,
      );
      formSubmissionSchemaChecked = true;
      throw formSubmissionSchemaError;
    }

    formSubmissionSchemaChecked = true;
  } catch (error) {
    if (!formSubmissionSchemaError) {
      formSubmissionSchemaError = errorFactory.database(
        'Gagal memeriksa skema database form_submissions. Pastikan koneksi database dan migrasi sudah benar.',
        error,
      );
    }
    formSubmissionSchemaChecked = true;
    throw formSubmissionSchemaError;
  }
}


/**
 * Get form submissions with filtering and pagination
 */
async function getFormSubmissions(userLocationScope, options = {}) {
  const {
    page = 1, limit = 20, status, isLivable, villageId, districtId, regencyId, provinceId, surveyYear,
  } = options;

  const normalizedLimit = Number.parseInt(limit, 10);
  const usePagination = Number.isFinite(normalizedLimit) && normalizedLimit > 0;
  const paginationOptions = usePagination
    ? queryUtils.buildPaginationOptions(page, normalizedLimit)
    : {};

  // Build where clause based on user's location access
  const whereClause = {};
  const isMasyarakatUser = isMasyarakat(userLocationScope);
  // Add status filter if provided
  if (status) {
    const normalizedStatus = String(status).toLowerCase();
    if (normalizedStatus === 'under_review') {
      whereClause.status = { [Op.in]: ['under_review', 'reviewed'] };
    } else {
      whereClause.status = normalizedStatus;
    }
  }

  // Add isLivable filter if provided
  if (isLivable !== undefined && isLivable !== null) {
    whereClause.isLivable = isLivable === 'true' || isLivable === true;
  }

  if (isMasyarakatUser) {
    whereClause.createdBy = userLocationScope.id;
  }

    if (!isMasyarakatUser) {
      const locationClause = queryUtils.buildLocationWhereClause(userLocationScope, {
        villageId, districtId, regencyId, provinceId,
      });
      Object.assign(whereClause, locationClause);
    }

    if (!whereClause.status) {
      appendNonHistoryFilter(whereClause);
    }

    if (surveyYear) {
      const parsedYear = Number.parseInt(surveyYear, 10);
      if (Number.isFinite(parsedYear)) {
        const dateExpression = sequelize.fn(
          'COALESCE',
          sequelize.col('FormSubmission.submitted_at'),
          sequelize.col('FormSubmission.created_at'),
        );
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
        sequelize.where(getYearExpression(dateExpression), parsedYear),
        ];
      }
    }

  const submissions = await FormSubmission.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: FormRespondent,
        as: 'formRespondent',
        attributes: ['id', 'name', 'email', 'position', 'positionOther', 'phone'],
        required: false,
        include: [], // Prevent automatic reverse association loading
      },
      {
        model: HouseholdOwner,
        as: 'householdOwner',
        attributes: [
          'id',
          'ownerName',
          'headOfFamilyName',
          'familyCardNumber',
          'houseNumber',
          'rt',
          'rw',
          'latitude',
          'longitude',
        ],
        where: undefined,
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
        required: false,
      },
      {
        model: HouseData,
        as: 'houseData',
        attributes: ['id', 'houseType', 'floorMaterial', 'wallMaterial', 'roofMaterial'],
        required: false,
      },
      {
        model: User,
        as: 'reviewer',
        attributes: ['id', 'fullName', 'email'],
        required: false,
      },
    ],
    distinct: true,
    col: 'id',
    subQuery: false,
    order: [['submittedAt', 'DESC']],
    ...paginationOptions,
  });

  const totalCount = submissions.count;

  // Calculate pagination metadata
  const effectiveLimit = usePagination ? normalizedLimit : Math.max(totalCount, 1);
  const pagination = paginationUtils.calculatePagination(
    usePagination ? page : 1,
    effectiveLimit,
    totalCount,
  );

  return {
    submissions,
    pagination,
  };
}

/**
 * Get form submission by ID
 * Note: Location access check is handled by requireResourceAccess middleware
 */
async function getFormSubmissionById(submissionId, userLocationScope = null) {
  const isMasyarakatUser = userLocationScope && isMasyarakat(userLocationScope);
  const submission = await (isMasyarakatUser
    ? FormSubmission.findOne({
      where: { id: submissionId, createdBy: userLocationScope.id },
      include: [
        {
          model: FormRespondent,
          as: 'formRespondent',
          attributes: ['id', 'name', 'email', 'position', 'positionOther', 'phone'],
          required: false,
          include: [], // Prevent automatic reverse association loading
        },
        {
          model: HouseholdOwner,
          as: 'householdOwner',
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
        },
        {
          model: HouseData,
          as: 'houseData',
          include: [
            {
              model: HousingPhoto,
              as: 'photos',
              attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
              required: false,
              separate: true,
              order: [['display_order', 'ASC'], ['created_at', 'ASC']],
            },
          ],
          required: false,
        },
        {
          model: WaterAccess,
          as: 'waterAccess',
          include: [
            {
              model: HousingPhoto,
              as: 'photos',
              attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
              required: false,
              separate: true,
              order: [['display_order', 'ASC'], ['created_at', 'ASC']],
            },
          ],
          required: false,
        },
        {
          model: SanitationAccess,
          as: 'sanitationAccess',
          include: [
            {
              model: HousingPhoto,
              as: 'photos',
              attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
              required: false,
              separate: true,
              order: [['display_order', 'ASC'], ['created_at', 'ASC']],
            },
          ],
          required: false,
        },
        {
          model: WasteManagement,
          as: 'wasteManagement',
          include: [
            {
              model: HousingPhoto,
              as: 'photos',
              attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
              required: false,
              separate: true,
              order: [['display_order', 'ASC'], ['created_at', 'ASC']],
            },
          ],
          required: false,
        },
        {
          model: RoadAccess,
          as: 'roadAccess',
          include: [
            {
              model: HousingPhoto,
              as: 'photos',
              attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
              required: false,
              separate: true,
              order: [['display_order', 'ASC'], ['created_at', 'ASC']],
            },
          ],
          required: false,
        },
        {
          model: EnergyAccess,
          as: 'energyAccess',
          include: [
            {
              model: HousingPhoto,
              as: 'photos',
              attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
              required: false,
              separate: true,
              order: [['display_order', 'ASC'], ['created_at', 'ASC']],
            },
          ],
          required: false,
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
    })
    : FormSubmission.findByPk(submissionId, {
    include: [
      {
        model: FormRespondent,
        as: 'formRespondent',
        attributes: ['id', 'name', 'email', 'position', 'positionOther', 'phone'],
        required: false,
        include: [], // Prevent automatic reverse association loading
      },
      {
        model: HouseholdOwner,
        as: 'householdOwner',
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
      },
      {
        model: HouseData,
        as: 'houseData',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: WaterAccess,
        as: 'waterAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: SanitationAccess,
        as: 'sanitationAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: WasteManagement,
        as: 'wasteManagement',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: RoadAccess,
        as: 'roadAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: EnergyAccess,
        as: 'energyAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: User,
        as: 'reviewer',
        attributes: ['id', 'fullName', 'email'],
        required: false,
      },
    ],
  }));

  if (!submission) {
    throw errorFactory.notFound('Form submission not found');
  }

  if (userLocationScope && isMasyarakat(userLocationScope)) {
    const createdBy = submission.createdBy || submission.get?.('createdBy');
    if (createdBy !== userLocationScope.id) {
      throw errorFactory.authorization('Access denied for this submission');
    }
  }

  const submissionData = submission.toJSON ? submission.toJSON() : submission;
  const photoGroups = [
    submissionData.houseData,
    submissionData.waterAccess,
    submissionData.sanitationAccess,
    submissionData.wasteManagement,
    submissionData.roadAccess,
    submissionData.energyAccess,
  ];
  photoGroups.forEach((group) => attachPhotoUrls(group?.photos));

  return submissionData;
}

/**
 * Get submission history for a household owner
 */
async function getSubmissionHistoryByOwner(ownerId, userLocationScope = null) {
  if (!ownerId) {
    throw errorFactory.validation('Household owner ID harus diisi.', 'householdOwnerId');
  }

  const whereClause = {
    householdOwnerId: ownerId,
  };

  if (userLocationScope) {
    if (!shouldBypassLocationScope(userLocationScope)) {
      Object.assign(whereClause, queryUtils.buildLocationWhereClause(userLocationScope));
    }
    if (isMasyarakat(userLocationScope)) {
      whereClause.createdBy = userLocationScope.id;
    }
  }

  const submissions = await FormSubmission.findAll({
    where: whereClause,
    attributes: [
      'id',
      'status',
      'verificationStatus',
      'reviewNotes',
      'reviewedAt',
      'reviewedBy',
      'submittedAt',
      [sequelize.col('FormSubmission.created_at'), 'createdAt'],
      'isLivable',
      'createdBy',
      'householdOwnerId',
    ],
    include: [
      {
        model: HouseData,
        as: 'houseData',
        attributes: [
          'id',
          'houseType',
          'buildingArea',
          'landArea',
          'floorMaterial',
          'wallMaterial',
          'roofMaterial',
          'totalOccupants',
        ],
        required: false,
      },
      {
        model: User,
        as: 'reviewer',
        attributes: ['id', 'fullName'],
        required: false,
      },
    ],
    order: [[sequelize.col('FormSubmission.submitted_at'), 'DESC'], [sequelize.col('FormSubmission.created_at'), 'DESC']],
  });

  return submissions;
}

/**
 * Update form submission data (verifier corrections)
 */
async function updateFormSubmissionInternal(submissionId, updateData, updaterId, options = {}) {
  const {
    allowedStatuses = ['submitted', 'under_review', 'reviewed'],
    allowReviewNotes = true,
    markReviewedOnUpdate = true,
    submitOnUpdate = false,
    lockMessage = 'Form submission can only be edited while it is draft or rejected.',
  } = options;

  const submission = await FormSubmission.findByPk(submissionId);
  if (!submission) {
    throw errorFactory.notFound('Form submission not found');
  }

  if (!allowedStatuses.includes(submission.status)) {
    throw errorFactory.conflict(lockMessage);
  }

  const transaction = await sequelize.transaction();

  try {
    const householdOwnerData = updateData?.householdOwner || {};
    const ownerLatitude = normalizeCoordinateValue(householdOwnerData.latitude);
    const ownerLongitude = normalizeCoordinateValue(householdOwnerData.longitude);
    const ownerGeom = buildPointGeom(ownerLatitude, ownerLongitude);
    const coordsProvided = Number.isFinite(ownerLatitude) && Number.isFinite(ownerLongitude);

    let resolvedLocation = null;
    if (coordsProvided) {
      resolvedLocation = await findLocationByCoordinates(
        ownerLatitude,
        ownerLongitude,
      );

      const mismatch = (expected, actual) => expected && actual && expected !== actual;
      if (
        mismatch(householdOwnerData.villageId, resolvedLocation.village?.id)
        || mismatch(householdOwnerData.districtId, resolvedLocation.district?.id)
        || mismatch(householdOwnerData.regencyId, resolvedLocation.regency?.id)
        || mismatch(householdOwnerData.provinceId, resolvedLocation.province?.id)
      ) {
        throw errorFactory.validation(
          'Koordinat tidak sesuai dengan wilayah yang dipilih.',
          'coordinates',
        );
      }
    }

    const updateOrCreate = async (Model, recordId, data) => {
      const cleaned = pickDefined(data);
      if (!Object.keys(cleaned).length) return null;

      if (recordId) {
        await Model.update(cleaned, {
          where: { id: recordId },
          transaction,
        });
        return recordId;
      }

      const created = await Model.create({
        ...cleaned,
        formSubmissionId: submission.id,
      }, { transaction });
      return created.id;
    };

    const respondentUpdates = updateData?.formRespondent
      ? pickDefined({
        name: updateData.formRespondent.name,
        email: updateData.formRespondent.email,
        phone: updateData.formRespondent.phone,
        position: updateData.formRespondent.position,
        positionOther: updateData.formRespondent.positionOther,
      })
      : null;

    const respondentId = await updateOrCreate(
      FormRespondent,
      submission.formRespondentId,
      respondentUpdates,
    );

    const hasReceivedHousingAssistance = normalizeBoolean(
      householdOwnerData.hasReceivedHousingAssistance
        ?? householdOwnerData.hasHousingAssistance,
    );
    const isRegisteredAsPoor = normalizeBoolean(householdOwnerData.isRegisteredAsPoor);
    const headOfFamilyAge = householdOwnerData.headOfFamilyAge ?? householdOwnerData.age;
    const ownerUpdates = updateData?.householdOwner
      ? pickDefined({
        ownerName: householdOwnerData.ownerName,
        ownerPhone: householdOwnerData.ownerPhone,
        headOfFamilyName: householdOwnerData.headOfFamilyName,
        headOfFamilyPhone: householdOwnerData.headOfFamilyPhone,
        headOfFamilyAge,
        familyCardNumber: householdOwnerData.familyCardNumber,
        totalFamilyMembers: householdOwnerData.totalFamilyMembers
          ?? householdOwnerData.numHouseholdsInHouse,
        houseNumber: householdOwnerData.houseNumber,
        rt: householdOwnerData.rt,
        rw: householdOwnerData.rw,
        villageId: resolvedLocation?.village?.id || householdOwnerData.villageId,
        districtId: resolvedLocation?.district?.id || householdOwnerData.districtId,
        regencyId: resolvedLocation?.regency?.id || householdOwnerData.regencyId,
        provinceId: resolvedLocation?.province?.id || householdOwnerData.provinceId,
        educationLevel: householdOwnerData.educationLevel,
        educationLevelOther: householdOwnerData.educationLevelOther,
        occupation: householdOwnerData.occupation,
        monthlyIncome: householdOwnerData.monthlyIncome,
        landOwnershipStatus: householdOwnerData.landOwnershipStatus,
        houseOwnershipStatus: householdOwnerData.houseOwnershipStatus,
        hasReceivedHousingAssistance,
        housingAssistanceYear: householdOwnerData.housingAssistanceYear,
        isRegisteredAsPoor,
        poorRegistrationAttachment: householdOwnerData.poorRegistrationAttachment,
        latitude: ownerLatitude,
        longitude: ownerLongitude,
        geom: ownerGeom,
      })
      : null;

    const householdOwnerId = await updateOrCreate(
      HouseholdOwner,
      submission.householdOwnerId,
      ownerUpdates,
    );

    const houseDataId = await updateOrCreate(
      HouseData,
      submission.houseDataId,
      updateData?.houseData,
    );

    const waterAccessId = await updateOrCreate(
      WaterAccess,
      submission.waterAccessId,
      updateData?.waterAccess,
    );

    const sanitationAccessId = await updateOrCreate(
      SanitationAccess,
      submission.sanitationAccessId,
      updateData?.sanitationAccess,
    );

    const wasteManagementId = await updateOrCreate(
      WasteManagement,
      submission.wasteManagementId,
      updateData?.wasteManagement,
    );

    const roadAccessId = await updateOrCreate(
      RoadAccess,
      submission.roadAccessId,
      updateData?.roadAccess,
    );

    const energyAccessId = await updateOrCreate(
      EnergyAccess,
      submission.energyAccessId,
      updateData?.energyAccess,
    );

    const submissionUpdates = {
      updatedBy: updaterId,
    };

    const locationUpdates = updateData?.householdOwner
      ? pickDefined({
        villageId: resolvedLocation?.village?.id ?? householdOwnerData.villageId,
        districtId: resolvedLocation?.district?.id ?? householdOwnerData.districtId,
        regencyId: resolvedLocation?.regency?.id ?? householdOwnerData.regencyId,
        provinceId: resolvedLocation?.province?.id ?? householdOwnerData.provinceId,
      })
      : null;

    if (respondentId) submissionUpdates.formRespondentId = respondentId;
    if (householdOwnerId) submissionUpdates.householdOwnerId = householdOwnerId;
    if (houseDataId) submissionUpdates.houseDataId = houseDataId;
    if (waterAccessId) submissionUpdates.waterAccessId = waterAccessId;
    if (sanitationAccessId) submissionUpdates.sanitationAccessId = sanitationAccessId;
    if (wasteManagementId) submissionUpdates.wasteManagementId = wasteManagementId;
    if (roadAccessId) submissionUpdates.roadAccessId = roadAccessId;
    if (energyAccessId) submissionUpdates.energyAccessId = energyAccessId;
    if (locationUpdates && Object.keys(locationUpdates).length > 0) {
      Object.assign(submissionUpdates, locationUpdates);
    }

    if (allowReviewNotes && updateData?.reviewNotes !== undefined) {
      submissionUpdates.reviewNotes = updateData.reviewNotes;
    }

    if (markReviewedOnUpdate && submission.status === 'submitted') {
      submissionUpdates.status = 'under_review';
      submissionUpdates.reviewedAt = new Date();
      submissionUpdates.reviewedBy = updaterId;
    }

    if (submitOnUpdate) {
      submissionUpdates.status = 'submitted';
      submissionUpdates.verificationStatus = 'Pending';
      submissionUpdates.submittedAt = new Date();
      submissionUpdates.reviewNotes = null;
      submissionUpdates.reviewedAt = null;
      submissionUpdates.reviewedBy = null;
    }

    await submission.update(submissionUpdates, { transaction });

    await AuditLog.create({
      userId: updaterId,
      action: submitOnUpdate ? 'form_resubmitted' : 'form_updated',
      resourceType: 'form_submission',
      resourceId: submission.id,
      metadata: {
        status: submissionUpdates.status || submission.status,
        reviewNotes: submissionUpdates.reviewNotes,
      },
    }, { transaction });

    await transaction.commit();

    return getFormSubmissionById(submissionId);
  } catch (error) {
    console.error('Failed to update form submission:', error);
    await transaction.rollback();
    throw errorFactory.database('Failed to update form submission', error);
  }
}

async function updateFormSubmission(submissionId, updateData, updaterId) {
  return updateFormSubmissionInternal(submissionId, updateData, updaterId, {
    allowedStatuses: ['submitted', 'under_review', 'reviewed'],
    allowReviewNotes: true,
    markReviewedOnUpdate: true,
    submitOnUpdate: false,
    lockMessage: 'Form submission can only be edited after submission',
  });
}

async function updateOwnSubmission(submissionId, updateData, updaterId) {
  const submission = await FormSubmission.findOne({
    where: { id: submissionId, createdBy: updaterId },
  });

  if (!submission) {
    throw errorFactory.notFound('Form submission not found');
  }

  if (!['draft', 'rejected'].includes(submission.status)) {
    throw errorFactory.conflict('Form submission can only be edited while it is draft or rejected.');
  }

  return updateFormSubmissionInternal(submissionId, updateData, updaterId, {
    allowedStatuses: ['draft', 'rejected'],
    allowReviewNotes: false,
    markReviewedOnUpdate: false,
    submitOnUpdate: true,
  });
}

/**
 * Check if house is livable based on rules
 * @param {Object} formData - Form data containing householdOwnerData, houseData, waterAccess, sanitationAccess
 * @returns {boolean} - true if livable, false otherwise
 */
function isLivableCheck(formData) {
  if (!formData) {
    return false;
  }

  const {
    householdOwnerData,
    houseData,
    waterAccess,
    sanitationAccess,
  } = formData;

  // 1. Check Luas Bangunan (minimal 7.2 m² per orang)
  // Rumus: luas bangunan / jumlah penghuni >= 7.2
  const totalMembers = householdOwnerData?.totalFamilyMembers
    ?? householdOwnerData?.numHouseholdsInHouse;
  if (houseData?.buildingArea && totalMembers) {
    const buildingArea = parseFloat(houseData.buildingArea);
    const numOccupants = parseInt(totalMembers, 10);

    if (buildingArea > 0 && numOccupants > 0) {
      const areaPerPerson = buildingArea / numOccupants;
      if (areaPerPerson < 7.2) {
        return false;
      }
    }
  }

  // 2. Check Lantai (Floor Material)
  // Layak: tanah, keramik, rabat_semen, papan, kayu, bata
  // Tidak layak: lainnya (terpal/kulit kayu/kawat/batang kayu/daun)
  if (!houseData?.floorMaterial) {
    return false;
  }
  if (houseData.floorMaterial === 'lainnya' || houseData.floorMaterialOther) {
    return false;
  }
  const validFloorMaterials = ['tanah', 'keramik', 'rabat_semen', 'papan', 'kayu', 'bata'];
  if (!validFloorMaterials.includes(houseData.floorMaterial)) {
    return false;
  }

  // 3. Check Atap (Roof Material)
  // Layak: genteng_beton, genteng_keramik, seng_multiroof, kayu_sirap, asbes
  // Tidak layak: lainnya (daun/terpal)
  if (!houseData?.roofMaterial) {
    return false;
  }
  if (houseData.roofMaterial === 'lainnya' || houseData.roofMaterialOther) {
    return false;
  }
  const validRoofMaterials = ['genteng_beton', 'genteng_keramik', 'seng_multiroof', 'kayu_sirap', 'asbes'];
  if (!validRoofMaterials.includes(houseData.roofMaterial)) {
    return false;
  }

  // 4. Check Sumber Air Minum (Drinking Water Source)
  // Layak: sumur_gali, sumur_bor, ledeng, air_isi_ulang
  // Tidak layak: lainnya (sungai/kulong/danau/saluran/sumur bersama)
  if (!waterAccess?.drinkingWaterSource) {
    return false;
  }
  if (waterAccess.drinkingWaterSource === 'lainnya' || waterAccess.drinkingWaterSourceOther) {
    return false;
  }
  const validWaterSources = ['sumur_gali', 'sumur_bor', 'ledeng', 'air_isi_ulang'];
  if (!validWaterSources.includes(waterAccess.drinkingWaterSource)) {
    return false;
  }

  // 5. Check Kepemilikan Jamban (Toilet Ownership)
  // Layak: milik_sendiri
  // Tidak layak: jamban_bersama, tidak_memiliki
  if (!sanitationAccess?.toiletOwnership) {
    return false;
  }
  if (sanitationAccess.toiletOwnership !== 'milik_sendiri') {
    return false;
  }

  // 6. Check Jenis Tangki Septic (Septic Tank Type)
  // Layak: biotank, tanki_permanen, lubang_tanah
  // Tidak layak: tidak_memiliki
  if (!sanitationAccess?.septicTankType) {
    return false;
  }
  if (sanitationAccess.septicTankType === 'tidak_memiliki') {
    return false;
  }
  const validSepticTankTypes = ['biotank', 'tanki_permanen', 'lubang_tanah'];
  if (!validSepticTankTypes.includes(sanitationAccess.septicTankType)) {
    return false;
  }

  // All criteria passed, house is livable
  return true;
}

/**
 * Submit housing form
 */
async function submitHousingForm(formData, userId) {
  await ensureFormSubmissionSchema();

  const ownerLatitude = normalizeCoordinateValue(formData.householdOwnerData?.latitude);
  const ownerLongitude = normalizeCoordinateValue(formData.householdOwnerData?.longitude);
  const ownerGeom = buildPointGeom(ownerLatitude, ownerLongitude);
  const coordsProvided = Number.isFinite(ownerLatitude) && Number.isFinite(ownerLongitude);
  let resolvedLocation = null;
  if (coordsProvided) {
    resolvedLocation = await findLocationByCoordinates(
      ownerLatitude,
      ownerLongitude,
    );

    const mismatch = (expected, actual) => expected && actual && expected !== actual;
    if (
      mismatch(formData.householdOwnerData?.villageId, resolvedLocation.village?.id)
      || mismatch(formData.householdOwnerData?.districtId, resolvedLocation.district?.id)
      || mismatch(formData.householdOwnerData?.regencyId, resolvedLocation.regency?.id)
      || mismatch(formData.householdOwnerData?.provinceId, resolvedLocation.province?.id)
    ) {
      throw errorFactory.validation(
        'Koordinat tidak sesuai dengan wilayah yang dipilih.',
        'coordinates',
      );
    }
  }

  const locationData = {
    villageId: resolvedLocation?.village?.id || formData.householdOwnerData.villageId,
    districtId: resolvedLocation?.district?.id || formData.householdOwnerData.districtId,
    regencyId: resolvedLocation?.regency?.id || formData.householdOwnerData.regencyId,
    provinceId: resolvedLocation?.province?.id || formData.householdOwnerData.provinceId,
  };

  const transaction = await sequelize.transaction();

  try {
    // Create form submission first (with minimal data)
    const submission = await FormSubmission.create({
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
      ...locationData,
    }, { transaction });

    // Create form respondent
    const respondent = await FormRespondent.create({
      name: formData.respondent.name,
      email: formData.respondent.email,
      position: formData.respondent.position,
      positionOther: formData.respondent.positionOther,
      phone: formData.respondent.phone,
      formSubmissionId: submission.id,
    }, { transaction });

    const rawFamilyCardNumber = String(formData.householdOwnerData.familyCardNumber || '').trim();
    const familyCardNumber = rawFamilyCardNumber || null;
    const totalFamilyMembers = formData.householdOwnerData.totalFamilyMembers
      ?? formData.householdOwnerData.numHouseholdsInHouse;
    const hasReceivedHousingAssistance = normalizeBoolean(
      formData.householdOwnerData.hasReceivedHousingAssistance
        ?? formData.householdOwnerData.hasHousingAssistance,
      false,
    );
    const isRegisteredAsPoor = normalizeBoolean(formData.householdOwnerData.isRegisteredAsPoor, false);
    const headOfFamilyAge = formData.householdOwnerData.headOfFamilyAge
      ?? formData.householdOwnerData.age;
    const ownerPayload = pickDefined({
      ownerName: formData.householdOwnerData.ownerName,
      ownerPhone: formData.householdOwnerData.ownerPhone,
      headOfFamilyName: formData.householdOwnerData.headOfFamilyName,
      headOfFamilyPhone: formData.householdOwnerData.headOfFamilyPhone,
      headOfFamilyAge,
      familyCardNumber: familyCardNumber || undefined,
      totalFamilyMembers,
      address: formData.householdOwnerData.address,
      houseNumber: formData.householdOwnerData.houseNumber,
      rt: formData.householdOwnerData.rt,
      rw: formData.householdOwnerData.rw,
      villageId: locationData.villageId,
      districtId: locationData.districtId,
      regencyId: locationData.regencyId,
      provinceId: locationData.provinceId,
      latitude: ownerLatitude,
      longitude: ownerLongitude,
      geom: ownerGeom,
      educationLevel: formData.householdOwnerData.educationLevel,
      educationLevelOther: formData.householdOwnerData.educationLevelOther,
      occupation: formData.householdOwnerData.occupation,
      monthlyIncome: formData.householdOwnerData.monthlyIncome,
      landOwnershipStatus: formData.householdOwnerData.landOwnershipStatus,
      houseOwnershipStatus: formData.householdOwnerData.houseOwnershipStatus,
      hasReceivedHousingAssistance,
      housingAssistanceYear: formData.householdOwnerData.housingAssistanceYear,
      isRegisteredAsPoor,
      poorRegistrationAttachment: formData.householdOwnerData.poorRegistrationAttachment,
    });

    let householdOwner = null;
    if (familyCardNumber) {
      householdOwner = await HouseholdOwner.findOne({
        where: { familyCardNumber },
        order: [['updated_at', 'DESC']],
        transaction,
      });
    }

    if (householdOwner) {
      await householdOwner.update(ownerPayload, { transaction });
    } else {
      householdOwner = await HouseholdOwner.create({
        ...ownerPayload,
        formSubmissionId: submission.id,
      }, { transaction });
    }

    // Create house data
    const houseData = await HouseData.create({
      buildingArea: formData.houseData.buildingArea,
      landArea: formData.houseData.landArea,
      hasBuildingPermit: formData.houseData.hasBuildingPermit,
      buildingPermitNumber: formData.houseData.buildingPermitNumber,
      houseType: formData.houseData.houseType,
      floorMaterial: formData.houseData.floorMaterial,
      floorMaterialOther: formData.houseData.floorMaterialOther,
      wallMaterial: formData.houseData.wallMaterial,
      wallMaterialOther: formData.houseData.wallMaterialOther,
      roofMaterial: formData.houseData.roofMaterial,
      roofMaterialOther: formData.houseData.roofMaterialOther,
      formSubmissionId: submission.id,
    }, { transaction });

    // Create water access
    const waterAccess = await WaterAccess.create({
      sanitationWaterSource: formData.waterAccess.sanitationWaterSource,
      sanitationWaterSourceOther: formData.waterAccess.sanitationWaterSourceOther,
      drinkingWaterSource: formData.waterAccess.drinkingWaterSource,
      drinkingWaterSourceOther: formData.waterAccess.drinkingWaterSourceOther,
      drinkingWaterDepth: formData.waterAccess.drinkingWaterDepth,
      sanitationWaterDepth: formData.waterAccess.sanitationWaterDepth,
      sanitationWaterLocation: formData.waterAccess.sanitationWaterLocation,
      formSubmissionId: submission.id,
    }, { transaction });

    // Create sanitation access
    const sanitationAccess = await SanitationAccess.create({
      toiletOwnership: formData.sanitationAccess.toiletOwnership,
      toiletCount: formData.sanitationAccess.toiletCount,
      toiletType: formData.sanitationAccess.toiletType,
      hasSepticTank: formData.sanitationAccess.hasSepticTank,
      septicTankType: formData.sanitationAccess.septicTankType,
      septicTankYear: formData.sanitationAccess.septicTankYear,
      hasSepticPumping: formData.sanitationAccess.hasSepticPumping,
      septicPumpingYear: formData.sanitationAccess.septicPumpingYear,
      septicPumpingService: formData.sanitationAccess.septicPumpingService,
      wastewaterDisposal: formData.sanitationAccess.wastewaterDisposal,
      formSubmissionId: submission.id,
    }, { transaction });

    // Create waste management
    const wasteManagement = await WasteManagement.create({
      wasteCollection: formData.wasteManagement.wasteCollection,
      wasteCollectionOther: formData.wasteManagement.wasteCollectionOther,
      wasteDisposalMethod: formData.wasteManagement.wasteDisposalMethod,
      wasteDisposalLocation: formData.wasteManagement.wasteDisposalLocation,
      wasteCollectionManager: formData.wasteManagement.wasteCollectionManager,
      wasteCollectionManagerOther: formData.wasteManagement.wasteCollectionManagerOther,
      formSubmissionId: submission.id,
    }, { transaction });

    // Create road access
    const roadAccess = await RoadAccess.create({
      roadType: formData.roadAccess.roadType,
      roadTypeOther: formData.roadAccess.roadTypeOther,
      roadWidth: formData.roadAccess.roadWidth,
      roadConstruction: formData.roadAccess.roadConstruction,
      roadConstructionOther: formData.roadAccess.roadConstructionOther,
      formSubmissionId: submission.id,
    }, { transaction });

    // Create energy access
    const energyAccess = await EnergyAccess.create({
      electricitySource: formData.energyAccess.electricitySource,
      electricityCapacity: formData.energyAccess.electricityCapacity,
      electricityCapacityOther: formData.energyAccess.electricityCapacityOther,
      formSubmissionId: submission.id,
    }, { transaction });

    // Helper function to save photos for an entity
    const savePhotosForEntity = async(entityType, entityId, photos, txn) => {
      if (!photos || !Array.isArray(photos) || photos.length === 0) {
        return;
      }

      const photoPromises = photos.map(async(photo, index) => {
        try {
          // Save file to disk
          const { relativePath, mimeType, fileSize } = await saveFile(photo, entityType, entityId);

          // Save photo record to database
          return HousingPhoto.create({
            entityType,
            entityId,
            filePath: relativePath,
            mimeType,
            fileSize,
            caption: photo.caption || null,
            displayOrder: photo.displayOrder !== undefined ? photo.displayOrder : index,
            uploadedBy: userId,
          }, { transaction: txn });
        } catch (error) {
          console.error(`Failed to save photo for ${entityType}:`, error);
          throw error;
        }
      });

      return Promise.all(photoPromises);
    };

    // Save photos for each entity if provided
    if (formData.houseData.photos) {
      await savePhotosForEntity('house_data', houseData.id, formData.houseData.photos, transaction);
    }

    if (formData.waterAccess.photos) {
      await savePhotosForEntity('water_access', waterAccess.id, formData.waterAccess.photos, transaction);
    }

    if (formData.sanitationAccess.photos) {
      await savePhotosForEntity(
        'sanitation_access',
        sanitationAccess.id,
        formData.sanitationAccess.photos,
        transaction,
      );
    }

    if (formData.wasteManagement.photos) {
      await savePhotosForEntity('waste_management', wasteManagement.id, formData.wasteManagement.photos, transaction);
    }

    if (formData.roadAccess.photos) {
      await savePhotosForEntity('road_access', roadAccess.id, formData.roadAccess.photos, transaction);
    }

    if (formData.energyAccess.photos) {
      await savePhotosForEntity(
        'energy_access',
        energyAccess.id,
        formData.energyAccess.photos,
        transaction,
      );
    }

    // Update form submission with all IDs and final status
    await submission.update({
      formRespondentId: respondent.id,
      householdOwnerId: householdOwner.id,
      houseDataId: houseData.id,
      waterAccessId: waterAccess.id,
      sanitationAccessId: sanitationAccess.id,
      wasteManagementId: wasteManagement.id,
      roadAccessId: roadAccess.id,
      energyAccessId: energyAccess.id,
      villageId: householdOwner.villageId,
      districtId: householdOwner.districtId,
      regencyId: householdOwner.regencyId,
      provinceId: householdOwner.provinceId,
      isLivable: isLivableCheck(formData),
      status: 'submitted',
      verificationStatus: 'Pending',
      submittedAt: new Date(),
    }, { transaction });

    // Create audit log
    const auditLog = await AuditLog.create({
      userId,
      action: 'form_submitted',
      resourceType: 'form_submission',
      resourceId: submission.id,
      metadata: {
        respondentId: respondent.id,
        householdOwnerId: householdOwner.id,
        respondentName: respondent.name,
        respondentPosition: respondent.position,
      },
    }, { transaction });

    await transaction.commit();

    try {
      const reviewers = await findReviewerUsersForScope({
        villageId: householdOwner.villageId,
        districtId: householdOwner.districtId,
        regencyId: householdOwner.regencyId,
        provinceId: householdOwner.provinceId,
      });
      await createNotificationsForUsers(
        reviewers.map((reviewer) => reviewer.id),
        {
          type: 'info',
          category: 'verification',
          title: 'Formulir Rumah Baru',
          message: `Formulir rumah baru dari ${householdOwner.ownerName || 'warga'} menunggu verifikasi.`,
          link: `/housing-data?submissionId=${submission.id}`,
          auditLogId: auditLog?.id,
        },
      );
    } catch (notifyError) {
      console.warn('Failed to notify reviewers:', notifyError.message);
    }

    return submission;
  } catch (error) {
    console.error('Failed to submit housing form:', error);
    await transaction.rollback();
    throw errorFactory.database('Failed to submit housing form', error);
  }
}

/**
 * Review form submission
 */
async function reviewFormSubmission(submissionId, reviewData, reviewerId, reviewerContext = null) {
  const submission = await FormSubmission.findByPk(submissionId);
  if (!submission) {
    throw errorFactory.notFound('Form submission not found');
  }

  if (['approved', 'rejected', 'history'].includes(submission.status)) {
    throw errorFactory.conflict('Form submission has already been finalized');
  }

  const normalizedStatus = String(reviewData.status || '').toLowerCase();
  const reviewNotes = reviewData.reviewNotes ? String(reviewData.reviewNotes).trim() : null;

  if (normalizedStatus === 'rejected' && !reviewNotes) {
    throw errorFactory.validation('Alasan penolakan wajib diisi.', 'reviewNotes');
  }

  const normalizedReviewerId = reviewerId ? String(reviewerId) : null;
  const assignedReviewerId = submission.reviewedBy ? String(submission.reviewedBy) : null;
  const isLockedByOther = ['reviewed', 'under_review'].includes(submission.status)
    && assignedReviewerId
    && assignedReviewerId !== normalizedReviewerId;

  if (isLockedByOther && !isSuperAdmin(reviewerContext)) {
    throw errorFactory.conflict('Form submission sedang ditinjau oleh verifikator lain');
  }

  let nextStatus = submission.status;
  let verificationStatus = submission.verificationStatus || 'Pending';

  if (normalizedStatus === 'under_review' || normalizedStatus === 'reviewed' || normalizedStatus === 'verified') {
    if (!['submitted', 'under_review', 'reviewed'].includes(submission.status)) {
      throw errorFactory.conflict('Form submission tidak bisa masuk ke tahap review');
    }
    nextStatus = 'under_review';
    verificationStatus = 'Pending';
  } else if (normalizedStatus === 'approved') {
    if (!['submitted', 'under_review', 'reviewed'].includes(submission.status)) {
      throw errorFactory.conflict('Form submission tidak bisa disetujui pada status saat ini');
    }
    nextStatus = 'approved';
    verificationStatus = 'Verified';
  } else if (normalizedStatus === 'rejected') {
    if (!['submitted', 'under_review', 'reviewed'].includes(submission.status)) {
      throw errorFactory.conflict('Form submission tidak bisa ditolak pada status saat ini');
    }
    nextStatus = 'rejected';
    verificationStatus = 'Rejected';
  } else {
    throw errorFactory.validation('Invalid status for review');
  }

  const oldValues = {
    status: submission.status,
    verificationStatus: submission.verificationStatus,
    reviewNotes: submission.reviewNotes,
    reviewedAt: submission.reviewedAt,
    reviewedBy: submission.reviewedBy,
  };

  await submission.update({
    status: nextStatus,
    verificationStatus,
    reviewNotes,
    reviewedAt: new Date(),
    reviewedBy: reviewerId,
    updatedBy: reviewerId,
  });

  if (nextStatus === 'approved' && submission.householdOwnerId) {
    await FormSubmission.update(
      {
        status: 'history',
        updatedBy: reviewerId,
      },
      {
        where: {
          householdOwnerId: submission.householdOwnerId,
          id: { [Op.ne]: submission.id },
          status: 'approved',
        },
      },
    );
  }

  // Create audit log
  const auditLog = await AuditLog.create({
    userId: reviewerId,
    action: 'form_reviewed',
    resourceType: 'form_submission',
    resourceId: submissionId,
    oldValues,
    newValues: {
      status: nextStatus,
      verificationStatus,
      reviewNotes,
      reviewedAt: submission.reviewedAt,
      reviewedBy: reviewerId,
    },
    metadata: {
      status: normalizedStatus,
    },
  });

  try {
    const statusLabel = normalizedStatus === 'approved'
      ? 'disetujui'
      : normalizedStatus === 'rejected'
        ? 'ditolak'
        : 'dalam tinjauan';
    await createNotification(submission.createdBy, {
      type: normalizedStatus === 'approved' ? 'success' : normalizedStatus === 'rejected' ? 'warning' : 'info',
      category: 'status',
      title: 'Pembaruan Status Survei Rumah',
      message: `Data rumah Anda ${statusLabel}. ${reviewNotes ? `Catatan: ${reviewNotes}` : ''}`.trim(),
      link: `/housing-data?submissionId=${submissionId}`,
      auditLogId: auditLog?.id,
    });
  } catch (notifyError) {
    console.warn('Failed to notify submitter:', notifyError.message);
  }

  return submission;
}

/**
 * Get housing statistics
 */
async function getHousingStatistics(userLocationScope, options = {}) {
  const {
    villageId, districtId, regencyId, provinceId, surveyYear,
  } = options;

  const isMasyarakatUser = isMasyarakat(userLocationScope);
  const whereClause = isMasyarakatUser
    ? { createdBy: userLocationScope.id }
    : {};

  const locationClause = queryUtils.buildLocationWhereClause(userLocationScope, {
    villageId, districtId, regencyId, provinceId,
  });
  Object.assign(whereClause, locationClause);

  if (surveyYear) {
    const parsedYear = Number.parseInt(surveyYear, 10);
    if (Number.isFinite(parsedYear)) {
      const dateExpression = sequelize.fn(
        'COALESCE',
        sequelize.col('FormSubmission.submitted_at'),
        sequelize.col('FormSubmission.created_at'),
      );
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.where(getYearExpression(dateExpression), parsedYear),
      ];
    }
  }

    const stats = await FormSubmission.findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('FormSubmission.id'))), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const totalSubmissions = await FormSubmission.count({
      where: whereClause,
      distinct: true,
      col: 'id',
    });
    const approvedWhere = {
      ...whereClause,
      status: 'approved',
    };
    const totalApproved = await FormSubmission.count({
      where: approvedWhere,
      distinct: true,
      col: 'householdOwnerId',
    });
    const livableCount = await FormSubmission.count({
      where: {
        ...approvedWhere,
        isLivable: true,
      },
      distinct: true,
      col: 'householdOwnerId',
    });

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
    sequelize.col('FormSubmission.submitted_at'),
    sequelize.col('FormSubmission.created_at'),
  );
  const monthlyWhere = { ...whereClause };
  const monthlyAnd = monthlyWhere[Op.and] ? [...monthlyWhere[Op.and]] : [];
  monthlyAnd.push(
    sequelize.where(dateExpression, {
      [Op.gte]: startDate,
      [Op.lt]: endDate,
    }),
  );
  monthlyWhere[Op.and] = monthlyAnd;

  const monthlyRows = await FormSubmission.findAll({
    where: monthlyWhere,
    attributes: [
      [getMonthExpression(dateExpression), 'month'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('FormSubmission.id'))), 'count'],
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

  let districtBreakdown = null;
  if (isAdminKabupaten(userLocationScope)) {
    const districtWhere = {
      ...whereClause,
      districtId: { [Op.ne]: null },
    };
    if (!districtWhere.status) {
      appendNonHistoryFilter(districtWhere);
    }

    const districtRows = await FormSubmission.findAll({
      where: districtWhere,
      attributes: [
        'districtId',
        'status',
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('FormSubmission.id'))), 'count'],
      ],
      group: ['districtId', 'status'],
      raw: true,
    });

    const districtIds = [...new Set(districtRows.map((row) => row.districtId).filter(Boolean))];
    const districts = districtIds.length
      ? await District.findAll({
        where: { id: { [Op.in]: districtIds } },
        attributes: ['id', 'name'],
        raw: true,
      })
      : [];
    const districtMap = new Map(districts.map((district) => [district.id, district.name]));

    const breakdownMap = new Map();
    districtRows.forEach((row) => {
      const districtId = row.districtId;
      if (!districtId) return;
      if (!breakdownMap.has(districtId)) {
        breakdownMap.set(districtId, {
          districtId,
          districtName: districtMap.get(districtId) || 'Tidak diketahui',
          approved: 0,
          pending: 0,
          rejected: 0,
          total: 0,
        });
      }
      const entry = breakdownMap.get(districtId);
      const status = String(row.status || '').toLowerCase();
      const count = parseInt(row.count, 10);
      if (status === 'approved') {
        entry.approved += count;
      } else if (status === 'rejected') {
        entry.rejected += count;
      } else if (['submitted', 'under_review', 'reviewed'].includes(status)) {
        entry.pending += count;
      } else {
        entry.total += count;
      }
      entry.total += count;
    });

    districtBreakdown = Array.from(breakdownMap.values()).sort((a, b) =>
      a.districtName.localeCompare(b.districtName, 'id'),
    );
  }

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

  return {
    total: totalApproved,
    totalSubmissions,
    livableCount,
    statusBreakdown,
    statusSummary,
    districtBreakdown,
    monthlySubmissions: {
      labels: monthKeys,
      counts: monthlyCounts,
    },
  };
}

/**
 * Get geographic data for dropdowns
 */
async function getGeographicData(userLocationScope, options = {}) {
  const { level, parentId } = options;

  switch (level) {
  case 'provinces':
    return Province.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

  case 'regencies':
    if (!parentId) {
      throw errorFactory.validation('Parent province ID is required for regencies');
    }
    return Regency.findAll({
      where: { provinceId: parentId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

  case 'districts':
    if (!parentId) {
      throw errorFactory.validation('Parent regency ID is required for districts');
    }
    return District.findAll({
      where: { regencyId: parentId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

  case 'villages':
    if (!parentId) {
      throw errorFactory.validation('Parent district ID is required for villages');
    }
    return Village.findAll({
      where: { districtId: parentId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

  default:
    throw errorFactory.validation('Invalid geographic level');
  }
}

const buildHousingExportContext = async (userLocationScope, options = {}) => {
  const {
    status,
    villageId,
    districtId,
    regencyId,
    provinceId,
    surveyYear,
    gisLayerName,
    gisLayer,
    layerName,
  } = options;
  const resolvedGisLayer = gisLayerName || gisLayer || layerName;

  const whereClause = {};
  const isMasyarakatUser = isMasyarakat(userLocationScope);

  if (status) {
    const normalizedStatus = String(status).toLowerCase();
    if (normalizedStatus === 'under_review') {
      whereClause.status = { [Op.in]: ['under_review', 'reviewed'] };
    } else {
      whereClause.status = normalizedStatus;
    }
  }

  if (isMasyarakatUser) {
    whereClause.createdBy = userLocationScope.id;
  }

  const scopedLocation = await enforceExportLocationScope(userLocationScope, {
    villageId,
    districtId,
    regencyId,
    provinceId,
  });
  const locationClause = queryUtils.buildLocationWhereClause(userLocationScope, scopedLocation);
  if (Object.keys(locationClause).length > 0) {
    Object.assign(whereClause, locationClause);
  }

  if (surveyYear) {
    const parsedYear = Number.parseInt(surveyYear, 10);
    if (Number.isFinite(parsedYear)) {
      const dateExpression = sequelize.fn(
        'COALESCE',
        sequelize.col('FormSubmission.submitted_at'),
        sequelize.col('FormSubmission.created_at'),
      );
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.where(getYearExpression(dateExpression), parsedYear),
      ];
    }
  }

  const gisLayerFilters = parseGisLayerFilters(options);
  const useSpatialFilter = gisLayerFilters.length > 0;
  const gisLayerLabel = useSpatialFilter ? formatGisLayerLabel(gisLayerFilters) : '';
  if (useSpatialFilter) {
    const pointExpression = `COALESCE("householdOwner"."geom", ST_SetSRID(ST_MakePoint("householdOwner"."longitude", "householdOwner"."latitude"), 4326))`;
    const spatialSql = buildSpatialLayerIntersectsSql(gisLayerFilters, pointExpression);
    if (spatialSql) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        sequelize.literal(spatialSql),
      ];
    }
  }

  return {
    whereClause,
    useSpatialFilter,
    gisLayerFilters,
    gisLayerLabel,
    resolvedGisLayer,
  };
};

const loadSubmissionGisLayerMap = async (submissionIds, gisLayerFilters) => {
  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    return new Map();
  }

  const whereSql = buildSpatialLayerWhereSql(gisLayerFilters);
  if (!whereSql) {
    return new Map();
  }

  const results = new Map();
  const chunkSize = 1000;

  for (let i = 0; i < submissionIds.length; i += chunkSize) {
    const chunk = submissionIds.slice(i, i + chunkSize);
    const rows = await sequelize.query(
      `SELECT fs.id AS "id",
        ARRAY_AGG(DISTINCT sl.category || ':' || sl.layer_name) AS "layers"
      FROM form_submissions fs
      JOIN household_owners ho ON fs.household_owner_id = ho.id
      JOIN spatial_layers sl
        ON ${whereSql}
        AND sl.geom IS NOT NULL
        AND ST_Intersects(
          COALESCE(ho.geom, ST_SetSRID(ST_MakePoint(ho.longitude, ho.latitude), 4326)),
          sl.geom
        )
      WHERE fs.id IN (:ids)
      GROUP BY fs.id`,
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
 * Export form submissions data
 */
async function exportFormSubmissions(userLocationScope, options = {}) {
  const { format = 'json' } = options;
  const {
    whereClause,
    useSpatialFilter,
    gisLayerFilters,
    gisLayerLabel,
    resolvedGisLayer,
  } = await buildHousingExportContext(userLocationScope, options);

  const submissions = await FormSubmission.findAll({
    where: whereClause,
    include: [
      {
        model: FormRespondent,
        as: 'formRespondent',
        attributes: ['id', 'name', 'email', 'position', 'positionOther', 'phone'],
        include: [],
      },
      {
        model: HouseholdOwner,
        as: 'householdOwner',
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
        required: useSpatialFilter,
      },
      {
        model: HouseData,
        as: 'houseData',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: WaterAccess,
        as: 'waterAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: SanitationAccess,
        as: 'sanitationAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: WasteManagement,
        as: 'wasteManagement',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: RoadAccess,
        as: 'roadAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
      {
        model: EnergyAccess,
        as: 'energyAccess',
        include: [
          {
            model: HousingPhoto,
            as: 'photos',
            attributes: ['id', 'file_path', 'mime_type', 'caption', 'display_order', 'created_at'],
            required: false,
            separate: true,
            order: [['display_order', 'ASC'], ['created_at', 'ASC']],
          },
        ],
        required: false,
      },
    ],
    order: [['submittedAt', 'DESC']],
  });

  let finalSubmissions = submissions;

  if (useSpatialFilter && gisLayerFilters.length > 0) {
    if (gisLayerFilters.length === 1 && gisLayerLabel) {
      submissions.forEach((submission) => {
        submission.setDataValue('gisAreaLabel', gisLayerLabel);
      });
    } else if (submissions.length > 0) {
      const submissionIds = submissions.map((submission) => submission.id);
      const gisLayerMap = await loadSubmissionGisLayerMap(
        submissionIds,
        gisLayerFilters,
      );
      const labelOrder = gisLayerFilters.map((filter) => ({
        key: `${filter.category}:${filter.layerName}`,
        label: formatGisLayerLabel([filter]),
      }));
      submissions.forEach((submission) => {
        const matched = gisLayerMap.get(submission.id) || [];
        if (!matched.length) {
          return;
        }
        const matchedSet = new Set(matched);
        const labels = labelOrder
          .filter((entry) => matchedSet.has(entry.key))
          .map((entry) => entry.label)
          .filter(Boolean);
        if (labels.length > 0) {
          submission.setDataValue('gisAreaLabel', labels.join(', '));
        }
      });
    }
  }

  if (resolvedGisLayer && !useSpatialFilter) {
    const gisLayer = await loadGisLayer(resolvedGisLayer);
    const geojson = gisLayer?.geojson;
    const features = Array.isArray(geojson?.features)
      ? geojson.features
      : [];
    const polygons = features.filter((feature) => {
      const type = feature?.geometry?.type;
      return type === 'Polygon' || type === 'MultiPolygon';
    });

    if (!polygons.length) {
      return [];
    }

    let matchedCount = 0;
    const invalidSamples = [];
    const outsideSamples = [];

    finalSubmissions = submissions.filter((submission) => {
      const owner = submission.householdOwner || {};
      const lat = Number(owner.latitude);
      const lon = Number(owner.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        if (invalidSamples.length < 8) {
          invalidSamples.push({
            id: submission.id,
            lat: owner.latitude,
            lon: owner.longitude,
          });
        }
        return false;
      }
      const point = turf.point([lon, lat]);
      const matchedFeature = polygons.find((feature) =>
        turf.booleanPointInPolygon(point, feature)
      );
      if (!matchedFeature) {
        if (outsideSamples.length < 8) {
          outsideSamples.push({
            id: submission.id,
            lat,
            lon,
          });
        }
        return false;
      }
      const label = resolveGisFeatureLabel(matchedFeature, gisLayer.label);
      submission.setDataValue('gisAreaLabel', label);
      matchedCount += 1;
      return true;
    });

    if (submissions.length && matchedCount !== submissions.length) {
      console.warn('[GIS Export] Titik tidak masuk poligon.', {
        layer: gisLayer?.key || resolvedGisLayer,
        total: submissions.length,
        matched: matchedCount,
        invalidSamples,
        outsideSamples,
      });
    }
  }

  if (format === 'csv') {
    // Convert to CSV format
    const csvData = finalSubmissions.map((submission) => {
      const householdOwner = submission.householdOwner || {};
      const houseData = submission.houseData || {};
      const waterAccess = submission.waterAccess || {};
      const sanitationAccess = submission.sanitationAccess || {};
      const village = householdOwner.village || {};
      const district = householdOwner.district || {};
      const regency = householdOwner.regency || {};
      const province = householdOwner.province || {};

      return {
        id: submission.id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        respondentName: submission.formRespondent?.name || '',
        village: village.name || '',
        district: district.name || '',
        regency: regency.name || '',
        province: province.name || '',
        gisAreaLabel: submission.gisAreaLabel
          ?? submission.get?.('gisAreaLabel')
          ?? submission.dataValues?.gisAreaLabel
          ?? '',
        houseType: houseData.houseType || '',
        waterSource: waterAccess.drinkingWaterSource || '',
        toiletType: sanitationAccess.toiletType || '',
      };
    });

    return csvData;
  }

  return finalSubmissions;
}

const countExportFormSubmissions = async (userLocationScope, options = {}) => {
  const {
    whereClause,
    useSpatialFilter,
    resolvedGisLayer,
  } = await buildHousingExportContext(userLocationScope, options);

  if (resolvedGisLayer && !useSpatialFilter) {
    const items = await exportFormSubmissions(userLocationScope, options);
    return items.length;
  }

  const include = [];
  if (useSpatialFilter) {
    include.push({
      model: HouseholdOwner,
      as: 'householdOwner',
      attributes: [],
      required: true,
    });
  }

  const match = await FormSubmission.findOne({
    where: whereClause,
    include,
    attributes: ['id'],
    raw: true,
  });

  return match ? 1 : 0;
};

module.exports = {
  getFormSubmissions,
  getFormSubmissionById,
  getSubmissionHistoryByOwner,
  submitHousingForm,
  updateFormSubmission,
  updateOwnSubmission,
  reviewFormSubmission,
  getHousingStatistics,
  getGeographicData,
  exportFormSubmissions,
  countExportFormSubmissions,
};
