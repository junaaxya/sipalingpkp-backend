const fs = require('fs/promises');
const path = require('path');
const xlsx = require('xlsx');
const { generateId } = require('../config/nanoid');
const {
    sequelize,
    Sequelize,
    User,
    Role,
    Village,
    District,
    Regency,
    Province,
} = require('../models');
const { getRandomPointInFeature } = require('../utils/geojsonUtils');

const IMPORT_DIR = path.join(__dirname, 'import_data');
const GEOJSON_PATH = path.join(
    __dirname,
    '../../data_peta_profesional/administrasi/batas_desa.geojson'
);
const LOG_DIR = path.join(__dirname, '../../logs');
const FAILURE_LOG_PATH = path.join(LOG_DIR, 'import_failures.txt');
const BATCH_SIZE = 100;
const VILLAGE_ALIASES = {
    tuatunuindah: 'Tua Tunu',
    tuatunu: 'Tua Tunu',
    paritlalang: 'Parit Lalang',
};

const normalize = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

const normalizeVillageName = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');

const resolveVillageAlias = (value) => {
    const normalized = normalizeVillageName(value);
    return VILLAGE_ALIASES[normalized] || value;
};

const normalizeLocationName = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');

const toStringValue = (value) => {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString('fullwide', {
            useGrouping: false,
            maximumFractionDigits: 0,
        });
    }
    return String(value).trim();
};

const normalizeHeaderKey = (value) =>
    String(value || '')
        .replace(/\s+/g, '')
        .toUpperCase();

const normalizeRow = (row) =>
    Object.keys(row).reduce((acc, key) => {
        acc[normalizeHeaderKey(key)] = row[key];
        return acc;
    }, {});

const getRowValue = (row, keys) => {
    for (const key of keys) {
        const normalizedKey = normalizeHeaderKey(key);
        if (Object.prototype.hasOwnProperty.call(row, normalizedKey)) {
            return row[normalizedKey];
        }
    }
    return '';
};

const buildVillageKey = (village, district, regency) =>
    [
        normalizeLocationName(village),
        normalizeLocationName(district),
        normalizeLocationName(regency),
    ].join('|');

const loadGeojson = async () => {
    const raw = await fs.readFile(GEOJSON_PATH, 'utf8');
    return JSON.parse(raw);
};

const buildVillageIndex = async () => {
    const villages = await Village.findAll({
        include: [
            {
                model: District,
                as: 'district',
                required: false,
                include: [
                    {
                        model: Regency,
                        as: 'regency',
                        required: false,
                        include: [
                            {
                                model: Province,
                                as: 'province',
                                required: false,
                            },
                        ],
                    },
                ],
            },
        ],
    });

    const index = new Map();
    const regencyFallbackIndex = new Map();
    villages.forEach((village) => {
        const key = normalizeVillageName(village.name);
        if (!index.has(key)) {
            index.set(key, []);
        }
        index.get(key).push(village);

        const regencyKey = normalizeLocationName(
            village.district?.regency?.name
        );
        if (regencyKey && !regencyFallbackIndex.has(regencyKey)) {
            regencyFallbackIndex.set(regencyKey, village);
        }
    });

    return { villageIndex: index, regencyFallbackIndex };
};

const findVillage = async (villageIndex, villageName) => {
    const normalized = normalizeVillageName(villageName);
    if (!normalized) {
        return null;
    }
    const matches = villageIndex.get(normalized) || [];
    if (matches.length === 1) {
        return matches[0];
    }
    if (matches.length > 1) {
        return matches[0];
    }

    const partialKeys = [];
    villageIndex.forEach((_value, key) => {
        if (key.includes(normalized)) {
            partialKeys.push(key);
        }
    });

    if (partialKeys.length === 1) {
        const partialMatches = villageIndex.get(partialKeys[0]) || [];
        if (partialMatches.length) {
            return partialMatches[0];
        }
    }

    const nameExpression = Sequelize.fn(
        'REPLACE',
        Sequelize.fn('LOWER', Sequelize.col('Village.name')),
        ' ',
        ''
    );

    const village = await Village.findOne({
        where: Sequelize.where(nameExpression, {
            [Sequelize.Op.like]: `%${normalized}%`,
        }),
        include: [
            {
                model: District,
                as: 'district',
                required: false,
                include: [
                    {
                        model: Regency,
                        as: 'regency',
                        required: false,
                        include: [
                            {
                                model: Province,
                                as: 'province',
                                required: false,
                            },
                        ],
                    },
                ],
            },
        ],
    });

    return village || null;
};

