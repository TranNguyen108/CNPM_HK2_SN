import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Typography,
  Spin,
  Tag,
  Select,
  Table,
  Progress,
  Button,
  Avatar,
  Tooltip,
  Divider,
  Empty,
  Space,
  Badge,
  Skeleton,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  GithubOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import dayjs from 'dayjs';
import { tasksApi, statsApi } from '../../api/tasksApi';

const { Title, Text } = Typography;

// ── helpers ──────────────────────────────────────────────────────────────────
const DONE_STATUSES = ['done', 'closed', 'resolved', 'complete', 'completed'];
const IN_PROGRESS_STATUSES = ['in progress', 'in-progress', 'doing', 'review', 'code review', 'testing', 'qa'];

const categorize = (status) => {
  const s = (status || '').toLowerCase();
  if (DONE_STATUSES.includes(s)) return 'done';
  if (IN_PROGRESS_STATUSES.includes(s)) return 'in_progress';
  return 'todo';
};

const priorityColor = {
  highest: 'red',
  high: 'orange',
  medium: 'gold',
  low: 'blue',
  lowest: 'cyan',
};

const avatarColor = (name) => {
  const colors = ['#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2'];
  const idx = (name || '').charCodeAt(0) % colors.length;
  return colors[idx];
};

const PIE_COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2', '#f5222d', '#fadb14'];

const scoreBadge = (pct) => {
  if (pct >= 80) return { color: '#52c41a', label: 'Xuất sắc' };
  if (pct >= 60) return { color: '#1677ff', label: 'Tốt' };
  if (pct >= 40) return { color: '#fa8c16', label: 'Trung bình' };
  return { color: '#f5222d', label: 'Cần cải thiện' };
};

