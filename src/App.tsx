import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import BottomNav from './components/common/BottomNav';
import ErrorBoundary from './components/common/ErrorBoundary';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import CapturePage from './pages/CapturePage';
import SettingsPage from './pages/SettingsPage';
import { getAll, updateQuotes } from './services/sheetsApi';
import { useAccountStore } from './stores/accountStore';
import { useAppStore } from './stores/appStore';
import { GAS_WEB_APP_URL } from './utils/constants';

export default function App() {
  const setAccounts = useAccountStore((s) => s.setAccounts);
  const { setLoading, setError } = useAppStore();

  useEffect(() => {
    if (!GAS_WEB_APP_URL) return;

    setLoading(true);
    getAll()
      .then((data) => {
        setAccounts(data.accounts);
        // 백그라운드로 현재가 업데이트 (실패해도 무시)
        if (data.holdings.length > 0) {
          updateQuotes().catch(() => {});
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setAccounts, setLoading, setError]);

  return (
    <div className="bg-dark-bg min-h-screen">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/capture" element={<ErrorBoundary><CapturePage /></ErrorBoundary>} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </ErrorBoundary>
      <BottomNav />
    </div>
  );
}
