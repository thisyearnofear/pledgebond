/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic colors backed by CSS custom properties (themes.css)
        // These automatically adapt to dark mode via CSS custom property overrides
        primary: {
          50: 'var(--color-primary-light, #dbeafe)',
          100: 'var(--color-primary-light, #dbeafe)',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: 'rgb(var(--color-primary-rgb, 59 130 246) / <alpha-value>)',
          600: 'rgb(var(--color-primary-hover-rgb, 37 99 235) / <alpha-value>)',
          700: 'rgb(var(--color-primary-dark-rgb, 29 78 216) / <alpha-value>)',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: {
          50: 'var(--color-secondary-light, #f3e8ff)',
          100: 'var(--color-secondary-light, #f3e8ff)',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: 'rgb(var(--color-secondary-rgb, 168 85 247) / <alpha-value>)',
          600: 'rgb(var(--color-secondary-hover-rgb, 147 51 234) / <alpha-value>)',
          700: 'rgb(var(--color-secondary-dark-rgb, 124 58 237) / <alpha-value>)',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        success: {
          50: 'var(--color-success-light, #dcfce7)',
          500: 'rgb(var(--color-success-rgb, 34 197 94) / <alpha-value>)',
          600: 'rgb(var(--color-success-hover-rgb, 22 163 74) / <alpha-value>)',
          700: 'rgb(var(--color-success-dark-rgb, 21 128 61) / <alpha-value>)',
        },
        warning: {
          50: 'var(--color-warning-light, #fef3c7)',
          500: 'rgb(var(--color-warning-rgb, 245 158 11) / <alpha-value>)',
          600: 'rgb(var(--color-warning-hover-rgb, 217 119 6) / <alpha-value>)',
          700: 'rgb(var(--color-warning-dark-rgb, 180 83 9) / <alpha-value>)',
        },
        error: {
          50: 'var(--color-error-light, #fee2e2)',
          500: 'rgb(var(--color-error-rgb, 239 68 68) / <alpha-value>)',
          600: 'rgb(var(--color-error-hover-rgb, 220 38 38) / <alpha-value>)',
          700: 'rgb(var(--color-error-dark-rgb, 185 28 28) / <alpha-value>)',
        },
        // Surface semantic tokens
        surface: {
          DEFAULT: 'var(--color-surface, #ffffff)',
          primary: 'var(--color-surface, #ffffff)',
          secondary: 'var(--color-surface-secondary, #f9fafb)',
          hover: 'var(--color-surface-hover, #f3f4f6)',
          tertiary: 'var(--color-background-tertiary, #f3f4f6)',
        },
        border: {
          DEFAULT: 'var(--color-border, #e5e7eb)',
          primary: 'var(--color-border, #e5e7eb)',
          secondary: 'var(--color-border-secondary, #d1d5db)',
          hover: 'var(--color-border-hover, #9ca3af)',
        },
        // Text hierarchy tokens. `bg-surface-primary` / `text-text-*` were referenced
        // across ~128 call sites with no matching key, so they silently inherited.
        text: {
          primary: 'var(--color-text, #111827)',
          secondary: 'var(--color-text-secondary, #4b5563)',
          tertiary: 'var(--color-text-tertiary, #5f6b7d)',
          muted: 'var(--color-text-muted, #4b5563)',
        },
        // Credit score colors
        credit: {
          excellent: 'var(--color-credit-excellent, #22c55e)',
          good: 'var(--color-credit-good, #3b82f6)',
          fair: 'var(--color-credit-fair, #f59e0b)',
          poor: 'var(--color-credit-poor, #f97316)',
          'very-poor': 'var(--color-credit-very-poor, #ef4444)',
        },
        // Network colors
        network: {
          ethereum: 'var(--color-ethereum, #627eea)',
          polygon: 'var(--color-polygon, #8247e5)',
          optimism: 'var(--color-optimism, #ff0420)',
          base: 'var(--color-base, #0052ff)',
          linea: 'var(--color-linea, #121212)',
          celo: 'var(--color-celo, #35d07f)',
        },
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      spacing: {
        'safe-left': 'max(1rem, env(safe-area-inset-left))',
        'safe-right': 'max(1rem, env(safe-area-inset-right))',
      },
      minHeight: {
        touch: '2.75rem',
      },
      minWidth: {
        touch: '2.75rem',
      },
      zIndex: {
        dropdown: 'var(--z-dropdown, 1000)',
        sticky: 'var(--z-sticky, 1100)',
        overlay: 'var(--z-overlay, 1300)',
        modal: 'var(--z-modal, 1400)',
        toast: 'var(--z-toast, 1700)',
        tooltip: 'var(--z-tooltip, 1800)',
      },
      borderRadius: {
        card: 'var(--radius-card, 0.5rem)',
        button: 'var(--radius-button, 0.375rem)',
        input: 'var(--radius-input, 0.375rem)',
      },
      boxShadow: {
        card: 'var(--shadow-card, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))',
        'card-hover': 'var(--shadow-card-hover, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))',
        modal: 'var(--shadow-modal, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))',
        focus: 'var(--shadow-focus, 0 0 0 3px rgb(59 130 246 / 0.1))',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave 10s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'confetti-fall': 'confettiFall 3s ease-out forwards',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'translateX(0) translateY(0)' },
          '50%': { transform: 'translateX(-25px) translateY(5px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        confettiFall: {
          '0%': { transform: 'translateY(-100vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(720deg)', opacity: '0' },
        }
      },
    },
  },
  safelist: [
    { pattern: /^z-(modal|toast|overlay|dropdown|tooltip|sticky)$/ },
  ],
  plugins: [],
  corePlugins: {
    aspectRatio: true,
  },
};
