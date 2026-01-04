/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('form_submissions')

    if (table.isLivable && !table.is_livable) {
      await queryInterface.renameColumn('form_submissions', 'isLivable', 'is_livable')
      return
    }

    if (!table.is_livable) {
      await queryInterface.addColumn('form_submissions', 'is_livable', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('form_submissions')

    if (table.is_livable && !table.isLivable) {
      await queryInterface.renameColumn('form_submissions', 'is_livable', 'isLivable')
      return
    }

    if (table.is_livable) {
      await queryInterface.removeColumn('form_submissions', 'is_livable')
    }
  }
}
