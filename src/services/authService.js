const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const { Op, QueryTypes } = require('sequelize');
const nodemailer = require('nodemailer');
const axios = require('axios');
const {
  User,
  UserSession,
  AuditLog,
  Role,
  Permission,
  RolePermission,
  UserRole,
  sequelize,
} = require('../models');
const { dataUtils } = require('../utils/lodashUtils');
const { errorFactory } = require('../errors/errorUtils');
const {
  createNotification,
  createNotificationsForUsers,
  findUsersWithRole,
} = require('./notificationService');
const {
  getUserPermissions,
  getUserRoles,
} = require('./authFunctionsService');

const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS, 10) || 12;
const OTP_TTL_MS = parseInt(process.env.OTP_TTL_MS, 10) || 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = parseInt(process.env.OTP_RESEND_COOLDOWN_MS, 10) || 60 * 1000;
const PASSWORD_RESET_TTL_MS = parseInt(process.env.PASSWORD_RESET_TTL_MS, 10) || 15 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = parseInt(
  process.env.PASSWORD_RESET_RESEND_COOLDOWN_MS,
  10,
) || 60 * 1000;
const PASSWORD_RESET_TTL_MINUTES = Math.max(1, Math.round(PASSWORD_RESET_TTL_MS / 60000));

const isBcryptHash = (value) =>
  typeof value === 'string' && value.startsWith('$2');

const normalizeOtpChannel = (channel) => {
  const normalized = String(channel || 'email').trim().toLowerCase();
  if (normalized === 'phone' || normalized === 'wa' || normalized === 'whatsapp') {
    return 'whatsapp';
  }
  return 'email';
};

const resolveOtpChannel = (user, requestedChannel) => {
  const raw = String(requestedChannel || '').trim().toLowerCase();
  if (!raw) {
    return user?.phone ? 'whatsapp' : 'email';
  }
  const normalized = normalizeOtpChannel(raw);
  if (normalized === 'whatsapp' && user?.phone) {
    return 'whatsapp';
  }
  return 'email';
};

const getAvailableOtpChannels = (user) => {
  if (user?.phone) {
    return ['whatsapp', 'email'];
  }
  return ['email'];
};

const getOtpLastSentAt = (otpExpiresAt) => {
  if (!otpExpiresAt) return null;
  return new Date(new Date(otpExpiresAt).getTime() - OTP_TTL_MS);
};

const getOtpCooldownSecondsFromLastSent = (lastSentAt) => {
  if (!lastSentAt) return 0;
  const nextAllowed = lastSentAt.getTime() + OTP_RESEND_COOLDOWN_MS;
  return Math.max(0, Math.ceil((nextAllowed - Date.now()) / 1000));
};

const getOtpCooldownSeconds = (otpExpiresAt) => (
  getOtpCooldownSecondsFromLastSent(getOtpLastSentAt(otpExpiresAt))
);

const normalizeResetMethod = (method) => {
  const normalized = String(method || '').trim().toLowerCase();
  return normalized === 'otp' ? 'otp' : 'link';
};

const hashResetToken = (value) => (
  crypto.createHash('sha256').update(String(value)).digest('hex')
);

const buildPasswordResetTokenValue = (type, rawToken) => (
  `${type}:${hashResetToken(rawToken)}`
);

const getPasswordResetLastSentAt = (expiresAt) => {
  if (!expiresAt) return null;
  return new Date(new Date(expiresAt).getTime() - PASSWORD_RESET_TTL_MS);
};

const getPasswordResetCooldownSecondsFromLastSent = (lastSentAt) => {
  if (!lastSentAt) return 0;
  const nextAllowed = lastSentAt.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS;
  return Math.max(0, Math.ceil((nextAllowed - Date.now()) / 1000));
};

const getPasswordResetCooldownSeconds = (expiresAt) => (
  getPasswordResetCooldownSecondsFromLastSent(getPasswordResetLastSentAt(expiresAt))
);

