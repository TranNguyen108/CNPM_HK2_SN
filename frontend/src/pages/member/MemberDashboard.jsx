import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Row,
  Col,
  Select,
  Tag,
  Typography,
  Space,
  Skeleton,
  Statistic,
  Empty,
  List,
  Progress,
  Alert,
  Badge,
  Tooltip,
  message,
  Button,
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
  GithubOutlined,
  TrophyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { tasksApi, statsApi, githubApi } from '../../api/tasksApi';
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

// ─── Commit Heatmap (7-day mini) ───────────────────────────────────────────────
const HEAT_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

const heatColor = (count) => {
  if (count === 0) return HEAT_COLORS[0];
  if (count <= 2) return HEAT_COLORS[1];
  if (count <= 5) return HEAT_COLORS[2];
  if (count <= 10) return HEAT_COLORS[3];
  return HEAT_COLORS[4];
};

const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function MiniCommitHeatmap({ heatmap }) {
  if (!heatmap?.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Chưa có dữ liệu commit"
        style={{ margin: '12px 0' }}
      />
    );
  }
  const days = heatmap.slice(-7);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        {days.map((cell, i) => (
          <Tooltip
            key={cell.date}
            title={`${cell.count} commit${cell.count !== 1 ? 's' : ''} ngày ${cell.date}`}
            mouseEnterDelay={0}
          >
            <div
              style={{
                flex: 1,
                borderRadius: 6,
                background: heatColor(cell.count),
                cursor: cell.count > 0 ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 4px',
                minHeight: 52,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: cell.count > 2 ? '#fff' : '#666',
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {DAY_LABELS[i] || dayjs(cell.date).format('ddd')}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: cell.count > 2 ? '#fff' : '#333',
                  lineHeight: 1,
                }}
              >
                {cell.count}
              </div>
            </div>
          </Tooltip>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 4,
          marginTop: 8,
        }}
      >
        <Text type="secondary" style={{ fontSize: 10 }}>Ít</Text>
        {HEAT_COLORS.map((c) => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
        ))}
        <Text type="secondary" style={{ fontSize: 10 }}>Nhiều</Text>
      </div>
    </div>
  );
}

