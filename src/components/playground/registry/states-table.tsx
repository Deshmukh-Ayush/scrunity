import { STATE_NAMES, forcedStateProps, type StatesRow } from "./types"

/**
 * One row per variant, one column per state. States are forced with
 * data-force / disabled / loading, so every state is visible at once.
 */
export function StatesTable({ rows }: { rows: StatesRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg bg-surface shadow-surface">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left text-meta text-fg-muted" scope="col">
              <span className="sr-only">Variant</span>
            </th>
            {STATE_NAMES.map((state) => (
              <th key={state} scope="col" className="px-3 py-2 text-left text-meta whitespace-nowrap text-fg-muted">
                {state}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b last:border-0">
              <th scope="row" className="px-3 py-3 text-left font-mono text-meta font-normal text-fg-muted">
                {row.label}
              </th>
              {STATE_NAMES.map((state) => (
                <td key={state} className="px-3 py-3 align-middle">
                  {row.supports.includes(state) ? (
                    row.render(forcedStateProps(state))
                  ) : (
                    <span className="text-meta text-fg-subtle">n/a</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
