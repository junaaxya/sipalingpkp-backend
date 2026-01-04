const {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} = require('../services/notificationService');

const getNotifications = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const category = req.query.category ? String(req.query.category) : null;
    const notifications = await getUserNotifications(req.user.id, limit, category);
    res.json({
      success: true,
      data: { notifications },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const getUnreadCountController = async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await markAsRead(req.user.id, id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notifikasi tidak ditemukan',
        code: 'NOT_FOUND',
      });
    }
    res.json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await markAllAsRead(req.user.id);
    res.json({
      success: true,
      message: 'Semua notifikasi ditandai sebagai dibaca',
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCountController,
  markNotificationRead,
  markAllNotificationsRead,
};
