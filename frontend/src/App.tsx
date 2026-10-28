import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthPage } from '@/pages/AuthPage';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { api, CurrentUserProfile } from '@/services/api';

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const CodeLabPage = lazy(() => import('@/pages/CodeLabPage').then(m => ({ default: m.CodeLabPage })));
const GapDiscoveryPage = lazy(() => import('@/pages/GapDiscoveryPage').then(m => ({ default: m.GapDiscoveryPage })));
const IncidentAnalysisPage = lazy(() => import('@/pages/IncidentAnalysisPage').then(m => ({ default: m.IncidentAnalysisPage })));
const TestCasesPage = lazy(() => import('@/pages/TestCasesPage').then(m => ({ default: m.TestCasesPage })));
const TestScenariosPage = lazy(() => import('@/pages/TestScenariosPage').then(m => ({ default: m.TestScenariosPage })));
const ExecutionRunsPage = lazy(() => import('@/pages/ExecutionRunsPage').then(m => ({ default: m.ExecutionRunsPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AiInsightsPage = lazy(() => import('@/pages/AiInsightsPage').then(m => ({ default: m.AiInsightsPage })));
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const TeamSettingsPage = lazy(() => import('@/pages/TeamSettingsPage').then(m => ({ default: m.TeamSettingsPage })));
const PlaceholderPage = lazy(() => import('@/pages/PlaceholderPage').then(m => ({ default: m.PlaceholderPage })));

export function App() {
  const getInitialRoute = () => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has('code')) {
        return 'projects';
      }
      const hash = window.location.hash.replace(/^#\/?/, '');
      return hash || 'dashboard';
    }
    return 'dashboard';
  };

  const [currentRoute, setCurrentRoute] = useState<string>(getInitialRoute);
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('tb_demo_mode') === 'true';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('tb_auth_token'));
  });
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Validate stored session on mount
  useEffect(() => {
    async function initAuth() {
      const token = localStorage.getItem('tb_auth_token');
      if (token) {
        try {
          const profile = await api.getCurrentUser();
          setCurrentUser(profile);
          setIsAuthenticated(true);
          setIsDemoMode(false);
        } catch {
          // Token expired or invalid
          api.logout();
          setIsAuthenticated(false);
        }
      }
      setIsLoadingAuth(false);
    }
    initAuth();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      if (hash && hash !== currentRoute) {
        setCurrentRoute(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentRoute]);

  const handleRouteChange = (routeId: string) => {
    setCurrentRoute(routeId);
    if (typeof window !== 'undefined') {
      window.location.hash = routeId;
    }
  };

  const handleLoginSuccess = (user: CurrentUserProfile) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setIsDemoMode(false);
    localStorage.removeItem('tb_demo_mode');
  };

  const handleEnterDemoMode = () => {
    setIsDemoMode(true);
    setIsAuthenticated(false);
    localStorage.setItem('tb_demo_mode', 'true');
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsDemoMode(false);
    handleRouteChange('dashboard');
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-canvas-base flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono">Initializing TestBlind AI...</span>
        </div>
      </div>
    );
  }

  // If not authenticated and not in demo mode, show the Auth Gate
  if (!isAuthenticated && !isDemoMode) {
    return (
      <AuthPage
        onLoginSuccess={handleLoginSuccess}
        onEnterDemoMode={handleEnterDemoMode}
      />
    );
  }

  const renderCurrentPage = () => {
    switch (currentRoute) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleRouteChange} />;
      case 'projects':
      case 'repositories':
        return <ProjectsPage />;
      case 'code-lab':
        return <CodeLabPage />;
      case 'gap-discovery':
        return <GapDiscoveryPage />;
      case 'incidents':
        return <IncidentAnalysisPage />;
      case 'test-cases':
        return <TestCasesPage />;
      case 'test-scenarios':
        return <TestScenariosPage />;
      case 'execution-runs':
        return <ExecutionRunsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'ai-insights':
        return <AiInsightsPage />;
      case 'integrations':
        return <IntegrationsPage />;
      case 'team-settings':
        return <TeamSettingsPage currentUser={currentUser} />;
      default:
        return (
          <PlaceholderPage
            routeId={currentRoute}
            onNavigateHome={() => handleRouteChange('dashboard')}
          />
        );
    }
  };

  return (
    <AppLayout
      currentRoute={currentRoute}
      onRouteChange={handleRouteChange}
      currentUser={currentUser}
      isDemoMode={isDemoMode}
      onLogout={handleLogout}
    >
      <ErrorBoundary fallbackTitle={`Error Loading ${currentRoute}`}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20 text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">Loading module...</span>
              </div>
            </div>
          }
        >
          {renderCurrentPage()}
        </Suspense>
      </ErrorBoundary>
    </AppLayout>
  );
}

export default App;
