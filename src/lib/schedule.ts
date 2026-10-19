/**
 * Staff schedule for /do-i-work — data model, storage and form parsing.
 *
 * SHAPE
 * -----
 * The roster (names and positions) is shared. Shifts live per week, keyed by
 * that week's Monday, so "this week" and "next week" are simply the two keys
 * nearest today. When the calendar rolls over, what was next week becomes this
 * week on its own — nobody has to promote it.
 *
 * A shift is a start and end time on the same day. Blank means not working.
 *
 * STORAGE
 * -------
 * One JSON document in Netlify Blobs. The rest of the site is static files with
 * no database, and the schedule is small and edited by a handful of people, so a
 * single document is the whole persistence layer. Under `astro dev` the Netlify
 * Vite plugin emulates Blobs locally (data lands in `.netlify/`, gitignored).
 *
 * Reads use strong consistency so an editor sees their own save on the redirect
 * that follows it, rather than a stale edge copy.
 *
 * CONCURRENT EDITS
 * ----------------
 * Every form carries the `updatedAt` it was rendered from. A change whose stamp
 * no longer matches the stored one is refused instead of silently overwriting
 * someone else's work — see `updateSchedule`.
 *
 * WHAT BELONGS HERE
 * -----------------
 * Everyone with the staff password sees the whole document. Names and shift
 * times are fine; phone numbers, pay, or anything else personal is not.
 */
import { getStore } from '@netlify/blobs';
import { normaliseTime, toMinutes } from './time';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** J&L's yard is in Arizona, which does not observe DST. */
export const TIME_ZONE = 'America/Phoenix';

export interface Employee {
  id: string;
  name: string;
  role: string;
}

/** Same-day shift, `HH:MM` 24-hour. `start` is always earlier than `end`. */
export interface Shift {
  start: string;
  end: string;
}

/** One employee's week. `null` means not working that day. */
export type WeekShifts = Record<Day, Shift | null>;

export interface Week {
  /** Free-text notes for the week, shown above the table. */
  notes: string;
  /** Keyed by employee id. A missing employee has no shifts that week. */
  shifts: Record<string, WeekShifts>;
}

export interface DayOff {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  name: string;
  note: string;
}

export interface Schedule {
  version: 2;
  employees: Employee[];
  /** Keyed by the week's Monday, YYYY-MM-DD. */
  weeks: Record<string, Week>;
  daysOff: DayOff[];
  /** ISO timestamp of the last save, or null if never saved. */
  updatedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Limits                                                                     */
/* -------------------------------------------------------------------------- */

/** Generous for the real use, small enough that a bad form post cannot bloat the store. */
export const LIMITS = {
  employees: 200,
  daysOff: 100,
  name: 80,
  role: 60,
  dayOffName: 80,
  dayOffNote: 200,
  notes: 2000,
} as const;

/**
 * Upper bound on the row indexes the edit form may post. Rows added and then
 * removed in the browser leave gaps in the numbering, so this sits well above
 * the real limits; it only stops a forged count from looping for ever.
 */
const FORM_ROW_CAP = 1000;

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date in Arizona, YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(now);
}

function parseIso(iso: string): Date | null {
  if (!ISO_DATE.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : date;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso) ?? (parseIso(todayIso()) as Date);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** The Monday on or before the given date. */
export function mondayOf(iso: string): string {
  const date = parseIso(iso) ?? (parseIso(todayIso()) as Date);
  return addDays(toIso(date), -((date.getUTCDay() + 6) % 7));
}

/** The Mondays of this week and next, in Arizona time. */
export function currentAndNextWeek(today = todayIso()): { current: string; next: string } {
  const current = mondayOf(today);
  return { current, next: addDays(current, 7) };
}

/** The seven ISO dates of the week starting `weekOf`, keyed by day. */
export function weekDates(weekOf: string): Record<Day, string> {
  return Object.fromEntries(DAYS.map((day, i) => [day, addDays(weekOf, i)])) as Record<Day, string>;
}

/** "Oct 20" — dates are calendar dates, so format in UTC to avoid any shift. */
export function formatShort(iso: string): string {
  const date = parseIso(iso);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : iso;
}

/** "Monday, October 20, 2026". */
export function formatLong(iso: string): string {
  const date = parseIso(iso);
  return date
    ? date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : iso;
}

/** "Oct 19, 2026, 1:56 PM" in Arizona time. */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TIME_ZONE,
  });
}

/* -------------------------------------------------------------------------- */
/* Times                                                                      */
/* -------------------------------------------------------------------------- */

// Parsing and formatting live in ./time so the browser can share them.
export { normaliseTime, formatTime, formatShift } from './time';

/* -------------------------------------------------------------------------- */
/* Weeks                                                                      */
/* -------------------------------------------------------------------------- */

export function emptyWeekShifts(): WeekShifts {
  return Object.fromEntries(DAYS.map((day) => [day, null])) as WeekShifts;
}

