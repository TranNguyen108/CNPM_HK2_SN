import { Card, Typography, Row, Col, Statistic, Spin } from 'antd';
import { TeamOutlined, UserOutlined, UsergroupAddOutlined, SolutionOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { adminApi } from '../api/adminApi';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then((r) => r.data),
    enabled: user?.role === 'ADMIN',
  });

  return (
    <div>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Card style={{ marginBottom: 24 }}>
        <Typography.Text>
          Xin chào, <strong>{user?.full_name}</strong>! Vai trò: <strong>{user?.role}</strong>
        </Typography.Text>
      </Card>

      {user?.role === 'ADMIN' && (
        isLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng số nhóm"
                  value={stats?.totalGroups || 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Giảng viên"
                  value={stats?.totalLecturers || 0}
                  prefix={<SolutionOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Thành viên nhóm"
                  value={stats?.totalMembers || 0}
                  prefix={<UsergroupAddOutlined />}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng người dùng"
                  value={stats?.totalUsers || 0}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>
        )
      )}
    </div>
  );
}
