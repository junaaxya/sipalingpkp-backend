const { errorFactory } = require('../errors/errorUtils');
const { District, Village } = require('../models');
const {
  isAdminDesa,
  isAdminKabupaten,
  shouldBypassLocationScope,
  isMasyarakat,
} = require('../utils/accessControl');

const LOCATION_KEYS = ['provinceId', 'regencyId', 'districtId', 'villageId'];

const normalizeFilters = (filters = {}) => {
  const cleaned = { ...filters };
  Object.keys(cleaned).forEach((key) => {
    if (cleaned[key] === undefined || cleaned[key] === null || cleaned[key] === '') {
      delete cleaned[key];
    }
  });
  return cleaned;
};

const enforceExportLocationScope = async (user, filters = {}) => {
  const scoped = normalizeFilters(filters);
  if (!user || shouldBypassLocationScope(user) || isMasyarakat(user)) {
    return scoped;
  }

  if (isAdminDesa(user) && user.assignedVillageId) {
    if (scoped.villageId && scoped.villageId !== user.assignedVillageId) {
      throw errorFactory.authorization('Wilayah ekspor di luar wewenang.');
    }
    LOCATION_KEYS.forEach((key) => delete scoped[key]);
    scoped.villageId = user.assignedVillageId;
    return scoped;
  }

  if (isAdminKabupaten(user) && user.assignedRegencyId) {
    if (scoped.regencyId && scoped.regencyId !== user.assignedRegencyId) {
      throw errorFactory.authorization('Wilayah ekspor di luar wewenang.');
    }
    if (scoped.districtId) {
      const district = await District.findByPk(scoped.districtId, {
        attributes: ['id', 'regencyId'],
      });
      if (!district) {
        throw errorFactory.validation('Kecamatan tidak ditemukan.');
      }
      if (district.regencyId !== user.assignedRegencyId) {
        throw errorFactory.authorization('Wilayah ekspor di luar wewenang.');
      }
    }
    if (scoped.villageId) {
      const village = await Village.findByPk(scoped.villageId, {
        attributes: ['id', 'districtId'],
      });
      if (!village) {
        throw errorFactory.validation('Desa tidak ditemukan.');
      }
      const district = await District.findByPk(village.districtId, {
        attributes: ['id', 'regencyId'],
      });
      if (!district || district.regencyId !== user.assignedRegencyId) {
        throw errorFactory.authorization('Wilayah ekspor di luar wewenang.');
      }
    }
    scoped.regencyId = user.assignedRegencyId;
    return scoped;
  }

  return scoped;
};

module.exports = {
  enforceExportLocationScope,
};
