import { fetchEarnings, parseDays, parseSymbols } from "../../lib/earnings";

export const dynamic = "force-dynamic";
export const runtime = "edge";

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n");
}

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + 1));
  return `${result.getUTCFullYear()}${String(result.getUTCMonth() + 1).padStart(2, "0")}${String(result.getUTCDate()).padStart(2, "0")}`;
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

function makeCalendar(events: Awaited<ReturnType<typeof fetchEarnings>>, symbols: string[], days: number) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const filterLabel = symbols.length ? `（${symbols.join(", ")}）` : "（全量）";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apple Earnings Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:美股财报日历",
    "X-WR-TIMEZONE:Asia/Shanghai",
    "X-WR-CALDESC:自动更新的美股财报日历",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const event of events) {
    const uid = `${event.symbol}-${event.date}-earnings@apple-earnings-calendar`;
    const description = [
      `公司：${event.name}`,
      `财报时段：${event.timing}`,
      event.fiscalQuarterEnding ? `财季截止：${event.fiscalQuarterEnding}` : "",
      event.epsForecast ? `市场 EPS 预期：${event.epsForecast}` : "",
      event.estimateCount ? `统计机构数：${event.estimateCount}` : "",
      "数据来源：Nasdaq Earnings Calendar",
    ].filter(Boolean).join("\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `LAST-MODIFIED:${now}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${nextDate(event.date)}`,
      `SUMMARY:${escapeText(`[${event.timing}] ${event.symbol} · ${event.name}`)}`,
      `DESCRIPTION:${escapeText(description)}`,
      "URL:https://www.nasdaq.com/market-activity/earnings",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = parseSymbols(url.searchParams.get("symbols"));
  const days = parseDays(url.searchParams.get("days"));

  try {
    const events = await fetchEarnings({ symbols, days });
    return new Response(makeCalendar(events, symbols, days), {
      headers: {
        "Cache-Control": "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400",
        "Content-Disposition": "inline; filename=apple-earnings.ics",
        "Content-Type": "text/calendar; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Failed to build earnings calendar", error);
    return new Response("Unable to fetch the earnings calendar right now.", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
