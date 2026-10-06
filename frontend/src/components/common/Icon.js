import React from 'react';
import { cva } from 'class-variance-authority';
import * as HeroIcons from '@heroicons/react/24/outline';
import * as HeroIconsSolid from '@heroicons/react/24/solid';

// Icon variant styles using our design tokens
const iconVariants = cva(
  'inline-block flex-shrink-0',
  {
    variants: {
      size: {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4', 
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
        xl: 'h-8 w-8',
        '2xl': 'h-10 w-10',
        '3xl': 'h-12 w-12'
      },
      color: {
        current: 'text-current',
        primary: 'text-primary-500',
        secondary: 'text-text-secondary',
        tertiary: 'text-text-tertiary',
        success: 'text-success-500',
        warning: 'text-warning-500',
        error: 'text-error-500',
        muted: 'text-text-muted',
        white: 'text-white',
        // Network colors
        ethereum: 'text-ethereum',
        polygon: 'text-polygon',
        optimism: 'text-optimism',
        base: 'text-base',
        linea: 'text-linea',
        celo: 'text-celo'
      }
    },
    defaultVariants: {
      size: 'md',
      color: 'current'
    }
  }
);

// Main Icon Component
export const Icon = React.forwardRef(({
  name,
  size = 'md',
  color = 'current',
  solid = false,
  className = '',
  ...props
}, ref) => {
  // Get the icon from Heroicons
  const iconSet = solid ? HeroIconsSolid : HeroIcons;
  const IconComponent = iconSet[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in Heroicons ${solid ? 'solid' : 'outline'} set`);
    return (
      <div 
        ref={ref}
        className={iconVariants({ size, color, className })}
        {...props}
      >
        ?
      </div>
    );
  }

  return (
    <IconComponent
      ref={ref}
      className={iconVariants({ size, color, className })}
      {...props}
    />
  );
});

Icon.displayName = 'Icon';

// Custom POS Dashboard Icons
export const CustomIcons = {
  // Funding Icons
  Funding: ({ className = '', ...props }) => (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),

  // MetaMask Wallet
  MetaMask: ({ className = '', ...props }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M22.56 8.25L13.5 1.5L11.25 4.5L18.75 9.75L22.56 8.25ZM1.44 8.25L10.5 1.5L12.75 4.5L5.25 9.75L1.44 8.25ZM19.5 10.5L22.5 12L19.5 13.5V15.75L12 19.5L4.5 15.75V13.5L1.5 12L4.5 10.5V8.25L12 4.5L19.5 8.25V10.5Z" />
    </svg>
  ),

  // USDC Token
  USDC: ({ className = '', ...props }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <circle cx="12" cy="12" r="10" fill="#2775CA" />
      <path
        d="M12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12C4 7.58172 7.58172 4 12 4Z"
        fill="white"
      />
      <path
        d="M12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6Z"
        fill="#2775CA"
      />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="white"
        fontSize="8"
        fontWeight="bold"
      >
        USDC
      </text>
    </svg>
  ),

  // GitHub Integration
  GitHub: ({ className = '', ...props }) => (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  ),

  // Farcaster Protocol
  Farcaster: ({ className = '', ...props }) => (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M12 2L2 7L12 12L22 7L12 2Z" />
      <path d="M2 17L12 22L22 17" />
      <path d="M2 12L12 17L22 12" />
    </svg>
  ),

  // Lens Protocol
  Lens: ({ className = '', ...props }) => (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1L21.09 6V18L12 23L2.91 18V6L12 1Z" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),

  // PledgeBond
  PledgeBond: ({ className = '', ...props }) => (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 12h14"
      />
    </svg>
  ),

  // Developer Badge
  DeveloperBadge: ({ className = '', ...props }) => (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    </svg>
  )
};

// Icon with custom icons support
export const IconWithCustom = React.forwardRef(({
  name,
  custom = false,
  size = 'md',
  color = 'current',
  className = '',
  ...props
}, ref) => {
  if (custom && CustomIcons[name]) {
    const CustomIcon = CustomIcons[name];
    return (
      <CustomIcon
        ref={ref}
        className={iconVariants({ size, color, className })}
        {...props}
      />
    );
  }

  return (
    <Icon
      ref={ref}
      name={name}
      size={size}
      color={color}
      className={className}
      {...props}
    />
  );
});

IconWithCustom.displayName = 'IconWithCustom';

// Network Icon Component
export const NetworkIcon = ({ network, size = 'md', className = '', ...props }) => {
  const networkIcons = {
    ethereum: 'CurrencyDollarIcon', // Placeholder - would use actual Ethereum icon
    polygon: 'CurrencyDollarIcon', // Placeholder - would use actual Polygon icon
    optimism: 'CurrencyDollarIcon', // Placeholder - would use actual Optimism icon
    base: 'CurrencyDollarIcon', // Placeholder - would use actual Base icon
    linea: 'CurrencyDollarIcon', // Placeholder - would use actual Linea icon
    celo: 'CurrencyDollarIcon' // Placeholder - would use actual Celo icon
  };

  return (
    <Icon
      name={networkIcons[network] || 'QuestionMarkCircleIcon'}
      size={size}
      color={network}
      className={className}
      {...props}
    />
  );
};

// Status Icon Component
export const StatusIcon = ({ status, size = 'md', className = '', ...props }) => {
  const statusConfig = {
    success: { icon: 'CheckCircleIcon', color: 'success' },
    error: { icon: 'XCircleIcon', color: 'error' },
    warning: { icon: 'ExclamationTriangleIcon', color: 'warning' },
    info: { icon: 'InformationCircleIcon', color: 'primary' },
    loading: { icon: 'ArrowPathIcon', color: 'secondary' },
    pending: { icon: 'ClockIcon', color: 'warning' }
  };

  const config = statusConfig[status] || statusConfig.info;

  return (
    <Icon
      name={config.icon}
      size={size}
      color={config.color}
      className={`${status === 'loading' ? 'animate-spin' : ''} ${className}`}
      {...props}
    />
  );
};

// Icon Button with consistent sizing
export const IconButtonWithIcon = React.forwardRef(({
  icon,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...props
}, ref) => {
  const sizeMap = {
    xs: { button: 'h-6 w-6', icon: 'xs' },
    sm: { button: 'h-8 w-8', icon: 'sm' },
    md: { button: 'h-10 w-10', icon: 'md' },
    lg: { button: 'h-12 w-12', icon: 'lg' },
    xl: { button: 'h-14 w-14', icon: 'xl' }
  };

  const sizes = sizeMap[size];

  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center rounded-md transition-colors focus-ring
        ${sizes.button}
        ${variant === 'ghost' ? 'hover:bg-surface-hover text-secondary hover:text-primary' : ''}
        ${variant === 'primary' ? 'bg-primary-500 hover:bg-primary-600 text-white' : ''}
        ${variant === 'secondary' ? 'bg-surface border border-default hover:bg-surface-hover text-primary' : ''}
        ${className}
      `}
      {...props}
    >
      {typeof icon === 'string' ? (
        <Icon name={icon} size={sizes.icon} />
      ) : (
        React.cloneElement(icon, { 
          className: iconVariants({ size: sizes.icon }) 
        })
      )}
    </button>
  );
});

IconButtonWithIcon.displayName = 'IconButtonWithIcon';

export default Icon;
