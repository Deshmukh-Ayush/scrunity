import { cn } from "@/lib/utils"

/**
 * Original single-color line illustration: an open envelope with a letter
 * rising out of it, and a short stack of thread lines beside it. Strokes use
 * currentColor (set the color with a text-* token), scale to any width and
 * stay 1.5px thanks to non-scaling strokes. Decorative: aria-hidden.
 */
export function MailThreadsIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 112"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto w-40 text-fg-subtle", className)}
    >
      <g
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ vectorEffect: "non-scaling-stroke" }}
      >
        {/* Letter rising out of the envelope */}
        <path
          d="M30 58V22a4 4 0 0 1 4-4h40a4 4 0 0 1 4 4v36"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M38 30h24M38 38h32M38 46h18"
          vectorEffect="non-scaling-stroke"
        />
        {/* Envelope: back, opened flap folded behind, front pocket */}
        <path d="M20 52l34 24 34-24" vectorEffect="non-scaling-stroke" />
        <path
          d="M20 52v38a4 4 0 0 0 4 4h60a4 4 0 0 0 4-4V52"
          vectorEffect="non-scaling-stroke"
        />
        <path d="M20 90l26-20M88 90L62 70" vectorEffect="non-scaling-stroke" />
        {/* Thread lines: a short stack of replies */}
        <path d="M106 40h34" vectorEffect="non-scaling-stroke" />
        <path d="M106 50h24" vectorEffect="non-scaling-stroke" />
        <path d="M114 64h30" vectorEffect="non-scaling-stroke" />
        <path d="M114 74h18" vectorEffect="non-scaling-stroke" />
        <path d="M106 88h28" vectorEffect="non-scaling-stroke" />
        <circle
          cx={100}
          cy={40}
          r={1.5}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={108}
          cy={64}
          r={1.5}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={100}
          cy={88}
          r={1.5}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  )
}
