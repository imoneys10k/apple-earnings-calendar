import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: app } = await import(workerUrl.href);
  return app;
}

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

test("server-renders the earnings subscription page", async () => {
  const app = await worker();
  const response = await app.fetch(new Request("http://localhost/"), {}, context);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /美股财报日历订阅/);
  assert.match(html, /自动来到/);
  assert.match(html, /earnings\.ics/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("returns a valid Apple Calendar feed", async () => {
  const app = await worker();
  const response = await app.fetch(
    new Request("http://localhost/earnings.ics?symbols=ZZZZ&days=1"),
    {},
    context,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/calendar\b/i);
  assert.match(response.headers.get("cache-control") ?? "", /s-maxage=21600/);

  const calendar = await response.text();
  assert.match(calendar, /^BEGIN:VCALENDAR\r\n/);
  assert.match(calendar, /X-WR-CALNAME:美股财报日历/);
  assert.match(calendar, /END:VCALENDAR\r\n$/);
  assert.doesNotMatch(calendar, /ZZZZ/);
});
