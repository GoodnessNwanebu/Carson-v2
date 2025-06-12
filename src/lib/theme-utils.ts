/**
 * Carson Theme Utilities
 * Comprehensive text and UI utilities that automatically adapt to light/dark mode
 * Use these classes throughout the app for consistent theming
 */

// Text Color Utilities
export const textColors = {
  // Primary text - main content
  primary: 'text-gray-900 dark:text-white',
  
  // Secondary text - descriptions, captions
  secondary: 'text-gray-600 dark:text-gray-400',
  
  // Muted text - timestamps, metadata
  muted: 'text-gray-500 dark:text-gray-500',
  
  // Accent text - links, highlights
  accent: 'text-blue-600 dark:text-blue-400',
  
  // Success text
  success: 'text-green-600 dark:text-green-400',
  
  // Warning text
  warning: 'text-yellow-600 dark:text-yellow-400',
  
  // Error text
  error: 'text-red-600 dark:text-red-400',
  
  // Inverse text - for dark backgrounds
  inverse: 'text-white dark:text-gray-900',
} as const

// Background Color Utilities
export const backgroundColors = {
  // Primary backgrounds
  primary: 'bg-white dark:bg-gray-900',
  secondary: 'bg-gray-50 dark:bg-gray-800',
  tertiary: 'bg-gray-100 dark:bg-gray-700',
  
  // Card backgrounds
  card: 'bg-white dark:bg-gray-800',
  cardHover: 'hover:bg-gray-50 dark:hover:bg-gray-700',
  
  // Interactive backgrounds
  interactive: 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600',
  
  // Accent backgrounds
  accent: 'bg-blue-50 dark:bg-blue-900/20',
  accentHover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
  
  // Status backgrounds
  success: 'bg-green-50 dark:bg-green-900/20',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20',
  error: 'bg-red-50 dark:bg-red-900/20',
} as const

// Border Color Utilities
export const borderColors = {
  primary: 'border-gray-200 dark:border-gray-700',
  secondary: 'border-gray-100 dark:border-gray-800',
  accent: 'border-blue-200 dark:border-blue-700',
  success: 'border-green-200 dark:border-green-700',
  warning: 'border-yellow-200 dark:border-yellow-700',
  error: 'border-red-200 dark:border-red-700',
} as const

// Button Utilities
export const buttonStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent',
  secondary: 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white border-gray-200 dark:border-gray-600',
  ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-transparent',
  outline: 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
} as const

// Input Utilities
export const inputStyles = {
  base: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400',
  search: 'bg-gray-50 dark:bg-gray-700 border-0 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:bg-white dark:focus:bg-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400',
} as const

// Status Badge Utilities
export const statusBadges = {
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
  inProgress: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  pending: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800',
} as const

// Modal/Overlay Utilities
export const overlayStyles = {
  backdrop: 'bg-black/50 backdrop-blur-sm',
  modal: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-2xl',
  dropdown: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-lg',
} as const

// Gradient Utilities (for special elements)
export const gradientStyles = {
  primary: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
  accent: 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40',
  success: 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30',
  warning: 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30',
  error: 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/30',
} as const

// Helper function to combine theme classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Utility function to get theme-aware classes
export function getThemeClasses(type: 'text' | 'bg' | 'border', variant: string): string {
  switch (type) {
    case 'text':
      return textColors[variant as keyof typeof textColors] || textColors.primary
    case 'bg':
      return backgroundColors[variant as keyof typeof backgroundColors] || backgroundColors.primary
    case 'border':
      return borderColors[variant as keyof typeof borderColors] || borderColors.primary
    default:
      return ''
  }
}

// Responsive utilities for mobile-first design
export const responsiveUtils = {
  // Mobile-first spacing
  spacing: {
    xs: 'p-3 lg:p-4',
    sm: 'p-4 lg:p-6', 
    md: 'p-6 lg:p-8',
    lg: 'p-8 lg:p-12',
  },
  
  // Mobile-first text sizes
  text: {
    xs: 'text-xs lg:text-sm',
    sm: 'text-sm lg:text-base',
    base: 'text-base lg:text-lg',
    lg: 'text-lg lg:text-xl',
    xl: 'text-xl lg:text-2xl',
  },
  
  // Mobile-first containers
  container: {
    sm: 'w-full max-w-sm mx-auto',
    md: 'w-full max-w-md mx-auto',
    lg: 'w-full max-w-lg mx-auto',
    xl: 'w-full max-w-xl mx-auto',
    '2xl': 'w-full max-w-2xl mx-auto',
  },
} as const 