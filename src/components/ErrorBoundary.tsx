import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled exception:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = 'dashboard';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <GlassCard className="max-w-md p-8 border-red-500/10 shadow-red-500/5 space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mx-auto text-red-400">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100">Portal Rendering Mismatch</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected exception occurred while rendering this interface node. This can happen due to minor data sync mismatches.
              </p>
              {this.state.error && (
                <div className="p-2.5 bg-slate-950/40 border border-slate-850 rounded-lg text-left mt-2">
                  <p className="text-[9px] font-mono text-rose-400 break-all leading-normal font-semibold">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-brand-500/10"
              >
                <RefreshCw size={13} />
                Reset & Retry
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = 'dashboard';
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-350 rounded-xl text-xs flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Home size={13} />
                Overview
              </button>
            </div>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}
