const nodemailer = require('nodemailer');
const axios = require('axios');
const { Op } = require('sequelize');
const {
  Notification,
  User,
  Role,
} = require('../models');

let cachedMailTransport = null;

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

const getMailTransport = () => {
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

const sendNotificationEmail = async (user, notification) => {
  const transport = getMailTransport();
  if (!transport || !user?.email) return false;

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const subject = notification.title || 'Notifikasi SIPALING PKP';
  const message = notification.message || '';
  const link = notification.link || '';

  const html = `
    <div style="font-family: Arial, sans-serif;">
      <h2 style="color:#0C2D57;">${subject}</h2>
      <p style="font-size:14px; color:#333;">${message}</p>
      ${link ? `<p><a href="${link}" style="color:#1a73e8;">Buka detail</a></p>` : ''}
      <p style="font-size:12px; color:#666;">SIPALING PKP • Pemerintah Provinsi Bangka Belitung</p>
    </div>
  `;

  await transport.sendMail({
    from,
    to: user.email,
    subject,
    html,
  });
  return true;
};

const sendNotificationWhatsapp = async (user, notification) => {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return false;

  const targetPhone = normalizePhoneNumber(user?.phone);
  if (!targetPhone) return false;

  const message = `${notification.title}\n${notification.message}${notification.link ? `\n${notification.link}` : ''}`;

  await axios.post('https://api.fonnte.com/send', {
    target: targetPhone,
    message,
    countryCode: '62',
  }, {
    headers: {
      Authorization: token,
    },
  });

  return true;
};

const deliverNotification = async (user, notification) => {
  if (!user || !notification) return;
  const tasks = [];

  if (user.notificationEmailEnabled) {
    tasks.push(
      sendNotificationEmail(user, notification).catch((error) => {
        console.warn('Notification email failed:', error.message);
      }),
    );
  }

  if (user.notificationWhatsappEnabled) {
    tasks.push(
      sendNotificationWhatsapp(user, notification).catch((error) => {
        console.warn('Notification WhatsApp failed:', error.response?.data || error.message);
      }),
    );
  }

  if (tasks.length) {
    await Promise.all(tasks);
  }
};

const createNotification = async (userId, data, options = {}) => {
  if (!userId) return null;
  const payload = {
    userId,
    type: data.type || 'info',
    title: data.title || 'Notifikasi',
    message: data.message || '',
    link: data.link || null,
    category: data.category || 'status',
    auditLogId: data.auditLogId || null,
  };

  const notification = await Notification.create(payload);
  if (options.sendChannels === false) {
    return notification;
  }

  const user = await User.findByPk(userId);
  await deliverNotification(user, notification.toJSON ? notification.toJSON() : notification);
  return notification;
};

const createNotificationsForUsers = async (userIds, data, options = {}) => {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!uniqueIds.length) return [];

  const notifications = [];
  for (const userId of uniqueIds) {
    const created = await createNotification(userId, data, options);
    if (created) notifications.push(created);
  }
  return notifications;
};

const getUserNotifications = async (userId, limit = 10, category = null) => {
  const whereClause = { userId };
  if (category && category !== 'all') {
    whereClause.category = category;
  }
  return Notification.findAll({
    where: whereClause,
    order: [['created_at', 'DESC']],
    limit,
  });
};

const getUnreadCount = async (userId) => (
  Notification.count({
    where: { userId, isRead: false },
  })
);

const markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({
    where: { id: notificationId, userId },
  });
  if (!notification) return null;
  await notification.update({ isRead: true });
  return notification;
};

const markAllAsRead = async (userId) => (
  Notification.update({ isRead: true }, { where: { userId, isRead: false } })
);

const findUsersWithRole = async (roleNames, scope = {}) => (
  User.findAll({
    where: scope,
    include: [
      {
        model: Role,
        as: 'roles',
        where: {
          name: { [Op.in]: roleNames },
          isActive: true,
        },
        through: { attributes: [] },
        required: true,
      },
    ],
  })
);

const findReviewerUsersForScope = async (scope = {}) => {
  const [verifikatorUsers, superAdmins] = await Promise.all([
    findUsersWithRole(['verifikator']),
    findUsersWithRole(['super_admin']),
  ]);

  const scopedUsers = [];
  if (scope.villageId) {
    scopedUsers.push(...await findUsersWithRole(['admin_desa'], { assignedVillageId: scope.villageId }));
  }
  if (scope.regencyId) {
    scopedUsers.push(...await findUsersWithRole(['admin_kabupaten'], { assignedRegencyId: scope.regencyId }));
  }
  if (scope.districtId) {
    scopedUsers.push(...await findUsersWithRole(['admin_kecamatan'], { assignedDistrictId: scope.districtId }));
  }

  return [...verifikatorUsers, ...superAdmins, ...scopedUsers];
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  findUsersWithRole,
  findReviewerUsersForScope,
};
