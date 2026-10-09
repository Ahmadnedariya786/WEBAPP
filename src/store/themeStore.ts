import { create } from 'zustand';
export type Theme = 'outdoor' | 'dark' | 'premium';
type S = { theme: Theme; setTheme: (t: Theme) => void };
export const getThemeBg = (t: Theme): string => {
  if (t === 'outdoor') return '#F5F0E1';
  if (t === 'dark') return '#20242B';
  return '#171238';
};

export const updateThemeColorMeta = (t: Theme) => {
  if (typeof document === 'undefined') return;
  const bg = getThemeBg(t);
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute('name', 'theme-color');
    document.head.appendChild(m);
  }
  m.setAttribute('content', bg);
  document.documentElement.style.backgroundColor = bg;
  if (document.body) document.body.style.backgroundColor = bg;
};

export const useThemeStore = create<S>((set) => ({
  theme: (typeof localStorage !== 'undefined' && (localStorage.getItem('theme') as Theme)) || 'premium',
  setTheme: (t) => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    root.classList.remove('theme-fading');
    root.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    
    updateThemeColorMeta(t);

    set({ theme: t });
    
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      root.classList.remove('theme-switching');
    } else {
      requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
        root.classList.add('theme-fading');
        setTimeout(() => {
          root.classList.remove('theme-fading');
        }, 180);
      });
    }
  },
}));

const initTheme = useThemeStore.getState().theme;
document.documentElement.setAttribute('data-theme', initTheme);
updateThemeColorMeta(initTheme);

if (typeof window !== 'undefined') {
  (window as any).__setTheme = (t: Theme) => useThemeStore.getState().setTheme(t);
  (window as any).__updateThemeColorMeta = updateThemeColorMeta;
  window.addEventListener('app-ready', () => {
    updateThemeColorMeta(useThemeStore.getState().theme);
  });
}

