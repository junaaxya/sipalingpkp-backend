const { sequelize } = require('../models');

const getYearExpression = (dateExpression) => {
  if (sequelize.getDialect() === 'postgres') {
    return sequelize.fn('DATE_PART', 'year', dateExpression);
  }
  return sequelize.fn('YEAR', dateExpression);
};

const getMonthExpression = (dateExpression) => {
  if (sequelize.getDialect() === 'postgres') {
    return sequelize.fn('TO_CHAR', dateExpression, 'YYYY-MM');
  }
  return sequelize.fn('DATE_FORMAT', dateExpression, '%Y-%m');
};

module.exports = {
  getYearExpression,
  getMonthExpression,
};
