const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
require('dotenv').config();

const {
  sequelize,
  User,
  Role,
  Permission,
  RolePermission,
  UserRole,
  Province,
  Regency,
  District,
  Village,
} = require('../models');

const DEFAULT_PASSWORD = 'PasswordAdmin123';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 12;

const PERMISSION_DEFINITIONS = [
  {
    name: 'export_housing',
    displayName: 'Ekspor Data Rumah',
    description: 'Mengunduh laporan rumah masyarakat.',
    resource: 'housing',
    action: 'export',
    scope: 'all',
  },
  {
    name: 'export_infrastructure',
    displayName: 'Ekspor Data Infrastruktur',
    description: 'Mengunduh laporan infrastruktur desa.',
    resource: 'facility',
    action: 'export',
    scope: 'all',
  },
  {
    name: 'export_development',
    displayName: 'Ekspor Data Perumahan',
    description: 'Mengunduh laporan perumahan pengembang.',
    resource: 'housing_development',
    action: 'export',
    scope: 'all',
  },
  {
    name: 'housing:read',
    displayName: 'Baca Rumah',
    description: 'Mengakses data rumah masyarakat.',
    resource: 'housing',
    action: 'read',
    scope: 'location',
  },
  {
    name: 'housing:create',
    displayName: 'Input Rumah',
    description: 'Membuat data rumah masyarakat.',
    resource: 'housing',
    action: 'create',
    scope: 'location',
  },
  {
    name: 'housing:update',
    displayName: 'Edit Rumah',
    description: 'Memperbarui data rumah masyarakat.',
    resource: 'housing',
    action: 'update',
    scope: 'location',
  },
  {
    name: 'facility:read',
    displayName: 'Baca Infrastruktur',
    description: 'Mengakses data infrastruktur desa.',
    resource: 'facility',
    action: 'read',
    scope: 'location',
  },
  {
    name: 'facility:create',
    displayName: 'Input Infrastruktur',
    description: 'Membuat data infrastruktur desa.',
    resource: 'facility',
    action: 'create',
    scope: 'location',
  },
  {
    name: 'facility:update',
    displayName: 'Edit Infrastruktur',
    description: 'Memperbarui data infrastruktur desa.',
    resource: 'facility',
    action: 'update',
    scope: 'location',
  },
  {
    name: 'housing_development:create',
    displayName: 'Input Perumahan',
    description: 'Membuat data perumahan pengembang.',
    resource: 'housing_development',
    action: 'create',
    scope: 'location',
  },
  {
    name: 'housing_development:update',
    displayName: 'Edit Perumahan',
    description: 'Memperbarui data perumahan pengembang.',
    resource: 'housing_development',
    action: 'update',
    scope: 'location',
  },
  {
    name: 'housing_development:read',
    displayName: 'Baca Perumahan',
    description: 'Mengakses data perumahan pengembang.',
    resource: 'housing_development',
    action: 'read',
    scope: 'location',
  },
  {
    name: 'manage_users',
    displayName: 'Kelola Pengguna',
    description: 'Menambah dan mengelola akun pejabat.',
    resource: 'user',
    action: 'manage',
    scope: 'all',
  },
  {
    name: 'housing:verify',
    displayName: 'Verifikasi Rumah',
    description: 'Memproteksi tindakan verifikasi terhadap rumah masyarakat.',
    resource: 'housing',
    action: 'verify',
    scope: 'location',
  },
  {
    name: 'facility:verify',
    displayName: 'Verifikasi Infrastruktur',
    description: 'Memproteksi tindakan verifikasi infrastruktur.',
    resource: 'facility',
    action: 'verify',
    scope: 'location',
  },
  {
    name: 'housing_development:verify',
    displayName: 'Verifikasi Perumahan',
    description: 'Memproteksi tindakan verifikasi perumahan pengembang.',
    resource: 'housing_development',
    action: 'verify',
    scope: 'location',
  },
];

