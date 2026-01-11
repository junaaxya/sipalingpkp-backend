/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'facility_surveys';
    const dialect = queryInterface.sequelize.getDialect();
    const columns = await queryInterface.describeTable(tableName);

    if (!columns.latitude) {
      await queryInterface.addColumn(tableName, 'latitude', {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'GPS latitude',
      });
    }

    if (!columns.longitude) {
      await queryInterface.addColumn(tableName, 'longitude', {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'GPS longitude',
      });
    }

    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set(indexes.map((index) => index.name));
    if (!indexNames.has('idx_facility_surveys_coordinates')) {
      await queryInterface.addIndex(tableName, ['latitude', 'longitude'], {
        name: 'idx_facility_surveys_coordinates',
      });
    }

    if (dialect !== 'postgres') {
      return;
    }

    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis');

    if (!columns.geom) {
      await queryInterface.addColumn(tableName, 'geom', {
        type: Sequelize.GEOMETRY('POINT', 4326),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE ${tableName}
      SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
      WHERE geom IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL;
    `);

    if (!indexNames.has('idx_facility_surveys_geom')) {
      await queryInterface.addIndex(tableName, {
        fields: ['geom'],
        using: 'gist',
        name: 'idx_facility_surveys_geom',
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'facility_surveys';
    const dialect = queryInterface.sequelize.getDialect();
    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set(indexes.map((index) => index.name));

    if (indexNames.has('idx_facility_surveys_geom')) {
      await queryInterface.removeIndex(tableName, 'idx_facility_surveys_geom');
    }
    if (indexNames.has('idx_facility_surveys_coordinates')) {
      await queryInterface.removeIndex(tableName, 'idx_facility_surveys_coordinates');
    }

    if (dialect === 'postgres') {
      const columns = await queryInterface.describeTable(tableName);
      if (columns.geom) {
        await queryInterface.removeColumn(tableName, 'geom');
      }
    }

    const columns = await queryInterface.describeTable(tableName);
    if (columns.longitude) {
      await queryInterface.removeColumn(tableName, 'longitude');
    }
    if (columns.latitude) {
      await queryInterface.removeColumn(tableName, 'latitude');
    }
  },
};
