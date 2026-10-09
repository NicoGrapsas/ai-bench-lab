// Builds the landing page, index.html at the repo root, from each benchmark's
// results/summary.json.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { escapeHtml as esc } from "../lib/bench.mjs";
import { fontLinks, pageCss } from "../lib/page.mjs";

const root = new URL("../", import.meta.url);
const site = JSON.parse(readFileSync(new URL("site.json", root), "utf8"));

const summaries = readdirSync(new URL("benchmarks/", root))
  .map((slug) => new URL(`benchmarks/${slug}/results/summary.json`, root))
  .filter((file) => existsSync(file))
  .map((file) => JSON.parse(readFileSync(file, "utf8")))
  .sort((a, b) => b.date.localeCompare(a.date));

const card = (s) => `<a class="bench" href="benchmarks/${esc(s.slug)}/">
  <h3>${esc(s.title)}</h3>
  <p class="note">${esc(s.task)} · ${s.calls} calls · ${esc(s.date)}</p>
  <table class="summary"><tbody>${s.scores
    .map(
      (m) => `<tr><th scope="row"><code>${esc(m.model)}</code></th>
      <td><span class="meter"><span style="width:${(m.right / m.of) * 100}%"></span></span> ${m.right}/${m.of}</td></tr>`,
    )
    .join("")}</tbody></table>
</a>`;

const description =
  "Small, reproducible benchmarks of decision models on the Vercel AI Gateway, each from a real product feature.";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Decision model benchmarks</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="Decision model benchmarks">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(site.siteUrl)}">
${summaries[0] ? `<meta property="og:image" content="${esc(site.siteUrl)}benchmarks/${esc(summaries[0].slug)}/og.png">` : ""}
<meta name="twitter:card" content="summary_large_image">
${fontLinks}
<style>${pageCss}
.bench { display: block; color: inherit; text-decoration: none; margin-top: 16px; padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
.bench:hover { border-color: var(--accent); }
.bench h3 { margin: 0 0 4px; font-size: 20px; }
.bench table { margin-top: 12px; }
.bench th { font-weight: 400; }
.bench td { white-space: nowrap; text-align: right; font-family: var(--font-data); }
.meter { display: inline-block; width: 120px; height: 8px; background: var(--line); border-radius: 4px; vertical-align: middle; margin-right: 10px; overflow: hidden; }
.meter span { display: block; height: 100%; background: var(--accent); }
@media (max-width: 560px) { .meter { width: 56px; } }
</style>
</head>
<body>
<main>
<h1>Decision model benchmarks</h1>
<p class="lede">Decision models answer typed questions (yes or no, pick one, a score) with probabilities
instead of text. Each benchmark here comes from a real feature, runs every case several times through the
<a href="https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-decisions">Vercel AI Gateway</a>, and
publishes its raw data.</p>
<h2>Benchmarks</h2>
${summaries.map(card).join("\n")}
<footer>Code, raw data and how to rerun: <a href="${esc(site.repoUrl)}">${esc(site.repoUrl.replace("https://", ""))}</a>. Built by <a href="https://github.com/NicoGrapsas">Nico Grapsas</a> with <a href="https://claude.com/claude-code">Claude Code</a>.</footer>
</main>
</body>
</html>
`;

writeFileSync(new URL("index.html", root), html);
console.log(`index.html: ${summaries.length} benchmark(s)`);
