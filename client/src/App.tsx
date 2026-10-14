import React from 'react';
import { FloodProvider } from './features/flood/store';
import { Home } from './pages/Home';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <FloodProvider>
        <Home />
      </FloodProvider>
    </ErrorBoundary>
  );
};

export default App;
