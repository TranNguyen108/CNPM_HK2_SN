import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import { useAuth } from './auth/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupList from './pages/groups/GroupList';
import GroupDetail from './pages/groups/GroupDetail';
import LecturerList from './pages/lecturers/LecturerList';
import KanbanBoard from './pages/leader/KanbanBoard';
import LeaderDashboard from './pages/leader/LeaderDashboard';
import LecturerDashboard from './pages/lecturer/LecturerDashboard';
import LecturerGroupDetail from './pages/lecturer/LecturerGroupDetail';
import MemberDashboard from './pages/member/MemberDashboard';

function TeamDashboardRoute() {
  const { user } = useAuth();
  return user?.role === 'LEADER' ? <LeaderDashboard /> : <MemberDashboard />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/groups" element={<GroupList />} />
            <Route path="/admin/groups/:id" element={<GroupDetail />} />
            <Route path="/admin/lecturers" element={<LecturerList />} />
            <Route path="/admin" element={<Navigate to="/admin/groups" replace />} />
          </Route>
        </Route>

        {/* Leader + Member shared routes */}
        <Route element={<ProtectedRoute allowedRoles={['LEADER', 'MEMBER']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<TeamDashboardRoute />} />
            <Route path="/boards" element={<TeamDashboardRoute />} />
            <Route path="/board/:groupId" element={<KanbanBoard />} />
          </Route>
        </Route>

        {/* Lecturer routes (read-only) */}
        <Route element={<ProtectedRoute allowedRoles={['LECTURER']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/lecturer/dashboard" element={<LecturerDashboard />} />
            <Route path="/lecturer/groups" element={<LecturerDashboard />} />
            <Route path="/lecturer/groups/:groupId" element={<LecturerGroupDetail />} />
            <Route path="/lecturer" element={<Navigate to="/lecturer/dashboard" replace />} />
          </Route>
        </Route>

        {/* Admin can also access boards */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/board/:groupId" element={<KanbanBoard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
