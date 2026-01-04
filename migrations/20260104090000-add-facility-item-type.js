module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      'facility_commercial',
      'facility_public_services',
      'facility_education',
      'facility_health',
      'facility_religious',
      'facility_recreation',
      'facility_cemetery',
      'facility_green_space',
      'facility_parking',
    ];

    for (const table of tables) {
      const tableInfo = await queryInterface.describeTable(table);
      if (!tableInfo.type) {
        await queryInterface.addColumn(table, 'type', {
          type: Sequelize.STRING(80),
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface) {
    const tables = [
      'facility_commercial',
      'facility_public_services',
      'facility_education',
      'facility_health',
      'facility_religious',
      'facility_recreation',
      'facility_cemetery',
      'facility_green_space',
      'facility_parking',
    ];

    for (const table of tables) {
      const tableInfo = await queryInterface.describeTable(table);
      if (tableInfo.type) {
        await queryInterface.removeColumn(table, 'type');
      }
    }
  },
};
