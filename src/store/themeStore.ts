import { create } from 'zustand';
export type Theme = 'outdoor' | 'dark' | 'premium';
type S = { theme: Theme; setTheme: (t: Theme) => void };
export const getHeaderBg = (t: Theme): string => {
  if (t === 'outdoor') return '#FBF7EC';
  if (t === 'dark') return '#20242B';
  return '#241640';
};

export const getThemeBg = (t: Theme): string => {
  if (t === 'outdoor') return '#F5F0E1';
  if (t === 'dark') return '#20242B';
  return '#171238';
};

export const getColorScheme = (t: Theme): 'light' | 'dark' => {
  return t === 'outdoor' ? 'light' : 'dark';
};

export const updateThemeColorMeta = (t: Theme) => {
  if (typeof document === 'undefined') return;
  const headerBg = getHeaderBg(t);
  const pageBg = getThemeBg(t);
  const colorScheme = getColorScheme(t);

  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute('name', 'theme-color');
    document.head.appendChild(m);
  }
  m.setAttribute('content', headerBg);

  let cs = document.querySelector('meta[name="color-scheme"]');
  if (!cs) {
    cs = document.createElement('meta');
    cs.setAttribute('name', 'color-scheme');
    document.head.appendChild(cs);
  }
  cs.setAttribute('content', colorScheme);

  document.documentElement.style.backgroundColor = pageBg;
  document.documentElement.style.colorScheme = colorScheme;
  if (document.body) {
    document.body.style.backgroundColor = pageBg;
    document.body.style.colorScheme = colorScheme;
  }
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
  (window as any).__getHeaderBg = getHeaderBg;
  (window as any).__getThemeBg = getThemeBg;
  (window as any).__getColorScheme = getColorScheme;
  window.addEventListener('app-ready', () => {
    updateThemeColorMeta(useThemeStore.getState().theme);
  });
}

