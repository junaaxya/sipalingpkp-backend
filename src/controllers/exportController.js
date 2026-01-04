const ExcelJS = require('exceljs');
const { asyncErrorHandler } = require('../errors/errorMiddleware');
const { errorFactory } = require('../errors/errorUtils');
const { exportFormSubmissions } = require('../services/housingService');
const { exportFacilitySurveys } = require('../services/facilityService');
const { exportHousingDevelopments } = require('../services/housingDevelopmentService');
const { createNotification } = require('../services/notificationService');

const { hasPermission } = require('../services/authFunctionsService');
const { isAdminDesa } = require('../utils/accessControl');

const ensurePermission = async (req, requiredPermission) => {
  if (req.permissionResults && Object.prototype.hasOwnProperty.call(req.permissionResults, requiredPermission)) {
    if (!req.permissionResults[requiredPermission]) {
      throw errorFactory.authorization('Insufficient permissions');
    }
    return;
  }

  const hasPermissionResult = await hasPermission(req.user.id, requiredPermission);
  if (!hasPermissionResult) {
    throw errorFactory.authorization('Insufficient permissions');
  }
};

const buildFilename = (type) => {
  const date = new Date().toISOString().slice(0, 10);
  return `export-${type}-${date}.xlsx`;
};

const exportHousingData = async (userLocationScope, query) => {
  const submissions = await exportFormSubmissions(userLocationScope, query);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Housing');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'Pemilik', key: 'ownerName', width: 24 },
    { header: 'Alamat', key: 'address', width: 28 },
    { header: 'RT', key: 'rt', width: 8 },
    { header: 'RW', key: 'rw', width: 8 },
    { header: 'Desa', key: 'village', width: 20 },
    { header: 'Kecamatan', key: 'district', width: 20 },
    { header: 'Kabupaten', key: 'regency', width: 20 },
    { header: 'Keterangan Kawasan', key: 'gisAreaLabel', width: 28 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Latitude', key: 'latitude', width: 14 },
    { header: 'Longitude', key: 'longitude', width: 14 },
  ];

  submissions.forEach((submission) => {
    const owner = submission.householdOwner || {};
    sheet.addRow({
      id: submission.id,
      ownerName: owner.ownerName || '',
      address: owner.houseNumber || '',
      rt: owner.rt || '',
      rw: owner.rw || '',
      village: owner.village?.name || '',
      district: owner.district?.name || '',
      regency: owner.regency?.name || '',
      gisAreaLabel: submission.gisAreaLabel || '',
      status: submission.status || '',
      latitude: owner.latitude || '',
      longitude: owner.longitude || '',
    });
  });

  return workbook;
};

const exportFacilityData = async (userLocationScope, query) => {
  const surveys = await exportFacilitySurveys(userLocationScope, query);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Infrastructure');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'Tahun Survei', key: 'surveyYear', width: 14 },
    { header: 'Periode', key: 'surveyPeriod', width: 12 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Desa', key: 'village', width: 20 },
    { header: 'Kecamatan', key: 'district', width: 20 },
    { header: 'Kabupaten', key: 'regency', width: 20 },
  ];

  surveys.forEach((survey) => {
    sheet.addRow({
      id: survey.id,
      surveyYear: survey.surveyYear || '',
      surveyPeriod: survey.surveyPeriod || '',
      status: survey.status || '',
      village: survey.village?.name || '',
      district: survey.district?.name || '',
      regency: survey.regency?.name || '',
    });
  });

  return workbook;
};

const exportHousingDevelopmentData = async (userLocationScope, query) => {
  const developments = await exportHousingDevelopments(userLocationScope, query);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Housing Development');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 14 },
    { header: 'Nama Perumahan', key: 'developmentName', width: 26 },
    { header: 'Pengembang', key: 'developerName', width: 24 },
    { header: 'Jenis', key: 'housingType', width: 14 },
    { header: 'Jumlah Unit', key: 'plannedUnitCount', width: 14 },
    { header: 'Luas Lahan', key: 'landArea', width: 14 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Latitude', key: 'latitude', width: 14 },
    { header: 'Longitude', key: 'longitude', width: 14 },
  ];

  developments.forEach((development) => {
    sheet.addRow({
      id: development.id,
      developmentName: development.developmentName || '',
      developerName: development.developerName || '',
      housingType: development.housingType || '',
      plannedUnitCount: development.plannedUnitCount || 0,
      landArea: development.landArea || 0,
      status: development.status || '',
      latitude: development.latitude || '',
      longitude: development.longitude || '',
    });
  });

  return workbook;
};

const exportDataController = asyncErrorHandler(async (req, res) => {
  const { type } = req.params;
  const userLocationScope = req.user;
  const query = { ...(req.query || {}) };
  if (isAdminDesa(userLocationScope) && userLocationScope.assignedVillageId) {
    query.villageId = userLocationScope.assignedVillageId;
  }
  const format = String(query.format || 'excel').toLowerCase();
  delete query.format;

  if (format === 'json') {
    let items = [];

    switch (type) {
      case 'housing':
        await ensurePermission(req, 'export_housing');
        items = await exportFormSubmissions(userLocationScope, query);
        break;
      case 'facility':
        await ensurePermission(req, 'export_infrastructure');
        items = await exportFacilitySurveys(userLocationScope, query);
        break;
      case 'housing-development':
        await ensurePermission(req, 'export_development');
        items = await exportHousingDevelopments(userLocationScope, query);
        break;
      default:
        throw errorFactory.validation('Invalid export type');
    }

    try {
      await createNotification(req.user.id, {
        type: 'info',
        category: 'audit',
        title: 'Laporan Siap Diunduh',
        message: 'Data ekspor berhasil disiapkan dalam format JSON.',
        link: '/export',
      });
    } catch (notifyError) {
      console.warn('Failed to create export notification:', notifyError.message);
    }

    return res.json({
      success: true,
      data: {
        items,
      },
    });
  }

  let workbook;

  switch (type) {
    case 'housing':
      await ensurePermission(req, 'export_housing');
      workbook = await exportHousingData(userLocationScope, query);
      break;
    case 'facility':
      await ensurePermission(req, 'export_infrastructure');
      workbook = await exportFacilityData(userLocationScope, query);
      break;
    case 'housing-development':
      await ensurePermission(req, 'export_development');
      workbook = await exportHousingDevelopmentData(userLocationScope, query);
      break;
    default:
      throw errorFactory.validation('Invalid export type');
  }

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${buildFilename(type)}"`);

  try {
    await createNotification(req.user.id, {
      type: 'success',
      category: 'audit',
      title: 'Laporan Siap Diunduh',
      message: `Ekspor data ${type} berhasil disiapkan.`,
      link: '/export',
    });
  } catch (notifyError) {
    console.warn('Failed to create export notification:', notifyError.message);
  }
  return res.send(buffer);
});

module.exports = {
  exportData: exportDataController,
};
