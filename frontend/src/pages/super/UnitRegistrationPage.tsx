import { useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LatLngTuple } from 'leaflet'
import { AlertTriangle, ChevronDown, MapPin, ShieldAlert } from 'lucide-react'
import { MapView } from '@/components/map/MapView'
import { BackLink } from '@/components/ui/BackLink'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useGeoLgas, useGeoStates } from '@/hooks/useGeo'
import { useLocation } from '@/hooks/useLocation'
import { useCreateUnit, type CreateUnitInput } from '@/hooks/useUnits'
import { ApiError } from '@/lib/apiClient'
import { cn } from '@/lib/cn'
import { formatCoord } from '@/lib/format'
import { UNIT_TYPES } from './UnitsRegistryPage'

/**
 * Registering a unit — the platform administrator's five-section form.
 *
 * One long form rather than a wizard, because the sections are an *envelope*:
 * the backend binds them in a single `POST /units` body
 * (`unit_handler.go:248-287`) and there is no draft endpoint to resume against.
 * A wizard here would hold a partially valid unit in component state with nothing
 * behind it, which is the same trap `ReportIncidentPage` documents for evidence
 * links — so the sections are collapsible, not sequential, and nothing is
 * submitted until the declaration.
 *
 * Three constraints from that contract shape the form, and each one is why a
 * particular piece of copy or a particular field is absent:
 *
 *  1. **Geography is validated server-side against a fixed dataset.** The backend
 *     rejects an unknown state or LGA with a 400 (`validateGeography`). So both
 *     are `<Select>`s fed by `GET /geo/states` and `GET /geo/lgas?state=` — the
 *     browser never offers a value the server would refuse. The LGA list is
 *     gated on a state being chosen, because the endpoint requires one.
 *  2. **Two questions the brief asked for have nowhere to go.** There is no
 *     `hqAddress` and no `commanderAddress` on `models.SecurityUnit`, and inventing
 *     a field is not an option without changing the contract. Both inputs are
 *     therefore collected and clearly labelled as paper-record only — the same
 *     honesty `Section D` applies to signatures and stamps. Collecting them
 *     silently and dropping them would be worse than not asking.
 *  3. **`permittedTools` is a JSON array stored in a string column**
 *     (`models/Unit.go:52`). The checkbox group serialises; nothing sends an
 *     array, which Go's decoder would reject.
 *
 * Validation is client-side and non-blocking: errors appear on blur, and the
 * submit button additionally requires a submission attempt before it names what
 * is missing — the same "do not block submit until the user attempts it" contract
 * the rest of the app holds to.
 */

/* ------------------------------------------------------------- vocabulary */

const PRIOR_EXPERIENCE = [
  { value: 'none', label: 'None' },
  { value: 'retired_police', label: 'Retired police officer' },
  { value: 'retired_military', label: 'Retired military' },
  { value: 'retired_civil_defence', label: 'Retired civil defence officer' },
  { value: 'other', label: 'Other' },
] as const

const SHIFT_PATTERNS = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
  { value: '24h', label: '24 hours' },
] as const

/**
 * `batons` is the contract's spelling of the first option, not `baton` — the
 * stored string is what an officer reads back on the unit record, and a
 * half-translated list is worse than a consistent one.
 */
const PERMITTED_TOOLS = [
  { value: 'batons', label: 'Baton' },
  { value: 'flashlights', label: 'Flashlight' },
  { value: 'radios', label: 'Radio' },
  { value: 'dane_guns', label: 'Dane gun' },
  { value: 'handcuffs', label: 'Handcuffs' },
  { value: 'none', label: 'None of these' },
] as const

const DANE_GUN = 'dane_guns'
const NO_TOOLS = 'none'

/* ------------------------------------------------------------------ state */

