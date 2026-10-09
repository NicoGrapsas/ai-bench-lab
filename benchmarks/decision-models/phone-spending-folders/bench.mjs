// Which of the user's folders does a chat about phone spending go in?
// openai/gpt-6-luna-decisions vs typesafe-ai/jev, one `choice` question.
//
// Writes results/raw.json (every call) and results/results.md (tables).

import { mkdir, writeFile } from "node:fs/promises";
import { experimental_decide as decide } from "ai";
import { gatewayFromEnv, pool, range, runsFromArgs } from "../../../lib/bench.mjs";

const here = new URL(".", import.meta.url);
const runs = runsFromArgs();
const gateway = gatewayFromEnv();

const models = ["openai/gpt-6-luna-decisions", "typesafe-ai/jev"];

const question =
  "Which of the user's folders does a conversation with these messages belong in?";
const noneKey = "none";
const noneLabel = "None of these folders fits";

// Each conversation comes in five messages:
//   A    the question, naming the user's carriers
//   B    the question alone
//   C    A followed by the assistant's reply
//   A-us, C-us  the same as A and C with US carriers
// "Personal Flow" is an Argentine phone plan. The US variants are the control
// for whether that name pulls the conversation towards the "Personal" folder.
const carriers = {
  ar: { es: "movistar y personal flow", en: "Movistar and Personal Flow" },
  us: { es: "verizon y t-mobile", en: "Verizon and T-Mobile" },
};

const withCarriers = (build) => ({
  A: build.withCarriers(carriers.ar),
  B: build.alone,
  C: build.withReply(carriers.ar),
  "A-us": build.withCarriers(carriers.us),
  "C-us": build.withReply(carriers.us),
});

const spanish = withCarriers({
  alone: "cuanto estoy gastando en telefonia por mes?",
  withCarriers: (c) => `cuanto estoy gastando en telefonia por mes? tengo ${c.es}`,
  withReply: (c) =>
    `user: cuanto estoy gastando en telefonia por mes? tengo ${c.es}\n\nassistant: Para calcularlo sumá tus facturas mensuales de ${c.en.replace(" and ", " y ")}. Si me pasás los montos te armo un resumen de gastos.`,
});

const english = (question) =>
  withCarriers({
    alone: question,
    withCarriers: (c) => `${question} I have ${c.en}`,
    withReply: (c) =>
      `user: ${question} I have ${c.en}\n\nassistant: To work it out, add up your monthly invoices from ${c.en}. If you send me the amounts I can put together a summary of your spending.`,
  });

// Says "phone bills", the same word as the "Bills" folder.
const englishBills = english("how much am I spending on my phone bills each month?");
// Names no document at all, so no folder name appears in the user's words.
const englishService = english("how much am I spending on phone service each month?");

const scenarios = [
  {
    id: "es-facturas",
    label: "Spanish · Personal / Ideas / Facturas",
    folders: ["Personal", "Ideas", "Facturas"],
    target: "Facturas",
    messages: spanish,
  },
  {
    id: "en-invoices",
    label: 'English ("phone bills") · Personal / Ideas / Invoices',
    folders: ["Personal", "Ideas", "Invoices"],
    target: "Invoices",
    messages: englishBills,
  },
  {
    id: "en-bills",
    label: 'English ("phone bills") · Personal / Ideas / Bills',
    folders: ["Personal", "Ideas", "Bills"],
    target: "Bills",
    messages: englishBills,
  },
  {
    id: "en-service-invoices",
    label: 'English ("phone service") · Personal / Ideas / Invoices',
    folders: ["Personal", "Ideas", "Invoices"],
    target: "Invoices",
    messages: englishService,
  },
  {
    id: "en-service-bills",
    label: 'English ("phone service") · Personal / Ideas / Bills',
    folders: ["Personal", "Ideas", "Bills"],
    target: "Bills",
    messages: englishService,
  },
];

const criteriaFor = (folders) => ({
  ...Object.fromEntries(folders.map((name) => [name, name])),
  [noneKey]: noneLabel,
});

const classify = async (model, folders, state) => {
  const startedAt = Date.now();
  const { answers } = await decide({
    model: gateway.decisionModel(model),
    state,
    questions: {
      folder: { type: "choice", instructions: question, criteria: criteriaFor(folders) },
    },
  });
  const { choice, probabilities } = answers.folder;
  return { choice, probabilities, ms: Date.now() - startedAt };
};

const jobs = [];
for (const scenario of scenarios) {
  for (const [messageId, state] of Object.entries(scenario.messages)) {
    for (const model of models) {
      for (let run = 1; run <= runs; run++) {
        jobs.push({ scenario, messageId, state, model, run });
      }
    }
  }
}

const raw = await pool(jobs, async (job) => ({
  scenario: job.scenario.id,
  message: job.messageId,
  model: job.model,
  run: job.run,
  ...(await classify(job.model, job.scenario.folders, job.state)),
}));

const shortName = (model) => (model.includes("luna") ? "Luna Decisions" : "jev");

const lines = [
  "# Results",
  "",
  `${runs} runs per message and model. Each cell is the probability the model gave that option, as a min–max range across runs when it varied. "Picks" counts the runs whose top choice was that option.`,
  "",
];
for (const scenario of scenarios) {
  const options = [...scenario.folders, noneKey];
  lines.push(`## ${scenario.label}`, "");
  lines.push(`| Message | Model | Picks | ${options.join(" | ")} |`);
  lines.push(`|---|---|---|${options.map(() => "---").join("|")}|`);
  for (const messageId of Object.keys(scenario.messages)) {
    for (const model of models) {
      const rows = raw.filter(
        (r) => r.scenario === scenario.id && r.message === messageId && r.model === model,
      );
      const counts = {};
      for (const r of rows) counts[r.choice] = (counts[r.choice] ?? 0) + 1;
      const picks = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([choice, n]) => `${choice} ${n}/${rows.length}`)
        .join(", ");
      const cells = options.map((o) => range(rows.map((r) => r.probabilities?.[o] ?? 0)));
      lines.push(`| ${messageId} | ${shortName(model)} | ${picks} | ${cells.join(" | ")} |`);
    }
  }
  lines.push("");
}

await mkdir(new URL("results/", here), { recursive: true });
await writeFile(
  new URL("results/raw.json", here),
  `${JSON.stringify({ date: new Date().toISOString(), runs, question, scenarios, results: raw }, null, 2)}\n`,
);
await writeFile(new URL("results/results.md", here), lines.join("\n"));
console.log(lines.join("\n"));
