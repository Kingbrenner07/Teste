import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { ThemeProvider } from '@/components/theme-provider';
import { AppLayout } from '@/components/layout/app-layout';

// Pages
import Dashboard from '@/pages/dashboard';
import Agenda from '@/pages/agenda';
import NovoAgendamento from '@/pages/novo-agendamento';
import DiasDisponiveis from '@/pages/dias-disponiveis';
import WhatsAppBot from '@/pages/whatsapp';

const queryClient = new QueryClient();

function Router() {
  return (
    // AppLayout contains the sidebar and wraps the main content area
    <AppLayout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/agenda" component={Agenda} />
          <Route path="/novo-agendamento" component={NovoAgendamento} />
          <Route path="/dias-disponiveis" component={DiasDisponiveis} />
          <Route path="/whatsapp" component={WhatsAppBot} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppLayout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="estetica-auto-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
