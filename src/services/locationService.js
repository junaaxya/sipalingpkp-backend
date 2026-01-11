const { QueryTypes, Op } = require('sequelize');
const {
  Province,
  Regency,
  District,
  Village,
  sequelize,
} = require('../models');
const { errorFactory } = require('../errors/errorUtils');

/**
 * Get all provinces
 */
async function getProvinces() {
  const provinces = await Province.findAll({
    attributes: ['id', 'code', 'name'],
    order: [['name', 'ASC']],
  });

  return provinces;
}

/**
 * Get province by ID
 */
async function getProvinceById(provinceId) {
  const province = await Province.findByPk(provinceId, {
    attributes: ['id', 'code', 'name'],
    include: [
      {
        model: Regency,
        as: 'regencies',
        attributes: ['id', 'code', 'name', 'type'],
        required: false,
        order: [['name', 'ASC']],
      },
    ],
  });

  if (!province) {
    throw errorFactory.notFound('Province');
  }

  return province;
}

/**
 * Get regencies by province ID
 */
async function getRegenciesByProvince(provinceId) {
  if (!provinceId) {
    throw errorFactory.validation('Province ID is required');
  }

  // Verify province exists
  const province = await Province.findByPk(provinceId);
  if (!province) {
    throw errorFactory.notFound('Province');
  }

  const regencies = await Regency.findAll({
    where: { provinceId },
    attributes: ['id', 'code', 'name', 'type'],
    order: [['name', 'ASC']],
  });

  return regencies;
}

/**
 * Get regency by ID
 */
async function getRegencyById(regencyId) {
  const regency = await Regency.findByPk(regencyId, {
    attributes: ['id', 'code', 'name', 'type'],
    include: [
      {
        model: Province,
        as: 'province',
        attributes: ['id', 'code', 'name'],
        required: false,
      },
      {
        model: District,
        as: 'districts',
        attributes: ['id', 'code', 'name'],
        required: false,
        order: [['name', 'ASC']],
      },
    ],
  });

  if (!regency) {
    throw errorFactory.notFound('Regency');
  }

  return regency;
}

/**
 * Get districts by regency ID
 */
async function getDistrictsByRegency(regencyId) {
  if (!regencyId) {
    throw errorFactory.validation('Regency ID is required');
  }

  // Verify regency exists
  const regency = await Regency.findByPk(regencyId);
  if (!regency) {
    throw errorFactory.notFound('Regency');
  }

  const districts = await District.findAll({
    where: { regencyId },
    attributes: ['id', 'code', 'name'],
    order: [['name', 'ASC']],
  });

  return districts;
}

/**
 * Get district by ID
 */
async function getDistrictById(districtId) {
  const district = await District.findByPk(districtId, {
    attributes: ['id', 'code', 'name'],
    include: [
      {
        model: Regency,
        as: 'regency',
        attributes: ['id', 'code', 'name', 'type'],
        required: false,
        include: [
          {
            model: Province,
            as: 'province',
            attributes: ['id', 'code', 'name'],
            required: false,
          },
        ],
      },
      {
        model: Village,
        as: 'villages',
        attributes: ['id', 'code', 'name'],
        required: false,
        order: [['name', 'ASC']],
      },
    ],
  });

  if (!district) {
    throw errorFactory.notFound('District');
  }

  return district;
}

/**
 * Get villages by district ID
 */
async function getVillagesByDistrict(districtId) {
  if (!districtId) {
    throw errorFactory.validation('District ID is required');
  }

  // Verify district exists
  const district = await District.findByPk(districtId);
  if (!district) {
    throw errorFactory.notFound('District');
  }

  const villages = await Village.findAll({
    where: { districtId },
    attributes: ['id', 'code', 'name'],
    order: [['name', 'ASC']],
  });

  return villages;
}

/**
 * Get village by ID
 */
async function getVillageById(villageId) {
  const village = await Village.findByPk(villageId, {
    attributes: ['id', 'code', 'name'],
    include: [
      {
        model: District,
        as: 'district',
        attributes: ['id', 'code', 'name'],
        required: false,
        include: [
          {
            model: Regency,
            as: 'regency',
            attributes: ['id', 'code', 'name', 'type'],
            required: false,
            include: [
              {
                model: Province,
                as: 'province',
                attributes: ['id', 'code', 'name'],
                required: false,
              },
            ],
          },
        ],
      },
    ],
  });

  if (!village) {
    throw errorFactory.notFound('Village');
  }

  return village;
}

/**
 * Get complete location hierarchy (province -> regency -> district -> village)
 */
