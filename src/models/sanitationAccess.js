const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const SanitationAccess = sequelize.define('SanitationAccess', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    toiletOwnership: {
      type: DataTypes.ENUM('milik_sendiri', 'jamban_bersama', 'tidak_memiliki'),
      allowNull: true,
      field: 'toilet_ownership',
      validate: {
        isIn: [['milik_sendiri', 'jamban_bersama', 'tidak_memiliki']],
      },
    },
    toiletCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: 'toilet_count',
      validate: {
        min: 0,
      },
    },
    toiletType: {
      type: DataTypes.ENUM('cubluk', 'leher_angsa_jongkok', 'leher_angsa_duduk'),
      allowNull: true,
      field: 'toilet_type',
      validate: {
        isIn: [['cubluk', 'leher_angsa_jongkok', 'leher_angsa_duduk']],
      },
    },
    septicTankType: {
      type: DataTypes.ENUM('biotank', 'tanki_permanen', 'lubang_tanah', 'tidak_memiliki'),
      allowNull: true,
      field: 'septic_tank_type',
      validate: {
        isIn: [['biotank', 'tanki_permanen', 'lubang_tanah', 'tidak_memiliki']],
      },
    },
    septicTankYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'septic_tank_year',
      validate: {
        min: 1900,
        max: new Date().getFullYear(),
      },
    },
    hasSepticPumping: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'has_septic_pumping',
    },
    septicPumpingYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'septic_pumping_year',
      validate: {
        min: 1900,
        max: new Date().getFullYear(),
      },
    },
    septicPumpingService: {
      type: DataTypes.ENUM('pemda', 'swasta_perorangan', 'swasta_badan_usaha'),
      allowNull: true,
      field: 'septic_pumping_service',
      validate: {
        isIn: [['pemda', 'swasta_perorangan', 'swasta_badan_usaha']],
      },
    },
    wastewaterDisposal: {
      type: DataTypes.ENUM('jaringan_pipa', 'tangki_septic', 'drainase_sungai', 'resapan_tanah'),
      allowNull: true,
      field: 'wastewater_disposal',
      validate: {
        isIn: [['jaringan_pipa', 'tangki_septic', 'drainase_sungai', 'resapan_tanah']],
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
    tableName: 'sanitation_access',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['toilet_ownership'],
      },
      {
        fields: ['septic_tank_type'],
      },
      {
        fields: ['form_submission_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  SanitationAccess.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  SanitationAccess.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  SanitationAccess.associate = (models) => {
    // Sanitation access has many photos
    SanitationAccess.hasMany(models.HousingPhoto, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: {
        entity_type: 'sanitation_access',
      },
      as: 'photos',
      onDelete: 'CASCADE',
    });

    // Sanitation access belongs to a form submission (1-to-1)
    SanitationAccess.belongsTo(models.FormSubmission, {
      foreignKey: 'form_submission_id',
      as: 'formSubmission',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(SanitationAccess, ['entity_id', 'form_submission_id']);

  return SanitationAccess;
};
