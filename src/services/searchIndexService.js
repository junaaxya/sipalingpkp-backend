const path = require('path');
const fs = require('fs/promises');

const SEARCH_INDEX_PATH = path.join(process.cwd(), 'data_peta_profesional', 'search_index.json');
let searchIndexCache = null;
let searchIndexPromise = null;

const normalizeText = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');

const buildParentLabel = (type, parentParts) => {
  if (type === 'Desa') {
    const district = parentParts.district ? normalizeText(parentParts.district) : '';
    const regency = parentParts.regency ? normalizeText(parentParts.regency) : '';
    if (district && regency) {
      return `KEC. ${district}, ${regency}`;
    }
    if (district) {
      return `KEC. ${district}`;
    }
  }

  if (type === 'Kecamatan') {
    return parentParts.regency ? normalizeText(parentParts.regency) : '';
  }

  if (type === 'Kabupaten') {
    return parentParts.province
      ? `PROVINSI ${normalizeText(parentParts.province)}`
      : '';
  }

  return '';
};

const loadSearchIndex = async () => {
  if (searchIndexCache) {
    return searchIndexCache;
  }

  if (searchIndexPromise) {
    return searchIndexPromise;
  }

  searchIndexPromise = fs.readFile(SEARCH_INDEX_PATH, 'utf8')
    .then((raw) => {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Search index data is invalid');
      }
      searchIndexCache = parsed;
      return parsed;
    })
    .finally(() => {
      searchIndexPromise = null;
    });

  return searchIndexPromise;
};

const buildLookup = (entries) => {
  const byKey = new Map();
  const byTypeName = new Map();

  entries.forEach((entry) => {
    const type = normalizeText(entry.type);
    const name = normalizeText(entry.name);
    const parent = normalizeText(entry.parent);
    const key = `${type}|${name}|${parent}`;
    byKey.set(key, entry);

    const looseKey = `${type}|${name}`;
    if (!byTypeName.has(looseKey)) {
      byTypeName.set(looseKey, entry);
    }
  });

  return { byKey, byTypeName };
};

const findSearchIndexEntry = async ({ type, name, parentParts = {} }) => {
  if (!type || !name) {
    return null;
  }

  const entries = await loadSearchIndex();
  const lookup = buildLookup(entries);
  const normalizedType = normalizeText(type);
  const normalizedName = normalizeText(name);
  const parentLabel = buildParentLabel(type, parentParts);

  if (parentLabel) {
    const key = `${normalizedType}|${normalizedName}|${normalizeText(parentLabel)}`;
    const found = lookup.byKey.get(key);
    if (found) {
      return found;
    }
  }

  const looseKey = `${normalizedType}|${normalizedName}`;
  return lookup.byTypeName.get(looseKey) || null;
};

module.exports = {
  loadSearchIndex,
  findSearchIndexEntry,
};
