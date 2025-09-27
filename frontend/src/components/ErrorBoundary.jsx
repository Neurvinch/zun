import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service here
    this.setState({ errorInfo });
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto', color: '#fff' }}>
          <h2>Something went wrong.</h2>
          <p>
            An unexpected error occurred while rendering this section. Try switching tabs or
            reloading the page. If the issue persists, please check the console for details.
          </p>
          {import.meta.env.DEV && (
            <pre style={{ whiteSpace: 'pre-wrap', background: '#1f2937', padding: '1rem', borderRadius: 8 }}>
              {this.state.error?.toString()}
              {'\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

