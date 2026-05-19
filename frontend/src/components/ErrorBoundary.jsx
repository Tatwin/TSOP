import React from 'react';

/**
 * Error Boundary Component
 * Catches rendering errors and shows a fallback UI
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px 24px',
          textAlign: 'center',
          background: '#FEE2E2',
          borderRadius: 12,
          border: '2px solid #D92426',
          margin: 20
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: '#D92426', fontSize: '1.1rem', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#7F1D1D', fontSize: '0.85rem', marginBottom: 16 }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              background: '#D92426',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
          {this.state.errorInfo && (
            <details style={{ marginTop: 16, textAlign: 'left', fontSize: '0.75rem', color: '#7F1D1D' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error Details</summary>
              <pre style={{ marginTop: 8, padding: 12, background: '#FFF5F5', borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Empty State Component - reusable
 */
export function EmptyState({ icon, title, description, action, actionLabel }) {
  return (
    <div style={{
      padding: '60px 24px',
      textAlign: 'center',
      background: 'var(--bg-card)',
      borderRadius: 12,
      border: '1px solid var(--border)'
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 16, opacity: 0.5 }}>{icon || '📭'}</div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: 8 }}>
        {title || 'No Data'}
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: action ? 20 : 0, maxWidth: 400, margin: '0 auto' }}>
        {description || 'No data available yet'}
      </p>
      {action && (
        <button className="btn-primary" onClick={action} style={{ marginTop: 20 }}>
          {actionLabel || 'Get Started'}
        </button>
      )}
    </div>
  );
}

/**
 * Loading Skeleton Component
 */
export function Skeleton({ width, height, count = 1, style = {} }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: width || '100%',
            height: height || 20,
            borderRadius: 6,
            background: 'linear-gradient(90deg, #F4F6F4 25%, #E8ECE8 50%, #F4F6F4 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            marginBottom: i < count - 1 ? 8 : 0,
            ...style
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </>
  );
}

export default ErrorBoundary;
