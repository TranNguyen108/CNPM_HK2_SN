const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SyncLog = sequelize.define('SyncLog', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  group_id: { type: DataTypes.CHAR(36), allowNull: false },
  sync_type: { type: DataTypes.ENUM('jira', 'github'), allowNull: false },
  status: { type: DataTypes.ENUM('success', 'error'), allowNull: false },
  new_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  updated_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  error_message: DataTypes.TEXT
}, {
  tableName: 'sync_logs',
  timestamps: true,
  createdAt: 'synced_at',
  updatedAt: false
});

module.exports = { SyncLog };
