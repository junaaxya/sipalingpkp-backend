const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { createPointFeature, createFeatureCollection } = require('../utils/geojsonUtils');
const { errorFactory } = require('../errors/errorUtils');
const { findSearchIndexEntry } = require('./searchIndexService');

const normalizeVerificationStatus = (value) => {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  if (normalized === 'verified') return 'Verified';
  if (normalized === 'approved') return 'Verified';
  if (normalized === 'rejected') return 'Rejected';
  if (normalized === 'pending') return 'Pending';
  return value;
};

const deriveVerificationStatus = ({ status, verificationStatus }) => {
  if (verificationStatus) {
    return normalizeVerificationStatus(verificationStatus);
  }
  return normalizeVerificationStatus(status) || 'Pending';
};

const isVerifiedEntry = ({ status, verificationStatus }) => {
  const normalized = String(verificationStatus || status || '').toLowerCase();
  return normalized === 'verified' || normalized === 'approved';
};

const isApprovedEntry = ({ status, verificationStatus }) => {
  const normalized = String(verificationStatus || status || '').toLowerCase();
  return normalized === 'approved' || normalized === 'verified';
};

const buildBaseProperties = ({ id, name, category, status, verificationStatus }) => ({
  id,
  name,
  category,
  status_verification: deriveVerificationStatus({ status, verificationStatus }),
});

const normalizeLivableFlag = (value) => {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'ya', 'layak', 'layak huni'].includes(normalized)) return true;
    if (['false', '0', 'tidak', 'tidak layak', 'tidak layak huni', 'rtlh', 'non layak'].includes(normalized)) {
      return false;
    }
  }

  return null;
};

const buildHousingFeature = (submission) => {
  const owner = submission.householdOwner || {};
  const baseProperties = buildBaseProperties({
    id: submission.id,
    name: owner.ownerName || 'Rumah Masyarakat',
    category: 'housing',
    status: submission.status,
    verificationStatus: submission.verificationStatus,
  });
  const properties = {
    ...baseProperties,
    id: submission.id,
    status: submission.status,
    verificationStatus: submission.verificationStatus,
    submittedAt: submission.submittedAt,
    isLivable: normalizeLivableFlag(submission.isLivable ?? submission.houseData?.isLivable),
    ownerName: owner.ownerName || null,
    address: owner.houseNumber || null,
    rt: owner.rt || null,
    rw: owner.rw || null,
    village: owner.village?.name || null,
    district: owner.district?.name || null,
    regency: owner.regency?.name || null,
    province: owner.province?.name || null,
  };

  return createPointFeature({
    id: submission.id,
    longitude: owner.longitude,
    latitude: owner.latitude,
    properties,
  });
};

const buildHousingDevelopmentsFeature = (development) => {
  const baseProperties = buildBaseProperties({
    id: development.id,
    name: development.developmentName || 'Perumahan',
    category: 'housing-development',
    status: development.status,
    verificationStatus: development.verificationStatus,
  });
  const properties = {
    ...baseProperties,
    id: development.id,
    developmentName: development.developmentName,
    developerName: development.developerName,
    housingType: development.housingType,
    plannedUnitCount: development.plannedUnitCount,
    landArea: development.landArea,
    status: development.status,
    verificationStatus: development.verificationStatus,
    village: development.village?.name || null,
    district: development.district?.name || null,
    regency: development.regency?.name || null,
    province: development.province?.name || null,
  };

  return createPointFeature({
    id: development.id,
    longitude: development.longitude,
    latitude: development.latitude,
    properties,
  });
};

const resolveFacilityCoordinates = (survey = {}) => {
  const latValue = survey.latitude ?? survey.lat;
  const lngValue = survey.longitude ?? survey.lng ?? survey.lon;
  const latitude = Number(latValue);
  const longitude = Number(lngValue);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  const geom = survey.geom || survey.get?.('geom');
  if (geom && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [geomLng, geomLat] = geom.coordinates;
    const parsedLat = Number(geomLat);
    const parsedLng = Number(geomLng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      return { latitude: parsedLat, longitude: parsedLng };
    }
  }

  return null;
};

const buildFacilityFeature = async (survey) => {
  const villageName = survey.village?.name || null;
  const districtName = survey.district?.name || null;
  const regencyName = survey.regency?.name || null;
  const provinceName = survey.province?.name || null;
  const name = villageName || districtName || regencyName || 'Infrastruktur Desa';

  const baseProperties = buildBaseProperties({
    id: survey.id,
    name,
    category: 'infrastruktur',
    status: survey.status,
    verificationStatus: survey.verificationStatus,
  });
  const properties = {
    ...baseProperties,
    id: survey.id,
    status: survey.status,
    verificationStatus: survey.verificationStatus,
    surveyYear: survey.surveyYear,
    surveyPeriod: survey.surveyPeriod,
    village: villageName,
    district: districtName,
    regency: regencyName,
    province: provinceName,
  };

  const directCoordinates = resolveFacilityCoordinates(survey);
  if (directCoordinates) {
    return createPointFeature({
      id: survey.id,
      longitude: directCoordinates.longitude,
      latitude: directCoordinates.latitude,
      properties,
    });
  }

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

  return createPointFeature({
    id: survey.id,
    longitude: searchEntry.coords[1],
    latitude: searchEntry.coords[0],
    properties,
  });
};

