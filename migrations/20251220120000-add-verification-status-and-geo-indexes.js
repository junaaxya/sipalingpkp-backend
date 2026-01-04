/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'verification_status', {
      type: Sequelize.ENUM('Pending', 'Verified', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending',
    });

    await queryInterface.addColumn('housing_developments', 'verification_status', {
      type: Sequelize.ENUM('Pending', 'Verified', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending',
    });

    await queryInterface.addColumn('facility_surveys', 'verification_status', {
      type: Sequelize.ENUM('Pending', 'Verified', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending',
    });

    await queryInterface.addIndex('form_submissions', ['verification_status'], {
      name: 'idx_form_submissions_verification_status',
    });
    await queryInterface.addIndex('housing_developments', ['verification_status'], {
      name: 'idx_housing_developments_verification_status',
    });
    await queryInterface.addIndex('facility_surveys', ['verification_status'], {
      name: 'idx_facility_surveys_verification_status',
    });

    await queryInterface.addIndex('housing_developments', ['latitude', 'longitude'], {
      name: 'idx_housing_developments_coordinates',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('housing_developments', 'idx_housing_developments_coordinates');
    await queryInterface.removeIndex('facility_surveys', 'idx_facility_surveys_verification_status');
    await queryInterface.removeIndex('housing_developments', 'idx_housing_developments_verification_status');
    await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_verification_status');

    await queryInterface.removeColumn('facility_surveys', 'verification_status');
    await queryInterface.removeColumn('housing_developments', 'verification_status');
    await queryInterface.removeColumn('form_submissions', 'verification_status');
  },
};
