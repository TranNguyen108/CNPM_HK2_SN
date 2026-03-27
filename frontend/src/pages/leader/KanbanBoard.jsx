import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Typography,
  Button,
  Select,
  Avatar,
  Tag,
  Badge,
  Modal,
  Spin,
  Progress,
  Row,
  Col,
  Table,
  Tooltip,
  Space,
  Divider,
  message,
  Segmented,
  Descriptions,
  Empty,
  Alert,
  Card,
  Skeleton,
  List,
} from 'antd';
import {
  SyncOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  UserOutlined,
  CalendarOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  LinkOutlined,
  GithubOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { tasksApi, syncApi, githubApi } from '../../api/tasksApi';
import { statsApi } from '../../api/tasksApi';
import { adminApi } from '../../api/adminApi';
import { useAuth } from '../../auth/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeStatus(status) {
  if (!status) return 'todo';
  const s = status.toLowerCase().trim();
  const DONE = ['done', 'closed', 'resolved', 'complete', 'completed'];
  const IN_PROGRESS = ['in progress', 'in-progress', 'doing', 'review', 'code review', 'testing', 'qa'];
  if (DONE.includes(s)) return 'done';
  if (IN_PROGRESS.some((k) => s === k || s.includes(k))) return 'in_progress';
  return 'todo';
}

function priorityColor(priority) {
  if (!priority) return 'default';
  switch (priority.toLowerCase()) {
    case 'highest': return 'red';
    case 'high':    return 'volcano';
    case 'medium':  return 'orange';
    case 'low':     return 'green';
    case 'lowest':  return 'lime';
    default:        return 'blue';
  }
}

