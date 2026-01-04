const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const {
  User, UserSession, Permission, RolePermission, UserRole, Role, Province, Regency, District, Village,
} = require('../models');
const {
  getUserPermissions,
  getUserRoles,
  hasPermission,
  canAccessLocation,
  canAccessResource,
  hasMultiplePermissions,
  hasAnyPermission,
} = require('../services/authFunctionsService');
const {
  normalizeRoleName,
  isSuperAdmin,
  isVerifikator,
  isAdminKabupaten,
  isAdminDesa,
} = require('../utils/accessControl');

const buildPermissionNames = (permissions = []) => permissions
  .map((permission) => (typeof permission === 'string' ? permission : permission?.name))
  .filter(Boolean);

const buildRoleNames = (roles = []) => roles
  .map((role) => normalizeRoleName(role))
  .filter(Boolean);

/**
 * Enhanced Authentication middleware using database functions
 * Verifies JWT token and attaches user to request
 */
const authenticateToken = async(req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'TOKEN_REQUIRED',
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const sessionToken = decoded.sessionToken || null;

    // Check if user exists and is active
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] },
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    // Check if session is still valid
    const session = await UserSession.findOne({
      where: {
        userId: user.id,
        sessionToken: decoded.sessionToken,
        isActive: true,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid',
        code: 'SESSION_EXPIRED',
      });
    }

    // Get user permissions using database function
    try {
      const userPermissions = await getUserPermissions(user.id);
      const userRoles = await getUserRoles(user.id);
      const permissionNames = buildPermissionNames(userPermissions);
      const roleNames = buildRoleNames(userRoles);

      // Attach user data to request
      req.user = {
        ...user.toJSON(),
        permissions: userPermissions,
        roles: userRoles,
        permissionNames,
        roleNames,
        sessionToken,
        scope: {
          provinceId: user.assignedProvinceId || null,
          regencyId: user.assignedRegencyId || null,
          districtId: user.assignedDistrictId || null,
          villageId: user.assignedVillageId || null,
        },
      };
    } catch (dbError) {
      // Fallback to original method if database functions fail
      console.warn('Database functions failed, using fallback:', dbError.message);

      // Get user permissions using original method
      const userPermissions = await Permission.findAll({
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
                      userId: user.id,
                      isActive: true,
                      expiresAt: { [Op.or]: [null, { [Op.gt]: new Date() }] },
                    },
                  },
                ],
              },
            ],
          },
        ],
        where: {
          isActive: true,
        },
      });

      const permissionNames = buildPermissionNames(userPermissions);
      const roleNames = buildRoleNames(user.roles || []);

      req.user = {
        ...user.toJSON(),
        permissions: userPermissions.map((p) => p.toJSON()),
        roles: user.roles.map((r) => r.toJSON()),
        permissionNames,
        roleNames,
        sessionToken,
        scope: {
          provinceId: user.assignedProvinceId || null,
          regencyId: user.assignedRegencyId || null,
          districtId: user.assignedDistrictId || null,
          villageId: user.assignedVillageId || null,
        },
      };
    }

    req.sessionToken = sessionToken;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Enhanced Authorization middleware using database functions
 * Checks if user has required permissions
 */
const requirePermission = (permission) => async(req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (isVerifikator(req.user) && String(permission).includes(':create')) {
      return res.status(403).json({
        success: false,
        message: 'Verifikator tidak diizinkan membuat data baru.',
        code: 'CREATE_NOT_ALLOWED',
      });
    }

    if (isSuperAdmin(req.user) || isVerifikator(req.user)) {
      return next();
    }

    if (isAdminKabupaten(req.user)) {
      const normalizedPermission = String(permission || '');
      if (['housing:create', 'facility:create'].includes(normalizedPermission)) {
        return res.status(403).json({
          success: false,
          message: 'Admin kabupaten tidak diizinkan membuat data ini.',
          code: 'CREATE_NOT_ALLOWED',
        });
      }
    }

    if (isAdminDesa(req.user)) {
      const normalizedPermission = String(permission || '');
      if (normalizedPermission === 'facility:read') {
        return res.status(403).json({
          success: false,
          message: 'Admin desa tidak diizinkan mengakses daftar infrastruktur.',
          code: 'READ_NOT_ALLOWED',
        });
      }
    }

    // Use database function to check permission
    try {
      const hasPermissionResult = await hasPermission(req.user.id, permission);
      if (!hasPermissionResult) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    } catch (dbError) {
      // Fallback to original method
      console.warn('Database function failed, using fallback:', dbError.message);

      const userPermissions = await Permission.findAll({
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
                      userId: req.user.id,
                      isActive: true,
                      expiresAt: { [Op.or]: [null, { [Op.gt]: new Date() }] },
                    },
                  },
                ],
              },
            ],
          },
        ],
        where: {
          name: permission,
          isActive: true,
        },
      });

      if (userPermissions.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    }
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Enhanced Role-based authorization middleware
 * Checks if user has required role
 */
