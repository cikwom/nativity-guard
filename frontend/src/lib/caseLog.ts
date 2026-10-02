import type { Case, CaseTimelineEntry } from '@/types/api'

/**
 * What the reporter's case log shows, and what it withholds.
 *
 * These are rules, not formatting, which is why they live here beside
 * `status.ts` and `assignment.ts` rather than inside the component that renders
 * them: they are the frontend's answer to "what may a reporter read about their
 * own case", and that answer should be readable — and testable — on its own.
 * The sibling `components/case/activity.ts` does the adjacent job of turning
 * these entries into display text.
 *
 * **This is presentation, not access control.** `GET /cases/:id` returns the
 * reporter every timeline entry, descriptions and all, and the mock's
 * `canSeeCase` permits it. Withholding a field here means "did not render", not
 * "could not obtain". See `frontReadme.md` for the open question.
 */

/**
 * The status changes in a case's timeline, oldest first.
 *
 * Entries without a `status` are not status changes and are dropped — a log of
 * "what state did this case reach, and when" is a short, checkable list, whereas
 * everything-that-ever-happened invites padding it with notes written for
 * someone else.
 *
 * Oldest first, unlike the officer's progress feed: a log is read as a story
 * from the report forward.
 */
export function statusChangeEntries(entries: CaseTimelineEntry[]): CaseTimelineEntry[] {
  return entries
    .filter((entry) => Boolean(entry.status))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

/**
 * Who acted, as a role rather than a person.
 *
 * The timeline carries `user.name` and descriptions that name people outright —
 * the seeded robbery case reads "Assigned to Officer Tunde Balogun." Neither is
 * read. An id is enough to answer the reporter's actual question, which is *why
 * is a stranger touching my report*, and the answer is a role:
 *
 * - the reporter themselves → `'You'`
 * - the case's current assignee → `'Assigned officer'`
 * - anyone else → `'Unit staff'`
 *
 * The fallback is deliberately vague. `assignedTo` is the case's *current*
 * officer, so an entry written by someone since reassigned cannot be attributed
 * to them — and without reading `entry.user`, there is no other name to reach
 * for. Naming a person would mean reading a field that is withheld everywhere
 * else on this screen.
 */
export function actorLabel(entry: CaseTimelineEntry, caseItem: Case): string {
  if (entry.userId === caseItem.reportedBy) return 'You'
  if (caseItem.assignedTo && entry.userId === caseItem.assignedTo) return 'Assigned officer'
  return 'Unit staff'
}
