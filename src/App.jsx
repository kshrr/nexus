import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/feedback';
import { AppRoutes } from '@/routes';

/**
 * Application root: error boundary → router → auth context → route tree.
 * The error boundary is outermost so a crash anywhere still renders a recovery
 * screen (NFR03a).
 */
export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
