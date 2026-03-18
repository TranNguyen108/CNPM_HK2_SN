import { Card, Typography } from 'antd';
import { useAuth } from '../auth/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <Typography.Title level={3}>Dashboard</Typography.Title>
      <Card>
        <Typography.Text>
          Xin chào, <strong>{user?.full_name}</strong>! Vai trò: <strong>{user?.role}</strong>
        </Typography.Text>
      </Card>
    </div>
  );
}
