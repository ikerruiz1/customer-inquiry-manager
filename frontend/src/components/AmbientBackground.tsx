import React, { useEffect } from 'react';
import { THEMES, type ThemeId } from '../types/theme';

interface AmbientBackgroundProps {
  themeId: ThemeId;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({ themeId }) => {
  const currentTheme =
    THEMES.find((t) => t.id === themeId || (themeId === 'aura' && t.id === 'cobalt')) || THEMES[0];

  // Preload all theme wallpapers on mount for instant zero-lag switching
  useEffect(() => {
    THEMES.forEach((theme) => {
      if (theme.imageUrl) {
        const img = new Image();
        img.src = theme.imageUrl;
      }
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        transform: 'translateZ(0)',
        willChange: 'background-image, opacity',
        transition: 'background-image 0.3s ease, background-color 0.3s ease',
        ...currentTheme.backgroundCss,
      }}
    />
  );
};
