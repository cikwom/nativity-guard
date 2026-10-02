/**
 * Mock seed data for local development (`VITE_USE_MOCKS=true`).
 *
 * Timestamps are generated relative to "now" so the ISO-week grouping, relative
 * times and "awaiting dispatch > 24h" logic all have something real to show.
 */

import type {
  Case,
  CaseFeedback,
  CaseOfficer,
  CaseReview,
  CaseTimelineEntry,
  CaseWeeklyUpdate,
  Evidence,
  Notification,
  Progress,
  SecurityUnit,
  UnitOfficer,
  User,
} from '@/types/api'
import { MOCK_ACCOUNTS, mockUid as uid } from './config'
import { startOfIsoWeekUtc } from '@/lib/week'

const now = Date.now()
const HOUR = 3_600_000
const DAY = 24 * HOUR

const iso = (ms: number) => new Date(ms).toISOString()
const hoursAgo = (n: number) => iso(now - n * HOUR)
const daysAgo = (n: number) => iso(now - n * DAY)

/**
 * The reporting week containing `ms`, as the backend computes it: Monday 00:00 UTC
 * to the following Sunday. Weekly-update seed data has to use the server's UTC week
 * or the mock would deduplicate on a different key than the real API.
 */
const week = (ms: number) => {
  const start = startOfIsoWeekUtc(new Date(ms))
  return {
    weekStart: start.toISOString(),
    weekEnd: new Date(start.getTime() + 6 * DAY).toISOString(),
  }
}

const OFFICER = MOCK_ACCOUNTS[0]
const ADMIN = MOCK_ACCOUNTS[1]
const CITIZEN = MOCK_ACCOUNTS[2]
const SUPER = MOCK_ACCOUNTS[3]

const UNIT_MAIN = uid('bbbb2222', 1)
const UNIT_ANNEX = uid('bbbb2222', 2)
const UNIT_RAPID = uid('bbbb2222', 3)

export const USERS: Record<string, User> = {
  [OFFICER.userId]: {
    id: OFFICER.userId,
    email: OFFICER.email,
    phone: '+2348011110001',
    firstName: 'Tunde',
    lastName: 'Balogun',
    role: 'officer',
    status: 'active',
    createdAt: daysAgo(400),
    updatedAt: hoursAgo(3),
  },
  [ADMIN.userId]: {
    id: ADMIN.userId,
    email: ADMIN.email,
    phone: '+2348011110002',
    firstName: 'Ngozi',
    lastName: 'Eze',
    role: 'unit_admin',
    status: 'active',
    createdAt: daysAgo(500),
    updatedAt: hoursAgo(10),
  },
  [CITIZEN.userId]: {
    id: CITIZEN.userId,
    email: CITIZEN.email,
    phone: '+2348011110003',
    firstName: 'Amaka',
    lastName: 'Obi',
    role: 'citizen',
    status: 'active',
    createdAt: daysAgo(120),
    updatedAt: hoursAgo(30),
  },
  [SUPER.userId]: {
    id: SUPER.userId,
    email: SUPER.email,
    phone: '+2348011110004',
    firstName: 'Ibrahim',
    lastName: 'Sule',
    role: 'super_admin',
    status: 'active',
    createdAt: daysAgo(700),
    updatedAt: hoursAgo(48),
  },
}

export const UNITS: SecurityUnit[] = [
  {
    id: UNIT_MAIN,
    name: 'Surulere Central Response Unit',
    type: 'response',
    latitude: 6.5001,
    longitude: 3.3543,
    operationalRadius: 4,
    state: 'Lagos',
    lga: 'Surulere',
    city: 'Lagos',
    coverageArea: 'Surulere, Yaba, Mushin',
    contactPerson: 'Ngozi Eze',
    contactPhone: '+2348011110002',
    contactEmail: 'admin@shield.ng',
    registrationNumber: 'CS-LAG-001',
    status: 'active',
    isVerified: true,
    verificationStatus: 'verified',
  },
  {
    id: UNIT_ANNEX,
    name: 'Mushin Annex Patrol',
    type: 'patrol',
    latitude: 6.5244,
    longitude: 3.3489,
    operationalRadius: 3,
    state: 'Lagos',
    lga: 'Mushin',
    city: 'Lagos',
    coverageArea: 'Mushin, Idi-Oro',
    contactPerson: 'Sade Lawal',
    contactPhone: '+2348011110005',
    status: 'active',
    isVerified: true,
    verificationStatus: 'verified',
  },
  {
    id: UNIT_RAPID,
    name: 'Island Rapid Deployment',
    type: 'rapid',
    latitude: 6.455,
    longitude: 3.3941,
    operationalRadius: 8,
    state: 'Lagos',
    lga: 'Lagos Island',
    city: 'Lagos',
    coverageArea: 'Lagos Island, Victoria Island, Ikoyi',
    contactPerson: 'Chris Adeniyi',
    contactPhone: '+2348011110006',
    status: 'active',
    isVerified: true,
    verificationStatus: 'verified',
  },
]

