const { QueryTypes, Op } = require('sequelize');
const {
  sequelize,
  Permission,
  RolePermission,
  Role,
  UserRole
} = require('../models');
const { errorFactory } = require('../errors/errorUtils');

/**
 * Check if user can access specific location data
 */
async function canAccessLocation(userId, locationData) {
  try {
    const {
      provinceId, regencyId, districtId, villageId,
    } = locationData;

    const result = await sequelize.query(
      'SELECT can_access_location(?, ?, ?, ?, ?) as can_access',
      {
        replacements: [userId, provinceId, regencyId, districtId, villageId],
        type: QueryTypes.SELECT,
      },
    );

    return result[0].can_access === 1;
  } catch (error) {
    throw errorFactory.database('Failed to check location access', error);
  }
}

/**
 * Check if user has specific permission
 */
async function hasPermission(userId, permissionName) {
  try {
    const result = await sequelize.query(
      'SELECT has_permission(?, ?) as has_permission',
      {
        replacements: [userId, permissionName],
        type: QueryTypes.SELECT,
      },
    );

    return result[0].has_permission === 1;
  } catch (error) {
    throw errorFactory.database('Failed to check permission', error);
  }
}

/**
 * Check if user can access specific resource
 */
async function canAccessResource(userId, resourceType, action, resourceId) {
  try {
    const result = await sequelize.query(
      'SELECT can_access_resource(?, ?, ?, ?) as can_access',
      {
        replacements: [userId, resourceType, action, resourceId],
        type: QueryTypes.SELECT,
      },
    );

    return result[0].can_access === 1;
  } catch (error) {
    throw errorFactory.database('Failed to check resource access', error);
  }
}

/**
 * Get all user permissions as JSON
 */
async function getUserPermissions(userId) {
  try {
    const result = await sequelize.query(
      'SELECT get_user_permissions(?) as permissions',
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      },
    );

    const permissionsJson = result[0].permissions;
    return permissionsJson && permissionsJson !== '' ? JSON.parse(permissionsJson) : [];
  } catch (error) {
    try {
      const fallbackPermissions = await Permission.findAll({
        include: [
          {
            model: RolePermission,
            as: 'rolePermissions',
            include: [
              {
                model: Role,
                as: 'role',
                include: [
                  {
                    model: UserRole,
                    as: 'userRoles',
                    where: {
                      userId,
                      isActive: true,
                      expiresAt: { [Op.or]: [null, { [Op.gt]: new Date() }] },
                    },
                  },
                ],
              },
            ],
          },
        ],
        where: { isActive: true },
      });

      return fallbackPermissions.map((permission) => (
        permission.toJSON ? permission.toJSON() : permission
      ));
    } catch (fallbackError) {
      console.warn('Fallback permission lookup failed:', fallbackError.message);
      return [];
    }
  }
}

/**
 * Get all user roles as JSON
 */
async function getUserRoles(userId) {
  try {
    const result = await sequelize.query(
      'SELECT get_user_roles(?) as roles',
      {
        replacements: [userId],
        type: QueryTypes.SELECT,
      },
    );

    const rolesJson = result[0].roles;
    return rolesJson && rolesJson !== '' ? JSON.parse(rolesJson) : [];
  } catch (error) {
    try {
      const fallbackRoles = await Role.findAll({
        include: [
          {
            model: UserRole,
            as: 'userRoles',
            where: {
              userId,
              isActive: true,
              expiresAt: { [Op.or]: [null, { [Op.gt]: new Date() }] },
            },
          },
        ],
        where: { isActive: true },
      });

      return fallbackRoles.map((role) => (
        role.toJSON ? role.toJSON() : role
      ));
    } catch (fallbackError) {
      console.warn('Fallback role lookup failed:', fallbackError.message);
      return [];
    }
  }
}

/**
 * Create custom role with permissions
 */
async function createCustomRole(roleData, createdBy) {
  try {
    const {
      name, displayName, description, categoryId, permissionIds,
    } = roleData;

    const result = await sequelize.query(
      'CALL create_custom_role(?, ?, ?, ?, ?, ?)',
      {
        replacements: [
          name,
          displayName,
          description,
          categoryId,
          JSON.stringify(permissionIds),
          createdBy,
        ],
        type: QueryTypes.SELECT,
      },
    );

    return result[0][0].created_role_id;
  } catch (error) {
    throw errorFactory.database('Failed to create custom role', error);
  }
}

/**
 * Assign role to user
 */
async function assignRoleToUser(userId, roleId, assignedBy, expiresAt = null) {
  try {
    const result = await sequelize.query(
      'CALL assign_role_to_user(?, ?, ?, ?)',
      {
        replacements: [userId, roleId, assignedBy, expiresAt],
        type: QueryTypes.SELECT,
      },
    );

    return result[0][0].assignment_id;
  } catch (error) {
    throw errorFactory.database('Failed to assign role to user', error);
  }
}

