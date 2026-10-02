import { useEffect, useState } from 'react'
import { Info, LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { formatCoord } from '@/lib/format'
import type { UploadEvidenceInput } from '@/hooks/useEvidence'

const TYPES = [
  { value: 'image', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Document' },
]

interface FormState {
  type: string
  fileUrl: string
  description: string
  latitude: string
  longitude: string
}

const EMPTY: FormState = {
  type: 'image',
  fileUrl: '',
  description: '',
  latitude: '',
  longitude: '',
}

/**
 * Attach evidence to a case.
 *
 * The API takes a *hosted* `fileUrl` (there is no binary upload endpoint yet),
 * so the form collects a link and is explicit about that rather than offering
 * a file picker that could not complete. Coordinates default to the case's
 * recorded location and can be replaced with the device's own fix.
 */
export function EvidenceUpload({
  open,
  onClose,
  onSubmit,
  submitting = false,
  caseLatitude,
  caseLongitude,
  caseLocationLabel,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: Omit<UploadEvidenceInput, 'caseId'>) => void
  submitting?: boolean
  caseLatitude?: number
  caseLongitude?: number
  caseLocationLabel?: string
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  // Reset each time the dialog opens, seeding the case's own coordinates.
  useEffect(() => {
    if (!open) return
    setForm({
      ...EMPTY,
      latitude: caseLatitude !== undefined ? String(caseLatitude) : '',
      longitude: caseLongitude !== undefined ? String(caseLongitude) : '',
    })
    setError(null)
  }, [open, caseLatitude, caseLongitude])

  function useDeviceLocation() {
    if (!navigator.geolocation) {
      setError('This device does not report a location.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }))
        setLocating(false)
      },
      () => {
        setError('Location permission denied — enter coordinates manually.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  function submit() {
    const fileUrl = form.fileUrl.trim()
    if (!fileUrl) {
      setError('A link to the evidence file is required.')
      return
    }
    try {
      // Reject anything that is not a parseable absolute URL before it reaches the API.
      new URL(fileUrl)
    } catch {
      setError('That does not look like a valid link (include https://).')
      return
    }

    onSubmit({
      type: form.type,
      fileUrl,
      description: form.description.trim() || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attach evidence"
      description="Link a photo, recording or document to this case."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} onClick={submit}>
            Attach evidence
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 rounded-lg border border-border-hi bg-surface-hi p-3 text-xs text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
          <p>
            Evidence is referenced by link — file storage is not wired up on the API yet, so
            upload the media to your unit's storage and paste the link here.
          </p>
        </div>

        <Field label="Type" required>
          {(props) => (
            <Select
              {...props}
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
            >
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label="Evidence link"
          required
          error={error ?? undefined}
          hint="A direct, publicly reachable URL to the file."
        >
          {(props) => (
            <Input
              {...props}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={form.fileUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, fileUrl: event.target.value }))}
            />
          )}
        </Field>

        <Field label="Description" hint="What does this show, and why does it matter?">
          {(props) => (
            <Textarea
              {...props}
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          )}
        </Field>

        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-xs font-medium text-ink-muted">
            Where it was captured (optional)
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              {(props) => (
                <Input
                  {...props}
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, latitude: event.target.value }))
                  }
                />
              )}
            </Field>
            <Field label="Longitude">
              {(props) => (
                <Input
                  {...props}
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, longitude: event.target.value }))
                  }
                />
              )}
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-ink-faint">
              {caseLocationLabel
                ? `Case location: ${caseLocationLabel}`
                : `Case coordinates: ${formatCoord(caseLatitude, caseLongitude)}`}
            </p>
            <Button
              size="sm"
              variant="secondary"
              loading={locating}
              icon={<LocateFixed className="size-4" aria-hidden />}
              onClick={useDeviceLocation}
            >
              Use my location
            </Button>
          </div>
        </fieldset>
      </div>
    </Modal>
  )
}
