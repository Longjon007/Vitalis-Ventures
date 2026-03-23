import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../core/observability/report-error';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(error, {
      componentStack: errorInfo.componentStack,
      source: 'ErrorBoundary',
    });
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <h1 className="text-xl font-semibold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm text-zinc-400">
            The app hit an unexpected error. You can safely reload and continue.
          </p>
          <button
            type="button"
            className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
            onClick={this.handleReload}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
