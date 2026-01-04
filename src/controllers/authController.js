const {
  registerUser,
  authenticateUser,
  verifyOtp,
  resendOtp,
  reactivateAccount,
  refreshAccessToken,
  signOutUser,
} = require('../services/authService');
const { asyncErrorHandler } = require('../errors/errorMiddleware');

/**
 * Sign up new user
 */
const signUp = asyncErrorHandler(async(req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
    otpChannel,
  } = req.body;

  const userLevel = 'citizen';
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

  // Create device info
  const deviceInfo = {
    browser: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  };

  // Register user using service
  const result = await registerUser(
    {
      email,
      password,
      fullName,
      phone,
      userLevel,
    },
    deviceInfo,
    req.ip,
    req.headers['user-agent'],
    {
      idempotencyKey,
      otpChannel,
    },
  );

  res.status(201).json({
    success: true,
    message: 'OTP sent',
    data: result,
  });
});

/**
 * Verify account with OTP
 */
const verifyAccount = asyncErrorHandler(async(req, res) => {
  const { userId, code, channel } = req.body;

  const deviceInfo = {
    browser: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  };

  const result = await verifyOtp(
    userId,
    code,
    deviceInfo,
    req.ip,
    req.headers['user-agent'],
    channel,
  );

  res.json({
    success: true,
    message: 'Account verified',
    data: result,
  });
});

/**
 * Resend OTP
 */
const resendOtpCode = asyncErrorHandler(async(req, res) => {
  const { userId, channel } = req.body;

  const result = await resendOtp(
    userId,
    channel,
    req.ip,
    req.headers['user-agent'],
  );

  res.json({
    success: true,
    message: 'OTP resent',
    data: result,
  });
});

/**
 * Reactivate account (send OTP for inactive user)
 */
const reactivate = asyncErrorHandler(async(req, res) => {
  const { email, channel } = req.body;

  const result = await reactivateAccount(
    email,
    channel,
    req.ip,
    req.headers['user-agent'],
  );

  res.json({
    success: true,
    message: 'OTP sent',
    data: result,
  });
});

/**
 * Sign in user
 */
const signIn = asyncErrorHandler(async(req, res) => {
  const { email, password } = req.body;

  // Create device info
  const deviceInfo = {
    browser: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
  };

  // Authenticate user using service
  const result = await authenticateUser(
    email,
    password,
    deviceInfo,
    req.ip,
    req.headers['user-agent'],
  );

  res.json({
    success: true,
    message: 'Sign in successful',
    data: result,
  });
});

/**
 * Refresh access token
 */
const refreshToken = asyncErrorHandler(async(req, res) => {
  const { refreshToken: refreshTokenParam } = req.body;

  // Refresh token using service
  const result = await refreshAccessToken(refreshTokenParam);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: result,
  });
});

/**
 * Sign out user
 */
const signOut = asyncErrorHandler(async(req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  // Sign out user using service
  await signOutUser(token, req.ip, req.headers['user-agent']);

  res.json({
    success: true,
    message: 'Sign out successful',
  });
});

/**
 * Get current user profile
 */
const getProfile = asyncErrorHandler(async(req, res) => {
  // This should be moved to UserService, but keeping for now
  res.json({
    success: true,
    message: 'Profile endpoint moved to user controller',
  });
});

module.exports = {
  signUp,
  signIn,
  verifyAccount,
  resendOtpCode,
  reactivate,
  refreshToken,
  signOut,
  getProfile,
};
