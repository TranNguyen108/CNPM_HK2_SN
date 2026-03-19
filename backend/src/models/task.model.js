const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Task = sequelize.define('Task', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  group_id: { type: DataTypes.CHAR(36), allowNull: false },
  jira_key: { type: DataTypes.STRING(50), allowNull: false },
  jira_id: DataTypes.STRING(50),
  title: DataTypes.TEXT,
  status: DataTypes.STRING(100),
  priority: DataTypes.STRING(50),
  assignee_id: DataTypes.CHAR(36),
  assignee_email: DataTypes.STRING(255),
  sprint: DataTypes.STRING(255),
  story_points: DataTypes.FLOAT,
  due_date: DataTypes.DATEONLY
}, {
  tableName: 'tasks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['group_id', 'jira_key'] }
  ]
});

module.exports = { Task };
