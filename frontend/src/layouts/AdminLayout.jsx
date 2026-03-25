import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Avatar, Dropdown } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';

const { Header, Sider, Content } = Layout;

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
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/boards', icon: <AppstoreOutlined />, label: 'Boards' },
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
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={dropdownItems} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar icon={<UserOutlined />} src={user?.avatar} />
              <span>{user?.full_name}</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
