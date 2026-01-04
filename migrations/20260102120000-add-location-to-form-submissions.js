/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('form_submissions', 'province_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'provinces',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('form_submissions', 'regency_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'regencies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('form_submissions', 'district_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'districts',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('form_submissions', 'village_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'villages',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('form_submissions', ['province_id'], {
      name: 'idx_form_submissions_province_id',
    });
    await queryInterface.addIndex('form_submissions', ['regency_id'], {
      name: 'idx_form_submissions_regency_id',
    });
    await queryInterface.addIndex('form_submissions', ['district_id'], {
      name: 'idx_form_submissions_district_id',
    });
    await queryInterface.addIndex('form_submissions', ['village_id'], {
      name: 'idx_form_submissions_village_id',
    });

    await queryInterface.sequelize.query(
      `
      UPDATE form_submissions AS fs
      LEFT JOIN household_owners AS ho
        ON fs.id = ho.form_submission_id
      SET
        fs.province_id = COALESCE(fs.province_id, ho.province_id),
        fs.regency_id = COALESCE(fs.regency_id, ho.regency_id),
        fs.district_id = COALESCE(fs.district_id, ho.district_id),
        fs.village_id = COALESCE(fs.village_id, ho.village_id)
      WHERE ho.id IS NOT NULL;
      `,
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_village_id');
    await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_district_id');
    await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_regency_id');
    await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_province_id');

    await queryInterface.removeColumn('form_submissions', 'village_id');
    await queryInterface.removeColumn('form_submissions', 'district_id');
    await queryInterface.removeColumn('form_submissions', 'regency_id');
    await queryInterface.removeColumn('form_submissions', 'province_id');
  },
};
