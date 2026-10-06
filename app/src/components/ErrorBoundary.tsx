import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Component error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '1rem',
          background: '#fee',
          border: '1px solid #c00',
          borderRadius: 8,
          textAlign: 'center',
          color: '#900',
        }}>
          Something went wrong
        </div>
      );
    }
    return this.props.children;
  }
}
