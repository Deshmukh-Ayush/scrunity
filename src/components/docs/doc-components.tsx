// Shared UI primitives for the internal developer docs page.
// Extracted from docs/page.tsx to reduce component size.

export function Section({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-20">
      <h2 className="mb-4 border-b border-border/40 pb-2.5 text-[20px] font-bold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 text-[14px] font-semibold tracking-tight text-foreground/90">
      {children}
    </h3>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[14px] leading-[1.75] text-pretty text-muted-foreground">
      {children}
    </p>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted/50 px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">
      {children}
    </code>
  )
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-[10px] bg-muted/20 p-4 font-mono text-[12.5px] leading-[1.7] text-foreground/90 shadow-surface">
      <code>{children}</code>
    </pre>
  )
}

export function Table({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="my-3 overflow-x-auto rounded-[10px] shadow-surface">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b border-border/40 bg-muted/10 px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-muted-foreground/80 uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group transition-colors hover:bg-muted/10">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3.5 py-2 ${ri < rows.length - 1 ? "border-b border-border/30" : ""} ${ci === 0 ? "font-mono text-[12.5px] font-medium whitespace-nowrap text-foreground" : "text-[13px] text-muted-foreground"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 rounded-lg border border-warning-border bg-warning-tint px-4 py-3 text-[13px] leading-[1.6] text-warning">
      <strong className="font-semibold text-warning">
        Note:{" "}
      </strong>
      <span className="text-warning">
        {children}
      </span>
    </div>
  )
}
