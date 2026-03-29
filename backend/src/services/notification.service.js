const { Op } = require('sequelize');
const { Notification } = require('../models/notification.model');
const { Group } = require('../models/group.model');
const { GroupMember } = require('../models/groupMember.model');
const { Task } = require('../models/task.model');

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 10;
const MAX_SIZE = 50;

const parsePagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || DEFAULT_PAGE, 1);
  const size = Math.min(Math.max(parseInt(query.size, 10) || DEFAULT_SIZE, 1), MAX_SIZE);
  return { page, size, offset: (page - 1) * size, limit: size };
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const createNotification = async (payload) => {
  const data = {
    user_id: payload.userId,
    group_id: payload.groupId || null,
    title: payload.title,
    message: payload.message,
    type: payload.type || 'GENERAL',
    reference_type: payload.referenceType || null,
    reference_id: payload.referenceId || null,
    event_key: payload.eventKey || null,
    is_read: false
  };

  if (data.event_key) {
    const existing = await Notification.findOne({ where: { event_key: data.event_key } });
    if (existing) return { notification: existing, created: false };
  }

  const notification = await Notification.create(data);
  return { notification, created: true };
};

const notifyTaskAssigned = async ({ task, assignee, assignedBy }) => {
  if (!assignee?.id) return null;
  return createNotification({
    userId: assignee.id,
    groupId: task.group_id,
    title: 'Task duoc giao',
    message: `${assignedBy?.full_name || assignedBy?.email || 'Leader'} da giao cho ban task ${task.jira_key}: ${task.title || 'Khong co tieu de'}.`,
    type: 'TASK_ASSIGNED',
    referenceType: 'TASK',
    referenceId: task.id
  });
};

const notifyGroupJiraSyncSuccess = async ({ groupId, triggeredBy, result }) => {
  const members = await GroupMember.findAll({
    where: { group_id: groupId },
    attributes: ['user_id'],
    raw: true
  });

  const group = await Group.findByPk(groupId, { attributes: ['id', 'name'], raw: true });
  const notifications = [];

  for (const member of members) {
    notifications.push(await createNotification({
      userId: member.user_id,
      groupId,
      title: 'Dong bo Jira thanh cong',
      message: `${triggeredBy?.full_name || triggeredBy?.email || 'Leader'} da dong bo Jira thanh cong cho nhom ${group?.name || groupId}. Co ${result.newCount || 0} task moi va ${result.updatedCount || 0} task duoc cap nhat.`,
      type: 'JIRA_SYNC_SUCCESS',
      referenceType: 'GROUP',
      referenceId: groupId
    }));
  }

  return notifications;
};

const notifyUpcomingDeadlines = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const deadline = new Date(today);
  deadline.setUTCDate(deadline.getUTCDate() + 2);

  const tasks = await Task.findAll({
    where: {
      assignee_id: { [Op.ne]: null },
      due_date: {
        [Op.gte]: today.toISOString().slice(0, 10),
        [Op.lte]: deadline.toISOString().slice(0, 10)
      },
      status: {
        [Op.notIn]: ['Done', 'done', 'Closed', 'closed', 'Resolved', 'resolved', 'Completed', 'completed']
      }
    },
    attributes: ['id', 'group_id', 'jira_key', 'title', 'due_date', 'assignee_id'],
    raw: true
  });

  let createdCount = 0;
  for (const task of tasks) {
    const dateKey = normalizeDateOnly(task.due_date);
    const { created } = await createNotification({
      userId: task.assignee_id,
      groupId: task.group_id,
      title: 'Task sap den han',
      message: `Task ${task.jira_key}: ${task.title || 'Khong co tieu de'} co deadline vao ${dateKey} va can duoc xu ly trong 2 ngay toi.`,
      type: 'TASK_DEADLINE_SOON',
      referenceType: 'TASK',
      referenceId: task.id,
      eventKey: `deadline:${task.id}:${dateKey}`
    });

    if (created) {
      createdCount += 1;
    }
  }

  return { scanned: tasks.length, created: createdCount };
};

const getUserNotifications = async (userId, query) => {
  const { page, size, offset, limit } = parsePagination(query);
  const { count, rows } = await Notification.findAndCountAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    offset,
    limit
  });

  return {
    items: rows,
    pagination: {
      page,
      size,
      totalItems: count,
      totalPages: Math.ceil(count / size) || 1
    }
  };
};

const getUnreadCount = async (userId) => Notification.count({
  where: { user_id: userId, is_read: false }
});

const markNotificationRead = async (userId, id) => {
  const notification = await Notification.findOne({ where: { id, user_id: userId } });
  if (!notification) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }
  await notification.update({ is_read: true });
  return notification;
};

const markAllNotificationsRead = async (userId) => {
  const [affected] = await Notification.update(
    { is_read: true },
    { where: { user_id: userId, is_read: false } }
  );
  return { affected };
};

module.exports = {
  createNotification,
  notifyTaskAssigned,
  notifyGroupJiraSyncSuccess,
  notifyUpcomingDeadlines,
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead
};
