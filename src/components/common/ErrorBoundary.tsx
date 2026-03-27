import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="px-4 py-8 text-center">
          <p className="text-red-400 font-medium text-sm mb-2">
            오류가 발생했습니다
          </p>
          <p className="text-dark-text-muted text-xs mb-4">
            {this.state.error}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
