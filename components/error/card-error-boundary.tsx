import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Error Boundary component specifically for card operations
 * Handles error display and implements retry logic
 */
export class CardErrorBoundary extends Component<Props, State> {
  private readonly MAX_RETRIES = 3;
  
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error and notify if provided
    console.error('Card operation failed:', { error, errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = async () => {
    if (this.state.retryCount >= this.MAX_RETRIES) {
      return;
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      // If a fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.getErrorMessage(this.state.error);
      
      return (
        <div className="p-4 border rounded-md bg-red-50">
          <h3 className="text-red-800 font-medium">Operation Failed</h3>
          <p className="text-red-600 mt-1">{errorMessage}</p>
          {this.state.retryCount < this.MAX_RETRIES && (
            <button
              onClick={this.handleRetry}
              className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Retry Operation ({this.MAX_RETRIES - this.state.retryCount} attempts remaining)
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }

  private getErrorMessage(error: Error | null): string {
    if (!error) return 'An unknown error occurred';

    // Handle specific card operation errors
    switch (error.name) {
      case 'ValidationError':
        return error.message || 'Invalid card data provided. Please check your input.';
      case 'NetworkError':
        return 'Network error occurred. Please check your connection.';
      case 'NotFoundError':
        return 'Card or project not found.';
      case 'AuthorizationError':
        return 'You do not have permission to perform this operation.';
      case 'RateLimitError':
        return 'Too many operations attempted. Please try again later.';
      default:
        return error.message || 'An unexpected error occurred';
    }
  }
}