const maskEmail = (email) => {
  if (!email) return '';
  const [name, domain] = String(email).split('@');
  if (!domain) return email;
  const maskedName = name.length <= 2 ? `${name[0] || ''}*` : `${name[0]}***${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
};

const maskPhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
};

const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
};

let cachedMailTransport = null;

const buildMailTransport = () => {
  if (cachedMailTransport) return cachedMailTransport;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  const port = parseInt(SMTP_PORT, 10);
  const secure = SMTP_SECURE === 'true' || port === 465;

  cachedMailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return cachedMailTransport;
};

const buildOtpEmailHtml = (otpCode) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
    <h2 style="margin-bottom: 8px;">Kode OTP SIPALING PKP</h2>
    <p>Gunakan kode berikut untuk verifikasi akun Anda:</p>
    <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">
      ${otpCode}
    </div>
    <p style="margin-bottom: 4px;">Kode berlaku selama 10 menit.</p>
    <p style="color: #6b7280;">Jika Anda tidak meminta OTP ini, abaikan pesan ini.</p>
  </div>
`;

const buildPasswordResetOtpEmailHtml = (otpCode) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
    <h2 style="margin-bottom: 8px;">Reset Password SIPALING PKP</h2>
    <p>Gunakan kode berikut untuk mereset password akun Anda:</p>
    <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">
      ${otpCode}
    </div>
    <p style="margin-bottom: 4px;">Kode berlaku selama ${PASSWORD_RESET_TTL_MINUTES} menit.</p>
    <p style="color: #6b7280;">Jika Anda tidak meminta reset password ini, abaikan pesan ini.</p>
  </div>
`;

const buildPasswordResetLinkEmailHtml = (resetUrl) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2933;">
    <h2 style="margin-bottom: 8px;">Reset Password SIPALING PKP</h2>
    <p>Klik tombol di bawah ini untuk mereset password akun Anda:</p>
    <p style="margin: 20px 0;">
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1d4ed8; color: #ffffff; text-decoration: none; border-radius: 6px;">
        Reset Password
      </a>
    </p>
    <p style="word-break: break-all;">Atau gunakan tautan berikut: ${resetUrl}</p>
    <p style="margin-bottom: 4px;">Tautan berlaku selama ${PASSWORD_RESET_TTL_MINUTES} menit.</p>
    <p style="color: #6b7280;">Jika Anda tidak meminta reset password ini, abaikan pesan ini.</p>
  </div>
`;

const getFrontendBaseUrl = () => {
  const base = process.env.FRONTEND_BASE_URL || process.env.CLIENT_URL || 'http://localhost:3000';
  return base.replace(/\/$/, '');
};

const buildPasswordResetLink = (token) => (
  `${getFrontendBaseUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`
);

const sendOtpToProvider = async (user, otpCode, channel) => {
  const resolvedChannel = resolveOtpChannel(user, channel);

  if (resolvedChannel === 'email') {
    const transport = buildMailTransport();
    if (!transport) {
      throw errorFactory.validation('SMTP belum dikonfigurasi', 'smtp');
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await transport.sendMail({
      from,
      to: user.email,
      subject: 'Kode OTP SIPALING PKP',
      html: buildOtpEmailHtml(otpCode),
    });

    return {
      channel: 'email',
      destination: user.email,
    };
  }

  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    throw errorFactory.validation('Fonnte token belum dikonfigurasi', 'whatsapp');
  }

  const targetPhone = normalizePhoneNumber(user.phone);
  if (!targetPhone) {
    throw errorFactory.validation('Nomor WhatsApp tidak tersedia', 'whatsapp');
  }

  const message = `Kode OTP SIPALING PKP Anda adalah: ${otpCode}. Berlaku 10 menit. Jangan berikan kode ini kepada siapapun.`;
  const maskedToken = `${token.slice(0, 4)}***`;
  console.log(`[OTP][WA] Sending OTP to ${targetPhone} (token: ${maskedToken})`);

  try {
    await axios.post('https://api.fonnte.com/send', {
      target: targetPhone,
      message,
    }, {
      headers: {
        Authorization: token,
      },
    });
  } catch (error) {
    const responseData = error?.response?.data || error.message;
    console.error('[OTP][WA] Fonnte error:', responseData);
    const otpError = errorFactory.validation('Gagal mengirim OTP WhatsApp', 'whatsapp');
    otpError.details = { provider: 'fonnte', response: responseData };
    throw otpError;
  }

  return {
    channel: 'whatsapp',
    destination: targetPhone,
  };
};

const sendPasswordResetMessage = async (user, method, channel, payload = {}) => {
  const resolvedChannel = resolveOtpChannel(user, channel);

  if (resolvedChannel === 'email') {
    const transport = buildMailTransport();
    if (!transport) {
      throw errorFactory.validation('SMTP belum dikonfigurasi', 'smtp');
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const subject = 'Reset Password SIPALING PKP';
    const html = method === 'otp'
      ? buildPasswordResetOtpEmailHtml(payload.otpCode)
      : buildPasswordResetLinkEmailHtml(payload.resetUrl);

    await transport.sendMail({
      from,
      to: user.email,
      subject,
      html,
    });

    return {
      channel: 'email',
      destination: user.email,
    };
  }

  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    throw errorFactory.validation('Fonnte token belum dikonfigurasi', 'whatsapp');
  }

  const targetPhone = normalizePhoneNumber(user.phone);
  if (!targetPhone) {
    throw errorFactory.validation('Nomor WhatsApp tidak tersedia', 'whatsapp');
  }

  const message = method === 'otp'
    ? `Kode reset password SIPALING PKP Anda adalah: ${payload.otpCode}. Berlaku ${PASSWORD_RESET_TTL_MINUTES} menit.`
    : `Klik tautan berikut untuk reset password SIPALING PKP Anda: ${payload.resetUrl}. Berlaku ${PASSWORD_RESET_TTL_MINUTES} menit.`;

  const maskedToken = `${token.slice(0, 4)}***`;
  console.log(`[RESET][WA] Sending password reset to ${targetPhone} (token: ${maskedToken})`);

  try {
    await axios.post('https://api.fonnte.com/send', {
      target: targetPhone,
      message,
    }, {
      headers: {
        Authorization: token,
      },
    });
  } catch (error) {
    const responseData = error?.response?.data || error.message;
    console.error('[RESET][WA] Fonnte error:', responseData);
    const resetError = errorFactory.validation('Gagal mengirim reset password WhatsApp', 'whatsapp');
    resetError.details = { provider: 'fonnte', response: responseData };
    throw resetError;
  }

  return {
    channel: 'whatsapp',
    destination: targetPhone,
  };
};

let citizenEnumEnsured = false;
let citizenEnumEnsuring = null;

const ensureCitizenUserLevelEnum = async () => {
  if (citizenEnumEnsured) return;
  if (citizenEnumEnsuring) return citizenEnumEnsuring;

  citizenEnumEnsuring = (async () => {
    const dialect = sequelize.getDialect();
    const queryInterface = sequelize.getQueryInterface();
    const table = await queryInterface.describeTable('users');
    const userLevelMeta = table.user_level || table.userLevel;
    const columnType = String(userLevelMeta?.type || '');
    if (columnType.toLowerCase().includes('citizen')) {
      citizenEnumEnsured = true;
      return;
    }

    if (dialect === 'postgres') {
      const enumRows = await sequelize.query(
        `
        SELECT t.typname AS name
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_attribute a ON a.atttypid = t.oid
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relname = 'users'
          AND a.attname = 'user_level'
        LIMIT 1;
        `,
        { type: QueryTypes.SELECT },
      );
      const enumType = enumRows?.[0]?.name;
      if (!enumType) {
        citizenEnumEnsured = true;
        return;
      }

      const existing = await sequelize.query(
        `
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = :enumType
          AND e.enumlabel = 'citizen'
        LIMIT 1;
        `,
        { replacements: { enumType }, type: QueryTypes.SELECT },
      );

      if (!existing?.length) {
        await sequelize.query(
          `ALTER TYPE "${enumType}" ADD VALUE IF NOT EXISTS 'citizen';`,
        );
      }
    } else if (dialect === 'mysql' || dialect === 'mariadb') {
      await sequelize.query(`
        ALTER TABLE users
        MODIFY user_level ENUM('province', 'regency', 'district', 'village', 'citizen') NOT NULL;
      `);
    }
    citizenEnumEnsured = true;
  })().finally(() => {
    citizenEnumEnsuring = null;
  });

  return citizenEnumEnsuring;
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sendOtp = async (user, channel = 'email', options = {}) => {
  if (!user?.otpCode) {
    throw errorFactory.validation('Kode OTP tidak tersedia', 'otp');
  }

  const resolvedChannel = resolveOtpChannel(user, channel);
  const destination = resolvedChannel === 'whatsapp' ? user.phone : user.email;
  if (!destination) {
    throw errorFactory.validation('Channel OTP tidak tersedia untuk pengguna ini', 'otpChannel');
  }

  const lastSentAt = options.lastSentAt || getOtpLastSentAt(user.otpExpiresAt);
  if (options.enforceCooldown !== false) {
    const retryAfter = getOtpCooldownSecondsFromLastSent(lastSentAt);
    if (retryAfter > 0) {
      const error = errorFactory.validation('OTP belum bisa dikirim ulang', 'otp');
      error.retryAfter = retryAfter;
      throw error;
    }
  }

  const result = await sendOtpToProvider(user, user.otpCode, resolvedChannel);

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[OTP] ${resolvedChannel} -> ${destination}: ${user.otpCode}`);
  }

  return result;
};

/**
 * Generate JWT tokens for user
 */
function generateTokens(user, session) {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      sessionToken: session.sessionToken,
      userLevel: user.userLevel,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  );

  const refreshToken = jwt.sign(
    {
      userId: user.id,
      sessionToken: session.sessionToken,
      type: 'refresh',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' },
  );

  return { accessToken, refreshToken };
}

/**
 * Create user session
 */
async function createSession(user, deviceInfo, ipAddress, userAgent) {
  const sessionToken = nanoid(32);
  const refreshToken = nanoid(32);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const session = await UserSession.create({
    userId: user.id,
    sessionToken,
    refreshToken,
    deviceInfo,
    ipAddress,
    userAgent,
    expiresAt,
  });

  return session;
}

/**
 * Register new user
 */
async function registerUser(userData, deviceInfo, ipAddress, userAgent, options = {}) {
  const {
    email, password, fullName, phone,
  } = userData;
  const idempotencyKey = options?.idempotencyKey || null;
  const requestedChannel = options?.otpChannel;

  try {
    await ensureCitizenUserLevelEnum();

    if (idempotencyKey) {
      const existingRequest = await AuditLog.findOne({
        where: {
          action: 'otp_request',
          requestId: idempotencyKey,
        },
        order: [['created_at', 'DESC']],
      });

      if (existingRequest?.metadata?.userId) {
        const existingUser = await User.findByPk(existingRequest.metadata.userId);
        if (existingUser && !existingUser.isActive) {
          const channel = resolveOtpChannel(existingUser, existingRequest.metadata.channel || requestedChannel);
          return {
            userId: existingUser.id,
            otpExpiresAt: existingUser.otpExpiresAt,
            otpChannel: channel,
            cooldownSeconds: getOtpCooldownSeconds(existingUser.otpExpiresAt),
            availableChannels: getAvailableOtpChannels(existingUser),
          };
        }
      }
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.isActive) {
        throw errorFactory.conflict('User with this email already exists', 'USER_EXISTS');
      }

      if (existingUser.userLevel && existingUser.userLevel !== 'citizen') {
        throw errorFactory.conflict('User with this email already exists', 'USER_EXISTS');
      }

      const otpInfo = await requestActivationOtp(
        existingUser,
        requestedChannel,
        ipAddress,
        userAgent,
        { reason: 'signup_existing' },
      );
      return otpInfo;
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const otpCode = generateOtp();
    const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

    const user = await sequelize.transaction(async (transaction) => {
      const createdUser = await User.create({
        email,
        passwordHash,
        fullName,
        phone,
        userLevel: 'citizen',
        assignedProvinceId: null,
        assignedRegencyId: null,
        assignedDistrictId: null,
        assignedVillageId: null,
        canInheritData: false,
        inheritanceDepth: 'direct',
        emailVerified: false,
        phoneVerified: false,
        otpCode,
        otpExpiresAt,
        isActive: false,
      }, { transaction });

      let masyarakatRole = await Role.findOne({
        where: { name: 'masyarakat', isActive: true },
        transaction,
      });

      if (!masyarakatRole) {
        masyarakatRole = await Role.create({
          name: 'masyarakat',
          displayName: 'Masyarakat',
          description: 'Pengguna masyarakat SIPALING PKP',
          isSystemRole: false,
          isDeletable: true,
          isActive: true,
        }, { transaction });
      }

      await UserRole.findOrCreate({
        where: { userId: createdUser.id, roleId: masyarakatRole.id },
        defaults: { isActive: true },
        transaction,
      });

      return createdUser;
    });

    const channel = resolveOtpChannel(user, requestedChannel);
    await sendOtp(user, channel, { enforceCooldown: false });

    await AuditLog.create({
      userId: user.id,
      action: 'user_signup',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress,
      userAgent,
      metadata: { userLevel: 'citizen', email },
    });

    await AuditLog.create({
      userId: user.id,
      action: 'otp_request',
      resourceType: 'auth',
      resourceId: user.id,
      ipAddress,
      userAgent,
      requestId: idempotencyKey,
      metadata: {
        userId: user.id,
        email,
        channel,
        destination: channel === 'whatsapp' ? maskPhone(user.phone) : maskEmail(user.email),
      },
    });

    try {
      const superAdmins = await findUsersWithRole(['super_admin']);
      await createNotificationsForUsers(
        superAdmins.map((admin) => admin.id),
        {
          type: 'warning',
          category: 'verification',
          title: 'Pendaftaran Baru',
          message: `User baru (${email}) menunggu aktivasi/verifikasi.`,
          link: '/users',
        },
      );
    } catch (notifyError) {
      console.warn('Failed to notify super admins:', notifyError.message);
    }

    return {
      userId: user.id,
      otpExpiresAt,
      otpChannel: channel,
      cooldownSeconds: getOtpCooldownSeconds(otpExpiresAt),
      availableChannels: getAvailableOtpChannels(user),
    };
  } catch (error) {
    if (error.code) {
      throw error;
    }
    throw errorFactory.database('Failed to create user', error);
  }
}

async function verifyOtp(userId, code, deviceInfo, ipAddress, userAgent, channel = 'email') {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User');
  }

  if (user.isActive) {
    throw errorFactory.conflict('Akun sudah diverifikasi', 'ACCOUNT_ALREADY_VERIFIED');
  }

  if (!user.otpCode || !user.otpExpiresAt) {
    throw errorFactory.validation('Kode OTP tidak tersedia', 'otp');
  }

  if (new Date(user.otpExpiresAt).getTime() < Date.now()) {
    throw errorFactory.validation('Kode OTP sudah kedaluwarsa', 'otp');
  }

  if (String(code).trim() !== String(user.otpCode)) {
    throw errorFactory.validation('Kode OTP tidak valid', 'otp');
  }

  const resolvedChannel = resolveOtpChannel(user, channel);
  const updates = {
    isActive: true,
    otpCode: null,
    otpExpiresAt: null,
    emailVerified: true,
  };

  if (resolvedChannel === 'whatsapp') {
    updates.phoneVerified = true;
  }

  await user.update(updates);

  const session = await createSession(user, deviceInfo, ipAddress, userAgent);
  const tokens = generateTokens(user, session);

  let permissions = [];
  let permissionNames = [];
  let roles = [];
  let roleNames = [];

  try {
    permissions = await getUserPermissions(user.id);
    permissionNames = permissions
      .map((permission) => permission?.name)
      .filter(Boolean);
    roles = await getUserRoles(user.id);
    roleNames = roles
      .map((role) => role?.name || role?.displayName)
      .filter(Boolean);
  } catch (permissionError) {
    console.warn('Failed to enrich permissions during OTP verification:', permissionError.message);
  }

  await AuditLog.create({
    userId: user.id,
    action: 'otp_verify',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress,
    userAgent,
    metadata: { channel: resolvedChannel },
  });

  return {
    user: {
      ...dataUtils.omitSensitive(user.toJSON(), ['passwordHash']),
      permissions,
      permissionNames,
      roles,
      roleNames,
    },
    tokens,
  };
}

async function resendOtp(userId, channel = 'email', ipAddress, userAgent) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User');
  }

  if (user.isActive) {
    throw errorFactory.conflict('Akun sudah diverifikasi', 'ACCOUNT_ALREADY_VERIFIED');
  }

  const resolvedChannel = resolveOtpChannel(user, channel);
  const lastSentAt = getOtpLastSentAt(user.otpExpiresAt);
  const retryAfter = getOtpCooldownSecondsFromLastSent(lastSentAt);
  if (retryAfter > 0) {
    return {
      userId: user.id,
      otpExpiresAt: user.otpExpiresAt,
      otpChannel: resolvedChannel,
      cooldownSeconds: retryAfter,
      alreadySent: true,
      availableChannels: getAvailableOtpChannels(user),
    };
  }

  const otpCode = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  user.otpCode = otpCode;
  user.otpExpiresAt = otpExpiresAt;
  await sendOtp(user, resolvedChannel, { lastSentAt });
  await user.save();

  await AuditLog.create({
    userId: user.id,
    action: 'otp_request',
    resourceType: 'auth',
    resourceId: user.id,
    ipAddress,
    userAgent,
    metadata: {
      userId: user.id,
      channel: resolvedChannel,
      destination: resolvedChannel === 'whatsapp' ? maskPhone(user.phone) : maskEmail(user.email),
    },
  });

  return {
    userId: user.id,
    otpExpiresAt,
    otpChannel: resolvedChannel,
    cooldownSeconds: getOtpCooldownSeconds(otpExpiresAt),
    availableChannels: getAvailableOtpChannels(user),
  };
}

const buildOtpResponse = (user, channel, otpExpiresAt, extra = {}) => ({
  userId: user.id,
  otpExpiresAt,
  otpChannel: channel,
  cooldownSeconds: getOtpCooldownSeconds(otpExpiresAt),
  availableChannels: getAvailableOtpChannels(user),
  ...extra,
});

async function requestActivationOtp(user, channel, ipAddress, userAgent, options = {}) {
  if (!user) {
    throw errorFactory.notFound('User');
  }

  if (user.isActive) {
    throw errorFactory.conflict('Akun sudah aktif', 'ACCOUNT_ALREADY_ACTIVE');
  }

  if (user.userLevel && user.userLevel !== 'citizen') {
    throw errorFactory.authorization('Akun ini tidak bisa diaktifkan via OTP.', 'ACCOUNT_REACTIVATE_FORBIDDEN');
  }

  const resolvedChannel = resolveOtpChannel(user, channel);
  const lastSentAt = getOtpLastSentAt(user.otpExpiresAt);
  const retryAfter = getOtpCooldownSecondsFromLastSent(lastSentAt);

  if (retryAfter > 0 && !options.forceResend) {
    return buildOtpResponse(user, resolvedChannel, user.otpExpiresAt, {
      cooldownSeconds: retryAfter,
      alreadySent: true,
    });
  }

  const otpCode = generateOtp();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);

  user.otpCode = otpCode;
  user.otpExpiresAt = otpExpiresAt;
  await sendOtp(user, resolvedChannel, { lastSentAt, enforceCooldown: false });
  await user.save();

  await AuditLog.create({
    userId: user.id,
    action: 'otp_request',
    resourceType: 'auth',
    resourceId: user.id,
    ipAddress,
    userAgent,
    metadata: {
      userId: user.id,
      email: user.email,
      channel: resolvedChannel,
      destination: resolvedChannel === 'whatsapp' ? maskPhone(user.phone) : maskEmail(user.email),
      reason: options.reason || 'reactivate',
    },
  });

  return buildOtpResponse(user, resolvedChannel, otpExpiresAt);
}

async function reactivateAccount(email, channel, ipAddress, userAgent) {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw errorFactory.notFound('User');
  }

  return requestActivationOtp(user, channel, ipAddress, userAgent, { reason: 'reactivate' });
}

async function requestPasswordReset(email, method, channel, ipAddress, userAgent) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const resolvedMethod = normalizeResetMethod(method);
  const normalizedChannel = normalizeOtpChannel(channel);
  const requestedChannel = channel;

  const user = await User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      normalizedEmail,
    ),
  });

  if (!user) {
    await AuditLog.create({
      userId: null,
      action: 'password_reset_request',
      resourceType: 'auth',
      resourceId: null,
      ipAddress,
      userAgent,
      metadata: {
        email: normalizedEmail,
        method: resolvedMethod,
        channel: normalizedChannel,
        result: 'user_not_found',
      },
    });

    return {
      method: resolvedMethod,
      channel: normalizedChannel,
    };
  }

  const cooldownSeconds = getPasswordResetCooldownSeconds(user.passwordResetExpiresAt);
  if (cooldownSeconds > 0) {
    await AuditLog.create({
      userId: user.id,
      action: 'password_reset_request',
      resourceType: 'auth',
      resourceId: user.id,
      ipAddress,
      userAgent,
      metadata: {
        method: resolvedMethod,
        channel: normalizedChannel,
        result: 'cooldown',
        cooldownSeconds,
      },
    });

    return {
      method: resolvedMethod,
      channel: normalizedChannel,
      cooldownSeconds,
      alreadySent: true,
    };
  }

  const rawToken = resolvedMethod === 'otp'
    ? generateOtp()
    : crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  const storedToken = buildPasswordResetTokenValue(resolvedMethod, rawToken);

  user.passwordResetToken = storedToken;
  user.passwordResetExpiresAt = expiresAt;
  await user.save();

  const resetUrl = resolvedMethod === 'link' ? buildPasswordResetLink(rawToken) : null;
  const delivery = await sendPasswordResetMessage(user, resolvedMethod, requestedChannel, {
    otpCode: resolvedMethod === 'otp' ? rawToken : null,
    resetUrl,
  });

  await AuditLog.create({
    userId: user.id,
    action: 'password_reset_request',
    resourceType: 'auth',
    resourceId: user.id,
    ipAddress,
    userAgent,
    metadata: {
      method: resolvedMethod,
      channel: delivery.channel,
      destination: delivery.channel === 'whatsapp'
        ? maskPhone(delivery.destination)
        : maskEmail(delivery.destination),
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[RESET] ${resolvedMethod} via ${delivery.channel} -> ${delivery.destination}`);
  }

  return {
    method: resolvedMethod,
    channel: normalizedChannel,
    cooldownSeconds: getPasswordResetCooldownSeconds(expiresAt),
  };
}