/**
 * Remove role from user
 */
async function removeRoleFromUser(userId, roleId, removedBy) {
  try {
    await sequelize.query(
      'CALL remove_role_from_user(?, ?, ?)',
      {
        replacements: [userId, roleId, removedBy],
        type: QueryTypes.SELECT,
      },
    );

    return true;
  } catch (error) {
    throw errorFactory.database('Failed to remove role from user', error);
  }
}

/**
 * Create user session using database procedure
 */
async function createUserSession(sessionData) {
  try {
    const {
      userId, sessionToken, refreshToken, deviceInfo, ipAddress, userAgent, expiresAt,
    } = sessionData;

    const result = await sequelize.query(
      'CALL create_user_session(?, ?, ?, ?, ?, ?, ?)',
      {
        replacements: [
          userId,
          sessionToken,
          refreshToken,
          JSON.stringify(deviceInfo),
          ipAddress,
          userAgent,
          expiresAt,
        ],
        type: QueryTypes.SELECT,
      },
    );

    return result[0][0].session_id;
  } catch (error) {
    throw errorFactory.database('Failed to create user session', error);
  }
}

/**
 * Invalidate user session using database procedure
 */
async function invalidateUserSession(sessionToken, invalidatedBy) {
  try {
    await sequelize.query(
      'CALL invalidate_user_session(?, ?)',
      {
        replacements: [sessionToken, invalidatedBy],
        type: QueryTypes.SELECT,
      },
    );

    return true;
  } catch (error) {
    throw errorFactory.database('Failed to invalidate user session', error);
  }
}

/**
 * Clean expired sessions
 */
async function cleanExpiredSessions() {
  try {
    const result = await sequelize.query(
      'CALL clean_expired_sessions()',
      {
        type: QueryTypes.SELECT,
      },
    );

    return result[0][0].expired_sessions_cleaned;
  } catch (error) {
    throw errorFactory.database('Failed to clean expired sessions', error);
  }
}

/**
 * Log user action using database procedure
 */
async function logUserAction(actionData) {
  try {
    const {
      userId, action, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent, metadata,
    } = actionData;

    const result = await sequelize.query(
      'CALL log_user_action(?, ?, ?, ?, ?, ?, ?, ?, ?)',
      {
        replacements: [
          userId,
          action,
          resourceType,
          resourceId,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          ipAddress,
          userAgent,
          metadata ? JSON.stringify(metadata) : null,
        ],
        type: QueryTypes.SELECT,
      },
    );

    return result[0][0].audit_id;
  } catch (error) {
    throw errorFactory.database('Failed to log user action', error);
  }
}

/**
 * Batch permission check for multiple permissions
 */
async function hasMultiplePermissions(userId, permissionNames) {
  try {
    const permissionChecks = permissionNames.map(async(permissionName) => {
      const hasPermissionResult = await hasPermission(userId, permissionName);
      return { permission: permissionName, hasPermission: hasPermissionResult };
    });

    const results = await Promise.all(permissionChecks);
    return results.reduce((acc, { permission, hasPermission: hasPermissionResult }) => {
      acc[permission] = hasPermissionResult;
      return acc;
    }, {});
  } catch (error) {
    throw errorFactory.database('Failed to check multiple permissions', error);
  }
}

/**
 * Check location access for multiple locations
 */
async function canAccessMultipleLocations(userId, locations) {
  try {
    const locationChecks = locations.map(async(location) => {
      const canAccess = await canAccessLocation(userId, location);
      return { location, canAccess };
    });

    const results = await Promise.all(locationChecks);
    return results.reduce((acc, { location, canAccess }) => {
      acc[`${location.provinceId}-${location.regencyId}-${location.districtId}-${location.villageId}`] = canAccess;
      return acc;
    }, {});
  } catch (error) {
    throw errorFactory.database('Failed to check multiple location access', error);
  }
}

/**
 * Check if user has any of the specified permissions
 */
async function hasAnyPermission(userId, permissionNames) {
  try {
    const permissionChecks = permissionNames.map(async(permissionName) => hasPermission(userId, permissionName));

    const results = await Promise.all(permissionChecks);
    return results.some((hasPermissionResult) => hasPermissionResult);
  } catch (error) {
    throw errorFactory.database('Failed to check any permission', error);
  }
}

module.exports = {
  canAccessLocation,
  hasPermission,
  canAccessResource,
  getUserPermissions,
  getUserRoles,
  createCustomRole,
  assignRoleToUser,
  removeRoleFromUser,
  createUserSession,
  invalidateUserSession,
  cleanExpiredSessions,
  logUserAction,
  hasMultiplePermissions,
  canAccessMultipleLocations,
  hasAnyPermission,
};
