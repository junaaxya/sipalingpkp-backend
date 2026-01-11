/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS postgis');

    const tableName = 'spatial_layers';
    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set(indexes.map((index) => index.name));

    if (!indexNames.has('idx_spatial_layers_geom')) {
      await queryInterface.addIndex(tableName, {
        fields: ['geom'],
        using: 'gist',
        name: 'idx_spatial_layers_geom',
      });
    }

    if (!indexNames.has('idx_spatial_layers_category_layer')) {
      await queryInterface.addIndex(tableName, {
        fields: ['category', 'layer_name'],
        name: 'idx_spatial_layers_category_layer',
      });
    }
  },

  async down(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    const tableName = 'spatial_layers';
    const indexes = await queryInterface.showIndex(tableName);
    const indexNames = new Set(indexes.map((index) => index.name));

    if (indexNames.has('idx_spatial_layers_category_layer')) {
      await queryInterface.removeIndex(tableName, 'idx_spatial_layers_category_layer');
    }
    if (indexNames.has('idx_spatial_layers_geom')) {
      await queryInterface.removeIndex(tableName, 'idx_spatial_layers_geom');
    }
  },
};
