const fs = require('fs/promises');
const path = require('path');

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

const findEntry = (lookup, { type, name, parentParts }) => {
  if (!type || !name) {
    return null;
  }
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

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis');

    const searchIndexPath = path.join(process.cwd(), 'data_peta_profesional', 'search_index.json');
    let raw;
    try {
      raw = await fs.readFile(searchIndexPath, 'utf8');
    } catch (error) {
      console.warn('Search index not found for facility backfill:', error.message);
      return;
    }

    let entries;
    try {
      entries = JSON.parse(raw);
    } catch (error) {
      console.warn('Search index invalid for facility backfill:', error.message);
      return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return;
    }

    const lookup = buildLookup(entries);
    const rows = await queryInterface.sequelize.query(
      `SELECT fs.id,
              fs.latitude,
              fs.longitude,
              v.name AS village_name,
              d.name AS district_name,
              r.name AS regency_name,
              p.name AS province_name
       FROM facility_surveys fs
       LEFT JOIN villages v ON fs.village_id = v.id
       LEFT JOIN districts d ON fs.district_id = d.id
       LEFT JOIN regencies r ON fs.regency_id = r.id
       LEFT JOIN provinces p ON fs.province_id = p.id`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    for (const row of rows) {
      const lat = Number(row.latitude);
      const lng = Number(row.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        continue;
      }

      let entry = null;
      if (row.village_name) {
        entry = findEntry(lookup, {
          type: 'Desa',
          name: row.village_name,
          parentParts: {
            district: row.district_name,
            regency: row.regency_name,
          },
        });
      }
      if (!entry && row.district_name) {
        entry = findEntry(lookup, {
          type: 'Kecamatan',
          name: row.district_name,
          parentParts: { regency: row.regency_name },
        });
      }
      if (!entry && row.regency_name) {
        entry = findEntry(lookup, {
          type: 'Kabupaten',
          name: row.regency_name,
          parentParts: { province: row.province_name },
        });
      }

      if (!entry || !Array.isArray(entry.coords) || entry.coords.length < 2) {
        continue;
      }

      const nextLat = Number(entry.coords[0]);
      const nextLng = Number(entry.coords[1]);
      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
        continue;
      }

      await queryInterface.sequelize.query(
        `UPDATE facility_surveys
         SET latitude = :latitude,
             longitude = :longitude,
             geom = CASE
               WHEN geom IS NULL THEN ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)
               ELSE geom
             END
         WHERE id = :id`,
        {
          replacements: {
            id: row.id,
            latitude: nextLat,
            longitude: nextLng,
          },
        },
      );
    }
  },

  async down() {
    // No-op: data backfill is not reversible.
  },
};
