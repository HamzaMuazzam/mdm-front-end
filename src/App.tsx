import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { PublicRoute } from './components/common/PublicRoute';
import { Toaster } from './components/ui/toaster';
import { ROUTES } from './utils/constants';
import { PERMISSIONS as P } from './utils/permissions';

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
import { DeviceSimChangesPage } from './pages/DeviceSimChangesPage';
import { DeviceIntegrityPage } from './pages/DeviceIntegrityPage';
import { DeviceLogsPage } from './pages/DeviceLogsPage';
import { DeviceAuditPage } from './pages/DeviceAuditPage';
import { DeviceSslPinningPage } from './pages/DeviceSslPinningPage';
import { AllDevicesMapPage } from './pages/AllDevicesMapPage';
import { DeviceSosPage } from './pages/DeviceSosPage';
import { DeviceTimeRangePage } from './pages/DeviceTimeRangePage';

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
            <ProtectedRoute requiresSubscription requiresPermission={P.DEVICES_APPLICATIONS_READ}>
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
            <ProtectedRoute requiresSubscription requiresPermission={P.SCREEN_MONITORING_ACCESS}>
              <DeviceMonitorDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DEVICE_NOTIFICATIONS}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.NOTIFICATIONS_VIEW_HISTORY}>
              <DeviceNotificationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_ALERT}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={[P.DEVICE_ALERT_SEND, P.DEVICE_ALERT_READ]}>
              <DeviceAlertPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_AUDIO}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.DEVICE_AUDIO_LISTEN}>
              <DeviceAudioPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_DATA}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={[P.DEVICE_DATA_READ, P.CONTACTS_READ, P.SMS_READ, P.CALL_LOGS_READ]}>
              <DeviceDataPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_TRACKING}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.TRACKING_HISTORY}>
              <DeviceTrackingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_SIM_CHANGES}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.SIM_CHANGE_READ}>
              <DeviceSimChangesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_INTEGRITY}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.DEVICE_INTEGRITY_READ}>
              <DeviceIntegrityPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_LOGS}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.DEVICE_LOGS_READ}>
              <DeviceLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.DEVICE_AUDIT}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.AUDIT_LOGS_READ}>
              <DeviceAuditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_SSL_PINNING}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.CONFIGURATION_UPDATE}>
              <DeviceSslPinningPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_SOS}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.TRACKING_HISTORY}>
              <DeviceSosPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.ALL_DEVICES_MAP}
          element={
            <ProtectedRoute requiresSubscription requiresPermission={P.TRACKING_HISTORY}>
              <AllDevicesMapPage />
            </ProtectedRoute>
          }
        />

        <Route
          path={ROUTES.DEVICE_TIME_RANGE}
          element={
            <ProtectedRoute requiresSubscription>
              <DeviceTimeRangePage />
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
