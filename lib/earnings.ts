const NASDAQ_ENDPOINT = "https://api.nasdaq.com/api/calendar/earnings";
const EASTERN_TIME_ZONE = "America/New_York";
const NASDAQ_TIMEOUT_MS = 8_000;
const MAX_CONCURRENT_DATES = 8;

export type NasdaqEarningsRow = {
  symbol?: string;
  name?: string;
  time?: string;
  fiscalQuarterEnding?: string;
  epsForecast?: string;
  noOfEsts?: string;
};

export type EarningsEvent = {
  date: string;
  symbol: string;
  name: string;
  timing: string;
  fiscalQuarterEnding: string;
  epsForecast: string;
  estimateCount: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function dateInEasternTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateRange(startDate: string, days: number) {
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const dates: string[] = [];

  for (let index = 0; index < days; index += 1) {
    const date = addDays(start, index);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      dates.push(`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`);
    }
  }

  return dates;
}

async function fetchDate(date: string): Promise<NasdaqEarningsRow[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NASDAQ_TIMEOUT_MS);

  try {
    const response = await fetch(`${NASDAQ_ENDPOINT}?date=${date}`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.nasdaq.com/market-activity/earnings",
        "User-Agent": "Apple-Earnings-Calendar/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Nasdaq returned ${response.status} for ${date}`);
    }

    const payload = (await response.json()) as {
      data?: { rows?: NasdaqEarningsRow[] | null };
    };

    return payload.data?.rows ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTiming(value = "") {
  if (value.includes("pre-market")) return "盘前";
  if (value.includes("after-hours")) return "盘后";
  return "时间未公布";
}

export async function fetchEarnings({
  startDate = dateInEasternTime(),
  days = 45,
  symbols = [],
}: {
  startDate?: string;
  days?: number;
  symbols?: string[];
} = {}) {
  const wantedSymbols = new Set(symbols.map((symbol) => symbol.toUpperCase()));
  const dates = dateRange(startDate, Math.min(Math.max(days, 1), 60));
  const rowsByDate: { date: string; rows: NasdaqEarningsRow[] }[] = [];
  let failedDates = 0;

  for (let index = 0; index < dates.length; index += MAX_CONCURRENT_DATES) {
    const batch = dates.slice(index, index + MAX_CONCURRENT_DATES);
    const results = await Promise.allSettled(batch.map((date) => fetchDate(date)));

    results.forEach((result, resultIndex) => {
      const date = batch[resultIndex];
      if (result.status === "fulfilled") {
        rowsByDate.push({ date, rows: result.value });
      } else {
        failedDates += 1;
        console.warn(`Skipping Nasdaq earnings date ${date}`, result.reason);
      }
    });
  }

  if (!rowsByDate.length && dates.length) {
    throw new Error("Nasdaq earnings calendar unavailable for all requested dates");
  }

  if (failedDates) {
    console.warn(`Nasdaq earnings calendar skipped ${failedDates} date(s)`);
  }

  return rowsByDate
    .flatMap(({ date, rows }) => rows.map((row) => ({
      date,
      symbol: row.symbol?.trim().toUpperCase() ?? "",
      name: row.name?.trim() ?? "",
      timing: normalizeTiming(row.time),
      fiscalQuarterEnding: row.fiscalQuarterEnding?.trim() ?? "",
      epsForecast: row.epsForecast?.trim() ?? "",
      estimateCount: row.noOfEsts?.trim() ?? "",
    })))
    .filter((event) => event.symbol && (!wantedSymbols.size || wantedSymbols.has(event.symbol)))
    .sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol));
}

export function parseSymbols(value: string | null | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^[A-Z0-9.$_-]{1,12}$/.test(symbol))
    .slice(0, 100);
}

export function parseDays(value: string | null | undefined) {
  const days = Number.parseInt(value ?? "45", 10);
  return Number.isFinite(days) ? Math.min(Math.max(days, 1), 60) : 45;
}