interface UnitFormDraft {
  // Section A — identity and geography
  name: string
  type: string
  formationDate: string
  registrationNumber: string
  state: string
  lga: string
  ward: string
  city: string
  contactEmail: string
  hqAddress: string
  latitude: string
  longitude: string
  operationalRadius: string
  coverageArea: string
  totalMembers: string
  // Section B — commander
  commanderName: string
  commanderNin: string
  commanderPhone: string
  commanderPhoneAlt: string
  commanderAddress: string
  commanderOccupation: string
  commanderPriorExperience: string
  // Section C — operational and equipment profile
  hasUniform: '' | 'yes' | 'no'
  uniformDescription: string
  shiftPattern: string
  permittedTools: string[]
  weaponsRegistered: boolean
  // Section D — traditional and local endorsement
  kindredHeadName: string
  kindredHeadPhone: string
  wardHeadName: string
  wardHeadPhone: string
  // Section E — declaration
  declared: boolean
}

const EMPTY_FORM: UnitFormDraft = {
  name: '',
  type: '',
  formationDate: '',
  registrationNumber: '',
  state: '',
  lga: '',
  ward: '',
  city: '',
  contactEmail: '',
  hqAddress: '',
  latitude: '',
  longitude: '',
  operationalRadius: '10',
  coverageArea: '',
  totalMembers: '',
  commanderName: '',
  commanderNin: '',
  commanderPhone: '',
  commanderPhoneAlt: '',
  commanderAddress: '',
  commanderOccupation: '',
  commanderPriorExperience: '',
  hasUniform: '',
  uniformDescription: '',
  shiftPattern: '',
  permittedTools: [],
  weaponsRegistered: false,
  // Section D — traditional and local endorsement
  kindredHeadName: '',
  kindredHeadPhone: '',
  wardHeadName: '',
  wardHeadPhone: '',
  declared: false,
}

type FormErrors = Partial<Record<keyof UnitFormDraft, string>>

/* ------------------------------------------------------------ validation */

/** Every digit in a value, so a formatted phone is judged on its digits alone. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * A NIN is 11 digits and nothing else.
 *
 * Checked digit-only *before* length, so a pasted `123 456 78901` is told what is
 * actually wrong with it instead of being told it is the wrong length.
 */
export function ninError(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  if (/\D/.test(trimmed)) return 'A NIN is digits only — no spaces, dashes or letters.'
  if (trimmed.length !== 11) return 'A NIN is 11 digits.'
  return undefined
}

/** 10–14 digits after stripping formatting, matching what the backend stores. */
export function phoneError(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const digits = digitsOf(trimmed)
  if (digits.length < 10 || digits.length > 14) return 'Enter between 10 and 14 digits.'
  return undefined
}

/**
 * `YYYY-MM-DD`.
 *
 * `<input type="date">` normally guarantees this, but a pasted value does not, and
 * the backend refuses anything else with a 400 (`parseFormationDate`).
 */
export function formationDateError(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Use the format YYYY-MM-DD.'
  return undefined
}

const MIN_RADIUS = 1
const MAX_RADIUS = 500

/**
 * Every client-side rule, in one pure function.
 *
 * Exported so it is pinnable without a DOM — this repo ships a `node` vitest
 * environment, and a rule buried inside a `useMemo` could not be tested at all.
 * Each entry is conditional rather than unconditional: a rule that fires on a
 * field nobody filled in is a rule that teaches the form to lie.
 */
export function validateUnitForm(form: UnitFormDraft): FormErrors {
  const errors: FormErrors = {}

  if (form.name.trim() === '') errors.name = 'Give the unit its official name.'
  if (form.type === '') errors.type = 'Choose the kind of unit this is.'
  if (form.state === '') errors.state = 'Choose a state.'
  if (form.lga === '') errors.lga = 'Choose a local government area.'

  if (form.hqAddress.trim() === '') {
    // Not required by the contract — but collected above, so it is asked for.
    errors.hqAddress = 'Enter the headquarters address, or note that it is held on paper only.'
  }

  const radius = Number(form.operationalRadius)
  if (!Number.isFinite(radius) || radius < MIN_RADIUS || radius > MAX_RADIUS) {
    errors.operationalRadius = `Between ${MIN_RADIUS} and ${MAX_RADIUS} km.`
  }

  const members = form.totalMembers.trim()
  if (members !== '' && (!/^\d+$/.test(members) || Number(members) < 0)) {
    errors.totalMembers = 'A whole number, or leave it blank.'
  }

  const nin = ninError(form.commanderNin)
  if (nin) errors.commanderNin = nin

  for (const [key, label] of [
    ['commanderPhone', 'Primary phone'],
    ['commanderPhoneAlt', 'Alternate phone'],
    ['kindredHeadPhone', 'Kindred head phone'],
    ['wardHeadPhone', 'Ward head phone'],
  ] as const) {
    const message = phoneError(form[key])
    if (message) errors[key] = `${label}: ${message}`
  }

  // Conditional on the answer, not merely present: a unit that says it wears no
  // uniform is not obliged to describe one.
  if (form.hasUniform === 'yes' && form.uniformDescription.trim() === '') {
    errors.uniformDescription = 'Describe the uniform, or say it wears none.'
  }

  const date = formationDateError(form.formationDate)
  if (date) errors.formationDate = date

  if (!form.declared) errors.declared = 'You have to confirm the declaration.'

  return errors
}

