const {
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead
} = require('../services/notification.service');

exports.getNotifications = async (req, res) => {
  try {
    const data = await getUserNotifications(req.user.id, req.query);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await getUnreadCount(req.user.id);
    res.json({ unreadCount });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await markNotificationRead(req.user.id, req.params.id);
    res.json({ message: 'Đã đánh dấu đã đọc', notification });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const result = await markAllNotificationsRead(req.user.id);
    res.json({ message: 'Đã đánh dấu tất cả đã đọc', ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};
