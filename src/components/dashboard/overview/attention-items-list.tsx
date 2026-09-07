"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  ClockCountdownIcon,
  FileTextIcon,
  ArrowUpRightIcon,
  ReceiptIcon,
} from "@phosphor-icons/react"

export interface AttentionItem {
  id: string
  projectId: string
  projectName: string
  title: string
  subtitle: string
  type: "invoice" | "deliverable" | "contract"
  priority: number
  badgeText: string
  badgeClass: string
  actionLabel: string
  href: string
}

export function AttentionItemsList({ items }: { items: AttentionItem[] }) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="divide-y divide-border/40 -mx-1">
      {items.map((item, index) => (
        <motion.div
          key={`${item.type}-${item.id}`}
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : {
                  duration: 0.22,
                  delay: Math.min(index * 0.035, 0.25),
                  ease: [0.16, 1, 0.3, 1],
                }
          }
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 px-2 hover:bg-muted/30 transition-colors rounded-sm"
        >
          {/* Left info */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0">
              {item.type === "invoice" && (
                <ReceiptIcon className="h-4 w-4 text-destructive" />
              )}
              {item.type === "deliverable" && (
                <ClockCountdownIcon className="h-4 w-4 text-amber-500" />
              )}
              {item.type === "contract" && (
                <FileTextIcon className="h-4 w-4 text-sky-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/projects/${item.projectId}`}
                  className="text-xs font-semibold text-foreground hover:underline truncate max-w-52"
                >
                  {item.projectName}
                </Link>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${item.badgeClass}`}
                >
                  {item.badgeText}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-foreground font-medium truncate max-w-md">
                {item.title}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {item.subtitle}
              </p>
            </div>
          </div>

          {/* Right CTA */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pl-7 sm:pl-0">
            <Link
              href={item.href}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-xs hover:bg-muted/60 active:scale-[0.96] transition-[background-color,transform] duration-150 origin-center"
            >
              <span>{item.actionLabel}</span>
              <ArrowUpRightIcon className="h-3 w-3 text-muted-foreground" />
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
