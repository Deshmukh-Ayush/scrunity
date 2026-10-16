import { useId, type ReactNode, type SVGProps } from "react"

/**
 * Solid status icons for badges. The Hugeicons free set is Stroke Rounded
 * only (its solid styles are Pro), so these four are drawn in-house on the
 * same 24px grid: the circle is Hugeicons' r=10 circle, the triangle is the
 * outline of Hugeicons' Alert02. The shape fills with currentColor and the
 * inner detail is a real cutout (an SVG mask), not white paint, so the badge
 * or page behind shows through on any background.
 */
type StatusIconProps = Omit<SVGProps<SVGSVGElement>, "children" | "mask">

/** Cutout detail: stroked in black inside the mask, 2 units wide, round caps. */
const cut = {
  fill: "none",
  stroke: "black",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

function SolidStatusIcon({
  shape,
  cutout,
  ...props
}: StatusIconProps & { shape: (mask: string) => ReactNode; cutout: ReactNode }) {
  const maskId = `status-icon-${useId().replace(/[^\w-]/g, "")}`
  const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      {...props}
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" />
        {cutout}
      </mask>
      {shape(`url(#${maskId})`)}
    </svg>
  )
}

const circle = (mask: string) => <circle cx="12" cy="12" r="10" fill="currentColor" mask={mask} />

/** Verified, completed. */
export function CheckCircleSolid(props: StatusIconProps) {
  return <SolidStatusIcon {...props} shape={circle} cutout={<path d="M8 12.5L10.5 15L16 9" {...cut} />} />
}

/** Bounced, failed. */
export function XCircleSolid(props: StatusIconProps) {
  return <SolidStatusIcon {...props} shape={circle} cutout={<path d="M15 9L9 15M9 9L15 15" {...cut} />} />
}

/** Information. */
export function InfoCircleSolid(props: StatusIconProps) {
  return (
    <SolidStatusIcon
      {...props}
      shape={circle}
      cutout={
        <>
          <path d="M12 11V16.5" {...cut} />
          <circle cx="12" cy="7.75" r="1.25" fill="black" />
        </>
      }
    />
  )
}

/** Needs review, warning. */
export function AlertTriangleSolid(props: StatusIconProps) {
  return (
    <SolidStatusIcon
      {...props}
      shape={(mask) => (
        <path
          d="M13.9248 21H10.0752C5.44476 21 3.12955 21 2.27636 19.4939C1.42317 17.9879 2.60736 15.9914 4.97574 11.9985L6.90057 8.75333C9.17559 4.91778 10.3131 3 12 3C13.6869 3 14.8244 4.91777 17.0994 8.75332L19.0243 11.9985C21.3926 15.9914 22.5768 17.9879 21.7236 19.4939C20.8704 21 18.5552 21 13.9248 21Z"
          fill="currentColor"
          mask={mask}
        />
      )}
      cutout={
        <>
          <path d="M12 9.5V13.5" {...cut} />
          <circle cx="12" cy="16.75" r="1.25" fill="black" />
        </>
      }
    />
  )
}
