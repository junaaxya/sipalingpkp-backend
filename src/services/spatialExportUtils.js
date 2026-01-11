const { sequelize } = require('../models');
const { errorFactory } = require('../errors/errorUtils');

const ALLOWED_GIS_CATEGORIES = new Set([
  'administrasi',
  'tata_ruang',
  'bencana',
  'infrastruktur',
]);

const SAFE_LAYER_REGEX = /^[a-zA-Z0-9_-]+$/;

const normalizeLayerValue = (value) => String(value || '').trim();

const normalizeCategory = (value) => String(value || '').trim().toLowerCase();

const toTitleCase = (value) => String(value || '')
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatLayerLabel = (value) => toTitleCase(
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim(),
);

const parseLayerTokens = (raw) => {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => String(entry || '').split(','));
  }
  return String(raw).split(',');
};

const parseGisLayerFilters = (options = {}) => {
  const rawLayers = options.gisLayers || options.gisLayerIds || options.gisLayerId;
  const rawCategory = options.gisCategory || options.gisLayerCategory;
  const categoryFallback = normalizeCategory(rawCategory);
  const entries = [];
  const invalidEntries = [];

  const pushEntry = (categoryValue, layerValue) => {
    const category = normalizeCategory(categoryValue);
    const layerName = normalizeLayerValue(layerValue);
    if (!category || !layerName) {
      return;
    }
    if (!ALLOWED_GIS_CATEGORIES.has(category)) {
      invalidEntries.push(`${category}:${layerName}`);
      return;
    }
    if (!SAFE_LAYER_REGEX.test(layerName)) {
      invalidEntries.push(`${category}:${layerName}`);
      return;
    }
    entries.push({ category, layerName });
  };

  parseLayerTokens(rawLayers).forEach((token) => {
    const normalized = normalizeLayerValue(token);
    if (!normalized) {
      return;
    }
    if (normalized.includes(':')) {
      const [categoryValue, layerValue] = normalized.split(':');
      pushEntry(categoryValue, layerValue);
      return;
    }
    if (categoryFallback) {
      pushEntry(categoryFallback, normalized);
      return;
    }
    invalidEntries.push(normalized);
  });

  const unique = [];
  const seen = new Set();
  entries.forEach((entry) => {
    const key = `${entry.category}:${entry.layerName}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(entry);
  });

  if (rawLayers && unique.length === 0 && invalidEntries.length > 0) {
    throw errorFactory.validation('Invalid GIS layer filter.');
  }

  return unique;
};

const buildSpatialLayerWhereSql = (filters, alias = '') => {
  if (!filters || !filters.length) {
    return null;
  }
  const prefix = alias ? `${alias}.` : '';
  const clauses = filters.map(
    (filter) =>
      `(${prefix}category = ${sequelize.escape(filter.category)} AND ${prefix}layer_name = ${sequelize.escape(filter.layerName)})`,
  );
  return `(${clauses.join(' OR ')})`;
};

const buildSpatialUnionSql = (filters) => {
  const whereSql = buildSpatialLayerWhereSql(filters);
  if (!whereSql) {
    return null;
  }
  return `SELECT ST_UnaryUnion(ST_Collect(geom)) AS geom FROM spatial_layers WHERE ${whereSql}`;
};

const buildSpatialLayerIntersectsSql = (filters, geometryExpression) => {
  const whereSql = buildSpatialLayerWhereSql(filters);
  if (!whereSql || !geometryExpression) {
    return null;
  }
  return `EXISTS (
    SELECT 1
    FROM spatial_layers sl
    WHERE ${whereSql}
      AND sl.geom IS NOT NULL
      AND ST_Intersects(${geometryExpression}, sl.geom)
  )`;
};

const buildSpatialIntersectsSql = (filters, geometryExpression) => {
  const unionSql = buildSpatialUnionSql(filters);
  if (!unionSql || !geometryExpression) {
    return null;
  }
  return `EXISTS (
    SELECT 1
    FROM (${unionSql}) AS filter_geom
    WHERE filter_geom.geom IS NOT NULL
      AND ST_Intersects(${geometryExpression}, filter_geom.geom)
  )`;
};

const formatGisLayerLabel = (filters, options = {}) => {
  if (!filters || filters.length === 0) {
    return '';
  }
  const includeCategory = options.includeCategory !== false;
  return filters
    .map((filter) => {
      const layerLabel = formatLayerLabel(filter.layerName);
      if (!includeCategory) {
        return layerLabel;
      }
      const categoryLabel = formatLayerLabel(filter.category);
      return `${categoryLabel} - ${layerLabel}`;
    })
    .filter(Boolean)
    .join(', ');
};

module.exports = {
  parseGisLayerFilters,
  buildSpatialIntersectsSql,
  buildSpatialLayerIntersectsSql,
  buildSpatialUnionSql,
  buildSpatialLayerWhereSql,
  formatGisLayerLabel,
};