// ── Sprint Burndown Chart ─────────────────────────────────────────────────────
function SprintBurndownChart({ groupId, sprintName }) {
  const { data: burndownResp, isLoading } = useQuery({
    queryKey: ['burndown', groupId, sprintName],
    queryFn: () => statsApi.getSprintBurndown(groupId, sprintName).then((r) => r.data),
    enabled: !!sprintName,
    staleTime: 60_000,
  });

  const { data: taskData } = useQuery({
    queryKey: ['tasks-for-burndown', groupId, sprintName],
    queryFn: () => tasksApi.getTasks({ groupId, sprintName, size: 200 }).then((r) => r.data),
    enabled: !!sprintName,
    staleTime: 60_000,
  });

  const chartData = useMemo(() => {
    const burndown = burndownResp?.burndown;
    if (!Array.isArray(burndown) || burndown.length === 0) return [];
    const totalTasks = Array.isArray(taskData?.items) ? taskData.items.length : burndown[burndown.length - 1]?.cumulativeDone || 0;
    const n = burndown.length;
    return burndown.map((item, idx) => ({
      date: dayjs(item.date).format('DD/MM'),
      'Thực tế': totalTasks - item.cumulativeDone,
      'Lý tưởng': Math.round(totalTasks * (n - 1 - idx) / Math.max(n - 1, 1)),
    }));
  }, [burndownResp, taskData]);

  if (!sprintName) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: '#8c8c8c' }}>
        <Text type="secondary">Chọn sprint để xem biểu đồ burndown</Text>
      </div>
    );
  }

  if (isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;

  if (chartData.length === 0) {
    return <Empty description="Không có dữ liệu burndown cho sprint này" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <ReTooltip />
        <Legend wrapperStyle={{ fontSize: 13 }} />
        <Line type="monotone" dataKey="Thực tế" stroke="#1677ff" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Lý tưởng" stroke="#bfbfbf" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Task Contribution Pie Chart ───────────────────────────────────────────────
function TaskContributionPie({ memberRows, isLoading }) {
  const pieData = useMemo(
    () => memberRows.filter((m) => m.done > 0).map((m) => ({ name: m.fullName, value: m.done })),
    [memberRows]
  );

  if (isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;

  if (pieData.length === 0) {
    return <Empty description="Chưa có task hoàn thành" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          outerRadius={90}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
          labelLine={false}
        >
          {pieData.map((_, idx) => (
            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
          ))}
        </Pie>
        <ReTooltip formatter={(val) => [`${val} task`, 'Hoàn thành']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Commit Frequency Bar Chart ────────────────────────────────────────────────
function CommitFrequencyBar({ memberRows, isLoading }) {
  const barData = useMemo(
    () => memberRows.map((m) => ({ name: m.fullName, commits: m.commits })),
    [memberRows]
  );

  const hasCommits = barData.some((d) => d.commits > 0);

  if (isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;

  return (
    <>
      {!hasCommits && (
        <Alert
          type="info"
          showIcon
          icon={<GithubOutlined />}
          message="Chưa có dữ liệu commit"
          description="Tính năng đồng bộ GitHub chưa được cấu hình cho nhóm này."
          style={{ marginBottom: 12, fontSize: 12 }}
        />
      )}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={barData} margin={{ top: 8, right: 20, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <ReTooltip formatter={(val) => [val, 'Commits']} />
          <Bar dataKey="commits" fill="#722ed1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

// ── Read-only Task Card ───────────────────────────────────────────────────────
function TaskCard({ task }) {
  const priority = (task.priority || '').toLowerCase();
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, borderRadius: 6 }}
      bodyStyle={{ padding: '8px 12px' }}
    >
      {task.jira_key && (
        <Text code style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>
          {task.jira_key}
        </Text>
      )}
      <Text style={{ display: 'block', fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
        {task.title || '(Không có tiêu đề)'}
      </Text>
      <Space size={4} wrap>
        {priority && (
          <Tag color={priorityColor[priority] || 'default'} style={{ fontSize: 11 }}>
            {task.priority}
          </Tag>
        )}
        {task.story_points != null && (
          <Tag color="purple" style={{ fontSize: 11 }}>
            {task.story_points} SP
          </Tag>
        )}
        {task.due_date && (
          <Tag
            icon={<ClockCircleOutlined />}
            color={new Date(task.due_date) < new Date() && categorize(task.status) !== 'done' ? 'red' : 'default'}
            style={{ fontSize: 11 }}
          >
            {task.due_date}
          </Tag>
        )}
      </Space>
      {task.assignee_email && (
        <div style={{ marginTop: 6 }}>
          <Tooltip title={task.assignee_email}>
            <Avatar
              size={22}
              style={{ backgroundColor: avatarColor(task.assignee_email), fontSize: 11 }}
            >
              {(task.assignee_email[0] || '?').toUpperCase()}
            </Avatar>
          </Tooltip>
        </div>
      )}
    </Card>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
const COLUMNS = [
  { key: 'todo', label: 'To Do', color: '#d4e8ff', badgeColor: 'blue' },
  { key: 'in_progress', label: 'In Progress', color: '#fff7e6', badgeColor: 'orange' },
  { key: 'done', label: 'Done', color: '#f6ffed', badgeColor: 'green' },
];

function KanbanReadOnly({ tasks }) {
  const grouped = { todo: [], in_progress: [], done: [] };
  tasks.forEach((t) => {
    const cat = categorize(t.status);
    if (grouped[cat]) grouped[cat].push(t);
  });

  return (
    <Row gutter={12}>
      {COLUMNS.map((col) => (
        <Col key={col.key} xs={24} md={8}>
          <div
            style={{
              background: col.color,
              borderRadius: 8,
              padding: 12,
              minHeight: 200,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text strong>{col.label}</Text>
              <Badge count={grouped[col.key].length} color={col.badgeColor} />
            </div>
            {grouped[col.key].length === 0 ? (
              <Empty description="" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              grouped[col.key].map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </div>
        </Col>
      ))}
    </Row>
  );
}

// ── Member Comparison Table ───────────────────────────────────────────────────
function MemberComparisonTable({ groupId, sprintName, sprintTaskData, isLoadingTasks }) {
  const { data: memberStats, isLoading: loadingMembers } = useQuery({
    queryKey: ['lecturer-member-stats', groupId],
    queryFn: () => statsApi.getMemberStats(groupId).then((r) => r.data),
    staleTime: 60_000,
  });

  const tableData = useMemo(() => {
    const baseItems = Array.isArray(memberStats?.items) ? memberStats.items : [];

    // Build per-member sprint stats from task list
    const sprintMap = new Map();
    if (Array.isArray(sprintTaskData?.items)) {
      sprintTaskData.items.forEach((t) => {
        if (!t.assignee_id) return;
        if (!sprintMap.has(t.assignee_id)) {
          sprintMap.set(t.assignee_id, { assigned: 0, done: 0, lastActive: null });
        }
        const entry = sprintMap.get(t.assignee_id);
        entry.assigned += 1;
        if (DONE_STATUSES.includes((t.status || '').toLowerCase())) entry.done += 1;
        const updated = t.updated_at ? dayjs(t.updated_at) : null;
        if (updated && (!entry.lastActive || updated.isAfter(entry.lastActive))) {
          entry.lastActive = updated;
        }
      });
    }

    const rows = baseItems.map((m) => {
      const sprint = sprintName && sprintMap.size > 0
        ? (sprintMap.get(m.userId) || { assigned: 0, done: 0, lastActive: null })
        : { assigned: m.assignedCount, done: m.doneCount, lastActive: null };
      return {
        key: m.userId,
        fullName: m.fullName || m.email || String(m.userId),
        email: m.email,
        avatar: m.avatar,
        role: m.roleInGroup,
        assigned: sprint.assigned,
        done: sprint.done,
        commits: 0, // GitHub API not yet integrated
        linesAdded: null,
        lastActive: sprint.lastActive,
      };
    });

    // Compute contribution score
    const maxRaw = Math.max(...rows.map((r) => r.done * 3 + r.commits), 1);
    return rows.map((r) => ({
      ...r,
      scoreRaw: r.done * 3 + r.commits,
      scorePct: Math.round(((r.done * 3 + r.commits) / maxRaw) * 100),
    }));
  }, [memberStats, sprintTaskData, sprintName]);

  const isLoading = loadingMembers || isLoadingTasks;

  const columns = [
    {
      title: 'Thành viên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name, record) => (
        <Space>
          <Avatar
            size={28}
            src={record.avatar}
            style={{ backgroundColor: record.avatar ? undefined : avatarColor(name) }}
            icon={!record.avatar && <UserOutlined />}
          >
            {!record.avatar && (name?.[0] || '?').toUpperCase()}
          </Avatar>
          <div>
            <Text strong style={{ fontSize: 13 }}>{name}</Text>
            {record.email && (
              <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                {record.email}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Task giao',
      dataIndex: 'assigned',
      key: 'assigned',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.assigned - b.assigned,
      render: (v) => <Badge count={v} showZero color="#1677ff" />,
    },
    {
      title: 'Task done',
      dataIndex: 'done',
      key: 'done',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.done - b.done,
      render: (v) => <Badge count={v} showZero color="#52c41a" />,
    },
    {
      title: 'Commits',
      dataIndex: 'commits',
      key: 'commits',
      width: 90,
      align: 'center',
      render: (v) => (
        <Tooltip title="Cần cấu hình GitHub để lấy dữ liệu commit">
          <Text type="secondary">{v}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Lines added',
      dataIndex: 'linesAdded',
      key: 'linesAdded',
      width: 110,
      align: 'center',
      render: () => <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Last active',
      dataIndex: 'lastActive',
      key: 'lastActive',
      width: 120,
      align: 'center',
      sorter: (a, b) => {
        if (!a.lastActive && !b.lastActive) return 0;
        if (!a.lastActive) return 1;
        if (!b.lastActive) return -1;
        return a.lastActive.valueOf() - b.lastActive.valueOf();
      },
      render: (val) => val
        ? <Text style={{ fontSize: 12 }}>{val.format('DD/MM HH:mm')}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: (
        <Tooltip title="Công thức: (task_done × 3 + commits × 1) / max">
          <Space size={4}>
            <TrophyOutlined />
            Điểm đóng góp
          </Space>
        </Tooltip>
      ),
      key: 'score',
      width: 160,
      align: 'center',
      sorter: (a, b) => a.scorePct - b.scorePct,
      defaultSortOrder: 'descend',
      render: (_, record) => {
        const { color, label } = scoreBadge(record.scorePct);
        return (
          <Space direction="vertical" size={2} style={{ alignItems: 'center' }}>
            <Tag color={color} style={{ margin: 0, fontWeight: 600 }}>
              {record.scorePct}% — {label}
            </Tag>
            <Progress
              percent={record.scorePct}
              showInfo={false}
              size="small"
              strokeColor={color}
              style={{ width: 110, margin: 0 }}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <Table
      loading={isLoading}
      dataSource={tableData}
      columns={columns}
      pagination={false}
      size="small"
      rowKey="key"
      scroll={{ x: 780 }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LecturerGroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [selectedSprint, setSelectedSprint] = useState(null);

  // Sprint list
  const { data: sprintList } = useQuery({
    queryKey: ['lecturer-sprints', groupId],
    queryFn: () => tasksApi.getSprints(groupId).then((r) => r.data),
    staleTime: 60_000,
  });

  const sprints = Array.isArray(sprintList?.items) ? sprintList.items : Array.isArray(sprintList) ? sprintList : [];

  // Auto-select latest sprint once loaded
  useEffect(() => {
    if (sprints.length > 0 && selectedSprint === null) {
      setSelectedSprint(sprints[sprints.length - 1]);
    }
  }, [sprints.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tasks for selected sprint (used by charts + kanban)
  const { data: taskData, isLoading: loadingTasks } = useQuery({
    queryKey: ['lecturer-tasks', groupId, selectedSprint],
    queryFn: () =>
      tasksApi.getTasks({ groupId, sprintName: selectedSprint, size: 200 }).then((r) => r.data),
    enabled: !!selectedSprint,
    staleTime: 60_000,
  });

  // All tasks fallback (no sprint selected)
  const { data: allTaskData, isLoading: loadingAllTasks } = useQuery({
    queryKey: ['lecturer-all-tasks', groupId],
    queryFn: () =>
      tasksApi.getTasks({ groupId, size: 200 }).then((r) => r.data),
    enabled: selectedSprint === null,
    staleTime: 60_000,
  });

  // Group overview
  const { data: overview } = useQuery({
    queryKey: ['lecturer-group-overview', groupId],
    queryFn: () => statsApi.getGroupOverview(groupId).then((r) => r.data),
    staleTime: 60_000,
  });

  const activeTaskPayload = selectedSprint ? taskData : allTaskData;
  const tasks = Array.isArray(activeTaskPayload?.items) ? activeTaskPayload.items : [];
  const isLoading = selectedSprint ? loadingTasks : loadingAllTasks;

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => DONE_STATUSES.includes((t.status || '').toLowerCase())).length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Build memberRows for charts (derived from sprint tasks + member stats)
  const memberRows = useMemo(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    const map = new Map();
    tasks.forEach((t) => {
      if (!t.assignee_id) return;
      if (!map.has(t.assignee_id)) {
        map.set(t.assignee_id, {
          fullName: t.assignee_email?.split('@')[0] || String(t.assignee_id),
          done: 0,
          commits: 0,
        });
      }
      const entry = map.get(t.assignee_id);
      if (DONE_STATUSES.includes((t.status || '').toLowerCase())) entry.done += 1;
    });
    return Array.from(map.values());
  }, [tasks]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/lecturer/dashboard')}
          type="text"
        />
        <Title level={4} style={{ margin: 0 }}>
          Chi tiết nhóm — Đánh giá đóng góp
        </Title>
      </div>

      {/* Overview bar */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text>
                  <strong>{doneTasks}/{totalTasks}</strong> task hoàn thành
                </Text>
              </Space>
              <Divider type="vertical" />
              <Space>
                <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
                <Text>
                  Sprint còn <strong>{overview?.sprint?.daysLeft ?? '—'}</strong> ngày
                </Text>
              </Space>
              {overview?.sprint?.name && (
                <>
                  <Divider type="vertical" />
                  <Tag color="blue">{overview.sprint.name}</Tag>
                </>
              )}
            </Space>
          </Col>
          <Col>
            <div style={{ minWidth: 160 }}>
              <Progress
                percent={progressPct}
                status={progressPct === 100 ? 'success' : 'active'}
                size="small"
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Sprint Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Text strong>Sprint:</Text>
          <Select
            placeholder="Chọn sprint"
            style={{ minWidth: 200 }}
            value={selectedSprint}
            allowClear
            onChange={(val) => setSelectedSprint(val ?? null)}
          >
            {sprints.map((s) => (
              <Select.Option key={s} value={s}>
                {s}
              </Select.Option>
            ))}
          </Select>
        </Space>
        <Button
          icon={<DownloadOutlined />}
          disabled
          title="Tính năng xuất báo cáo sẽ được kết nối ở tuần 6"
        >
          Xuất báo cáo
        </Button>
      </div>

      {/* ── Charts Row 1: Burndown + Pie ───────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#1677ff' }} />
                Sprint Burndown Chart
              </Space>
            }
            size="small"
          >
            <SprintBurndownChart groupId={groupId} sprintName={selectedSprint} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                Đóng góp Task (Done)
              </Space>
            }
            size="small"
          >
            <TaskContributionPie memberRows={memberRows} isLoading={isLoading} />
          </Card>
        </Col>
      </Row>

      {/* ── Charts Row 2: Commit Frequency ────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <GithubOutlined />
                Tần suất Commit theo thành viên
              </Space>
            }
            size="small"
          >
            <CommitFrequencyBar memberRows={memberRows} isLoading={isLoading} />
          </Card>
        </Col>
      </Row>

      {/* ── Member Comparison Table ────────────────────────────────────────── */}
      <Card
        title={
          <Space>
            <TrophyOutlined style={{ color: '#fa8c16' }} />
            Bảng so sánh đóng góp thành viên
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Tooltip title="Điểm = (task_done × 3 + commits × 1) / max">
            <Tag color="purple">Điểm đóng góp ước tính</Tag>
          </Tooltip>
        }
      >
        <MemberComparisonTable
          groupId={groupId}
          sprintName={selectedSprint}
          sprintTaskData={activeTaskPayload}
          isLoadingTasks={isLoading}
        />
      </Card>

      {/* ── Kanban Board (read-only) ───────────────────────────────────────── */}
      <Card
        title="Kanban Board (Chỉ xem)"
        extra={
          <Tag color="default" style={{ fontWeight: 400 }}>
            Không thể kéo thả
          </Tag>
        }
      >
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : tasks.length === 0 ? (
          <Empty description="Không có task nào trong sprint này" />
        ) : (
          <KanbanReadOnly tasks={tasks} />
        )}
      </Card>
    </div>
  );
}
