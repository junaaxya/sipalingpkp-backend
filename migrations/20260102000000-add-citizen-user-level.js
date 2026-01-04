/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY user_level ENUM('province', 'regency', 'district', 'village', 'citizen') NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY user_level ENUM('province', 'regency', 'district', 'village') NOT NULL;
    `);
  },
};
