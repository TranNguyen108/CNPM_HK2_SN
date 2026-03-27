import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback =
      user.role === 'ADMIN'
        ? '/admin/dashboard'
        : user.role === 'LECTURER'
        ? '/lecturer/dashboard'
        : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
