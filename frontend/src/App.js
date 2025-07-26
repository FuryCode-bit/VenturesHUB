import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';

// --- Import Layouts ---
import PublicLayout from './layouts/PublicLayout';
import VcLayout from './layouts/VcLayout';
import EntrepreneurLayout from './layouts/EntrepreneurLayout';

// --- Import Pages ---
import MainPage from './pages/MainPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DealFlowPage from './pages/DealFlowPage';
import IncubatePage from './pages/IncubatePage';
import MyVenturesPage from './pages/MyVenturesPage';
import VcPortfolioPage from './pages/VcPortfolioPage';
import VentureDetailPage from './pages/VentureDetailPage';
import SteeringCommitteePage from './pages/SteeringCommitteePage';
import CoinExchangePage from './pages/CoinExchangePage';
import AdminPage from './pages/AdminPage';
import MarketplacePage from './pages/MarketplacePage';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00bfa5' },
    secondary: { main: '#f50057' },
    background: { default: '#1a1a1a', paper: '#242424' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
  },
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const loggedInUser = localStorage.getItem('user');
      if (loggedInUser) {
        setUser(JSON.parse(loggedInUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }} />;
  }

  const getRedirectPath = () => (user.role === 'vc' ? '/deal-flow' : '/my-ventures');

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* --- Public and Auth Routes --- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={!user ? <MainPage /> : <Navigate to={getRedirectPath()} />} />
          </Route>
          <Route path="/login" element={!user ? <LoginPage setUser={setUser} /> : <Navigate to={getRedirectPath()} />} />
          <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to={getRedirectPath()} />} />

          {/* --- Protected Routes for Venture Capitalists --- */}
          {user?.role === 'vc' && (
            <Route element={<VcLayout user={user} setUser={setUser} />}>
              <Route path="/deal-flow" element={<DealFlowPage />} />
              <Route path="/portfolio" element={<VcPortfolioPage />} />
              {/* Shared pages */}
              <Route path="/exchange" element={<CoinExchangePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/ventures/:id" element={<VentureDetailPage />} />
              <Route path="/committee/:ventureId" element={<SteeringCommitteePage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
            </Route>
          )}
          
          {/* --- Protected Routes for Entrepreneurs --- */}
          {user?.role === 'entrepreneur' && (
            <Route element={<EntrepreneurLayout user={user} setUser={setUser} />}>
              <Route path="/my-ventures" element={<MyVenturesPage />} />
              <Route path="/incubate" element={<IncubatePage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              {/* Shared pages */}
              <Route path="/exchange" element={<CoinExchangePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/ventures/:id" element={<VentureDetailPage />} />
              <Route path="/committee/:ventureId" element={<SteeringCommitteePage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
            </Route>
          )}

          {/* --- Fallback Route for Authenticated Users --- */}
          {user && <Route path="*" element={<Navigate to={getRedirectPath()} />} />}

          {/* --- Fallback Route for Unauthenticated Users --- */}
          {!user && <Route path="*" element={<Navigate to="/login" />} />}
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;