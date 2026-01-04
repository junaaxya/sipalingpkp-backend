/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('household_owners', 'latitude', {
      type: Sequelize.DECIMAL(10, 8),
      allowNull: true,
      comment: 'Latitude coordinate of the house location',
    });

    await queryInterface.addColumn('household_owners', 'longitude', {
      type: Sequelize.DECIMAL(11, 8),
      allowNull: true,
      comment: 'Longitude coordinate of the house location',
    });

    // Add index for spatial queries (optional, but can help with location-based searches)
    await queryInterface.addIndex('household_owners', ['latitude', 'longitude'], {
      name: 'idx_household_owners_coordinates',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('household_owners', 'idx_household_owners_coordinates');
    await queryInterface.removeColumn('household_owners', 'longitude');
    await queryInterface.removeColumn('household_owners', 'latitude');
  },
};

