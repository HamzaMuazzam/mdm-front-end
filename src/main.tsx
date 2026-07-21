import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useAuthStore } from './store/authStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './styles/globals.css';

// Initialize auth from localStorage
useAuthStore.getState().initFromStorage();

// Mobile only (< lg): when the virtual keyboard opens, scroll the focused
// field into view so it isn't hidden behind the keyboard. No-op on desktop.
window.addEventListener('focusin', (event) => {
  if (!window.matchMedia('(max-width: 1023.98px)').matches) return;
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.matches !== 'function') return;
  if (target.matches('input, textarea, select, [contenteditable="true"]')) {
    window.setTimeout(() => {
      // Element may have been blurred/removed while the keyboard animated in
      if (document.activeElement === target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 300);
  }
});

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
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
