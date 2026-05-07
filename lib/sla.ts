/**
 * SLA Calculation — ใช้เวลาทำการ จ-ศ 08:30-17:30 (GMT+7)
 */

const WORK_START_HOUR = 8;
const WORK_START_MIN = 30;
const WORK_END_HOUR = 17;
const WORK_END_MIN = 30;
const WORK_HOURS_PER_DAY = 9; // 8:30 → 17:30 = 9 hours

export type SLAStatus = 'ok' | 'warning' | 'breached';

export interface SLAInfo {
  status: SLAStatus;
  label: string;
  remainingMs: number | null; // milliseconds until deadline (null if breached)
}

// ─── helpers ──────────────────────────────────────────

function isWorkday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Mon=1..Fri=5
}

function workStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(WORK_START_HOUR, WORK_START_MIN, 0, 0);
  return d;
}

function workEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(WORK_END_HOUR, WORK_END_MIN, 0, 0);
  return d;
}

function nextWorkday(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  while (!isWorkday(d)) {
    d.setDate(d.getDate() + 1);
  }
  return workStart(d);
}

/**
 * Add N business hours to a timestamp.
 * Returns the deadline as a Date.
 */
function addBusinessHours(start: Date, hours: number): Date {
  let remaining = hours;
  let current = new Date(start);

  // If before work hours on a workday, clamp to start
  if (isWorkday(current) && current < workStart(current)) {
    current = workStart(current);
  }

  // If after work hours or weekend, jump to next workday start
  if (!isWorkday(current) || current >= workEnd(current)) {
    current = nextWorkday(current);
  }

  while (remaining > 0) {
    const dayEnd = workEnd(current);
    const availableMs = dayEnd.getTime() - current.getTime();
    const availableHours = availableMs / (1000 * 60 * 60);

    if (availableHours >= remaining) {
      // Fits in current day
      current = new Date(current.getTime() + remaining * 60 * 60 * 1000);
      remaining = 0;
    } else {
      // Consume rest of day, move to next workday
      remaining -= availableHours;
      current = nextWorkday(current);
    }
  }

  return current;
}

// ─── public API ───────────────────────────────────────

/**
 * Calculate response SLA deadline: 4 business hours from case creation
 */
export function calcResponseDeadline(createdAt: string | Date): Date {
  return addBusinessHours(new Date(createdAt), 4);
}

/**
 * Calculate onsite SLA deadline: 2 business days from response time
 * (2 business days = 18 business hours, but requirement is 2 working days)
 * We interpret "2 วันทำการ" as 2 calendar workdays, so = 2 * 9 = 18 business hours
 */
export function calcOnsiteDeadline(respondedAt: string | Date): Date {
  return addBusinessHours(new Date(respondedAt), 18); // 2 days * 9 hours
}

/**
 * Evaluate SLA status for a given deadline.
 */
export function evaluateSLA(deadline: Date | string | null): SLAInfo {
  if (!deadline) {
    return { status: 'ok', label: 'ไม่มีกำหนด', remainingMs: null };
  }

  const dl = new Date(deadline);
  const now = new Date();
  const diff = dl.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      status: 'breached',
      label: formatBreached(diff),
      remainingMs: null,
    };
  }

  const remainingHours = diff / (1000 * 60 * 60);

  if (remainingHours < 1) {
    return {
      status: 'warning',
      label: `⚠️ เหลือ ${formatDuration(diff)}`,
      remainingMs: diff,
    };
  }

  return {
    status: 'ok',
    label: `⏳ เหลือ ${formatDuration(diff)}`,
    remainingMs: diff,
  };
}

// ─── formatting ───────────────────────────────────────

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const mins = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0 && mins > 0) return `${hours} ชม. ${mins} นาที`;
  if (hours > 0) return `${hours} ชม.`;
  return `${mins} นาที`;
}

