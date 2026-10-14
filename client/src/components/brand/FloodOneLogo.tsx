import React from 'react';

interface FloodOneLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export const FloodOneLogo: React.FC<FloodOneLogoProps> = ({
  className = '',
  size = 36,
  showText = true,
}) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div 
        className="relative flex items-center justify-center rounded-lg bg-surface border border-signal/40 shadow-sm shadow-signal/10 overflow-hidden"
        style={{ width: size, height: size }}
      >
        <svg 
          viewBox="0 0 48 48" 
          width={size * 0.85} 
          height={size * 0.85} 
          fill="none"
          aria-hidden="true"
        >
          {/* F-shaped river channels */}
          <path d="M10 8V40" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round"/>
          <path d="M10 12H38" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round"/>
          <path d="M10 24H28" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round"/>
          {/* Bridge crossings */}
          <line x1="22" y1="7" x2="22" y2="17" stroke="#F5A524" strokeWidth="3" strokeLinecap="round"/>
          <line x1="27" y1="7" x2="27" y2="17" stroke="#F5A524" strokeWidth="3" strokeLinecap="round"/>
          <line x1="18" y1="19" x2="18" y2="29" stroke="#F5A524" strokeWidth="3" strokeLinecap="round"/>
          {/* Urgent cutoff marker */}
          <circle cx="38" cy="12" r="3" fill="#E5484D" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-heading font-bold text-lg tracking-tight text-paper">
              Flood<span className="text-signal">One</span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-signal/10 text-signal border border-signal/20">
              v1.0 MVP
            </span>
          </div>
          <span className="text-[11px] text-muted tracking-tight font-medium">
            Flood Response Intelligence
          </span>
        </div>
      )}
    </div>
  );
};
