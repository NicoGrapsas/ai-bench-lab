// Builds index.html, this benchmark's shareable page, and results/summary.json,
// the line the repo's landing page shows for it, from results/raw.json.
//
// The page tells the investigation in order: the task, the case that started
// it, each theory tested with one change, and what we concluded. Every number
// on it is computed from the saved runs; the sentences around them were
// written against the run committed with them.

import { readFile, writeFile } from "node:fs/promises";
import { escapeHtml as esc, fmt } from "../../../lib/bench.mjs";
import { fontLinks, pageCss } from "../../../lib/page.mjs";

const here = new URL(".", import.meta.url);
// The folder is benchmarks/<category>/<slug>/.
const [category, slug] = here.pathname.split("/").filter(Boolean).slice(-2);
const categories = JSON.parse(await readFile(new URL("../../../categories.json", here), "utf8"));
const site = JSON.parse(await readFile(new URL("../../../site.json", here), "utf8"));
const siteUrl = `${site.siteUrl}benchmarks/${category}/${slug}/`;
const sourceUrl = `${site.repoUrl}/blob/main/benchmarks/${category}/${slug}/`;

const data = JSON.parse(await readFile(new URL("results/raw.json", here), "utf8"));
const { scenarios, results, runs, question } = data;
const day = data.date.slice(0, 10);

const luna = { id: "openai/gpt-6-luna-decisions", name: "GPT-6 Luna Decisions", short: "Luna", price: "$0.10" };
const jev = { id: "typesafe-ai/jev", name: "jev", short: "jev", price: "$0.042" };
const models = [jev, luna];
const scenarioById = Object.fromEntries(scenarios.map((s) => [s.id, s]));

const runsOf = (scenario, message, model) =>
  results.filter((r) => r.scenario === scenario && r.message === message && r.model === model.id);
const mean = (rows, option) =>
  rows.reduce((sum, r) => sum + (r.probabilities?.[option] ?? 0), 0) / rows.length;
const isRight = (r) => r.choice === scenarioById[r.scenario].target;
const score = (model, filter = () => true) => {
  const rows = results.filter((r) => r.model === model.id && filter(r));
  return { right: rows.filter(isRight).length, of: rows.length };
};

// The conversation a case sends, as the reader should see it: the user's turn,
// and the first sentence of the assistant's reply when there is one.
// English renderings of the Spanish turns, for readers who do not speak it.
const translations = {
  "cuanto estoy gastando en telefonia por mes?": "how much am I spending on my phone each month?",
  "cuanto estoy gastando en telefonia por mes? tengo movistar y personal flow":
    "how much am I spending on my phone each month? I have Movistar and Personal Flow",
  "cuanto estoy gastando en telefonia por mes? tengo verizon y t-mobile":
    "how much am I spending on my phone each month? I have Verizon and T-Mobile",
  "Para calcularlo sumá tus facturas mensuales de Movistar y Personal Flow. …":
    "To work it out, add up your monthly bills (facturas) from Movistar and Personal Flow. …",
  "Para calcularlo sumá tus facturas mensuales de Verizon y T-Mobile. …":
    "To work it out, add up your monthly bills (facturas) from Verizon and T-Mobile. …",
};

const conversation = (scenarioId, message) => {
  const state = scenarioById[scenarioId].messages[message];
  const turns = state.startsWith("user: ")
    ? state.split("\n\n").map((turn) => {
        const [role, ...rest] = turn.split(": ");
        return { role, text: rest.join(": ") };
      })
    : [{ role: "user", text: state }];
  return turns
    .map(({ role, text }) => {
      const shown = role === "assistant" ? `${text.split(/(?<=\.) /)[0]} …` : text;
      const translation = translations[shown];
      return `<span class="turn ${role}"><span class="who">${role === "user" ? "User" : "Assistant"}</span>${esc(shown)}${
        translation ? `<span class="tr">${esc(translation)}</span>` : ""
      }</span>`;
    })
    .join("");
};

