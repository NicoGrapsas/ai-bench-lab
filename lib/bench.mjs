// Helpers every benchmark shares: the gateway client, a bounded worker pool
// for the calls, and the small formatting the reports use.

import { createGateway } from "@ai-sdk/gateway";

const gatewayFromEnv = () => {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.error("Set AI_GATEWAY_API_KEY (see .env.example).");
    process.exit(1);
  }
  return createGateway({ apiKey });
};

const runsFromArgs = (fallback = 10) => {
  const i = process.argv.indexOf("--runs");
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};

// Runs `task` over `jobs` with at most `concurrency` calls in flight and
// returns the results in the order of `jobs`.
const pool = async (jobs, task, concurrency = 6) => {
  const results = new Array(jobs.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await task(jobs[i]);
      done++;
      if (process.stdout.isTTY) process.stdout.write(`\r${done}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (process.stdout.isTTY) process.stdout.write("\n");
  return results;
};

const fmt = (n) => n.toFixed(2);

const range = (values) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return fmt(min) === fmt(max) ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export { escapeHtml, fmt, gatewayFromEnv, pool, range, runsFromArgs };