const ROLE_DEFINITIONS = [
  {
    name: 'admin',
    displayName: 'Administrator',
    description: 'Administrator sistem SIPALING PKP (kompetensi penuh).',
    isSystemRole: true,
    isDeletable: false,
    permissions: [
      'export_housing',
      'export_infrastructure',
      'export_development',
      'housing:read',
      'housing:create',
      'housing:update',
      'facility:read',
      'facility:create',
      'housing_development:read',
      'housing_development:create',
      'manage_users',
    ],
  },
  {
    name: 'super_admin',
    displayName: 'Super Admin',
    description: 'Pengguna super dengan cakupan provinsi.',
    isSystemRole: true,
    isDeletable: false,
    permissions: [
      'export_housing',
      'export_infrastructure',
      'export_development',
      'housing:read',
      'housing:create',
      'housing:update',
      'facility:read',
      'facility:create',
      'facility:update',
      'housing_development:read',
      'housing_development:create',
      'housing_development:update',
      'manage_users',
      'housing:verify',
      'facility:verify',
      'housing_development:verify',
    ],
  },
  {
    name: 'admin_regency',
    displayName: 'Admin Kabupaten',
    description: 'Pejabat kabupaten yang memantau dan mengekspor data wilayahnya.',
    isSystemRole: true,
    isDeletable: false,
    permissions: [
      'export_housing',
      'export_infrastructure',
      'export_development',
      'housing:read',
      'facility:read',
      'housing_development:read',
      'housing_development:create',
    ],
  },
  {
    name: 'admin_village',
    displayName: 'Admin Desa',
    description: 'Pejabat desa yang memantau data desa tertentu.',
    isSystemRole: true,
    isDeletable: false,
    permissions: [
      'housing:create',
      'facility:create',
      'export_housing',
      'export_infrastructure',
      'export_development',
      'housing:read',
      'housing_development:read',
    ],
  },
  {
    name: 'verifikator',
    displayName: 'Verifikator',
    description: 'Pengguna yang hanya bisa memverifikasi data.',
    isSystemRole: true,
    isDeletable: false,
    permissions: [
      'export_housing',
      'export_infrastructure',
      'export_development',
      'housing:read',
      'housing:update',
      'facility:read',
      'facility:update',
      'housing_development:read',
      'housing_development:update',
      'housing:verify',
      'facility:verify',
      'housing_development:verify',
    ],
  },
  {
    name: 'masyarakat',
    displayName: 'Masyarakat',
    description: 'Warga biasa yang hanya bisa melihat data miliknya.',
    isSystemRole: false,
    isDeletable: true,
    permissions: ['housing:read', 'housing:create'],
  },
];

const ensurePermission = async (definition, transaction) => {
  const [permission, created] = await Permission.findOrCreate({
    where: { name: definition.name },
    defaults: {
      displayName: definition.displayName,
      description: definition.description,
      resource: definition.resource,
      action: definition.action,
      scope: definition.scope,
      isActive: true,
    },
    transaction,
  });

  if (!created) {
    const updates = {};
    if (permission.displayName !== definition.displayName) {
      updates.displayName = definition.displayName;
    }
    if (permission.description !== definition.description) {
      updates.description = definition.description;
    }
    if (permission.resource !== definition.resource) {
      updates.resource = definition.resource;
    }
    if (permission.action !== definition.action) {
      updates.action = definition.action;
    }
    if (permission.scope !== definition.scope) {
      updates.scope = definition.scope;
    }
    if (!permission.isActive) {
      updates.isActive = true;
    }
    if (Object.keys(updates).length > 0) {
      await permission.update(updates, { transaction });
    }
  }

  return permission;
};

const ensureRole = async (definition, transaction) => {
  const [role, created] = await Role.findOrCreate({
    where: { name: definition.name },
    defaults: {
      displayName: definition.displayName,
      description: definition.description,
      isSystemRole: definition.isSystemRole ?? true,
      isDeletable: definition.isDeletable ?? false,
      isActive: true,
    },
    transaction,
  });

  if (!created) {
    const updates = {};
    if (role.displayName !== definition.displayName) {
      updates.displayName = definition.displayName;
    }
    if (role.description !== definition.description) {
      updates.description = definition.description;
    }
    if (!role.isActive) {
      updates.isActive = true;
    }
    if (role.isSystemRole !== definition.isSystemRole) {
      updates.isSystemRole = definition.isSystemRole;
    }
    if (role.isDeletable !== definition.isDeletable) {
      updates.isDeletable = definition.isDeletable;
    }
    if (Object.keys(updates).length > 0) {
      await role.update(updates, { transaction });
    }
  }

  return role;
};

const attachRolePermissions = async (roleId, permissions, transaction) => {
  const permissionIds = permissions.map((permission) => permission.id);

  const links = permissions.map(async (permission) => {
    const [link, created] = await RolePermission.findOrCreate({
      where: { roleId, permissionId: permission.id },
      defaults: { isActive: true },
      transaction,
    });

    if (!created && !link.isActive) {
      await link.update({ isActive: true }, { transaction });
    }
  });

  await Promise.all(links);

  if (permissionIds.length > 0) {
    await RolePermission.update(
      { isActive: false },
      {
        where: {
          roleId,
          permissionId: { [Op.notIn]: permissionIds },
          isActive: true,
        },
        transaction,
      },
    );
  }
};

const attachUserRole = async (userId, roleId, assignedBy, transaction) => {
  const [userRole, created] = await UserRole.findOrCreate({
    where: { userId, roleId },
    defaults: {
      isActive: true,
      assignedBy,
    },
    transaction,
  });

  if (!created) {
    const updates = {};
    if (!userRole.isActive) {
      updates.isActive = true;
    }
    if (assignedBy && userRole.assignedBy !== assignedBy) {
      updates.assignedBy = assignedBy;
    }
    if (Object.keys(updates).length > 0) {
      await userRole.update(updates, { transaction });
    }
  }
};

