import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Avatar, Dropdown, Badge, Popover, List, Space, Empty } from 'antd';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  TeamOutlined,
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../auth/AuthContext';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Header, Sider, Content } = Layout;

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lastSeenTs, setLastSeenTs] = useState(() =>
    parseInt(localStorage.getItem('swp_notif_seen') || '0', 10)
  );

  const { data: groups = [] } = useQuery({
    queryKey: ['notif-my-groups'],
    queryFn: () => axiosClient.get('/my-groups').then((r) => r.data),
    staleTime: 300_000,
    retry: false,
  });

  // Poll sync logs for up to 5 groups every 30 s
  const logResults = useQueries({
    queries: groups.slice(0, 5).map((g) => ({
      queryKey: ['notif-sync-logs', g.id],
      queryFn: () => axiosClient.get(`/sync/logs/${g.id}`).then((r) => r.data || []),
      refetchInterval: 30_000,
      staleTime: 25_000,
      retry: false,
    })),
  });

  const notifications = useMemo(() => {
    const logs = logResults.flatMap((r, i) =>
      (r.data || []).map((l) => ({ ...l, groupName: groups[i]?.name || `Nhóm ${i + 1}` }))
    );
    return logs
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
  }, [logResults, groups]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => new Date(n.created_at).getTime() > lastSeenTs).length,
    [notifications, lastSeenTs]
  );

  const markAllRead = () => {
    const ts = Date.now();
    localStorage.setItem('swp_notif_seen', String(ts));
    setLastSeenTs(ts);
  };

  const getNotifMeta = (log) => {
    const typeLabel = log.sync_type === 'github' ? 'GitHub' : 'Jira';
    if (log.status === 'success') {
      return {
        icon: <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />,
        text: `Sync ${typeLabel} thành công — +${log.new_count || 0} mới, ${log.updated_count || 0} cập nhật`,
      };
    }
    return {
      icon: <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />,
      text: `Sync ${typeLabel} thất bại: ${log.error_message || 'Lỗi không xác định'}`,
    };
  };

  const notifContent = (
    <div style={{ width: 360 }}>
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography.Text strong>Thông báo</Typography.Text>
        <Button type="link" size="small" onClick={markAllRead} disabled={unreadCount === 0}>
          Đánh dấu tất cả đã đọc
        </Button>
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không có thông báo nào"
            style={{ margin: '32px 0' }}
          />
        ) : (
          <List
            dataSource={notifications}
            size="small"
            split={false}
            renderItem={(notif) => {
              const isUnread = new Date(notif.created_at).getTime() > lastSeenTs;
              const meta = getNotifMeta(notif);
              return (
                <List.Item
                  style={{
                    padding: '10px 16px',
                    background: isUnread ? '#e6f4ff' : 'transparent',
                    borderBottom: '1px solid #f5f5f5',
                    alignItems: 'flex-start',
                  }}
                >
                  <List.Item.Meta
                    avatar={meta.icon}
                    title={
                      <Typography.Text
                        style={{ fontSize: 12, fontWeight: isUnread ? 600 : 400 }}
                      >
                        {meta.text}
                      </Typography.Text>
                    }
                    description={
                      <Space size={4}>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {notif.groupName}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          ·
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {dayjs(notif.created_at).fromNow()}
                        </Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      content={notifContent}
      trigger="click"
      placement="bottomRight"
      overlayInnerStyle={{ padding: 0, borderRadius: 8 }}
      arrow={false}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 16 }} />} />
      </Badge>
    </Popover>
  );
}

const adminMenuItems = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/groups', icon: <TeamOutlined />, label: 'Nhóm' },
  { key: '/admin/lecturers', icon: <UserOutlined />, label: 'Giảng viên' },
];

const leaderMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/boards', icon: <AppstoreOutlined />, label: 'Kanban Boards' },
];

const lecturerMenuItems = [
  { key: '/lecturer/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/lecturer/groups', icon: <TeamOutlined />, label: 'Nhóm phụ trách' },
];

const memberMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'My Tasks' },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

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
        <Header style={{ padding: '0 16px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', position: 'sticky', top: 0, zIndex: 10 }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space align="center" size={4}>
            <NotificationBell />
            <Dropdown menu={dropdownItems} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 8 }}>
                <Avatar icon={<UserOutlined />} src={user?.avatar} size={32} />
                <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>
                  {user?.full_name}
                </span>
              </div>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '16px 16px 0', padding: '20px 20px', background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
