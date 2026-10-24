import { defineTheme } from '@astryxdesign/core/theme';
import { y2kIconRegistry } from '../y2k/icons';

export const cyberTheme = defineTheme({
  name: 'cyber',
  radius: { base: 6, multiplier: 1 },
  tokens: {
    '--color-accent': ['#6366f1', '#818cf8'],
    '--color-background-surface': ['#090d16', '#090d16'],
    '--color-background-body': ['#030712', '#030712'],
    '--color-text-primary': ['#f3f4f6', '#f3f4f6'],
    '--color-text-secondary': ['#9ca3af', '#9ca3af'],
    '--color-border': ['#1f2937', '#1f2937'],
    '--color-border-emphasized': ['#374151', '#374151'],
  },
  icons: y2kIconRegistry,
});
