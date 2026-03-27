const express = require('express');
const cors = require('cors');
const { DataTypes } = require('sequelize');
require('dotenv').config();
const { connectDB, sequelize } = require('./config/database');
const { startJiraSyncJob } = require('./jobs/jiraSync.job');
const { startGithubSyncJob } = require('./jobs/githubSync.job');

const app = express();
app.use(cors());
app.use(express.json());

const ensureSchema = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const usersTable = await queryInterface.describeTable('users');
  const allTables = await queryInterface.showAllTables();
  const normalizedTableNames = allTables.map((item) => (
    typeof item === 'string' ? item : Object.values(item)[0]
  ));

  if (!usersTable.github_username) {
    await queryInterface.addColumn('users', 'github_username', {
      type: DataTypes.STRING,
      allowNull: true
    });
  }

  const { CommitStat } = require('./models/commitStat.model');
  if (!normalizedTableNames.includes('commit_stats')) {
    await CommitStat.sync({ force: false });
    return;
  }

  const commitStatsTable = await queryInterface.describeTable('commit_stats');

  if (commitStatsTable.github_username && commitStatsTable.github_username.allowNull === false) {
    await queryInterface.changeColumn('commit_stats', 'github_username', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
  }

  if (!commitStatsTable.task_id) {
    await queryInterface.addColumn('commit_stats', 'task_id', {
      type: DataTypes.CHAR(36),
      allowNull: true
    });
  }

  if (!commitStatsTable.task_key) {
    await queryInterface.addColumn('commit_stats', 'task_key', {
      type: DataTypes.STRING(50),
      allowNull: true
    });
  }

  if (!commitStatsTable.author_email) {
    await queryInterface.addColumn('commit_stats', 'author_email', {
      type: DataTypes.STRING(255),
      allowNull: true
    });
  }
};

const initApp = async () => {
  await connectDB();
  await ensureSchema();

  // Tạo bảng mới nếu chưa tồn tại (không xóa dữ liệu cũ)
  const { Task } = require('./models/task.model');
  const { SyncLog } = require('./models/syncLog.model');
  await Task.sync({ force: false });
  await SyncLog.sync({ force: false });
  console.log('Tables synced: tasks, sync_logs, commit_stats');

  // Khởi động cron job tự động sync Jira mỗi 30 phút
  startJiraSyncJob();
  startGithubSyncJob();
};

app.get('/', (req, res) => {
  res.json({ message: 'SWP391 Backend API is running!' });
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/sync', require('./routes/sync.routes'));
app.use('/api', require('./routes/tasks.routes'));
app.use('/api', require('./routes/commitStats.routes'));

app.use('/api', require('./routes/commitStats.routes'));
app.use('/api', require('./routes/export.routes'));


const PORT = process.env.PORT || 3000;
initApp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('App init error:', err.message);
  });
