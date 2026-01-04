module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE form_submissions MODIFY status ENUM('draft','submitted','under_review','reviewed','approved','rejected') NOT NULL DEFAULT 'draft';"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE housing_developments MODIFY status ENUM('draft','submitted','under_review','verified','approved','rejected') NOT NULL DEFAULT 'draft';"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE form_submissions MODIFY status ENUM('draft','submitted','reviewed','approved','rejected') NOT NULL DEFAULT 'draft';"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE housing_developments MODIFY status ENUM('draft','submitted','verified','approved') NOT NULL DEFAULT 'draft';"
    );
  },
};
