import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
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

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app-loading">
        <Spinner />
      </div>
    );
  }

  // Show login page for /login route or when not authenticated
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LoginPage />} />
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
      <Layout>
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
      </Layout>
    </>
  );
}

export default App;
