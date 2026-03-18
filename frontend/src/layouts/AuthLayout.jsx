import { Outlet } from 'react-router-dom';
import { Layout, Typography } from 'antd';

const { Content } = Layout;

export default function AuthLayout() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Content
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>
            SWP391 — Project Management
          </Typography.Title>
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}
