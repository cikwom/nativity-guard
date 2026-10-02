/**
 * The report wizard's draft: what survives a reload, and what does not.
 *
 * Whoever is filling this in is often mid-incident, on a phone, on a flaky
 * connection, and this is the longest form in the product. Losing it to a mistap
 * or a backgrounded tab is the difference between a report filed and a report
 * abandoned, so it is written to `localStorage` as it is typed.
 *
 * Three deliberate exclusions:
 *
 *  - **The step index is not stored.** A restored draft reopens at step 1.
 *    Persisting it would let an emptied draft resume on "Review", presenting a
 *    summary of nothing as if it were ready to send.
 *  - **A draft is not a report.** It has no tracking id and no unit has seen it.
 *    Nothing here is an offline submission queue — that is a real feature with
 *    real semantics (ordering, retry, dedupe) and this is not it. The UI must
 *    never let a saved draft read as "sent".
 *  - **No evidence files, only links.** There is no binary upload endpoint; a
 *    draft holds the same hosted URLs the eventual `POST /evidence/upload` gets.
 *
 * The storage functions take a `Storage`-shaped object rather than reaching for
 * the global, because that is the only way to exercise them in a node test — this
 * repo has no DOM environment. `reportDraftStorage()` is the one place that
 * touches the real thing.
 */

export const REPORT_DRAFT_KEY = 'cs.report.draft'

/** One hosted link staged in the wizard, before the case exists to attach it to. */
export interface DraftEvidenceLink {
  fileUrl: string
  /** Free-form on the backend; the wizard only offers conventional values. */
  type: string
}

export interface ReportDraft {
  title: string
  description: string
  /** The `priority: "high"` hint. Never SOS — see `CreateCaseInput`. */
  urgent: boolean
  location: string
  latitude: number | null
  longitude: number | null
  /** The unit the reporter asked for; honoured only if the id resolves. */
  unitId: string | null
  /** File anonymously: send a coarse geohash instead of precise coordinates. */
  hideLocation: boolean
  evidence: DraftEvidenceLink[]
}

export function emptyReportDraft(): ReportDraft {
  return {
    title: '',
    description: '',
    urgent: false,
    location: '',
    latitude: null,
    longitude: null,
    unitId: null,
    hideLocation: false,
    evidence: [],
  }
}

/**
 * True when there is nothing worth restoring.
 *
 * Whitespace is not content, and an evidence row with a type but no URL is not a
 * link — a draft made only of those is empty, so the "we restored your draft"
 * notice never appears over a blank form.
 */
export function isReportDraftEmpty(draft: ReportDraft): boolean {
  return (
    draft.title.trim() === '' &&
    draft.description.trim() === '' &&
    !draft.urgent &&
    draft.location.trim() === '' &&
    draft.latitude === null &&
    draft.longitude === null &&
    draft.unitId === null &&
    !draft.hideLocation &&
    draft.evidence.every((link) => link.fileUrl.trim() === '')
  )
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asCoordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Read a draft out of storage, or `null` when there is nothing trustworthy there.
 *
 * Storage is shared with every other script on the origin and outlives deploys, so
 * a value being *present* is not a value being *usable*. Anything of the wrong
 * shape returns `null` and the wizard opens fresh: a half-restored draft — a
 * number where the title goes — is worse than none, because the form would then
 * carry something the reporter never typed and cannot see.
 *
 * Unknown extra keys are simply ignored, so a draft written by an older build
 * still restores whatever still exists.
 */
export function parseReportDraft(raw: string | null): ReportDraft | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const value = parsed as Record<string, unknown>
  const latitude = asCoordinate(value.latitude)
  const longitude = asCoordinate(value.longitude)
  // Both or neither. A lone coordinate is not a location: the map pin, the
  // "nearby units" query and the create payload are all built from the pair, and
  // restoring half of one would put the pin at the equator.
  const hasPoint = latitude !== null && longitude !== null

  return {
    title: asString(value.title),
    description: asString(value.description),
    urgent: value.urgent === true,
    location: asString(value.location),
    latitude: hasPoint ? latitude : null,
    longitude: hasPoint ? longitude : null,
    unitId: typeof value.unitId === 'string' && value.unitId !== '' ? value.unitId : null,
    hideLocation: value.hideLocation === true,
    evidence: Array.isArray(value.evidence)
      ? value.evidence
          .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
          .map((row) => ({ fileUrl: asString(row.fileUrl), type: asString(row.type) }))
      : [],
  }
}

/** The subset of `Storage` this module needs, so tests need no DOM. */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function loadReportDraft(storage: DraftStorage | undefined): ReportDraft | null {
  if (!storage) return null
  try {
    return parseReportDraft(storage.getItem(REPORT_DRAFT_KEY))
  } catch {
    return null
  }
}

/** Write the draft, or clear it when there is nothing left to keep. */
export function saveReportDraft(storage: DraftStorage | undefined, draft: ReportDraft): void {
  if (!storage) return
  try {
    // An emptied form removes the key rather than storing `{}` — otherwise the
    // next visit claims to have restored a draft and shows a blank form.
    if (isReportDraftEmpty(draft)) storage.removeItem(REPORT_DRAFT_KEY)
    else storage.setItem(REPORT_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* storage unavailable (private mode) — the form still works, just not across reloads */
  }
}

export function clearReportDraft(storage: DraftStorage | undefined): void {
  if (!storage) return
  try {
    storage.removeItem(REPORT_DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * `localStorage` where it can be reached, `undefined` where it cannot.
 *
 * Even *resolving* the global can throw where storage is blocked (a sandboxed
 * iframe), which is why this is a function and not a module-level constant.
 */
export function reportDraftStorage(): DraftStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}
