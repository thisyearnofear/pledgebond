import React from 'react';
import { cva } from 'class-variance-authority';
import Button from './Button';

// Error state variant styles
const errorStateVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'py-8 px-4',
        md: 'py-12 px-6',
        lg: 'py-16 px-8',
        xl: 'py-20 px-10'
      },
      severity: {
        error: 'text-error-600',
        warning: 'text-warning-600',
        info: 'text-primary-600'
      }
    },
    defaultVariants: {
      size: 'md',
      severity: 'error'
    }
  }
);

// Base Error State Component
export const ErrorState = ({ 
  size = 'md',
  severity = 'error',
  icon,
  title,
  description,
  error,
  primaryAction,
  secondaryAction,
  showDetails = false,
  className = '',
  ...props 
}) => {
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);

  return (
    <div className={errorStateVariants({ size, className })} {...props}>
      {icon && (
        <div className="mb-6">
          {icon}
        </div>
      )}
      
      {title && (
        <h3 className={`text-lg font-medium mb-2 ${
          severity === 'error' ? 'text-error-600' : 
          severity === 'warning' ? 'text-warning-600' : 
          'text-primary-600'
        }`}>
          {title}
        </h3>
      )}
      
      {description && (
        <p className="text-secondary max-w-sm mb-6">{description}</p>
      )}
      
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
      
      {error && showDetails && (
        <div className="mt-4">
          <button
            onClick={() => setShowErrorDetails(!showErrorDetails)}
            className="text-sm text-secondary hover:text-primary transition-colors underline"
          >
            {showErrorDetails ? 'Hide' : 'Show'} Error Details
          </button>
          
          {showErrorDetails && (
            <div className="mt-3 p-4 bg-error-50 border border-error-200 rounded-md text-left max-w-md">
              <pre className="text-xs text-error-700 whitespace-pre-wrap font-mono">
                {typeof error === 'string' ? error : JSON.stringify(error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Network Connection Error
export const NetworkErrorState = ({ 
  size = 'md',
  onRetry,
  className = '',
  ...props 
}) => {
  const icon = (
    <svg
      className="h-24 w-24 text-error-400 mx-auto"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M18.364 5.636l-12.728 12.728M5.636 5.636l12.728 12.728"
      />
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={1} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01"
        opacity="0.5"
      />
    </svg>
  );

  return (
    <ErrorState
      size={size}
      icon={icon}
      title="Connection Failed"
      description="Unable to connect to the server. Please check your internet connection and try again."
      primaryAction={
        onRetry && (
          <Button onClick={onRetry} variant="primary">
            Try Again
          </Button>
        )
      }
      secondaryAction={
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      }
      className={className}
      {...props}
    />
  );
};

// API Error State
export const APIErrorState = ({ 
  size = 'md',
  error,
  onRetry,
  onGoBack,
  className = '',
  ...props 
}) => {
  const icon = (
    <svg
      className="h-24 w-24 text-error-400 mx-auto"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );

  return (
    <ErrorState
      size={size}
      icon={icon}
      title="Something Went Wrong"
      description="We encountered an error while processing your request. Our team has been notified."
      error={error}
      showDetails={true}
      primaryAction={
        onRetry && (
          <Button onClick={onRetry} variant="primary">
            Try Again
          </Button>
        )
      }
      secondaryAction={
        onGoBack && (
          <Button onClick={onGoBack} variant="ghost">
            Go Back
          </Button>
        )
      }
      className={className}
      {...props}
    />
  );
};

// GitHub API Error
export const GitHubErrorState = ({ 
  size = 'md',
  error,
  onRetry,
  onReconnect,
  className = '',
  ...props 
}) => {
  const icon = (
    <div className="relative">
      <svg
        className="h-24 w-24 text-error-400 mx-auto"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
      <div className="absolute -top-1 -right-1 h-6 w-6 bg-error-500 rounded-full flex items-center justify-center">
        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    </div>
  );

  return (
    <ErrorState
      size={size}
      icon={icon}
      title="GitHub Connection Error"
      description="Unable to fetch data from GitHub. This might be due to rate limiting or authentication issues."
      error={error}
      showDetails={true}
      primaryAction={
        onRetry && (
          <Button onClick={onRetry} variant="primary">
            Retry
          </Button>
        )
      }
      secondaryAction={
        onReconnect && (
          <Button onClick={onReconnect} variant="outline">
            Reconnect GitHub
          </Button>
        )
      }
      className={className}
      {...props}
    />
  );
};

// MetaMask Connection Error
export const MetaMaskErrorState = ({ 
  size = 'md',
  error,
  onRetry,
  onInstallMetaMask,
  className = '',
  ...props 
}) => {
  const isMetaMaskNotInstalled = error?.message?.includes('MetaMask') || error?.code === -32002;

  const icon = (
    <div className="relative">
      <svg
        className="h-24 w-24 text-error-400 mx-auto"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M22.56 8.25L13.5 1.5L11.25 4.5L18.75 9.75L22.56 8.25ZM1.44 8.25L10.5 1.5L12.75 4.5L5.25 9.75L1.44 8.25ZM19.5 10.5L22.5 12L19.5 13.5V15.75L12 19.5L4.5 15.75V13.5L1.5 12L4.5 10.5V8.25L12 4.5L19.5 8.25V10.5Z" />
      </svg>
      <div className="absolute -top-1 -right-1 h-6 w-6 bg-error-500 rounded-full flex items-center justify-center">
        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
        </svg>
      </div>
    </div>
  );

  return (
    <ErrorState
      size={size}
      icon={icon}
      title={isMetaMaskNotInstalled ? "MetaMask Not Found" : "MetaMask Connection Failed"}
      description={
        isMetaMaskNotInstalled 
          ? "MetaMask extension is not installed or not enabled. Please install MetaMask to continue."
          : "Unable to connect to MetaMask. Please make sure MetaMask is unlocked and try again."
      }
      error={error}
      showDetails={!isMetaMaskNotInstalled}
      primaryAction={
        isMetaMaskNotInstalled ? (
          onInstallMetaMask && (
            <Button onClick={onInstallMetaMask} variant="primary">
              Install MetaMask
            </Button>
          )
        ) : (
          onRetry && (
            <Button onClick={onRetry} variant="primary">
              Try Again
            </Button>
          )
        )
      }
      secondaryAction={
        !isMetaMaskNotInstalled && (
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        )
      }
      className={className}
      {...props}
    />
  );
};

// Permission Denied Error
export const PermissionErrorState = ({ 
  size = 'md',
  onGoBack,
  onLogin,
  className = '',
  ...props 
}) => {
  const icon = (
    <svg
      className="h-24 w-24 text-error-400 mx-auto"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  );

  return (
    <ErrorState
      size={size}
      icon={icon}
      title="Access Denied"
      description="You don't have permission to access this resource. Please sign in or contact an administrator."
      primaryAction={
        onLogin && (
          <Button onClick={onLogin} variant="primary">
            Sign In
          </Button>
        )
      }
      secondaryAction={
        onGoBack && (
          <Button onClick={onGoBack} variant="ghost">
            Go Back
          </Button>
        )
      }
      className={className}
      {...props}
    />
  );
};

// Page Not Found Error
export const NotFoundErrorState = ({ 
  size = 'md',
  onGoHome,
  onGoBack,
  className = '',
  ...props 
}) => {
  const icon = (
    <svg
      className="h-24 w-24 text-error-400 mx-auto"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <text x="12" y="12" textAnchor="middle" className="text-2xl font-bold fill-current">404</text>
    </svg>
  );

  return (
    <ErrorState
      size={size}
      severity="info"
      icon={icon}
      title="Page Not Found"
      description="The page you're looking for doesn't exist or has been moved. Let's get you back on track."
      primaryAction={
        onGoHome && (
          <Button onClick={onGoHome} variant="primary">
            Go Home
          </Button>
        )
      }
      secondaryAction={
        onGoBack && (
          <Button onClick={onGoBack} variant="ghost">
            Go Back
          </Button>
        )
      }
      className={className}
      {...props}
    />
  );
};

// Generic Error Boundary Fallback
export const ErrorBoundaryFallback = ({ 
  error,
  resetError,
  size = 'md',
  className = '',
  ...props 
}) => {
  const icon = (
    <svg
      className="h-24 w-24 text-error-400 mx-auto"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  return (
    <ErrorState
      size={size}
      icon={icon}
      title="Oops! Something went wrong"
      description="An unexpected error occurred. Don't worry, our team has been notified and we're working on a fix."
      error={error}
      showDetails={process.env.NODE_ENV === 'development'}
      primaryAction={
        resetError && (
          <Button onClick={resetError} variant="primary">
            Try Again
          </Button>
        )
      }
      secondaryAction={
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      }
      className={className}
      {...props}
    />
  );
};

export default ErrorState;
