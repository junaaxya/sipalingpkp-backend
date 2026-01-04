const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const HouseData = sequelize.define('HouseData', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    buildingArea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'building_area',
      validate: {
        min: 0,
      },
    },
    landArea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'land_area',
      validate: {
        min: 0,
      },
    },
    hasBuildingPermit: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'has_building_permit',
    },
    houseType: {
      type: DataTypes.ENUM('rumah_tapak', 'rumah_susun', 'rumah_petak', 'kos'),
      allowNull: true,
      field: 'house_type',
      validate: {
        isIn: [['rumah_tapak', 'rumah_susun', 'rumah_petak', 'kos']],
      },
    },
    totalOccupants: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'total_occupants',
      validate: {
        min: 1,
      },
    },
    floorMaterial: {
      type: DataTypes.ENUM('tanah', 'keramik', 'rabat_semen', 'papan', 'kayu', 'bata'),
      allowNull: true,
      field: 'floor_material',
      validate: {
        isIn: [['tanah', 'keramik', 'rabat_semen', 'papan', 'kayu', 'bata']],
      },
    },
    wallMaterial: {
      type: DataTypes.ENUM('tembok_tanpa_plester', 'tembok_dengan_plester', 'papan', 'anyaman_bambu', 'lainnya'),
      allowNull: true,
      field: 'wall_material',
      validate: {
        isIn: [['tembok_tanpa_plester', 'tembok_dengan_plester', 'papan', 'anyaman_bambu', 'lainnya']],
      },
    },
    wallMaterialOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'wall_material_other',
      validate: {
        len: [0, 100],
      },
    },
    roofMaterial: {
      type: DataTypes.ENUM('genteng_beton', 'genteng_keramik', 'seng_multiroof', 'kayu_sirap', 'asbes', 'lainnya'),
      allowNull: true,
      field: 'roof_material',
      validate: {
        isIn: [['genteng_beton', 'genteng_keramik', 'seng_multiroof', 'kayu_sirap', 'asbes', 'lainnya']],
      },
    },
    roofMaterialOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'roof_material_other',
      validate: {
        len: [0, 100],
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
    tableName: 'house_data',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['house_type'],
      },
      {
        fields: ['floor_material', 'wall_material', 'roof_material'],
      },
      {
        fields: ['form_submission_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  HouseData.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  HouseData.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(HouseData, ['entity_id', 'form_submission_id']);

  HouseData.associate = (models) => {
    HouseData.belongsTo(models.FormSubmission, {
      foreignKey: 'form_submission_id',
      as: 'formSubmission',
      onDelete: 'CASCADE',
    });

    // A house data has many photos
    HouseData.hasMany(models.HousingPhoto, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: {
        entity_type: 'house_data',
      },
      as: 'photos',
      onDelete: 'CASCADE',
    });
  };

  return HouseData;
};
