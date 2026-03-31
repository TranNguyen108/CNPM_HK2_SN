import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Avatar, Dropdown, Badge, List, Space, Empty, Spin } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileWordOutlined,
  AppstoreOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notificationsApi';
import dayjs from 'dayjs';

const { Header, Sider, Content } = Layout;

const adminMenuItems = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/groups', icon: <TeamOutlined />, label: 'Nhóm' },
  { key: '/admin/lecturers', icon: <UserOutlined />, label: 'Giảng viên' },
];

const leaderMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/boards', icon: <AppstoreOutlined />, label: 'Kanban Boards' },
  { key: '/srs', icon: <FileWordOutlined />, label: 'Generate SRS' },
];

const lecturerMenuItems = [
  { key: '/lecturer/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/lecturer/groups', icon: <TeamOutlined />, label: 'Nhóm phụ trách' },
];

const memberMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'My Tasks' },
];

>>>>>>> origin/main
export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems =
    user?.role === 'ADMIN'
      ? adminMenuItems
      : user?.role === 'LEADER'
      ? leaderMenuItems
      : user?.role === 'LECTURER'
      ? lecturerMenuItems
      : memberMenuItems;

  const defaultKey =
    user?.role === 'ADMIN'
      ? '/admin/dashboard'
      : user?.role === 'LECTURER'
      ? '/lecturer/dashboard'
      : '/dashboard';
  const selectedKey =
    menuItems.find((item) => location.pathname.startsWith(item.key))?.key || defaultKey;

  const dropdownItems = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true, onClick: handleLogout },
    ],
  };

  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', 1, 8],
    queryFn: () => notificationsApi.getNotifications({ page: 1, size: 8 }).then((r) => r.data),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const unreadCount = unreadData?.unreadCount || 0;
  const notifications = notificationsData?.items || [];

  const notificationOverlay = (
    <div style={{ width: 360, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px' }}>
        <Typography.Text strong>Thông báo</Typography.Text>
        <Button
          type="link"
          size="small"
          onClick={() => markAllReadMutation.mutate()}
          loading={markAllReadMutation.isPending}
          disabled={!unreadCount}
        >
          Đánh dấu tất cả đã đọc
        </Button>
      </div>
      {notificationsLoading ? (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      ) : notifications.length ? (
        <List
          size="small"
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item
              style={{
                padding: '10px 12px',
                cursor: item.is_read ? 'default' : 'pointer',
                background: item.is_read ? '#fff' : '#f6ffed',
                alignItems: 'flex-start',
              }}
              onClick={() => {
                if (!item.is_read && !markReadMutation.isPending) {
                  markReadMutation.mutate(item.id);
                }
              }}
            >
              <div style={{ width: '100%' }}>
                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text strong={!item.is_read}>{item.title}</Typography.Text>
                  {!item.is_read && <Badge status="processing" />}
                </Space>
                <Typography.Paragraph
                  style={{ marginTop: 4, marginBottom: 6, fontSize: 12 }}
                  type="secondary"
                >
                  {item.message}
                </Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
                </Typography.Text>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <div style={{ padding: 16 }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông báo" />
        </div>
      )}
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} breakpoint="lg" onBreakpoint={(broken) => setCollapsed(broken)}>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Typography.Text strong style={{ color: '#fff', fontSize: collapsed ? 14 : 16 }}>
            {collapsed ? 'SWP' : 'SWP391'}
          </Typography.Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space size={16}>
            <Dropdown popupRender={() => notificationOverlay} trigger={['click']} placement="bottomRight">
              <Badge count={unreadCount} size="small">
                <Button type="text" icon={<BellOutlined />} />
              </Badge>
            </Dropdown>
            <Dropdown menu={dropdownItems} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} src={user?.avatar} />
                <span>{user?.full_name}</span>
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
