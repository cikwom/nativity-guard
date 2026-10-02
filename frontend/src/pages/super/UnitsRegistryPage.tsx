import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Plus, Search, ShieldQuestion } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chips'
import { Input, Select } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useGeoStates } from '@/hooks/useGeo'
import { useUnits } from '@/hooks/useUnits'
import { ApiError } from '@/lib/apiClient'
import { cn } from '@/lib/cn'
import type { SecurityUnit } from '@/types/api'

/**
 * The `type` values offered at registration, mirroring the registry's own list.
 *
 * The backend stores `type` as a plain string with no enum, so this is a
 * *suggestion* list, not a closed one: a row can carry a value added by another
 * build, and it renders as itself rather than as an empty cell.
 */
export const UNIT_TYPES = [
  { value: 'police', label: 'Police' },
  { value: 'vigilante', label: 'Vigilante' },
  { value: 'neighborhood_watch', label: 'Neighbourhood watch' },
  { value: 'community_watch', label: 'Community watch' },
  { value: 'other', label: 'Other' },
] as const

/**
 * The platform unit registry — every unit on the system, in one table.
 *
 * This replaces the `/super/units` demo stub, so what it shows is real data from
 * `GET /units` rather than the session-local sample set. The columns are the
 * questions a platform administrator actually opens this screen with: who is
 * registered, where, how large, and — the one that matters — whether they have
 * been verified yet.
 *
 * `isVerified` is the column that earns the screen. A unit created through
 * registration arrives `isVerified: false` with `verificationStatus: "pending"`
 * (`unit_handler.go:346-348`), so an unverified row is normal, not a fault, and
 * it is labelled as *pending* rather than as a failure.
 *
 * The detail route is not built yet, so a row links to it anyway and lands on the
 * "not built yet" page. A link that 404s would read as a broken screen; a link
 * that names what is missing reads as the truth.
 */
export function UnitsRegistryPage() {
  const navigate = useNavigate()
  const unitsQuery = useUnits()
  const states = useGeoStates()

  const [stateFilter, setStateFilter] = useState('')
  const [query, setQuery] = useState('')

  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data])

  const visible = useMemo(() => {
    let list = units
    if (stateFilter) list = list.filter((u) => u.state === stateFilter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((u) =>
        [u.name, u.city, u.lga, u.ward, u.registrationNumber]
          .filter(Boolean)
          .some((field) => field!.toLowerCase().includes(q)),
      )
    }
    return list
  }, [units, stateFilter, query])

  const verifiedCount = useMemo(() => units.filter((u) => u.isVerified).length, [units])

  return (
    <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Unit registry</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {units.length} unit{units.length === 1 ? '' : 's'} registered ·{' '}
            {verifiedCount} verified
            {unitsQuery.isFetching && !unitsQuery.isLoading ? ' · refreshing…' : ''}
          </p>
        </div>
        {/* A Button, not a Link wrapping one: an anchor around a button is a
            nested interactive element — invalid markup, and it breaks the focus
            order for exactly the officer who has to use it. */}
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => navigate('/super/units/new')}
        >
          Register new unit
        </Button>
      </header>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a unit by name, ward or registration number"
            aria-label="Search units"
            className="pl-9"
          />
        </div>

        <Select
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
          aria-label="Filter by state"
          className="sm:max-w-56"
        >
          <option value="">All states</option>
          {(states.data ?? []).map((state) => (
            <option key={state.name} value={state.name}>
              {state.name}
            </option>
          ))}
        </Select>
      </div>

      {unitsQuery.isLoading ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </Card>
      ) : unitsQuery.isError ? (
        <Card>
          <ErrorState
            title="Could not load the registry"
            description="The unit service did not respond. Your device may be offline."
            offline={ApiError.isNetwork(unitsQuery.error)}
            onRetry={() => void unitsQuery.refetch()}
          />
        </Card>
      ) : units.length === 0 ? (
        <Card>
          <EmptyState
            title="No units registered yet"
            description="Register the first unit to start the registry. Verification is reviewed separately after a unit is created."
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="size-4" aria-hidden />}
                onClick={() => navigate('/super/units/new')}
              >
                Register new unit
              </Button>
            }
          />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            title="No units match these filters"
            description="Clear the search, or set the state back to all states, to see more."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-ink-faint">
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">State</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">LGA</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Ward</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Members</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((unit) => (
                  <UnitRow key={unit.id} unit={unit} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {units.length > 0 && visible.length > 0 ? (
        <p className="mt-3 text-[11px] text-ink-faint">
          Showing {visible.length} of {units.length} unit{units.length === 1 ? '' : 's'}.
        </p>
      ) : null}
    </div>
  )
}

function UnitRow({ unit }: { unit: SecurityUnit }) {
  return (
    <tr className="transition-colors hover:bg-surface-hi">
      {/*
        The whole row is one link. A link per cell would put five tab stops in
        every row and read the same name five times to a screen reader; the row
        link is one target, and the cells stay plain text.
      */}
      <td className="px-4 py-2.5">
        <Link
          to={`/super/units/${unit.id}`}
          className="text-sm font-medium text-ink underline-offset-2 hover:text-signal hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {unit.name}
        </Link>
        {unit.registrationNumber ? (
          <span className="mt-0.5 block text-[11px] tabular-nums text-ink-faint">
            {unit.registrationNumber}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2.5 text-xs text-ink-muted">{unitType(unit.type)}</td>
      <td className="px-4 py-2.5 text-xs text-ink-muted">{unit.state || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-ink-muted">{unit.lga || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-ink-muted">{unit.ward || '—'}</td>
      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-ink-muted">
        {unit.totalMembers ?? '—'}
      </td>
      <td className="px-4 py-2.5">
        <VerificationBadge unit={unit} />
      </td>
    </tr>
  )
}

/**
 * "Pending" is a state, not a failure.
 *
 * The backend creates every unit with `isVerified: false` and
 * `verificationStatus: "pending"`, so a fresh registration is always amber until
 * somebody reviews it. Showing that as a failure would make every honest
 * registration look broken.
 */
function VerificationBadge({ unit }: { unit: SecurityUnit }) {
  if (unit.isVerified) {
    return (
      <Badge tone="ok">
        <CheckCircle2 className="size-3" aria-hidden />
        Verified
      </Badge>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
        unit.verificationStatus === 'rejected'
          ? 'bg-emergency/10 text-emergency ring-emergency/30'
          : 'bg-warn/10 text-warn ring-warn/30',
      )}
    >
      <ShieldQuestion className="size-3" aria-hidden />
      {unit.verificationStatus === 'rejected' ? 'Rejected' : 'Pending'}
    </span>
  )
}

/**
 * The unit `type` is a free-form string on the contract, so a row can carry a
 * value this build has never seen. `type` is therefore never used as the label:
 * an unknown value renders as itself rather than as a blank cell or a crash.
 */
function unitType(type: string): string {
  const label = UNIT_TYPES.find((option) => option.value === type)?.label
  return label ?? (type || '—')
}
