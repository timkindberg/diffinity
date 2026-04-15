import { CANDIDATE_TIMESHEET_API_BODY } from './candidate-timesheets.js'

/** Keep in sync with vr_django `candidate_timesheets.TITO_SAMPLE_CLOCKS` and frozen date in mobile-day capture. */
export const VR_MOBILE_FROZEN_DATE = '2026-03-25'

const TITO_SAMPLE_CLOCKS = [
  {
    id: 6001,
    breaks: [] as unknown[],
    clock_in: '09:00:00',
    clock_out: '12:00:00',
    clock_out_date: '2026-03-25',
    entry_date: '2026-03-25',
    work_type: 1,
  },
  {
    id: 6002,
    breaks: [] as unknown[],
    clock_in: '13:00:00',
    clock_out: '17:30:00',
    clock_out_date: '2026-03-25',
    entry_date: '2026-03-25',
    work_type: 1,
  },
]

const VR_CHARGE_CODE_TABLE_TYPE = 'vr_cost_center'

function weekEntries(hoursPerDay: number[]) {
  const dates = ['2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26', '2026-03-27', '2026-03-28']
  return dates.map((entry_date, i) => ({ entry_date, total_hours: hoursPerDay[i]!, total_units: 0 }))
}

const MOBILE_SECOND_WORK_ORDER = {
  id: 3001,
  displayId: 'WO-3001',
  title: 'Data Analyst',
  client_name: 'Cruise Corp',
  vendor_name: 'Acme Staffing',
  allocation_types: [],
  shift_strategy: [],
  shifts: [],
  work_types: [
    { id: 1, name: 'Regular', classification: 1 },
    { id: 2, name: 'Overtime', classification: 2 },
  ],
  is_active: true,
  startDate: '2026-01-15',
  endDate: '2026-12-31',
}

const PTO_WORK_TYPE = {
  id: 3, name: 'PTO', classification: 4,
  is_system: false, is_passive: false, is_callback: false,
  is_break: false, nonworking_hours: true, isNonWorking: true,
}

const MOBILE_EXTRA_DETAILS = [
  {
    id: 3,
    work_order: { id: 3001 },
    work_type: { id: 1, name: 'Regular', classification: 1, is_system: false },
    work_type_name: 'Regular', work_order_title: 'Data Analyst',
    charge_code: {
      type: VR_CHARGE_CODE_TABLE_TYPE,
      codes: [
        { name: 'gl_account', value: '6300-OPS', display: '6300 — Operations' },
        { name: 'cost_object', value: 'CO-1002', display: 'Mobile app refresh' },
      ],
    },
    premium_rate: null,
    generic_fields: {},
    entries: weekEntries([0, 4, 4, 4, 4, 4, 0]),
  },
  {
    id: 4,
    work_order: { id: 2001 },
    work_type: { id: 3, name: 'PTO', classification: 4, is_system: false },
    work_type_name: 'PTO', work_order_title: 'Senior Software Engineer',
    charge_code: {
      type: VR_CHARGE_CODE_TABLE_TYPE,
      codes: [
        { name: 'gl_account', value: '6200-ENG', display: '6200 — Engineering labor' },
        { name: 'cost_object', value: 'CO-1001', display: 'NextGen Portal' },
      ],
    },
    premium_rate: null,
    generic_fields: {},
    entries: weekEntries([0, 0, 0, 8, 0, 0, 0]),
  },
]

const MOBILE_PROJECTS = [
  ...CANDIDATE_TIMESHEET_API_BODY.projects,
  {
    id: 403,
    code: 'PRJ-DATA',
    title: 'Data pipeline modernization',
    startDate: '2026-01-15',
    endDate: '2026-12-31',
    can_add_time: true,
    workOrders: [{ id: 3001, can_add_time: true }],
    tasks: [{ id: 504, name: 'ETL migration', task_code: 'ETL' }],
  },
]

const mobileBase = {
  ...CANDIDATE_TIMESHEET_API_BODY,
  toggles: { ...CANDIDATE_TIMESHEET_API_BODY.toggles, mobile_timesheets_enabled: true },
  forceCurrentTime: true,
  settings: {
    ...CANDIDATE_TIMESHEET_API_BODY.settings,
    time_keeping: {
      ...CANDIDATE_TIMESHEET_API_BODY.settings.time_keeping,
      force_current_time: true,
    },
  },
}

/** Parity with `?mobile=1` in vr_django `candidate_timesheets.build_context`. */
export const MOBILE_ALLOCATION_API_BODY = {
  ...mobileBase,
  readOnly: false,
  totals: { total: 68, regular: 60, overtime: 4, doubletime: 0 },
  projects: MOBILE_PROJECTS,
  workOrders: [...mobileBase.workOrders, MOBILE_SECOND_WORK_ORDER],
  workTypes: [...mobileBase.workTypes, PTO_WORK_TYPE],
  details: [...mobileBase.details, ...MOBILE_EXTRA_DETAILS],
}

const daysWithTitoSeconds = CANDIDATE_TIMESHEET_API_BODY.days.map((d) =>
  d.date === '2026-03-25' ? { ...d, seconds: 9 * 3600 + 30 * 60 } : d,
)

/** Parity with `?mobile=1&tito=1` in vr_django `candidate_timesheets.build_context`. */
export const MOBILE_DAY_API_BODY = {
  ...mobileBase,
  clockedTimes: TITO_SAMPLE_CLOCKS,
  days: daysWithTitoSeconds,
  settings: {
    ...mobileBase.settings,
    time_keeping: {
      ...mobileBase.settings.time_keeping,
      timesheet_type: 'time in/out',
    },
  },
}
