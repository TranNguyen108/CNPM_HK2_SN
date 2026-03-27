import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Row,
  Col,
  Select,
  Tag,
  Typography,
  Space,
  Spin,
  Statistic,
  Empty,
  List,
  Progress,
  Alert,
  Badge,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  UserOutlined,
  FireOutlined,
  HistoryOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { tasksApi, statsApi } from '../../api/tasksApi';
import { useAuth } from '../../auth/AuthContext';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Text } = Typography;

// Mirror the backend status categorization
const categorizeStatus = (status) => {
  const s = String(status || '').trim().toLowerCase();
  if (['to do', 'todo', 'open', 'backlog', 'selected for development'].includes(s)) return 'todo';
  if (['in progress', 'in-progress', 'doing', 'review', 'code review', 'testing', 'qa'].includes(s))
    return 'in_progress';
  if (['done', 'closed', 'resolved', 'complete', 'completed'].includes(s)) return 'done';
  return 'other';
};

const STATUS_LABEL = { todo: 'To Do', in_progress: 'In Progress', done: 'Done', other: 'Other' };
const STATUS_COLOR = { todo: '#8c8c8c', in_progress: '#1677ff', done: '#52c41a', other: '#fa8c16' };

const PRIORITY_COLOR = { highest: 'red', critical: 'red', high: 'orange', medium: 'blue', low: 'cyan' };
const getPriorityColor = (p) => PRIORITY_COLOR[String(p || '').toLowerCase()] || 'default';

