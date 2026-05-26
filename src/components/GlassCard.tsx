import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`glass dark:glass-dark rounded-2xl p-6 transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-brand-500/30 hover:shadow-brand-500/5 hover:-translate-y-0.5' : ''} ${className}`}
    >
      {children}
    </div>
  );
};
