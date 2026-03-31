import { useNavigate } from 'react-router-dom';
import {
  Card,
  Col,
  Row,
  Typography,
  Progress,
  Spin,
  Empty,
  Tag,
  Button,
  Statistic,
} from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { tasksApi, statsApi } from '../../api/tasksApi';
import { useAuth } from '../../auth/AuthContext';

const { Title, Text } = Typography;

/**
 * Fetches overview + sprint stats for one group and renders a summary card.
 */
function GroupCard({ group }) {
  const navigate = useNavigate();

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['lecturer-group-overview', group.id],
    queryFn: () => statsApi.getGroupOverview(group.id).then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: sprintList } = useQuery({
    queryKey: ['lecturer-sprints', group.id],
    queryFn: () => tasksApi.getSprints(group.id).then((r) => r.data),
    staleTime: 60_000,
  });

  // Use the last sprint as "current" sprint
  const currentSprint = Array.isArray(sprintList) ? sprintList[sprintList.length - 1] : null;

  const { data: sprintTaskData, isLoading: loadingStats } = useQuery({
    queryKey: ['lecturer-sprint-tasks', group.id, currentSprint],
    queryFn: () =>
      tasksApi
        .getTasks({ groupId: group.id, sprintName: currentSprint, size: 100 })
        .then((r) => r.data),
    enabled: !!currentSprint,
    staleTime: 60_000,
  });

  const items = Array.isArray(sprintTaskData?.items) ? sprintTaskData.items : [];
  const totalTasks = items.length;
  const doneTasks = items.filter((t) => {
    const s = (t.status || '').toLowerCase();
    return ['done', 'closed', 'resolved', 'complete', 'completed'].includes(s);
  }).length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const isLoading = loadingOverview || loadingStats;

  return (
    <Card
      hoverable
      style={{ height: '100%' }}
      onClick={() => navigate(`/lecturer/groups/${group.id}`)}
      actions={[
        <Button
          key="view"
          type="link"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/lecturer/groups/${group.id}`);
          }}
        >
          Xem chi tiết
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 8 }}>
        {group.semester && (
          <Tag color="blue" icon={<TeamOutlined />}>
            {group.semester}
          </Tag>
        )}
        {group.is_active ? (
          <Tag color="green">Đang hoạt động</Tag>
        ) : (
          <Tag color="default">Ngừng hoạt động</Tag>
        )}
      </div>

      <Title level={5} style={{ marginTop: 8, marginBottom: 4 }}>
        {group.name}
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
        {group.description || 'Không có mô tả'}
      </Text>

      {currentSprint && (
        <Text style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Sprint hiện tại: <strong>{currentSprint}</strong>
        </Text>
      )}

      {isLoading ? (
        <Spin size="small" />
      ) : (
        <>
          <Progress
            percent={progressPct}
            size="small"
            status={progressPct === 100 ? 'success' : 'active'}
          />
          <Row gutter={8} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Statistic
                title="Task Done"
                value={doneTasks}
                suffix={`/ ${totalTasks}`}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Còn lại"
                value={overview?.sprint?.daysLeft ?? '—'}
                suffix={overview?.sprint?.daysLeft != null ? ' ngày' : ''}
                prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
          </Row>
        </>
      )}
    </Card>
  );
}

export default function LecturerDashboard() {
  const { user } = useAuth();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['lecturer-my-groups'],
    queryFn: () => tasksApi.getMyGroups().then((r) => r.data),
    staleTime: 60_000,
  });

  const groupList = Array.isArray(groups) ? groups : [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          Dashboard Giảng viên
        </Title>
        <Text type="secondary">
          Xin chào, <strong>{user?.full_name}</strong>! Dưới đây là các nhóm bạn đang phụ trách.
        </Text>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : groupList.length === 0 ? (
        <Empty
          description="Bạn chưa được phân công phụ trách nhóm nào"
          style={{ marginTop: 80 }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {groupList.map((group) => (
            <Col key={group.id} xs={24} sm={12} lg={8} xl={6}>
              <GroupCard group={group} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
