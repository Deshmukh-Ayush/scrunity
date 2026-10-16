import { SHOWCASE } from "../registry"
import { StatesTable } from "../registry/states-table"
import { CanvasGroup, CanvasSlot } from "./canvas-group"

/** Every registered showcase component, with its states row, read from the shared registry. */
export function RegistryGroups() {
  return SHOWCASE.map((entry) => (
    <CanvasGroup key={entry.id} id={`registry-${entry.id}`} title={`${entry.group} · ${entry.name}`} columns={1} className="w-full">
      <CanvasSlot label={entry.description}>{entry.render()}</CanvasSlot>
      {entry.states && (
        <CanvasSlot label="states">
          <StatesTable rows={entry.states} />
        </CanvasSlot>
      )}
    </CanvasGroup>
  ))
}
