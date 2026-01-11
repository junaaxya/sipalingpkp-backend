const express = require('express');
const {
  signUp,
  signIn,
  verifyAccount,
  resendOtpCode,
  reactivate,
  forgotPassword,
  resetPassword,
  refreshToken,
  signOut,
} = require('../controllers/authController');
const {
  initiateGoogleAuth,
  handleGoogleCallback,
  linkGoogleAccount,
  unlinkGoogleAccount,
} = require('../controllers/oauthController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/signup',
  validateRequest('auth', 'signUp'),
  signUp,
);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify account with OTP
 * @access  Public
 */
router.post(
  '/verify',
  validateRequest('auth', 'verifyOtp'),
  verifyAccount,
);

router.post(
  '/verify-otp',
  validateRequest('auth', 'verifyOtp'),
  verifyAccount,
);

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend OTP code
 * @access  Public
 */
router.post(
  '/resend-otp',
  validateRequest('auth', 'resendOtp'),
  resendOtpCode,
);

/**
 * @route   POST /api/auth/reactivate
 * @desc    Send OTP for inactive account
 * @access  Public
 */
router.post(
  '/reactivate',
  validateRequest('auth', 'reactivate'),
  reactivate,
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset via OTP or link
 * @access  Public
 */
router.post(
  '/forgot-password',
  validateRequest('auth', 'forgotPassword'),
  forgotPassword,
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with OTP or token
 * @access  Public
 */
router.post(
  '/reset-password',
  validateRequest('auth', 'resetPassword'),
  resetPassword,
);

/**
 * @route   POST /api/auth/signin
 * @desc    Authenticate user and return token
 * @access  Public
 */
router.post(
  '/signin',
  validateRequest('auth', 'signIn'),
  signIn,
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  validateRequest('auth', 'refreshToken'),
  refreshToken,
);

/**
 * @route   POST /api/auth/signout
 * @desc    Sign out user and invalidate session
 * @access  Public (but requires valid token)
 */
router.post('/signout', authenticateToken, signOut);

/**
 * @route   GET /api/auth/oauth/google
 * @desc    Initiate Google OAuth login - returns authorization URL
 * @access  Public
 */
router.get('/oauth/google', initiateGoogleAuth);

/**
 * @route   GET /api/auth/oauth/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public
 */
router.get('/oauth/google/callback', handleGoogleCallback);

/**
 * @route   POST /api/auth/oauth/google/link
 * @desc    Link Google account to existing user
 * @access  Private (requires authentication)
 */
router.post(
  '/oauth/google/link',
  authenticateToken,
  validateRequest('oauth', 'linkAccount'),
  linkGoogleAccount,
);

/**
 * @route   DELETE /api/auth/oauth/google/unlink
 * @desc    Unlink Google account from user
 * @access  Private (requires authentication)
 */
router.delete('/oauth/google/unlink', authenticateToken, unlinkGoogleAccount);

module.exports = router;
