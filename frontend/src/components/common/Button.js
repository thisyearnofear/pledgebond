import React from "react";
import { cva } from "class-variance-authority";

// Button variant styles using our design tokens
const buttonVariants = cva(
  // Base styles
  "btn-base inline-flex items-center justify-center font-medium transition-all duration-150 focus-ring disabled:opacity-50 disabled:cursor-not-allowed min-h-touch min-w-touch",
  {
    variants: {
      variant: {
        primary: "bg-primary-600 hover:bg-primary-700 active:scale-[0.97] text-white shadow-sm",
        secondary:
          "bg-surface border border-default hover:bg-surface-hover active:scale-[0.97] text-primary",
        ghost: "hover:bg-surface-hover active:scale-[0.97] text-secondary hover:text-primary",
        danger: "bg-error-500 hover:bg-error-600 active:scale-[0.97] text-white shadow-sm",
        success: "bg-success-500 hover:bg-success-600 active:scale-[0.97] text-white shadow-sm",
        warning: "bg-warning-500 hover:bg-warning-600 active:scale-[0.97] text-white shadow-sm",
        outline:
          "border-2 border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white active:scale-[0.97]",
        link: "text-primary-500 hover:text-primary-600 underline-offset-4 hover:underline p-0 h-auto min-h-0 min-w-0",
      },
      size: {
        sm: "h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm rounded-md",
        md: "h-10 sm:h-11 px-4 sm:px-5 text-sm sm:text-base rounded-lg",
        lg: "h-11 sm:h-12 px-5 sm:px-7 text-base sm:text-lg rounded-lg",
        xl: "h-12 sm:h-14 px-6 sm:px-9 text-base sm:text-xl rounded-xl",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

const Button = React.forwardRef(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, fullWidth, className })}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
        )}

        {!loading && leftIcon && <span className="mr-2 -ml-1">{leftIcon}</span>}

        {children}

        {!loading && rightIcon && (
          <span className="ml-2 -mr-1">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

// Button group component for related actions
export const ButtonGroup = ({
  children,
  className = "",
  orientation = "horizontal",
}) => {
  return (
    <div
      className={`
        inline-flex
        ${orientation === "horizontal" ? "flex-row" : "flex-col"}
        ${
          orientation === "horizontal"
            ? "[&>*:not(:first-child)]:ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none"
            : "[&>*:not(:first-child)]:mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none"
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// Icon button component
export const IconButton = React.forwardRef(
  (
    {
      className = "",
      size = "md",
      variant = "ghost",
      icon,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-9 sm:h-10 w-9 sm:w-10 min-w-touch min-h-touch",
      md: "h-10 sm:h-12 w-10 sm:w-12 min-w-touch min-h-touch",
      lg: "h-12 sm:h-14 w-12 sm:w-14 min-w-touch min-h-touch",
      xl: "h-14 sm:h-16 w-14 sm:w-16 min-w-touch min-h-touch",
    };

    const iconSizes = {
      sm: "h-4 sm:h-4 w-4 sm:w-4",
      md: "h-5 sm:h-5 w-5 sm:w-5",
      lg: "h-5 sm:h-6 w-5 sm:w-6",
      xl: "h-6 sm:h-7 w-6 sm:w-7",
    };

    return (
      <button
        ref={ref}
        className={buttonVariants({
          variant,
          className: `${sizeClasses[size]} p-0 ${className}`,
        })}
        aria-label={ariaLabel}
        {...props}
      >
        {React.cloneElement(icon, {
          className: `${iconSizes[size]} ${icon.props.className || ""}`,
        })}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

export default Button;