const table = (head, rows, className = "") => `<div class="scroll"><table class="${className}">
  <thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.join("")}</tr>`).join("")}</tbody>
</table></div>`;


// One row per case and model, one column per answer option. The option with
// the highest mean probability is highlighted: green when it is the right
// folder, red when it is not. `folderColumn` adds the third folder's name for
// questions that mix scenarios.
const optionsTable = (cases, { folderColumn = false } = {}) => {
  const head = [
    "Model",
    "Personal",
    "Ideas",
    folderColumn ? "Third folder" : esc(scenarioById[cases[0][0]].target),
    "None",
  ];
  const rows = cases.flatMap(([scenarioId, message]) => {
    const label = conversation(scenarioId, message);
    const scenario = scenarioById[scenarioId];
    const options = [...scenario.folders, "none"];
    const modelRows = models.map((model) => {
      const runRows = runsOf(scenarioId, message, model);
      const means = options.map((o) => mean(runRows, o));
      const top = means.indexOf(Math.max(...means));
      const cells = means.map((v, j) => {
        if (j !== top) return `<td class="num">${fmt(v)}</td>`;
        const ok = options[j] === scenario.target;
        return `<td class="num win ${ok ? "ok" : "miss"}">${ok ? "✓" : "✗"} ${fmt(v)}</td>`;
      });
      return [`<td class="model">${esc(model.short)}</td>`, ...cells];
    });
    const conv = [
      `<th scope="rowgroup" colspan="${head.length}" class="conv">${label}${
        folderColumn ? `<span class="folder">Third folder: ${esc(scenario.target)}</span>` : ""
      }</th>`,
    ];
    return [conv, ...modelRows];
  });
  return table(head, rows, "options");
};


// What the reader needs to know about a folder whose name is not English.
const folderNotes = { Facturas: "Spanish for bills" };

const optionName = (option) => (option === "none" ? "None" : option);

const folderIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;

// The options a scenario offers, as the user would see them: one chip per
// folder, the right one marked, then "None of these".
const folderRow = (scenarioId) => {
  const scenario = scenarioById[scenarioId];
  const chips = scenario.folders.map((folder) => {
    const right = folder === scenario.target;
    const note = folderNotes[folder] ? ` <span class="note-in">(${esc(folderNotes[folder])})</span>` : "";
    return `<li class="folder${right ? " right" : ""}">${folderIcon}<span>${esc(folder)}${note}</span>${
      right ? '<span class="sr">, the right folder</span>' : ""
    }</li>`;
  });
  return `<ul class="folders" aria-label="Folders">${chips.join("")}<li class="folder none-of">None of these</li></ul>`;
};

// The conversation a case sends, as chat bubbles. The part a message adds to
// the bare question is marked, and Spanish turns carry an English rendering.
const bubbles = (scenarioId, message) => {
  const scenario = scenarioById[scenarioId];
  const state = scenario.messages[message];
  const [userTurn, assistantTurn] = state.startsWith("user: ")
    ? state.split("\n\n").map((turn) => turn.slice(turn.indexOf(": ") + 2))
    : [state, null];
  const base = scenario.messages.B;
  const added = userTurn.startsWith(base) ? userTurn.slice(base.length) : "";
  const userText = added ? `${esc(base)}<mark>${esc(added)}</mark>` : esc(userTurn);
  const userTr = translations[userTurn];
  const user = `<div class="bubble user"><span class="sr">User: </span>${userText}</div>${
    userTr ? `<div class="bubble-tr user">${esc(userTr)}</div>` : ""
  }`;
  if (!assistantTurn) return `<div class="chat">${user}</div>`;
  const reply = `${assistantTurn.split(/(?<=\.) /)[0]} …`;
  const replyTr = translations[reply];
  return `<div class="chat">${user}<div class="bubble assistant"><span class="sr">Assistant: </span><mark>${esc(reply)}</mark></div>${
    replyTr ? `<div class="bubble-tr">${esc(replyTr)}</div>` : ""
  }</div>`;
};

// One model's answer to a case: every option's mean probability as one
// stacked bar. The right folder is green; a wrong option that won is red.
const bar = (scenarioId, message, model) => {
  const scenario = scenarioById[scenarioId];
  const rows = runsOf(scenarioId, message, model);
  const options = [...scenario.folders, "none"];
  const means = options.map((o) => mean(rows, o));
  const top = means.indexOf(Math.max(...means));
  const right = rows.filter(isRight).length;
  const segments = options
    .map((option, i) => {
      const kind = option === scenario.target ? "target" : i === top ? "wrong" : "other";
      const label = means[i] >= 0.14 ? `${esc(optionName(option))} ${Math.round(means[i] * 100)}%` : "";
      return means[i] > 0.004 ? `<span class="seg ${kind}" style="width:${means[i] * 100}%">${label}</span>` : "";
    })
    .join("");
  const summary = options.map((o, i) => `${optionName(o)} ${Math.round(means[i] * 100)}%`).join(", ");
  const ok = options[top] === scenario.target;
  return `<div class="answer-row">
    <div class="model-name">${esc(model.short)}</div>
    <div class="stack" role="img" aria-label="${esc(`${model.short}: ${summary}`)}">${segments}</div>
    <div class="verdict ${ok ? "ok" : "miss"}"><span aria-hidden="true">${ok ? "✓" : "✗"}</span> ${esc(optionName(options[top]))} · ${right}/${rows.length}</div>
  </div>`;
};

// A case card: the conversation once, then, for each set of folders it was
// run against, the folders and both models' answers.
const caseCard = (message, scenarioIds) => `<article class="case">
  ${bubbles(scenarioIds[0], message)}
  ${scenarioIds
    .map(
      (id) => `<div class="variant">
    ${folderRow(id)}
    ${models.map((m) => bar(id, message, m)).join("")}
  </div>`,
    )
    .join("")}
