import { Hammer } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'

/**
 * Honest placeholder for surfaces that are scheduled but not built. It names
 * the milestone rather than pretending the feature exists.
 */
export function ComingSoonPage({
  title,
  description,
  milestone,
}: {
  title: string
  description: string
  milestone?: string
}) {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <Card className="mt-4">
        <EmptyState
          icon={<Hammer className="size-5" aria-hidden />}
          title="Not built yet"
          description={description}
        />
        {milestone ? (
          <p className="border-t border-border px-4 py-3 text-center text-[11px] text-ink-faint">
            Planned in milestone {milestone} — see <code>frontend/frontReadme.md</code>.
          </p>
        ) : null}
      </Card>
    </div>
  )
}
