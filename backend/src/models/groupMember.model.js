const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroupMember = sequelize.define('GroupMember', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  group_id: { type: DataTypes.CHAR(36), allowNull: false },
  user_id: { type: DataTypes.CHAR(36), allowNull: false },
  role_in_group: {
    type: DataTypes.ENUM('LEADER', 'MEMBER', 'VIEWER'),
    defaultValue: 'MEMBER'
  }
}, {
  tableName: 'group_members',
  timestamps: true,
  createdAt: 'joined_at',
  updatedAt: false
});

module.exports = { GroupMember };