const housingToGeoJSON = (submissions) => {
  const features = submissions
    .filter((submission) => isVerifiedEntry(submission))
    .map(buildHousingFeature)
    .filter(Boolean);
  return createFeatureCollection(features, { source: 'housing' });
};

const housingDevelopmentsToGeoJSON = (developments) => {
  const features = developments
    .filter((development) => isApprovedEntry(development))
    .map(buildHousingDevelopmentsFeature)
    .filter(Boolean);
  return createFeatureCollection(features, { source: 'housing-development' });
};

const facilitiesToGeoJSON = async (surveys) => {
  const verifiedSurveys = surveys.filter((survey) => isVerifiedEntry(survey));
  const features = await Promise.all(verifiedSurveys.map(buildFacilityFeature));
  return createFeatureCollection(features.filter(Boolean), { source: 'facility' });
};

const parseJsonValue = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const buildSpatialFilter = ({ bbox, point }) => {
  if (bbox) {
    const {
      minLng, minLat, maxLng, maxLat,
    } = bbox;
    const values = [minLng, minLat, maxLng, maxLat];
    const isValid = values.every((value) => Number.isFinite(value));
    if (!isValid) {
      throw errorFactory.validation('Invalid bbox coordinates');
    }
    if (minLng >= maxLng || minLat >= maxLat) {
      throw errorFactory.validation('Invalid bbox range');
    }

    return {
      clause: `AND ST_Intersects(
        geom,
        ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)
      )`,
      replacements: {
        minLng,
        minLat,
        maxLng,
        maxLat,
      },
    };
  }

  if (point) {
    const { latitude, longitude } = point;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw errorFactory.validation('Invalid coordinates');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw errorFactory.validation('Invalid coordinates');
    }

    return {
      clause: `AND ST_Intersects(
        geom,
        ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
      )`,
      replacements: {
        latitude,
        longitude,
      },
    };
  }

  return { clause: '', replacements: {} };
};

const getSpatialLayerGeoJSON = async ({
  category,
  layerName,
  bbox,
  point,
}) => {
  if (!category || !layerName) {
    throw errorFactory.validation('Category and layer name are required');
  }

  const filter = buildSpatialFilter({ bbox, point });
  const rows = await sequelize.query(
    `SELECT id, properties, ST_AsGeoJSON(geom) AS geometry
     FROM spatial_layers
     WHERE category = :category
       AND layer_name = :layerName
       ${filter.clause}`,
    {
      replacements: {
        category,
        layerName,
        ...filter.replacements,
      },
      type: QueryTypes.SELECT,
    },
  );

  const features = rows
    .map((row) => {
      const geometry = parseJsonValue(row.geometry);
      if (!geometry) {
        return null;
      }
      const properties = parseJsonValue(row.properties) || {};
      return {
        type: 'Feature',
        id: row.id,
        geometry,
        properties,
      };
    })
    .filter(Boolean);

  return createFeatureCollection(features, {
    source: 'spatial-layer',
    category,
    layerName,
  });
};

const getSpatialFeatureById = async ({ id }) => {
  if (!id) {
    throw errorFactory.validation('Spatial feature id is required');
  }

  const rows = await sequelize.query(
    `SELECT id, category, layer_name, properties, ST_AsGeoJSON(geom) AS geometry
     FROM spatial_layers
     WHERE id = :id
     LIMIT 1`,
    {
      replacements: { id },
      type: QueryTypes.SELECT,
    },
  );

  const row = rows[0];
  if (!row) {
    throw errorFactory.notFound('Spatial feature');
  }

  const geometry = parseJsonValue(row.geometry);
  if (!geometry) {
    throw errorFactory.notFound('Spatial feature geometry');
  }

  const properties = parseJsonValue(row.properties) || {};
  return {
    type: 'Feature',
    id: row.id,
    geometry,
    properties: {
      ...properties,
      id: row.id,
      category: row.category,
      layer_name: row.layer_name,
    },
  };
};

module.exports = {
  housingToGeoJSON,
  housingDevelopmentsToGeoJSON,
  facilitiesToGeoJSON,
  getSpatialLayerGeoJSON,
  getSpatialFeatureById,
};
