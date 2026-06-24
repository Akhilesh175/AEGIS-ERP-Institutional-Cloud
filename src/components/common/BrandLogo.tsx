/**
 * BrandLogo — Centralized AEGIS ERP branding component.
 *
 * This is the ONLY official logo component across the entire ERP ecosystem.
 * All portals, headers, sidebars, PDFs, certificates, and emails must consume
 * this component or the underlying asset path it exposes.
 *
 * Usage variants:
 *   <BrandLogo />                       — default (icon + full wordmark, md size)
 *   <BrandLogo variant="icon-only" />   — shield mark only (sidebar collapsed, favicons)
 *   <BrandLogo variant="full" />        — icon + "AEGIS ERP / INSTITUTIONAL CLOUD"
 *   <BrandLogo variant="horizontal" />  — compact header layout
 *
 * Size presets:
 *   xs | sm | md | lg | xl | 2xl
 *
 * DO NOT:
 *   • Recreate, redesign, or re-export this logo
 *   • Use Shield/lucide-react icons as logo substitutes
 *   • Create other BrandLogo components
 *   • Import the PNG directly outside of this component (use AEGIS_LOGO_URL instead)
 */

import React from 'react';
import aegisLogoSrc from '../../assets/branding/aegis-logo.png';

// ─── Exported constants ────────────────────────────────────────────────────────
/** Absolute URL to the master AEGIS ERP logo PNG. Use for Razorpay image, emails, PDF headers. */
export const AEGIS_LOGO_URL = '/aegis-logo.png';

/** Alt text to use on every logo <img> for accessibility compliance. */
export const AEGIS_LOGO_ALT = 'AEGIS ERP Institutional Cloud';

// ─── Types ────────────────────────────────────────────────────────────────────
export type BrandLogoVariant = 'icon-only' | 'horizontal' | 'full' | 'stacked';
export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface BrandLogoProps {
  /** Layout variant. Default: 'horizontal' */
  variant?: BrandLogoVariant;
  /** Size preset controlling icon dimensions. Default: 'md' */
  size?: BrandLogoSize;
  /** Extra Tailwind classes applied to the root wrapper */
  className?: string;
  /** Whether to show the tagline "Institutional Cloud" below the wordmark */
  showTagline?: boolean;
}

// ─── Size map ─────────────────────────────────────────────────────────────────
const ICON_SIZE_MAP: Record<BrandLogoSize, string> = {
  xs:  'h-6 w-6',
  sm:  'h-8 w-8',
  md:  'h-10 w-10',
  lg:  'h-12 w-12',
  xl:  'h-16 w-16',
  '2xl': 'h-20 w-20',
};

const WORDMARK_SIZE_MAP: Record<BrandLogoSize, { title: string; tagline: string }> = {
  xs:   { title: 'text-sm',  tagline: 'text-[8px]'  },
  sm:   { title: 'text-base', tagline: 'text-[9px]'  },
  md:   { title: 'text-lg',  tagline: 'text-[10px]' },
  lg:   { title: 'text-xl',  tagline: 'text-[11px]' },
  xl:   { title: 'text-2xl', tagline: 'text-xs'     },
  '2xl':{ title: 'text-3xl', tagline: 'text-sm'     },
};

// ─── Component ────────────────────────────────────────────────────────────────
export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showTagline = true,
}) => {
  const iconCls = ICON_SIZE_MAP[size];
  const { title: titleCls, tagline: taglineCls } = WORDMARK_SIZE_MAP[size];

  // Icon-only: just the shield mark
  if (variant === 'icon-only') {
    return (
      <img
        src={aegisLogoSrc}
        alt={AEGIS_LOGO_ALT}
        aria-label={AEGIS_LOGO_ALT}
        className={`${iconCls} object-contain select-none ${className}`}
        draggable={false}
      />
    );
  }

  // Stacked: icon centered above wordmark (login, splash, certificates)
  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`} aria-label={AEGIS_LOGO_ALT}>
        <img
          src={aegisLogoSrc}
          alt={AEGIS_LOGO_ALT}
          className={`${iconCls} object-contain select-none`}
          draggable={false}
        />
        <div className="text-center">
          <p className={`${titleCls} font-extrabold tracking-tight text-white leading-none`}>
            AEGIS <span className="text-brand-400 text-glow-brand">ERP</span>
          </p>
          {showTagline && (
            <p className={`${taglineCls} text-brand-300/70 uppercase tracking-widest font-bold font-mono mt-0.5`}>
              Institutional Cloud
            </p>
          )}
        </div>
      </div>
    );
  }

  // Full: icon + wordmark stacked in a more premium layout (dashboard hero)
  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`} aria-label={AEGIS_LOGO_ALT}>
        <img
          src={aegisLogoSrc}
          alt={AEGIS_LOGO_ALT}
          className={`${iconCls} object-contain select-none drop-shadow-[0_0_16px_rgba(14,160,235,0.5)]`}
          draggable={false}
        />
        <div className="text-center">
          <p className={`${titleCls} font-extrabold tracking-tight text-white leading-none`}>
            AEGIS <span className="text-brand-400 text-glow-brand font-light">ERP</span>
          </p>
          {showTagline && (
            <p className={`${taglineCls} text-brand-300/60 uppercase tracking-[0.3em] font-bold font-mono mt-1`}>
              — Institutional Cloud —
            </p>
          )}
        </div>
      </div>
    );
  }

  // Horizontal (default): icon left of wordmark — used in Navbar, Sidebar header
  return (
    <div className={`flex items-center gap-2.5 ${className}`} aria-label={AEGIS_LOGO_ALT}>
      <img
        src={aegisLogoSrc}
        alt={AEGIS_LOGO_ALT}
        className={`${iconCls} object-contain select-none flex-shrink-0`}
        draggable={false}
      />
      <div>
        <p className={`${titleCls} font-bold tracking-tight text-slate-100 leading-none`}>
          AEGIS <span className="text-brand-500 text-glow-brand font-medium">ERP</span>
        </p>
        {showTagline && (
          <p className={`${taglineCls} text-slate-400 uppercase tracking-widest font-semibold font-mono mt-0.5`}>
            Institutional Cloud
          </p>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