const getSampleLocations = async (transaction) => {
  const province = await Province.findOne({
    order: [['name', 'ASC']],
    transaction,
  });
  if (!province) {
    throw new Error('Tidak ada data provinsi. Jalankan seed lokasi dahulu.');
  }

  const regency = await Regency.findOne({
    where: { provinceId: province.id },
    order: [['name', 'ASC']],
    transaction,
  });
  if (!regency) {
    throw new Error('Tidak ada data kabupaten. Jalankan seed lokasi dahulu.');
  }

  const district = await District.findOne({
    where: { regencyId: regency.id },
    order: [['name', 'ASC']],
    transaction,
  });
  if (!district) {
    throw new Error('Tidak ada data kecamatan. Jalankan seed lokasi dahulu.');
  }

  const village = await Village.findOne({
    where: { districtId: district.id },
    order: [['name', 'ASC']],
    transaction,
  });
  if (!village) {
    throw new Error('Tidak ada data desa. Jalankan seed lokasi dahulu.');
  }

  return {
    province,
    regency,
    district,
    village,
  };
};

const buildSampleUsers = (locations) => [
  {
    email: 'superadmin@sipaling.id',
    fullName: 'Super Admin Sipaling PKP',
    userLevel: 'province',
    roleNames: ['super_admin', 'admin'],
    assignedProvinceId: locations.province.id,
    isPrimarySuperAdmin: true,
  },
  {
    email: 'kab-selatan@sipaling.id',
    fullName: 'Admin Kabupaten Selatan',
    userLevel: 'regency',
    roleNames: ['admin_regency'],
    assignedProvinceId: locations.province.id,
    assignedRegencyId: locations.regency.id,
  },
  {
    email: 'desa-rajik@sipaling.id',
    fullName: 'Admin Desa Rajik',
    userLevel: 'village',
    roleNames: ['admin_village'],
    assignedProvinceId: locations.province.id,
    assignedRegencyId: locations.regency.id,
    assignedDistrictId: locations.district.id,
    assignedVillageId: locations.village.id,
  },
  {
    email: 'verif@sipaling.id',
    fullName: 'Verifikator Sipaling PKP',
    userLevel: 'district',
    roleNames: ['verifikator'],
    assignedProvinceId: locations.province.id,
  },
  {
    email: 'warga@gmail.com',
    fullName: 'Warga Sipaling PKP',
    userLevel: 'citizen',
    roleNames: ['masyarakat'],
    assignedProvinceId: locations.province.id,
    assignedRegencyId: locations.regency.id,
    assignedDistrictId: locations.district.id,
    assignedVillageId: locations.village.id,
  },
];

const ensureUser = async (definition, transaction) => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  const payload = {
    email: definition.email,
    fullName: definition.fullName,
    userLevel: definition.userLevel,
    passwordHash,
    emailVerified: true,
    isActive: true,
    assignedProvinceId: definition.assignedProvinceId || null,
    assignedRegencyId: definition.assignedRegencyId || null,
    assignedDistrictId: definition.assignedDistrictId || null,
    assignedVillageId: definition.assignedVillageId || null,
  };

  const existing = await User.findOne({
    where: { email: definition.email },
    transaction,
  });

  if (existing) {
    await existing.update(payload, { transaction });
    return existing;
  }

  return User.create(payload, { transaction });
};

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.transaction(async (transaction) => {
      const permissions = [];
      for (const definition of PERMISSION_DEFINITIONS) {
        const permission = await ensurePermission(definition, transaction);
        permissions.push(permission);
      }

      const permissionMap = new Map();
      permissions.forEach((permission) => {
        permissionMap.set(permission.name, permission);
      });

      const roleMap = new Map();
      for (const definition of ROLE_DEFINITIONS) {
        const role = await ensureRole(definition, transaction);
        roleMap.set(definition.name, role);
        const referencedPermissions = definition.permissions.map((name) => {
          const permission = permissionMap.get(name);
          if (!permission) {
            throw new Error(`Tidak menemukan permission "${name}" untuk role ${definition.name}`);
          }
          return permission;
        });
        await attachRolePermissions(role.id, referencedPermissions, transaction);
      }

      const locations = await getSampleLocations(transaction);
      const userDefinitions = buildSampleUsers(locations);

      let superAdminUser = null;
      for (const definition of userDefinitions) {
        const user = await ensureUser(definition, transaction);
        if (definition.isPrimarySuperAdmin) {
          superAdminUser = user;
        }
      }

      if (!superAdminUser) {
        throw new Error('Gagal menentukan Super Admin untuk menetapkan role.');
      }

      for (const definition of userDefinitions) {
        const currentUser = await User.findOne({
          where: { email: definition.email },
          transaction,
        });

        const assignBy = definition.isPrimarySuperAdmin ? null : superAdminUser.id;
        for (const roleName of definition.roleNames) {
          const role = roleMap.get(roleName);
          if (!role) {
            console.warn(`Role ${roleName} tidak ditemukan, dilewati.`);
            continue;
          }
          await attachUserRole(currentUser.id, role.id, assignBy, transaction);
        }
      }
    });

    console.log('Kelima akun sampel telah siap: superadmin@sipaling.id, kab-selatan@sipaling.id, desa-rajik@sipaling.id, verif@sipaling.id, warga@gmail.com');
    console.log(`Password default: ${DEFAULT_PASSWORD}`);
  } catch (error) {
    console.error('Gagal menyiapkan akun sample:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
};

run();
