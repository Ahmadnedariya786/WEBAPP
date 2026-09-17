import React from 'react';

interface PageHeadingProps {
  title: string;
  icon?: React.ReactNode;
}

/**
 * S33 — Shared page-level heading component.
 *
 * Design tokens:
 *   Title: 28px (desktop) / 24px (≤360px), weight 800, letter-spacing -0.02em
 *   Underline bar: 48×5px, border-radius 5px, 8px below baseline
 *   Container: mt-[4px] mb-[20px], background transparent
 *
 * Theme skins applied via .page-heading-title / .page-heading-bar in index.css
 */
export const PageHeading: React.FC<PageHeadingProps> = ({ title, icon }) => (
  <div
    className="page-heading-container flex flex-col bg-transparent"
    style={{ marginTop: 4, marginBottom: 20, background: 'transparent' }}
  >
    <h2
      className="page-heading-title font-gujarati flex items-center gap-2 min-w-0"
      style={{
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        margin: 0,
      }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{title}</span>
    </h2>
    <div
      className="page-heading-bar"
      style={{
        width: 48,
        height: 5,
        borderRadius: 5,
        marginTop: 8,
      }}
    />
  </div>
);