// ─── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onStatusChange, isUpdating }) {
  const deadline = getDeadlineTag(task.due_date);

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

  const normalizedGroups = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);

  // Derive effective group: user-selected or first group
  const effectiveGroupId = selectedGroupId ?? normalizedGroups[0]?.id ?? null;

  const { data: sprintsResponse } = useQuery({
    queryKey: ['sprints', effectiveGroupId],
    queryFn: () => tasksApi.getSprints(effectiveGroupId).then((r) => r.data),
    enabled: !!effectiveGroupId,
  });

  const sprints = useMemo(() => {
    if (Array.isArray(sprintsResponse)) return sprintsResponse;
    if (Array.isArray(sprintsResponse?.items)) return sprintsResponse.items;
    return [];
  }, [sprintsResponse]);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['member-my-tasks', effectiveGroupId],
    queryFn: () => tasksApi.getMyTasks({ groupId: effectiveGroupId, size: 100 }).then((r) => r.data),
    enabled: !!effectiveGroupId,
  });

  const { data: personalStats } = useQuery({
    queryKey: ['personal-stats', user?.id, effectiveGroupId],
    queryFn: () =>
      statsApi.getPersonalStats(user.id, effectiveGroupId ? { groupId: effectiveGroupId } : {}).then((r) => r.data),
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

  // ── GitHub heatmap (7 days) ───────────────────────────
  const {
    data: heatmapData,
    isLoading: heatmapLoading,
  } = useQuery({
    queryKey: ['member-heatmap', selectedGroupId],
    queryFn: () => githubApi.getCommitHeatmap(selectedGroupId, 7).then((r) => r.data),
    enabled: !!selectedGroupId,
    staleTime: 60_000,
    retry: 1,
  });

  // ── Group member stats (for comparison) ──────────────
  const {
    data: memberStatsData,
    isLoading: memberStatsLoading,
    isError: memberStatsError,
    refetch: refetchMemberStats,
  } = useQuery({
    queryKey: ['member-group-stats', selectedGroupId],
    queryFn: () => statsApi.getMemberStats(selectedGroupId).then((r) => r.data),
    enabled: !!selectedGroupId,
    staleTime: 60_000,
    retry: 1,
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
          queryClient.invalidateQueries({ queryKey: ['member-my-tasks', effectiveGroupId] });
          queryClient.invalidateQueries({ queryKey: ['personal-stats', user?.id, effectiveGroupId] });
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

  // ── Group comparison derived data ─────────────────────
  const groupComparisonData = useMemo(() => {
    if (!memberStatsData?.items?.length) return [];
    return memberStatsData.items
      .map((m) => ({
        name: m.fullName?.split(' ').at(-1) || '?',
        fullName: m.fullName || '—',
        done: m.doneCount || 0,
        isMe: m.userId === user?.id,
      }))
      .sort((a, b) => b.done - a.done);
  }, [memberStatsData, user]);

  const myStats = useMemo(
    () => memberStatsData?.items?.find((m) => m.userId === user?.id) || null,
    [memberStatsData, user]
  );

  const myRank = useMemo(() => {
    if (!groupComparisonData.length) return null;
    const idx = groupComparisonData.findIndex((m) => m.isMe);
    return idx >= 0 ? { rank: idx + 1, total: groupComparisonData.length } : null;
  }, [groupComparisonData]);

  const contributionPct = useMemo(() => {
    if (!myStats || !memberStatsData?.items?.length) return null;
    const total = memberStatsData.items.reduce((s, m) => s + (m.doneCount || 0), 0);
    return total > 0 ? Math.round(((myStats.doneCount || 0) / total) * 100) : 0;
  }, [myStats, memberStatsData]);

  // ── Loading / empty states ────────────────────────────
  if (groupsLoading) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 24 }} />
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {[1, 2, 3, 4].map((k) => (
            <Col key={k} xs={12} sm={6}>
              <Card><Skeleton active paragraph={{ rows: 2 }} /></Card>
            </Col>
          ))}
        </Row>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!normalizedGroups.length) {
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
              value={effectiveGroupId}
              onChange={(v) => {
                setSelectedGroupId(v);
                setSelectedSprint(null);
              }}
              style={{ minWidth: 180 }}
              placeholder="Chọn nhóm"
              options={normalizedGroups.map((g) => ({ value: g.id, label: g.name }))}
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
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} lg={5}>
          <Card>
            <Statistic
              title={showingSprintStats ? 'Task trong sprint' : 'Task được giao'}
              value={statTotal}
              prefix={<UserOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
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
        <Col xs={12} sm={8} lg={5}>
          <Card>
            <Statistic
              title="Đang thực hiện"
              value={statInProgress}
              valueStyle={{ color: '#1677ff' }}
              prefix={<SyncOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={5}>
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
        {/* Contribution rank card */}
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Statistic
              title="Hạng trong nhóm"
              value={myRank ? `${myRank.rank}/${myRank.total}` : '—'}
              valueStyle={{ color: '#fa8c16', fontSize: 28 }}
              prefix={<TrophyOutlined style={{ color: '#fa8c16' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Analytics Row ──────────────────────────────── */}
      {effectiveGroupId && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {/* GitHub Heatmap 7 days */}
          <Col xs={24} lg={14}>
            <Card
              title={
                <Space>
                  <GithubOutlined />
                  <span>Hoạt động GitHub nhóm — 7 ngày qua</span>
                  {heatmapData?.repo && (
                    <Tag color="green" style={{ fontSize: 11 }}>
                      {heatmapData.repo}
                    </Tag>
                  )}
                </Space>
              }
              size="small"
              styles={{ body: { padding: '12px 16px' } }}
            >
              {heatmapLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : heatmapData?.configured === false ? (
                <Alert
                  type="info"
                  showIcon
                  message="GitHub chưa được cấu hình cho nhóm này"
                  description="Liên hệ Admin để thiết lập tích hợp GitHub."
                />
              ) : (
                <MiniCommitHeatmap heatmap={heatmapData?.heatmap} />
              )}
            </Card>
          </Col>

          {/* Group comparison */}
          <Col xs={24} lg={10}>
            <Card
              title={
                <Space>
                  <TrophyOutlined style={{ color: '#fa8c16' }} />
                  <span>So sánh đóng góp nhóm</span>
                  {myRank && (
                    <Tag color="gold" style={{ fontSize: 11 }}>
                      Hạng {myRank.rank}/{myRank.total}
                    </Tag>
                  )}
                </Space>
              }
              size="small"
              extra={
                memberStatsError && (
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => refetchMemberStats()}
                  >
                    Thử lại
                  </Button>
                )
              }
              styles={{ body: { padding: '12px 16px' } }}
            >
              {memberStatsLoading ? (
                <Skeleton active paragraph={{ rows: 3 }} />
              ) : memberStatsError ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Không thể tải dữ liệu"
                />
              ) : groupComparisonData.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />
              ) : (
                <>
                  {contributionPct !== null && (
                    <div style={{ marginBottom: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Tỉ lệ đóng góp của bạn
                      </Text>
                      <Progress
                        percent={contributionPct}
                        strokeColor="#722ed1"
                        style={{ marginTop: 4, marginBottom: 0 }}
                      />
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart
                      data={groupComparisonData}
                      layout="vertical"
                      margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} fontSize={10} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        fontSize={11}
                        width={44}
                        interval={0}
                      />
                      <RechartTooltip
                        formatter={(val) => [val, 'Task Done']}
                        labelFormatter={(label, payload) =>
                          payload?.[0]?.payload?.fullName || label
                        }
                      />
                      <Bar dataKey="done" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {groupComparisonData.map((entry) => (
                          <Cell
                            key={entry.fullName}
                            fill={entry.isMe ? '#722ed1' : '#b37feb'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <Text type="secondary" style={{ fontSize: 10, display: 'block', textAlign: 'right' }}>
                    Tím đậm = bạn · Tím nhạt = thành viên khác
                  </Text>
                </>
              )}
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        {/* ── Task columns ─────────────────────────────── */}
        <Col xs={24} xl={17}>
          {tasksLoading ? (
            <Row gutter={[12, 12]}>
              {COLUMNS.map((col) => (
                <Col xs={24} md={8} key={col.key}>
                  <Card title={<Skeleton.Input active size="small" style={{ width: 100 }} />}>
                    <Skeleton active paragraph={{ rows: 4 }} />
                  </Card>
                </Col>
              ))}
            </Row>
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

