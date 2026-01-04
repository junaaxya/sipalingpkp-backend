module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      'facility_commercial',
      'facility_public_services',
      'facility_education',
      'facility_health',
      'facility_religious',
      'facility_recreation',
      'facility_cemetery',
      'facility_green_space',
      'facility_parking',
    ];

    const ensureColumn = async (table, column, definition) => {
      const tableInfo = await queryInterface.describeTable(table);
      if (!tableInfo[column]) {
        await queryInterface.addColumn(table, column, definition);
      }
    };

    const ensureIndex = async (table, fields, unique = false) => {
      const indexes = await queryInterface.showIndex(table);
      const match = indexes.find((index) => {
        const indexFields = index.fields.map((field) => field.attribute);
        return indexFields.length === fields.length
          && indexFields.every((field) => fields.includes(field));
      });
      if (!match) {
        await queryInterface.addIndex(table, fields, { unique });
      }
    };

    const getForeignKeys = async (table) => {
      const rows = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME AS name
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table
           AND COLUMN_NAME = 'facility_survey_id'
           AND REFERENCED_TABLE_NAME = 'facility_surveys'`,
        {
          replacements: { table },
          type: Sequelize.QueryTypes.SELECT,
        },
      );
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows.map((row) => row.name).filter(Boolean);
    };

    for (const table of tables) {
      await ensureColumn(table, 'name', {
        type: Sequelize.STRING(160),
        allowNull: true,
      });
      await ensureColumn(table, 'quantity', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });

      const indexes = await queryInterface.showIndex(table);
      const uniqueIndex = indexes.find((index) => {
        const fields = index.fields.map((field) => field.attribute);
        return index.unique && fields.length === 1 && fields[0] === 'facility_survey_id';
      });

      if (uniqueIndex) {
        const foreignKeys = await getForeignKeys(table);
        if (foreignKeys.length > 0) {
          await Promise.all(
            foreignKeys.map((constraintName) =>
              queryInterface.removeConstraint(table, constraintName)),
          );
        }

        await queryInterface.removeIndex(table, uniqueIndex.name);
        await ensureIndex(table, ['facility_survey_id'], false);

        if (foreignKeys.length > 0) {
          const constraintName = `fk_${table}_survey`;
          await queryInterface.addConstraint(table, {
            fields: ['facility_survey_id'],
            type: 'foreign key',
            name: constraintName,
            references: {
              table: 'facility_surveys',
              field: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          });
        }
      } else {
        await ensureIndex(table, ['facility_survey_id'], false);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const tables = [
      'facility_commercial',
      'facility_public_services',
      'facility_education',
      'facility_health',
      'facility_religious',
      'facility_recreation',
      'facility_cemetery',
      'facility_green_space',
      'facility_parking',
    ];

    const removeColumnIfExists = async (table, column) => {
      const tableInfo = await queryInterface.describeTable(table);
      if (tableInfo[column]) {
        await queryInterface.removeColumn(table, column);
      }
    };

    const getForeignKeys = async (table) => {
      const rows = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME AS name
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table
           AND COLUMN_NAME = 'facility_survey_id'
           AND REFERENCED_TABLE_NAME = 'facility_surveys'`,
        {
          replacements: { table },
          type: Sequelize.QueryTypes.SELECT,
        },
      );
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows.map((row) => row.name).filter(Boolean);
    };

    for (const table of tables) {
      const foreignKeys = await getForeignKeys(table);
      if (foreignKeys.length > 0) {
        await Promise.all(
          foreignKeys.map((constraintName) =>
            queryInterface.removeConstraint(table, constraintName)),
        );
      }

      const indexes = await queryInterface.showIndex(table);
      const surveyIndexes = indexes.filter((index) => {
        const fields = index.fields.map((field) => field.attribute);
        return fields.length === 1 && fields[0] === 'facility_survey_id';
      });

      if (surveyIndexes.length > 0) {
        await Promise.all(
          surveyIndexes.map((index) => queryInterface.removeIndex(table, index.name)),
        );
      }

      await queryInterface.addIndex(table, ['facility_survey_id'], { unique: true });

      if (foreignKeys.length > 0) {
        const constraintName = `fk_${table}_survey`;
        await queryInterface.addConstraint(table, {
          fields: ['facility_survey_id'],
          type: 'foreign key',
          name: constraintName,
          references: {
            table: 'facility_surveys',
            field: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        });
      }
      await removeColumnIfExists(table, 'name');
      await removeColumnIfExists(table, 'quantity');
    }
  },
};
