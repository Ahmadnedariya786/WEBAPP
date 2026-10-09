import { Sun, Moon, Gem } from 'lucide-react';
import { useThemeStore, type Theme } from '../../store/themeStore';

interface ThemeSegmentConfig {
  key: Theme;
  label: string;
  icon: typeof Sun;
  accent: string;
  shadow: string;
}

const THEMES: ThemeSegmentConfig[] = [
  {
    key: 'outdoor',
    label: 'Outdoor theme (light)',
    icon: Sun,
    accent: '#243B8F', // outdoor navy
    shadow: 'rgba(36, 59, 143, 0.35)',
  },
  {
    key: 'dark',
    label: 'Graphite theme (dark)',
    icon: Moon,
    accent: '#65A30D', // graphite green
    shadow: 'rgba(101, 163, 13, 0.35)',
  },
  {
    key: 'premium',
    label: 'Premium theme (dark)',
    icon: Gem,
    accent: '#EC4899', // premium pink
    shadow: 'rgba(236, 72, 153, 0.40)',
  },
];

export default function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const activeIndex = Math.max(0, THEMES.findIndex((t) => t.key === theme));
  const activeConfig = THEMES[activeIndex] || THEMES[0];

  return (
    <div
      role="radiogroup"
      aria-label="Theme switcher"
      id="theme-switcher-pill"
      className="theme-switcher-pill relative inline-flex items-center h-8 w-[88px] p-[2px] rounded-full select-none shrink-0"
    >
      {/* Active segment fill with smooth translate & color crossfade */}
      <div
        className="theme-switcher-indicator absolute top-[2px] left-[2px] w-[28px] h-[28px] rounded-full pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"
        style={{
          transform: `translateX(${activeIndex * 28}px)`,
          backgroundColor: activeConfig.accent,
          boxShadow: `0 1px 4px ${activeConfig.shadow}`,
        }}
      />

      {/* 3 Interactive Segments */}
      {THEMES.map((item, idx) => {
        const Icon = item.icon;
        const isActive = idx === activeIndex;

        return (
          <button
            key={item.key}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={item.label}
            title={item.label}
            id={`theme-seg-${item.key}`}
            onClick={() => setTheme(item.key)}
            className={`theme-segment relative flex items-center justify-center w-[28px] h-[28px] rounded-full z-10 transition-colors duration-200 ${
              isActive ? 'active' : ''
            }`}
          >
            <Icon
              size={14}
              strokeWidth={2}
              className={`transition-colors duration-200 ${
                isActive ? 'text-white' : 'text-sub'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
