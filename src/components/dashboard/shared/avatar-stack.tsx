"use client"

import Image from "next/image"

export interface AvatarMember {
  id: string
  name: string | null
  email: string
  image: string | null
}

export interface AvatarStackProps {
  members: AvatarMember[]
  max?: number
}

export function AvatarStack({ members, max = 3 }: AvatarStackProps) {
  return (
    <div className="flex -space-x-1.5 overflow-hidden">
      {members.slice(0, max).map((m) => (
        <div
          key={m.id}
          className="relative h-6 w-6 rounded-full border-2 border-background ring-1 ring-black/[0.08] dark:ring-white/[0.12] bg-muted overflow-hidden shrink-0"
          title={m.name || m.email}
        >
          {m.image ? (
            <Image src={m.image} alt={m.name || "User"} fill className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-brand bg-brand/10">
              {(m.name || m.email).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}
      {members.length > max && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background ring-1 ring-black/[0.08] dark:ring-white/[0.12] bg-muted text-[9px] font-medium text-muted-foreground shrink-0 tabular-nums">
          +{members.length - max}
        </div>
      )}
    </div>
  )
}
