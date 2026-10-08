import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useOverlayScrollLock } from '../../lib/useOverlayScrollLock';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  overlayId?: string;
  containerId?: string;
  confirmBtnId?: string;
  cancelBtnId?: string;
  icon?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'હા, ખાતરી કરો',
  cancelLabel = 'રદ કરો',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
  overlayId = 'confirm-dialog-overlay',
  containerId = 'confirm-dialog-container',
  confirmBtnId = 'confirm-dialog-confirm-btn',
  cancelBtnId = 'confirm-dialog-cancel-btn',
  icon,
}) => {
  useOverlayScrollLock({ isOpen, onClose: onCancel });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          id={overlayId}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) {
              onCancel();
            }
          }}
          className="confirm-dialog-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm select-none"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            id={containerId}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="confirm-dialog-card w-full max-w-sm max-h-[85vh] overflow-y-auto select-none rounded-[24px] bg-card p-5 sm:p-6 shadow-2xl border border-brd/20 space-y-4 text-center my-auto pointer-events-auto"
            style={{
              margin: 'auto',
            }}
          >
            {icon && (
              <div className="w-12 h-12 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-1">
                {icon}
              </div>
            )}

            <h3 className={cn("font-gujarati font-bold text-lg leading-tight", isDestructive ? "text-danger" : "text-txt")}>
              {title}
            </h3>

            <div className="font-gujarati text-sub text-sm leading-relaxed">
              {message}
            </div>

            <div className="flex gap-3 pt-2 justify-center">
              <button
                type="button"
                id={cancelBtnId}
                disabled={isLoading}
                onClick={onCancel}
                style={{
                  height: '48px',
                  padding: '0 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  lineHeight: 1,
                }}
                className="flex-1 min-w-[90px] rounded-xl border border-brd/30 bg-card hover:bg-card/80 text-txt font-gujarati font-medium text-sm transition-all cursor-pointer select-none"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                id={confirmBtnId}
                disabled={isLoading}
                onClick={onConfirm}
                style={{
                  height: '48px',
                  padding: '0 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  lineHeight: 1,
                }}
                className={cn(
                  "flex-1 min-w-[90px] rounded-xl font-gujarati text-sm font-semibold transition-all cursor-pointer shadow-md select-none border-none text-white",
                  isDestructive
                    ? "bg-danger hover:bg-danger/90 active:scale-[0.98]"
                    : "bg-acc hover:bg-acc/90 active:scale-[0.98]",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
