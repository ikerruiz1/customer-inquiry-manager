import React from 'react';

export type ThemeId =
  | 'cloudscape'
  | 'cobalt'
  | 'aura'
  | 'syntra'
  | 'nebula'
  | 'azure'
  | 'classic';

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  category: 'Light' | 'Dark';
  subtitle: string;
  badge: string;
  isDark: boolean;
  imageUrl?: string;
  backgroundCss: React.CSSProperties;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'cloudscape',
    name: 'Cloudscape',
    category: 'Light',
    subtitle: 'Cerulean sky & soft cumulus mist',
    badge: 'Sky',
    isDark: false,
    imageUrl: '/themes/theme_cloudscape.jpg',
    backgroundCss: {
      backgroundImage: `url('/themes/theme_cloudscape.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    },
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    category: 'Dark',
    subtitle: 'Deep royal & electric cobalt fluid wave layers',
    badge: 'Cobalt',
    isDark: true,
    imageUrl: '/themes/theme_cobalt.jpg',
    backgroundCss: {
      backgroundImage: `url('/themes/theme_cobalt.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      backgroundColor: '#0A1931',
    },
  },
  {
    id: 'syntra',
    name: 'Syntra',
    category: 'Dark',
    subtitle: 'Angular white neon crest & 3D grid',
    badge: 'Cyber',
    isDark: true,
    imageUrl: '/themes/theme_syntra.jpg',
    backgroundCss: {
      backgroundImage: `url('/themes/theme_syntra.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      backgroundColor: '#050608',
    },
  },
  {
    id: 'nebula',
    name: 'Nebula',
    category: 'Dark',
    subtitle: 'MentorAI velvet purple beam & grid tiles',
    badge: 'Nebula',
    isDark: true,
    imageUrl: '/themes/theme_nebula.jpg',
    backgroundCss: {
      backgroundImage: `url('/themes/theme_nebula.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
      backgroundColor: '#07050E',
    },
  },
  {
    id: 'azure',
    name: 'Horizon',
    category: 'Light',
    subtitle: 'Fluid daylight rolling wave contours',
    badge: 'Horizon',
    isDark: false,
    imageUrl: '/themes/theme_azure.jpg',
    backgroundCss: {
      backgroundImage: `url('/themes/theme_azure.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundRepeat: 'no-repeat',
      backgroundAttachment: 'fixed',
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    category: 'Light',
    subtitle: 'Clean minimalist studio canvas',
    badge: 'Neutral',
    isDark: false,
    backgroundCss: {
      backgroundColor: '#F4F6F8',
    },
  },
];
