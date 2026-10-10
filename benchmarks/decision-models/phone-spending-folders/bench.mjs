// Which of the user's folders does a chat about phone spending go in?
// Two decision models answer one `choice` question with a probability per
// option. Two text models answer the same question by naming one option, for
// comparison: they return a choice and no probabilities.
//
// Writes results/raw.json, every call; report.mjs builds the tables from it.

import { mkdir, writeFile } from "node:fs/promises";
import { experimental_decide as decide, generateText, Output } from "ai";
import { gatewayFromEnv, pool, runsFromArgs } from "../../../lib/bench.mjs";

const here = new URL(".", import.meta.url);
const runs = runsFromArgs();
const gateway = gatewayFromEnv();

const decisionModels = ["openai/gpt-6-luna-decisions", "typesafe-ai/jev"];
const textModels = ["openai/gpt-6-luna", "anthropic/claude-haiku-5.5"];
const models = [...decisionModels, ...textModels];

const question =
  "Which of the user's folders does a conversation with these messages belong in?";
const noneKey = "none";
const noneLabel = "None of these folders fits";

// Each conversation comes in five messages:
//   A    the question, asking for the personal line and the work line
//   B    the question alone
//   C    A followed by the assistant's reply
//   A-own, C-own  the same as A and C without the word "personal": "my own
//        line" and "the company line". One folder is called Personal, so these
//        are the control for whether the word pulls the conversation there.
const lines = {
  personal: {
    es: "cuanto en la linea personal y cuanto en la del trabajo",
    esReply: "la personal y la del trabajo",
    en: "How much on my personal line and how much on my work line?",
    enReply: "personal and work",
  },
  own: {
    es: "cuanto en mi linea y cuanto en la de la empresa",
    esReply: "la tuya y la de la empresa",
    en: "How much on my own line and how much on my company line?",
    enReply: "yours and the company's",
  },
};

const withLines = (build) => ({
  A: build.withLines(lines.personal),
  B: build.alone,
  C: build.withReply(lines.personal),
  "A-own": build.withLines(lines.own),
  "C-own": build.withReply(lines.own),
});

const spanishQuestion = "cuanto estoy gastando en telefonia por mes?";
const spanish = withLines({
  alone: spanishQuestion,
  withLines: (l) => `${spanishQuestion} ${l.es}`,
  withReply: (l) =>
    `user: ${spanishQuestion} ${l.es}\n\nassistant: Para calcularlo sumá tus facturas mensuales de cada línea, ${l.esReply}. Si me pasás los montos te armo un resumen de gastos.`,
});

const english = (question) =>
  withLines({
    alone: question,
    withLines: (l) => `${question} ${l.en}`,
    withReply: (l) =>
      `user: ${question} ${l.en}\n\nassistant: To work it out, add up your monthly invoices for each line, ${l.enReply}. If you send me the amounts I can put together a summary of your spending.`,
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

// A text model gets the question and the options as instructions and the
// conversation as the prompt, and must answer with one option's key.
const pick = async (model, folders, state) => {
  const startedAt = Date.now();
  const { output, usage } = await generateText({
    model: gateway(model),
    output: Output.choice({ options: [...folders, noneKey] }),
    system: `${question}\nOptions: ${folders.join(", ")}, or "${noneKey}" if none of these folders fits.`,
    prompt: `Messages:\n${state}`,
  });
  return { choice: output, ms: Date.now() - startedAt, usage: { input: usage.inputTokens, output: usage.outputTokens } };
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
  ...(await (textModels.includes(job.model) ? pick : classify)(job.model, job.scenario.folders, job.state)),
}));

await mkdir(new URL("results/", here), { recursive: true });
await writeFile(
  new URL("results/raw.json", here),
  `${JSON.stringify({ date: new Date().toISOString(), runs, question, models: { decision: decisionModels, text: textModels }, scenarios, results: raw }, null, 2)}\n`,
);
console.log(`results/raw.json: ${raw.length} calls`);