const CASE_IDS = {
  robbery: uid('cccc3333', 1),
  gunshots: uid('cccc3333', 2),
  breakIns: uid('cccc3333', 3),
  assault: uid('cccc3333', 4),
  vehicle: uid('cccc3333', 5),
  lights: uid('cccc3333', 6),
  loitering: uid('cccc3333', 7),
  flooding: uid('cccc3333', 8),
  workshop: uid('cccc3333', 9),
  smuggled: uid('cccc3333', 10),
  generator: uid('cccc3333', 11),
  // Assigned to the unit admin *and* awaiting their decision — the only seed that
  // makes the self-approval rule reachable in the demo. Without it the rule is
  // invisible until a real deployment produces the collision.
  selfreview: uid('cccc3333', 12),
  feedbackDemo: uid('cccc3333', 13),
}

export const CASE_LIST: Case[] = [
  {
    id: CASE_IDS.robbery,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Armed robbery in progress at Adeniran Ogunsanya Plaza',
    description:
      'Four men on two motorcycles are robbing traders at the entrance to the plaza. One is reported to be carrying a locally made rifle. Crowd is dispersing toward Bode Thomas.',
    incidentDate: hoursAgo(6),
    location: 'Adeniran Ogunsanya Plaza, Surulere, Lagos',
    latitude: 6.5009,
    longitude: 3.3524,
    status: 'on_scene',
    priority: 'critical',
    priorityLevel: 'P1',
    trackingId: 'CS-2026-0041',
    gisLatitude: 6.5009,
    gisLongitude: 3.3524,
    isPublic: true,
    assignedAt: hoursAgo(5.5),
    dispatchedAt: hoursAgo(5),
    arrivedAt: hoursAgo(4),
    closedAt: null,
    finalReport: '',
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(1),
  },
  {
    id: CASE_IDS.gunshots,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Gunshots heard near Oshodi transport interchange',
    description:
      'Series of gunshots heard from the direction of the overhead bridge. No casualties reported yet. Traders are closing stalls.',
    incidentDate: hoursAgo(20),
    location: 'Oshodi Interchange, Oshodi-Isolo, Lagos',
    latitude: 6.5556,
    longitude: 3.3372,
    status: 'dispatched',
    priority: 'critical',
    priorityLevel: 'P1',
    trackingId: 'CS-2026-0040',
    gisLatitude: 6.5556,
    gisLongitude: 3.3372,
    isPublic: true,
    assignedAt: hoursAgo(19),
    dispatchedAt: hoursAgo(18),
    arrivedAt: null,
    closedAt: null,
    finalReport: '',
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(18),
  },
  {
    id: CASE_IDS.breakIns,
    unitId: UNIT_ANNEX,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Repeated night break-ins at Yaba market stalls',
    description:
      'Six stalls broken into over the past three nights. Padlocks cut with a bolt cutter. Traders suspect the same group is returning.',
    incidentDate: daysAgo(3),
    location: 'Yaba Market, Yaba, Lagos',
    latitude: 6.5095,
    longitude: 3.3711,
    status: 'assigned',
    priority: 'high',
    priorityLevel: 'P2',
    trackingId: 'CS-2026-0039',
    gisLatitude: 6.5095,
    gisLongitude: 3.3711,
    isPublic: true,
    assignedAt: hoursAgo(30),
    dispatchedAt: null,
    arrivedAt: null,
    closedAt: null,
    finalReport: '',
    createdAt: daysAgo(4),
    updatedAt: hoursAgo(30),
  },
  {
    id: CASE_IDS.assault,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: null,
    title: 'Assault reported outside a bar on Bode Thomas Street',
    description:
      'A customer was attacked by two men after an argument over payment. The victim has been taken to a nearby clinic.',
    incidentDate: hoursAgo(10),
    location: 'Bode Thomas Street, Surulere, Lagos',
    latitude: 6.4967,
    longitude: 3.3567,
    status: 'pending',
    priority: 'high',
    priorityLevel: 'P2',
    trackingId: 'CS-2026-0038',
    gisLatitude: 6.4967,
    gisLongitude: 3.3567,
    isPublic: true,
    assignedAt: null,
    dispatchedAt: null,
    arrivedAt: null,
    closedAt: null,
    finalReport: '',
    createdAt: hoursAgo(10),
    updatedAt: hoursAgo(10),
  },
  {
    id: CASE_IDS.vehicle,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: null,
    title: 'Abandoned vehicle on the Third Mainland Bridge slip road',
    description:
      'A sedan with no plates has been parked on the slip road since yesterday evening, partially blocking the lane.',
    incidentDate: daysAgo(2),
    location: 'Third Mainland Bridge, Lagos',
    latitude: 6.4746,
    longitude: 3.4036,
    status: 'pending',
    priority: 'routine',
    priorityLevel: 'P3',
    trackingId: 'CS-2026-0037',
    gisLatitude: 6.4746,
    gisLongitude: 3.4036,
    isPublic: true,
    assignedAt: null,
    dispatchedAt: null,
    arrivedAt: null,
    closedAt: null,
    finalReport: '',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: CASE_IDS.lights,
    unitId: UNIT_ANNEX,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Vandalised street lights along Herbert Macaulay Way',
    description:
      'Eleven street light poles have had their control boxes forced open and cabling removed. The stretch is now unlit at night.',
    incidentDate: daysAgo(12),
    location: 'Herbert Macaulay Way, Yaba, Lagos',
    latitude: 6.5152,
    longitude: 3.3717,
    status: 'closed',
    priority: 'routine',
    priorityLevel: 'P3',
    trackingId: 'CS-2026-0031',
    gisLatitude: 6.5152,
    gisLongitude: 3.3717,
    isPublic: true,
    assignedAt: daysAgo(12),
    dispatchedAt: daysAgo(11),
    arrivedAt: daysAgo(11),
    closedAt: daysAgo(9),
    closedBy: OFFICER.userId,
    approvedBy: ADMIN.userId,
    finalReport:
      'Patrol identified two suspects who had been stripping cabling for resale. Both were handed to the divisional police. The LGA electrical board has been notified to restore the poles.',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(9),
  },
  {
    id: CASE_IDS.loitering,
    unitId: UNIT_RAPID,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Suspicious loitering near a primary school in Ikeja GRA',
    description:
      'Two men in an unmarked van have been parked outside the school gate for three mornings running, photographing pupils.',
    incidentDate: daysAgo(16),
    location: 'Ikeja GRA, Ikeja, Lagos',
    latitude: 6.5831,
    longitude: 3.3492,
    status: 'closed',
    priority: 'high',
    priorityLevel: 'P2',
    trackingId: 'CS-2026-0028',
    gisLatitude: 6.5831,
    gisLongitude: 3.3492,
    isPublic: false,
    assignedAt: daysAgo(16),
    dispatchedAt: daysAgo(15),
    arrivedAt: daysAgo(15),
    closedAt: daysAgo(14),
    closedBy: OFFICER.userId,
    approvedBy: ADMIN.userId,
    finalReport:
      'Vehicle traced to a parent with a disputed custody arrangement. No criminal intent established; the matter was referred to the family court liaison officer.',
    createdAt: daysAgo(16),
    updatedAt: daysAgo(14),
  },
  {
    id: CASE_IDS.flooding,
    unitId: UNIT_RAPID,
    reportedBy: CITIZEN.userId,
    assignedTo: null,
    title: 'Flash flooding blocking the road at Idumota market',
    description:
      'Drainage has overflowed and the road is impassable for saloon cars. Traders are moving goods to higher ground.',
    incidentDate: daysAgo(6),
    location: 'Idumota Market, Lagos Island, Lagos',
    latitude: 6.4616,
    longitude: 3.3876,
    status: 'assigned',
    priority: 'high',
    priorityLevel: 'P2',
    trackingId: 'CS-2026-0035',
    gisLatitude: 6.4616,
    gisLongitude: 3.3876,
    isPublic: true,
    assignedAt: daysAgo(6),
    dispatchedAt: null,
    arrivedAt: null,
    closedAt: null,
    finalReport: '',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
  },

  /* --- The review phase. These three exist so every state of the accountability
     loop is reachable in the demo without hand-editing data: an officer still
     investigating with no final report yet, a case waiting on an administrator,
     and a case an administrator has sent back with an instruction. --- */

  {
    id: CASE_IDS.workshop,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Firearms cache reported at a mechanic workshop on Ogunlana Drive',
    description:
      'A caller reports seeing rifles being moved into a workshop yard at night on three separate occasions. The workshop fronts as a panel-beating business.',
    incidentDate: daysAgo(4),
    location: 'Ogunlana Drive, Surulere, Lagos',
    latitude: 6.5003,
    longitude: 3.3489,
    status: 'investigating',
    priority: 'critical',
    priorityLevel: 'P1',
    trackingId: 'CS-2026-0042',
    gisLatitude: 6.5003,
    gisLongitude: 3.3489,
    isPublic: true,
    assignedAt: daysAgo(4),
    dispatchedAt: daysAgo(3),
    arrivedAt: daysAgo(3),
    closedAt: null,
    // Deliberately empty: this is the case that demonstrates the *explained*
    // refusal on "Submit for review" — the report is what the admin will judge.
    finalReport: '',
    createdAt: daysAgo(4),
    updatedAt: hoursAgo(6),
  },
  {
    id: CASE_IDS.smuggled,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Contraband goods offloaded at night at a warehouse on Apapa Road',
    description:
      'Unmarked lorries offload crates between 1am and 3am. Neighbours report armed men guarding the gate while the offloading happens.',
    incidentDate: daysAgo(9),
    location: 'Apapa Road, Ijora, Lagos',
    latitude: 6.4739,
    longitude: 3.3597,
    status: 'pending_admin_review',
    priority: 'high',
    priorityLevel: 'P2',
    trackingId: 'CS-2026-0036',
    gisLatitude: 6.4739,
    gisLongitude: 3.3597,
    isPublic: true,
    assignedAt: daysAgo(9),
    dispatchedAt: daysAgo(8),
    arrivedAt: daysAgo(8),
    closedAt: null,
    finalReport:
      'Observation post maintained from a neighbouring building across four nights. Two lorries matched the description; plates traced to a haulage company in Ijora. Goods were household appliances, not contraband. No armed presence observed on any of the four nights. Recommend closing with a referral to Customs for the unlicensed haulage.',
    createdAt: daysAgo(9),
    updatedAt: hoursAgo(5),
  },
  {
    id: CASE_IDS.generator,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Generator fuel being siphoned from the estate standpipe',
    description:
      'Fuel is being drawn from the estate generator at night and sold on. The estate has run out of diesel twice this month as a result.',
    incidentDate: daysAgo(14),
    location: 'Ojuelegba Estate, Surulere, Lagos',
    latitude: 6.5078,
    longitude: 3.3582,
    status: 'admin_changes_requested',
    priority: 'routine',
    priorityLevel: 'P3',
    trackingId: 'CS-2026-0033',
    gisLatitude: 6.5078,
    gisLongitude: 3.3582,
    isPublic: true,
    assignedAt: daysAgo(14),
    dispatchedAt: daysAgo(13),
    arrivedAt: daysAgo(13),
    closedAt: null,
    finalReport:
      'Watch kept on the generator house for two nights. One person was seen drawing fuel and carrying it off the estate. They have not been seen since.',
    createdAt: daysAgo(14),
    updatedAt: hoursAgo(8),
  },
  {
    /* A small unit where the administrator also carries a caseload: they
     * investigated this one themselves and cannot approve its closure. This is
     * exactly the collision the rule exists for, and the only way to see the
     * *explained* refusal without editing the seed. */
    id: CASE_IDS.selfreview,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: ADMIN.userId,
    title: 'Repeated vandalism of the street lighting on Ogunlana Drive',
    description:
      'Street lights along a 200-metre stretch have been smashed four times in six weeks. Residents report it happens after midnight and the same group is suspected.',
    incidentDate: daysAgo(21),
    location: 'Ogunlana Drive, Surulere, Lagos',
    latitude: 6.5011,
    longitude: 3.3497,
    status: 'pending_admin_review',
    priority: 'routine',
    priorityLevel: 'P3',
    /* Not `CS-2026-0028` — that reference belongs to the Ikeja loitering case
     * above. Two reports sharing a tracking ID is the one piece of demo data a
     * visitor might quote back at the app, and it was a copy-paste when this case
     * was seeded. */
    trackingId: 'CS-2026-0043',
    gisLatitude: 6.5011,
    gisLongitude: 3.3497,
    isPublic: true,
    assignedAt: daysAgo(21),
    dispatchedAt: daysAgo(20),
    arrivedAt: daysAgo(20),
    closedAt: null,
    finalReport:
      'Four incidents logged, all between 00:30 and 02:00 on weeknights. Two residents independently describe a group of three on a single motorcycle. A discarded ball peen hammer was recovered from the base of the fourth lamp and logged as evidence. No CCTV covers the stretch. Consider closing with a recommendation to the council for a lamp-post camera.',
    createdAt: daysAgo(21),
    updatedAt: hoursAgo(20),
  },
  {
    id: CASE_IDS.feedbackDemo,
    unitId: UNIT_MAIN,
    reportedBy: CITIZEN.userId,
    assignedTo: OFFICER.userId,
    title: 'Demo: resolved street sign obstruction',
    description: 'Sample closed report for trying the feedback form. This is not a real incident.',
    location: 'Sample location, Lagos',
    latitude: 6.5002,
    longitude: 3.3545,
    status: 'closed',
    priorityLevel: 'P3',
    trackingId: 'DEMO-2026-0001',
    gisLatitude: 6.5002,
    gisLongitude: 3.3545,
    isPublic: true,
    closedAt: daysAgo(1),
    finalReport: 'Sample report completed for demonstration.',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
  },
]

