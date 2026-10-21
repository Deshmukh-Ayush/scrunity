import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { resolveAuthAndOrg } from "@/lib/gtm-auth"
import { getCsvImportMaxRows } from "@/lib/contact-import/limits"
import {
  importBlock,
  previewOf,
  readCsvFile,
  reviewFile,
  reviewResult,
  safeFileName,
} from "@/lib/contact-import/process"
import { listImports, loadOrgContactChecks, saveImport } from "@/lib/contact-import/store"
import type { ImportErrorBody } from "@/lib/contact-import/types"

/**
 * Imported lists (CSV). GET lists the organization's lists. POST takes a
 * multipart form with `file` and `intent`:
 * - preview: parse only; returns headers, the suggested mapping, 10 sample rows.
 * - review: dry run with `mapping`; returns counts and rejected rows. Nothing stored.
 * - import: the review again, `attested=true` required; stores the cleaned rows.
 * POST is owners and admins only (lib/api-role-policy.ts, enforced in the proxy).
 *
 * The file is held in memory for the request only. Row contents are personal
 * data: they go back only to the browser that sent them, and are never logged
 * (logs carry counts, ids and error names).
 */

const errorStatus: Record<ImportErrorBody["code"], number> = {
  not_csv: 415,
  too_large: 413,
  too_many_rows: 413,
  empty_file: 422,
  parse_error: 422,
  binary_file: 422,
  missing_identity: 422,
  duplicate_field: 422,
  attestation_required: 422,
  nothing_to_import: 422,
  import_failed: 500,
}

const failed = (error: ImportErrorBody) => NextResponse.json({ error }, { status: errorStatus[error.code] })

export async function GET() {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })
    return NextResponse.json({ imports: await listImports(auth.orgId) })
  } catch (err) {
    console.error("[GET /api/gtm/data-sources/imports] failed:", err instanceof Error ? err.name : "unknown error")
    return NextResponse.json({ error: "Imported lists didn't load. Try again." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth, error, status } = await resolveAuthAndOrg(await headers())
    if (error || !auth) return NextResponse.json({ error }, { status })

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return failed({ code: "parse_error", line: 1 })
    }
    const file = form.get("file")
    const intent = form.get("intent")
    if (!(file instanceof File)) return failed({ code: "not_csv" })
    if (intent !== "preview" && intent !== "review" && intent !== "import") {
      return NextResponse.json({ error: "Unknown intent" }, { status: 400 })
    }

    const fileName = safeFileName(file.name)
    const parsed = await readCsvFile(file, getCsvImportMaxRows())
    if (!parsed.ok) return failed(parsed.error)
    if (intent === "preview") return NextResponse.json(previewOf(fileName, parsed.value))

    let mapping: unknown = null
    try {
      mapping = JSON.parse(String(form.get("mapping") ?? "null"))
    } catch {
      mapping = null
    }
    const review = await reviewFile({
      parsed: parsed.value,
      mapping,
      loadChecks: (targets) => loadOrgContactChecks(auth.orgId, targets),
    })
    if (!review.ok) return failed(review.error)
    if (intent === "review") return NextResponse.json(reviewResult(fileName, parsed.value, review.value))

    const block = importBlock(review.value, form.get("attested") === "true")
    if (block) return failed(block)
    const importId = await saveImport({ organizationId: auth.orgId, userId: auth.userId, fileName, review: review.value })
    return NextResponse.json(reviewResult(fileName, parsed.value, review.value, importId), { status: 201 })
  } catch (err) {
    console.error("[POST /api/gtm/data-sources/imports] failed:", err instanceof Error ? err.name : "unknown error")
    return failed({ code: "import_failed" })
  }
}
