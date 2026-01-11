/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis');

    const villageMatch = `
      UPPER(COALESCE(sl.properties->>'DESA', sl.properties->>'KELURAHAN', sl.properties->>'NAMOBJ', sl.properties->>'WADMKD', sl.properties->>'VILLAGE')) = UPPER(v.name)
      AND UPPER(COALESCE(sl.properties->>'KECAMATAN', sl.properties->>'WADMKC', sl.properties->>'DISTRICT')) = UPPER(d.name)
      AND UPPER(COALESCE(sl.properties->>'KAB_KOTA', sl.properties->>'KABUPATEN', sl.properties->>'WADMKK', sl.properties->>'REGENCY')) = UPPER(r.name)
    `;

    const districtMatch = `
      UPPER(COALESCE(sl.properties->>'KECAMATAN', sl.properties->>'WADMKC', sl.properties->>'DISTRICT')) = UPPER(d.name)
      AND UPPER(COALESCE(sl.properties->>'KAB_KOTA', sl.properties->>'KABUPATEN', sl.properties->>'WADMKK', sl.properties->>'REGENCY')) = UPPER(r.name)
    `;

    const regencyMatch = `
      UPPER(COALESCE(sl.properties->>'KAB_KOTA', sl.properties->>'KABUPATEN', sl.properties->>'WADMKK', sl.properties->>'REGENCY')) = UPPER(r.name)
    `;

    await queryInterface.sequelize.query(`
      UPDATE facility_surveys fs
      SET geom = ST_PointOnSurface(sl.geom),
          latitude = ST_Y(ST_PointOnSurface(sl.geom)),
          longitude = ST_X(ST_PointOnSurface(sl.geom))
      FROM villages v
      JOIN districts d ON v.district_id = d.id
      JOIN regencies r ON d.regency_id = r.id
      JOIN spatial_layers sl
        ON sl.category = 'administrasi'
       AND sl.layer_name = 'batas_desa'
      WHERE fs.village_id = v.id
        AND fs.geom IS NULL
        AND fs.latitude IS NULL
        AND fs.longitude IS NULL
        AND ${villageMatch};
    `);

    await queryInterface.sequelize.query(`
      UPDATE facility_surveys fs
      SET geom = ST_PointOnSurface(sl.geom),
          latitude = ST_Y(ST_PointOnSurface(sl.geom)),
          longitude = ST_X(ST_PointOnSurface(sl.geom))
      FROM districts d
      JOIN regencies r ON d.regency_id = r.id
      JOIN spatial_layers sl
        ON sl.category = 'administrasi'
       AND sl.layer_name = 'batas_kecamatan'
      WHERE fs.village_id IS NULL
        AND fs.district_id = d.id
        AND fs.geom IS NULL
        AND fs.latitude IS NULL
        AND fs.longitude IS NULL
        AND ${districtMatch};
    `);

    await queryInterface.sequelize.query(`
      UPDATE facility_surveys fs
      SET geom = ST_PointOnSurface(sl.geom),
          latitude = ST_Y(ST_PointOnSurface(sl.geom)),
          longitude = ST_X(ST_PointOnSurface(sl.geom))
      FROM regencies r
      JOIN spatial_layers sl
        ON sl.category = 'administrasi'
       AND sl.layer_name = 'batas_kabupaten'
      WHERE fs.village_id IS NULL
        AND fs.district_id IS NULL
        AND fs.regency_id = r.id
        AND fs.geom IS NULL
        AND fs.latitude IS NULL
        AND fs.longitude IS NULL
        AND ${regencyMatch};
    `);
  },

  async down() {
    // No-op: data backfill is not reversible.
  },
};
