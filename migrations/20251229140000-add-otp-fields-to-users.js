module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'phone_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'email_verified',
    });

    await queryInterface.addColumn('users', 'otp_code', {
      type: Sequelize.STRING(6),
      allowNull: true,
      after: 'phone_verified',
    });

    await queryInterface.addColumn('users', 'otp_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
      after: 'otp_code',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'otp_expires_at');
    await queryInterface.removeColumn('users', 'otp_code');
    await queryInterface.removeColumn('users', 'phone_verified');
  },
};
