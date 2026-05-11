interface EyeProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function Eye({ size = 28, className = "", animated = true }: EyeProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="Tartalo"
    >
      <defs>
        <radialGradient id="tartalo-iris" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d97842" />
          <stop offset="55%" stopColor="#714325" />
          <stop offset="100%" stopColor="#1d170e" />
        </radialGradient>
        <radialGradient id="tartalo-wood" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#5d4a2e" />
          <stop offset="100%" stopColor="#1d170e" />
        </radialGradient>
        <filter id="tartalo-glow">
          <feGaussianBlur stdDeviation="1" />
        </filter>
      </defs>
      <path
        d="M2 32 C 14 12, 50 12, 62 32 C 50 52, 14 52, 2 32 Z"
        fill="url(#tartalo-wood)"
        stroke="#8c7045"
        strokeWidth="1.2"
      />
      <g className={animated ? "origin-center animate-iris" : ""}>
        <circle cx="32" cy="32" r="14" fill="url(#tartalo-iris)" />
        <circle cx="32" cy="32" r="14" fill="none" stroke="#d97842" strokeOpacity="0.4" strokeWidth="0.6" />
      </g>
      <g className={animated ? "animate-glance" : ""}>
        <circle cx="32" cy="32" r="6" fill="#100c07" />
        <circle cx="29.5" cy="29.5" r="1.8" fill="#efe3c8" opacity="0.9" />
      </g>
      <path
        d="M2 32 C 14 12, 50 12, 62 32"
        stroke="#efe3c8"
        strokeOpacity="0.18"
        strokeWidth="0.7"
        fill="none"
      />
      <path
        d="M2 32 C 14 52, 50 52, 62 32"
        stroke="#efe3c8"
        strokeOpacity="0.1"
        strokeWidth="0.5"
        fill="none"
      />
      {/* Brow / lash strokes */}
      <path d="M10 18 Q 18 12, 26 12" stroke="#5d4a2e" strokeWidth="0.7" fill="none" />
      <path d="M38 12 Q 46 12, 54 18" stroke="#5d4a2e" strokeWidth="0.7" fill="none" />
    </svg>
  );
}

export function EyeMark({ size = 18 }: { size?: number }) {
  return <Eye size={size} animated={false} />;
}
