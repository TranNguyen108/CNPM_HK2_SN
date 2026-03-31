import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Typography,
  Card,
  Row,
  Col,
  Skeleton,
  Tag,
  Button,
  Empty,
  Space,
  Statistic,
  Alert,
} from 'antd';
import {
  TeamOutlined,
  AppstoreOutlined,
  FundOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { tasksApi } from '../../api/tasksApi';
import { useAuth } from '../../auth/AuthContext';

export default function LeaderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch my groups (for names)
  const { data: myGroupsData = [] } = useQuery({
    queryKey: ['my-groups'],
    queryFn: () => tasksApi.getMyGroups().then((r) => r.data),
    staleTime: 300_000,
  });

  const groupNameMap = useMemo(
    () => new Map(myGroupsData.map((g) => [g.id, g.name])),
    [myGroupsData]
  );

  // Fetch tasks the current user is part of — no groupId means backend returns all accessible groups' tasks
  const { data: tasksData, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-tasks-all'],
    queryFn: () => tasksApi.getMyTasks({ size: 200 }).then((r) => r.data),
  });

  // Derive unique groups from tasks
  const groups = (() => {
    if (!tasksData?.items) return [];
    const map = new Map();
    for (const t of tasksData.items) {
      if (t.group_id && !map.has(t.group_id)) {
        map.set(t.group_id, { id: t.group_id, taskCount: 0, done: 0 });
      }
      if (t.group_id) {
        const g = map.get(t.group_id);
        g.taskCount += 1;
        const s = (t.status || '').toLowerCase();
        if (['done', 'closed', 'resolved', 'complete', 'completed'].includes(s)) {
          g.done += 1;
        }
      }
    }
    return [...map.values()];
  })();

  const myTasks = tasksData?.items || [];
  const myDone = myTasks.filter((t) => {
    const s = (t.status || '').toLowerCase();
    return ['done', 'closed', 'resolved', 'complete', 'completed'].includes(s);
  }).length;
  const myInProgress = myTasks.filter((t) => {
    const s = (t.status || '').toLowerCase();
    return ['in progress', 'in-progress', 'doing', 'review', 'testing', 'qa'].includes(s);
  }).length;

  return (
    <div>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Card style={{ marginBottom: 24 }}>
        <Typography.Text>
          Xin chào, <strong>{user?.full_name}</strong>! Vai trò:{' '}
          <Tag color="blue">{user?.role}</Tag>
        </Typography.Text>
      </Card>

      {isLoading ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {[1, 2, 3].map((k) => (
              <Col key={k} xs={24} sm={8}>
                <Card><Skeleton active paragraph={{ rows: 2 }} /></Card>
              </Col>
            ))}
          </Row>
          <Skeleton active paragraph={{ rows: 6 }} />
        </>
      ) : isError ? (
        <Alert
          type="error"
          showIcon
          message="Không thể tải dữ liệu"
          description="Đã xảy ra lỗi khi kết nối server. Vui lòng thử lại."
          action={
            <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : (
        <>
          {/* Personal stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Task của tôi"
                  value={myTasks.length}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Đang làm"
                  value={myInProgress}
                  prefix={<FundOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="Đã hoàn thành"
                  value={myDone}
                  prefix={<AppstoreOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Group boards */}
          <Typography.Title level={5} style={{ marginBottom: 12 }}>
            Nhóm của bạn
          </Typography.Title>

          {groups.length === 0 ? (
            <Empty description="Chưa có nhóm nào. Hãy liên hệ Admin để được thêm vào nhóm." />
          ) : (
            <Row gutter={[16, 16]}>
              {groups.map((g) => (
                <Col key={g.id} xs={24} sm={12} lg={8}>
                  <Card
                    hoverable
                    onClick={() => navigate(`/board/${g.id}`)}
                    actions={[
                      <Button
                        key="board"
                        type="link"
                        icon={<AppstoreOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/board/${g.id}`);
                        }}
                      >
                        Mở Board
                      </Button>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Space>
                          <TeamOutlined />
                          <Typography.Text ellipsis style={{ maxWidth: 200 }}>
                            {groupNameMap.get(g.id) || `Nhóm ${g.id.slice(0, 8)}…`}
                          </Typography.Text>
                        </Space>
                      }
                      description={
                        <Space size={16} style={{ marginTop: 8 }}>
                          <Tag color="blue">{g.taskCount} tasks</Tag>
                          <Tag color="green">{g.done} done</Tag>
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      )}
    </div>
  );
}
