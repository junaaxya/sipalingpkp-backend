const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const EnergyAccess = sequelize.define('EnergyAccess', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    electricitySource: {
      type: DataTypes.ENUM('pln_sendiri', 'pln_menumpang', 'tidak_ada', 'genset', 'pltmh', 'plts', 'lainnya'),
      allowNull: true,
      field: 'electricity_source',
      validate: {
        isIn: [['pln_sendiri', 'pln_menumpang', 'tidak_ada', 'genset', 'pltmh', 'plts', 'lainnya']],
      },
    },
    electricitySourceOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'electricity_source_other',
      validate: {
        len: [0, 100],
      },
    },
    plnCapacity: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'pln_capacity',
      validate: {
        len: [0, 20],
      },
    },
    formSubmissionId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'form_submission_id',
      references: {
        model: 'form_submissions',
        key: 'id',
      },
    },
  }, {
    tableName: 'energy_access',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['electricity_source'],
      },
      {
        fields: ['form_submission_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  EnergyAccess.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  EnergyAccess.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  EnergyAccess.associate = (models) => {
    // Energy access has many photos
    EnergyAccess.hasMany(models.HousingPhoto, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: {
        entity_type: 'energy_access',
      },
      as: 'photos',
      onDelete: 'CASCADE',
    });

    // Energy access belongs to a form submission (1-to-1)
    EnergyAccess.belongsTo(models.FormSubmission, {
      foreignKey: 'form_submission_id',
      as: 'formSubmission',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(EnergyAccess, ['entity_id', 'form_submission_id']);

  return EnergyAccess;
};
