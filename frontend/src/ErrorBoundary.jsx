import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Filter out wallet extension errors that don't affect functionality
    const errorMessage = error?.message || '';
    if (errorMessage.includes('isDefaultWallet') || 
        errorMessage.includes('Cannot read properties of undefined')) {
      // Don't log these specific wallet extension errors
      this.setState({ hasError: false, error: null });
      return;
    }
    
    console.warn('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error)}</pre>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
