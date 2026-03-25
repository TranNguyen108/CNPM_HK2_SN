import { useState, useEffect } from 'react';
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
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
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

// ── Member Stats Table ────────────────────────────────────────────────────────
function MemberTable({ groupId, sprintName }) {
  const { data: memberStats, isLoading } = useQuery({
    queryKey: ['lecturer-member-stats', groupId],
    queryFn: () => statsApi.getMemberStats(groupId).then((r) => r.data),
    staleTime: 60_000,
  });

  // If sprint is selected, filter member stats from tasks of that sprint
  const { data: sprintTaskData } = useQuery({
    queryKey: ['lecturer-sprint-tasks-detail', groupId, sprintName],
    queryFn: () =>
      tasksApi
        .getTasks({ groupId, sprintName, size: 200 })
        .then((r) => r.data),
    enabled: !!sprintName,
    staleTime: 60_000,
  });

  // Re-calculate per-member stats from sprint tasks when sprint filter is active
  const sprintMemberMap = (() => {
    if (!sprintName || !Array.isArray(sprintTaskData?.items)) return null;
    const map = new Map();
    sprintTaskData.items.forEach((t) => {
      if (!t.assignee_id) return;
      if (!map.has(t.assignee_id)) {
        map.set(t.assignee_id, {
          userId: t.assignee_id,
          email: t.assignee_email || '',
          assigned: 0,
          done: 0,
        });
      }
      const entry = map.get(t.assignee_id);
      entry.assigned += 1;
      if (DONE_STATUSES.includes((t.status || '').toLowerCase())) entry.done += 1;
    });
    return map;
  })();

  const baseItems = Array.isArray(memberStats?.items) ? memberStats.items : [];

  const tableData = baseItems.map((m) => {
    if (sprintMemberMap) {
      const sprint = sprintMemberMap.get(m.userId) || { assigned: 0, done: 0 };
      return {
        key: m.userId,
        fullName: m.fullName || m.email || m.userId,
        email: m.email,
        avatar: m.avatar,
        role: m.roleInGroup,
        assigned: sprint.assigned,
        done: sprint.done,
        inProgress: 0,
      };
    }
    return {
      key: m.userId,
      fullName: m.fullName || m.email || m.userId,
      email: m.email,
      avatar: m.avatar,
      role: m.roleInGroup,
      assigned: m.assignedCount,
      done: m.doneCount,
      inProgress: m.inProgressCount,
    };
  });

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
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => {
        const colorMap = { LEADER: 'gold', MEMBER: 'blue', VIEWER: 'default' };
        return <Tag color={colorMap[role] || 'default'}>{role}</Tag>;
      },
    },
    {
      title: 'Task được giao',
      dataIndex: 'assigned',
      key: 'assigned',
      width: 130,
      align: 'center',
      render: (v) => (
        <Badge count={v} showZero color="#1677ff" />
      ),
    },
    {
      title: 'Task Done',
      dataIndex: 'done',
      key: 'done',
      width: 100,
      align: 'center',
      render: (v) => (
        <Badge count={v} showZero color="#52c41a" />
      ),
    },
    {
      title: '% Hoàn thành',
      key: 'progress',
      width: 160,
      align: 'center',
      render: (_, record) => {
        const pct = record.assigned > 0 ? Math.round((record.done / record.assigned) * 100) : 0;
        return (
          <Progress
            percent={pct}
            size="small"
            status={pct === 100 ? 'success' : 'active'}
            style={{ margin: 0 }}
          />
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

  const sprints = Array.isArray(sprintList) ? sprintList : [];

  // Auto-select latest sprint once loaded
  useEffect(() => {
    if (sprints.length > 0 && selectedSprint === null) {
      setSelectedSprint(sprints[sprints.length - 1]);
    }
  }, [sprints.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tasks for selected sprint
  const { data: taskData, isLoading: loadingTasks } = useQuery({
    queryKey: ['lecturer-tasks', groupId, selectedSprint],
    queryFn: () =>
      tasksApi.getTasks({ groupId, sprintName: selectedSprint, size: 200 }).then((r) => r.data),
    enabled: !!selectedSprint,
    staleTime: 60_000,
  });

  // All tasks (no sprint filter) when no sprint is selected
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

  const tasks = Array.isArray(
    (selectedSprint ? taskData : allTaskData)?.items
  )
    ? (selectedSprint ? taskData : allTaskData).items
    : [];

  const isLoading = selectedSprint ? loadingTasks : loadingAllTasks;

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => DONE_STATUSES.includes((t.status || '').toLowerCase())).length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

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
          Chi tiết nhóm
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

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Text strong>Filter Sprint:</Text>
          <Select
            placeholder="Chọn sprint"
            style={{ minWidth: 180 }}
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

        {/* Export button — will connect to API in week 6 */}
        <Button
          icon={<DownloadOutlined />}
          disabled
          title="Tính năng xuất báo cáo sẽ được kết nối ở tuần 6"
        >
          Xuất báo cáo
        </Button>
      </div>

      {/* Kanban Board (read-only) */}
      <Card
        title="Kanban Board (Chỉ xem)"
        style={{ marginBottom: 24 }}
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

      {/* Member Assignment Table */}
      <Card title="Bảng phân công thành viên">
        <MemberTable groupId={groupId} sprintName={selectedSprint} />
      </Card>
    </div>
  );
}
