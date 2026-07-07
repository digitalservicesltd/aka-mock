import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/Upload';
import ReviewQuestions from './pages/ReviewQuestions';
import LibraryPage from './pages/Library';
import TestConfigPage from './pages/TestConfig';
import TestTakingPage from './pages/TestTaking';
import ResultsPage from './pages/Results';

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Hide sidebar during test-taking for distraction-free experience
  const isTestTaking = location.pathname.startsWith('/test/take');

  if (isTestTaking) {
    return <TestTakingPage />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 199,
          }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <main className={`app-main ${sidebarCollapsed ? '' : ''}`}
        style={{ marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/review" element={<ReviewQuestions />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/test/config" element={<TestConfigPage />} />
          <Route path="/test/results/:attemptId" element={<ResultsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/test/take/:testId" element={<TestTakingPage />} />
        <Route path="/*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
