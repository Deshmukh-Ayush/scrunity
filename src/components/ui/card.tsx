import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cn } from "@/lib/utils"

/**
 * A flat surface in the page (better-ui surfaces):
 * - 10px radius, shadow-surface ring over a 1px transparent border (the border
 *   keeps an edge in forced-colors mode, which drops box-shadow).
 * - 16px padding (12px for size="sm"), 16px between sections.
 * - Header: optional 32px leading visual (logo or initials, 8px radius, 12px
 *   from the text), a text-section title and a quiet metadata row 2px below.
 * - Footer: actions, separated by a 1px divider.
 * - interactive: for clickable cards only. Hover lifts 1px and steps the ring
 *   up to shadow-floating over 150ms ease-out; static cards have no hover.
 *   Render it as the link itself: <Card interactive render={<Link href="…" />}>.
 *
 * Concentric radii: the footer and any full-bleed media sit flush (inset 0)
 * and inherit the card's corners through overflow-hidden. The leading visual
 * is not evenly inset (text sits beside it), so it keeps its own 8px token.
 */
function Card({
  className,
  size = "default",
  interactive = false,
  render,
  ...props
}: useRender.ComponentProps<"div"> & { size?: "default" | "sm"; interactive?: boolean }) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "group/card relative flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg border border-transparent bg-card py-(--card-spacing) text-body text-card-foreground shadow-surface outline-none",
          "[--card-spacing:--spacing(4)] data-[size=sm]:[--card-spacing:--spacing(3)]",
          "has-[>img:first-child]:pt-0",
          interactive &&
            "cursor-pointer transition-[box-shadow,translate,border-color] duration-150 ease-out motion-reduce:transition-none ui-hover:shadow-floating motion-safe:ui-hover:-translate-y-px ui-focus:focus-ring",
          className
        ),
      },
      props
    ),
    state: { slot: "card", size, interactive },
  })
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-0.5 px-(--card-spacing)",
        "has-data-[slot=card-leading]:grid-cols-[auto_1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

/** Small leading visual: a company logo (<img>) or initials. */
function CardLeading({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-leading"
      aria-hidden="true"
      className={cn(
        "col-start-1 row-span-2 row-start-1 flex size-8 items-center justify-center self-center overflow-hidden rounded-md bg-muted text-meta text-fg-default [&>img]:size-full [&>img]:object-contain",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "col-start-1 row-start-1 min-w-0 font-heading text-section text-fg-strong group-has-data-[slot=card-leading]/card-header:col-start-2",
        className
      )}
      {...props}
    />
  )
}

/** The quiet metadata row under the title. Separate items with <CardMetaDot />. */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn(
        "col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-1.5 text-body text-fg-muted tabular-nums group-has-data-[slot=card-leading]/card-header:col-start-2",
        className
      )}
      {...props}
    />
  )
}

function CardMetaDot() {
  return <span aria-hidden="true" className="size-0.75 rounded-full bg-fg-subtle" />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end group-has-data-[slot=card-leading]/card-header:col-start-3",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 border-t px-(--card-spacing) pt-(--card-spacing)", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardLeading,
  CardMetaDot,
}
