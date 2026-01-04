/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('form_submissions', 'status', {
      type: Sequelize.ENUM('draft', 'submitted', 'under_review', 'reviewed', 'approved', 'rejected', 'history'),
      allowNull: false,
      defaultValue: 'draft',
    });
  },

  async down(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT COUNT(*) AS count FROM form_submissions WHERE status = 'history';",
    );
    const count = rows?.[0]?.count ? Number(rows[0].count) : 0;
    if (count > 0) {
      throw new Error('Cannot downgrade status enum while history records exist.');
    }

    await queryInterface.changeColumn('form_submissions', 'status', {
      type: Sequelize.ENUM('draft', 'submitted', 'under_review', 'reviewed', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'draft',
    });
  },
};
