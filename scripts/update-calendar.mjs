const API_URL = "https://api.nasdaq.com/api/calendar/earnings?date=";
const CALENDAR_NAME = "Apple Earnings Calendar";
const CALENDAR_URL = "https://cbrl.bydick.com/earnings.ics";
const MAX_DAYS = 60;
const MAX_CONCURRENT_DATES = 6;
const REQUEST_TIMEOUT_MS = 10_000;

const requestedDays = Math.min(
  MAX_DAYS,
  Math.max(1, Number.parseInt(process.env.DAYS ?? "60", 10) || 60),
);

const requestedSymbols = new Set(
  (process.env.SYMBOLS ?? "")
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean),
);

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function escapeText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/g, "\\n");
}

function toDateValue(value) {
  return String(value).replaceAll("-", "");
}

function nextDateValue(value) {
  const next = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10).replaceAll("-", "");
}

async function fetchDate(date) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}${date}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.nasdaq.com/",
        "User-Agent": "Mozilla/5.0 (compatible; AppleEarningsCalendar/1.0)",
      },
    });

    if (!response.ok) throw new Error(`Nasdaq returned ${response.status}`);
    const payload = await response.json();
    return payload?.data?.rows ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRow(row, date) {
  const symbol = String(row.symbol ?? row.Symbol ?? "").trim().toUpperCase();
  if (!symbol || (requestedSymbols.size > 0 && !requestedSymbols.has(symbol))) return null;

  const company = String(row.name ?? row.Name ?? row.companyName ?? "").trim();
  const time = String(row.time ?? row.Time ?? "").trim();
  const eps = String(row.epsForecast ?? row.eps ?? row.EPSForecast ?? "").trim();
  const fiscalQuarter = String(row.fiscalQuarterEnding ?? row.fiscalQuarter ?? "").trim();
  const market = time.toLowerCase().includes("before") || time.toLowerCase().includes("pre")
    ? "盘前"
    : time.toLowerCase().includes("after") || time.toLowerCase().includes("post")
      ? "盘后"
      : "财报";

  const notes = [
    company,
    time ? `时间：${time}` : "",
    eps && eps !== "N/A" ? `预期 EPS：${eps}` : "",
    fiscalQuarter ? `财季：${fiscalQuarter}` : "",
    `来源：Nasdaq 财报日历`,
  ].filter(Boolean);

  return {
    date,
    symbol,
    summary: `${market} ${symbol}${company ? ` · ${company}` : ""}`,
    description: [...notes, `订阅地址：${CALENDAR_URL}`].join("\n"),
  };
}

async function main() {
  const start = new Date();
  const dates = Array.from({ length: requestedDays }, (_, index) => formatDate(addDays(start, index)));
  const events = [];
  let successfulDates = 0;

  for (let index = 0; index < dates.length; index += MAX_CONCURRENT_DATES) {
    const batch = dates.slice(index, index + MAX_CONCURRENT_DATES);
    const results = await Promise.allSettled(batch.map((date) => fetchDate(date)));

    results.forEach((result, resultIndex) => {
      if (result.status === "fulfilled") {
        successfulDates += 1;
        for (const row of result.value) {
          const event = normalizeRow(row, batch[resultIndex]);
          if (event) events.push(event);
        }
      } else {
        console.warn(`Skipping ${batch[resultIndex]}: ${result.reason?.message ?? result.reason}`);
      }
    });
  }

  const minimumSuccessfulDates = Math.max(1, Math.ceil(dates.length / 2));
  if (successfulDates < minimumSuccessfulDates) {
    throw new Error(`Nasdaq returned too few usable dates: ${successfulDates}/${dates.length}`);
  }

  const uniqueEvents = [...new Map(events.map((event) => [`${event.symbol}-${event.date}`, event])).values()]
    .sort((left, right) => left.date.localeCompare(right.date) || left.symbol.localeCompare(right.symbol));
  const generatedAt = new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apple Earnings Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    `X-WR-CALDESC:${escapeText("自动更新的美股财报日历")}`,
    `X-PUBLISHED-TTL:PT6H`,
  ];

  for (const event of uniqueEvents) {
    const startValue = toDateValue(event.date);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.symbol}-${startValue}@cbrl.bydick.com`,
      `DTSTAMP:${generatedAt}`,
      `DTSTART;VALUE=DATE:${startValue}`,
      `DTEND;VALUE=DATE:${nextDateValue(startValue)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      `DESCRIPTION:${escapeText(event.description)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR", "");
  const output = lines.join("\r\n");
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("docs", { recursive: true });
  await writeFile("docs/earnings.ics", output, "utf8");
  console.log(`Wrote ${uniqueEvents.length} events across ${successfulDates}/${dates.length} dates`);
}

await main();