export const PROGRESS_LIST: Progress[] = [
  // Robbery (on scene) — spread across two ISO weeks so the Weekly view has shape.
  {
    id: uid('dddd4444', 1),
    caseId: CASE_IDS.robbery,
    officerId: OFFICER.userId,
    action: 'progress',
    description: 'Two patrol vehicles deployed to the plaza. Crowd being moved back from the entrance.',
    createdAt: hoursAgo(5),
  },
  {
    id: uid('dddd4444', 2),
    caseId: CASE_IDS.robbery,
    officerId: OFFICER.userId,
    action: 'checkpoint',
    description: 'Cordon set at the Bode Thomas junction. Statements taken from three traders.',
    createdAt: hoursAgo(4),
  },
  {
    id: uid('dddd4444', 3),
    caseId: CASE_IDS.robbery,
    officerId: OFFICER.userId,
    action: 'interview',
    description: 'Plaza CCTV pulled — footage shows the two motorcycles heading toward Mushin. Copy handed to the analyst.',
    createdAt: hoursAgo(2),
  },
  {
    id: uid('dddd4444', 5),
    caseId: CASE_IDS.robbery,
    officerId: OFFICER.userId,
    action: 'patrol',
    description: 'Night sweep of the plaza and adjoining streets. No further sightings.',
    createdAt: daysAgo(6),
  },
  {
    id: uid('dddd4444', 6),
    caseId: CASE_IDS.lights,
    officerId: OFFICER.userId,
    action: 'progress',
    description: 'Two suspects detained near the substation with 40 metres of stripped cable.',
    createdAt: daysAgo(10),
  },
  {
    id: uid('dddd4444', 7),
    caseId: CASE_IDS.gunshots,
    officerId: OFFICER.userId,
    action: 'progress',
    description: 'En route from Surulere, ETA eight minutes. Requesting backup at the interchange.',
    createdAt: hoursAgo(18),
  },
  {
    id: uid('dddd4444', 8),
    caseId: CASE_IDS.workshop,
    officerId: OFFICER.userId,
    action: 'observation',
    description: 'Observation post set up opposite the workshop yard. Two nights covered, no movement after 22:00.',
    createdAt: hoursAgo(30),
  },
  {
    id: uid('dddd4444', 9),
    caseId: CASE_IDS.workshop,
    officerId: OFFICER.userId,
    action: 'interview',
    description: 'Took a statement from the neighbouring business owner who made the report. They will keep a written log.',
    createdAt: hoursAgo(6),
  },
  {
    id: uid('dddd4444', 10),
    caseId: CASE_IDS.smuggled,
    officerId: OFFICER.userId,
    action: 'observation',
    description: 'Four-night observation completed. Lorry plates recorded and passed to the analyst.',
    createdAt: hoursAgo(28),
  },
]

