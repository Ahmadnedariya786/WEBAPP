import { create } from 'zustand';
export type Theme = 'outdoor' | 'dark' | 'premium';
type S = { theme: Theme; setTheme: (t: Theme) => void };
export const useThemeStore = create<S>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'dark',
  setTheme: (t) => {
    const root = document.documentElement;
    root.classList.add('theme-switching');
    root.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    
    const m = document.querySelector('meta[name="theme-color"]');
    if (t === 'outdoor') {
      if (m) m.setAttribute('content', '#F5F0E1');
      document.documentElement.style.backgroundColor = '#F5F0E1';
    } else if (t === 'premium') {
      if (m) m.setAttribute('content', '#171238');
      document.documentElement.style.backgroundColor = '#171238';
    } else {
      if (m) m.setAttribute('content', '#1F2329');
      document.documentElement.style.backgroundColor = '#1F2329';
    }

    set({ theme: t });
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        root.classList.remove('theme-switching');
      }, 120);
    });
  },
}));
document.documentElement.setAttribute('data-theme', useThemeStore.getState().theme);
