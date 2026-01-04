const express = require('express');
const { authenticateToken, requireAnyPermission } = require('../middleware/auth');
const { exportData } = require('../controllers/exportController');

const router = express.Router();

router.get(
  '/:type',
  authenticateToken,
  requireAnyPermission(['export_housing', 'export_infrastructure', 'export_development']),
  exportData,
);

module.exports = router;
