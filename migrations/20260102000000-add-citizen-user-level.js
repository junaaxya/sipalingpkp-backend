/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_users_user_level'
              AND e.enumlabel = 'citizen'
          ) THEN
            ALTER TYPE "enum_users_user_level" ADD VALUE 'citizen';
          END IF;
        END $$;
      `);
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY user_level ENUM('province', 'regency', 'district', 'village', 'citizen') NOT NULL;
    `);
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        UPDATE users
        SET user_level = 'village'
        WHERE user_level = 'citizen';
      `);
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          ALTER TYPE "enum_users_user_level" RENAME TO "enum_users_user_level_old";
          CREATE TYPE "enum_users_user_level" AS ENUM (
            'province', 'regency', 'district', 'village'
          );
          ALTER TABLE "users"
            ALTER COLUMN "user_level" TYPE "enum_users_user_level"
            USING "user_level"::text::"enum_users_user_level";
          DROP TYPE "enum_users_user_level_old";
        END $$;
      `);
      return;
    }

    await queryInterface.sequelize.query(`
      ALTER TABLE users
      MODIFY user_level ENUM('province', 'regency', 'district', 'village') NOT NULL;
    `);
  },
};
