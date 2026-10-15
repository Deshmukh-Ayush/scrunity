import { Mail, Search, Sparkles, Target, Users } from "@/components/ui/icons"

const STARTER_PROMPTS = [
  {
    icon: Target,
    title: "Campaign Status",
    description: "Check execution stage and prospect counts across pipelines.",
    prompt: "What is the live status of our active outreach campaigns?",
  },
  {
    icon: Users,
    title: "Prospect Contacts",
    description:
      "Look up scraped decision-makers, titles, and verified emails.",
    prompt:
      "Find target prospect companies and contacts discovered by the agent",
  },
  {
    icon: Search,
    title: "Market Intelligence",
    description: "Review competitor domains and ICP segment positioning.",
    prompt: "Show discovered competitor positioning and market intelligence",
  },
  {
    icon: Mail,
    title: "Mailbox Status",
    description: "Verify Google Workspace or SMTP sending configuration.",
    prompt: "Check if our outbound sending mailbox is connected",
  },
]

/** Empty-conversation screen with one-click starter prompts. */
export function ChatWelcome({
  onPrompt,
}: {
  onPrompt: (prompt: string) => void
}) {
  return (
    <div className="flex flex-col items-center space-y-6 py-12 text-center md:py-20">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-xs">
        <Sparkles className="size-6" />
      </div>

      <div className="max-w-md space-y-1.5">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          How can I assist your GTM pipeline today?
        </h1>
        <p className="text-xs text-muted-foreground">
          Ask questions about your campaigns, look up verified contacts, or
          inspect market intelligence with live tool actions.
        </p>
      </div>

      <div className="grid w-full max-w-xl grid-cols-1 gap-2.5 pt-2 text-left sm:grid-cols-2">
        {STARTER_PROMPTS.map(({ icon: Icon, title, description, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="group rounded-xl border border-border/60 bg-muted/30 p-3 text-xs transition-all hover:border-border hover:bg-muted/70"
          >
            <div className="flex items-center gap-2 font-medium text-foreground group-hover:text-primary">
              <Icon className="size-3.5" />
              <span>{title}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