const findFallbackVillage = (regencyFallbackIndex, regencyName) => {
    const normalized = normalizeLocationName(regencyName);
    if (!normalized) {
        return null;
    }
    return regencyFallbackIndex.get(normalized) || null;
};

const findVillageFeature = (geojson, village) => {
    if (!geojson || !Array.isArray(geojson.features)) {
        return null;
    }

    const villageName = normalizeVillageName(village.name);
    const districtName = normalizeLocationName(village.district?.name);
    const regencyName = normalizeLocationName(village.district?.regency?.name);

    let matches = geojson.features.filter((feature) => {
        const props = feature.properties || {};
        return normalizeVillageName(props.DESA) === villageName;
    });

    if (districtName) {
        const narrowed = matches.filter((feature) => {
            const props = feature.properties || {};
            return normalizeLocationName(props.KECAMATAN) === districtName;
        });
        if (narrowed.length) {
            matches = narrowed;
        }
    }

    if (regencyName) {
        const narrowed = matches.filter((feature) => {
            const props = feature.properties || {};
            return normalizeLocationName(props.KAB_KOTA) === regencyName;
        });
        if (narrowed.length) {
            matches = narrowed;
        }
    }

    return matches[0] || null;
};

const findFallbackFeature = (geojson, districtName, regencyName) => {
    if (!geojson || !Array.isArray(geojson.features)) {
        return null;
    }

    if (districtName) {
        const districtMatch = geojson.features.find((feature) => {
            const props = feature.properties || {};
            return normalizeLocationName(props.KECAMATAN) === districtName;
        });
        if (districtMatch) {
            return districtMatch;
        }
    }

    if (regencyName) {
        const regencyMatch = geojson.features.find((feature) => {
            const props = feature.properties || {};
            return normalizeLocationName(props.KAB_KOTA) === regencyName;
        });
        if (regencyMatch) {
            return regencyMatch;
        }
    }

    return null;
};

const generateRandomCoordinates = (geojson, village) => {
    if (!village) {
        return null;
    }

    const districtName = normalizeLocationName(village.district?.name);
    const regencyName = normalizeLocationName(village.district?.regency?.name);
    const feature =
        findVillageFeature(geojson, village) ||
        findFallbackFeature(geojson, districtName, regencyName);

    if (!feature) {
        return null;
    }
    return getRandomPointInFeature(feature, 40);
};

const buildOwnerRecord = (data, village, coords, ownerColumns) => {
    const now = new Date();
    const record = {
        id: data.ownerId,
        owner_name: data.ownerName,
        head_of_family_name: data.headOfFamilyName,
        family_card_number: data.familyCardNumber || null,
        house_number: data.houseNumber || null,
        land_ownership_status: 'milik_sendiri',
        house_ownership_status: 'milik_sendiri',
        has_received_housing_assistance: false,
        is_registered_as_poor: false,
        created_at: now,
        updated_at: now,
    };

    if (village) {
        record.village_id = village.id;
        record.district_id = village.district?.id || null;
        record.regency_id = village.district?.regency?.id || null;
        record.province_id = village.district?.regency?.province?.id || null;
    }

    if (ownerColumns.form_submission_id && data.formSubmissionId) {
        record.form_submission_id = data.formSubmissionId;
    }

    if (ownerColumns.latitude && coords) {
        record.latitude = coords[1];
    }
    if (ownerColumns.longitude && coords) {
        record.longitude = coords[0];
    }

    return record;
};

