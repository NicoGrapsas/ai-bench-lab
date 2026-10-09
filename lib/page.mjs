// The stylesheet and fonts every page in the site shares, light and dark.

const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Schibsted+Grotesk:wght@400;500;600;800&display=swap">`;

const pageCss = `
/* Layout: one reading column, ~720px; tables may run to 880px and scroll inside their own box. */
:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --ink: #15171c;
  --muted: #5d6370;
  --line: #dfe2e8;
  --accent: #2b4fd6;
  --ok: #17734a; --ok-bg: #e2f4ea;
  --miss: #b23a22; --miss-bg: #fbe7e1;
  --mark: #fff1b8;
  --font-body: "Schibsted Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-data: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #111318; --surface: #191c22; --ink: #eceef2; --muted: #9aa1ad; --line: #2b2f38;
    --accent: #8ea4ff; --ok: #5fd39a; --ok-bg: #133325; --miss: #ff8a6e; --miss-bg: #3a1d16;
    --mark: #4a3f12; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #111318; --surface: #191c22; --ink: #eceef2; --muted: #9aa1ad; --line: #2b2f38;
  --accent: #8ea4ff; --ok: #5fd39a; --ok-bg: #133325; --miss: #ff8a6e; --miss-bg: #3a1d16;
  --mark: #4a3f12; color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.6 var(--font-body); }
main { max-width: 760px; margin: 0 auto; padding: 48px 16px 96px; }
h1, h2, h3 { text-wrap: balance; letter-spacing: -0.015em; }
h1 { font-size: clamp(30px, 6vw, 46px); line-height: 1.08; font-weight: 800; margin: 8px 0 16px; }
h2 { font-size: 24px; line-height: 1.2; font-weight: 800; margin: 0 0 8px; }
h3 { font-size: 17px; margin: 24px 0 8px; }
p { margin: 0 0 12px; }
a { color: var(--accent); }
code, .data { font-family: var(--font-data); font-size: 0.88em; }
.eyebrow { font: 500 13px/1.4 var(--font-data); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.lede { font-size: 19px; color: var(--muted); }
.note { font-size: 14px; color: var(--muted); }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 8px 10px; }
thead th { font: 500 12px/1.3 var(--font-data); letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--line); vertical-align: bottom; }
tbody td, tbody th { border-bottom: 1px solid var(--line); }
footer { margin-top: 64px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;

export { fontLinks, pageCss };
