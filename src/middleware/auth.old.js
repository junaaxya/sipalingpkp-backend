const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const {
  User, UserSession, Permission, RolePermission, UserRole, Role, Province, Regency, District, Village,
} = require('../models');

/**
 * Authentication middleware
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
        message: 'Session expired',
        code: 'SESSION_EXPIRED',
      });
    }

    // Update last activity
    await session.update({
      lastActivityAt: new Date(),
    });

    // Attach user and session to request
    req.user = user;
    req.session = session;
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
 * Authorization middleware
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

    // Get user permissions
    const userPermissions = await Permission.findAll({
      include: [
        {
          model: RolePermission,
          as: 'rolePermissions',
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
          where: {
            isActive: true,
            expiresAt: { [Op.or]: [null, { [Op.gt]: new Date() }] },
          },
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
 * Role-based authorization middleware
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
 * Location-based access control middleware
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

    // Add location info to request
    req.userLocation = userLocation;
    next();
  } catch (error) {
    console.error('Location access error:', error);
    return res.status(500).json({
      success: false,
      message: 'Location access error',
      code: 'LOCATION_ERROR',
    });
  }
};

module.exports = {
  authenticateToken,
  requirePermission,
  requireRole,
  requireLocationAccess,
};
