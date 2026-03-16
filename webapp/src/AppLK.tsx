import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import DesktopLayout from './components/DesktopLayout';
import LKLoginPage from './pages/LKLoginPage';
import MagicLinkAuthPage from './pages/MagicLinkAuthPage';
import DashboardPage from './pages/DashboardPage';
import CardsPage from './pages/CardsPage';
import CardDetailPage from './pages/CardDetailPage';
import CardIssuePage from './pages/CardIssuePage';
import CardTopupPage from './pages/CardTopupPage';
import DepositPage from './pages/DepositPage';
import WithdrawPage from './pages/WithdrawPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import ReferralPage from './pages/ReferralPage';
import SecurityPage from './pages/SecurityPage';
import NotificationsPage from './pages/NotificationsPage';
import SupportPage from './pages/SupportPage';
import ExchangePage from './pages/ExchangePage';
import TariffsPage from './pages/TariffsPage';
import Spinner from './components/Spinner';

function AppLK() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Always allow /auth route (magic link handler)
  if (location.pathname === '/auth') {
    return (
      <Routes>
        <Route path="/auth" element={<MagicLinkAuthPage />} />
      </Routes>
    );
  }

  if (isLoading) {
    return (
      <div className="app-loading">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LKLoginPage />} />
        <Route path="*" element={<LKLoginPage />} />
      </Routes>
    );
  }

  // If authenticated and on /login, redirect to dashboard
  if (location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <div className="bg-mesh" />
      <DesktopLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/cards/issue" element={<CardIssuePage />} />
          <Route path="/cards/:id" element={<CardDetailPage />} />
          <Route path="/cards/:id/topup" element={<CardTopupPage />} />
          <Route path="/deposit" element={<DepositPage />} />
          <Route path="/withdraw" element={<WithdrawPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/referral" element={<ReferralPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/exchange" element={<ExchangePage />} />
          <Route path="/tariffs" element={<TariffsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DesktopLayout>
    </>
  );
}

export default AppLK;
