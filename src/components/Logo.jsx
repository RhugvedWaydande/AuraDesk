// Logo.jsx — Aura's visual identity: a glowing gradient orb, drawn as inline
// SVG (no image files needed, scales perfectly at any size).
// Used in the header and as the agent's chat avatar.
export default function Logo({ size = 34, pulse = false }) {
  return (
    <span className={`aura-logo ${pulse ? 'pulse' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-label="Aura logo">
        <defs>
          <linearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id="auraGlow" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="21" fill="url(#auraGrad)" />
        <circle cx="24" cy="24" r="21" fill="url(#auraGlow)" />
        <path
          d="M24 12 L32.5 34 H28.6 L26.7 28.8 H21.3 L19.4 34 H15.5 Z M24 19.2 L22.4 25.4 H25.6 Z"
          fill="#0b0f1a"
          opacity="0.85"
        />
      </svg>
    </span>
  )
}