</article>`;

const cards = (cases) => `<div class="cases">${cases.map(([message, ids]) => caseCard(message, ids)).join("")}</div>`;

const spread = (model) => {
  let maxSpread = 0;
  let changedPick = 0;
  const cases = new Set(results.map((r) => `${r.scenario}|${r.message}`));
  for (const key of cases) {
    const [s, m] = key.split("|");
    const rows = runsOf(s, m, model);
    if (new Set(rows.map((r) => r.choice)).size > 1) changedPick++;
    for (const option of Object.keys(rows[0].probabilities)) {
      const values = rows.map((r) => r.probabilities[option] ?? 0);
      maxSpread = Math.max(maxSpread, Math.max(...values) - Math.min(...values));
    }
  }
  return { maxSpread, changedPick, cases: cases.size };
};

// Figures the conclusions quote, computed from the saved runs.
const rightIn = (model, scenarioId, messages) => {
  const rows = results.filter(
    (r) => r.model === model.id && r.scenario === scenarioId && (!messages || messages.includes(r.message)),
  );
  return `${rows.filter(isRight).length}/${rows.length}`;
};
const pct = (n) => `${Math.round(n * 100)}%`;
const targetRange = (model, scenarioId, messages) => {
  const target = scenarioById[scenarioId].target;
  const values = messages.map((m) => mean(runsOf(scenarioId, m, model), target));
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  return pct(lo) === pct(hi) ? pct(lo) : `${pct(lo)}–${pct(hi)}`;
};
const personalShare = (scenarioId, message) => pct(mean(runsOf(scenarioId, message, luna), "Personal"));
const withoutReply = ["B", "A", "A-us"];
const withReply = ["C", "C-us"];

const theories = [
  {
    id: "language",
    title: "Is it the language?",
    answer: "No. In English, both models get it when the folder is called Bills. Call it Invoices and Luna says none.",
    setup: `The same question in English, with the third folder called <b>Bills</b> and then <b>Invoices</b>.`,
    body: cards([
      ["B", ["en-bills", "en-invoices"]],
      ["A", ["en-bills", "en-invoices"]],
      ["C", ["en-bills", "en-invoices"]],
    ]),
    after: `Luna only finds Invoices once the assistant's reply has said “invoices”. jev finds it every time, but less
      sure of it than of Bills. So the next question: is Luna just matching words?`,
  },
  {
    id: "words",
    title: "Is it just matching words?",
    answer: "For Luna, mostly yes. Take “bills” out of the question and it misses even the Bills folder.",
    setup: `Above, the user said “phone bills”, the Bills folder's own name. Here the user says “phone service”,
      which names neither folder.`,
    body: cards([
      ["B", ["en-service-bills", "en-service-invoices"]],
      ["A", ["en-service-bills", "en-service-invoices"]],
      ["C", ["en-service-bills", "en-service-invoices"]],
    ]),
    after: "jev's picks do not change.",
  },
  {
    id: "carrier",
    title: "Is “Personal Flow” pulling it towards the Personal folder?",
    answer: "No. With Verizon and T-Mobile, Luna leans further towards Personal, not less.",
    setup: `Personal Flow is an Argentine phone plan, and one folder is called Personal. We swapped in US carriers
      and watched Luna's share for Personal.`,
    body: cards([
      ["A", ["en-service-invoices"]],
      ["A-us", ["en-service-invoices"]],
      ["A", ["es-facturas"]],
      ["A-us", ["es-facturas"]],
    ]),
    after: `Luna's Personal goes from ${personalShare("en-service-invoices", "A")} to ${personalShare("en-service-invoices", "A-us")}
      in English and from ${personalShare("es-facturas", "A")} to ${personalShare("es-facturas", "A-us")} in Spanish, where it
      becomes Luna's pick. Our guess, untested: it reads “how much am I spending” as a personal finance question.`,
  },
  {
    id: "repeat",
    title: "Do the answers repeat?",
    answer: "Yes. Neither model changed its pick between runs.",
    setup: `Every case ran ${runs} times.`,
    body: `<div class="scroll"><table><thead><tr><th>Model</th><th>Pick changed</th><th>Largest swing in a probability</th></tr></thead><tbody>${models
      .map((m) => {
        const s = spread(m);
        return `<tr><td>${esc(m.name)}</td><td class="data">${s.changedPick} of ${s.cases} cases</td><td class="data">${fmt(s.maxSpread)}</td></tr>`;
      })
      .join("")}</tbody></table></div>`,
    after: "Luna returns exactly the same numbers every time. jev's move a little.",
  },
];

