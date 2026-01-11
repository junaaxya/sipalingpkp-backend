/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis');

    const ensureGeom = async (tableName, indexName) => {
      const columns = await queryInterface.describeTable(tableName);
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

      const indexes = await queryInterface.showIndex(tableName);
      const indexNames = new Set(indexes.map((index) => index.name));
      if (!indexNames.has(indexName)) {
        await queryInterface.addIndex(tableName, {
          fields: ['geom'],
          using: 'gist',
          name: indexName,
        });
      }
    };

    await ensureGeom('household_owners', 'idx_household_owners_geom');
    await ensureGeom('housing_developments', 'idx_housing_developments_geom');
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    const dropGeom = async (tableName, indexName) => {
      const indexes = await queryInterface.showIndex(tableName);
      const indexNames = new Set(indexes.map((index) => index.name));
      if (indexNames.has(indexName)) {
        await queryInterface.removeIndex(tableName, indexName);
      }

      const columns = await queryInterface.describeTable(tableName);
      if (columns.geom) {
        await queryInterface.removeColumn(tableName, 'geom');
      }
    };

    await dropGeom('housing_developments', 'idx_housing_developments_geom');
    await dropGeom('household_owners', 'idx_household_owners_geom');
  },
};
