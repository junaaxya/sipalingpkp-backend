const path = require('path');
const fs = require('fs/promises');
const {
  Province,
  Regency,
  District,
  Village,
  sequelize,
} = require('../models');

const GEOJSON_PATH = path.join(
  __dirname,
  '../../data_peta_profesional/administrasi/batas_desa.geojson',
);

const PROVINCE_CODE = '19';
const PROVINCE_NAME = 'Kepulauan Bangka Belitung';

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const buildKey = (...parts) => parts.map((part) => normalizeText(part)).join('|');

const sortByText = (left, right) => left.localeCompare(right, 'id');

const getRegencyType = (name) => {
  const upper = String(name || '').toUpperCase();
  if (upper.startsWith('KOTA ')) {
    return 'kota';
  }
  return 'kabupaten';
};

const loadFeatures = async () => {
  const raw = await fs.readFile(GEOJSON_PATH, 'utf8');
  const geojson = JSON.parse(raw);
  if (!geojson || !Array.isArray(geojson.features)) {
    throw new Error('GeoJSON tidak valid atau tidak memiliki features.');
  }
  return geojson.features;
};

const ensureEmptyOrForce = async (isForce) => {
  const [provinceCount, regencyCount, districtCount, villageCount] = await Promise.all([
    Province.count(),
    Regency.count(),
    District.count(),
    Village.count(),
  ]);

  const total = provinceCount + regencyCount + districtCount + villageCount;
  const hasOnlyProvince = provinceCount > 0
    && regencyCount === 0
    && districtCount === 0
    && villageCount === 0;

  if (total === 0 || hasOnlyProvince || isForce) {
    return;
  }

  throw new Error(
    'Tabel lokasi sudah berisi data. Jalankan script dengan flag --force jika ingin menimpa.',
  );
};

const seedLocations = async ({ force }) => {
  await sequelize.authenticate();
  sequelize.options.logging = false;
  await ensureEmptyOrForce(force);

  const features = await loadFeatures();
  const regencySet = new Set();
  const districtMap = new Map();
  const villageMap = new Map();

  for (const feature of features) {
    const props = feature?.properties || {};
    const regencyName = normalizeText(props.KAB_KOTA);
    const districtName = normalizeText(props.KECAMATAN);
    const villageName = normalizeText(props.DESA);

    if (!regencyName || !districtName || !villageName) {
      continue;
    }

    regencySet.add(regencyName);
    districtMap.set(buildKey(regencyName, districtName), {
      regencyName,
      name: districtName,
    });
    villageMap.set(buildKey(regencyName, districtName, villageName), {
      regencyName,
      districtName,
      name: villageName,
    });
  }

  let province = await Province.findOne({ where: { code: PROVINCE_CODE } });
  if (!province) {
    province = await Province.create({ code: PROVINCE_CODE, name: PROVINCE_NAME });
  } else if (province.name !== PROVINCE_NAME) {
    await province.update({ name: PROVINCE_NAME });
  }

  const regencyNames = Array.from(regencySet).sort(sortByText);
  const regencyByName = new Map();
  let regencyIndex = 1;
  for (const name of regencyNames) {
    const code = `RG${String(regencyIndex).padStart(3, '0')}`;
    const [regency] = await Regency.findOrCreate({
      where: { code },
      defaults: {
        name,
        type: getRegencyType(name),
        provinceId: province.id,
      },
    });
    regencyByName.set(name, regency);
    regencyIndex += 1;
  }

  const districtEntries = Array.from(districtMap.values()).sort(
    (left, right) =>
      sortByText(left.regencyName, right.regencyName)
      || sortByText(left.name, right.name),
  );
  const districtByKey = new Map();
  let districtIndex = 1;
  for (const entry of districtEntries) {
    const regency = regencyByName.get(entry.regencyName);
    if (!regency) {
      continue;
    }
    const code = `DC${String(districtIndex).padStart(4, '0')}`;
    const [district] = await District.findOrCreate({
      where: { code },
      defaults: {
        name: entry.name,
        regencyId: regency.id,
      },
    });
    districtByKey.set(buildKey(entry.regencyName, entry.name), district);
    districtIndex += 1;
  }

  const villageEntries = Array.from(villageMap.values()).sort(
    (left, right) =>
      sortByText(left.regencyName, right.regencyName)
      || sortByText(left.districtName, right.districtName)
      || sortByText(left.name, right.name),
  );
  let villageIndex = 1;
  for (const entry of villageEntries) {
    const district = districtByKey.get(buildKey(entry.regencyName, entry.districtName));
    if (!district) {
      continue;
    }
    const code = `VL${String(villageIndex).padStart(4, '0')}`;
    await Village.findOrCreate({
      where: { code },
      defaults: {
        name: entry.name,
        districtId: district.id,
      },
    });
    villageIndex += 1;
  }

  return {
    regencies: regencyNames.length,
    districts: districtEntries.length,
    villages: villageEntries.length,
  };
};

const run = async () => {
  const force = process.argv.includes('--force');
  try {
    const summary = await seedLocations({ force });
    console.log('Seed lokasi selesai.', summary);
  } catch (error) {
    console.error('Seed lokasi gagal:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
