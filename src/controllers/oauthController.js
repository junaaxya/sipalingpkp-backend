const {
  getGoogleAuthUrl,
  handleGoogleCallback,
  linkGoogleAccount,
  unlinkGoogleAccount,
} = require('../services/oauthService');
const { asyncErrorHandler } = require('../errors/errorMiddleware');

/**
 * Initiate Google OAuth login
 * GET /api/auth/oauth/google
 */
const initiateGoogleAuth = asyncErrorHandler(async(req, res) => {
  const { state } = req.query;

  const result = await getGoogleAuthUrl(state);

  res.json({
    success: true,
    message: 'Google OAuth URL generated',
    data: {
      authUrl: result.authUrl,
      providerId: result.providerId,
    },
  });
});

/**
 * Handle Google OAuth callback
 * GET /api/auth/oauth/google/callback
 */
const handleGoogleCallbackController = asyncErrorHandler(async(req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code is required',
      code: 'OAUTH_CODE_REQUIRED',
    });
  }

  // Create device info
  const deviceInfo = {
    browser: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  };

  // Handle OAuth callback
  const result = await handleGoogleCallback(
    code,
    deviceInfo,
    req.ip,
    req.headers['user-agent'],
  );

  const userRoles = result?.user?.roles || [];
  const roleNames = userRoles
    .map((role) => role?.name || role?.displayName || role)
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase());
  const hasNonMasyarakatRole = roleNames.some((role) => role !== 'masyarakat');
  if (result?.user?.userLevel !== 'citizen' || hasNonMasyarakatRole) {
    return res.status(403).json({
      success: false,
      message: 'Google OAuth hanya diperbolehkan untuk role masyarakat.',
      code: 'OAUTH_ROLE_FORBIDDEN',
    });
  }

  // If state is provided, redirect to frontend with tokens
  if (state) {
    // Redirect to frontend with tokens in query params or hash
    // Note: In production, use a more secure method (e.g., postMessage)
    const redirectUrl = new URL(state);
    redirectUrl.searchParams.set('accessToken', result.tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', result.tokens.refreshToken);
    return res.redirect(redirectUrl.toString());
  }

  // Return JSON response
  res.json({
    success: true,
    message: 'Google OAuth authentication successful',
    data: result,
  });
});

/**
 * Link Google account to existing user
 * POST /api/auth/oauth/google/link
 */
const linkGoogleAccountController = asyncErrorHandler(async(req, res) => {
  const { code } = req.body;
  const userId = req.user.id; // From authenticateToken middleware

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code is required',
      code: 'OAUTH_CODE_REQUIRED',
    });
  }

  const result = await linkGoogleAccount(
    userId,
    code,
    req.ip,
    req.headers['user-agent'],
  );

  res.json({
    success: true,
    message: result.message,
    data: result,
  });
});

/**
 * Unlink Google account from user
 * DELETE /api/auth/oauth/google/unlink
 */
const unlinkGoogleAccountController = asyncErrorHandler(async(req, res) => {
  const userId = req.user.id; // From authenticateToken middleware

  const result = await unlinkGoogleAccount(
    userId,
    req.ip,
    req.headers['user-agent'],
  );

  res.json({
    success: true,
    message: result.message,
    data: result,
  });
});

module.exports = {
  initiateGoogleAuth,
  handleGoogleCallback: handleGoogleCallbackController,
  linkGoogleAccount: linkGoogleAccountController,
  unlinkGoogleAccount: unlinkGoogleAccountController,
};
