import { CanvasGroup, CanvasSlot } from "./canvas-group"
import { INVENTORY, type ComponentKind } from "./inventory"

const KIND_LABEL: Record<ComponentKind, string> = {
  client: "client",
  shared: "shared",
  data: "fetches data",
}

/** The component inventory: one group per folder, one slot per module. */
export function InventoryGroups() {
  return INVENTORY.map((group) => (
    <CanvasGroup
      key={group.id}
      id={`inventory-${group.id}`}
      title={`Inventory · ${group.title} (${group.entries.length})`}
      columns={3}
      className="w-full"
    >
      {group.entries.map((entry) => (
        <CanvasSlot key={entry.file}>
          <div className="flex w-full items-baseline justify-between gap-3">
            <span className="truncate font-mono text-xs text-foreground">{entry.file}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{KIND_LABEL[entry.kind]}</span>
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {entry.exports.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </CanvasSlot>
      ))}
    </CanvasGroup>
  ))
}
