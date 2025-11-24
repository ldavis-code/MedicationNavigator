import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('Error caught by ErrorBoundary:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  handleReturnHome = () => {
    // Clear the error state and navigate to home
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem'
        }}>
          <div style={{
            maxWidth: '32rem',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '2rem'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              {/* Error Icon */}
              <div style={{
                backgroundColor: '#fee2e2',
                borderRadius: '9999px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <AlertTriangle
                  size={48}
                  style={{ color: '#dc2626' }}
                />
              </div>

              {/* Error Title */}
              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '0.5rem'
              }}>
                Oops! Something went wrong
              </h1>

              {/* Error Message */}
              <p style={{
                color: '#6b7280',
                marginBottom: '1.5rem',
                lineHeight: '1.5'
              }}>
                We're sorry, but the application encountered an unexpected error.
                Don't worry - your data is safe. Please try returning to the home page.
              </p>

              {/* Return Home Button */}
              <button
                onClick={this.handleReturnHome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  fontWeight: '600',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              >
                <Home size={20} />
                Return to Home
              </button>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details style={{
                  marginTop: '2rem',
                  width: '100%',
                  textAlign: 'left'
                }}>
                  <summary style={{
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    marginBottom: '0.5rem'
                  }}>
                    Error Details (Development)
                  </summary>
                  <div style={{
                    backgroundColor: '#f3f4f6',
                    padding: '1rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    overflowX: 'auto'
                  }}>
                    <p style={{
                      fontWeight: 'bold',
                      color: '#dc2626',
                      marginBottom: '0.5rem'
                    }}>
                      {this.state.error.toString()}
                    </p>
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#374151',
                      margin: 0
                    }}>
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