const buildHouseDataRecord = (data, houseDataColumns) => {
    const now = new Date();
    const record = {
        id: data.houseDataId,
        created_at: now,
        updated_at: now,
    };

    if (houseDataColumns.status) {
        record.status = 'RTLH';
    }
    if (houseDataColumns.category) {
        record.category = 'Eligible';
    }
    if (houseDataColumns.address) {
        record.address = data.address || null;
    }

    if (houseDataColumns.form_submission_id && data.formSubmissionId) {
        record.form_submission_id = data.formSubmissionId;
    }

    return record;
};

const buildFormSubmissionRecord = (data, formSubmissionColumns, createdBy) => {
    const now = new Date();
    const record = {
        id: data.formSubmissionId,
        status: 'approved',
        verification_status: 'Verified',
        is_livable: false,
        created_by: createdBy,
        updated_by: createdBy,
        submitted_at: now,
        created_at: now,
        updated_at: now,
    };

    if (formSubmissionColumns.form_type) {
        record.form_type = 'housing';
    }
    if (formSubmissionColumns.village_id) {
        record.village_id = data.villageId || null;
    }
    if (formSubmissionColumns.district_id) {
        record.district_id = data.districtId || null;
    }
    if (formSubmissionColumns.regency_id) {
        record.regency_id = data.regencyId || null;
    }
    if (formSubmissionColumns.province_id) {
        record.province_id = data.provinceId || null;
    }
    if (formSubmissionColumns.household_owner_id) {
        record.household_owner_id = data.ownerId || null;
    }
    if (formSubmissionColumns.house_data_id) {
        record.house_data_id = data.houseDataId || null;
    }

    return record;
};

const pickColumns = (record, columnInfo) => {
    if (!columnInfo) {
        return record;
    }
    return Object.keys(record).reduce((acc, key) => {
        if (columnInfo[key]) {
            acc[key] = record[key];
        }
        return acc;
    }, {});
};

const truncateTables = async () => {
    await sequelize.query(
        'TRUNCATE TABLE form_submissions, house_data, household_owners CASCADE'
    );
};

const bulkInsertInBatches = async (
    queryInterface,
    tableName,
    records,
    options
) => {
    if (!records.length) {
        return;
    }
    for (let start = 0; start < records.length; start += BATCH_SIZE) {
        const chunk = records.slice(start, start + BATCH_SIZE);
        await queryInterface.bulkInsert(tableName, chunk, options);
    }
};

const appendMissingVillageLog = async (fileName, missingVillages) => {
    if (!missingVillages.size) {
        return;
    }

    await fs.mkdir(LOG_DIR, { recursive: true });
    const timestamp = new Date().toISOString();
    const lines = [
        `=== ${timestamp} | ${fileName} ===`,
        ...Array.from(missingVillages)
            .sort()
            .map((name) => `- ${name}`),
        '',
    ];
    await fs.appendFile(FAILURE_LOG_PATH, `${lines.join('\n')}\n`, 'utf8');
};

const addToRegencyCount = (regencyCounts, regencyName) => {
    const key = regencyName || 'Tidak diketahui';
    regencyCounts.set(key, (regencyCounts.get(key) || 0) + 1);
};

const resolveImportUserId = async () => {
    if (process.env.IMPORT_USER_ID) {
        return process.env.IMPORT_USER_ID;
    }

    const superAdmin = await User.findOne({
        include: [
            {
                model: Role,
                as: 'roles',
                attributes: ['id', 'name'],
                through: { attributes: [] },
                where: { name: 'super_admin' },
                required: true,
            },
        ],
    });

    if (superAdmin) {
        return superAdmin.id;
    }

    const fallback = await User.findOne({ order: [['created_at', 'ASC']] });
    if (fallback) {
        return fallback.id;
    }

    throw new Error(
        'IMPORT_USER_ID tidak ditemukan dan tidak ada user di database.'
    );
};

