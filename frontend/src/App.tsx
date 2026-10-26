import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
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

export function App() {
  const getInitialRoute = () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace(/^#\/?/, '');
      return hash || 'dashboard';
    }
    return 'dashboard';
  };

  const [currentRoute, setCurrentRoute] = useState<string>(getInitialRoute);

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
    <AppLayout currentRoute={currentRoute} onRouteChange={handleRouteChange}>
      {renderCurrentPage()}
    </AppLayout>
  );
}

export default App;
