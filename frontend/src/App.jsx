import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GroupList from './pages/groups/GroupList';
import GroupDetail from './pages/groups/GroupDetail';
import LecturerList from './pages/lecturers/LecturerList';
import GenerateSRS from './pages/leader/GenerateSRS';

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

        {/* General protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/srs" element={<GenerateSRS />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