const conclusions = [
  `<b>The folder's name matters more than the language.</b> Luna finds the folder when its name is the word the
  user wrote: Bills for “phone bills”, ${rightIn(luna, "en-bills")}. When the folder is called Facturas or Invoices
  it mostly says none fits (${rightIn(luna, "es-facturas")} and ${rightIn(luna, "en-invoices")}), even in English.`,
  `<b>jev never picked a wrong folder, but its confidence shows the same pull.</b> It gives Bills
  ${targetRange(jev, "en-bills", [...withoutReply, ...withReply])}. Invoices, a word the user never said, drops to
  ${targetRange(jev, "en-invoices", withoutReply)}, and climbs back to ${targetRange(jev, "en-invoices", withReply)} once the
  assistant's reply says “invoices”. The word moves jev's confidence, not its answer. In Spanish, where Facturas is
  the everyday word, it stays at ${targetRange(jev, "es-facturas", [...withoutReply, ...withReply])}.`,
  `<b>Without the folder's word, Luna struggles even with an obvious match.</b> When the user says “phone service”,
  Luna gets Bills ${rightIn(luna, "en-service-bills")} and Invoices ${rightIn(luna, "en-service-invoices")}.`,
  `<b>The carrier is not the cause.</b> With Verizon and T-Mobile instead of Personal Flow, Luna leans further towards
  the Personal folder, not less.`,
  `<b>For this feature,</b> a folder suggestion should not depend on the user typing the folder's exact name. In
  this test, only jev met that bar.`,
];