export const TIMELINE_LIST: CaseTimelineEntry[] = [
  {
    id: uid('eeee5555', 1),
    caseId: CASE_IDS.robbery,
    userId: CITIZEN.userId,
    action: 'case_created',
    description: 'Report submitted from the mobile app.',
    status: 'pending',
    createdAt: hoursAgo(6),
    user: USERS[CITIZEN.userId],
  },
  {
    id: uid('eeee5555', 2),
    caseId: CASE_IDS.robbery,
    userId: ADMIN.userId,
    action: 'case_assigned',
    description: 'Assigned to Officer Tunde Balogun.',
    status: 'assigned',
    createdAt: hoursAgo(5.5),
    user: USERS[ADMIN.userId],
  },
  {
    id: uid('eeee5555', 3),
    caseId: CASE_IDS.robbery,
    userId: OFFICER.userId,
    action: 'dispatched',
    description: 'Officer dispatched from Surulere Central.',
    status: 'dispatched',
    createdAt: hoursAgo(5),
    user: USERS[OFFICER.userId],
  },
  {
    id: uid('eeee5555', 4),
    caseId: CASE_IDS.robbery,
    userId: OFFICER.userId,
    action: 'arrived',
    description: 'Officer arrived on scene.',
    status: 'on_scene',
    createdAt: hoursAgo(4),
    user: USERS[OFFICER.userId],
  },
  {
    id: uid('eeee5555', 5),
    caseId: CASE_IDS.gunshots,
    userId: CITIZEN.userId,
    action: 'case_created',
    description: 'Report submitted from the mobile app.',
    status: 'pending',
    createdAt: hoursAgo(20),
    user: USERS[CITIZEN.userId],
  },
  {
    id: uid('eeee5555', 6),
    caseId: CASE_IDS.gunshots,
    userId: OFFICER.userId,
    action: 'dispatched',
    description: 'Officer dispatched.',
    status: 'dispatched',
    createdAt: hoursAgo(18),
    user: USERS[OFFICER.userId],
  },
  {
    /* The closure is one event, not two. `POST /cases/:id/review/approve` writes a
     * single `closure_approved` entry with status `closed`; this case previously
     * also carried a separate `closed` entry, which put two rows on the same
     * record zero seconds apart on the reporter's case log. */
    id: uid('eeee5555', 8),
    caseId: CASE_IDS.lights,
    userId: ADMIN.userId,
    action: 'closure_approved',
    description: 'Closure approved by Ngozi Eze.',
    status: 'closed',
    createdAt: daysAgo(9),
    user: USERS[ADMIN.userId],
  },
  {
    id: uid('eeee5555', 9),
    caseId: CASE_IDS.workshop,
    userId: CITIZEN.userId,
    action: 'case_created',
    description: 'Report submitted from the mobile app.',
    status: 'pending',
    createdAt: daysAgo(4),
    user: USERS[CITIZEN.userId],
  },
  {
    id: uid('eeee5555', 10),
    caseId: CASE_IDS.workshop,
    userId: OFFICER.userId,
    action: 'arrived',
    description: 'Officer arrived on scene.',
    status: 'on_scene',
    createdAt: daysAgo(3),
    user: USERS[OFFICER.userId],
  },
  {
    id: uid('eeee5555', 11),
    caseId: CASE_IDS.workshop,
    userId: OFFICER.userId,
    action: 'investigating',
    description: 'Investigation opened. Observation and enquiries under way.',
    status: 'investigating',
    createdAt: daysAgo(3),
    user: USERS[OFFICER.userId],
  },
  {
    id: uid('eeee5555', 12),
    caseId: CASE_IDS.smuggled,
    userId: ADMIN.userId,
    action: 'changes_requested',
    description: 'Closure not approved — the administrator asked for more detail.',
    status: 'admin_changes_requested',
    createdAt: daysAgo(2),
    user: USERS[ADMIN.userId],
  },
  {
    id: uid('eeee5555', 13),
    caseId: CASE_IDS.smuggled,
    userId: OFFICER.userId,
    action: 'submitted_for_review',
    description: 'Final report resubmitted for closure approval.',
    status: 'pending_admin_review',
    createdAt: hoursAgo(5),
    user: USERS[OFFICER.userId],
  },
  {
    id: uid('eeee5555', 14),
    caseId: CASE_IDS.generator,
    userId: OFFICER.userId,
    action: 'submitted_for_review',
    description: 'Final report submitted for closure approval.',
    status: 'pending_admin_review',
    createdAt: daysAgo(3),
    user: USERS[OFFICER.userId],
  },
  {
    id: uid('eeee5555', 15),
    caseId: CASE_IDS.generator,
    userId: ADMIN.userId,
    action: 'changes_requested',
    description: 'Closure not approved — the administrator asked for the follow-up on the suspect.',
    status: 'admin_changes_requested',
    createdAt: hoursAgo(8),
    user: USERS[ADMIN.userId],
  },
  {
    id: uid('eeee5555', 16),
    caseId: CASE_IDS.selfreview,
    userId: CITIZEN.userId,
    action: 'case_created',
    description: 'Report submitted from the mobile app.',
    status: 'pending',
    createdAt: daysAgo(21),
    user: USERS[CITIZEN.userId],
  },
  {
    id: uid('eeee5555', 17),
    caseId: CASE_IDS.selfreview,
    userId: ADMIN.userId,
    action: 'submitted_for_review',
    description: 'Final report submitted for closure approval.',
    status: 'pending_admin_review',
    createdAt: hoursAgo(20),
    user: USERS[ADMIN.userId],
  },
]

