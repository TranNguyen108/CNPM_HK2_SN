const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB, sequelize } = require('./config/database');
const { startJiraSyncJob } = require('./jobs/jiraSync.job');

const app = express();
app.use(cors());
app.use(express.json());

const initApp = async () => {
  await connectDB();

  // Tạo bảng mới nếu chưa tồn tại (không xóa dữ liệu cũ)
  const { Task } = require('./models/task.model');
  const { SyncLog } = require('./models/syncLog.model');
  await Task.sync({ force: false });
  await SyncLog.sync({ force: false });
  console.log('Tables synced: tasks, sync_logs');

  // Khởi động cron job tự động sync Jira mỗi 30 phút
  startJiraSyncJob();
};

initApp().catch(err => console.error('App init error:', err.message));

app.get('/', (req, res) => {
  res.json({ message: 'SWP391 Backend API is running!' });
});

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/sync', require('./routes/sync.routes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});