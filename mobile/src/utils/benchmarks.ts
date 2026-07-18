/**
 * Arrival-time benchmark helpers. A prediction should always be made relative to a
 * visible benchmark, so this normalizes whatever the room provides into a small set
 * of anchors (Maps ETA → Host → Oracle) with absolute arrival times, plus the
 * formatting + diff helpers the picker and challenge card share.
 */

export type BenchmarkKey = 'maps' | 'host' | 'oracle';

export type Benchmark = {
  key: BenchmarkKey;
  label: string;
  date: Date;
  verified?: boolean;
  provider?: string | null;
};

export type ArrivalBenchmarks = {
  anchorDate: Date;
  maps?: Benchmark;
  host?: Benchmark;
  oracle?: Benchmark;
  ordered: Benchmark[];
  primary: Benchmark;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Prefer the server-normalized `room.benchmarks`; fall back to deriving a Maps ETA
 * from the route duration for rooms created before benchmarks were persisted.
 */
export function deriveArrivalBenchmarks(room: any): ArrivalBenchmarks | null {
  if (!room) return null;
  const b = room.benchmarks;
  let maps: Benchmark | undefined;
  let host: Benchmark | undefined;
  let oracle: Benchmark | undefined;

  if (b) {
    const mapsDate = parseDate(b.mapsEta?.arrivalTime);
    if (mapsDate) {
      maps = {
        key: 'maps',
        label: b.mapsEta.label ?? (b.mapsEta.verified ? 'Maps' : 'Route estimate'),
        date: mapsDate,
        verified: !!b.mapsEta.verified,
        provider: b.mapsEta.provider ?? null,
      };
    }
    const hostDate = parseDate(b.hostPrediction?.arrivalTime);
    if (hostDate) host = { key: 'host', label: 'Host', date: hostDate };
    const oracleDate = parseDate(b.oracle?.arrivalTime);
    if (oracleDate) oracle = { key: 'oracle', label: 'Oracle Bot', date: oracleDate };
  }

  // Fallback for older rooms without a persisted benchmark snapshot.
  if (!maps) {
    const etaSeconds =
      room.route?.estimatedDurationSeconds ??
      room.routeSummary?.estimatedDurationSeconds ??
      (typeof room.baselineValue === 'number' ? room.baselineValue : null);
    if (etaSeconds) {
      const anchor =
        parseDate(b?.anchorStartAt) ??
        parseDate(room.journeyScheduledStartAt) ??
        parseDate(room.predictionCloseTime) ??
        new Date();
      maps = {
        key: 'maps',
        label: 'Route estimate',
        date: new Date(anchor.getTime() + etaSeconds * 1000),
        verified: false,
        provider: null,
      };
    }
  }

  const primary = maps ?? host ?? oracle;
  if (!primary) return null;

  const ordered = [maps, host, oracle].filter((x): x is Benchmark => !!x);
  return { anchorDate: primary.date, maps, host, oracle, ordered, primary };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 12-hour clock, manual formatting so it works identically on web + Hermes. */
export function formatClock(date: Date, withSeconds = true): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const s = date.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return withSeconds ? `${h}:${mm}:${ss} ${ampm}` : `${h}:${mm} ${ampm}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today" / "Tomorrow" / "13 July" — never asks the user to think about the date. */
export function formatDateLabel(date: Date): string {
  const diffDays = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Signed human diff, e.g. "+4m 30s", "-30s", "same". */
export function diffLabel(prediction: Date, benchmark: Date): string {
  const deltaSeconds = Math.round((prediction.getTime() - benchmark.getTime()) / 1000);
  if (deltaSeconds === 0) return 'same';
  const sign = deltaSeconds > 0 ? '+' : '-';
  const abs = Math.abs(deltaSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const body = m > 0 ? (s > 0 ? `${m}m ${s}s` : `${m}m`) : `${s}s`;
  return `${sign}${body}`;
}
