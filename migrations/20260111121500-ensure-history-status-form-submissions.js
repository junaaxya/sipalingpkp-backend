/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_form_submissions_status'
            AND e.enumlabel = 'history'
        ) THEN
          ALTER TYPE "enum_form_submissions_status" ADD VALUE 'history';
        END IF;
      END $$;
    `);
  },

  async down() {
    // No-op: PostgreSQL enums cannot easily remove values without re-creating the type.
  },
};
