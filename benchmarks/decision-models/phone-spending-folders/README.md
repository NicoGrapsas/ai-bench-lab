# Which folder does a chat about phone spending go in?

**[Read the full report →](https://nicograpsas.github.io/ai-bench-lab/benchmarks/decision-models/phone-spending-folders/)**

A chat app suggests which of your folders a conversation belongs in. We asked
two decision models to make that call, 10 times per case, and changed one
thing at a time to isolate what changes the answer.

| Model | Right folder | Price per 1M input tokens |
|---|---|---|
| `typesafe-ai/jev` | **250 of 250** runs | $0.042 |
| `openai/gpt-6-luna-decisions` | **110 of 250** runs | $0.10 |

Prices from the Vercel AI Gateway model list on 2026-10-09. Neither model
charges for output.

## The task

Each call asks one question through the Decisions API:

> Which of the user's folders does a conversation with these messages belong in?

The options are the user's three folders plus "None of these folders fits".
The model gives each option a probability and picks the highest. It is right
when it picks the folder a person would.

The user always asks how much they spend on their phone. Each table shows the
exact conversation the models received: the user's message on its own, with
the carriers they use, or followed by the assistant's reply.

In the tables, each cell is what the model picked and its probability,
averaged over 10 runs. ✓ means it is the right folder.

## Where we started: a question in Spanish

We noticed this in a real chat, in Spanish; the messages below recreate it.
The folders are Personal, Ideas and
**Facturas**, the everyday Spanish word for bills. The user asks *"¿cuánto
estoy gastando en telefonía por mes?"* ("how much am I spending on my phone
each month?"). A person would file it under Facturas.

| Conversation the model gets | jev | Luna Decisions |
|---|---|---|
| *cuanto estoy gastando en telefonia por mes?*<br>("how much am I spending on my phone each month?") | ✓ **Facturas** 0.95 | ✗ none 0.51 |
| *cuanto estoy gastando en telefonia por mes? tengo movistar y personal flow*<br>("… I have Movistar and Personal Flow") | ✓ **Facturas** 0.92 | ✗ none 0.39 |
| the same, then the assistant: *Para calcularlo sumá tus facturas mensuales de Movistar y Personal Flow. …*<br>("To work it out, add up your monthly bills from Movistar and Personal Flow.") | ✓ **Facturas** 0.97 | ✗ none 0.39 |

jev picks Facturas every time. Luna Decisions never does: it answers "none",
with Facturas a close second. So we asked why.

## How we iterated

We tested one theory at a time, changing a single thing per run.

### Theory 1: is it the language?

The same question in English: *"how much am I spending on my **phone bills**
each month?"*, once with the third folder called **Bills** and once with
**Invoices**.

| Conversation the model gets | Third folder | jev | Luna Decisions |
|---|---|---|---|
| *how much am I spending on my phone bills each month?* | Bills | ✓ **Bills** 1.00 | ✓ **Bills** 0.87 |
| *how much am I spending on my phone bills each month?* | Invoices | ✓ **Invoices** 0.59 | ✗ none 0.65 |
| *how much am I spending on my phone bills each month? I have Movistar and Personal Flow* | Bills | ✓ **Bills** 1.00 | ✓ **Bills** 0.95 |
| *how much am I spending on my phone bills each month? I have Movistar and Personal Flow* | Invoices | ✓ **Invoices** 0.67 | ✗ none 0.47 |
| the same, then the assistant: *To work it out, add up your monthly invoices from Movistar and Personal Flow. …* | Bills | ✓ **Bills** 1.00 | ✓ **Bills** 0.98 |
| the same, then the assistant: *To work it out, add up your monthly invoices from Movistar and Personal Flow. …* | Invoices | ✓ **Invoices** 0.88 | ✓ **Invoices** 0.49 |

Not the language: the folder's name. When the folder is called Bills, the
word the user said, both models get it. Call it Invoices and Luna
Decisions answers "none", unless the assistant's reply says "invoices" for it.

### Theory 2: is it just matching words?

In theory 1 the user said "phone bills". Now the user says *"how much am I spending on **phone service** each
month?"*, which names neither folder.

| Conversation the model gets | Third folder | jev | Luna Decisions |
|---|---|---|---|
| *how much am I spending on phone service each month?* | Bills | ✓ **Bills** 1.00 | ✗ none 0.53 |
| *how much am I spending on phone service each month?* | Invoices | ✓ **Invoices** 0.65 | ✗ none 0.84 |
| *how much am I spending on phone service each month? I have Movistar and Personal Flow* | Bills | ✓ **Bills** 1.00 | ✓ **Bills** 0.71 |
| *how much am I spending on phone service each month? I have Movistar and Personal Flow* | Invoices | ✓ **Invoices** 0.70 | ✗ none 0.59 |
| the same, then the assistant: *To work it out, add up your monthly invoices from Movistar and Personal Flow. …* | Bills | ✓ **Bills** 1.00 | ✓ **Bills** 0.92 |
| the same, then the assistant: *To work it out, add up your monthly invoices from Movistar and Personal Flow. …* | Invoices | ✓ **Invoices** 0.87 | ✗ Personal 0.41 |

For Luna Decisions, mostly yes: without the word in the message it loses Bills
on the bare question and never gets Invoices. jev's answers do not change.

### Theory 3: is "Personal Flow" pulling it towards the Personal folder?

Personal Flow is an Argentine phone plan, and one folder is called Personal.
We swapped the carriers for Verizon and T-Mobile.

| Case | Luna: Personal, Movistar / Personal Flow | Luna: Personal, Verizon / T-Mobile | jev with Verizon / T-Mobile | Luna with Verizon / T-Mobile |
|---|---|---|---|---|
| "phone service", Invoices | 0.35 | 0.46 | ✓ **Invoices** 0.58 | ✗ none 0.50 |
| Spanish, Facturas | 0.27 | 0.37 | ✓ **Facturas** 0.91 | ✗ Personal 0.37 |

No. With US carriers Luna Decisions leans *more* towards Personal, and in
Spanish it picks it. Our guess, untested: it reads "how much am I spending" as
personal finance.

### Check: do the answers repeat?

| Model | Cases where the pick changed between runs | Largest change in a probability |
|---|---|---|
| jev | 0 of 25 | 0.11 |
| Luna Decisions | 0 of 25 | 0.00 |

Every option's probability for every case is in [the report](https://nicograpsas.github.io/ai-bench-lab/benchmarks/decision-models/phone-spending-folders/)
and [`results/results.md`](results/results.md); every call is in
[`results/raw.json`](results/raw.json).

## Conclusions

1. **The folder's name matters more than the language.** Luna Decisions finds
   the folder when its name is the word the user wrote: Bills for "phone
   bills", 50/50. When the folder is called Facturas or Invoices it mostly
   says none fits (10/50 and 10/50), even in English.
2. **jev never picked a wrong folder, but its confidence shows the same
   pull.** It gives Bills 100%. Invoices, a word the user never said, drops to
   58–67%, and climbs back to 84–88% once the assistant's reply says
   "invoices". The word moves jev's confidence, not its answer. In Spanish,
   where Facturas is the everyday word, it stays at 91–98%.
3. **Without the folder's word, Luna struggles even with an obvious match.**
   When the user says "phone service", Luna gets Bills 40/50 and Invoices 0/50.
4. **The carrier is not the cause.** With Verizon and T-Mobile instead of
   Personal Flow, Luna leans further towards the Personal folder, not less.
5. **For this feature,** a folder suggestion should not depend on the user
   typing the folder's exact name. In this test, only jev met that bar.

## Limits

- One topic, hand-written messages, one wording of the question, three
  folders. It shows a pattern, not a general ranking of the two models.
- jev varies between runs, so a rerun will not give exactly these numbers.
- `experimental_decide` is experimental in the AI SDK, and the Decisions API is
  in beta.

## Rerun

```bash
npm run bench -- decision-models/phone-spending-folders            # 500 calls, well under one cent
npm run bench -- decision-models/phone-spending-folders --runs 3
```

Run on 2026-10-09 with `ai@7.0.137` and `@ai-sdk/gateway@4.0.110`.