const getDeadlineTag = (dueDate) => {
  if (!dueDate) return null;
  const diff = dayjs(dueDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (diff < 0) return { label: `Quá hạn ${Math.abs(diff)} ngày`, color: 'red', urgent: true };
  if (diff === 0) return { label: 'Hôm nay!', color: 'red', urgent: true };
  if (diff <= 2) return { label: `Còn ${diff} ngày`, color: 'orange', urgent: true };
  return null;
};

const COLUMNS = [
  { key: 'todo', label: 'To Do', icon: <ClockCircleOutlined />, color: '#8c8c8c' },
  { key: 'in_progress', label: 'In Progress', icon: <SyncOutlined spin />, color: '#1677ff' },
  { key: 'done', label: 'Done', icon: <CheckCircleOutlined />, color: '#52c41a' },
];

// ─── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onStatusChange, isUpdating }) {
  const deadline = getDeadlineTag(task.due_date);
  const cat = categorizeStatus(task.status);

  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        border: deadline?.urgent ? `1px solid ${deadline.color === 'red' ? '#ff4d4f' : '#fa8c16'}` : undefined,
        background: deadline?.urgent ? (deadline.color === 'red' ? '#fff1f0' : '#fff7e6') : '#fff',
        borderRadius: 8,
      }}
      styles={{ body: { padding: '10px 12px' } }}
    >
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {/* Key + Priority */}
        <Row justify="space-between" align="middle">
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
            {task.jira_key || '—'}
          </Text>
          {task.priority && (
            <Tag color={getPriorityColor(task.priority)} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>
              {task.priority}
            </Tag>
          )}
        </Row>

        {/* Title */}
        <Text
          strong
          style={{ fontSize: 13, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          title={task.title}
        >
          {task.title}
        </Text>

        {/* Sprint tag */}
        {task.sprint && (
          <Tag style={{ fontSize: 10, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.sprint}
          </Tag>
        )}

        {/* Deadline badge */}
        {deadline && (
          <Tag color={deadline.color} icon={<ClockCircleOutlined />} style={{ fontSize: 11 }}>
            {deadline.label}
          </Tag>
        )}

        {/* Status dropdown */}
        <Select
          size="small"
          value={task.status}
          loading={isUpdating}
          disabled={isUpdating}
          style={{ width: '100%', marginTop: 2 }}
          onChange={(val) => onStatusChange(task.id, val)}
          options={[
            { value: 'To Do', label: <span style={{ color: STATUS_COLOR.todo }}>● To Do</span> },
            { value: 'In Progress', label: <span style={{ color: STATUS_COLOR.in_progress }}>● In Progress</span> },
            { value: 'Done', label: <span style={{ color: STATUS_COLOR.done }}>● Done</span> },
          ]}
        />
      </Space>
    </Card>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function MemberDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);

  // ── Queries ──────────────────────────────────────────
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['my-groups'],
    queryFn: () => tasksApi.getMyGroups().then((r) => r.data),
  });

  // Auto-select first group
  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', selectedGroupId],
    queryFn: () => tasksApi.getSprints(selectedGroupId).then((r) => r.data),
    enabled: !!selectedGroupId,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['member-my-tasks', selectedGroupId],
    queryFn: () => tasksApi.getMyTasks({ groupId: selectedGroupId, size: 100 }).then((r) => r.data),
    enabled: !!selectedGroupId,
  });

  const { data: personalStats } = useQuery({
    queryKey: ['personal-stats', user?.id, selectedGroupId],
    queryFn: () =>
      statsApi.getPersonalStats(user.id, selectedGroupId ? { groupId: selectedGroupId } : {}).then((r) => r.data),
    enabled: !!user?.id,
  });

  // Previous sprint for comparison
  const previousSprintName = useMemo(() => {
    if (!selectedSprint || sprints.length < 2) return null;
    const idx = sprints.indexOf(selectedSprint);
    return idx > 0 ? sprints[idx - 1] : null;
  }, [selectedSprint, sprints]);

  const { data: prevSprintData } = useQuery({
    queryKey: ['member-my-tasks-prev', selectedGroupId, previousSprintName],
    queryFn: () =>
      tasksApi
        .getMyTasks({ groupId: selectedGroupId, sprintName: previousSprintName, size: 100 })
        .then((r) => r.data),
    enabled: !!selectedGroupId && !!previousSprintName,
  });

  // ── Mutation ──────────────────────────────────────────
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => tasksApi.updateStatus(id, status),
  });

  const handleStatusChange = (taskId, newStatus) => {
    setUpdatingTaskId(taskId);
    updateStatusMutation.mutate(
      { id: taskId, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['member-my-tasks', selectedGroupId] });
          queryClient.invalidateQueries({ queryKey: ['personal-stats', user?.id, selectedGroupId] });
          message.success('Đã cập nhật trạng thái');
        },
        onError: (err) => {
          message.error(err.response?.data?.message || 'Cập nhật thất bại');
        },
        onSettled: () => setUpdatingTaskId(null),
      }
    );
  };

  // ── Derived data ──────────────────────────────────────
  const allTasks = useMemo(() => tasksData?.items || [], [tasksData]);

  const filteredTasks = useMemo(() => {
    if (!selectedSprint) return allTasks;
    return allTasks.filter((t) => t.sprint === selectedSprint);
  }, [allTasks, selectedSprint]);

  const tasksByStatus = useMemo(() => {
    const buckets = { todo: [], in_progress: [], done: [], other: [] };
    filteredTasks.forEach((t) => buckets[categorizeStatus(t.status)].push(t));
    return buckets;
  }, [filteredTasks]);

  const sprintStats = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((t) => categorizeStatus(t.status) === 'done').length;
    const inProgress = filteredTasks.filter((t) => categorizeStatus(t.status) === 'in_progress').length;
    return {
      total,
      done,
      inProgress,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
  }, [filteredTasks]);

  const prevSprintDone = useMemo(() => {
    const tasks = prevSprintData?.items || [];
    return tasks.filter((t) => categorizeStatus(t.status) === 'done').length;
  }, [prevSprintData]);

  // Activity feed: 5 most recently updated tasks
  const activityFeed = useMemo(() => allTasks.slice(0, 5), [allTasks]);

  // ── Loading / empty states ────────────────────────────
  if (groupsLoading) {
    return <Spin size="large" style={{ display: 'block', marginTop: 120, textAlign: 'center' }} />;
  }

  if (!groups.length) {
    return (
      <Empty
        description="Bạn chưa thuộc nhóm nào. Vui lòng liên hệ admin."
        style={{ marginTop: 80 }}
      />
    );
  }

  // ── Decide which values to show in stats ─────────────
  const showingSprintStats = !!selectedSprint;
  const statDone = showingSprintStats ? sprintStats.done : (personalStats?.doneCount ?? 0);
  const statTotal = showingSprintStats ? sprintStats.total : (personalStats?.assignedCount ?? 0);
  const statInProgress = showingSprintStats ? sprintStats.inProgress : (personalStats?.inProgressCount ?? 0);
  const statRate = showingSprintStats ? sprintStats.rate : (personalStats?.completionRate ?? 0);

  const doneComparison =
    showingSprintStats && previousSprintName != null
      ? sprintStats.done - prevSprintDone
      : null;

  return (
    <div>
      {/* ── Header ─────────────────────────────────────── */}
      <Row justify="space-between" align="middle" wrap style={{ marginBottom: 20, gap: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            Xin chào, {user?.full_name || user?.email} 👋
          </Title>
          <Text type="secondary">Theo dõi task và tiến độ cá nhân của bạn</Text>
        </Col>
        <Col>
          <Space wrap>
            <Select
              value={selectedGroupId}
              onChange={(v) => {
                setSelectedGroupId(v);
                setSelectedSprint(null);
              }}
              style={{ minWidth: 180 }}
              placeholder="Chọn nhóm"
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Select
              value={selectedSprint}
              onChange={(v) => setSelectedSprint(v || null)}
              style={{ minWidth: 150 }}
              placeholder="Tất cả sprint"
              allowClear
              options={sprints.map((s) => ({ value: s, label: s }))}
            />
          </Space>
        </Col>
      </Row>

      {/* ── Overdue alert ──────────────────────────────── */}
      {!showingSprintStats && personalStats?.overdueCount > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<FireOutlined />}
          message={`${personalStats.overdueCount} task đã quá hạn!`}
          description="Hãy cập nhật trạng thái hoặc liên hệ leader để điều chỉnh deadline."
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      {/* ── Stats row ──────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title={showingSprintStats ? 'Task trong sprint' : 'Task được giao'}
              value={statTotal}
              prefix={<UserOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Đã hoàn thành"
              value={statDone}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix={
                doneComparison !== null ? (
                  <span
                    style={{
                      fontSize: 13,
                      color: doneComparison >= 0 ? '#52c41a' : '#ff4d4f',
                      marginLeft: 4,
                    }}
                  >
                    {doneComparison >= 0 ? (
                      <ArrowUpOutlined />
                    ) : (
                      <ArrowDownOutlined />
                    )}
                    {Math.abs(doneComparison)} so với sprint trước
                  </span>
                ) : null
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Đang thực hiện"
              value={statInProgress}
              valueStyle={{ color: '#1677ff' }}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card styles={{ body: { paddingBottom: 12 } }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              % Hoàn thành
              {showingSprintStats && previousSprintName && (
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                  (sprint: {selectedSprint})
                </Text>
              )}
            </Text>
            <Progress
              percent={statRate}
              status={statRate >= 100 ? 'success' : 'active'}
              style={{ marginTop: 6 }}
              strokeColor={statRate >= 100 ? '#52c41a' : '#1677ff'}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* ── Task columns ─────────────────────────────── */}
        <Col xs={24} xl={17}>
          {tasksLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <Spin />
            </div>
          ) : (
            <Row gutter={[12, 12]}>
              {COLUMNS.map((col) => (
                <Col xs={24} md={8} key={col.key}>
                  <Card
                    title={
                      <Space>
                        <span style={{ color: col.color }}>{col.icon}</span>
                        <span style={{ color: col.color, fontWeight: 600 }}>{col.label}</span>
                        <Badge
                          count={tasksByStatus[col.key]?.length || 0}
                          style={{ backgroundColor: col.color }}
                          showZero
                        />
                      </Space>
                    }
                    styles={{
                      body: {
                        padding: 8,
                        maxHeight: 540,
                        overflowY: 'auto',
                        background: '#fafafa',
                        borderRadius: '0 0 8px 8px',
                      },
                      header: { borderBottom: `2px solid ${col.color}` },
                    }}
                  >
                    {tasksByStatus[col.key]?.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Không có task"
                        style={{ margin: '24px 0' }}
                      />
                    ) : (
                      tasksByStatus[col.key].map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          isUpdating={updatingTaskId === task.id}
                        />
                      ))
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Col>

        {/* ── Activity feed ──────────────────────────── */}
        <Col xs={24} xl={7}>
          <Card
            title={
              <Space>
                <HistoryOutlined style={{ color: '#722ed1' }} />
                <span>Hoạt động gần đây</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            {activityFeed.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoạt động" />
            ) : (
              <List
                dataSource={activityFeed}
                size="small"
                split={false}
                renderItem={(task) => {
                  const cat = categorizeStatus(task.status);
                  const dl = getDeadlineTag(task.due_date);
                  return (
                    <List.Item
                      style={{
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'block',
                      }}
                    >
                      <Row justify="space-between" align="middle" style={{ marginBottom: 2 }}>
                        <Text
                          type="secondary"
                          style={{ fontSize: 11, fontFamily: 'monospace' }}
                        >
                          {task.jira_key || task.id?.slice(0, 8)}
                        </Text>
                        <Tag
                          style={{
                            fontSize: 10,
                            margin: 0,
                            background: STATUS_COLOR[cat],
                            color: '#fff',
                            border: 'none',
                            lineHeight: '18px',
                          }}
                        >
                          {STATUS_LABEL[cat]}
                        </Tag>
                      </Row>
                      <Text
                        style={{ fontSize: 12, display: 'block', marginBottom: 2 }}
                        ellipsis={{ tooltip: task.title }}
                      >
                        {task.title}
                      </Text>
                      <Row justify="space-between" align="middle">
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(task.updated_at).fromNow()}
                        </Text>
                        {dl && (
                          <Tag color={dl.color} style={{ fontSize: 10, margin: 0 }}>
                            {dl.label}
                          </Tag>
                        )}
                      </Row>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
