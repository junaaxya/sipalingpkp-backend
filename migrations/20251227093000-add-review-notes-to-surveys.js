'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('facility_surveys', 'review_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'verified_at',
    });

    await queryInterface.addColumn('housing_developments', 'review_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'verified_by',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('housing_developments', 'review_notes');
    await queryInterface.removeColumn('facility_surveys', 'review_notes');
  },
};
