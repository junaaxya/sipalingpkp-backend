const turf = require('@turf/turf');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const createPointGeometry = (longitude, latitude) => {
  const lng = toNumber(longitude);
  const lat = toNumber(latitude);

  if (lng === null || lat === null) {
    return null;
  }

  return {
    type: 'Point',
    coordinates: [lng, lat],
  };
};

const createPointFeature = ({ id, longitude, latitude, properties }) => {
  const geometry = createPointGeometry(longitude, latitude);
  if (!geometry) {
    return null;
  }

  return {
    type: 'Feature',
    id,
    geometry,
    properties: properties || {},
  };
};

const createFeatureCollection = (features, meta = {}) => ({
  type: 'FeatureCollection',
  features: features.filter(Boolean),
  ...meta,
});

const getRandomPointInFeature = (feature, maxAttempts = 25) => {
  if (!feature || !feature.geometry) {
    return null;
  }

  const bbox = turf.bbox(feature);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const point = turf.randomPoint(1, { bbox }).features[0];
    if (turf.booleanPointInPolygon(point, feature)) {
      return point.geometry.coordinates;
    }
  }

  const centroid = turf.centroid(feature);
  return centroid?.geometry?.coordinates || null;
};

module.exports = {
  toNumber,
  createPointGeometry,
  createPointFeature,
  createFeatureCollection,
  getRandomPointInFeature,
};
