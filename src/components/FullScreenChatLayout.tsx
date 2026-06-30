import React, { useEffect } from 'react';

/**
 * FullScreenChatLayout
 *
 * Shared across Student, Teacher, School Admin, and Academic Admin portals.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Mobile  (<768px)                                                   │
 * │  position: fixed; inset: 0; z-index: 50                            │
 * │  → Escapes the dashboard <main> padding, Sidebar, and Navbar        │
 * │  → Full viewport — identical to WhatsApp / Telegram mobile UX       │
 * │  → Body scroll locked while chat overlay is open                    │
 * │  → Uses bottom: 0 (not height: 100vh) so it adapts to browser bars  │
 * │  → Children receive --safe-area-bottom CSS var for composer padding  │
 * │                                                                     │
 * │  Desktop (≥768px)                                                   │
 * │  position: relative — normal in-flow box inside the dashboard        │
 * │  → Preserves the original 3-column layout (groups | chat | members)  │
 * │  → Restores the rounded-3xl border/shadow decoration                 │
 * │  → h-[calc(100vh-80px)] matched to original ClassDiscussion sizing   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Usage: wrap the entire return of ClassDiscussion with this component.
 * No props beyond children needed — all responsive logic is internal.
 */
export const FullScreenChatLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Lock body/document scroll on mobile while the full-screen overlay is
  // active. Prevents the page beneath from scrolling when the user swipes
  // inside the chat. Cleaned up automatically on unmount.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    if (mq.matches) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
    // Desktop: no body lock needed
    return undefined;
  }, []);

  return (
    <div
      /**
       * CSS class strategy:
       *
       * Mobile (no prefix):
       *   fixed inset-0 z-50        → full-viewport overlay, escapes all containers
       *   flex overflow-hidden       → flex column for header/messages/composer
       *   bg-[#070a13]              → match app background, no transparent gap
       *
       * Desktop (md: prefix overrides all of the above):
       *   md:relative               → reverts to normal document flow
       *   md:inset-auto             → clears top/right/bottom/left: 0
       *   md:z-auto                 → clears z-index
       *   md:h-[calc(100vh-80px)]   → original ClassDiscussion height (100vh - navbar)
       *   md:w-full                 → fill the padded <main> container
       *   md:rounded-3xl + md:backdrop-blur-xl + md:border + md:shadow-2xl
       *                             → restore original decorative styles
       *   md:bg-slate-950/20        → original semi-transparent glass look
       */
      className={[
        // ── Mobile: full-screen fixed overlay ─────────────────────────
        'fixed inset-0 z-50',
        'flex overflow-hidden',
        'bg-[#070a13]',
        // CSS class that triggers the @media (max-width:767px) rules in index.css
        // (100dvh, safe-area-inset-*, overscroll-behavior:contain)
        'full-screen-chat-overlay',
        // ── Desktop: in-flow, original dimensions & decoration ─────────
        'md:relative md:inset-auto md:z-auto',
        'md:h-[calc(100vh-80px)] md:w-full',
        'md:rounded-3xl',
        'md:bg-slate-950/20 md:backdrop-blur-xl',
        'md:border md:border-slate-800/80',
        'md:shadow-2xl',
        'md:text-slate-100',
      ].join(' ')}
    >
      {children}
    </div>
  );
};
