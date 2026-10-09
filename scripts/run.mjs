// npm run bench -- <benchmark> [--runs N]   calls the models, then rebuilds the pages
// npm run report                            rebuilds every page from saved results
// npm run list                              lists the benchmarks

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
const benchmarks = readdirSync(new URL("benchmarks/", root)).sort();
const node = (file, args = []) =>
  execFileSync(process.execPath, [new URL(file, root).pathname, ...args], { stdio: "inherit" });

const [command, slug, ...rest] = process.argv.slice(2);

if (command === "list") {
  console.log(benchmarks.join("\n"));
} else if (command === "bench") {
  if (!benchmarks.includes(slug)) {
    console.error(`Usage: npm run bench -- <benchmark> [--runs N]\nBenchmarks: ${benchmarks.join(", ")}`);
    process.exit(1);
  }
  node(`benchmarks/${slug}/bench.mjs`, rest);
  node(`benchmarks/${slug}/report.mjs`);
  node("scripts/site.mjs");
} else if (command === "report") {
  for (const b of benchmarks) node(`benchmarks/${b}/report.mjs`);
  node("scripts/site.mjs");
}
