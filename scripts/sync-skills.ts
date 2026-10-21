/**
 * Copies the project's agent skills from .agents/skills/ (the source, written
 * by the skills CLI and pinned in skills-lock.json) into .claude/skills/,
 * where Claude Code looks for project skills.
 *
 *   npm run skills:sync
 *
 * Real copies, never symlinks: symlinks need Developer Mode on Windows. Each
 * skill folder in .claude/skills/ that also exists in .agents/skills/ is
 * replaced whole (an old symlink is removed, not followed). Folders that exist
 * only in .claude/skills/ are left alone and listed. No network.
 *
 * Why not the CLI: `skills add -a claude-code --copy` re-downloads every skill
 * from GitHub at its latest version, not the locked one, and
 * `skills experimental_install` (restore from the lock) writes only to
 * .agents/skills/. Run either of those first when you update skills, then this.
 */
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const source = path.join(root, ".agents", "skills")
const target = path.join(root, ".claude", "skills")

function skillDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .sort()
}

function main() {
  const skills = skillDirs(source).filter((name) => fs.existsSync(path.join(source, name, "SKILL.md")))
  if (skills.length === 0) {
    console.error(`No skills found in ${path.relative(root, source)}. Nothing copied.`)
    process.exit(1)
  }
  fs.mkdirSync(target, { recursive: true })
  for (const name of skills) {
    const dest = path.join(target, name)
    // rmSync removes a symlink itself and never deletes what it points to.
    fs.rmSync(dest, { recursive: true, force: true })
    fs.cpSync(path.join(source, name), dest, { recursive: true, dereference: true })
  }
  console.log(`Copied ${skills.length} skills into ${path.relative(root, target)}: ${skills.join(", ")}`)
  const extra = skillDirs(target).filter((name) => !skills.includes(name))
  if (extra.length > 0) console.log(`Left alone (not in .agents/skills): ${extra.join(", ")}`)
}

main()
