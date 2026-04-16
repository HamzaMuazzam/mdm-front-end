import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { BrandingProvider } from './components/branding/BrandingProvider';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/globals.css';

// Initialize auth from localStorage
useAuthStore.getState().initFromStorage();

// Create React Query client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary moduleName="Application">
      <QueryClientProvider client={queryClient}>
        <BrandingProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <App />
          </BrowserRouter>
        </BrandingProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
