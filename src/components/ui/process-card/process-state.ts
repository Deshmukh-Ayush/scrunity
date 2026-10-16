/**
 * The ProcessCard's state machine. A process (a research run, an outreach
 * campaign) is always in exactly one of these states; the card derives every
 * visual (tile states, progress mode, motion, footer tone) from it.
 *
 * - idle: nothing is running right now (not started, or waiting for you)
 * - running: a stage is working and reported progress recently
 * - stalled: a stage should be working but has gone quiet
 * - failed: a stage stopped with an error
 * - done: every stage finished
 * - no-results: the process finished, but found nothing to continue with
 * - paused: the system stopped it (sending pauses when AI credits run out).
 *   Nothing lets a person pause or resume a run, so there is no pause control.
 * Callers derive the state from stored data; the transition table documents
 * the moves that data can make, and `isLegalTransition` lets a caller check one.
 */
export const PROCESS_STATES = [
  "idle",
  "running",
  "stalled",
  "failed",
  "done",
  "no-results",
  "paused",
] as const

export type ProcessState = (typeof PROCESS_STATES)[number]

export const PROCESS_TRANSITIONS: Record<ProcessState, readonly ProcessState[]> = {
  idle: ["running", "failed"],
  running: ["idle", "stalled", "failed", "done", "no-results", "paused"],
  stalled: ["running", "failed", "done", "no-results"],
  paused: ["running"],
  failed: ["running"],
  done: ["running"],
  "no-results": ["running"],
}

export function isLegalTransition(from: ProcessState, to: ProcessState) {
  return from === to || PROCESS_TRANSITIONS[from].includes(to)
}

/**
 * One stage tile. `empty` is the stage a no-results process ended on: it
 * finished, but produced nothing, so it is neither green nor an error.
 */
export type StageStatus = "idle" | "active" | "done" | "stalled" | "failed" | "empty" | "paused"

/**
 * Tile states for `total` stages when the process is on stage `current`
 * (0-based). Stages before it are done; the current one takes its look from
 * the process state; later ones are idle.
 */
export function stageStatuses(
  total: number,
  current: number,
  state: ProcessState
): StageStatus[] {
  return Array.from({ length: total }, (_, i) => {
    if (state === "done" || i < current) return "done"
    if (i > current) return "idle"
    switch (state) {
      case "stalled":
        return "stalled"
      case "failed":
        return "failed"
      case "no-results":
        return "empty"
      case "paused":
        return "paused"
      default:
        return "active"
    }
  })
}

/** Only a running process moves; every other state holds still. */
export function isMoving(state: ProcessState) {
  return state === "running"
}