export const EVIDENCE_LIST: Evidence[] = [
  {
    id: uid('ffff6666', 1),
    caseId: CASE_IDS.robbery,
    uploadedBy: OFFICER.userId,
    type: 'image',
    fileUrl: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=800',
    description: 'Cordoned entrance to the plaza',
    latitude: 6.5009,
    longitude: 3.3524,
    isVerified: true,
    uploadedAt: hoursAgo(4),
    createdAt: hoursAgo(4),
  },
  {
    id: uid('ffff6666', 2),
    caseId: CASE_IDS.robbery,
    uploadedBy: OFFICER.userId,
    type: 'video',
    fileUrl: 'https://example.org/evidence/plaza-cctv-clip.mp4',
    description: 'CCTV clip — two motorcycles leaving toward Mushin',
    latitude: 6.5009,
    longitude: 3.3524,
    isVerified: false,
    uploadedAt: hoursAgo(2),
    createdAt: hoursAgo(2),
  },
  {
    id: uid('ffff6666', 3),
    caseId: CASE_IDS.robbery,
    uploadedBy: CITIZEN.userId,
    type: 'image',
    fileUrl: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
    description: 'Photo of the damaged stall shutter',
    latitude: 6.5011,
    longitude: 3.3521,
    isVerified: false,
    uploadedAt: hoursAgo(3),
    createdAt: hoursAgo(3),
  },
  {
    id: uid('ffff6666', 4),
    caseId: CASE_IDS.lights,
    uploadedBy: OFFICER.userId,
    type: 'document',
    fileUrl: 'https://example.org/evidence/cable-recovery-report.pdf',
    description: 'Recovery report countersigned by the LGA electrical board',
    isVerified: true,
    uploadedAt: daysAgo(9),
    createdAt: daysAgo(9),
  },
]