/* ---------------------------------------------------------------- payload */

/**
 * Draft → request body, dropping what was never answered.
 *
 * Empty strings are dropped rather than sent: the backend's `formationDate` and
 * the two booleans are pointers precisely so "absent" is distinguishable from
 * "explicitly empty" (`unit_handler.go:262-265`). A `shiftPattern` of `""` is
 * refused by `validateShiftPattern`, so an unanswered radio must not travel.
 */
export function buildUnitPayload(form: UnitFormDraft): CreateUnitInput {
  const text = (value: string) => (value.trim() === '' ? undefined : value.trim())
  const number = (value: string) => (value.trim() === '' ? undefined : Number(value))

  const hasUniform = form.hasUniform === 'yes' ? true : form.hasUniform === 'no' ? false : undefined
  const tools = normaliseTools(form.permittedTools)

  return {
    name: form.name.trim(),
    type: form.type,
    state: text(form.state),
    lga: text(form.lga),
    ward: text(form.ward),
    city: text(form.city),
    latitude: number(form.latitude),
    longitude: number(form.longitude),
    operationalRadius: number(form.operationalRadius) ?? MIN_RADIUS,
    coverageArea: text(form.coverageArea),
    contactPerson: text(form.commanderName),
    contactPhone: text(form.commanderPhone),
    contactEmail: text(form.contactEmail),
    registrationNumber: text(form.registrationNumber),
    formationDate: text(form.formationDate),
    totalMembers: number(form.totalMembers),

    commanderName: text(form.commanderName),
    commanderNin: text(form.commanderNin),
    commanderPhoneAlt: text(form.commanderPhoneAlt),
    commanderOccupation: text(form.commanderOccupation),
    commanderPriorExperience: text(form.commanderPriorExperience),

    hasUniform,
    uniformDescription: hasUniform ? text(form.uniformDescription) : undefined,
    shiftPattern: text(form.shiftPattern),
    permittedTools: tools.length > 0 ? JSON.stringify(tools) : undefined,
    weaponsRegistered: form.weaponsRegistered || undefined,

    kindredHeadName: text(form.kindredHeadName),
    kindredHeadPhone: text(form.kindredHeadPhone),
    wardHeadName: text(form.wardHeadName),
    wardHeadPhone: text(form.wardHeadPhone),
  }
}

/**
 * "None" is exclusive, not additive.
 *
 * Ticking "None of these" clears the rest rather than producing a list that says
 * both "nothing" and "radios" — a contradiction nobody should have to resolve.
 */
export function normaliseTools(selected: readonly string[]): string[] {
  if (selected.includes(NO_TOOLS)) return []
  return PERMITTED_TOOLS.map((tool) => tool.value).filter((value) => selected.includes(value))
}

/* ------------------------------------------------------------------- page */