async function getLocationHierarchy(provinceId, regencyId, districtId, villageId) {
  const result = {};

  if (provinceId) {
    result.province = await getProvinceById(provinceId);
  }

  if (regencyId) {
    result.regency = await getRegencyById(regencyId);
  }

  if (districtId) {
    result.district = await getDistrictById(districtId);
  }

  if (villageId) {
    result.village = await getVillageById(villageId);
  }

  return result;
}

const ADMIN_BOUNDARY_CATEGORY = 'administrasi';
const VILLAGE_BOUNDARY_LAYER = 'batas_desa';

const parseProperties = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
};

const findPropertyCaseInsensitive = (props, keys = []) => {
  if (!props || !keys.length) {
    return null;
  }

  const normalizedProps = Object.keys(props).reduce((acc, key) => {
    acc[key.toUpperCase()] = props[key];
    return acc;
  }, {});

  for (const key of keys) {
    const exactValue = props[key];
    if (exactValue !== undefined && exactValue !== null) {
      const trimmed = String(exactValue).trim();
      if (trimmed) {
        return trimmed;
      }
    }

    const fallbackValue = normalizedProps[String(key).toUpperCase()];
    if (fallbackValue !== undefined && fallbackValue !== null) {
      const trimmed = String(fallbackValue).trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
};

/**
 * Find location by coordinates (reverse geocoding)
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Object} Location data with province, regency, district, and village
 */
async function findLocationByCoordinates(latitude, longitude) {
  // Validate coordinates
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw errorFactory.validation('Latitude and longitude must be valid numbers');
  }

  if (latitude < -90 || latitude > 90) {
    throw errorFactory.validation('Latitude must be between -90 and 90');
  }

  if (longitude < -180 || longitude > 180) {
    throw errorFactory.validation('Longitude must be between -180 and 180');
  }

  const rows = await sequelize.query(
    `SELECT properties
     FROM spatial_layers
     WHERE category = :category
       AND layer_name = :layerName
       AND ST_Intersects(
         geom,
         ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
       )
     LIMIT 1`,
    {
      replacements: {
        category: ADMIN_BOUNDARY_CATEGORY,
        layerName: VILLAGE_BOUNDARY_LAYER,
        latitude,
        longitude,
      },
      type: QueryTypes.SELECT,
    },
  );

  const matchedFeature = rows[0];
  if (!matchedFeature) {
    throw errorFactory.businessLogic(
      'Lokasi di luar wilayah kerja.',
      'OUTSIDE_BOUNDARY',
    );
  }

  // Extract location data from matched feature
  const props = parseProperties(matchedFeature.properties);
  const villageName = findPropertyCaseInsensitive(props, [
    'DESA',
    'KELURAHAN',
    'NAMOBJ',
    'WADMKD',
    'VILLAGE',
  ]);
  const districtName = findPropertyCaseInsensitive(props, [
    'KECAMATAN',
    'WADMKC',
    'DISTRICT',
  ]);
  const regencyName = findPropertyCaseInsensitive(props, [
    'KAB_KOTA',
    'KABUPATEN',
    'WADMKK',
    'REGENCY',
  ]);

  if (!regencyName || !districtName || !villageName) {
    throw errorFactory.notFound('GeoJSON feature tidak memiliki data wilayah lengkap');
  }

  // Find village in database by hierarchy (name-based)
  const village = await Village.findOne({
    where: { name: { [Op.iLike]: villageName } },
    include: [
      {
        model: District,
        as: 'district',
        required: true,
        where: { name: { [Op.iLike]: districtName } },
        include: [
          {
            model: Regency,
            as: 'regency',
            required: true,
            where: { name: { [Op.iLike]: regencyName } },
            include: [
              {
                model: Province,
                as: 'province',
                required: true,
              },
            ],
          },
        ],
      },
    ],
  });

  if (!village) {
    throw errorFactory.notFound('Lokasi tidak ditemukan di database. Jalankan seeder lokasi terlebih dahulu.');
  }

  // Return structured location data
  return {
    province: {
      id: village.district.regency.province.id,
      code: village.district.regency.province.code,
      name: village.district.regency.province.name,
    },
    regency: {
      id: village.district.regency.id,
      code: village.district.regency.code,
      name: village.district.regency.name,
      type: village.district.regency.type,
    },
    district: {
      id: village.district.id,
      code: village.district.code,
      name: village.district.name,
    },
    village: {
      id: village.id,
      code: village.code,
      name: village.name,
    },
    coordinates: {
      latitude,
      longitude,
    },
  };
}

module.exports = {
  getProvinces,
  getProvinceById,
  getRegenciesByProvince,
  getRegencyById,
  getDistrictsByRegency,
  getDistrictById,
  getVillagesByDistrict,
  getVillageById,
  getLocationHierarchy,
  findLocationByCoordinates,
};
