const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  user_id: { type: DataTypes.CHAR(36), allowNull: false },
  group_id: { type: DataTypes.CHAR(36), allowNull: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'GENERAL' },
  reference_type: { type: DataTypes.STRING(50), allowNull: true },
  reference_id: { type: DataTypes.CHAR(36), allowNull: true },
  event_key: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id', 'is_read', 'created_at'] },
    { unique: true, fields: ['event_key'] }
  ]
});

module.exports = { Notification };
