/**
 * Staff schedule for /do-i-work — data model, storage and form parsing.
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
 * Every edit form carries the `updatedAt` it was rendered from. A save whose
 * stamp no longer matches the stored one is refused instead of silently
 * overwriting someone else's changes — see `saveSchedule`.
 *
 * WHAT BELONGS HERE
 * -----------------
 * Everyone with the staff password sees the whole document. Names and shift
 * times are fine; phone numbers, pay, or anything else personal is not.
 */
import { getStore } from '@netlify/blobs';

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
  /** Free text per day, e.g. "6a–2:30p", "Off", "On call". Empty means not set. */
  shifts: Record<Day, string>;
}

export interface DayOff {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  name: string;
  note: string;
}

export interface Schedule {
  version: 1;
  /** Monday of the week shown, YYYY-MM-DD. */
  weekOf: string;
  /** Free-text notes for the week, shown above the table. */
  notes: string;
  employees: Employee[];
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
  shift: 40,
  dayOffName: 80,
  dayOffNote: 200,
  notes: 2000,
} as const;

/** Blank rows appended to each editable table so new entries need no JavaScript. */
export const BLANK_ROWS = 3;

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

/** The Monday on or before the given date. */
export function mondayOf(iso: string): string {
  const date = parseIso(iso) ?? (parseIso(todayIso()) as Date);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return toIso(date);
}

/** The seven ISO dates of the week starting `weekOf`, keyed by day. */
export function weekDates(weekOf: string): Record<Day, string> {
  const start = parseIso(weekOf) ?? (parseIso(mondayOf(todayIso())) as Date);
  return Object.fromEntries(
    DAYS.map((day, i) => {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      return [day, toIso(d)];
    })
  ) as Record<Day, string>;
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
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */

const STORE_NAME = 'do-i-work';
const KEY = 'schedule';

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export function emptySchedule(): Schedule {
  return {
    version: 1,
    weekOf: mondayOf(todayIso()),
    notes: '',
    employees: [],
    daysOff: [],
    updatedAt: null,
  };
}

export async function loadSchedule(): Promise<Schedule> {
  const stored = (await store().get(KEY, { type: 'json' })) as Schedule | null;
  return stored ?? emptySchedule();
}

export type SaveResult = { ok: true; schedule: Schedule } | { ok: false; reason: 'conflict' };

/**
 * Writes the schedule unless someone else has saved since `basedOn` was read.
 *
 * Read-then-write is not atomic, so two saves landing in the same instant can
 * still race. For a few editors updating a weekly roster that window is
 * acceptable; the check exists to catch the common case of two people editing
 * from stale pages.
 */
export async function saveSchedule(next: Omit<Schedule, 'updatedAt'>, basedOn: string | null): Promise<SaveResult> {
  const current = await loadSchedule();
  if (current.updatedAt !== basedOn) return { ok: false, reason: 'conflict' };

  const schedule: Schedule = { ...next, updatedAt: new Date().toISOString() };
  await store().setJSON(KEY, schedule);
  return { ok: true, schedule };
}

/* -------------------------------------------------------------------------- */
/* Form parsing                                                               */
/* -------------------------------------------------------------------------- */

/*
 * The edit form posts flat fields — `emp-3-name`, `emp-3-tue`, `off-1-date` —
 * plus a row count for each table. Flat names keep the form plain HTML with no
 * client script, and parsing stays a simple loop.
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

export function parseScheduleForm(form: FormData): Omit<Schedule, 'updatedAt'> {
  const employees: Employee[] = [];
  const employeeRows = count(form, 'emp-count', LIMITS.employees + BLANK_ROWS);

  for (let i = 0; i < employeeRows && employees.length < LIMITS.employees; i++) {
    const p = `emp-${i}`;
    const name = text(form, `${p}-name`, LIMITS.name);
    // A blank name is an unused "add" row, and removing is just leaving it out.
    if (!name || form.get(`${p}-remove`)) continue;

    employees.push({
      id: rowId(form, `${p}-id`),
      name,
      role: text(form, `${p}-role`, LIMITS.role),
      shifts: Object.fromEntries(DAYS.map((day) => [day, text(form, `${p}-${day}`, LIMITS.shift)])) as Record<
        Day,
        string
      >,
    });
  }

  const daysOff: DayOff[] = [];
  const dayOffRows = count(form, 'off-count', LIMITS.daysOff + BLANK_ROWS);

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
    version: 1,
    weekOf: mondayOf(text(form, 'weekOf', 10)),
    notes: multiline(form, 'notes', LIMITS.notes),
    employees,
    daysOff,
  };
}
