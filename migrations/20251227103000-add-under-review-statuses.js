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
            WHERE t.typname = 'enum_form_submissions_status'
              AND e.enumlabel = 'under_review'
          ) THEN
            ALTER TYPE "enum_form_submissions_status" ADD VALUE 'under_review';
          END IF;
        END $$;
      `);

      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_housing_developments_status'
              AND e.enumlabel = 'under_review'
          ) THEN
            ALTER TYPE "enum_housing_developments_status" ADD VALUE 'under_review';
          END IF;
        END $$;
      `);
      return;
    }

    await queryInterface.sequelize.query(
      "ALTER TABLE form_submissions MODIFY status ENUM('draft','submitted','under_review','reviewed','approved','rejected') NOT NULL DEFAULT 'draft';",
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE housing_developments MODIFY status ENUM('draft','submitted','under_review','verified','approved','rejected') NOT NULL DEFAULT 'draft';",
    );
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === 'postgres') {
      await queryInterface.sequelize.query(`
        UPDATE form_submissions
        SET status = 'submitted'
        WHERE status = 'under_review';
      `);
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          ALTER TYPE "enum_form_submissions_status" RENAME TO "enum_form_submissions_status_old";
          CREATE TYPE "enum_form_submissions_status" AS ENUM (
            'draft','submitted','reviewed','approved','rejected'
          );
          ALTER TABLE "form_submissions"
            ALTER COLUMN "status" TYPE "enum_form_submissions_status"
            USING "status"::text::"enum_form_submissions_status";
          DROP TYPE "enum_form_submissions_status_old";
        END $$;
      `);

      await queryInterface.sequelize.query(`
        UPDATE housing_developments
        SET status = 'submitted'
        WHERE status = 'under_review';
      `);
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          ALTER TYPE "enum_housing_developments_status" RENAME TO "enum_housing_developments_status_old";
          CREATE TYPE "enum_housing_developments_status" AS ENUM (
            'draft','submitted','verified','approved'
          );
          ALTER TABLE "housing_developments"
            ALTER COLUMN "status" TYPE "enum_housing_developments_status"
            USING "status"::text::"enum_housing_developments_status";
          DROP TYPE "enum_housing_developments_status_old";
        END $$;
      `);
      return;
    }

    await queryInterface.sequelize.query(
      "ALTER TABLE form_submissions MODIFY status ENUM('draft','submitted','reviewed','approved','rejected') NOT NULL DEFAULT 'draft';",
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE housing_developments MODIFY status ENUM('draft','submitted','verified','approved') NOT NULL DEFAULT 'draft';",
    );
  },
};