const allResults = scenarios
  .map((s) => `<h3>${esc(s.label)}</h3>${optionsTable(Object.keys(s.messages).map((m) => [s.id, m]))}`)
  .join("");

const total = Object.fromEntries(models.map((m) => [m.id, score(m)]));
const title = `jev vs GPT-6 Luna Decisions: ${total[jev.id].right}/${total[jev.id].of} vs ${total[luna.id].right}/${total[luna.id].of} on folder classification`;
const description =
  "A small reproducible bench of the Decisions API on the Vercel AI Gateway: which folder does a chat about phone spending go in?";

const scoreRow = (m) => {
  const t = total[m.id];
  return `<div class="score-row">
    <div class="score-name"><b>${esc(m.name)}</b><code>${esc(m.id)}</code></div>
    <div class="score-bar" role="img" aria-label="${t.right} of ${t.of} right"><span style="width:${(t.right / t.of) * 100}%"></span></div>
    <div class="score-num"><b>${t.right}</b>/${t.of}</div>
    <div class="score-price">${m.price} / 1M input tokens</div>
  </div>`;
};

const section = (s, eyebrow) => `<section class="q" id="${s.id}">
  <p class="eyebrow">${eyebrow}</p>
  <h2>${s.title}</h2>
  <p class="answer">${s.answer}</p>
  <p>${s.setup}</p>
  ${s.body}
  <p class="after">${s.after}</p>
</section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>jev vs Luna Decisions</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(siteUrl)}">
<meta property="og:image" content="${esc(siteUrl)}og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(siteUrl)}og.png">
${fontLinks}
<style>${pageCss}
:root { --bar-target: #2f9e6a; --bar-wrong: #d4573a; --bar-other: #d3d7de; --bar-other-ink: #3c414c; --bubble: #2b4fd6; --bubble-ink: #ffffff; --reply: #eceef3; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --bar-target: #2f9e6a; --bar-wrong: #cf5638; --bar-other: #343944; --bar-other-ink: #c9ced8; --bubble: #3550c9; --reply: #252932; }
}
:root[data-theme="dark"] { --bar-target: #2f9e6a; --bar-wrong: #cf5638; --bar-other: #343944; --bar-other-ink: #c9ced8; --bubble: #3550c9; --reply: #252932; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.scores { display: grid; gap: 14px; margin: 28px 0 8px; padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
.score-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name num" "bar bar" "price price"; gap: 4px 12px; align-items: end; }
.score-name { grid-area: name; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; min-width: 0; }
.score-name code { color: var(--muted); }
.score-num { grid-area: num; text-align: right; font: 400 15px var(--font-data); color: var(--muted); }
.score-num b { font: 800 30px var(--font-body); color: var(--ink); letter-spacing: -0.02em; }
.score-bar { grid-area: bar; height: 10px; background: var(--line); border-radius: 5px; overflow: hidden; }
.score-bar span { display: block; height: 100%; background: var(--accent); }
.score-price { grid-area: price; font-size: 13px; color: var(--muted); }
section.q { margin-top: 64px; scroll-margin-top: 24px; }
section.q .answer { font-size: 19px; font-weight: 600; margin: 0 0 12px; }
section.q .after { font-size: 15px; color: var(--muted); margin-top: 16px; }
.part { margin-top: 80px; padding-top: 20px; border-top: 2px solid var(--ink); }
.part + section.q { margin-top: 32px; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 12px 0 0; padding: 0; list-style: none; font-size: 14px; color: var(--muted); }
.legend li { display: flex; align-items: center; gap: 6px; }
.legend i { width: 14px; height: 14px; border-radius: 3px; display: inline-block; }
.cases { display: grid; gap: 14px; margin-top: 16px; }
.case { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: grid; gap: 14px; min-width: 0; }
.chat { display: flex; flex-direction: column; gap: 4px; }
.bubble { max-width: 85%; padding: 8px 12px; font-size: 15px; line-height: 1.45; }
.bubble.user { align-self: flex-end; background: var(--bubble); color: var(--bubble-ink); border-radius: 14px 14px 4px 14px; }
.bubble.assistant { align-self: flex-start; background: var(--reply); border-radius: 14px 14px 14px 4px; margin-top: 6px; }
.bubble mark, .added { background: rgba(255, 255, 255, 0.24); color: inherit; padding: 1px 4px; border-radius: 4px; }
.added { background: var(--bubble); color: var(--bubble-ink); box-shadow: inset 0 0 0 20px rgba(255, 255, 255, 0.24); font-size: 13px; }
.bubble.assistant mark { background: transparent; padding: 0; }
.bubble-tr { font-size: 13px; color: var(--muted); max-width: 85%; }
.bubble-tr.user { align-self: flex-end; text-align: right; }
.variant { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
.folders { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 4px; padding: 0; list-style: none; }
.folder { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 7px; font-size: 14px; font-weight: 500; }
.folder.right { border: 2px solid var(--ok); color: var(--ok); background: var(--ok-bg); }
.folder.none-of { border-style: dashed; color: var(--muted); font-weight: 400; }
.note-in { font-weight: 400; color: var(--muted); }
.answer-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) 150px; gap: 10px; align-items: center; }
.model-name { font: 500 13px var(--font-data); }
.stack { display: flex; height: 26px; border-radius: 4px; overflow: hidden; background: var(--line); }
.seg { display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap; font: 500 12px var(--font-data); }
.seg + .seg { border-left: 1px solid var(--surface); }
.seg.target { background: var(--bar-target); color: #ffffff; }
.seg.wrong { background: var(--bar-wrong); color: #ffffff; }
.seg.other { background: var(--bar-other); color: var(--bar-other-ink); }
.verdict { font: 600 13px var(--font-data); white-space: nowrap; }
.verdict.ok { color: var(--ok); }
.verdict.miss { color: var(--miss); }
.conclusions { margin: 16px 0 0; padding-left: 24px; display: grid; gap: 14px; }
.conclusions li::marker { font: 600 15px var(--font-data); color: var(--accent); }
details { margin-top: 64px; border-top: 1px solid var(--line); padding-top: 16px; }
summary { cursor: pointer; font-weight: 600; }
table.options { font-size: 14px; }
table.options td { border-bottom: none; padding: 3px 10px; }
table.options th.conv { font-weight: 400; padding: 14px 10px 4px; border-bottom: none; }
table.options td.win { font-weight: 700; border-radius: 4px; }
table.options td.win.ok { background: var(--ok-bg); color: var(--ok); }
table.options td.win.miss { background: var(--miss-bg); color: var(--miss); }
.turn { display: block; }
.who { display: block; font: 500 11px/1.4 var(--font-data); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.tr { display: block; font-size: 13px; color: var(--muted); }
.turn.assistant { color: var(--muted); }
th .folder { display: block; font-size: 13px; color: var(--muted); border: 0; padding: 0; }
@media (max-width: 560px) {
  .case { padding: 12px; }
  .answer-row { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "name verdict" "bar bar"; gap: 4px 8px; }
  .model-name { grid-area: name; }
  .verdict { grid-area: verdict; }
  .stack { grid-area: bar; }
  .bubble, .bubble-tr { max-width: 92%; }
}
</style>
</head>
<body>
<main>
<p class="eyebrow"><a href="../../../">AI bench lab</a> · <a href="../../../#${category}">${esc(categories[category].name)}</a> · ${day}</p>
<h1>Which folder does a chat about phone spending go in?</h1>
<p class="lede">Two decision models choose which of the user's folders a chat belongs in. Each case ran ${runs} times,
and each test changes one variable: the language, the folder's name, the user's wording or the carriers mentioned.</p>

<div class="scores">${[jev, luna].map(scoreRow).join("")}</div>
<p class="note">Right folder, out of ${total[jev.id].of} runs each. Prices from the Vercel AI Gateway on ${day}; output is free for both.</p>

<section class="q" id="task">
  <p class="eyebrow">The task</p>
  <h2>Suggest a folder for a chat</h2>
  <p>A chat app keeps conversations in the user's folders and suggests where each new one belongs. Each call sends
  one conversation and one question through the
  <a href="https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-decisions">Decisions API</a>:
  <b>“${esc(question)}”</b> The options are the user's three folders and <b>None of these</b>. The model gives each
  option a probability; its pick is the highest.</p>
  <p>Every card below is one conversation, the folders it was filed against, and one bar per model: how the model
  split its probability across the options, averaged over ${runs} runs, and how many runs picked the right folder.</p>
  <ul class="legend">
    <li><i style="background: var(--bar-target)"></i>Right folder</li>
    <li><i style="background: var(--bar-wrong)"></i>Wrong option that won</li>
    <li><i style="background: var(--bar-other)"></i>Other options</li>
    <li><span class="added">Added text</span> what a message adds to the bare question</li>
  </ul>
</section>

<section class="q" id="spanish">
  <p class="eyebrow">Where we started</p>
  <h2>A question in Spanish</h2>
  <p class="answer">jev files it under Facturas. Luna says none of the folders fit.</p>
  <p>We noticed this in a real chat, in Spanish; the messages below recreate it. The folders are <b>Personal</b>,
  <b>Ideas</b> and <b>Facturas</b>, the everyday Spanish word for bills. A person would file this chat under
  Facturas.</p>
  ${cards([
    ["B", ["es-facturas"]],
    ["A", ["es-facturas"]],
    ["C", ["es-facturas"]],
  ])}
  <p class="after">Facturas is Luna's second choice every time, even when the assistant itself says “facturas”. So we
  started testing theories.</p>
</section>

<div class="part"><p class="eyebrow">How we iterated</p><h2>Testing our theories, one change at a time</h2></div>
${theories.map((s, i) => section(s, s.id === "repeat" ? "Check" : `Theory ${i + 1}`)).join("")}

<section class="q" id="conclusions">
  <p class="eyebrow">What we learned</p>
  <h2>Conclusions</h2>
  <ol class="conclusions">${conclusions.map((c) => `<li>${c}</li>`).join("")}</ol>
</section>

<section class="q" id="limits">
  <h2>Limits</h2>
  <ul>
    <li>One topic, hand-written messages, one wording of the question, three folders. It shows a pattern, not a
    general ranking of the two models.</li>
    <li>jev varies between runs, so a rerun will not give exactly these numbers.</li>
    <li><code>experimental_decide</code> is experimental in the AI SDK, and the Decisions API is in beta.</li>
  </ul>
</section>

<details>
  <summary>Every probability, for every case</summary>
  <p class="note">Mean over ${runs} runs; the highlighted cell is the model's pick. Min–max ranges are in
  <a href="results/results.md">results.md</a>, every call in <a href="results/raw.json">raw.json</a>, and the exact
  messages in <a href="${esc(sourceUrl)}bench.mjs">bench.mjs</a>.</p>
  ${allResults}
</details>

<footer>
  ${results.length} calls on ${day}. Code and how to rerun it:
  <a href="${esc(site.repoUrl)}">${esc(site.repoUrl.replace("https://", ""))}</a>.
 Built by <a href="https://github.com/NicoGrapsas">Nico Grapsas</a> with <a href="https://claude.com/claude-code">Claude Code</a>.</footer>
</main>
</body>
</html>
`;

await writeFile(new URL("index.html", here), html);
await writeFile(
  new URL("results/summary.json", here),
  `${JSON.stringify(
    {
      slug,
      category,
      title: "Which folder does a chat about phone spending go in?",
      task: "choice between the user's folders",
      date: day,
      calls: results.length,
      scores: [jev, luna].map((m) => ({ model: m.id, ...total[m.id] })),
    },
    null,
    2,
  )}\n`,
);
console.log(`index.html: jev ${total[jev.id].right}/${total[jev.id].of}, Luna ${total[luna.id].right}/${total[luna.id].of}`);
