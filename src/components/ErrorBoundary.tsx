import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-[#121212] text-white">
          <h1 className="text-3xl font-bold mb-4">Oops, something went wrong.</h1>
          <p className="text-[#b3b3b3] mb-8">The application encountered an unexpected error.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition"
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
