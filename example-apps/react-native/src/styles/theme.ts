/**
 * Theme constants for consistent styling across the app
 * Matches the color scheme from the TanStack Start web version
 */

export const colors = {
  // Primary colors
  primary: '#0070f3',
  primaryDark: '#0051cc',

  // Status colors
  success: '#28a745',
  successDark: '#218838',
  danger: '#dc3545',
  dangerDark: '#c82333',

  // Feature colors
  burrito: '#e07c24',
  burritoDark: '#c96a1a',

  // Neutral colors
  background: '#f5f5f5',
  white: '#ffffff',
  text: '#333333',
  textSecondary: '#666666',
  textLight: '#999999',
  border: '#dddddd',
  borderLight: '#eeeeee',

  // Component-specific
  statsBackground: '#f8f9fa',
  headerBackground: '#333333',
  headerText: '#ffffff',
  inputBackground: '#ffffff',
  cardBackground: '#ffffff',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
}

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  full: 9999,
}

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
}
