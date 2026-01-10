/**
 * 主題配置系統
 * 支援淺色/深色主題和自定義配色
 */

import { tokens } from './tokens';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // 背景色
  background: string;
  surface: string;
  surfaceElevated: string;
  
  // 文字顏色
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };
  
  // 邊框顏色
  border: {
    default: string;
    muted: string;
    focus: string;
  };
  
  // 語義顏色
  primary: string;
  secondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

export interface ThemeConfig {
  mode: ThemeMode;
  colors: ThemeColors;
}

// 淺色主題配置
export const lightTheme: ThemeConfig = {
  mode: 'light',
  colors: {
    background: tokens.colors.gray[50],
    surface: '#ffffff',
    surfaceElevated: '#ffffff',
    text: {
      primary: tokens.colors.gray[900],
      secondary: tokens.colors.gray[600],
      tertiary: tokens.colors.gray[400],
      inverse: '#ffffff',
    },
    border: {
      default: tokens.colors.gray[200],
      muted: tokens.colors.gray[100],
      focus: tokens.colors.primary[600],
    },
    primary: tokens.colors.primary[600],
    secondary: tokens.colors.secondary[600],
    success: tokens.colors.success[600],
    error: tokens.colors.error[600],
    warning: tokens.colors.warning[600],
    info: tokens.colors.info[600],
  },
};

// 深色主題配置
export const darkTheme: ThemeConfig = {
  mode: 'dark',
  colors: {
    background: tokens.colors.gray[900],
    surface: tokens.colors.gray[800],
    surfaceElevated: tokens.colors.gray[700],
    text: {
      primary: '#ededed',
      secondary: tokens.colors.gray[400],
      tertiary: tokens.colors.gray[500],
      inverse: tokens.colors.gray[900],
    },
    border: {
      default: tokens.colors.gray[700],
      muted: tokens.colors.gray[800],
      focus: tokens.colors.primary[500],
    },
    primary: tokens.colors.primary[500],
    secondary: tokens.colors.secondary[500],
    success: tokens.colors.success[500],
    error: tokens.colors.error[500],
    warning: tokens.colors.warning[500],
    info: tokens.colors.info[500],
  },
};

// 獲取當前主題（基於系統偏好）
export function getTheme(mode?: ThemeMode): ThemeConfig {
  if (mode) {
    return mode === 'dark' ? darkTheme : lightTheme;
  }
  
  // 預設使用系統偏好
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? darkTheme
      : lightTheme;
  }
  
  return lightTheme;
}

// 導出 tokens 供其他地方使用
export { tokens };
