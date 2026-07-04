import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * FullScreenChatLayout
 *
 * Shared across Student, Teacher, School Admin, and Academic Admin portals.
 */
export const FullScreenChatLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check if viewport is mobile sized to dynamically select portaling
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    return undefined;
  }, []);

  // Listen to Visual Viewport changes to dynamically adjust chat height
  // when the virtual/soft keyboard is shown/hidden on mobile browsers.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncViewport = () => {
      const vv = window.visualViewport;
      if (vv) {
        document.documentElement.style.setProperty('--visual-viewport-height', `${vv.height}px`);
        document.documentElement.style.setProperty('--visual-viewport-top', `${vv.offsetTop}px`);
      } else {
        document.documentElement.style.setProperty('--visual-viewport-height', `${window.innerHeight}px`);
        document.documentElement.style.setProperty('--visual-viewport-top', '0px');
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', syncViewport);
      vv.addEventListener('scroll', syncViewport);
    }
    window.addEventListener('resize', syncViewport);
    
    // Initial run
    syncViewport();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', syncViewport);
        vv.removeEventListener('scroll', syncViewport);
      }
      window.removeEventListener('resize', syncViewport);
      document.documentElement.style.removeProperty('--visual-viewport-height');
      document.documentElement.style.removeProperty('--visual-viewport-top');
    };
  }, []);

  // Measure the actual rendered navbar height after every paint so --navbar-height is
  // always accurate. Covers cases where the header grows taller (e.g. logo text
  // wraps to 2 lines on narrow phones, causing a visible gap if hardcoded to 60px).
  useLayoutEffect(() => {
    const measureNavbar = () => {
      const hdr = document.querySelector<HTMLElement>('header.sticky');
      const h = hdr ? Math.round(hdr.getBoundingClientRect().height) : 60;
      document.documentElement.style.setProperty('--navbar-height', `${h}px`);
    };
    measureNavbar();
    // Re-measure on resize covers orientation change, fold/unfold, etc.
    window.addEventListener('resize', measureNavbar);
    return () => {
      window.removeEventListener('resize', measureNavbar);
      document.documentElement.style.removeProperty('--navbar-height');
    };
  }, []);

  const overlay = (
    <div
      className={[
        // ── Mobile: full-screen fixed overlay ─────────────────────────
        'fixed left-0 right-0 z-50',
        'flex overflow-hidden',
        'bg-[#070a13]',
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
      style={{
        // On mobile: start exactly below the Navbar (measured in useLayoutEffect).
        // Since --navbar-height includes env(safe-area-inset-top) from index.css padding-top,
        // we do NOT add env(safe-area-inset-top) here to avoid double-counting.
        top: isMobile ? 'calc(var(--visual-viewport-top, 0px) + var(--navbar-height, 60px))' : undefined,
      }}
    >
      {children}
    </div>
  );

  if (isMobile && mounted) {
    return createPortal(overlay, document.body);
  }

  return overlay;
};

