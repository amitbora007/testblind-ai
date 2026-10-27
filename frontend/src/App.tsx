import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthPage } from '@/pages/AuthPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { RepositoriesPage } from '@/pages/RepositoriesPage';
import { CodeLabPage } from '@/pages/CodeLabPage';
import { GapDiscoveryPage } from '@/pages/GapDiscoveryPage';
import { IncidentAnalysisPage } from '@/pages/IncidentAnalysisPage';
import { TestCasesPage } from '@/pages/TestCasesPage';
import { TestScenariosPage } from '@/pages/TestScenariosPage';
import { ExecutionRunsPage } from '@/pages/ExecutionRunsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AiInsightsPage } from '@/pages/AiInsightsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { TeamSettingsPage } from '@/pages/TeamSettingsPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { api, CurrentUserProfile } from '@/services/api';

export function App() {
  const getInitialRoute = () => {
    if (typeof window !== 'undefined') {
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
        return <DashboardPage />;
      case 'projects':
        return <ProjectsPage />;
      case 'repositories':
        return <RepositoriesPage />;
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
        return <TeamSettingsPage />;
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
      {renderCurrentPage()}
    </AppLayout>
  );
}

export default App;
