import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { Toaster } from './components/ui/toaster';
import { ROUTES } from './utils/constants';

// Lazy load pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { SubscriptionPlansPage } from './pages/SubscriptionPlansPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeviceApplicationsPage } from './pages/DeviceApplicationsPage';
import { DeviceRequestsPage } from './pages/DeviceRequestsPage';

function App() {
  return (
    <div className="min-h-screen bg-page-bg">
      <Routes>
        {/* Public routes */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />

        {/* Protected routes */}
        <Route
          path={ROUTES.SUBSCRIPTIONS}
          element={
            <ProtectedRoute>
              <SubscriptionPlansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DASHBOARD}
          element={
            <ProtectedRoute requiresSubscription>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DEVICE_APPLICATIONS}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DEVICE_REQUESTS}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceRequestsPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
