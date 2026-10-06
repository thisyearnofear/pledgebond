/**
 * Illustration System
 * Comprehensive visual system for POS Dashboard
 */

import React from 'react';

// Icon System
export { 
  default as Icon,
  CustomIcons,
  IconWithCustom,
  NetworkIcon,
  StatusIcon,
  IconButtonWithIcon
} from '../Icon';

// Loading States
export {
  LoadingSpinner,
  PulsingDots,
  SkeletonLoader,
  CardSkeleton,
  DataLoadingIllustration,
  GitHubLoadingIllustration,
  MetaMaskLoadingIllustration,
  LoadingState
} from '../LoadingIllustrations';

// Empty States
export {
  default as EmptyState,
  NoProjectsEmptyState,
  NoGitHubDataEmptyState,
  NoCreditDataEmptyState,
  NoWalletEmptyState,
  NoSearchResultsEmptyState,
  NoNotificationsEmptyState,
  NoFundingHistoryEmptyState,
  CustomEmptyState
} from '../EmptyStateIllustrations';

// Error States
export {
  default as ErrorState,
  NetworkErrorState,
  APIErrorState,
  GitHubErrorState,
  MetaMaskErrorState,
  PermissionErrorState,
  NotFoundErrorState,
  ErrorBoundaryFallback
} from '../ErrorStateIllustrations';

// Illustration Categories
export const IllustrationCategories = {
  LOADING: 'loading',
  EMPTY: 'empty',
  ERROR: 'error',
  SUCCESS: 'success',
  WARNING: 'warning',
  INFO: 'info'
};

// Illustration Sizes
export const IllustrationSizes = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl'
};

// Icon Collections
export const IconCollections = {
  // Heroicons (already available)
  HEROICONS_OUTLINE: 'heroicons-outline',
  HEROICONS_SOLID: 'heroicons-solid',
  
  // Custom POS Dashboard Icons
  CUSTOM: 'custom',
  
  // Network Icons
  NETWORKS: 'networks',
  
  // Status Icons
  STATUS: 'status'
};

// Custom Icon Registry
export const CustomIconRegistry = {
  // Credit & Finance
  'funding': 'Funding',
  'usdc': 'USDC',
  
  // Blockchain & Web3
  'metamask': 'MetaMask',
  'ethereum': 'Ethereum',
  'polygon': 'Polygon',
  'optimism': 'Optimism',
  'base': 'Base',
  'linea': 'Linea',
  'celo': 'Celo',
  
  // Social Protocols
  'github': 'GitHub',
  'farcaster': 'Farcaster',
  'lens': 'Lens',
  
  // POS Dashboard Specific
  'pledgebond': 'PledgeBond',
  'developer-badge': 'DeveloperBadge'
};

// Illustration Utilities
export const IllustrationUtils = {
  // Get appropriate loading state based on context
  getLoadingState: (context) => {
    const loadingStates = {
      github: 'GitHubLoadingIllustration',
      metamask: 'MetaMaskLoadingIllustration',
      default: 'DataLoadingIllustration'
    };
    
    return loadingStates[context] || loadingStates.default;
  },

  // Get appropriate empty state based on context
  getEmptyState: (context) => {
    const emptyStates = {
      projects: 'NoProjectsEmptyState',
      github: 'NoGitHubDataEmptyState',
      credit: 'NoCreditDataEmptyState',
      wallet: 'NoWalletEmptyState',
      search: 'NoSearchResultsEmptyState',
      notifications: 'NoNotificationsEmptyState',
      funding: 'NoFundingHistoryEmptyState',
      default: 'CustomEmptyState'
    };
    
    return emptyStates[context] || emptyStates.default;
  },

  // Get appropriate error state based on error type
  getErrorState: (errorType) => {
    const errorStates = {
      network: 'NetworkErrorState',
      api: 'APIErrorState',
      github: 'GitHubErrorState',
      metamask: 'MetaMaskErrorState',
      permission: 'PermissionErrorState',
      notfound: 'NotFoundErrorState',
      boundary: 'ErrorBoundaryFallback',
      default: 'ErrorState'
    };
    
    return errorStates[errorType] || errorStates.default;
  },

  // Get icon color based on status
  getStatusColor: (status) => {
    const statusColors = {
      success: 'success',
      error: 'error',
      warning: 'warning',
      info: 'primary',
      loading: 'secondary',
      pending: 'warning',
      default: 'current'
    };
    
    return statusColors[status] || statusColors.default;
  },

  // Get network color
  getNetworkColor: (network) => {
    const networkColors = {
      ethereum: 'ethereum',
      polygon: 'polygon',
      optimism: 'optimism',
      base: 'base',
      linea: 'linea',
      celo: 'celo',
      default: 'current'
    };
    
    return networkColors[network] || networkColors.default;
  }
};