async function resetPassword(payload, ipAddress, userAgent) {
  const {
    email,
    token,
    otp,
    newPassword,
  } = payload || {};

  const isTokenFlow = Boolean(token);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  let user = null;

  if (isTokenFlow) {
    const tokenValue = buildPasswordResetTokenValue('link', token);
    user = await User.findOne({ where: { passwordResetToken: tokenValue } });
  } else {
    user = await User.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        normalizedEmail,
      ),
    });
  }

  if (!user) {
    if (isTokenFlow) {
      throw errorFactory.validation('Token reset tidak valid', 'token');
    }
    throw errorFactory.validation('Kode OTP tidak valid', 'otp');
  }

  if (!user.passwordResetToken || !user.passwordResetExpiresAt) {
    const field = isTokenFlow ? 'token' : 'otp';
    const message = isTokenFlow ? 'Token reset tidak valid' : 'Kode OTP tidak valid';
    throw errorFactory.validation(message, field);
  }

  if (new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
    throw errorFactory.validation('Token reset sudah kedaluwarsa', 'token');
  }

  if (isTokenFlow) {
    const expected = buildPasswordResetTokenValue('link', token);
    if (user.passwordResetToken !== expected) {
      throw errorFactory.validation('Token reset tidak valid', 'token');
    }
  } else {
    const expected = buildPasswordResetTokenValue('otp', otp);
    if (user.passwordResetToken !== expected) {
      throw errorFactory.validation('Kode OTP tidak valid', 'otp');
    }
  }

  if (isBcryptHash(user.passwordHash)) {
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw errorFactory.validation('Password baru tidak boleh sama dengan password lama', 'newPassword');
    }
  } else if (user.passwordHash && user.passwordHash === newPassword) {
    throw errorFactory.validation('Password baru tidak boleh sama dengan password lama', 'newPassword');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await sequelize.transaction(async (transaction) => {
    await user.update({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      loginAttempts: 0,
      lockedUntil: null,
    }, { transaction });

    await UserSession.update(
      { isActive: false },
      { where: { userId: user.id }, transaction },
    );
  });

  await AuditLog.create({
    userId: user.id,
    action: 'password_reset',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress,
    userAgent,
  });

  try {
    await createNotification(user.id, {
      type: 'info',
      category: 'security',
      title: 'Password Diperbarui',
      message: 'Password Anda berhasil diperbarui. Jika ini bukan Anda, segera hubungi admin.',
      link: '/settings',
    });
  } catch (notifyError) {
    console.warn('Failed to notify user about password reset:', notifyError.message);
  }

  return { userId: user.id };
}

