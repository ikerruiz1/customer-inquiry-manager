import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { THEMES, type ThemeId } from '../types/theme';

interface ThemeSelectorProps {
  currentThemeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentThemeId,
  onSelectTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const activeTheme =
    THEMES.find((t) => t.id === currentThemeId || (currentThemeId === 'aura' && t.id === 'cobalt')) ||
    THEMES[0];

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      {/* Theme Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 14px',
          borderRadius: '9999px',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(12, 13, 13, 0.12)',
          color: '#0C0D0D',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 3px rgba(12, 13, 13, 0.04)',
        }}
        title="Change ambient background canvas theme"
      >
        <span
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundImage: activeTheme.imageUrl ? `url('${activeTheme.imageUrl}')` : 'none',
            backgroundColor: activeTheme.imageUrl ? 'transparent' : '#CBD5E1',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'inline-block',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            border: '1px solid rgba(255,255,255,0.7)',
            flexShrink: 0,
          }}
        />
        <span>Theme: {activeTheme.name.split(' ')[0]}</span>
        <ChevronDown
          size={12}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            color: '#6B7280',
          }}
        />
      </button>

      {/* Theme Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '330px',
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid rgba(12, 13, 13, 0.12)',
            boxShadow: '0 16px 40px -8px rgba(0, 0, 0, 0.22)',
            padding: '12px',
            zIndex: 90,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            animation: 'fadeInMenu 0.15s ease-out',
          }}
        >
          <div
            style={{
              padding: '6px 8px 8px 8px',
              borderBottom: '1px solid rgba(12, 13, 13, 0.06)',
            }}
          >
            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0C0D0D' }}>
              Themes
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '360px', overflowY: 'auto' }}>
            {THEMES.map((theme) => {
              const isSelected = theme.id === currentThemeId;
              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    onSelectTheme(theme.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '12px',
                    backgroundColor: isSelected ? 'rgba(4, 120, 87, 0.08)' : 'transparent',
                    border: isSelected ? '1px solid rgba(4, 120, 87, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* High-res Wallpaper Thumbnail */}
                    <div
                      style={{
                        width: '42px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundImage: theme.imageUrl ? `url('${theme.imageUrl}')` : 'none',
                        backgroundColor: theme.imageUrl ? 'transparent' : '#E2E8F0',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '1px solid rgba(0, 0, 0, 0.15)',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                        flexShrink: 0,
                      }}
                    />

                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0C0D0D' }}>
                      {theme.name}
                    </span>
                  </div>

                  {isSelected && <Check size={16} color="#047857" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
