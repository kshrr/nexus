import { Routes, Route } from 'react-router-dom';

import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppShell } from '@/components/layout/AppShell';
import { AdminShell } from '@/components/layout/AdminShell';
import {
  ProtectedRoute,
  PublicOnlyRoute,
  ProfileGate,
  AdminRoute,
} from '@/components/routing/guards';

import Landing from '@/pages/public/Landing';
import Login from '@/pages/public/Login';
import Register from '@/pages/public/Register';
import Verify from '@/pages/public/Verify';
import ResetPassword from '@/pages/public/ResetPassword';
import Privacy from '@/pages/public/Privacy';
import ScholarshipList from '@/pages/public/ScholarshipList';
import ScholarshipDetail from '@/pages/public/ScholarshipDetail';
import NotFound from '@/pages/public/NotFound';

import Dashboard from '@/pages/student/Dashboard';
import ProfileSetup from '@/pages/student/ProfileSetup';
import Profile from '@/pages/student/Profile';
import FindYourPath from '@/pages/student/FindYourPath';
import RiasecAssessment from '@/pages/student/RiasecAssessment';
import RiasecResults from '@/pages/student/RiasecResults';
import AcademicAnalysis from '@/pages/student/AcademicAnalysis';
import Recommendations from '@/pages/student/Recommendations';
import SavedItems from '@/pages/student/SavedItems';
import Careers from '@/pages/student/Careers';
import CareerDetail from '@/pages/student/CareerDetail';
import CourseDetail from '@/pages/student/CourseDetail';

import AdminHome from '@/pages/admin/AdminHome';
import AdminScholarships from '@/pages/admin/AdminScholarships';
import AdminScholarshipDiscovery from '@/pages/admin/AdminScholarshipDiscovery';
import AdminCrawler from '@/pages/admin/AdminCrawler';
import AdminManualUpdates from '@/pages/admin/AdminManualUpdates';
import AdminDataManagement from '@/pages/admin/AdminDataManagement';
import AdminAudit from '@/pages/admin/AdminAudit';

/**
 * Route table (architecture.md §6.1, ui-spec §1.1).
 *
 * Guards are UX only — every route is also protected by RLS in the database.
 * Feature routes that belong to later phases render <Placeholder>, so navigation
 * is complete and honest without faking functionality.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* ---------- Public + auth ---------- */}
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="scholarships" element={<ScholarshipList />} />
        <Route path="scholarships/:id" element={<ScholarshipDetail />} />

        <Route
          path="login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="register"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />
        <Route path="verify" element={<Verify />} />
        <Route path="reset-password" element={<ResetPassword />} />
      </Route>

      {/* ---------- Student (session required) ---------- */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Pre-profile: session only, no ProfileGate */}
        <Route path="profile-setup" element={<ProfileSetup />} />

        {/* Profiled area — each wrapped in <ProfileGate> */}
        <Route
          path="dashboard"
          element={
            <ProfileGate>
              <Dashboard />
            </ProfileGate>
          }
        />
        <Route
          path="find-your-path"
          element={
            <ProfileGate>
              <FindYourPath />
            </ProfileGate>
          }
        />
        <Route
          path="find-your-path/assessment"
          element={
            <ProfileGate>
              <RiasecAssessment />
            </ProfileGate>
          }
        />
        <Route
          path="find-your-path/results"
          element={
            <ProfileGate>
              <RiasecResults />
            </ProfileGate>
          }
        />
        <Route
          path="find-your-path/academic"
          element={
            <ProfileGate>
              <AcademicAnalysis />
            </ProfileGate>
          }
        />
        <Route
          path="recommendations"
          element={
            <ProfileGate>
              <Recommendations />
            </ProfileGate>
          }
        />
        <Route
          path="careers"
          element={
            <ProfileGate>
              <Careers />
            </ProfileGate>
          }
        />
        <Route
          path="careers/:id"
          element={
            <ProfileGate>
              <CareerDetail />
            </ProfileGate>
          }
        />
        <Route
          path="courses/:id"
          element={
            <ProfileGate>
              <CourseDetail />
            </ProfileGate>
          }
        />
        <Route
          path="saved"
          element={
            <ProfileGate>
              <SavedItems />
            </ProfileGate>
          }
        />
        <Route
          path="profile"
          element={
            <ProfileGate>
              <Profile />
            </ProfileGate>
          }
        />
      </Route>

      {/* ---------- Admin (role = admin) ---------- */}
      <Route
        element={
          <AdminRoute>
            <AdminShell />
          </AdminRoute>
        }
      >
        <Route path="admin" element={<AdminHome />} />
        <Route path="admin/scholarships" element={<AdminScholarships />} />
        <Route path="admin/scholarship-discovery" element={<AdminScholarshipDiscovery />} />
        <Route path="admin/courses" element={<AdminDataManagement />} />
        <Route path="admin/crawler" element={<AdminCrawler />} />
        <Route path="admin/updates" element={<AdminManualUpdates />} />
        <Route path="admin/audit" element={<AdminAudit />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRoutes;
