const path = require('path');
const fs = require('fs/promises');
const {
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
} = require('../services/locationService');
const { getSpatialLayerGeoJSON, getSpatialFeatureById } = require('../services/geojsonService');
const { asyncErrorHandler } = require('../errors/errorMiddleware');
const { errorFactory } = require('../errors/errorUtils');

const ALLOWED_GEOJSON_CATEGORIES = [
  'administrasi',
  'infrastruktur',
  'tata_ruang',
  'bencana',
];
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBboxParam = (query) => {
  if (!query) {
    return null;
  }

  if (query.bbox !== undefined) {
    const parts = String(query.bbox)
      .split(',')
      .map((part) => Number.parseFloat(part.trim()));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
      return { error: 'Invalid bbox format' };
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    return {
      bbox: {
        minLng,
        minLat,
        maxLng,
        maxLat,
      },
    };
  }

  const minLng = toNumber(query.minLng);
  const minLat = toNumber(query.minLat);
  const maxLng = toNumber(query.maxLng);
  const maxLat = toNumber(query.maxLat);

  const hasAny = [minLng, minLat, maxLng, maxLat].some((value) => value !== null);
  if (!hasAny) {
    return null;
  }

  const hasAll = [minLng, minLat, maxLng, maxLat].every((value) => value !== null);
  if (!hasAll) {
    return { error: 'bbox requires minLng, minLat, maxLng, maxLat' };
  }

  return {
    bbox: {
      minLng,
      minLat,
      maxLng,
      maxLat,
    },
  };
};

const parsePointParam = (query) => {
  if (!query) {
    return null;
  }

  const latitude = toNumber(query.lat ?? query.latitude);
  const longitude = toNumber(query.lng ?? query.longitude);
  const hasAny = query.lat !== undefined
    || query.lng !== undefined
    || query.latitude !== undefined
    || query.longitude !== undefined;

  if (!hasAny) {
    return null;
  }

  if (latitude === null || longitude === null) {
    return { error: 'Invalid coordinates' };
  }

  return {
    point: {
      latitude,
      longitude,
    },
  };
};

/**
 * Get all provinces
 */
const getProvincesController = asyncErrorHandler(async(req, res) => {
  const provinces = await getProvinces();

  res.json({
    success: true,
    data: { provinces },
  });
});

/**
 * Get province by ID
 */
const getProvinceController = asyncErrorHandler(async(req, res) => {
  const { provinceId } = req.params;

  const province = await getProvinceById(provinceId);

  res.json({
    success: true,
    data: { province },
  });
});

/**
 * Get regencies by province ID
 */
const getRegenciesController = asyncErrorHandler(async(req, res) => {
  const { provinceId } = req.params;

  const regencies = await getRegenciesByProvince(provinceId);

  res.json({
    success: true,
    data: { regencies },
  });
});

/**
 * Get regency by ID
 */
const getRegencyController = asyncErrorHandler(async(req, res) => {
  const { regencyId } = req.params;

  const regency = await getRegencyById(regencyId);

  res.json({
    success: true,
    data: { regency },
  });
});

/**
 * Get districts by regency ID
 */
const getDistrictsController = asyncErrorHandler(async(req, res) => {
  const { regencyId } = req.params;

  const districts = await getDistrictsByRegency(regencyId);

  res.json({
    success: true,
    data: { districts },
  });
});

/**
 * Get district by ID
 */
const getDistrictController = asyncErrorHandler(async(req, res) => {
  const { districtId } = req.params;

  const district = await getDistrictById(districtId);

  res.json({
    success: true,
    data: { district },
  });
});

/**
 * Get villages by district ID
 */
const getVillagesController = asyncErrorHandler(async(req, res) => {
  const { districtId } = req.params;

  const villages = await getVillagesByDistrict(districtId);

  res.json({
    success: true,
    data: { villages },
  });
});

/**
 * Get village by ID
 */
const getVillageController = asyncErrorHandler(async(req, res) => {
  const { villageId } = req.params;

  const village = await getVillageById(villageId);

  res.json({
    success: true,
    data: { village },
  });
});

/**
 * Get complete location hierarchy
 */
const getLocationHierarchyController = asyncErrorHandler(async(req, res) => {
  const {
    provinceId, regencyId, districtId, villageId,
  } = req.query;

  const hierarchy = await getLocationHierarchy(provinceId, regencyId, districtId, villageId);

  res.json({
    success: true,
    data: hierarchy,
  });
});

/**
 * Find location by coordinates (reverse geocoding)
 */
const findLocationByCoordinatesController = asyncErrorHandler(async(req, res) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required',
      code: 'MISSING_COORDINATES',
    });
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude must be valid numbers',
      code: 'INVALID_COORDINATES',
    });
  }

  const location = await findLocationByCoordinates(lat, lng);

  res.json({
    success: true,
    data: location,
  });
});

/**
 * Get GeoJSON data for map integration
 */
const getGeoJSONDataController = async(req, res, next) => {
  try {
    const { category, filename } = req.params;

    if (!ALLOWED_GEOJSON_CATEGORIES.includes(category)) {
      throw errorFactory.validation('Invalid GeoJSON category');
    }

    if (!filename || !SAFE_FILENAME_REGEX.test(filename)) {
      throw errorFactory.validation('Invalid GeoJSON filename');
    }

    const bboxResult = parseBboxParam(req.query);
    if (bboxResult?.error) {
      throw errorFactory.validation(bboxResult.error);
    }

    const pointResult = parsePointParam(req.query);
    if (pointResult?.error) {
      throw errorFactory.validation(pointResult.error);
    }

    const geojsonData = await getSpatialLayerGeoJSON({
      category,
      layerName: filename,
      bbox: bboxResult?.bbox,
      point: pointResult?.point,
    });

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/geo+json');
    return res.json(geojsonData);
  } catch (error) {
    return next(error);
  }
};

/**
 * Get single spatial feature by id
 */
const getSpatialFeatureByIdController = async(req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !SAFE_ID_REGEX.test(id)) {
      throw errorFactory.validation('Invalid spatial feature id');
    }

    const feature = await getSpatialFeatureById({ id });
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/geo+json');
    return res.json(feature);
  } catch (error) {
    return next(error);
  }
};

/**
 * Get search index for quick search
 */
const getSearchIndexController = async(req, res, next) => {
  try {
    const baseDir = path.join(process.cwd(), 'data_peta_profesional');
    const filePath = path.join(baseDir, 'search_index.json');
    const resolvedBase = path.resolve(baseDir);
    const resolvedFile = path.resolve(filePath);

    if (!resolvedFile.startsWith(`${resolvedBase}${path.sep}`)) {
      throw errorFactory.validation('Invalid search index file path');
    }

    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw errorFactory.notFound('Search index');
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'application/json');

    return res.sendFile(filePath, (error) => {
      if (!error) {
        return undefined;
      }

      if (error.code === 'ENOENT') {
        return next(errorFactory.notFound('Search index'));
      }

      return next(error);
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getProvinces: getProvincesController,
  getProvince: getProvinceController,
  getRegencies: getRegenciesController,
  getRegency: getRegencyController,
  getDistricts: getDistrictsController,
  getDistrict: getDistrictController,
  getVillages: getVillagesController,
  getVillage: getVillageController,
  getLocationHierarchy: getLocationHierarchyController,
  findLocationByCoordinates: findLocationByCoordinatesController,
  getGeoJSONData: getGeoJSONDataController,
  getSpatialFeatureById: getSpatialFeatureByIdController,
  getSearchIndex: getSearchIndexController,
};
