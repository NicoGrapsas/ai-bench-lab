# Decision model benchmarks

Small, reproducible benchmarks of **decision models**: models that answer typed
questions (yes or no, pick one, a score) with probabilities instead of text,
through the [Decisions API on the Vercel AI Gateway](https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-decisions).

Each benchmark comes from a real product feature, runs every case several
times, and publishes every call it made.

**[Browse the reports →](https://nicograpsas.github.io/ai-bench-lab/)**

## Benchmarks

| Benchmark | Question | Result |
|---|---|---|
| [Which folder does a chat about phone spending go in?](benchmarks/phone-spending-folders) | `choice` between the user's folders | jev 250/250 · GPT-6 Luna Decisions 110/250 |

## Run them

You need Node 22.9+ and a [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) key.

```bash
npm install
cp .env.example .env                        # paste your key into AI_GATEWAY_API_KEY
npm run list                                # the benchmarks
npm run bench -- phone-spending-folders     # calls the models, rewrites results/ and the pages
npm run report                              # rebuilds every page from saved results, no calls
```

The key is only read from the environment. Nothing in the repo or in the
results contains it.

## Layout

```
benchmarks/<name>/
  bench.mjs        the cases and the calls; writes results/raw.json and results/results.md
  report.mjs       builds index.html (the shareable page) and results/summary.json
  og.png           the link preview image
  README.md
lib/               gateway client, worker pool, formatting, page styles
scripts/           the npm commands and the landing page
site.json          where the site and the repo are published
```

## Adding a benchmark

1. Copy `benchmarks/phone-spending-folders` to `benchmarks/<new-name>`.
2. Replace the cases, the question and the models in `bench.mjs`.
3. Adapt `report.mjs` to what the question returns, keeping the
   `results/summary.json` fields the landing page reads.
4. `npm run bench -- <new-name>`, then add a row to the table above.

Rules every benchmark follows: real cases from a real feature, at least 10 runs
per case, raw data committed, prices read from the gateway on the day of the
run, and a Limits section that says what the result does not show.

## The site

The pages are plain HTML at the repo root and in each benchmark folder, served
by GitHub Pages from `main`. Link previews read `og.png` through the absolute
URLs in `site.json`.

## Credits

Built by [Nico Grapsas](https://github.com/NicoGrapsas) with [Claude Code](https://claude.com/claude-code).

## License

MIT
