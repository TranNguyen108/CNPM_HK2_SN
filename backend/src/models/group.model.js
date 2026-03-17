const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Group = sequelize.define('Group', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  semester: DataTypes.STRING,
  created_by: DataTypes.CHAR(36),
  is_active: { type: DataTypes.TINYINT, defaultValue: 1 }
}, {
  tableName: 'groups',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = { Group };