import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error('Uncaught error in UI component tree:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 my-6 rounded-xl bg-card border border-rose-500/30 text-center space-y-4 max-w-2xl mx-auto shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              {this.props.fallbackTitle || 'Component Rendering Error'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              An unexpected client-side error occurred while rendering this module. You can reload the module or return to the dashboard.
            </p>
          </div>
          {this.state.error?.message && (
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-left font-mono text-[11px] text-rose-300 overflow-x-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.hash = 'dashboard';
                this.handleReset();
              }}
            >
              Return to Dashboard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={this.handleReset}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry Module
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