// Illustration Presets
export const IllustrationPresets = {
  // Loading presets
  loading: {
    small: { size: 'sm', showSpinner: true },
    medium: { size: 'md', showSpinner: true, showDescription: true },
    large: { size: 'lg', showSpinner: true, showDescription: true, showProgress: true }
  },

  // Empty state presets
  empty: {
    minimal: { size: 'sm', showAction: false },
    standard: { size: 'md', showAction: true },
    detailed: { size: 'lg', showAction: true, showSecondaryAction: true }
  },

  // Error state presets
  error: {
    minimal: { size: 'sm', showDetails: false },
    standard: { size: 'md', showDetails: false, showRetry: true },
    detailed: { size: 'lg', showDetails: true, showRetry: true, showSupport: true }
  }
};

// Component Factory Functions
export const createLoadingState = (type = 'default', options = {}) => {
  const Component = IllustrationUtils.getLoadingState(type);
  return { Component, ...IllustrationPresets.loading.standard, ...options };
};

export const createEmptyState = (type = 'default', options = {}) => {
  const Component = IllustrationUtils.getEmptyState(type);
  return { Component, ...IllustrationPresets.empty.standard, ...options };
};

export const createErrorState = (type = 'default', options = {}) => {
  const Component = IllustrationUtils.getErrorState(type);
  return { Component, ...IllustrationPresets.error.standard, ...options };
};

// Higher-Order Components
export const withIllustration = (WrappedComponent, illustrationType = 'loading') => {
  const WithIllustrationComponent = React.forwardRef((props, ref) => {
    const { loading, error, empty, children, ...restProps } = props;

    if (loading) {
      const LoadingComponent = IllustrationUtils.getLoadingState(illustrationType);
      return <LoadingComponent {...restProps} />;
    }

    if (error) {
      const ErrorComponent = IllustrationUtils.getErrorState('api');
      return <ErrorComponent error={error} {...restProps} />;
    }

    if (empty) {
      const EmptyComponent = IllustrationUtils.getEmptyState(illustrationType);
      return <EmptyComponent {...restProps} />;
    }

    return <WrappedComponent ref={ref} {...restProps}>{children}</WrappedComponent>;
  });
  
  WithIllustrationComponent.displayName = `withIllustration(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithIllustrationComponent;
};

// Illustration Context for global state management
export const IllustrationContext = React.createContext({
  defaultSize: 'md',
  theme: 'light',
  animations: true
});

export const useIllustration = () => {
  const context = React.useContext(IllustrationContext);
  if (!context) {
    throw new Error('useIllustration must be used within an IllustrationProvider');
  }
  return context;
};

export const IllustrationProvider = ({ 
  children, 
  defaultSize = 'md',
  theme = 'light',
  animations = true 
}) => {
  const value = {
    defaultSize,
    theme,
    animations
  };

  return (
    <IllustrationContext.Provider value={value}>
      {children}
    </IllustrationContext.Provider>
  );
};

// Default export with explicit name to fix react/display-name lint error
const illustrationsExport = {
  IllustrationCategories,
  IllustrationSizes,
  IconCollections,
  CustomIconRegistry,
  IllustrationUtils,
  IllustrationPresets,
  createLoadingState,
  createEmptyState,
  createErrorState,
  withIllustration,
  IllustrationProvider,
  useIllustration
};

export default illustrationsExport;