export const FEEDBACK_LIST: CaseFeedback[] = [
  {
    id: uid('99999999', 1),
    caseId: CASE_IDS.lights,
    userId: CITIZEN.userId,
    rating: 5,
    comment: 'Response was quick and the street lights were fixed within the week.',
    isPublic: true,
    createdAt: daysAgo(8),
  },
]

/**
 * Closure-review decisions (`models.CaseReview`).
 *
 * The two `request_changes` entries carry the branch the officer's UI has to get
 * right: the comment is not a rejection notice, it is the officer's next task, and
 * the demo data should carry a real instruction rather than "rejected". The
 * `smuggled` case was subsequently resubmitted, which is why it now sits in
 * `pending_admin_review` with a history behind it.
 *
 * The `approve` entry exists because without it the approve branch appeared
 * nowhere in the app: a closed case would show a final report, a `closure_approved`
 * timeline event, and then "no closure decisions have been recorded" — which reads
 * as a missing record rather than a decided one. It also gives the reporter's case
 * log a closed case whose history is complete.
 */
export const REVIEW_LIST: CaseReview[] = [
  {
    id: uid('2b2b2b2b', 1),
    caseId: CASE_IDS.smuggled,
    adminId: ADMIN.userId,
    decision: 'request_changes',
    comment:
      'The report says the crates held appliances but not how that was established. State whether a crate was opened or catalogued, or say plainly that it was not possible and why.',
    createdAt: daysAgo(2),
  },
  {
    id: uid('2b2b2b2b', 2),
    caseId: CASE_IDS.generator,
    adminId: ADMIN.userId,
    decision: 'request_changes',
    comment:
      'You identified a suspect but the report stops there. Was a name taken, and was it raised with the estate management? Add the follow-up, or say plainly why there was none.',
    createdAt: hoursAgo(8),
  },
  {
    id: uid('2b2b2b2b', 3),
    caseId: CASE_IDS.lights,
    adminId: ADMIN.userId,
    decision: 'approve',
    comment:
      'Cabling recovered, both suspects handed over, and the electrical board notified — the report answers what was asked of it. Closure approved.',
    createdAt: daysAgo(9),
  },
]

/**
 * Weekly case updates (`models.CaseWeeklyUpdate`).
 *
 * One officer's narrative for one reporting week. `citizenVisible` is what the
 * backend writes and filters a reporter's read by — so the seeded updates are all
 * visible, and the *restriction* is exercised by the handler, which hides
 * non-visible ones from a reporter, not by the seed.
 */
