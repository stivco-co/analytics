// Lightweight health check for every Stivco site. No browser, no dependencies.
import { readFileSync } from "node:fs";

const sites = JSON.parse(readFileSync(new URL("./sites.json", import.meta.url), "utf8"));
const failures = [];

async function get(url) {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "user-agent": "stivco-smoke/1.0" } });
  return { res, body: res.ok ? await res.text() : "" };
}

for (const site of sites) {
  const problems = [];
  try {
    const { res, body } = await get(site);
    const finalHost = new URL(res.url).host;
    if (res.status !== 200) problems.push(`HTTP ${res.status}`);
    if (!/<title>[^<]+<\/title>/i.test(body)) problems.push("missing <title>");
    const canonical = body.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
      || body.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
    if (canonical && new URL(canonical[1], res.url).host !== finalHost) {
      problems.push(`canonical host ${new URL(canonical[1], res.url).host} differs from served host ${finalHost}`);
    }
    const robots = await fetch(new URL("/robots.txt", res.url), { signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!robots || robots.status !== 200) problems.push(`robots.txt HTTP ${robots ? robots.status : "error"}`);
  } catch (e) {
    problems.push(`request failed: ${e.message}`);
  }
  console.log(`${problems.length ? "FAIL" : "ok  "} ${site}${problems.length ? " - " + problems.join("; ") : ""}`);
  if (problems.length) failures.push(site);
}

if (failures.length) {
  console.error(`\n${failures.length} site(s) unhealthy`);
  process.exit(1);
}
