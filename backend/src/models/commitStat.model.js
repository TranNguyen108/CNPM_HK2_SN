const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CommitStat = sequelize.define('CommitStat', {
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  group_id: { type: DataTypes.CHAR(36), allowNull: false },
  user_id: { type: DataTypes.CHAR(36), allowNull: true },
  task_id: { type: DataTypes.CHAR(36), allowNull: true },
  task_key: { type: DataTypes.STRING(50), allowNull: true },
  sha: { type: DataTypes.STRING(64), allowNull: false, field: 'commit_sha' },
  message: { type: DataTypes.TEXT, allowNull: false },
  github_username: { type: DataTypes.STRING(255), allowNull: true },
  author_email: { type: DataTypes.STRING(255), allowNull: true },
  additions: { type: DataTypes.INTEGER, defaultValue: 0 },
  deletions: { type: DataTypes.INTEGER, defaultValue: 0 },
  committed_at: { type: DataTypes.DATE, allowNull: false }
}, {
  tableName: 'commit_stats',
  timestamps: true,
  createdAt: 'synced_at',
  updatedAt: false,
  indexes: [
    { unique: true, fields: ['group_id', 'commit_sha'], name: 'uq_commit' },
    { fields: ['group_id', 'user_id'] },
    { fields: ['group_id', 'committed_at'] }
  ]
});

module.exports = { CommitStat };
