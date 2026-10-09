// npm run bench -- <category>/<benchmark> [--runs N]   calls the models, then rebuilds the pages
// npm run report                            rebuilds every page from saved results
// npm run list                              lists the benchmarks

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const root = new URL("../", import.meta.url);
// Each benchmark lives in benchmarks/<category>/<name>/ and is named by that
// path. A bare <name> is accepted when no other category has one.
const benchmarks = readdirSync(new URL("benchmarks/", root))
  .flatMap((category) => readdirSync(new URL(`benchmarks/${category}/`, root)).map((name) => `${category}/${name}`))
  .sort();
const node = (file, args = []) =>
  execFileSync(process.execPath, [new URL(file, root).pathname, ...args], { stdio: "inherit" });

const [command, given, ...rest] = process.argv.slice(2);
const matches = benchmarks.filter((b) => b === given || b.endsWith(`/${given}`));
const slug = matches.length === 1 ? matches[0] : undefined;

if (command === "list") {
  console.log(benchmarks.join("\n"));
} else if (command === "bench") {
  if (!slug) {
    console.error(`Usage: npm run bench -- <category>/<benchmark> [--runs N]\nBenchmarks: ${benchmarks.join(", ")}`);
    process.exit(1);
  }
  node(`benchmarks/${slug}/bench.mjs`, rest);
  node(`benchmarks/${slug}/report.mjs`);
  node("scripts/site.mjs");
} else if (command === "report") {
  for (const b of benchmarks) node(`benchmarks/${b}/report.mjs`);
  node("scripts/site.mjs");
}
