const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');
const {
  User, UserOAuthAccount, OAuthProvider, AuditLog, Role, UserRole, sequelize,
} = require('../models');
const { dataUtils } = require('../utils/lodashUtils');
const { errorFactory } = require('../errors/errorUtils');
const { generateTokens, createSession, ensureCitizenUserLevelEnum } = require('./authService');

const MASYARAKAT_ROLE_NAME = 'masyarakat';

const ensureMasyarakatRole = async (user, transaction) => {
  const existingRoles = Array.isArray(user.roles) ? user.roles : [];
  const normalizedRoles = existingRoles
    .map((role) => role?.name || role?.displayName || role)
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase());

  if (normalizedRoles.length > 0 && normalizedRoles.some((role) => role !== MASYARAKAT_ROLE_NAME)) {
    throw errorFactory.authorization(
      'Google OAuth hanya diperbolehkan untuk role masyarakat.',
      'OAUTH_ROLE_FORBIDDEN',
    );
  }

  let role = await Role.findOne({
    where: { name: MASYARAKAT_ROLE_NAME },
    transaction,
  });

  if (!role) {
    role = await Role.create({
      name: MASYARAKAT_ROLE_NAME,
      displayName: 'Masyarakat',
      description: 'Pengguna masyarakat SIPALING PKP',
      isSystemRole: false,
      isDeletable: true,
      isActive: true,
    }, { transaction });
  }

  const existingUserRole = await UserRole.findOne({
    where: { userId: user.id, roleId: role.id, isActive: true },
    transaction,
  });

  if (!existingUserRole) {
    await UserRole.create({
      userId: user.id,
      roleId: role.id,
      isActive: true,
    }, { transaction });
  }

  if (user.userLevel !== 'citizen' || user.canInheritData !== false) {
    await user.update({
      userLevel: 'citizen',
      canInheritData: false,
      inheritanceDepth: 'direct',
    }, { transaction });
  }

  return role;
};

const enforceMasyarakatOAuthUser = async (user) => {
  await ensureCitizenUserLevelEnum();
  await sequelize.transaction(async (transaction) => {
    await ensureMasyarakatRole(user, transaction);
  });

  return User.findByPk(user.id, {
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
};

/**
 * Get Google OAuth provider from database
 */
async function getGoogleProvider() {
  const provider = await OAuthProvider.findOne({
    where: {
      name: 'google',
      isActive: true,
    },
  });

  if (!provider) {
    throw errorFactory.notFound('Google OAuth provider not configured', 'OAUTH_PROVIDER_NOT_FOUND');
  }

  return provider;
}

/**
 * Initialize Google OAuth client
 */
function getGoogleOAuthClient(provider) {
  return new OAuth2Client(
    provider.clientId,
    provider.clientSecret,
    provider.redirectUri,
  );
}

/**
 * Get Google OAuth authorization URL
 */
async function getGoogleAuthUrl(state = null) {
  const provider = await getGoogleProvider();
  const client = getGoogleOAuthClient(provider);

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: state || undefined,
  });

  return {
    authUrl,
    providerId: provider.id,
  };
}

/**
 * Verify Google OAuth token and get user info
 */
async function verifyGoogleToken(code) {
  const provider = await getGoogleProvider();
  const client = getGoogleOAuthClient(provider);

  try {
    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    let userInfo;

    // Try to get user info from id_token first
    if (tokens.id_token) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience: provider.clientId,
        });
        userInfo = ticket.getPayload();
      } catch (idTokenError) {
        // If id_token verification fails, use userinfo endpoint
        const { data } = await client.request({
          url: 'https://www.googleapis.com/oauth2/v2/userinfo',
        });
        userInfo = data;
      }
    } else {
      // Use userinfo endpoint if id_token is not available
      const { data } = await client.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo',
      });
      userInfo = data;
    }

    const {
      id: providerUserId,
      sub,
      email,
      name,
      picture: avatarUrl,
    } = userInfo;

    // Use 'id' or 'sub' as providerUserId
    const finalProviderUserId = providerUserId || sub;

    if (!finalProviderUserId || !email) {
      throw new Error('Missing required user information from Google');
    }

    return {
      providerUserId: finalProviderUserId,
      email,
      name: name || email.split('@')[0],
      avatarUrl: avatarUrl || null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };
  } catch (error) {
    throw errorFactory.authentication('Failed to verify Google token', 'OAUTH_VERIFICATION_FAILED', error);
  }
}

