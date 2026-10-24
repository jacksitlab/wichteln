import { useState } from 'react'

/** 45 animierte Schneeflocken (CSS-Keyframes, wie im Sketch A1). */
export function Snowfall() {
  const [flakes] = useState(() =>
    Array.from({ length: 45 }, (_, i) => {
      const size = 8 + Math.random() * 16
      return {
        glyph: ['\u2744', '\u2745', '\u2746'][i % 3],
        left: Math.random() * 100,
        fontSize: size,
        opacity: 0.25 + Math.random() * 0.5,
        duration: 7 + Math.random() * 12,
        delay: -Math.random() * 19,
      }
    }),
  )
  return (
    <div className="snow" aria-hidden="true">
      {flakes.map((f, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: '-5%',
            left: `${f.left}%`,
            fontSize: `${f.fontSize}px`,
            opacity: f.opacity,
            color: '#f4ead6',
            animation: `fall ${f.duration}s linear ${f.delay}s infinite`,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {f.glyph}
        </span>
      ))}
      <style>{`
        .snow { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        @keyframes fall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); }
          100% { transform: translate3d(-6vw, 110vh, 0) rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/** Weihnachtsbaum unten rechts (SVG, wie im Sketch A1). */
export function ChristmasTree() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 130"
      style={{
        position: 'fixed', bottom: '-8px', right: '-10px',
        width: 170, height: 'auto', opacity: 0.85,
        zIndex: 0, pointerEvents: 'none',
      }}
    >
      <polygon points="50,8 72,52 28,52" fill="#1e3a29" />
      <polygon points="50,30 80,84 20,84" fill="#234532" />
      <polygon points="50,56 88,116 12,116" fill="#1e3a29" />
      <rect x="44" y="116" width="12" height="12" fill="#5b4226" />
      <circle cx="50" cy="46" r="3" fill="#c8a24a" />
      <circle cx="38" cy="76" r="3" fill="#c8a24a" />
      <circle cx="64" cy="98" r="3" fill="#c8a24a" />
      <circle cx="50" cy="90" r="3" fill="#a4282c" />
    </svg>
  )
}

/** Schneemann oben rechts in der Wünsche-Karte (SVG, blinkt alle 5 s). */
export function Snowman() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 60 70"
      className="snowman"
      style={{
        position: 'absolute', top: 14, right: 16,
        width: 44, height: 'auto', pointerEvents: 'none',
      }}
    >
      <g>
        <circle cx="30" cy="52" r="16" fill="#f4ead6" />
        <circle cx="30" cy="26" r="11.5" fill="#f4ead6" />
        <circle cx="30" cy="44.5" r="14" fill="#f4ead6" />
        <circle cx="30" cy="42" r="1.6" fill="#14261c" />
        <circle cx="30" cy="48" r="1.6" fill="#14261c" />
        <circle cx="30" cy="54" r="1.6" fill="#14261c" />
        <g className="blink">
          <circle cx="26.5" cy="23" r="1.3" fill="#14261c" />
          <circle cx="33.5" cy="23" r="1.3" fill="#14261c" />
        </g>
        <polygon points="30,27 39,29 30,30.5" fill="#d98a3d" />
        <line x1="17" y1="41" x2="6" y2="32" stroke="#5b4226" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="43" y1="41" x2="54" y2="32" stroke="#5b4226" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="21" y="10.5" width="18" height="5" rx="1" fill="#2c2c2c" />
        <rect x="25" y="2" width="10" height="10" fill="#2c2c2c" />
        <rect x="25" y="8.5" width="10" height="2.4" fill="#c8a24a" />
        <rect x="22.5" y="34.5" width="15" height="4" rx="2" fill="#a4282c" />
        <rect x="37" y="36" width="3.6" height="9" rx="1.8" fill="#a4282c" />
      </g>
      <style>{`
        .blink { animation: blink 5s ease-in-out infinite; transform-origin: 30px 23px; }
        @keyframes blink { 0%, 90%, 100% { transform: scaleY(1); }
                            95% { transform: scaleY(0.1); } }
      `}</style>
    </svg>
  )
}
