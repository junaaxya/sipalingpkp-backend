const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const FormRespondent = sequelize.define('FormRespondent', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    position: {
      type: DataTypes.ENUM('perangkat_desa', 'pemilik_rumah', 'lainnya'),
      allowNull: false,
      validate: {
        isIn: [['perangkat_desa', 'pemilik_rumah', 'lainnya']],
      },
    },
    positionOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'position_other',
      validate: {
        len: [0, 100],
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
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
    tableName: 'form_respondents',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['position'],
      },
      {
        fields: ['form_submission_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated
  FormRespondent.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  FormRespondent.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(FormRespondent, ['form_submission_id']);

  FormRespondent.associate = (models) => {
    // A form respondent belongs to a form submission (1-to-1)
    FormRespondent.belongsTo(models.FormSubmission, {
      foreignKey: 'form_submission_id',
      as: 'formSubmission',
      onDelete: 'CASCADE',
    });
  };

  return FormRespondent;
};
