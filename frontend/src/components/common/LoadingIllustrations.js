import React from 'react';
import { cva } from 'class-variance-authority';

// Loading illustration variant styles
const loadingVariants = cva(
  'flex flex-col items-center justify-center text-center',
  {
    variants: {
      size: {
        sm: 'py-8',
        md: 'py-12',
        lg: 'py-16',
        xl: 'py-20'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
);

// Animated Loading Spinner
export const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary',
  className = '',
  ...props 
}) => {
  const sizeClasses = {
    xs: 'h-4 w-4',
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const colorClasses = {
    primary: 'text-primary-500',
    secondary: 'text-text-secondary',
    white: 'text-white',
    success: 'text-success-500',
    warning: 'text-warning-500',
    error: 'text-error-500'
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

// Pulsing Dots Loader
export const PulsingDots = ({ 
  size = 'md',
  color = 'primary',
  className = '',
  ...props 
}) => {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const colorClasses = {
    primary: 'bg-primary-500',
    secondary: 'bg-text-secondary',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    error: 'bg-error-500'
  };

  return (
    <div className={`flex space-x-2 ${className}`} {...props}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`
            ${sizeClasses[size]} 
            ${colorClasses[color]} 
            rounded-full animate-pulse
          `}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1.4s'
          }}
        />
      ))}
    </div>
  );
};

// Skeleton Loader
export const SkeletonLoader = ({ 
  lines = 3,
  className = '',
  ...props 
}) => {
  return (
    <div className={`animate-pulse space-y-3 ${className}`} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 bg-background-secondary rounded w-full" />
          {i === lines - 1 && (
            <div className="h-4 bg-background-secondary rounded w-3/4" />
          )}
        </div>
      ))}
    </div>
  );
};

// Card Skeleton
export const CardSkeleton = ({ className = '', ...props }) => {
  return (
    <div className={`bg-surface border border-default rounded-card p-6 animate-pulse ${className}`} {...props}>
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 bg-background-secondary rounded w-32" />
        <div className="h-4 w-4 bg-background-secondary rounded" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-background-secondary rounded w-full" />
        <div className="h-4 bg-background-secondary rounded w-3/4" />
      </div>
      <div className="flex justify-between">
        <div className="h-8 bg-background-secondary rounded w-20" />
        <div className="h-8 bg-background-secondary rounded w-16" />
      </div>
    </div>
  );
};

// Data Loading Illustration
export const DataLoadingIllustration = ({ 
  size = 'md',
  title = 'Loading data...',
  description = 'Please wait while we fetch your information.',
  className = '',
  ...props 
}) => {
  return (
    <div className={loadingVariants({ size, className })} {...props}>
      {/* Animated Data Visualization */}
      <div className="mb-6">
        <svg
          className="h-24 w-24 text-primary-500 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <g className="animate-pulse">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </g>
          <g className="animate-pulse" style={{ animationDelay: '0.5s' }}>
            <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
          </g>
        </svg>
      </div>
      
      <h3 className="text-lg font-medium text-primary mb-2">{title}</h3>
      <p className="text-secondary max-w-sm">{description}</p>
      
      <div className="mt-4">
        <PulsingDots />
      </div>
    </div>
  );
};

// GitHub Data Loading
export const GitHubLoadingIllustration = ({ 
  size = 'md',
  className = '',
  ...props 
}) => {
  return (
    <div className={loadingVariants({ size, className })} {...props}>
      <div className="mb-6">
        <svg
          className="h-24 w-24 text-primary-500 mx-auto"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <g className="animate-pulse">
            <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </g>
        </svg>
      </div>
      
      <h3 className="text-lg font-medium text-primary mb-2">Analyzing GitHub Activity</h3>
      <p className="text-secondary max-w-sm">
        Fetching commits, pull requests, and repository data...
      </p>
      
      <div className="mt-4">
        <LoadingSpinner size="sm" />
      </div>
    </div>
  );
};

// MetaMask Connection Loading
export const MetaMaskLoadingIllustration = ({ 
  size = 'md',
  className = '',
  ...props 
}) => {
  return (
    <div className={loadingVariants({ size, className })} {...props}>
      <div className="mb-6">
        <div className="relative">
          <svg
            className="h-24 w-24 text-warning-500 mx-auto animate-pulse"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22.56 8.25L13.5 1.5L11.25 4.5L18.75 9.75L22.56 8.25ZM1.44 8.25L10.5 1.5L12.75 4.5L5.25 9.75L1.44 8.25ZM19.5 10.5L22.5 12L19.5 13.5V15.75L12 19.5L4.5 15.75V13.5L1.5 12L4.5 10.5V8.25L12 4.5L19.5 8.25V10.5Z" />
          </svg>
          
          {/* Connection Animation */}
          <div className="absolute -inset-4 border-2 border-primary-500 rounded-full animate-ping opacity-20" />
          <div className="absolute -inset-2 border-2 border-primary-500 rounded-full animate-ping opacity-40" style={{ animationDelay: '0.5s' }} />
        </div>
      </div>
      
      <h3 className="text-lg font-medium text-primary mb-2">Connecting to MetaMask</h3>
      <p className="text-secondary max-w-sm">
        Please check your MetaMask extension and approve the connection request.
      </p>
      
      <div className="mt-4">
        <PulsingDots color="warning" />
      </div>
    </div>
  );
};

// Generic Loading State
export const LoadingState = ({ 
  type = 'default',
  size = 'md',
  title,
  description,
  className = '',
  ...props 
}) => {
  const loadingComponents = {
    default: DataLoadingIllustration,
    github: GitHubLoadingIllustration,
    metamask: MetaMaskLoadingIllustration
  };

  const LoadingComponent = loadingComponents[type] || DataLoadingIllustration;

  return (
    <LoadingComponent
      size={size}
      title={title}
      description={description}
      className={className}
      {...props}
    />
  );
};

export default LoadingState;