function formatBreached(ms: number): string {
  const abs = Math.abs(ms);
  return `🔴 เกินกำหนด ${formatDuration(abs)}`;
}

/**
 * Format how long an SLA was met (e.g., "✅ ตอบรับภายใน 1 ชม. 20 นาที")
 */
export function formatMet(createdAt: string | Date, respondedAt: string | Date): string {
  const diff = new Date(respondedAt).getTime() - new Date(createdAt).getTime();
  if (diff <= 0) return '';
  return `✅ ตอบรับภายใน ${formatDuration(diff)}`;
}

// ─── v2.2: BUSINESS_HOURS constant ──────────────────

export const BUSINESS_HOURS = {
  startHour: WORK_START_HOUR,
  startMin: WORK_START_MIN,
  endHour: WORK_END_HOUR,
  endMin: WORK_END_MIN,
  hoursPerDay: WORK_HOURS_PER_DAY,
} as const;

// ─── v2.2: SLA pause/resume ──────────────────────────

interface SLACase {
  status?: string;
  sla_paused_at?: string | Date | null;
  sla_paused_total_seconds?: number | null;
}

/**
 * Call when case status changes — returns { shouldPause: true } when entering 'on_hold'.
 */
export function pauseSLA(kase: SLACase): { shouldPause: boolean } {
  return { shouldPause: kase.status === 'on_hold' };
}

/**
 * Call when case status changes — returns { shouldResume: true } when leaving 'on_hold'.
 */
export function resumeSLA(kase: SLACase): { shouldResume: boolean } {
  return { shouldResume: kase.status !== 'on_hold' };
}

/**
 * Calculate total paused duration in milliseconds.
 * If the SLA is currently paused (sla_paused_at is set), add the elapsed time since
 * sla_paused_at to the previously accumulated total.
 *
 * @param sla_paused_total_seconds  Accumulated paused seconds from prior pause cycles
 * @param sla_paused_at             Timestamp when current pause started (null if not paused)
 * @returns Total paused duration in milliseconds
 */
export function calculatePausedDuration(
  sla_paused_total_seconds: number | null | undefined,
  sla_paused_at: string | Date | null | undefined,
): number {
  const accumulatedMs = (sla_paused_total_seconds ?? 0) * 1000;

  if (!sla_paused_at) return accumulatedMs;

  const pausedAt = new Date(sla_paused_at).getTime();
  const now = Date.now();
  const currentPauseMs = Math.max(0, now - pausedAt);

  return accumulatedMs + currentPauseMs;
}

/**
 * Adjust an SLA deadline by adding the total paused time back,
 * so the clock effectively stops during pauses.
 *
 * @param deadline     Original SLA deadline
 * @param totalPausedMs Total paused duration in milliseconds (from calculatePausedDuration)
 * @returns New deadline with paused time added
 */
export function adjustDeadlineForPause(
  deadline: string | Date,
  totalPausedMs: number,
): Date {
  return new Date(new Date(deadline).getTime() + totalPausedMs);
}

// ─── v2.2: Escalation helpers ───────────────────────

export interface EscalationInfo {
  label: string;
  color: string;
}

const ESCALATION_LEVELS: EscalationInfo[] = [
  { label: 'ปกติ', color: 'green' },
  { label: 'เลื่อนระดับ 1 (ผู้ให้เช่า)', color: 'yellow' },
  { label: 'เลื่อนระดับ 2 (ผู้ควบคุม)', color: 'orange' },
  { label: 'เลื่อนระดับ 3 (ผู้ดูแลระบบ)', color: 'red' },
];

/**
 * Get escalation level label and colour in Thai.
 * @param level 0=normal, 1=tenant, 2=supervisor, 3=admin
 */
export function getEscalationLevel(level: number): EscalationInfo {
  if (level < 0 || level >= ESCALATION_LEVELS.length) {
    return ESCALATION_LEVELS[0]; // fallback to normal
  }
  return ESCALATION_LEVELS[level];
}
