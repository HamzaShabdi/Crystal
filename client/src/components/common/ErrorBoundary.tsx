import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in FloodOne:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-bg text-paper flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface border border-urgent/40 p-6 rounded-xl shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-urgent/15 border border-urgent/30 flex items-center justify-center mx-auto text-urgent">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-heading font-bold text-lg text-paper">
              Application Error Encountered
            </h2>
            <p className="text-xs text-muted leading-relaxed">
              FloodOne encountered an unexpected rendering failure. Your local data remains safe in browser memory.
            </p>
            {this.state.error && (
              <pre className="text-[11px] font-mono bg-surface-2 p-3 rounded border border-border text-urgent/90 text-left overflow-x-auto">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-signal text-bg font-bold rounded-lg hover:bg-signal/90 text-xs transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