const importFile = async (filePath, context) => {
    const workbook = xlsx.readFile(filePath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const formSubmissionRecords = [];
    const ownerRecords = [];
    const houseDataRecords = [];
    const missingVillageNames = new Set();
    const regencyCounts = new Map();
    const failures = [];
    let skipped = 0;
    let missingVillage = 0;

    for (let index = 0; index < rows.length; index += 1) {
        const rawRow = rows[index];
        try {
            const row = normalizeRow(rawRow);
            const ownerName = toStringValue(getRowValue(row, ['nama']));
            const familyCardNumber = toStringValue(
                getRowValue(row, [
                    'nomor kk',
                    'no kk',
                    'no. kk',
                    'kk',
                    'nomor ktp',
                    'nik',
                    'no ktp',
                    'no. ktp',
                ])
            );
            const address = toStringValue(
                getRowValue(row, [
                    'alamat',
                    'alamat rumah',
                    'alamat tempat tinggal',
                ])
            );
            const rawVillageName = toStringValue(
                getRowValue(row, ['desa/kelurahan', 'desa', 'kelurahan'])
            );
            const villageName = resolveVillageAlias(rawVillageName);
            const regencyName = toStringValue(
                getRowValue(row, [
                    'kabupaten',
                    'kabupaten/kota',
                    'kab/kota',
                    'kab_kota',
                    'kota',
                ])
            );

            if (!ownerName) {
                skipped += 1;
                failures.push({
                    row: index + 2,
                    reason: 'Nama kosong',
                });
                continue;
            }

            let village = await findVillage(context.villageIndex, villageName);
            if (!village) {
                const fallbackVillage = findFallbackVillage(
                    context.regencyFallbackIndex,
                    regencyName
                );
                if (fallbackVillage) {
                    village = fallbackVillage;
                } else {
                    missingVillage += 1;
                    missingVillageNames.add(villageName || '(kosong)');
                    failures.push({
                        row: index + 2,
                        reason: `Desa tidak ditemukan: ${
                            villageName || '(kosong)'
                        }`,
                    });
                }
            }

            const formSubmissionId = generateId();
            const ownerId = generateId();
            const houseDataId = generateId();
            const coords = village
                ? generateRandomCoordinates(context.geojson, village)
                : null;
            if (village && !coords) {
                console.warn(
                    `Koordinat gagal untuk ${village.name} (kecamatan ${
                        village.district?.name || '-'
                    }, kabupaten ${village.district?.regency?.name || '-'})`
                );
            }
            const ownerData = {
                formSubmissionId,
                ownerId,
                houseDataId,
                ownerName,
                headOfFamilyName: ownerName,
                familyCardNumber,
                houseNumber: address,
            };

            const formSubmissionData = {
                formSubmissionId,
                ownerId,
                houseDataId,
                villageId: village?.id || null,
                districtId: village?.district?.id || null,
                regencyId: village?.district?.regency?.id || null,
                provinceId: village?.district?.regency?.province?.id || null,
            };

            formSubmissionRecords.push(
                pickColumns(
                    buildFormSubmissionRecord(
                        formSubmissionData,
                        context.formSubmissionColumns,
                        context.importUserId
                    ),
                    context.formSubmissionColumns
                )
            );

            ownerRecords.push(
                buildOwnerRecord(
                    { ...ownerData, formSubmissionId },
                    village,
                    coords,
                    context.ownerColumns
                )
            );
            houseDataRecords.push(
                buildHouseDataRecord(
                    { address, formSubmissionId, houseDataId },
                    context.houseDataColumns
                )
            );

            addToRegencyCount(
                regencyCounts,
                village?.district?.regency?.name || regencyName
            );
        } catch (error) {
            failures.push({
                row: index + 2,
                reason: error.message || 'Unknown error',
            });
        }
    }

    await bulkInsertInBatches(
        context.queryInterface,
        'household_owners',
        ownerRecords,
        {
            transaction: context.transaction,
        }
    );
    await bulkInsertInBatches(
        context.queryInterface,
        'house_data',
        houseDataRecords,
        {
            transaction: context.transaction,
        }
    );
    await bulkInsertInBatches(
        context.queryInterface,
        'form_submissions',
        formSubmissionRecords,
        {
            transaction: context.transaction,
        }
    );

    const fileName = path.basename(filePath);
    console.log(
        `Selesai mengimpor ${ownerRecords.length} data dari file ${fileName}.`,
        skipped ? `Skipped ${skipped} baris kosong.` : '',
        missingVillage
            ? `Tidak menemukan desa untuk ${missingVillage} baris.`
            : ''
    );

    if (failures.length) {
        const preview = failures.slice(0, 20);
        console.warn(`Detail gagal impor (${failures.length} baris). Contoh:`);
        preview.forEach((item) => {
            console.warn(`- Baris ${item.row}: ${item.reason}`);
        });
        if (failures.length > preview.length) {
            console.warn(
                `... ${failures.length - preview.length} baris lainnya.`
            );
        }
    }

    await appendMissingVillageLog(fileName, missingVillageNames);

    return {
        totalImported: ownerRecords.length,
        regencyCounts,
        missingVillageNames,
    };
};

const run = async () => {
    try {
        await sequelize.authenticate();
        const geojson = await loadGeojson();
        const { villageIndex, regencyFallbackIndex } =
            await buildVillageIndex();
        const queryInterface = sequelize.getQueryInterface();
        const formSubmissionColumns = await queryInterface.describeTable(
            'form_submissions'
        );
        const ownerColumns = await queryInterface.describeTable(
            'household_owners'
        );
        const houseDataColumns = await queryInterface.describeTable(
            'house_data'
        );
        const importUserId = await resolveImportUserId();

        const files = (await fs.readdir(IMPORT_DIR))
            .filter((file) => /\.(csv|xlsx)$/i.test(file))
            .map((file) => path.join(IMPORT_DIR, file));

        if (!files.length) {
            console.log(
                'Tidak ada file .csv atau .xlsx di folder import_data.'
            );
            return;
        }

        // await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { raw: true });
        await truncateTables();
        // await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { raw: true });

        const regencyTotals = new Map();
        const missingVillageTotals = new Set();
        let grandTotal = 0;
        const transaction = await sequelize.transaction();
        try {
            await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', {
                transaction,
                raw: true,
            });

            for (const file of files) {
                const result = await importFile(file, {
                    geojson,
                    villageIndex,
                    regencyFallbackIndex,
                    queryInterface,
                    formSubmissionColumns,
                    ownerColumns,
                    houseDataColumns,
                    importUserId,
                    transaction,
                });

                if (result) {
                    grandTotal += result.totalImported;
                    result.regencyCounts.forEach((count, regencyName) => {
                        regencyTotals.set(
                            regencyName,
                            (regencyTotals.get(regencyName) || 0) + count
                        );
                    });
                    result.missingVillageNames.forEach((name) =>
                        missingVillageTotals.add(name)
                    );
                }
            }

            await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', {
                transaction,
                raw: true,
            });
            await transaction.commit();
        } catch (error) {
            try {
                await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', {
                    transaction,
                    raw: true,
                });
            } catch (resetError) {
                console.warn(
                    'Gagal mengaktifkan kembali FOREIGN_KEY_CHECKS:',
                    resetError.message
                );
            }
            await transaction.rollback();
            throw error;
        }

        console.log('Ringkasan impor per kabupaten:');
        Array.from(regencyTotals.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([name, count]) => {
                console.log(`- ${name}: ${count}`);
            });
        console.log(`Total keseluruhan: ${grandTotal}`);

        if (missingVillageTotals.size) {
            console.log('Daftar desa tidak ditemukan (perbaiki di Excel/DB):');
            Array.from(missingVillageTotals)
                .sort()
                .forEach((name) => {
                    console.log(`- ${name}`);
                });
        }
    } catch (error) {
        console.error('Gagal mengimpor data RTLH:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
};

run();
