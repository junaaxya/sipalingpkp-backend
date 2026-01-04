/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('household_owners', 'house_number', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS count
       FROM household_owners
       WHERE house_number IS NOT NULL
         AND CHAR_LENGTH(house_number) > 20`,
    );
    const count = rows?.[0]?.count || 0;
    if (Number(count) > 0) {
      throw new Error('Rollback dibatalkan: ada house_number yang lebih dari 20 karakter.');
    }

    await queryInterface.changeColumn('household_owners', 'house_number', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },
};