export const WEEKLY_UPDATE_LIST: CaseWeeklyUpdate[] = [
  {
    id: uid('3c3c3c3c', 1),
    caseId: CASE_IDS.smuggled,
    officerId: OFFICER.userId,
    ...week(now - 7 * DAY),
    summary: 'Week one of the Apapa Road observation.',
    investigation:
      'Four nights of observation from the building opposite. Two unmarked lorries arrived between 01:10 and 02:40; crates were offloaded by four men. No weapons were seen on any night.',
    actionsTaken: 'Observation log kept. Lorry plates photographed and passed to the analyst.',
    findings: 'The lorries are registered to a haulage company in Ijora.',
    outstandingActions: 'Establish what the crates contained.',
    nextSteps: 'Approach the haulage company directly.',
    submittedAt: daysAgo(7),
    createdAt: daysAgo(7),
    citizenVisible: true,
  },
  {
    id: uid('3c3c3c3c', 2),
    caseId: CASE_IDS.smuggled,
    officerId: OFFICER.userId,
    ...week(now - 2 * DAY),
    summary: 'Week two — observation closed out and the report resubmitted.',
    investigation:
      'The final two nights produced no further offloading. The crates seen in week one were household appliances moved into the warehouse, confirmed with the warehouse manager.',
    findings: 'No contraband. The activity is unlicensed haulage rather than a security matter.',
    nextSteps: 'Refer the haulage licence question to Customs.',
    submittedAt: hoursAgo(5),
    createdAt: hoursAgo(5),
    citizenVisible: true,
  },
  {
    id: uid('3c3c3c3c', 3),
    caseId: CASE_IDS.workshop,
    officerId: OFFICER.userId,
    ...week(now - 2 * DAY),
    summary: 'First week on the Ogunlana Drive report.',
    investigation:
      'Observation post established opposite the workshop. Two nights covered; the yard was quiet after 22:00 on both, which does not match the pattern the caller described.',
    actionsTaken: 'Took a statement from the reporting neighbour and asked them to keep a written log.',
    outstandingActions: 'Cover a weekend night, when the earlier sightings were reported.',
    submittedAt: hoursAgo(6),
    createdAt: hoursAgo(6),
    citizenVisible: true,
  },
  {
    id: uid('3c3c3c3c', 4),
    caseId: CASE_IDS.generator,
    officerId: OFFICER.userId,
    ...week(now - 9 * DAY),
    summary: 'Two nights watching the estate generator house.',
    investigation:
      'One person was seen drawing fuel into two jerrycans at about 02:00 and leaving through the service gate.',
    findings: 'Estate management say the person is not a member of their staff.',
    submittedAt: daysAgo(9),
    createdAt: daysAgo(9),
    citizenVisible: true,
  },
  {
    /* The P1 case the officer walk opens first, so the Weekly tab has a real filed
     * narrative rather than only the derived activity grouping. Replaces the old
     * seed entry that stored this text as a `weekly_summary` *progress* record. */
    id: uid('3c3c3c3c', 5),
    caseId: CASE_IDS.robbery,
    officerId: OFFICER.userId,
    ...week(now - 7 * DAY),
    summary: 'Week one: scene secured, statements taken, CCTV recovered.',
    investigation:
      'Two patrol vehicles deployed to the plaza and the crowd moved back from the entrance. Cordon set at the Bode Thomas junction; statements taken from three traders. Plaza CCTV was pulled and passed to the analyst — the footage shows the two motorcycles heading toward Mushin.',
    actionsTaken: 'Cordon held through the afternoon. CCTV copy handed to the analyst.',
    findings: 'Both motorcycles left toward Mushin. Not yet linked to the Oshodi shots.',
    outstandingActions: 'Identify both motorcycles.',
    nextSteps: 'Follow the Mushin lead and compare it against the Oshodi incident.',
    submittedAt: daysAgo(7),
    createdAt: daysAgo(7),
    citizenVisible: true,
  },
]

export const NOTIFICATION_LIST: Notification[] = [
  {
    id: uid('77777777', 1),
    userId: OFFICER.userId,
    title: 'P1 case awaiting dispatch',
    message: 'CS-2026-0038 — assault outside a bar on Bode Thomas Street is still pending assignment.',
    type: 'case',
    status: 'unread',
    createdAt: hoursAgo(2),
  },
  {
    id: uid('77777777', 2),
    userId: OFFICER.userId,
    title: 'Evidence awaiting verification',
    message: 'Two evidence items on CS-2026-0041 have not been verified.',
    type: 'evidence',
    status: 'unread',
    createdAt: hoursAgo(3),
  },
  {
    id: uid('77777777', 3),
    userId: OFFICER.userId,
    title: 'Case closed',
    message: 'CS-2026-0031 was closed with a final report.',
    type: 'case',
    status: 'read',
    createdAt: daysAgo(9),
  },
  {
    id: uid('77777777', 4),
    userId: ADMIN.userId,
    title: 'Unit performance summary',
    message: 'Surulere Central closed 12 cases in the last 30 days.',
    type: 'system',
    status: 'unread',
    createdAt: hoursAgo(20),
  },
]

