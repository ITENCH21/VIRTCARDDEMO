import { Routes, Route, Navigate } from 'react-router-dom';
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
import Spinner from './components/Spinner';

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Layout>
    </>
  );
}

export default App;
