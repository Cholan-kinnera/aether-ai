import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Accessible AQI Palette (WCAG 2.1 AA compliant)
        aqi: {
          good: '#10B981',       // Green
          moderate: '#F59E0B',   // Amber
          usg: '#F97316',        // Orange (Unhealthy for Sensitive Groups)
          unhealthy: '#EF4444',  // Red
          veryunhealthy: '#8B5CF6', // Purple
          hazardous: '#881337',  // Deep Maroon
        },
      },
    },
  },
  plugins: [],
};

export default config;
