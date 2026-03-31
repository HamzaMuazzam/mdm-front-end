import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { PublicRoute } from './components/common/PublicRoute';
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
import { DeviceMonitorDashboardPage } from './pages/DeviceMonitorDashboardPage';
import { DeviceNotificationsPage } from './pages/DeviceNotificationsPage';
import { DeviceAlertPage } from './pages/DeviceAlertPage';
import { DeviceAudioPage } from './pages/DeviceAudioPage';
import { DeviceDataPage } from './pages/DeviceDataPage';
import { DeviceTrackingPage } from './pages/DeviceTrackingPage';
import { AllDevicesMapPage } from './pages/AllDevicesMapPage';

function App() {
  return (
    <div className="min-h-screen bg-page-bg">
      <Routes>
        {/* Public routes — redirect to dashboard if already logged in */}
        <Route path={ROUTES.LOGIN} element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path={ROUTES.REGISTER} element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path={ROUTES.VERIFY_OTP} element={<PublicRoute><VerifyOtpPage /></PublicRoute>} />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

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
        <Route
          path={ROUTES.DEVICE_MONITOR}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceMonitorDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DEVICE_NOTIFICATIONS}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceNotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_ALERT}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceAlertPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_AUDIO}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceAudioPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_DATA}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceDataPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_TRACKING}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceTrackingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.ALL_DEVICES_MAP}
          element={
            <ProtectedRoute requiresSubscription>
              <AllDevicesMapPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<PublicRoute><Navigate to={ROUTES.LOGIN} replace /></PublicRoute>} />
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
