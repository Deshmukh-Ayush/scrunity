"use client"

import * as React from "react"
import { AgentComposer } from "@/components/chat/agent-composer"
import {
  SidebarGroup,
  SidebarItem,
  SidebarSectionLabel,
} from "@/components/shell/sidebar-item"
import { CreditsPill } from "@/components/shell/sidebar-content"
import { NAV_ITEMS } from "@/components/shell/nav-config"
import { Plus } from "@/components/ui/icons"

const PLACEHOLDER =
  "Describe who you want to reach, or ask about your campaigns"

/** A composer with its own text state, for the showcase. Sending only simulates the spinner. */
export function ComposerDemo({
  initialValue = "",
  sending = false,
  disabled = false,
  "data-force": dataForce,
}: {
  initialValue?: string
  sending?: boolean
  disabled?: boolean
  "data-force"?: "focus-visible"
}) {
  const [value, setValue] = React.useState(initialValue)
  const [busy, setBusy] = React.useState(false)
  return (
    <AgentComposer
      value={value}
      onValueChange={setValue}
      onSubmit={() => {
        setBusy(true)
        window.setTimeout(() => setBusy(false), 1200)
      }}
      sending={sending || busy}
      disabled={disabled}
      placeholder={PLACEHOLDER}
      data-force={dataForce}
      className="w-full min-w-72"
    />
  )
}

/** White selected-nav text, for comparing against the near-black default. */
export const WHITE_NAV_TEXT = {
  "--nav-selected-fg": "var(--brand-foreground)",
} as React.CSSProperties

/**
 * The sidebar as it sits in the shell: canvas background, one current item,
 * Chats open or closed. `selectedText="white"` swaps --nav-selected-fg for the
 * comparison on the testing route.
 */
export function SidebarDemo({
  chatsOpen = true,
  selectedText = "near-black",
}: {
  chatsOpen?: boolean
  selectedText?: "near-black" | "white"
}) {
  const [open, setOpen] = React.useState(chatsOpen)
  return (
    <div
      style={selectedText === "white" ? WHITE_NAV_TEXT : undefined}
      className="flex w-60 flex-col gap-5 rounded-lg border border-transparent bg-canvas p-3 shadow-surface"
    >
      <ul role="list" className="flex flex-col gap-px">
        {NAV_ITEMS.map((item, index) => (
          <li key={item.href}>
            <SidebarItem
              href="#sidebar"
              icon={item.icon}
              label={item.label}
              tone="nav"
              current={index === 0}
            />
          </li>
        ))}
      </ul>
      <SidebarGroup
        label="Chats"
        open={open}
        onOpenChange={setOpen}
        action={
          <span
            className="flex size-7 items-center justify-center text-fg-muted"
            aria-hidden="true"
          >
            <Plus className="size-4" />
          </span>
        }
      >
        <ul role="list" className="flex flex-col gap-px">
          {[
            "Logistics leads in Texas",
            "Why did the SaaS campaign stop?",
            "Draft a follow-up for Acme",
          ].map((title, index) => (
            <li key={title}>
              <SidebarItem
                href="#sidebar"
                label={title}
                current={index === 1}
                className="font-normal"
              />
            </li>
          ))}
        </ul>
      </SidebarGroup>
      <div>
        <SidebarSectionLabel>Section label (12/16)</SidebarSectionLabel>
      </div>
      <CreditsPill credits={1792} />
    </div>
  )
}

/** A Chats group with its own open state, for the testing route's states rows. */
export function GroupDemo({
  initialOpen = false,
  "data-force": dataForce,
}: {
  initialOpen?: boolean
  "data-force"?: "hover" | "focus-visible"
}) {
  const [open, setOpen] = React.useState(initialOpen)
  return (
    <div>
      <SidebarGroup
        label="Chats"
        open={open}
        onOpenChange={setOpen}
        data-force={dataForce}
      >
        <ul role="list" className="flex flex-col gap-px">
          <li>
            <SidebarItem
              href="#sidebar"
              label="Logistics leads in Texas"
              className="font-normal"
            />
          </li>
          <li>
            <SidebarItem
              href="#sidebar"
              label="Draft a follow-up for Acme"
              className="font-normal"
            />
          </li>
        </ul>
      </SidebarGroup>
    </div>
  )
}
