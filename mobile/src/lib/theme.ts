import { useColorScheme } from 'react-native';

// Mirrors the web app's zinc palette (src/app/globals.css) with an indigo accent
const light = {
  bg: '#fcfcfd',
  card: '#ffffff',
  cardAlt: '#f4f4f5',
  border: '#e4e4e7',
  text: '#18181b',
  textMuted: '#71717a',
  textFaint: '#a1a1aa',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  onAccent: '#ffffff',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  warning: '#d97706',
  success: '#059669',
  successSoft: '#ecfdf5',
};

const dark: typeof light = {
  bg: '#09090b',
  card: '#131316',
  cardAlt: '#1f1f24',
  border: '#27272a',
  text: '#f4f4f5',
  textMuted: '#a1a1aa',
  textFaint: '#52525b',
  accent: '#818cf8',
  accentSoft: '#1e1b4b',
  onAccent: '#0b0b12',
  danger: '#f87171',
  dangerSoft: '#2a1215',
  warning: '#fbbf24',
  success: '#34d399',
  successSoft: '#0b2a20',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const priorityColors = ['#a1a1aa', '#60a5fa', '#f59e0b', '#ef4444'];
export const priorityLabels = ['None', 'Low', 'Medium', 'High'];

export const blockKindColors: Record<string, string> = {
  work: '#6366f1',
  study: '#0ea5e9',
  rest: '#10b981',
  admin: '#f59e0b',
};
