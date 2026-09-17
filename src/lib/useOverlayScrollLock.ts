import { useEffect, useRef } from 'react';

// Global state for reference-counted scroll lock
let lockCount = 0;
let savedScrollY = 0;

export function getLockCount(): number {
  return lockCount;
}

export function lockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (lockCount === 0) {
    savedScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    document.body.classList.add('has-overlay-open');
  }
  lockCount++;
}

export function unlockScroll(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.classList.remove('has-overlay-open');
    window.scrollTo({
      top: savedScrollY,
      left: 0,
      behavior: 'instant' as ScrollBehavior
    });
  }
}

/**
 * N1 route-change & fail-safe unlock:
 * If no overlay dialog element remains mounted in the DOM, force-unlock the body.
 */
export function forceUnlockIfNoOverlays(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const activeDialogs = document.querySelectorAll(
    '[role="dialog"], #calendar-dialog-overlay, #calendar-dialog-container, .viewport-fixed-overlay'
  );
  if (activeDialogs.length === 0) {
    lockCount = 0;
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.classList.remove('has-overlay-open');
  }
}

export interface UseOverlayScrollLockOptions {
  isOpen: boolean;
  onClose?: () => void;
  panelRef?: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

export function useOverlayScrollLock({
  isOpen,
  onClose,
  panelRef,
  initialFocusRef
}: UseOverlayScrollLockOptions): void {
  const isLockedRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      lockScroll();
      isLockedRef.current = true;

      // Defer panel scrollTop = 0 & focus trap to requestAnimationFrame after first paint (zero layout thrash)
      const timer = requestAnimationFrame(() => {
        if (panelRef?.current) {
          panelRef.current.scrollTop = 0;
        }

        if (initialFocusRef?.current) {
          initialFocusRef.current.focus();
        } else if (panelRef?.current) {
          const focusable = panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            panelRef.current.focus?.();
          }
        }
      });

      // Keyboard focus trap & Escape key listener
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose?.();
          return;
        }

        if (e.key === 'Tab' && panelRef?.current) {
          const focusable = Array.from(
            panelRef.current.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter(el => el.offsetParent !== null || window.getComputedStyle(el).display !== 'none');

          if (focusable.length === 0) {
            e.preventDefault();
            return;
          }

          const firstEl = focusable[0];
          const lastEl = focusable[focusable.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstEl || !panelRef.current.contains(document.activeElement)) {
              e.preventDefault();
              lastEl.focus();
            }
          } else {
            if (document.activeElement === lastEl || !panelRef.current.contains(document.activeElement)) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        cancelAnimationFrame(timer);
        window.removeEventListener('keydown', handleKeyDown);
        if (isLockedRef.current) {
          unlockScroll();
          isLockedRef.current = false;
        }
      };
    }
  }, [isOpen, onClose, panelRef, initialFocusRef]);

  // N1: Decrement on abrupt unmount if still locked
  useEffect(() => {
    return () => {
      if (isLockedRef.current) {
        unlockScroll();
        isLockedRef.current = false;
      }
    };
  }, []);
}