/**
 * Unit roster — the backend's `officers` table.
 *
 * The backend keeps `officers` and `users` as separate entities, and
 * `POST /cases/:id/assign` takes an *officer* id, validated against the case's
 * unit. The officer console's own account (Tunde Balogun) is given the same id
 * here so the seeded `assignedTo` values — which are user ids — stay coherent
 * for the demo; everything else is a plain officer record.
 */
export const OFFICERS: UnitOfficer[] = [
  {
    id: OFFICER.userId,
    unitId: UNIT_MAIN,
    name: 'Tunde Balogun',
    rank: 'Sergeant',
    badgeNumber: 'CS-1042',
    role: 'patrol',
    phone: '+2348011110001',
    email: OFFICER.email,
    joinedDate: daysAgo(400),
    status: 'active',
  },
  {
    id: uid('0f0f0f0f', 2),
    unitId: UNIT_MAIN,
    name: 'Emeka Nwosu',
    rank: 'Inspector',
    badgeNumber: 'CS-1031',
    role: 'investigator',
    phone: '+2348011110010',
    email: 'emeka.nwosu@shield.ng',
    joinedDate: daysAgo(900),
    status: 'active',
  },
  {
    id: uid('0f0f0f0f', 3),
    unitId: UNIT_MAIN,
    name: 'Fatima Yusuf',
    rank: 'Constable',
    badgeNumber: 'CS-1055',
    role: 'patrol',
    phone: '+2348011110011',
    email: 'fatima.yusuf@shield.ng',
    joinedDate: daysAgo(150),
    status: 'active',
  },
  {
    id: uid('0f0f0f0f', 4),
    unitId: UNIT_MAIN,
    name: 'Grace Adeleke',
    rank: 'Corporal',
    badgeNumber: 'CS-1050',
    role: 'dispatch',
    phone: '+2348011110012',
    joinedDate: daysAgo(300),
    status: 'leave',
  },
  {
    id: uid('0f0f0f0f', 5),
    unitId: UNIT_ANNEX,
    name: 'Sade Lawal',
    rank: 'Inspector',
    badgeNumber: 'CS-2011',
    role: 'investigator',
    phone: '+2348011110005',
    joinedDate: daysAgo(600),
    status: 'active',
  },
  {
    id: uid('0f0f0f0f', 6),
    unitId: UNIT_ANNEX,
    name: 'Peter Okon',
    rank: 'Constable',
    badgeNumber: 'CS-2020',
    role: 'patrol',
    joinedDate: daysAgo(200),
    status: 'active',
  },
  {
    id: uid('0f0f0f0f', 7),
    unitId: UNIT_RAPID,
    name: 'Chris Adeniyi',
    rank: 'Superintendent',
    badgeNumber: 'CS-3001',
    role: 'commander',
    phone: '+2348011110006',
    joinedDate: daysAgo(1200),
    status: 'active',
  },
]

/** Case ↔ officer links (`GET /cases/:id/assignments`). */
export const ASSIGNMENT_LIST: CaseOfficer[] = [
  {
    id: uid('1a1a1a1a', 1),
    caseId: CASE_IDS.robbery,
    officerId: OFFICER.userId,
    role: 'primary',
    createdAt: hoursAgo(5.5),
  },
  {
    id: uid('1a1a1a1a', 2),
    caseId: CASE_IDS.robbery,
    officerId: uid('0f0f0f0f', 2),
    role: 'investigator',
    createdAt: hoursAgo(4.5),
  },
  {
    id: uid('1a1a1a1a', 3),
    caseId: CASE_IDS.gunshots,
    officerId: OFFICER.userId,
    role: 'primary',
    createdAt: hoursAgo(19),
  },
  {
    id: uid('1a1a1a1a', 4),
    caseId: CASE_IDS.breakIns,
    officerId: OFFICER.userId,
    role: 'primary',
    createdAt: hoursAgo(30),
  },
  {
    id: uid('1a1a1a1a', 5),
    caseId: CASE_IDS.lights,
    officerId: OFFICER.userId,
    role: 'primary',
    createdAt: daysAgo(12),
  },
  {
    id: uid('1a1a1a1a', 6),
    caseId: CASE_IDS.loitering,
    officerId: OFFICER.userId,
    role: 'primary',
    createdAt: daysAgo(16),
  },
]

/** A fresh, mutable copy of the seed — handlers mutate this in-session. */
export function seedDatabase() {
  return {
    cases: CASE_LIST.map((c) => ({ ...c })),
    progress: PROGRESS_LIST.map((p) => ({ ...p })),
    timeline: TIMELINE_LIST.map((t) => ({ ...t })),
    evidence: EVIDENCE_LIST.map((e) => ({ ...e })),
    feedback: FEEDBACK_LIST.map((f) => ({ ...f })),
    notifications: NOTIFICATION_LIST.map((n) => ({ ...n })),
    units: UNITS.map((u) => ({ ...u })),
    officers: OFFICERS.map((o) => ({ ...o })),
    assignments: ASSIGNMENT_LIST.map((a) => ({ ...a })),
    reviews: REVIEW_LIST.map((r) => ({ ...r })),
    weeklyUpdates: WEEKLY_UPDATE_LIST.map((w) => ({ ...w })),
  }
}

export type MockDatabase = ReturnType<typeof seedDatabase>

export const CASE_ID_BY_KEY = CASE_IDS