function avatarColor(str) {
  if (!str) return '#ccc';
  let hash = 0;
  for (const c of str) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 55%, 50%)`;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'todo',        label: 'TO DO',        color: '#8c8c8c', statusValue: 'To Do' },
  { key: 'in_progress', label: 'IN PROGRESS',  color: '#1677ff', statusValue: 'In Progress' },
  { key: 'done',        label: 'DONE',         color: '#52c41a', statusValue: 'Done' },
];

const PRIORITY_OPTIONS = [
  { label: 'Highest', value: 'Highest' },
  { label: 'High',    value: 'High' },
  { label: 'Medium',  value: 'Medium' },
  { label: 'Low',     value: 'Low' },
  { label: 'Lowest',  value: 'Lowest' },
];

// ─── TaskCard ────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick, onDragStart, isDragging }) {
  const isOverdue = task.due_date && dayjs(task.due_date).isBefore(dayjs(), 'day');

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task.id)}
      onClick={() => onClick(task)}
      style={{
        background: '#fff',
        border: isDragging ? '2px dashed #1677ff' : '1px solid #f0f0f0',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: 'grab',
        opacity: isDragging ? 0.45 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
        transition: 'box-shadow 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.13)')}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)')}
    >
      {/* Priority + Jira key row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Tag color={priorityColor(task.priority)} style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
          {task.priority || 'No Priority'}
        </Tag>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {task.jira_key}
        </Typography.Text>
      </div>

      {/* Title */}
      <Typography.Text
        style={{ fontSize: 13, display: 'block', marginBottom: 8, fontWeight: 500, lineHeight: '1.4' }}
        ellipsis={{ rows: 2 }}
      >
        {task.title}
      </Typography.Text>

      {/* Footer: deadline + avatar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {task.due_date && (
            <Typography.Text
              type={isOverdue ? 'danger' : 'secondary'}
              style={{ fontSize: 11 }}
            >
              <CalendarOutlined /> {dayjs(task.due_date).format('DD/MM/YY')}
            </Typography.Text>
          )}
        </span>
        {task.assignee_email ? (
          <Tooltip title={task.assignee_email}>
            <Avatar
              size={24}
              style={{ backgroundColor: avatarColor(task.assignee_email), fontSize: 11, flexShrink: 0 }}
            >
              {task.assignee_email[0]?.toUpperCase()}
            </Avatar>
          </Tooltip>
        ) : (
          <Avatar size={24} icon={<UserOutlined />} style={{ backgroundColor: '#d9d9d9', flexShrink: 0 }} />
        )}
      </div>

      {/* Story points */}
      {task.story_points != null && (
        <Tag style={{ fontSize: 10, marginTop: 4 }}>{task.story_points} SP</Tag>
      )}
    </div>
  );
}

// ─── GitHub Analytics Helpers ────────────────────────────────────────────────

const HEAT_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

function heatColor(count) {
  if (!count) return HEAT_COLORS[0];
  if (count <= 2) return HEAT_COLORS[1];
  if (count <= 5) return HEAT_COLORS[2];
  if (count <= 10) return HEAT_COLORS[3];
  return HEAT_COLORS[4];
}

/**
 * GitHub-style contribution heatmap.
 * Rows = days-of-week (Mon→Sun), Columns = weeks (oldest→newest).
 */
function CommitHeatmap({ heatmap }) {
  if (!heatmap?.length) {
    return <Empty description="Chưa có dữ liệu commit" style={{ padding: 16 }} />;
  }

  const CELL = 13;
  const GAP = 3;

  // Pad so first cell lands on Mon (getDay: 0=Sun → mapped to 6, 1=Mon → 0, …)
  const firstDate = new Date(heatmap[0].date + 'T00:00:00');
  const firstDow = (firstDate.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const padded = [...Array(firstDow).fill(null), ...heatmap];

  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, Math.min(i + 7, padded.length)));
  }

  const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

  return (
    <div>
      <div style={{ display: 'flex', gap: GAP }}>
        {/* Day-of-week labels */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: GAP,
            marginRight: 4,
            paddingTop: CELL + GAP,
          }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                height: CELL,
                lineHeight: `${CELL}px`,
                fontSize: 9,
                color: '#8c8c8c',
                width: 26,
                textAlign: 'right',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div style={{ overflowX: 'auto' }}>
          {/* Month labels row */}
          <div style={{ display: 'flex', gap: GAP, marginBottom: GAP }}>
            {weeks.map((week, wi) => {
              const firstReal = week.find((c) => c !== null);
              const isFirstOfMonth =
                firstReal && new Date(firstReal.date + 'T00:00:00').getDate() <= 7;
              return (
                <div
                  key={wi}
                  style={{ width: CELL, height: CELL, fontSize: 9, color: '#8c8c8c', lineHeight: `${CELL}px` }}
                >
                  {isFirstOfMonth ? dayjs(firstReal.date).format('MMM') : ''}
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div style={{ display: 'flex', gap: GAP }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
                {Array.from({ length: 7 }, (_, di) => {
                  const cell = week[di];
                  if (!cell) return <div key={di} style={{ width: CELL, height: CELL }} />;
                  return (
                    <Tooltip
                      key={di}
                      title={`${cell.count} commit${cell.count !== 1 ? 's' : ''} ngày ${cell.date}`}
                      mouseEnterDelay={0}
                    >
                      <div
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 2,
                          backgroundColor: heatColor(cell.count),
                          cursor: cell.count > 0 ? 'pointer' : 'default',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
          justifyContent: 'flex-end',
          fontSize: 11,
          color: '#8c8c8c',
        }}
      >
        <span>Ít</span>
        {HEAT_COLORS.map((c) => (
          <div
            key={c}
            style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: c, flexShrink: 0 }}
          />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}

// ─── KanbanBoard ─────────────────────────────────────────────────────────────

export default function KanbanBoard() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  // Persist last visited groupId for sidebar navigation
  useEffect(() => {
    if (groupId) localStorage.setItem('lastBoardGroupId', groupId);
  }, [groupId]);

  // ── UI state
  const [viewMode, setViewMode] = useState('board');
  const [filterSprint, setFilterSprint] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState(null);
  const [filterPriority, setFilterPriority] = useState(null);

  // ── Drag state
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  // ── Modal state
  const [selectedTask, setSelectedTask] = useState(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);

  // ── Fetch tasks (server-side sprint + assignee filter)
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', groupId, filterSprint, filterAssignee],
    queryFn: () =>
      tasksApi
        .getTasks({
          groupId,
          ...(filterSprint ? { sprintName: filterSprint } : {}),
          ...(filterAssignee ? { assigneeId: filterAssignee } : {}),
          page: 1,
          size: 200,
        })
        .then((r) => r.data),
    enabled: !!groupId,
  });

  // ── Fetch sprints
  const { data: sprintsData } = useQuery({
    queryKey: ['sprints', groupId],
    queryFn: () => tasksApi.getSprints(groupId).then((r) => r.data),
    enabled: !!groupId,
  });

  // ── Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['task-stats', groupId],
    queryFn: () => tasksApi.getStats(groupId).then((r) => r.data),
    enabled: !!groupId,
  });

  // ── Fetch group members (ADMIN only; fallback to extracting from tasks)
  const { data: membersData } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      try {
        const r = await adminApi.getMembers(groupId);
        return r.data;
      } catch {
        return null; // 403 for non-admin — handled below
      }
    },
    enabled: !!groupId,
    retry: false,
  });

  // ── GitHub analytics queries (only fetched when GitHub tab is active)
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['commit-heatmap', groupId],
    queryFn: () => githubApi.getCommitHeatmap(groupId, 90).then((r) => r.data),
    enabled: !!groupId && viewMode === 'github',
    staleTime: 60_000,
    retry: 1,
  });

  const { data: recentCommitsData, isLoading: recentCommitsLoading } = useQuery({
    queryKey: ['recent-commits', groupId],
    queryFn: () => githubApi.getRecentCommits(groupId, 10).then((r) => r.data),
    enabled: !!groupId && viewMode === 'github',
    staleTime: 60_000,
    retry: 1,
  });

  const { data: commitsByMemberData, isLoading: commitsByMemberLoading } = useQuery({
    queryKey: ['commits-by-member', groupId],
    queryFn: () => githubApi.getCommitsByMember(groupId, 30).then((r) => r.data),
    enabled: !!groupId && viewMode === 'github',
    staleTime: 60_000,
    retry: 1,
  });

  const { data: memberStatsData } = useQuery({
    queryKey: ['member-stats', groupId],
    queryFn: () => statsApi.getMemberStats(groupId).then((r) => r.data),
    enabled: !!groupId && viewMode === 'github',
    staleTime: 60_000,
    retry: 1,
  });

  // ── Task list with client-side priority filter
  const allTasks = tasksData?.items || [];
  const tasks = useMemo(
    () =>
      filterPriority
        ? allTasks.filter((t) => t.priority?.toLowerCase() === filterPriority.toLowerCase())
        : allTasks,
    [allTasks, filterPriority],
  );

  // ── Members list for assign dropdown
  const membersList = useMemo(() => {
    if (membersData) {
      return membersData.map((m) => ({
        id: m.user_id || m.id,
        email: m.email || '',
        full_name: m.full_name || m.email || '',
      }));
    }
    // Fallback: extract unique assignees from loaded tasks
    const seen = new Map();
    for (const t of allTasks) {
      if (t.assignee_id && !seen.has(t.assignee_id)) {
        seen.set(t.assignee_id, {
          id: t.assignee_id,
          email: t.assignee_email || '',
          full_name: t.assignee_email || '',
        });
      }
    }
    return [...seen.values()];
  }, [membersData, allTasks]);

  // ── Sprint stats (for overview panel)
  const currentSprintStats = useMemo(() => {
    if (!statsData) return null;
    if (filterSprint && statsData.bySprint) {
      return statsData.bySprint.find((s) => s.sprint === filterSprint) || null;
    }
    return statsData.summary || null;
  }, [statsData, filterSprint]);

  // ── Mutations
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => tasksApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', groupId] });
      messageApi.success('Đã cập nhật trạng thái');
    },
    onError: (err) =>
      messageApi.error(`Không thể cập nhật: ${err.response?.data?.message || err.message}`),
  });

  const assignMutation = useMutation({
    mutationFn: ({ taskId, assigneeId }) => tasksApi.assignTask(taskId, assigneeId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] });
      setAssignModalVisible(false);
      setAssignTarget(null);
      const assignee = res.data?.assignee;
      messageApi.success(
        `Đã gán cho ${assignee?.full_name || assignee?.email || 'thành viên'}`,
      );
      // Refresh the task detail if still open
      if (selectedTask?.id === res.data?.task?.id) {
        setSelectedTask(res.data.task);
      }
    },
    onError: (err) =>
      messageApi.error(`Không thể gán task: ${err.response?.data?.message || err.message}`),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncApi.syncJira(groupId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', groupId] });
      queryClient.invalidateQueries({ queryKey: ['task-stats', groupId] });
      const d = res.data;
      messageApi.success(
        `Đồng bộ Jira thành công — ${d.newTasks ?? d.newCount ?? 0} mới, ${d.updatedTasks ?? d.updatedCount ?? 0} cập nhật`,
      );
    },
    onError: (err) =>
      messageApi.error(`Đồng bộ thất bại: ${err.response?.data?.message || err.message}`),
  });

  const syncGithubMutation = useMutation({
    mutationFn: () => syncApi.syncGithub(groupId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['commit-heatmap', groupId] });
      queryClient.invalidateQueries({ queryKey: ['recent-commits', groupId] });
      queryClient.invalidateQueries({ queryKey: ['commits-by-member', groupId] });
      const d = res.data;
      messageApi.success(`Sync GitHub thành công — ${d.repo}`);
    },
    onError: (err) =>
      messageApi.error(`Sync GitHub thất bại: ${err.response?.data?.message || err.message}`),
  });

  // ── Drag-and-drop handlers
  const handleDragStart = (taskId) => setDraggingId(taskId);
  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    setDragOverCol(colKey);
  };
  const handleDragLeave = () => setDragOverCol(null);
  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };
  const handleDrop = (colKey) => {
    if (!draggingId || !colKey) return;
    const col = COLUMNS.find((c) => c.key === colKey);
    if (col) {
      const task = allTasks.find((t) => t.id === draggingId);
      if (task && normalizeStatus(task.status) !== colKey) {
        updateStatusMutation.mutate({ id: draggingId, status: col.statusValue });
      }
    }
    setDraggingId(null);
    setDragOverCol(null);
  };

  // ── Computed kanban columns
  const tasksByCol = useMemo(
    () => ({
      todo:        tasks.filter((t) => normalizeStatus(t.status) === 'todo'),
      in_progress: tasks.filter((t) => normalizeStatus(t.status) === 'in_progress'),
      done:        tasks.filter((t) => normalizeStatus(t.status) === 'done'),
    }),
    [tasks],
  );

  // ── Sprint options
  const sprintOptions = (sprintsData?.items || []).map((s) => ({ label: s, value: s }));

  // ── Assignee options (for filter bar)
  const assigneeFilterOptions = membersList.map((m) => ({
    label: (
      <Space size={6}>
        <Avatar size={18} style={{ backgroundColor: avatarColor(m.email), fontSize: 10 }}>
          {m.email[0]?.toUpperCase()}
        </Avatar>
        {m.full_name}
      </Space>
    ),
    value: m.id,
  }));

  // ── Combined member data for grouped bar chart (commits + taskDone)
  const combinedMemberData = useMemo(() => {
    const commitMap = new Map(
      (commitsByMemberData?.items || []).map((item) => [item.userId, item.commits]),
    );
    const statsItems = memberStatsData?.items || [];

    if (!statsItems.length) return [];

    return statsItems.map((m) => ({
      name: (m.fullName || m.email || '').split(' ').slice(-1)[0], // last name only for brevity
      fullName: m.fullName || m.email,
      commits: commitMap.get(m.userId) ?? 0,
      done: m.doneCount ?? 0,
    }));
  }, [commitsByMemberData, memberStatsData]);

  // ── Table columns (list view)
  const tableColumns = [
    {
      title: 'KEY',
      dataIndex: 'jira_key',
      key: 'jira_key',
      width: 110,
      render: (v) => <Tag style={{ fontFamily: 'monospace' }}>{v}</Tag>,
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (v, record) => (
        <Typography.Text
          style={{ cursor: 'pointer', color: '#1677ff' }}
          onClick={() => setSelectedTask(record)}
        >
          {v}
        </Typography.Text>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (v) => {
        const norm = normalizeStatus(v);
        return (
          <Badge
            status={norm === 'done' ? 'success' : norm === 'in_progress' ? 'processing' : 'default'}
            text={v}
          />
        );
      },
    },
    {
      title: 'Ưu tiên',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (v) =>
        v ? <Tag color={priorityColor(v)}>{v}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Assignee',
      dataIndex: 'assignee_email',
      key: 'assignee_email',
      width: 180,
      render: (v) =>
        v ? (
          <Space size={6}>
            <Avatar size={20} style={{ backgroundColor: avatarColor(v), fontSize: 10 }}>
              {v[0]?.toUpperCase()}
            </Avatar>
            <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">Chưa gán</Typography.Text>
        ),
    },
    {
      title: 'Sprint',
      dataIndex: 'sprint',
      key: 'sprint',
      width: 130,
      render: (v) => (v ? <Tag color="geekblue">{v}</Tag> : '—'),
    },
    {
      title: 'Deadline',
      dataIndex: 'due_date',
      key: 'due_date',
      width: 110,
      render: (v) => {
        if (!v) return '—';
        const overdue = dayjs(v).isBefore(dayjs(), 'day');
        return (
          <Typography.Text type={overdue ? 'danger' : undefined}>
            {dayjs(v).format('DD/MM/YYYY')}
          </Typography.Text>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, record) => (
        <Button size="small" onClick={() => setSelectedTask(record)}>
          Chi tiết
        </Button>
      ),
    },
  ];

  // ── Sprint progress
  const progressTotal = currentSprintStats?.total || 0;
  const progressDone  = currentSprintStats?.done  || 0;
  const progressPercent = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  const isLeaderOrAdmin = user?.role === 'LEADER' || user?.role === 'ADMIN';

  if (!groupId) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Typography.Text type="secondary">
          Thiếu Group ID trong URL. Vui lòng điều hướng lại từ Dashboard.
        </Typography.Text>
      </div>
    );
  }

  return (
    <div>
      {contextHolder}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            Kanban Board
          </Typography.Title>
          <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11 }}>
            Group: {groupId}
          </Tag>
        </Space>

        <Space wrap>
          <Button
            icon={<SyncOutlined spin={syncMutation.isPending} />}
            loading={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            type="primary"
            ghost
          >
            Sync Jira
          </Button>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'board', icon: <AppstoreOutlined />, label: 'Board' },
              { value: 'list', icon: <UnorderedListOutlined />, label: 'List' },
              { value: 'github', icon: <GithubOutlined />, label: 'GitHub' },
            ]}
          />
        </Space>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <Row gutter={[10, 10]} style={{ marginBottom: 14 }} align="middle">
        <Col>
          <Select
            placeholder="Sprint"
            allowClear
            style={{ width: 190 }}
            value={filterSprint}
            onChange={setFilterSprint}
            options={sprintOptions}
          />
        </Col>
        <Col>
          <Select
            placeholder="Assignee"
            allowClear
            style={{ width: 190 }}
            value={filterAssignee}
            onChange={setFilterAssignee}
            options={assigneeFilterOptions}
          />
        </Col>
        <Col>
          <Select
            placeholder="Ưu tiên"
            allowClear
            style={{ width: 140 }}
            value={filterPriority}
            onChange={setFilterPriority}
            options={PRIORITY_OPTIONS}
          />
        </Col>
        <Col>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </Typography.Text>
        </Col>
      </Row>

      {/* ── Sprint Overview Panel ───────────────────────────────────────── */}
      {progressTotal > 0 && (
        <div
          style={{
            background: '#f6f8fa',
            border: '1px solid #e4e7eb',
            borderRadius: 8,
            padding: '12px 20px',
            marginBottom: 16,
          }}
        >
          <Row gutter={[24, 0]} align="middle">
            <Col flex="auto">
              <Typography.Text strong style={{ fontSize: 13 }}>
                Sprint{filterSprint ? `: ${filterSprint}` : ' Overview'}
              </Typography.Text>
              <Progress
                percent={progressPercent}
                size="small"
                style={{ marginTop: 6, marginBottom: 0 }}
                format={() => `${progressDone} / ${progressTotal} done`}
                strokeColor={{ from: '#108ee9', to: '#52c41a' }}
              />
            </Col>
            <Col>
              <Space size={20}>
                <div style={{ textAlign: 'center' }}>
                  <Typography.Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                    {progressDone}
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>Done</Typography.Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Typography.Text strong style={{ fontSize: 20, color: '#1677ff' }}>
                    {currentSprintStats?.in_progress || 0}
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>In Progress</Typography.Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Typography.Text strong style={{ fontSize: 20, color: '#8c8c8c' }}>
                    {currentSprintStats?.todo || 0}
                  </Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>To Do</Typography.Text>
                </div>
              </Space>
            </Col>
          </Row>
        </div>
      )}

      {/* ── Board / List / GitHub ───────────────────────────────────────── */}
      {viewMode === 'github' ? (
        /* ── GitHub Analytics Panel */
        <div>
          {/* Section header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Space>
              <GithubOutlined style={{ fontSize: 18 }} />
              <Typography.Title level={5} style={{ margin: 0 }}>
                GitHub Analytics
              </Typography.Title>
              {heatmapData?.configured && (
                <Tag color="green" icon={<BranchesOutlined />}>
                  {heatmapData.repo}
                </Tag>
              )}
            </Space>
            <Button
              type="primary"
              icon={<SyncOutlined spin={syncGithubMutation.isPending} />}
              loading={syncGithubMutation.isPending}
              onClick={() => syncGithubMutation.mutate()}
            >
              Sync GitHub
            </Button>
          </div>

          {heatmapData?.configured === false ? (
            <Alert
              type="info"
              showIcon
              message="GitHub chưa được cấu hình"
              description="Liên hệ Admin để thiết lập tích hợp GitHub (repo_owner, repo_name, access token) cho nhóm này."
              style={{ marginBottom: 16 }}
            />
          ) : (
            <>
              {/* ── Commit Heatmap ─────────────────────────────────────── */}
              <Card
                title={
                  <Space>
                    <span>Commit Activity</span>
                    <Tag color="default">90 ngày qua</Tag>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                {heatmapLoading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <CommitHeatmap heatmap={heatmapData?.heatmap} />
                )}
              </Card>

              {/* ── Member Comparison + Recent Commits ─────────────────── */}
              <Row gutter={[16, 16]}>
                {/* Grouped Bar Chart */}
                <Col xs={24} lg={14}>
                  <Card
                    title="So sánh đóng góp thành viên"
                    extra={<Tag color="purple">Commits vs Task Done</Tag>}
                    style={{ height: '100%' }}
                  >
                    {commitsByMemberLoading ? (
                      <Skeleton active paragraph={{ rows: 5 }} />
                    ) : combinedMemberData.length === 0 ? (
                      <Empty description="Chưa có dữ liệu" />
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={combinedMemberData}
                          margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            angle={-20}
                            textAnchor="end"
                            interval={0}
                          />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <RechartTooltip
                            formatter={(value, name, props) => [
                              value,
                              name === 'commits' ? 'Commits' : 'Task Done',
                            ]}
                            labelFormatter={(label, payload) =>
                              payload?.[0]?.payload?.fullName || label
                            }
                          />
                          <Legend
                            formatter={(value) =>
                              value === 'commits' ? 'Commits' : 'Task Done'
                            }
                          />
                          <Bar
                            dataKey="commits"
                            name="commits"
                            fill="#722ed1"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="done"
                            name="done"
                            fill="#52c41a"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
                </Col>

                {/* Recent Commits Timeline */}
                <Col xs={24} lg={10}>
                  <Card
                    title="10 Commit gần nhất"
                    style={{ height: '100%' }}
                    styles={{ body: { padding: '8px 16px' } }}
                  >
                    {recentCommitsLoading ? (
                      <Skeleton active avatar paragraph={{ rows: 3 }} />
                    ) : !recentCommitsData?.items?.length ? (
                      <Empty description="Chưa có commit nào" />
                    ) : (
                      <List
                        size="small"
                        dataSource={recentCommitsData.items}
                        renderItem={(commit) => (
                          <List.Item style={{ padding: '8px 0' }}>
                            <List.Item.Meta
                              avatar={
                                commit.author.avatarUrl ? (
                                  <Avatar src={commit.author.avatarUrl} size={28} />
                                ) : (
                                  <Avatar
                                    size={28}
                                    style={{
                                      backgroundColor: avatarColor(commit.author.email || commit.author.name),
                                      fontSize: 11,
                                    }}
                                  >
                                    {(commit.author.name || commit.author.email || '?')[0].toUpperCase()}
                                  </Avatar>
                                )
                              }
                              title={
                                <Tooltip title={commit.message}>
                                  <Typography.Text
                                    ellipsis
                                    style={{ fontSize: 12, maxWidth: 220, display: 'block' }}
                                  >
                                    {commit.message || '(no message)'}
                                  </Typography.Text>
                                </Tooltip>
                              }
                              description={
                                <Space size={6} wrap>
                                  <Tag
                                    style={{ fontFamily: 'monospace', fontSize: 10, margin: 0 }}
                                  >
                                    {commit.sha}
                                  </Tag>
                                  <Typography.Text
                                    type="secondary"
                                    style={{ fontSize: 11 }}
                                  >
                                    {commit.author.date
                                      ? dayjs(commit.author.date).fromNow()
                                      : ''}
                                  </Typography.Text>
                                  {commit.url && (
                                    <a
                                      href={commit.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ fontSize: 11 }}
                                    >
                                      view
                                    </a>
                                  )}
                                </Space>
                              }
                            />
                          </List.Item>
                        )}
                      />
                    )}
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </div>
      ) : tasksLoading ? (
        <div style={{ textAlign: 'center', padding: 72 }}>
          <Spin size="large" />
        </div>
      ) : viewMode === 'board' ? (
        /* ── Kanban Columns */
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'flex-start',
            overflowX: 'auto',
            paddingBottom: 8,
          }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(col.key)}
              onDragEnd={handleDragEnd}
              style={{
                flex: '1 1 290px',
                minWidth: 270,
                background: dragOverCol === col.key ? '#e6f4ff' : '#f5f7fa',
                borderRadius: 10,
                border:
                  dragOverCol === col.key ? '2px dashed #1677ff' : '2px solid transparent',
                padding: '12px',
                transition: 'background 0.15s, border 0.15s',
              }}
            >
              {/* Column header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <Space size={6}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: col.color,
                    }}
                  />
                  <Typography.Text
                    strong
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.05em',
                      color: '#595959',
                    }}
                  >
                    {col.label}
                  </Typography.Text>
                </Space>
                <Badge
                  count={tasksByCol[col.key].length}
                  style={{ backgroundColor: col.color }}
                  showZero
                />
              </div>

              {/* Cards */}
              <div style={{ minHeight: 80 }}>
                {tasksByCol[col.key].length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 0',
                      border: '1px dashed #d9d9d9',
                      borderRadius: 6,
                    }}
                  >
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Không có task
                    </Typography.Text>
                  </div>
                ) : (
                  tasksByCol[col.key].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={setSelectedTask}
                      onDragStart={handleDragStart}
                      isDragging={draggingId === task.id}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Table / List View */
        <Table
          dataSource={tasks}
          columns={tableColumns}
          rowKey="id"
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            pageSize: 25,
            showTotal: (total) => `${total} tasks`,
            showSizeChanger: false,
          }}
        />
      )}

      {/* ── Task Detail Modal ───────────────────────────────────────────── */}
      <Modal
        open={!!selectedTask}
        onCancel={() => setSelectedTask(null)}
        footer={null}
        title={
          <Space>
            <Tag style={{ fontFamily: 'monospace' }}>{selectedTask?.jira_key}</Tag>
            <span style={{ fontWeight: 600 }}>{selectedTask?.title}</span>
          </Space>
        }
        width={680}
        styles={{ body: { paddingTop: 8 } }}
      >
        {selectedTask && (
          <>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Trạng thái">
                <Badge
                  status={
                    normalizeStatus(selectedTask.status) === 'done'
                      ? 'success'
                      : normalizeStatus(selectedTask.status) === 'in_progress'
                      ? 'processing'
                      : 'default'
                  }
                  text={selectedTask.status || '—'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Ưu tiên">
                {selectedTask.priority ? (
                  <Tag color={priorityColor(selectedTask.priority)}>{selectedTask.priority}</Tag>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Sprint">
                {selectedTask.sprint ? (
                  <Tag color="geekblue">{selectedTask.sprint}</Tag>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Story Points">
                {selectedTask.story_points ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Deadline">
                {selectedTask.due_date ? dayjs(selectedTask.due_date).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Jira Key">
                <Tag style={{ fontFamily: 'monospace' }}>{selectedTask.jira_key}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '12px 0' }} />

            {/* Assignee section */}
            <div style={{ marginBottom: 14 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                Assignee
              </Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {selectedTask.assignee_email ? (
                  <Space>
                    <Avatar
                      style={{ backgroundColor: avatarColor(selectedTask.assignee_email) }}
                    >
                      {selectedTask.assignee_email[0]?.toUpperCase()}
                    </Avatar>
                    <Typography.Text>{selectedTask.assignee_email}</Typography.Text>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">Chưa được gán</Typography.Text>
                )}
                {isLeaderOrAdmin && (
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    onClick={() => {
                      setAssignTarget(selectedTask.assignee_id || null);
                      setAssignModalVisible(true);
                    }}
                  >
                    Gán cho...
                  </Button>
                )}
              </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* Subtasks section */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Typography.Text strong style={{ fontSize: 13 }}>
                  Subtasks
                </Typography.Text>
                <Tooltip title="Quản lý subtask trực tiếp trên Jira">
                  <Button size="small" icon={<PlusOutlined />} disabled>
                    Thêm subtask
                  </Button>
                </Tooltip>
              </div>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Subtask được quản lý trực tiếp trên Jira
                  </Typography.Text>
                }
                style={{ padding: '8px 0' }}
              />
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* Linked work items */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Space size={6}>
                  <LinkOutlined />
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    Linked Work Items
                  </Typography.Text>
                </Space>
                <Tooltip title="Quản lý liên kết trực tiếp trên Jira">
                  <Button size="small" icon={<PlusOutlined />} disabled>
                    Liên kết
                  </Button>
                </Tooltip>
              </div>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Linked items được quản lý trực tiếp trên Jira
                  </Typography.Text>
                }
                style={{ padding: '8px 0' }}
              />
            </div>
          </>
        )}
      </Modal>

      {/* ── Assign Modal ────────────────────────────────────────────────── */}
      <Modal
        open={assignModalVisible}
        title="Gán task cho thành viên"
        onCancel={() => {
          setAssignModalVisible(false);
          setAssignTarget(null);
        }}
        onOk={() => {
          if (!assignTarget) {
            messageApi.warning('Vui lòng chọn thành viên');
            return;
          }
          assignMutation.mutate({ taskId: selectedTask.id, assigneeId: assignTarget });
        }}
        okText="Gán"
        cancelText="Hủy"
        confirmLoading={assignMutation.isPending}
        width={440}
      >
        <div style={{ marginBottom: 12 }}>
          <Typography.Text>
            Gán task <Tag style={{ fontFamily: 'monospace' }}>{selectedTask?.jira_key}</Tag> cho:
          </Typography.Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn thành viên..."
          value={assignTarget}
          onChange={setAssignTarget}
          showSearch
          optionFilterProp="label"
        >
          {membersList.map((m) => (
            <Select.Option
              key={m.id}
              value={m.id}
              label={m.full_name || m.email}
            >
              <Space size={8}>
                <Avatar size={22} style={{ backgroundColor: avatarColor(m.email), fontSize: 11 }}>
                  {m.email[0]?.toUpperCase()}
                </Avatar>
                <span>{m.full_name}</span>
                {m.full_name !== m.email && (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    ({m.email})
                  </Typography.Text>
                )}
              </Space>
            </Select.Option>
          ))}
        </Select>
        {membersList.length === 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            Không tìm thấy thành viên. Đảm bảo nhóm đã được cấu hình.
          </Typography.Text>
        )}
      </Modal>
    </div>
  );
}
