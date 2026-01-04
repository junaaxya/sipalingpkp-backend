const ROLE_GROUPS = {
  super_admin: ['super_admin', 'superadmin', 'admin', 'administrator'],
  verifikator: ['verifikator', 'verifier'],
  admin_kabupaten: [
    'admin_kabupaten',
    'kabupaten_admin',
    'admin kabupaten',
    'admin_regency',
  ],
  admin_desa: [
    'admin_desa',
    'desa_admin',
    'admin desa',
    'admin_village',
  ],
  masyarakat: ['masyarakat'],
};

const normalizeRoleName = (role) => {
  if (!role) return '';
  const raw = typeof role === 'string' ? role : role.name || role.displayName || '';
  return String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
};

const getRoleNames = (user) => {
  if (!user) return [];
  const roles = Array.isArray(user.roleNames) && user.roleNames.length > 0
    ? user.roleNames
    : user.roles || [];
  return roles
    .map(normalizeRoleName)
    .filter(Boolean);
};

const hasRoleGroup = (user, groupKey) => {
  const roleNames = getRoleNames(user);
  const aliases = ROLE_GROUPS[groupKey] || [];
  return aliases.some((alias) => roleNames.includes(normalizeRoleName(alias)));
};

const isSuperAdmin = (user) => hasRoleGroup(user, 'super_admin');
const isVerifikator = (user) => hasRoleGroup(user, 'verifikator');
const isAdminKabupaten = (user) => hasRoleGroup(user, 'admin_kabupaten');
const isAdminDesa = (user) => hasRoleGroup(user, 'admin_desa');
const isMasyarakat = (user) => hasRoleGroup(user, 'masyarakat');
const shouldBypassLocationScope = (user) => isSuperAdmin(user) || isVerifikator(user);

module.exports = {
  normalizeRoleName,
  getRoleNames,
  hasRoleGroup,
  isSuperAdmin,
  isVerifikator,
  isAdminKabupaten,
  isAdminDesa,
  isMasyarakat,
  shouldBypassLocationScope,
};
