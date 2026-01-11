/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('form_submissions');

    if (!tableDefinition.province_id) {
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
    }

    if (!tableDefinition.regency_id) {
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
    }

    if (!tableDefinition.district_id) {
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
    }

    if (!tableDefinition.village_id) {
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
    }

    const indexes = await queryInterface.showIndex('form_submissions');
    const indexNames = new Set(indexes.map((index) => index.name));

    if (!indexNames.has('idx_form_submissions_province_id')) {
      await queryInterface.addIndex('form_submissions', ['province_id'], {
        name: 'idx_form_submissions_province_id',
      });
    }
    if (!indexNames.has('idx_form_submissions_regency_id')) {
      await queryInterface.addIndex('form_submissions', ['regency_id'], {
        name: 'idx_form_submissions_regency_id',
      });
    }
    if (!indexNames.has('idx_form_submissions_district_id')) {
      await queryInterface.addIndex('form_submissions', ['district_id'], {
        name: 'idx_form_submissions_district_id',
      });
    }
    if (!indexNames.has('idx_form_submissions_village_id')) {
      await queryInterface.addIndex('form_submissions', ['village_id'], {
        name: 'idx_form_submissions_village_id',
      });
    }

    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        UPDATE form_submissions AS fs
        SET
          province_id = COALESCE(fs.province_id, ho.province_id),
          regency_id = COALESCE(fs.regency_id, ho.regency_id),
          district_id = COALESCE(fs.district_id, ho.district_id),
          village_id = COALESCE(fs.village_id, ho.village_id)
        FROM household_owners AS ho
        WHERE fs.id = ho.form_submission_id;
      `);
    } else {
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
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('form_submissions');
    const indexNames = new Set(indexes.map((index) => index.name));

    if (indexNames.has('idx_form_submissions_village_id')) {
      await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_village_id');
    }
    if (indexNames.has('idx_form_submissions_district_id')) {
      await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_district_id');
    }
    if (indexNames.has('idx_form_submissions_regency_id')) {
      await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_regency_id');
    }
    if (indexNames.has('idx_form_submissions_province_id')) {
      await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_province_id');
    }

    const tableDefinition = await queryInterface.describeTable('form_submissions');
    if (tableDefinition.village_id) {
      await queryInterface.removeColumn('form_submissions', 'village_id');
    }
    if (tableDefinition.district_id) {
      await queryInterface.removeColumn('form_submissions', 'district_id');
    }
    if (tableDefinition.regency_id) {
      await queryInterface.removeColumn('form_submissions', 'regency_id');
    }
    if (tableDefinition.province_id) {
      await queryInterface.removeColumn('form_submissions', 'province_id');
    }
  },
};
