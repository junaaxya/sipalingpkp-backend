const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const SpatialLayer = sequelize.define('SpatialLayer', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [1, 50],
      },
    },
    layerName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'layer_name',
      validate: {
        len: [1, 150],
      },
    },
    properties: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    geom: {
      type: DataTypes.GEOMETRY('GEOMETRY', 4326),
      allowNull: false,
    },
  }, {
    tableName: 'spatial_layers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['layer_name'],
      },
    ],
  });

  SpatialLayer.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  SpatialLayer.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  addCamelCaseToJSONHook(SpatialLayer, ['layer_name']);

  return SpatialLayer;
};
