const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GithubConfig = sequelize.define('GithubConfig', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  group_id: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
  repo_owner: DataTypes.STRING,
  repo_name: DataTypes.STRING,
  access_token_encrypted: DataTypes.TEXT,
  is_active: { type: DataTypes.TINYINT, defaultValue: 1 },
  last_synced_at: DataTypes.DATE
}, {
  tableName: 'github_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = { GithubConfig };