const { GroupMember } = require('../models/groupMember.model');

const ensureGroupAccess = async (user, groupId) => {
  if (user.role === 'ADMIN') return { isAdmin: true, membership: null };

  const membership = await GroupMember.findOne({
    where: { group_id: groupId, user_id: user.id }
  });

  if (!membership) {
    const error = new Error('Bạn không có quyền truy cập nhóm này');
    error.statusCode = 403;
    throw error;
  }

  return { isAdmin: false, membership };
};

const ensureLeaderAccess = async (user, groupId) => {
  const access = await ensureGroupAccess(user, groupId);

  if (access.isAdmin) return access;
  if (access.membership.role_in_group !== 'LEADER') {
    const error = new Error('Chỉ leader của nhóm mới được thực hiện thao tác này');
    error.statusCode = 403;
    throw error;
  }

  return access;
};

module.exports = {
  ensureGroupAccess,
  ensureLeaderAccess
};
