const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const JiraConfig = sequelize.define('JiraConfig', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  group_id: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
  jira_domain: DataTypes.STRING,
  project_key: DataTypes.STRING,
  access_token_encrypted: DataTypes.TEXT,
  is_active: { type: DataTypes.TINYINT, defaultValue: 1 },
  last_synced_at: DataTypes.DATE
}, {
  tableName: 'jira_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = { JiraConfig };