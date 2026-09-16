import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-50 text-red-600 p-6 rounded-full mb-6">
            <AlertCircle className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-500 mb-8 max-w-sm">
            We've encountered an unexpected error. Please refresh the page or try again later.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-slate-900 text-white font-semibold py-3 px-8 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
