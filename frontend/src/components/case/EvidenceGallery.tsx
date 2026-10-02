import { useState } from 'react'
import {
  BadgeCheck,
  Clock,
  FileText,
  Film,
  ImageOff,
  MapPin,
  Music,
  ShieldQuestion,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatCoord, formatDateTime, relativeTime } from '@/lib/format'
import { Badge } from '@/components/ui/Chips'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Skeleton } from '@/components/ui/States'
import type { Evidence } from '@/types/api'

const TYPE_ICON: Record<string, typeof FileText> = {
  image: ImageOff,
  photo: ImageOff,
  video: Film,
  audio: Music,
  document: FileText,
}

function isImage(type: string | undefined): boolean {
  return type === 'image' || type === 'photo'
}

/**
 * Evidence gallery for a case. Verification is a separate, explicit action —
 * unverified items are never styled to look trustworthy.
 */
export function EvidenceGallery({
  evidence,
  isLoading = false,
  canVerify = false,
  onVerify,
  verifyingId,
  className,
}: {
  evidence: Evidence[]
  isLoading?: boolean
  /** Only the assigned officer / unit may verify. */
  canVerify?: boolean
  onVerify?: (id: string) => void
  verifyingId?: string | null
  className?: string
}) {
  const [preview, setPreview] = useState<Evidence | null>(null)

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 gap-3 p-4 sm:grid-cols-3', className)}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-4/3 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (evidence.length === 0) {
    return (
      <EmptyState
        icon={<ShieldQuestion className="size-5" aria-hidden />}
        title="No evidence attached"
        description="Photos, recordings and documents attached by officers or the reporter will be listed here."
      />
    )
  }

  const verified = evidence.filter((e) => e.isVerified).length

  return (
    <div className={cn('p-4', className)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="ok">
          <BadgeCheck className="size-3.5" aria-hidden />
          {verified} verified
        </Badge>
        <Badge>{evidence.length - verified} awaiting verification</Badge>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {evidence.map((item) => {
          const Icon = TYPE_ICON[item.type] ?? FileText
          return (
            <li
              key={item.id}
              className="flex flex-col overflow-hidden rounded-panel border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => setPreview(item)}
                className="group relative block aspect-4/3 w-full overflow-hidden bg-surface-hi text-left"
                aria-label={`Preview ${item.description || item.type} evidence`}
              >
                {isImage(item.type) ? (
                  <img
                    src={item.fileUrl}
                    alt={item.description || 'Case evidence'}
                    loading="lazy"
                    className="size-full object-cover transition-transform group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="grid size-full place-items-center text-ink-faint">
                    <Icon className="size-7" aria-hidden />
                  </span>
                )}
                <span className="absolute left-2 top-2">
                  {item.isVerified ? (
                    <Badge tone="ok" className="backdrop-blur">
                      <BadgeCheck className="size-3.5" aria-hidden />
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="warn" className="backdrop-blur">
                      <Clock className="size-3.5" aria-hidden />
                      Unverified
                    </Badge>
                  )}
                </span>
              </button>

              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <p className="line-clamp-2 text-xs font-medium text-ink">
                  {item.description || `${item.type} evidence`}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-ink-faint">
                  <MapPin className="size-3" aria-hidden />
                  {formatCoord(item.latitude, item.longitude)}
                </p>
                <time
                  dateTime={item.createdAt}
                  title={formatDateTime(item.createdAt)}
                  className="text-[11px] text-ink-faint"
                >
                  {relativeTime(item.createdAt)}
                </time>

                {canVerify && !item.isVerified && onVerify ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-1"
                    loading={verifyingId === item.id}
                    onClick={() => onVerify(item.id)}
                  >
                    Verify
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.description || `${preview?.type ?? ''} evidence`}
        description={
          preview
            ? `Attached ${formatDateTime(preview.createdAt)} · ${formatCoord(preview.latitude, preview.longitude)}`
            : undefined
        }
        size="lg"
        footer={
          preview ? (
            <a
              href={preview.fileUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-signal underline-offset-2 hover:underline"
            >
              Open original
            </a>
          ) : null
        }
      >
        {preview && isImage(preview.type) ? (
          <img
            src={preview.fileUrl}
            alt={preview.description || 'Case evidence'}
            className="mx-auto max-h-[60vh] rounded-lg object-contain"
          />
        ) : preview ? (
          <p className="text-sm text-ink-muted">
            This item is a {preview.type}. Use “Open original” to view it in a new tab.
          </p>
        ) : null}
      </Modal>
    </div>
  )
}