export function getWeek(schedule: Schedule, weekOf: string): Week {
  return schedule.weeks[weekOf] ?? { notes: '', shifts: {} };
}

/** True when anyone on the current roster has at least one shift that week. */
export function weekHasShifts(schedule: Schedule, weekOf: string): boolean {
  const { shifts } = getWeek(schedule, weekOf);
  return schedule.employees.some((emp) => DAYS.some((day) => shifts[emp.id]?.[day]));
}

/**
 * Replaces the shifts of week `to` with those of week `from`. The target keeps
 * its own notes — those tend to be about that specific week ("yard closes early
 * Friday"), so carrying them over would more often be wrong than right.
 */
export function copyWeek(schedule: Schedule, from: string, to: string): Omit<Schedule, 'updatedAt'> {
  const source = getWeek(schedule, from);
  return {
    ...schedule,
    weeks: {
      ...schedule.weeks,
      [to]: { notes: getWeek(schedule, to).notes, shifts: structuredClone(source.shifts) },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

const STORE_NAME = 'do-i-work';
const KEY = 'schedule';

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export function emptySchedule(): Schedule {
  return { version: 2, employees: [], weeks: {}, daysOff: [], updatedAt: null };
}

/**
 * Brings an older stored document up to the current shape.
 *
 * Version 1 had one week of free-text shifts ("6a–2p", "Off"). Those cannot be
 * turned into reliable times, so the roster and company days off carry over and
 * the shifts start blank.
 */
function migrate(stored: unknown): Schedule {
  const doc = stored as Partial<Schedule> & { version?: number; employees?: Employee[] };
  if (doc.version === 2) return doc as Schedule;

  return {
    version: 2,
    employees: (doc.employees ?? []).map(({ id, name, role }) => ({ id, name, role })),
    weeks: {},
    daysOff: doc.daysOff ?? [],
    updatedAt: doc.updatedAt ?? null,
  };
}

export async function loadSchedule(): Promise<Schedule> {
  const stored = await store().get(KEY, { type: 'json' });
  return stored ? migrate(stored) : emptySchedule();
}

export type UpdateResult = { ok: true; schedule: Schedule } | { ok: false; current: Schedule };

/**
 * Applies `change` to the stored schedule unless someone else has saved since
 * `basedOn` was read.
 *
 * Read-then-write is not atomic, so two saves landing in the same instant can
 * still race. For a few editors updating a weekly roster that window is
 * acceptable; the check exists to catch the common case of two people editing
 * from stale pages.
 *
 * Weeks before this one are dropped on every write — nothing shows them, and it
 * keeps the document from growing forever.
 */
export async function updateSchedule(
  basedOn: string | null,
  change: (current: Schedule) => Omit<Schedule, 'updatedAt'>
): Promise<UpdateResult> {
  const current = await loadSchedule();
  if (current.updatedAt !== basedOn) return { ok: false, current };

  const next = change(current);
  const { current: thisWeek } = currentAndNextWeek();
  const weeks = Object.fromEntries(Object.entries(next.weeks).filter(([weekOf]) => weekOf >= thisWeek));

  const schedule: Schedule = { ...next, weeks, updatedAt: new Date().toISOString() };
  await store().setJSON(KEY, schedule);
  return { ok: true, schedule };
}

/* -------------------------------------------------------------------------- */
/* Editing one week                                                           */
/* -------------------------------------------------------------------------- */

/**
 * What the edit form shows and submits: the shared roster, one week's shifts
 * and notes, and the company days off. Times are kept as raw strings so a
 * submission with mistakes can be shown back exactly as typed.
 */
export interface EditRow {
  id: string;
  name: string;
  role: string;
  times: Record<Day, { start: string; end: string }>;
}

export interface WeekEdit {
  weekOf: string;
  notes: string;
  employees: EditRow[];
  daysOff: DayOff[];
}

/** A problem with one day of one row. `row` indexes `WeekEdit.employees`. */
export interface ShiftError {
  row: number;
  day: Day | null;
  message: string;
}

export function weekEditFrom(schedule: Schedule, weekOf: string): WeekEdit {
  const week = getWeek(schedule, weekOf);
  return {
    weekOf,
    notes: week.notes,
    daysOff: schedule.daysOff,
    employees: schedule.employees.map((emp) => ({
      ...emp,
      times: Object.fromEntries(
        DAYS.map((day) => {
          const shift = week.shifts[emp.id]?.[day];
          return [day, { start: shift?.start ?? '', end: shift?.end ?? '' }];
        })
      ) as EditRow['times'],
    })),
  };
}

/** Writes a validated `WeekEdit` into the schedule. Other weeks keep their shifts. */
export function applyWeekEdit(schedule: Schedule, edit: WeekEdit): Omit<Schedule, 'updatedAt'> {
  const employees = edit.employees.map(({ id, name, role }) => ({ id, name, role }));
  const ids = new Set(employees.map((emp) => emp.id));

  // Someone removed from the roster loses their shifts in every week.
  const weeks = Object.fromEntries(
    Object.entries(schedule.weeks).map(([weekOf, week]) => [
      weekOf,
      { ...week, shifts: Object.fromEntries(Object.entries(week.shifts).filter(([id]) => ids.has(id))) },
    ])
  );

  weeks[edit.weekOf] = {
    notes: edit.notes,
    shifts: Object.fromEntries(
      edit.employees.map((row) => [
        row.id,
        Object.fromEntries(
          DAYS.map((day) => {
            const { start, end } = row.times[day];
            return [day, start && end ? { start, end } : null];
          })
        ) as WeekShifts,
      ])
    ),
  };

  return { version: 2, employees, weeks, daysOff: edit.daysOff };
}

/* -------------------------------------------------------------------------- */
/* Form parsing                                                               */
/* -------------------------------------------------------------------------- */

/*
 * The edit form posts flat fields — `emp-3-name`, `emp-3-tue-start`,
 * `off-1-date` — plus a row count for each table. Flat names keep the form
 * plain HTML, and parsing stays a simple loop. Rows the editor added and then
 * removed simply never arrive, so gaps in the numbering are skipped.
 */

function text(form: FormData, key: string, max: number): string {
  return String(form.get(key) ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

function multiline(form: FormData, key: string, max: number): string {
  return String(form.get(key) ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

function count(form: FormData, key: string, max: number): number {
  const n = Number.parseInt(String(form.get(key) ?? '0'), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
}

function rowId(form: FormData, key: string): string {
  const id = text(form, key, 64);
  return /^[a-zA-Z0-9-]+$/.test(id) ? id : crypto.randomUUID();
}

/**
 * Checks one day's pair of times. Both blank is a day off; otherwise both must
 * be valid and the start must come before the end. Overnight shifts are not
 * supported: a shift belongs to a single day.
 */
function checkShift(rawStart: string, rawEnd: string): { start: string; end: string; error: string | null } {
  if (!rawStart && !rawEnd) return { start: '', end: '', error: null };

  const start = rawStart ? normaliseTime(rawStart) : null;
  const end = rawEnd ? normaliseTime(rawEnd) : null;

  if (rawStart && !start) return { start: rawStart, end: rawEnd, error: 'Start time is not a valid time.' };
  if (rawEnd && !end) return { start: rawStart, end: rawEnd, error: 'End time is not a valid time.' };
  if (!start) return { start: '', end: end as string, error: 'Enter a start time, or clear the end time.' };
  if (!end) return { start, end: '', error: 'Enter an end time, or clear the start time.' };
  if (toMinutes(start) >= toMinutes(end)) return { start, end, error: 'Start time must be earlier than end time.' };
  return { start, end, error: null };
}

export function parseWeekForm(form: FormData, weekOf: string): { edit: WeekEdit; errors: ShiftError[] } {
  const employees: EditRow[] = [];
  const errors: ShiftError[] = [];
  const employeeRows = count(form, 'emp-count', FORM_ROW_CAP);

  for (let i = 0; i < employeeRows && employees.length < LIMITS.employees; i++) {
    const p = `emp-${i}`;
    if (form.get(`${p}-remove`)) continue;

    const name = text(form, `${p}-name`, LIMITS.name);
    const raw = DAYS.map((day) => [day, text(form, `${p}-${day}-start`, 12), text(form, `${p}-${day}-end`, 12)] as const);
    const hasTimes = raw.some(([, start, end]) => start || end);

    // A blank "add" row is skipped. One with times but no name is kept, so the
    // editor can see it and either name it or clear it.
    if (!name && !hasTimes) continue;

    // Errors index into `employees`, which skips rows — so take the index the
    // row will have in the redisplayed form, not the posted one.
    const row = employees.length;
    if (!name) errors.push({ row, day: null, message: 'Add a name for this row, or clear its times.' });

    const times = {} as EditRow['times'];
    for (const [day, rawStart, rawEnd] of raw) {
      const { start, end, error } = checkShift(rawStart, rawEnd);
      times[day] = { start, end };
      if (error) errors.push({ row, day, message: error });
    }

    employees.push({ id: rowId(form, `${p}-id`), name, role: text(form, `${p}-role`, LIMITS.role), times });
  }

  const daysOff: DayOff[] = [];
  const dayOffRows = count(form, 'off-count', FORM_ROW_CAP);

  for (let i = 0; i < dayOffRows && daysOff.length < LIMITS.daysOff; i++) {
    const p = `off-${i}`;
    const date = text(form, `${p}-date`, 10);
    if (!parseIso(date) || form.get(`${p}-remove`)) continue;

    daysOff.push({
      id: rowId(form, `${p}-id`),
      date,
      name: text(form, `${p}-name`, LIMITS.dayOffName) || 'Company day off',
      note: text(form, `${p}-note`, LIMITS.dayOffNote),
    });
  }
  daysOff.sort((a, b) => a.date.localeCompare(b.date));

  return {
    edit: { weekOf, notes: multiline(form, 'notes', LIMITS.notes), employees, daysOff },
    errors,
  };
}
