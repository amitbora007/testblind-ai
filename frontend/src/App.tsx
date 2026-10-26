import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

export function App() {
  const [currentRoute, setCurrentRoute] = useState('dashboard');

  return (
    <AppLayout currentRoute={currentRoute} onRouteChange={setCurrentRoute}>
      {currentRoute === 'dashboard' ? (
        <DashboardPage />
      ) : (
        <PlaceholderPage
          routeId={currentRoute}
          onNavigateHome={() => setCurrentRoute('dashboard')}
        />
      )}
    </AppLayout>
  );
}

export default App;