const requireRole = (roleName) => async(req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (isSuperAdmin(req.user)) {
      return next();
    }

    // Check if user has the required role
    const hasRole = req.user.roles.some((role) => role.name === roleName);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient role',
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  } catch (error) {
    console.error('Role authorization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Enhanced Location-based access control middleware using database functions
 * Checks if user can access data from specific location
 */
const requireLocationAccess = (_locationType) => async(req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (isSuperAdmin(req.user)) {
      return next();
    }

    // Extract location data from request
    const locationData = {
      provinceId: req.params.provinceId || req.body.provinceId || req.query.provinceId,
      regencyId: req.params.regencyId || req.body.regencyId || req.query.regencyId,
      districtId: req.params.districtId || req.body.districtId || req.query.districtId,
      villageId: req.params.villageId || req.body.villageId || req.query.villageId,
    };

    // Use database function to check location access
    try {
      const canAccess = await canAccessLocation(req.user.id, locationData);

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this location',
          code: 'LOCATION_ACCESS_DENIED',
        });
      }

      // Add location info to request
      req.locationData = locationData;
      next();
    } catch (dbError) {
      // Fallback to original method
      console.warn('Database function failed, using fallback:', dbError.message);

      // Get user's assigned location
      let userLocation = null;
      switch (req.user.userLevel) {
      case 'province':
        userLocation = await Province.findByPk(req.user.assignedProvinceId);
        break;
      case 'regency':
        userLocation = await Regency.findByPk(req.user.assignedRegencyId);
        break;
      case 'district':
        userLocation = await District.findByPk(req.user.assignedDistrictId);
        break;
      case 'village':
        userLocation = await Village.findByPk(req.user.assignedVillageId);
        break;
      default:
        userLocation = null;
        break;
      }

      if (!userLocation) {
        return res.status(403).json({
          success: false,
          message: 'No location assigned',
          code: 'NO_LOCATION_ASSIGNED',
        });
      }

      req.userLocation = userLocation;
      req.locationData = locationData;
      next();
    }
  } catch (error) {
    console.error('Location access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Location access error',
      code: 'LOCATION_ERROR',
    });
  }
};

/**
 * Resource-based access control middleware using database functions
 * Checks if user can perform action on specific resource
 */
const requireResourceAccess = (resourceType, action) => async(req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const resourceId = req.params.id || req.params.submissionId || req.body.id;

    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: 'Resource ID required',
        code: 'RESOURCE_ID_REQUIRED',
      });
    }

    if (isSuperAdmin(req.user) || isVerifikator(req.user)) {
      req.resourceId = resourceId;
      return next();
    }

    // Use database function to check resource access
    try {
      const canAccess = await canAccessResource(
        req.user.id,
        resourceType,
        action,
        resourceId,
      );

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied for this resource',
          code: 'RESOURCE_ACCESS_DENIED',
        });
      }

      req.resourceId = resourceId;
      next();
    } catch (dbError) {
      // Fallback to permission-based check
      console.warn('Database function failed, using fallback:', dbError.message);

      const permissionName = `${resourceType}:${action}`;
      const hasPermissionResult = await hasPermission(req.user.id, permissionName);
      if (!hasPermissionResult) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions for this resource',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      req.resourceId = resourceId;
      next();
    }
  } catch (error) {
    console.error('Resource access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Resource access error',
      code: 'RESOURCE_ERROR',
    });
  }
};

/**
 * Multiple permission check middleware
 * Checks if user has any of the specified permissions
 */
const requireAnyPermission = (permissions) => async(req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const normalizedPermissions = Array.isArray(permissions) ? permissions : [permissions];
    if (isVerifikator(req.user) && normalizedPermissions.some((perm) => String(perm).includes(':create'))) {
      return res.status(403).json({
        success: false,
        message: 'Verifikator tidak diizinkan membuat data baru.',
        code: 'CREATE_NOT_ALLOWED',
      });
    }

    if (isSuperAdmin(req.user) || isVerifikator(req.user)) {
      return next();
    }

    // Use database function to check multiple permissions
    try {
      const permissionResults = await hasMultiplePermissions(req.user.id, normalizedPermissions);

      const hasAnyPermissionResult = Object.values(permissionResults).some(Boolean);
      if (!hasAnyPermissionResult) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      req.permissionResults = permissionResults;
      next();
    } catch (dbError) {
      // Fallback to individual permission checks
      console.warn('Database function failed, using fallback:', dbError.message);

      const checkPermission = (permission) => hasPermission(req.user.id, permission);
      const permissionChecks = normalizedPermissions.map(checkPermission);

      const hasAnyPermissionResult = await Promise.all(permissionChecks)
        .then((results) => results.some((hasPermissionResult) => hasPermissionResult));

      if (!hasAnyPermissionResult) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }

      next();
    }
  } catch (error) {
    console.error('Multiple permission check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Permission check error',
      code: 'PERMISSION_ERROR',
    });
  }
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireLocationAccess,
  requireResourceAccess,
  requireAnyPermission,
};
