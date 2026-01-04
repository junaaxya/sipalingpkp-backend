/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
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

    await queryInterface.addIndex('form_submissions', ['village_id', 'status'], {
      name: 'idx_form_submissions_village_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('form_submissions', 'idx_form_submissions_village_status');
  },
};
