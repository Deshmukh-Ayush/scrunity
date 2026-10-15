import { Mail } from "@/components/ui/icons"
import { BRAND_STOPS, COLORS, CONTRAST_PAIRS, contrast, contrastVerdict } from "@/lib/design/tokens"

const SWATCHES: { token: string; hex: string; purpose: string }[] = [
  { token: "--canvas (--background)", hex: COLORS.canvas, purpose: "App background" },
  { token: "--surface", hex: COLORS.surface, purpose: "Cards, panels, popovers" },
  { token: "--muted-fill (--muted)", hex: COLORS.mutedFill, purpose: "Hover and selected fills" },
  { token: "--border-default", hex: COLORS.borderDefault, purpose: "Borders, dividers" },
  { token: "--border-strong", hex: COLORS.borderStrong, purpose: "Hover or emphasis borders" },
  { token: "--text-strong", hex: COLORS.textStrong, purpose: "Titles, primary content" },
  { token: "--text-default", hex: COLORS.textDefault, purpose: "Labels, UI text" },
  { token: "--text-muted", hex: COLORS.textMuted, purpose: "Descriptions, secondary text" },
  { token: "--text-subtle", hex: COLORS.textSubtle, purpose: "Placeholders, disabled only" },
  { token: "--brand", hex: COLORS.brand, purpose: "Brand buttons and focus rings" },
  { token: "--focus-ring-color", hex: COLORS.brand, purpose: "Every focus ring (= --brand)" },
  { token: "--success / -tint", hex: COLORS.success, purpose: `on ${COLORS.successTint}` },
  { token: "--warning / -tint", hex: COLORS.warning, purpose: `on ${COLORS.warningTint}` },
  { token: "--danger / -tint", hex: COLORS.danger, purpose: `on ${COLORS.dangerTint}` },
]

const TYPE_SCALE = [
  { cls: "text-title", spec: "24 / 32 · 600", use: "Page titles" },
  { cls: "text-composer", spec: "15 / 24 · 400", use: "Agent composer and responses" },
  { cls: "text-section", spec: "15 / 22 · 500", use: "Section labels" },
  { cls: "text-body", spec: "14 / 20 · 400", use: "Everything else" },
  { cls: "text-meta", spec: "12 / 16 · 500", use: "Badges, timestamps, hints" },
]

const RADII = [
  { cls: "rounded-sm", px: 6, use: "Badges, small controls" },
  { cls: "rounded-md", px: 8, use: "Buttons, inputs" },
  { cls: "rounded-lg", px: 10, use: "Cards, popovers, menus" },
  { cls: "rounded-xl", px: 12, use: "Composer, dialogs" },
]

const SHADOWS = [
  { cls: "shadow-surface", variable: "--border-shadow", use: "Flat surfaces in the page" },
  { cls: "shadow-raised", variable: "--shadow-border-sm", use: "Small raised controls" },
  { cls: "shadow-floating", variable: "--shadow-border", use: "Things above the page" },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-section text-fg-default">{title}</h3>
      {children}
    </section>
  )
}

export function Foundations() {
  return (
    <div className="flex w-full flex-col gap-10">
      <Section title="Color tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SWATCHES.map((s) => (
            <div key={s.token} className="flex items-center gap-3 rounded-lg bg-surface p-2 shadow-surface">
              <span className="size-9 shrink-0 rounded-md shadow-surface" style={{ background: s.hex }} />
              <div className="min-w-0">
                <p className="truncate font-mono text-meta text-fg-default">{s.token}</p>
                <p className="truncate text-meta text-fg-muted tabular-nums">
                  {s.hex} · {s.purpose}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-body text-fg-muted">
          Brand button stops: top {BRAND_STOPS.top}, base {BRAND_STOPS.base}, bottom {BRAND_STOPS.bottom}, edge{" "}
          {BRAND_STOPS.edge}.
        </p>
      </Section>

      <Section title="Contrast">
        <div className="overflow-x-auto rounded-lg bg-surface shadow-surface">
          <table className="w-full text-body">
            <tbody>
              {CONTRAST_PAIRS.map((pair) => {
                const ratio = contrast(pair.fg, pair.bg)
                const verdict = contrastVerdict(pair.rule, ratio)
                return (
                  <tr key={pair.name} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex h-6 items-center rounded-sm px-2 text-meta"
                        style={{ color: pair.fg, background: pair.bg, boxShadow: "var(--border-shadow)" }}
                      >
                        Aa
                      </span>
                    </td>
                    <td className="px-3 py-2 text-fg-default">{pair.name}</td>
                    <td className="px-3 py-2 text-right font-medium text-fg-strong tabular-nums">{ratio.toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-fg-muted">{verdict.label}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Type scale">
        <div className="flex flex-col gap-3">
          {TYPE_SCALE.map((t) => (
            <div key={t.cls} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className={`${t.cls} w-72 text-fg-strong`}>Find verified leads</span>
              <span className="font-mono text-meta text-fg-muted">
                {t.cls} · {t.spec} · {t.use}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Radii">
        <div className="flex flex-wrap gap-4">
          {RADII.map((r) => (
            <div key={r.cls} className="flex flex-col items-start gap-2">
              <div className={`${r.cls} size-16 bg-surface shadow-raised`} />
              <span className="text-meta text-fg-muted">
                {r.px}px · {r.use}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Depth">
        <div className="flex flex-wrap gap-6">
          {SHADOWS.map((s) => (
            <div key={s.cls} className={`${s.cls} flex w-56 flex-col gap-1 rounded-lg bg-surface p-4`}>
              <span className="text-body font-medium text-fg-strong">{s.cls}</span>
              <span className="font-mono text-meta text-fg-muted">{s.variable}</span>
              <span className="text-meta text-fg-muted">{s.use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Focus ring">
        <div className="flex flex-wrap items-center gap-6">
          <div className="focus-ring flex h-8 items-center rounded-md bg-surface px-3 text-body text-fg-default shadow-raised">
            focus-ring
          </div>
          <span className="text-meta text-fg-muted">
            2px --brand outline, 2px offset, follows the radius. 2.59:1 on white: accepted. focus-ring-inset draws it
            inside, for menu and list items.
          </span>
        </div>
      </Section>

      <Section title="Icon sizes">
        <div className="flex items-end gap-8 text-fg-default">
          {[
            { cls: "size-3.5", label: "14px · dense rows" },
            { cls: "size-4", label: "16px · default" },
            { cls: "size-5", label: "20px · large" },
          ].map((i) => (
            <div key={i.cls} className="flex flex-col items-center gap-2">
              <Mail className={i.cls} />
              <span className="text-meta text-fg-muted">{i.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Motion">
        <p className="text-body text-fg-muted">
          Micro-interactions: --motion-fast 150ms · base 200ms · slow 300ms; press scales to 0.96 over 150ms ease-out. Animations use the transitions.dev values: dropdown 250ms in / 150ms out, modal 250ms in / 150ms out from 0.96, tooltip 150ms in / 50ms out. Under reduced motion only a 150ms opacity fade remains.
        </p>
      </Section>
    </div>
  )
}