/**
 * Find or create user from OAuth data
 */
async function findOrCreateOAuthUser(oauthData, provider, autoRegister = false) {
  const { email, name, providerUserId } = oauthData;

  // Check if OAuth account already exists
  const existingOAuthAccount = await UserOAuthAccount.findOne({
    where: {
      providerId: provider.id,
      providerUserId,
      isActive: true,
    },
    include: [
      {
        model: User,
        as: 'user',
        include: [
          {
            model: Role,
            as: 'roles',
            through: { attributes: [] },
            where: { isActive: true },
            required: false,
          },
        ],
      },
    ],
  });

  // If OAuth account exists, return the user
  if (existingOAuthAccount && existingOAuthAccount.user) {
    // Update OAuth account tokens
    await existingOAuthAccount.update({
      email,
      name,
      avatarUrl: oauthData.avatarUrl,
      accessToken: oauthData.accessToken,
      refreshToken: oauthData.refreshToken,
      tokenExpiresAt: oauthData.expiresAt,
    });

    return existingOAuthAccount.user;
  }

  // Check if user with this email already exists
  const existingUser = await User.findOne({
    where: { email },
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

  // If user exists, link OAuth account to existing user
  if (existingUser) {
    // Check if OAuth account already linked (but inactive)
    const inactiveOAuthAccount = await UserOAuthAccount.findOne({
      where: {
        userId: existingUser.id,
        providerId: provider.id,
        providerUserId,
      },
    });

    if (inactiveOAuthAccount) {
      // Reactivate and update
      await inactiveOAuthAccount.update({
        isActive: true,
        email,
        name,
        avatarUrl: oauthData.avatarUrl,
        accessToken: oauthData.accessToken,
        refreshToken: oauthData.refreshToken,
        tokenExpiresAt: oauthData.expiresAt,
      });
    } else {
      // Create new OAuth account
      await UserOAuthAccount.create({
        userId: existingUser.id,
        providerId: provider.id,
        providerUserId,
        email,
        name,
        avatarUrl: oauthData.avatarUrl,
        accessToken: oauthData.accessToken,
        refreshToken: oauthData.refreshToken,
        tokenExpiresAt: oauthData.expiresAt,
      });
    }

    return existingUser;
  }

  // Auto-register new user if enabled
  if (!autoRegister && !provider.autoRegister) {
    throw errorFactory.authentication(
      'User not found. Please register first or contact administrator.',
      'USER_NOT_FOUND',
    );
  }

  // Create new user (auto-register)
  // Note: For OAuth users, we need to set a dummy password hash
  // They will only be able to login via OAuth
  const dummyPassword = nanoid(32);
  const passwordHash = await bcrypt.hash(dummyPassword, 12);

  const newUser = await User.create({
    email,
    passwordHash,
    fullName: name || email.split('@')[0],
    emailVerified: true, // OAuth emails are considered verified
    isActive: true,
    userLevel: 'citizen',
    canInheritData: false,
    inheritanceDepth: 'direct',
  });

  // Create OAuth account
  await UserOAuthAccount.create({
    userId: newUser.id,
    providerId: provider.id,
    providerUserId,
    email,
    name,
    avatarUrl: oauthData.avatarUrl,
    accessToken: oauthData.accessToken,
    refreshToken: oauthData.refreshToken,
    tokenExpiresAt: oauthData.expiresAt,
  });

  // Fetch user with roles
  const userWithRoles = await User.findByPk(newUser.id, {
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

  return enforceMasyarakatOAuthUser(userWithRoles);
}

/**
 * Handle Google OAuth callback
 */
async function handleGoogleCallback(code, deviceInfo, ipAddress, userAgent) {
  try {
    // Verify Google token and get user info
    const oauthData = await verifyGoogleToken(code);
    const provider = await getGoogleProvider();

    // Find or create user
    const user = await findOrCreateOAuthUser(oauthData, provider, true);
    const enforcedUser = await enforceMasyarakatOAuthUser(user);

    // Check if user is active
    if (!enforcedUser.isActive) {
      throw errorFactory.authentication('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    // Create session
    const session = await createSession(enforcedUser, deviceInfo, ipAddress, userAgent);

    // Generate tokens
    const tokens = generateTokens(enforcedUser, session);

    // Log OAuth login
    await AuditLog.create({
      userId: enforcedUser.id,
      action: 'oauth_login',
      resourceType: 'user_session',
      resourceId: session.id,
      ipAddress,
      userAgent,
      metadata: {
        provider: 'google',
        email: oauthData.email,
        userLevel: enforcedUser.userLevel,
      },
    });

    return {
      user: dataUtils.omitSensitive(enforcedUser.toJSON(), ['passwordHash']),
      tokens,
    };
  } catch (error) {
    if (error.code) {
      throw error; // Re-throw custom errors
    }
    throw errorFactory.database('OAuth authentication failed', error);
  }
}

/**
 * Link Google OAuth account to existing user
 */
async function linkGoogleAccount(userId, code, ipAddress, userAgent) {
  try {
    // Verify Google token and get user info
    const oauthData = await verifyGoogleToken(code);
    const provider = await getGoogleProvider();

    // Check if user exists
    const user = await User.findByPk(userId, {
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
    if (!user) {
      throw errorFactory.notFound('User not found', 'USER_NOT_FOUND');
    }

    await sequelize.transaction(async (transaction) => {
      await ensureMasyarakatRole(user, transaction);
    });

    // Check if OAuth account already exists for this provider user
    const existingOAuthAccount = await UserOAuthAccount.findOne({
      where: {
        providerId: provider.id,
        providerUserId: oauthData.providerUserId,
        isActive: true,
      },
    });

    if (existingOAuthAccount && existingOAuthAccount.userId !== userId) {
      throw errorFactory.conflict(
        'This Google account is already linked to another user',
        'OAUTH_ACCOUNT_LINKED',
      );
    }

    // Check if user already has this OAuth account linked
    const userOAuthAccount = await UserOAuthAccount.findOne({
      where: {
        userId,
        providerId: provider.id,
        providerUserId: oauthData.providerUserId,
      },
    });

    if (userOAuthAccount) {
      // Update existing OAuth account
      await userOAuthAccount.update({
        isActive: true,
        email: oauthData.email,
        name: oauthData.name,
        avatarUrl: oauthData.avatarUrl,
        accessToken: oauthData.accessToken,
        refreshToken: oauthData.refreshToken,
        tokenExpiresAt: oauthData.expiresAt,
      });
    } else {
      // Create new OAuth account
      await UserOAuthAccount.create({
        userId,
        providerId: provider.id,
        providerUserId: oauthData.providerUserId,
        email: oauthData.email,
        name: oauthData.name,
        avatarUrl: oauthData.avatarUrl,
        accessToken: oauthData.accessToken,
        refreshToken: oauthData.refreshToken,
        tokenExpiresAt: oauthData.expiresAt,
      });
    }

    // Log OAuth account linking
    await AuditLog.create({
      userId,
      action: 'oauth_account_linked',
      resourceType: 'user_oauth_account',
      ipAddress,
      userAgent,
      metadata: {
        provider: 'google',
        email: oauthData.email,
      },
    });

    return {
      success: true,
      message: 'Google account linked successfully',
    };
  } catch (error) {
    if (error.code) {
      throw error; // Re-throw custom errors
    }
    throw errorFactory.database('Failed to link Google account', error);
  }
}

/**
 * Unlink Google OAuth account from user
 */
async function unlinkGoogleAccount(userId, ipAddress, userAgent) {
  try {
    const provider = await getGoogleProvider();

    // Find OAuth account
    const oauthAccount = await UserOAuthAccount.findOne({
      where: {
        userId,
        providerId: provider.id,
        isActive: true,
      },
    });

    if (!oauthAccount) {
      throw errorFactory.notFound('Google account not linked', 'OAUTH_ACCOUNT_NOT_FOUND');
    }

    // Deactivate OAuth account
    await oauthAccount.update({
      isActive: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    });

    // Log OAuth account unlinking
    await AuditLog.create({
      userId,
      action: 'oauth_account_unlinked',
      resourceType: 'user_oauth_account',
      ipAddress,
      userAgent,
      metadata: {
        provider: 'google',
      },
    });

    return {
      success: true,
      message: 'Google account unlinked successfully',
    };
  } catch (error) {
    if (error.code) {
      throw error; // Re-throw custom errors
    }
    throw errorFactory.database('Failed to unlink Google account', error);
  }
}

module.exports = {
  getGoogleAuthUrl,
  handleGoogleCallback,
  linkGoogleAccount,
  unlinkGoogleAccount,
};
