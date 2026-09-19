import { create } from 'zustand';
export type Theme = 'outdoor' | 'dark' | 'premium';
type S = { theme: Theme; setTheme: (t: Theme) => void };
export const useThemeStore = create<S>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'dark',
  setTheme: (t) => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    root.classList.remove('theme-fading');
    root.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    
    const m = document.querySelector('meta[name="theme-color"]');
    let bg = '#20242B';
    if (t === 'outdoor') {
      bg = '#F5F0E1';
    } else if (t === 'premium') {
      bg = '#171238';
    } else {
      bg = '#20242B';
    }
    if (m) m.setAttribute('content', bg);
    root.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;

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
document.documentElement.setAttribute('data-theme', useThemeStore.getState().theme);

if (typeof window !== 'undefined') {
  (window as any).__setTheme = (t: Theme) => useThemeStore.getState().setTheme(t);
}
