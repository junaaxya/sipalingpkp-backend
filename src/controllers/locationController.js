const path = require('path');
const fs = require('fs/promises');
const turf = require('@turf/turf');
const proj4 = require('proj4');
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
  getGeoJSONFileStats,
} = require('../services/locationService');
const { asyncErrorHandler } = require('../errors/errorMiddleware');
const { errorFactory } = require('../errors/errorUtils');

const ALLOWED_GEOJSON_CATEGORIES = [
  'administrasi',
  'infrastruktur',
  'tata_ruang',
  'bencana',
];
const SAFE_FILENAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const GEOJSON_RESPONSE_CACHE = new Map();
const PROJ_WGS84 = 'EPSG:4326';
const PROJ_WEB_MERCATOR = 'EPSG:3857';
const PROJ_UTM_48N = '+proj=utm +zone=48 +datum=WGS84 +units=m +no_defs';
const PROJ_UTM_48S = '+proj=utm +zone=48 +south +datum=WGS84 +units=m +no_defs';

const shouldSimplifyGeojson = (stats, geojsonData) => {
  if (!stats) {
    return false;
  }
  const featureCount = geojsonData?.features?.length || 0;
  return stats.size > 2_000_000 || featureCount > 250;
};

const isGeojsonWgs84 = (geojsonData) => {
  try {
    const [minX, minY, maxX, maxY] = turf.bbox(geojsonData);
    return (
      minX >= -180 &&
      maxX <= 180 &&
      minY >= -90 &&
      maxY <= 90
    );
  } catch (error) {
    return false;
  }
};

const detectGeojsonProjection = (geojsonData) => {
  try {
    const [minX, minY, maxX, maxY] = turf.bbox(geojsonData);
    if (
      minX >= -180 &&
      maxX <= 180 &&
      minY >= -90 &&
      maxY <= 90
    ) {
      return PROJ_WGS84;
    }

    const maxAbs = Math.max(
      Math.abs(minX),
      Math.abs(maxX),
      Math.abs(minY),
      Math.abs(maxY),
    );
    if (maxAbs > 2000000) {
      return PROJ_WEB_MERCATOR;
    }

    const looksLikeUtm =
      minX >= 100000 &&
      maxX <= 900000 &&
      minY >= 0 &&
      maxY <= 10000000;
    if (looksLikeUtm) {
      return minY >= 9000000 ? PROJ_UTM_48S : PROJ_UTM_48N;
    }

    return PROJ_WGS84;
  } catch (error) {
    return PROJ_WGS84;
  }
};

const reprojectGeojsonToWgs84 = (geojsonData) => {
  if (!geojsonData || !Array.isArray(geojsonData.features) || !proj4) {
    return geojsonData;
  }

  const source = detectGeojsonProjection(geojsonData);
  if (source === PROJ_WGS84) {
    return geojsonData;
  }

  const projectCoord = (coord) => {
    if (!Array.isArray(coord) || coord.length < 2) {
      return coord;
    }
    if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      const [lon, lat] = proj4(source, PROJ_WGS84, [coord[0], coord[1]]);
      if (coord.length > 2) {
        return [lon, lat, ...coord.slice(2)];
      }
      return [lon, lat];
    }
    return coord.map((item) => projectCoord(item));
  };

  return {
    ...geojsonData,
    features: geojsonData.features.map((feature) => {
      if (!feature?.geometry?.coordinates) {
        return feature;
      }
      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: projectCoord(feature.geometry.coordinates),
        },
      };
    }),
  };
};

const simplifyGeojson = (geojsonData, stats) => {
  if (!shouldSimplifyGeojson(stats, geojsonData)) {
    return geojsonData;
  }

  const isWgs84 = isGeojsonWgs84(geojsonData);
  const tolerance = isWgs84 ? 0.00005 : 20;
  return turf.simplify(geojsonData, {
    tolerance,
    highQuality: false,
    mutate: false,
  });
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

    const baseDir = path.join(process.cwd(), 'data_peta_profesional', category);
    const filePath = path.join(baseDir, `${filename}.geojson`);
    const resolvedBase = path.resolve(baseDir);
    const resolvedFile = path.resolve(filePath);

    if (!resolvedFile.startsWith(`${resolvedBase}${path.sep}`)) {
      throw errorFactory.validation('Invalid GeoJSON file path');
    }

    const stats = await getGeoJSONFileStats(filePath);
    const cacheKey = `${category}/${filename}:${stats.mtimeMs}:${stats.size}`;
    const cached = GEOJSON_RESPONSE_CACHE.get(cacheKey);
    if (cached) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', 'application/geo+json');
      return res.json(cached);
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'application/geo+json');

    const rawData = await fs.readFile(filePath, 'utf8');
    let geojsonData;
    try {
      geojsonData = JSON.parse(rawData);
    } catch (error) {
      throw errorFactory.validation('Invalid GeoJSON format');
    }

    const reprojectedGeojson = reprojectGeojsonToWgs84(geojsonData);
    const simplifiedGeojson = simplifyGeojson(reprojectedGeojson, stats);
    GEOJSON_RESPONSE_CACHE.set(cacheKey, simplifiedGeojson);
    return res.json(simplifiedGeojson);
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
  getSearchIndex: getSearchIndexController,
};
