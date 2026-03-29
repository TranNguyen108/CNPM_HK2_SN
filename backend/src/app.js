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

  const tasksTable = await queryInterface.describeTable('tasks').catch(() => null);
  if (tasksTable) {
    if (!tasksTable.description) {
      await queryInterface.addColumn('tasks', 'description', {
        type: DataTypes.TEXT('long'),
        allowNull: true
      });
    }

    if (!tasksTable.issue_type) {
      await queryInterface.addColumn('tasks', 'issue_type', {
        type: DataTypes.STRING(100),
        allowNull: true
      });
    }

    if (!tasksTable.epic_key) {
      await queryInterface.addColumn('tasks', 'epic_key', {
        type: DataTypes.STRING(50),
        allowNull: true
      });
    }

    if (!tasksTable.epic_name) {
      await queryInterface.addColumn('tasks', 'epic_name', {
        type: DataTypes.STRING(255),
        allowNull: true
      });
    }
  }

  const notificationsTable = await queryInterface.describeTable('notifications').catch(() => null);
  if (notificationsTable) {
    if (!notificationsTable.group_id) {
      await queryInterface.addColumn('notifications', 'group_id', {
        type: DataTypes.CHAR(36),
        allowNull: true
      });
    }

    if (!notificationsTable.title) {
      await queryInterface.addColumn('notifications', 'title', {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'Thông báo'
      });
    }

    if (!notificationsTable.message) {
      await queryInterface.addColumn('notifications', 'message', {
        type: DataTypes.TEXT,
        allowNull: false
      });
    }

    if (!notificationsTable.type) {
      await queryInterface.addColumn('notifications', 'type', {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'GENERAL'
      });
    }

    if (!notificationsTable.reference_type) {
      await queryInterface.addColumn('notifications', 'reference_type', {
        type: DataTypes.STRING(50),
        allowNull: true
      });
    }

    if (!notificationsTable.reference_id) {
      await queryInterface.addColumn('notifications', 'reference_id', {
        type: DataTypes.CHAR(36),
        allowNull: true
      });
    }

    if (!notificationsTable.event_key) {
      await queryInterface.addColumn('notifications', 'event_key', {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true
      });
    }

    if (!notificationsTable.is_read) {
      await queryInterface.addColumn('notifications', 'is_read', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!notificationsTable.created_at) {
      await queryInterface.addColumn('notifications', 'created_at', {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
      });
    }

    if (!notificationsTable.updated_at) {
      await queryInterface.addColumn('notifications', 'updated_at', {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
      });
    }
  }
};

const initApp = async () => {
  await connectDB();
  await ensureSchema();

  // Tạo bảng mới nếu chưa tồn tại (không xóa dữ liệu cũ)
  const { Task } = require('./models/task.model');
  const { SyncLog } = require('./models/syncLog.model');
  const { Notification } = require('./models/notification.model');
  await Task.sync({ force: false });
  await SyncLog.sync({ force: false });
  await Notification.sync({ force: false });
  console.log('Tables synced: tasks, sync_logs, commit_stats, notifications');

  // Khởi động cron job tự động sync Jira mỗi 30 phút
  startJiraSyncJob();
  startGithubSyncJob();
  require('./jobs/notification.job').startNotificationJob();
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
app.use('/api', require('./routes/srs.routes'));
app.use('/api', require('./routes/notification.routes'));
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
