import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initErrorLogger } from './utils/errorLogger';
import './main.css';

// Initialize error logging (connects to Sentry in production if DSN is configured)
initErrorLogger();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