export function UnitRegistrationPage() {
  const navigate = useNavigate()
  const { notify } = useToast()
  const createUnit = useCreateUnit()

  const states = useGeoStates()
  const [form, setForm] = useState<UnitFormDraft>(EMPTY_FORM)
  const lgas = useGeoLgas(form.state === '' ? null : form.state)

  const { latitude: userLat, longitude: userLng } = useLocation()

  /** Fields the officer has left, or tried to submit — the ones errors show for. */
  const [touched, setTouched] = useState<Set<keyof UnitFormDraft>>(() => new Set())
  const [attempted, setAttempted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const errors = useMemo(() => validateUnitForm(form), [form])
  const showError = (key: keyof UnitFormDraft) =>
    (touched.has(key) || attempted) ? errors[key] : undefined

  function update<K extends keyof UnitFormDraft>(key: K, value: UnitFormDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function markTouched(key: keyof UnitFormDraft) {
    setTouched((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
  }

  /**
   * Changing the state invalidates the LGA: an LGA of the old state is not an LGA
   * of the new one, and the browser only offers LGAs from the state's own list.
   * It is cleared silently because there is nothing to apologise for — the officer
   * has not typed it, and no stale value can survive into the payload.
   *
   * The pin is *not* cleared. `POST /units` does not validate coordinates against
   * the geography, and losing a carefully placed HQ to a one-field correction
   * would be a worse failure than the one this prevents.
   */
  function changeState(next: string) {
    setForm((current) => ({ ...current, state: next, lga: '' }))
  }

  function toggleTool(value: string) {
    setForm((current) => {
      let permittedTools: string[]
      if (current.permittedTools.includes(NO_TOOLS)) {
        // Anything ticked replaces "none" outright.
        permittedTools = value === NO_TOOLS ? [NO_TOOLS] : [value]
      } else if (current.permittedTools.includes(value)) {
        permittedTools = current.permittedTools.filter((item) => item !== value)
      } else if (value === NO_TOOLS) {
        permittedTools = [NO_TOOLS]
      } else {
        permittedTools = [...current.permittedTools, value]
      }
      // The DPO declaration belongs to the dane gun. Un-ticking the gun withdraws
      // the claim with it, so a stale `true` is never sent on a unit that no
      // longer says it holds a registered weapon.
      return {
        ...current,
        permittedTools,
        weaponsRegistered: permittedTools.includes(DANE_GUN)
          ? current.weaponsRegistered
          : false,
      }
    })
  }

  const hasPin = form.latitude !== '' && form.longitude !== ''

  const pick: LatLngTuple | null = hasPin
    ? [Number(form.latitude), Number(form.longitude)]
    : null

  /**
   * Where the map opens: the officer's own position when the device has already
   * reported one, otherwise `undefined` so `MapView` falls back to Lagos.
   *
   * Deliberately *not* the existing pin. `MapView` reads `center` only for its
   * initial view, so this cannot fight the officer panning after a pick — and
   * re-centring on every click would make the map impossible to place a pin on.
   * A fix that arrives later does not re-centre either: the registration is
   * about a place, not about where the person filling the form is standing.
   */
  const mapCenter: LatLngTuple | undefined =
    userLat != null && userLng != null ? [userLat, userLng] : undefined

  async function submit() {
    setAttempted(true)
    setSubmitError(null)

    if (Object.keys(errors).length > 0) {
      setSubmitError('Fix the highlighted fields before registering the unit.')
      return
    }

    try {
      await createUnit.mutateAsync(buildUnitPayload(form))
    } catch (error) {
      setSubmitError(registrationErrorMessage(error))
      return
    }

    notify('Unit registered', 'success')
    navigate('/super/units')
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <BackLink to="/super/units" label="Back to the unit registry" />

      <header className="mb-4 mt-3">
        <h1 className="text-xl font-semibold text-ink">Register a unit</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Five sections, saved as one record. Nothing is sent until you confirm on
          the last one, and the unit is created as unverified pending review.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Section
          step="A"
          title="Unit identity and geography"
          subtitle="Who the unit is and exactly where it operates."
          defaultOpen
          problems={countProblems(errors, ['name', 'type', 'state', 'lga', 'operationalRadius', 'hqAddress', 'totalMembers', 'formationDate'])}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              className="sm:col-span-2"
              label="Official name"
              required
              value={form.name}
              onChange={(v) => update('name', v)}
              onBlur={() => markTouched('name')}
              error={showError('name')}
              maxLength={160}
              placeholder="Otukpo Community Unit"
            />

            <SelectField
              label="Type of unit"
              required
              value={form.type}
              onChange={(v) => update('type', v)}
              onBlur={() => markTouched('type')}
              error={showError('type')}
              placeholder="Choose the kind of unit"
              options={UNIT_TYPES.map((option) => [option.value, option.label])}
            />

            <Field label="Date of formation" error={showError('formationDate')} hint="YYYY-MM-DD.">
              {({ id, ...aria }) => (
                <Input
                  id={id}
                  {...aria}
                  type="date"
                  value={form.formationDate}
                  onChange={(event) => update('formationDate', event.target.value)}
                  onBlur={() => markTouched('formationDate')}
                />
              )}
            </Field>

            <SelectField
              label="State"
              required
              value={form.state}
              onChange={changeState}
              onBlur={() => markTouched('state')}
              error={showError('state')}
              placeholder={states.isLoading ? 'Loading states…' : 'Choose a state'}
              options={(states.data ?? []).map((state) => [state.name, state.name])}
            />

            <SelectField
              label="Local government area"
              required
              disabled={form.state === '' || lgas.isLoading}
              value={form.lga}
              onChange={(v) => update('lga', v)}
              onBlur={() => markTouched('lga')}
              error={showError('lga')}
              hint={
                form.state === ''
                  ? 'Choose a state first — the list comes from the national dataset.'
                  : undefined
              }
              placeholder={
                form.state === ''
                  ? 'Choose a state first'
                  : lgas.isLoading
                    ? 'Loading areas…'
                    : 'Choose an LGA'
              }
              options={(lgas.data ?? []).map((name) => [name, name])}
            />

            <TextField
              label="Council ward or district"
              value={form.ward}
              onChange={(v) => update('ward', v)}
              maxLength={120}
              placeholder="Ward 4"
            />

            <TextField
              label="City or town"
              value={form.city}
              onChange={(v) => update('city', v)}
              maxLength={120}
              placeholder="Otukpo"
            />

            <TextField
              label="Registration number"
              value={form.registrationNumber}
              onChange={(v) => update('registrationNumber', v)}
              maxLength={60}
              placeholder="NG-UNIT-0001"
              hint="Optional. Leave it blank and one is generated — but the generated number has to be replaced with the real one."
            />

            <TextField
              label="Unit contact email"
              type="email"
              value={form.contactEmail}
              onChange={(v) => update('contactEmail', v)}
              maxLength={160}
              placeholder="unit@example.org"
            />

            <TextField
              className="sm:col-span-2"
              label="Primary HQ address"
              value={form.hqAddress}
              onChange={(v) => update('hqAddress', v)}
              onBlur={() => markTouched('hqAddress')}
              error={showError('hqAddress')}
              maxLength={200}
              placeholder="Along the Otukpo–Makurdi road, by the market junction"
              hint="Captured on the paper record at the LGA office. The unit record has no address field, so this is not stored in the app."
            />
          </div>

          {/* The pin is what the operations map plots, so it is asked for here
              rather than inferred from the address. */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ink-muted">
              HQ location on the map
            </span>
            <MapView
              mode="pick"
              height="40vh"
              allowLocate
              center={mapCenter}
              label="Pick the headquarters location of the unit"
              pickLocation={pick}
              onPickLocation={(lat, lng) =>
                setForm((current) => ({
                  ...current,
                  latitude: String(Number(lat.toFixed(6))),
                  longitude: String(Number(lng.toFixed(6))),
                }))
              }
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {hasPin ? (
                  <span className="tabular-nums">
                    {formatCoord(Number(form.latitude), Number(form.longitude))}
                  </span>
                ) : (
                  'No pin placed yet — the map falls back to Lagos until one is set.'
                )}
              </p>
              {hasPin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({ ...current, latitude: '', longitude: '' }))
                  }
                >
                  Clear pin
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Operational radius (km)"
              type="number"
              inputMode="numeric"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={form.operationalRadius}
              onChange={(v) => update('operationalRadius', v)}
              onBlur={() => markTouched('operationalRadius')}
              error={showError('operationalRadius')}
              hint={`How far the unit is expected to answer, ${MIN_RADIUS}–${MAX_RADIUS} km.`}
            />

            <TextField
              label="Total active members"
              type="number"
              inputMode="numeric"
              min={0}
              value={form.totalMembers}
              onChange={(v) => update('totalMembers', v)}
              onBlur={() => markTouched('totalMembers')}
              error={showError('totalMembers')}
              hint="Optional — leave blank if the roster is not counted yet."
            />

            <Field
              className="sm:col-span-2"
              label="Patrol zones and coverage areas"
              hint="Optional. Names or descriptions of the areas this unit is responsible for."
            >
              {({ id }) => (
                <Textarea
                  id={id}
                  rows={3}
                  value={form.coverageArea}
                  onChange={(event) => update('coverageArea', event.target.value)}
                  placeholder="Market junction, Otukpo township, and the Otu-Oku road up to the river."
                />
              )}
            </Field>
          </div>
        </Section>

        <Section
          step="B"
          title="Commander or leader"
          subtitle="The person accountable for the unit."
          problems={countProblems(errors, ['commanderNin', 'commanderPhone', 'commanderPhoneAlt'])}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full legal name"
              value={form.commanderName}
              onChange={(v) => update('commanderName', v)}
              maxLength={160}
              placeholder="Alhaji Bala Danjuma"
              hint="Also used as the unit's contact person."
            />

            <TextField
              label="NIN"
              inputMode="numeric"
              maxLength={11}
              value={form.commanderNin}
              onChange={(v) => update('commanderNin', v.replace(/\D/g, '').slice(0, 11))}
              onBlur={() => markTouched('commanderNin')}
              error={showError('commanderNin')}
              placeholder="11 digits"
            />

            <TextField
              label="Primary phone"
              type="tel"
              value={form.commanderPhone}
              onChange={(v) => update('commanderPhone', v)}
              onBlur={() => markTouched('commanderPhone')}
              error={showError('commanderPhone')}
              placeholder="0803 000 0000"
            />

            <TextField
              label="Alternate phone"
              type="tel"
              value={form.commanderPhoneAlt}
              onChange={(v) => update('commanderPhoneAlt', v)}
              onBlur={() => markTouched('commanderPhoneAlt')}
              error={showError('commanderPhoneAlt')}
              placeholder="Optional"
            />

            <TextField
              label="Residential address"
              value={form.commanderAddress}
              onChange={(v) => update('commanderAddress', v)}
              maxLength={200}
              hint="Kept on the paper record only — a home address is deliberately not stored in the app."
            />

            <TextField
              label="Occupation or livelihood"
              value={form.commanderOccupation}
              onChange={(v) => update('commanderOccupation', v)}
              maxLength={120}
              placeholder="Retired teacher"
            />

            <SelectField
              className="sm:col-span-2"
              label="Prior security experience"
              value={form.commanderPriorExperience}
              onChange={(v) => update('commanderPriorExperience', v)}
              options={PRIOR_EXPERIENCE.map((option) => [option.value, option.label])}
              placeholder="Optional"
            />
          </div>
        </Section>

        <Section
          step="C"
          title="Operational and equipment profile"
          subtitle="What the unit carries and when it is on duty."
          problems={countProblems(errors, ['uniformDescription'])}
        >
          <div className="flex flex-col gap-4">
            <RadioGroup
              legend="Does the unit wear a uniform?"
              name="unit-uniform"
              value={form.hasUniform}
              onChange={(v) => {
                update('hasUniform', v as UnitFormDraft['hasUniform'])
                if (v !== 'yes') update('uniformDescription', '')
              }}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
              ]}
            />

            {/* Only asked once the answer makes it a real question. */}
            {form.hasUniform === 'yes' ? (
              <Field
                label="Describe the uniform"
                required
                error={showError('uniformDescription')}
                hint="Colours, insignia, anything a member is identifiable by."
              >
                {({ id, ...aria }) => (
                  <Textarea
                    id={id}
                    {...aria}
                    rows={2}
                    value={form.uniformDescription}
                    onChange={(event) => update('uniformDescription', event.target.value)}
                    onBlur={() => markTouched('uniformDescription')}
                    placeholder="Green vest over a white shirt, with a red armband reading the unit's name."
                  />
                )}
              </Field>
            ) : null}

            <RadioGroup
              legend="Shift pattern"
              name="unit-shift"
              value={form.shiftPattern}
              onChange={(v) => update('shiftPattern', v)}
              options={SHIFT_PATTERNS.map((option) => ({ value: option.value, label: option.label }))}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="text-xs font-medium text-ink-muted">
                Permitted tools
              </legend>
              <div className="flex flex-wrap gap-2">
                {PERMITTED_TOOLS.map((tool) => {
                  const checked = form.permittedTools.includes(tool.value)
                  return (
                    <label
                      key={tool.value}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                        checked
                          ? 'border-signal/50 bg-signal/10 text-ink'
                          : 'border-border-hi bg-surface-hi text-ink-muted hover:text-ink',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTool(tool.value)}
                        className="size-4 shrink-0 accent-signal"
                      />
                      {tool.label}
                    </label>
                  )
                })}
              </div>
              <p className="text-[11px] text-ink-faint">
                Only the tools on this list are recorded as permitted. Anything
                else the unit is found carrying is not covered by this registration.
              </p>
            </fieldset>

            {/* The dane gun is the one item on the list that needs an authority
                behind it, so the declaration is required before it can be
                recorded at all — not merely discouraged. */}
            {form.permittedTools.includes(DANE_GUN) ? (
              <div className="flex flex-col gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-3">
                <p className="flex items-start gap-2 text-xs text-warn">
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="font-semibold">Dane gun use requires DPO
                    registration.</span> A unit may only carry one where the
                    local Division Police Officer has registered the weapon.
                  </span>
                </p>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.weaponsRegistered}
                    onChange={(event) => update('weaponsRegistered', event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-warn"
                  />
                  <span className="text-sm text-ink">
                    All local weapons registered with the DPO
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        </Section>

        <Section
          step="D"
          title="Traditional and local endorsement"
          subtitle="The community's own endorsement of the unit."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Kindred head or village chief"
              value={form.kindredHeadName}
              onChange={(v) => update('kindredHeadName', v)}
              maxLength={160}
            />

            <TextField
              label="Kindred head phone"
              type="tel"
              value={form.kindredHeadPhone}
              onChange={(v) => update('kindredHeadPhone', v)}
              onBlur={() => markTouched('kindredHeadPhone')}
              error={showError('kindredHeadPhone')}
            />

            <TextField
              label="Ward head or community leader"
              value={form.wardHeadName}
              onChange={(v) => update('wardHeadName', v)}
              maxLength={160}
            />

            <TextField
              label="Ward head phone"
              type="tel"
              value={form.wardHeadPhone}
              onChange={(v) => update('wardHeadPhone', v)}
              onBlur={() => markTouched('wardHeadPhone')}
              error={showError('wardHeadPhone')}
            />
          </div>

          <p className="rounded-lg border border-border-hi bg-surface-hi px-3 py-2 text-xs text-ink-muted">
            Signatures and stamps are captured at the LGA office. This is the
            digital record, and it is what a dispatcher reads.
          </p>
        </Section>

        <Section
          step="E"
          title="Declaration"
          subtitle="What you are agreeing to by registering this unit."
          defaultOpen
          problems={countProblems(errors, ['declared'])}
        >
          <label
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
              form.declared ? 'border-signal/50 bg-signal/10' : 'border-border-hi bg-surface-hi',
            )}
          >
            <input
              type="checkbox"
              checked={form.declared}
              onChange={(event) => update('declared', event.target.checked)}
              onBlur={() => markTouched('declared')}
              aria-invalid={Boolean(showError('declared'))}
              className="mt-0.5 size-4 shrink-0 accent-signal"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                I confirm the information is accurate and the unit commits to
                operating within the law and in cooperation with the Nigeria
                Police Force.
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                A false registration is grounds for removal from the registry, and
                the record is kept as a public document.
              </span>
            </span>
          </label>
          {showError('declared') ? (
            <p className="text-xs text-emergency">{showError('declared')}</p>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-emergency/30 bg-emergency/10 px-3 py-2 text-xs text-emergency"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <p>{submitError}</p>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border-hi pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => navigate('/super/units')}>
              Cancel
            </Button>
            {/*
              Disabled only *after* a failed attempt, and only while a client-side
              problem remains. Blocking from the first render would mean a
              five-section form opens with an inert button and no explanation of
              why; the first click is what turns the errors on, and from there the
              button frees itself as the answers are fixed.
            */}
            <Button
              variant="primary"
              loading={createUnit.isPending}
              disabled={attempted && Object.keys(errors).length > 0}
              onClick={() => void submit()}
              className="sm:min-w-44"
            >
              {createUnit.isPending ? 'Registering…' : 'Register unit'}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  )
}

/**
 * The copy for a refused registration.
 *
 * Three cases, three different sentences, because the remedy differs: a 400 is
 * the officer's own data and the backend's reason is the most useful thing on
 * screen; a 403 is a session that cannot do this at all, so nothing about the
 * form is wrong; anything else is a failure to retry, and saying so is more
 * honest than inventing a cause.
 */
function registrationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return `Validation error: ${error.message}`
    if (error.status === 403) return 'You do not have permission to register units'
  }
  return 'Could not register the unit. Try again.'
}

/* --------------------------------------------------------------- sections */

function countProblems(errors: FormErrors, keys: readonly (keyof UnitFormDraft)[]): number {
  return keys.filter((key) => errors[key]).length
}

/**
 * A collapsible section.
 *
 * A button with `aria-expanded` rather than a `<details>`: React re-applies the
 * `open` attribute on every render, so a `<details open={…}>` collapses itself
 * the moment anything on the page re-renders. The badge only ever *shows* a
 * problem, never hides the section — an answer the officer still has to read is
 * not a thing to be quietly removed.
 */
function Section({
  step,
  title,
  subtitle,
  defaultOpen = false,
  problems = 0,
  children,
}: {
  step: string
  title: string
  subtitle?: string
  defaultOpen?: boolean
  problems?: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-panel border border-border bg-surface shadow-panel">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-signal">
              {step}
            </span>
            <span className="text-sm font-semibold text-ink">{title}</span>
            {problems > 0 && !open ? (
              <span className="rounded-full bg-emergency/10 px-2 py-0.5 text-[11px] font-medium text-emergency ring-1 ring-emergency/30">
                {problems} to fix
              </span>
            ) : null}
          </span>
          {subtitle ? <span className="mt-0.5 block text-xs text-ink-muted">{subtitle}</span> : null}
        </span>
        <ChevronDown
          className={cn(
            'mt-0.5 size-4 shrink-0 text-ink-faint transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-4 border-t border-border p-4">{children}</div>
      ) : null}
    </section>
  )
}

/* ----------------------------------------------------------------- fields */

/**
 * The two field shapes the form repeats most, wrapped so 30-odd controls do not
 * each re-spell the same render-prop dance. Both are thin: every aria attribute
 * still comes from `Field`, so the markup is identical to writing it out.
 */
function TextField({
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  hint,
  className,
  ...rest
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  required?: boolean
  hint?: ReactNode
  className?: string
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur' | 'id'>) {
  return (
    <Field className={className} label={label} required={required} hint={hint} error={error}>
      {({ id, ...aria }) => (
        <Input
          id={id}
          {...rest}
          {...aria}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
    </Field>
  )
}

function SelectField({
  label,
  value,
  onChange,
  onBlur,
  error,
  required,
  hint,
  placeholder,
  options,
  className,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  required?: boolean
  hint?: ReactNode
  placeholder?: string
  options: readonly (readonly [string, string])[]
  className?: string
  disabled?: boolean
}) {
  return (
    <Field className={className} label={label} required={required} hint={hint} error={error}>
      {({ id, ...aria }) => (
        <Select
          id={id}
          {...aria}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        >
          {/* An explicit empty option: the value is required, so "nothing chosen"
              has to be a state the control can actually be in. */}
          <option value="">{placeholder ?? 'Not recorded'}</option>
          {options.map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </Select>
      )}
    </Field>
  )
}

/** A group of radios, rendered as a `fieldset` so the legend names the question. */
function RadioGroup({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string
  name: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-ink-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              value === option.value
                ? 'border-signal/50 bg-signal/10 text-ink'
                : 'border-border-hi bg-surface-hi text-ink-muted hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 shrink-0 accent-signal"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