/**
 * Authenticate user login
 */
async function authenticateUser(email, password, deviceInfo, ipAddress, userAgent) {
  try {
    // Find user with roles
    const user = await User.findOne({
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

    if (!user) {
      throw errorFactory.authentication('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (!user.isActive) {
      if (user.userLevel && user.userLevel !== 'citizen') {
        throw errorFactory.authentication('Account is deactivated', 'ACCOUNT_DEACTIVATED');
      }

      try {
        const otpInfo = await requestActivationOtp(
          user,
          null,
          ipAddress,
          userAgent,
          { reason: 'signin' },
        );
        const error = errorFactory.authentication(
          'Akun belum aktif. OTP aktivasi telah dikirim.',
          'ACCOUNT_INACTIVE_NEEDS_OTP',
        );
        error.details = otpInfo;
        throw error;
      } catch (otpError) {
        if (otpError.retryAfter) {
          const error = errorFactory.authentication(
            'Akun belum aktif. OTP sudah pernah dikirim, coba lagi nanti.',
            'ACCOUNT_INACTIVE_NEEDS_OTP',
          );
          error.retryAfter = otpError.retryAfter;
          error.details = {
            userId: user.id,
            otpChannel: resolveOtpChannel(user, null),
            cooldownSeconds: otpError.retryAfter,
            availableChannels: getAvailableOtpChannels(user),
          };
          throw error;
        }
        throw otpError;
      }
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw errorFactory.authentication('Account is temporarily locked', 'ACCOUNT_LOCKED');
    }

    // Verify password
    let isValidPassword = false;

    if (isBcryptHash(user.passwordHash)) {
      isValidPassword = await bcrypt.compare(password, user.passwordHash);
    } else if (user.passwordHash) {
      // Handle legacy plaintext passwords by re-hashing on first login
      isValidPassword = password === user.passwordHash;
      if (isValidPassword) {
        const newHash = await bcrypt.hash(password, SALT_ROUNDS);
        await user.update({ passwordHash: newHash });
      }
    }
    if (!isValidPassword) {
      // Increment login attempts
      await user.update({
        loginAttempts: user.loginAttempts + 1,
        lockedUntil: user.loginAttempts >= 4 ? new Date(Date.now() + 15 * 60 * 1000) : null,
      });

      throw errorFactory.authentication('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // Reset login attempts on successful login
    await user.update({
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    // Create session
    const session = await createSession(user, deviceInfo, ipAddress, userAgent);

    // Generate tokens
    const tokens = generateTokens(user, session);

    // Log login (non-blocking)
    AuditLog.create({
      userId: user.id,
      action: 'user_signin',
      resourceType: 'user_session',
      resourceId: session.id,
      ipAddress,
      userAgent,
      metadata: { userLevel: user.userLevel },
    }).catch((error) => {
      console.error('Audit Log Error:', error.message);
    });

    const deviceLabel = deviceInfo?.browser
      ? `${deviceInfo.browser} di ${deviceInfo.os || 'Perangkat'}`
      : (userAgent || 'Perangkat baru');
    createNotification(user.id, {
      type: 'info',
      category: 'security',
      title: 'Login Baru Terdeteksi',
      message: `Login baru terdeteksi dari ${deviceLabel}. Jika ini bukan Anda, segera perbarui password.`,
      link: '/settings',
    }).catch((error) => {
      console.warn('Notification Delay:', error.message);
    });

    const roleNames = (user.roles || [])
      .map((role) => role?.name || role?.displayName)
      .filter(Boolean);

    let permissions = [];
    let permissionNames = [];

    try {
      const roleIds = (user.roles || [])
        .map((role) => role?.id)
        .filter(Boolean);

      if (roleIds.length) {
        const foundPermissions = await Permission.findAll({
          include: [
            {
              model: RolePermission,
              as: 'rolePermissions',
              where: { roleId: roleIds, isActive: true },
              required: true,
            },
          ],
          where: { isActive: true },
        });
        permissions = foundPermissions.map((permission) => (
          permission.toJSON ? permission.toJSON() : permission
        ));
        permissionNames = permissions
          .map((permission) => permission?.name)
          .filter(Boolean);
      }
    } catch (permissionError) {
      console.warn('Failed to enrich permissions during login:', permissionError.message);
      permissions = [];
      permissionNames = [];
    }

    return {
      user: {
        ...dataUtils.omitSensitive(user.toJSON(), ['passwordHash']),
        permissions,
        permissionNames,
        roleNames,
      },
      tokens,
    };
  } catch (error) {
    if (error.code) {
      throw error; // Re-throw custom errors
    }
    throw errorFactory.database('Authentication failed', error);
  }
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshTokenParam) {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshTokenParam, process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      throw errorFactory.authentication('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Find user and session
    const user = await User.findByPk(decoded.userId);
    const session = await UserSession.findOne({
      where: {
        userId: user.id,
        refreshToken: refreshTokenParam,
        isActive: true,
        expiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!user || !session) {
      throw errorFactory.authentication('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }

    // Generate new access token
    const { accessToken } = generateTokens(user, session);

    return { accessToken };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw errorFactory.authentication('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
    }
    if (error.code) {
      throw error; // Re-throw custom errors
    }
    throw errorFactory.database('Token refresh failed', error);
  }
}

/**
 * Sign out user
 */
async function signOutUser(token, ipAddress, userAgent) {
  if (token) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Deactivate session
    await UserSession.update(
      { isActive: false },
      {
        where: {
          userId: decoded.userId,
          sessionToken: decoded.sessionToken,
        },
      },
    );

    // Log sign out
    await AuditLog.create({
      userId: decoded.userId,
      action: 'user_signout',
      resourceType: 'user_session',
      ipAddress,
      userAgent,
    });
  }
}

module.exports = {
  generateTokens,
  createSession,
  generateOtp,
  sendOtp,
  registerUser,
  verifyOtp,
  resendOtp,
  reactivateAccount,
  requestPasswordReset,
  resetPassword,
  authenticateUser,
  refreshAccessToken,
  signOutUser,
  ensureCitizenUserLevelEnum,
};
