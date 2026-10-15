import { createCn } from "cn/config"

/**
 * clsx + tailwind-merge. The type-scale utilities from globals.css
 * (text-title … text-meta) are registered as font sizes; otherwise the merge
 * treats them as text colors and drops them when a color class follows.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["title", "composer", "section", "body", "meta"] }],
      shadow: [{ shadow: ["surface", "raised", "floating"] }],
    },
  },
})
