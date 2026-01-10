import type { Config } from 'tailwindcss';
import { tokens } from './lib/theme/tokens';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'media', // 使用媒體查詢來偵測深色模式
  theme: {
    extend: {
      colors: {
        // 保留原有的 CSS 變數支援
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        
        // 主色調
        primary: tokens.colors.primary,
        // 輔助色
        secondary: tokens.colors.secondary,
        // 語義顏色
        success: tokens.colors.success,
        error: tokens.colors.error,
        warning: tokens.colors.warning,
        info: tokens.colors.info,
      },
      spacing: tokens.spacing,
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      fontFamily: tokens.typography.fontFamily,
      fontSize: tokens.typography.fontSize,
      fontWeight: tokens.typography.fontWeight,
      zIndex: tokens.zIndex,
      screens: tokens.breakpoints,
      transitionDuration: tokens.transition.duration,
      transitionTimingFunction: tokens.transition.timing,
    },
  },
  plugins: [],
};

export default config;
