import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown, CheckCircle2, Copy, Edit2, MoreHorizontal, Trash2 } from "@/components/ui/icons"
import type { ShowcaseEntry, StateName } from "./types"

const TRIGGER_STATES: StateName[] = ["default", "hover", "focus-visible", "pressed", "disabled"]

export const cardEntry: ShowcaseEntry = {
  id: "card",
  name: "Card",
  group: "Display",
  description: "A flat surface in the page: white, 10px radius, shadow-surface instead of a border.",
  render: () => (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Northwind Analytics</CardTitle>
        <CardDescription>B2B analytics for logistics teams, 51–200 people.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Badge variant="success">
          <CheckCircle2 data-icon="inline-start" />
          Verified
        </Badge>
        <span className="text-body text-fg-muted tabular-nums">3 decision makers</span>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Open company</Button>
      </CardFooter>
    </Card>
  ),
}

function ExampleDialog(props: { "data-force"?: "hover" | "pressed" | "focus-visible"; disabled?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button {...props} />}>Archive campaign</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive this campaign?</DialogTitle>
          <DialogDescription>
            Sending stops and the campaign moves to Archived. You can restore it later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <DialogClose render={<Button variant="danger" />}>Archive campaign</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const dialogEntry: ShowcaseEntry = {
  id: "dialog",
  name: "Dialog",
  group: "Overlays",
  description: "Floats above the page: 12px radius, shadow-floating, transitions.dev modal motion.",
  render: () => <ExampleDialog />,
  states: [{ label: "trigger", supports: TRIGGER_STATES, render: (props) => <ExampleDialog {...props} /> }],
}

function ExampleMenu(props: { "data-force"?: "hover" | "pressed" | "focus-visible"; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button {...props} />}>
        <MoreHorizontal data-icon="inline-start" />
        Actions
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Campaign</DropdownMenuLabel>
          <DropdownMenuItem>
            <Edit2 />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy />
            Duplicate
            <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger">
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const dropdownMenuEntry: ShowcaseEntry = {
  id: "dropdown-menu",
  name: "DropdownMenu",
  group: "Overlays",
  description: "Menus grow from their trigger (transitions.dev menu dropdown). Items keep concentric radii.",
  render: () => <ExampleMenu />,
  states: [{ label: "trigger", supports: TRIGGER_STATES, render: (props) => <ExampleMenu {...props} /> }],
}
