// Builds the landing page, index.html at the repo root, from each benchmark's
// results/summary.json. Benchmarks live in benchmarks/<category>/<name>/; the
// page shows the categories in categories.json order, leaving out any with no
// benchmark yet.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { escapeHtml as esc } from "../lib/bench.mjs";
import { fontLinks, pageCss } from "../lib/page.mjs";

const root = new URL("../", import.meta.url);
const site = JSON.parse(readFileSync(new URL("site.json", root), "utf8"));
const categories = JSON.parse(readFileSync(new URL("categories.json", root), "utf8"));

const summaries = readdirSync(new URL("benchmarks/", root))
  .flatMap((category) =>
    readdirSync(new URL(`benchmarks/${category}/`, root)).map(
      (slug) => new URL(`benchmarks/${category}/${slug}/results/summary.json`, root),
    ),
  )
  .filter((file) => existsSync(file))
  .map((file) => JSON.parse(readFileSync(file, "utf8")))
  .sort((a, b) => b.date.localeCompare(a.date));

const card = (s) => `<a class="bench" href="benchmarks/${esc(s.category)}/${esc(s.slug)}/">
  <h3>${esc(s.title)}</h3>
  <p class="note">${esc(s.task)} · ${s.calls} calls · ${esc(s.date)}</p>
  <table class="summary"><tbody>${s.scores
    .map(
      (m) => `<tr><th scope="row"><code>${esc(m.model)}</code>${m.kind === "text" ? ' <span class="kind">text model, for comparison</span>' : ""}</th>
      <td><span class="meter ${esc(m.kind ?? "")}"><span style="width:${(m.right / m.of) * 100}%"></span></span> ${m.right}/${m.of}</td></tr>`,
    )
    .join("")}</tbody></table>
</a>`;

const unknown = summaries.filter((s) => !categories[s.category]);
if (unknown.length) throw new Error(`No category in categories.json for: ${unknown.map((s) => s.slug).join(", ")}`);

const groups = Object.entries(categories)
  .map(([id, c]) => ({ id, ...c, benches: summaries.filter((s) => s.category === id) }))
  .filter((g) => g.benches.length);

const group = (g) => `<section class="category" id="${esc(g.id)}">
<h2>${esc(g.name)}</h2>
<p class="note">${esc(g.about)}</p>
${g.benches.map(card).join("\n")}
</section>`;

const description =
  "Small, reproducible AI model benchmarks on narrow, well-defined tasks, each from a real product feature, with every call published.";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI bench lab</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="AI bench lab">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(site.siteUrl)}">
${summaries[0] ? `<meta property="og:image" content="${esc(site.siteUrl)}benchmarks/${esc(summaries[0].category)}/${esc(summaries[0].slug)}/og.png">` : ""}
<meta name="twitter:card" content="summary_large_image">
${fontLinks}
<style>${pageCss}
.bench { display: block; color: inherit; text-decoration: none; margin-top: 16px; padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
.bench:hover { border-color: var(--accent); }
.category { margin-top: 48px; scroll-margin-top: 24px; }
.category > .note { margin-bottom: 0; }
.bench h3 { margin: 0 0 4px; font-size: 20px; }
.bench table { margin-top: 12px; }
.bench th { font-weight: 400; }
.bench td { white-space: nowrap; text-align: right; font-family: var(--font-data); }
.meter { display: inline-block; width: 120px; height: 8px; background: var(--line); border-radius: 4px; vertical-align: middle; margin-right: 10px; overflow: hidden; }
.meter span { display: block; height: 100%; background: var(--accent); }
.meter.text span { background: var(--muted); }
.bench th .kind { display: block; font-size: 13px; color: var(--muted); }
@media (max-width: 560px) { .meter { width: 56px; } }
</style>
</head>
<body>
<main>
<h1>AI bench lab</h1>
<p class="lede">Small benchmarks of AI models on narrow, well-defined tasks. Each one comes from a real feature, runs every
case several times through the <a href="https://vercel.com/docs/ai-gateway">Vercel AI Gateway</a>, and
publishes every call it made.</p>
${groups.map(group).join("\n")}
<footer>Code, raw data and how to rerun: <a href="${esc(site.repoUrl)}">${esc(site.repoUrl.replace("https://", ""))}</a>. Built by <a href="https://github.com/NicoGrapsas">Nico Grapsas</a> with <a href="https://claude.com/claude-code">Claude Code</a>.</footer>
</main>
</body>
</html>
`;

writeFileSync(new URL("index.html", root), html);
console.log(`index.html: ${summaries.length} benchmark(s)`);
