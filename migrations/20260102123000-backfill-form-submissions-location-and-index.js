/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
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

    const indexes = await queryInterface.showIndex('form_submissions');
    const indexNames = new Set(indexes.map((index) => index.name));
    if (!indexNames.has('idx_form_submissions_village_status')) {
      await queryInterface.addIndex('form_submissions', ['village_id', 'status'], {
        name: 'idx_form_submissions_village_status',
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex('form_submissions');
    const indexNames = new Set(indexes.map((index) => index.name));
    if (indexNames.has('idx_form_submissions_village_status')) {
      await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_village_status');
    }
  },
};
