#!/usr/bin/env node
// DeckWright CLI — build, package, check and export HTML decks (.html / .hdek).
// https://github.com/grotyx/deckwright  (MIT)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const Core = require(path.join(ROOT, 'core', 'deckwright-core.js'));
const RUNTIME_PATH = path.join(ROOT, 'runtime', 'deckwright-runtime.js');
const VERSION = '0.3.3';

// Messages follow the system locale (Korean if the locale starts with "ko"); override with DECKWRIGHT_LANG=ko|en
const LANG = (() => {
  const v = process.env.DECKWRIGHT_LANG || process.env.LC_ALL || process.env.LANG || (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale; } catch { return ''; } })();
  return /^ko/i.test(v || '') ? 'ko' : 'en';
})();
const t = (ko, en) => (LANG === 'ko' ? ko : en);
Core.setLang && Core.setLang(LANG);

const C = process.stdout.isTTY ? { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' } : { r: '', y: '', g: '', d: '', b: '', x: '' };
const RUNTIME_FILE_RE = /(hdek|deckwright)-runtime\.js$/;

function usage() {
  console.log(t(
`${C.b}DeckWright ${VERSION}${C.x} — HTML 발표 파일 도구 (.html / .hdek)

사용법:
  deckwright inject <파일.html> [-o 출력.html] 원본 옆에 두는 발표용 HTML (런타임만 넣고 그림·영상은 원래 폴더 참조)
  deckwright build  <입력> [-o 출력.html]     런타임과 모든 자원을 넣은 단독 HTML 한 개 (기본: <이름>_single.html)
  deckwright pack   <입력> [-o 출력.hdek]     ZIP 패키지(.hdek)로 묶기 (큰 영상이 많을 때)
  deckwright unpack <파일.hdek> [-o 폴더]     패키지 풀기
  deckwright check  <입력>                    규약·외부 자원·폰트·노트 점검
  deckwright export <입력> [--pdf a.pdf] [--pptx a.pptx] [--png 폴더] [--scale 1]
                                             슬라이드별 최종 화면을 PDF/PPTX/PNG로 (Playwright 필요)
  deckwright runtime [-o 파일.js]             런타임 JS만 꺼내기

<입력>은 HTML 파일, index.html이 있는 폴더, 또는 .hdek 파일입니다.
덱 폴더 밖의 파일은 넣지 않습니다. 위쪽 폴더의 그림을 쓰는 덱이면 --root <폴더> 로 범위를 넓히세요.
--fetch-fonts (build, inject, pack): Google Fonts 같은 웹폰트를 내려받아 파일 안에 넣습니다. 덱에 쓰인 글자에 필요한 조각만 받습니다.`,
`${C.b}DeckWright ${VERSION}${C.x} — tools for HTML presentation files (.html / .hdek)

Usage:
  deckwright inject <file.html> [-o out.html] Presentable HTML next to the original (runtime only; images/video stay in place)
  deckwright build  <input> [-o out.html]     One self-contained HTML with the runtime and every asset inlined (default: <name>_single.html)
  deckwright pack   <input> [-o out.hdek]     ZIP package (.hdek), better for decks with large videos
  deckwright unpack <file.hdek> [-o dir]      Extract a package
  deckwright check  <input>                   Check conventions, external assets, fonts and notes
  deckwright export <input> [--pdf a.pdf] [--pptx a.pptx] [--png dir] [--scale 1]
                                             Final state of each slide as PDF/PPTX/PNG (needs Playwright)
  deckwright runtime [-o file.js]             Print or save the runtime script

<input> is an HTML file, a folder containing index.html, or a .hdek file.
Files outside the deck folder are never included. If the deck uses images from a parent folder, widen the scope with --root <dir>.
--fetch-fonts (build, inject, pack): download web fonts such as Google Fonts and put them inside the file. Only the slices needed for the characters in the deck are kept.`));
}

const NEEDS_VALUE = new Set(['out', 'pdf', 'pptx', 'png', 'root', 'scale', 'wait']);
function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '-o' || v.startsWith('--')) {
      const k = v === '-o' ? 'out' : v.slice(2);
      const nx = argv[i + 1];
      if (NEEDS_VALUE.has(k)) {
        if (nx === undefined || (nx.startsWith('-') && nx !== '-')) throw new Error(t(`${v} 다음에 값을 적으세요`, `${v} needs a value`));
        a[k] = nx; i++;
      } else a[k] = true;
    } else a._.push(v);
  }
  return a;
}

const runtimeSrc = () => fs.readFileSync(RUNTIME_PATH, 'utf8');
const inflate = (b, max) => new Uint8Array(zlib.inflateRawSync(b, { maxOutputLength: Math.max(1, max || 0) }));
const deflate = (b) => new Uint8Array(zlib.deflateRawSync(b, { level: 9 }));
// Reproducible output when SOURCE_DATE_EPOCH is set (seconds since 1970)
const FIXED_DATE = process.env.SOURCE_DATE_EPOCH ? new Date(parseInt(process.env.SOURCE_DATE_EPOCH, 10) * 1000) : null;
const created = () => (FIXED_DATE || new Date()).toISOString();
/** Decode the entry HTML (honoring <meta charset>), noting a conversion in the report */
function entryHTML(read, entry, report) {
  const d = Core.decodeHTML(read(entry));
  if (d.converted && report) (report.warnings = report.warnings || []).unshift(t(`문자 인코딩 ${d.charset}을(를) UTF-8로 바꿨습니다`, `Converted the text encoding from ${d.charset} to UTF-8`));
  return d;
}
// ---------------------------------------------------------------- web fonts (--fetch-fonts)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'; // Google Fonts serves woff2 to modern browsers
async function fetchBytes(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    return b.length > 50 * 1048576 ? null : b;
  } catch { return null; } finally { clearTimeout(timer); }
}
function fontOpts(a, texts) {
  if (!a['fetch-fonts']) return {};
  return { fetch: fetchBytes, chars: Core.usedChars(texts) };
}
function printFonts(report) {
  if (report.fetched && report.fetched.length) {
    const files = report.fetched.filter((u) => !/\/css2?\?|\.css(?:[?#]|$)/i.test(u)).length;
    const hosts = [...new Set(report.fetched.map((u) => { try { return new URL(u).host; } catch { return u; } }))].join(', ');
    console.log(`${C.g}✓${C.x} ${t('웹폰트를 파일 안에 넣음', 'Web fonts embedded')}: ${t(`폰트 ${files}개`, `${files} font files`)}, ${kb(report.fetchedBytes || 0)} ${C.d}(${hosts})${C.x}`);
  }
  (report.fetchFailed || []).forEach((u) => console.log(`${C.y}  ! ${t('웹폰트를 받지 못함(인터넷 연결 확인)', 'Could not download web font (check the connection)')}: ${u}${C.x}`));
}
/** Replace web-font references in an HTML or CSS text, leaving every local reference as it is */
async function embedWebFonts(text, kind, pathInDeck, opts) {
  const src = kind === 'css' ? '<style>' + text + '</style>' : text;
  const r = await Core.inlineHTML(src, { path: pathInDeck, read: () => null, ...opts });
  const out = kind === 'css' ? r.html.replace(/^<style>/, '').replace(/<\/style>$/, '') : r.html;
  return { text: out, report: r };
}
const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB';

/** Read the input as { kind, entry, read }. Reads never leave `dir` (or --root), symlinks included. */
async function loadInput(input, opts = {}) {
  if (!input) throw new Error(t('입력 파일을 지정하세요', 'Specify an input file'));
  const abs = path.resolve(input);
  if (!fs.existsSync(abs)) throw new Error(t('파일이 없습니다: ', 'File not found: ') + input);
  const st = fs.statSync(abs);
  if (st.isFile() && /\.(hdek|zip)$/i.test(abs)) {
    const files = await Core.readZip(new Uint8Array(fs.readFileSync(abs)), inflate);
    const f = Core.findEntry(files);
    if (!f) throw new Error(t('패키지에 HTML이 없습니다', 'No HTML file in the package'));
    return { kind: 'package', files, entry: f.entry, manifest: f.manifest, name: path.basename(abs).replace(/\.(hdek|zip)$/i, ''), at: path.dirname(abs) };
  }
  let dir, entry;
  if (st.isDirectory()) {
    dir = abs;
    entry = fs.existsSync(path.join(dir, 'index.html')) ? 'index.html' : fs.readdirSync(dir).find((n) => /\.html?$/i.test(n));
    if (!entry) throw new Error(t('폴더 안에 HTML 파일이 없습니다', 'No HTML file in the folder'));
  } else { dir = path.dirname(abs); entry = path.basename(abs); }
  const name = st.isDirectory() ? path.basename(dir) : entry.replace(/\.html?$/i, '');
  const at = st.isDirectory() ? path.dirname(dir) : dir;
  if (opts.root) {
    const root = path.resolve(opts.root);
    const rel = path.relative(root, path.join(dir, entry));
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(t('--root 폴더가 덱을 포함해야 합니다', '--root must contain the deck'));
    entry = rel.split(path.sep).join('/'); dir = root;
  }
  const realDir = fs.realpathSync(dir);
  const read = (p) => {
    try {
      const full = fs.realpathSync(path.join(realDir, p));
      if (full !== realDir && !full.startsWith(realDir + path.sep)) return null; // symlink or path leaving the deck folder
      return fs.statSync(full).isFile() ? new Uint8Array(fs.readFileSync(full)) : null;
    } catch { return null; }
  };
  return { kind: 'fs', dir, entry, read, name, at };
}

function readerFor(inp) {
  if (inp.kind === 'package') return (p) => Core.own(inp.files, p) || null;
  return inp.read;
}

async function buildSingle(inp) {
  const dec = entryHTML(readerFor(inp), inp.entry);
  const html = dec.html;
  let r;
  try { r = await Core.inlineHTML(html, { path: inp.entry, read: readerFor(inp), ...fontOpts(inp.args || {}, [html]) }); } catch (e) {
    if (e instanceof RangeError) throw new Error(t("자원이 너무 커서 HTML 한 개에 담을 수 없습니다(약 400MB 한도). 'deckwright pack'으로 .hdek 패키지를 만드세요.", "The assets are too large for one HTML file (about 400 MB limit). Use 'deckwright pack' to make a .hdek package."));
    throw e;
  }
  if (dec.converted) entryHTML(readerFor(inp), inp.entry, r);
  const info = Core.scan(r.html);
  const manifest = Core.buildManifest({ created: created(), title: info.title, entry: 'index.html', width: info.width, height: info.height, staged: info.staged, duration: info.duration, slides: info.slides });
  const head = `<script type="application/hdek+json" id="hdek-manifest">${JSON.stringify(manifest).replace(/</g, '\\u003c')}</script>`;
  const out = Core.injectRuntime(r.html, runtimeSrc(), head);
  return { html: out, report: r, info };
}

// Default outputs sit next to the input, never in the current folder
function defaultOut(inp, suffix) { return path.join(inp.at, inp.name + suffix); }
const slideCount = (info) => info.slides.length || (info.guess ? '~' + info.guess : '?');

function printReport(report) {
  report.missing = (report.missing || []).filter((m) => !RUNTIME_FILE_RE.test(m));
  report.missing.forEach((m) => console.log(`${C.r}  ✗ ${t('없는 파일', 'Missing file')}: ${m}${C.x}`));
  (report.outside || []).filter((m) => !RUNTIME_FILE_RE.test(m)).forEach((m) => console.log(`${C.r}  ✗ ${t('덱 폴더 밖이라 넣지 않음', 'Outside the deck folder, not included')}: ${m} ${C.d}(--root)${C.x}`));
  (report.external || []).forEach((m) => console.log(`${C.y}  ! ${t('외부 참조(오프라인에서 깨짐)', 'External reference (breaks offline)')}: ${m}${C.x}`));
  (report.warnings || []).forEach((m) => console.log(`${C.y}  ! ${m}${C.x}`));
}

async function cmdBuild(a) {
  const inp = await loadInput(a._[0], a);
  inp.args = a;
  const { html, report, info } = await buildSingle(inp);
  const out = path.resolve(a.out || defaultOut(inp, '_single.html'));
  if (inp.kind === 'fs' && out === path.resolve(path.join(inp.dir, inp.entry))) throw new Error(t('입력 파일을 덮어쓸 수 없습니다. -o 로 다른 이름을 지정하세요', 'Refusing to overwrite the input. Use -o to pick another name'));
  fs.writeFileSync(out, html);
  console.log(`${C.g}✓${C.x} ${t('단독 HTML', 'Single HTML')}: ${out} ${C.d}(${kb(Buffer.byteLength(html))}, ${t('슬라이드', 'slides')} ${slideCount(info)}, ${t('자원', 'assets')} ${report.used.length})${C.x}`);
  printFonts(report);
  if (!a['fetch-fonts']) report.external.filter((u) => Core.isWebFont(u)).length && console.log(`${C.d}  ${t('웹폰트도 파일 안에 넣으려면 --fetch-fonts 를 붙이세요', 'Add --fetch-fonts to put the web fonts inside the file too')}${C.x}`);
  printReport(report);
  if (Buffer.byteLength(html) > 60 * 1048576) console.log(`${C.y}  ! ${t("파일이 큽니다. 영상이 많다면 'deckwright pack'으로 .hdek 패키지를 쓰는 편이 빠릅니다.", "Large file. For video-heavy decks, 'deckwright pack' (.hdek) loads faster.")}${C.x}`);
}

async function cmdInject(a) {
  const src = a._[0];
  if (!src || !/\.html?$/i.test(src)) throw new Error(t('HTML 파일을 지정하세요', 'Specify an HTML file'));
  const dec = Core.decodeHTML(new Uint8Array(fs.readFileSync(src)));
  let html = dec.html, fontReport = null;
  if (a['fetch-fonts']) { const e = await embedWebFonts(html, 'html', path.basename(src), fontOpts(a, [html])); html = e.text; fontReport = e.report; }
  const out = path.resolve(a.out || src.replace(/\.html?$/i, '_DeckWright.html'));
  if (out === path.resolve(src)) throw new Error(t('원본을 덮어쓸 수 없습니다', 'Refusing to overwrite the original'));
  if (path.dirname(out) !== path.dirname(path.resolve(src))) console.log(`${C.y}  ! ${t('출력이 원본과 다른 폴더입니다. 그림·영상 경로가 맞지 않을 수 있습니다.', 'Output is in a different folder from the original; relative image/video paths may break.')}${C.x}`);
  fs.writeFileSync(out, Core.injectRuntime(html, runtimeSrc()));
  console.log(`${C.g}✓${C.x} ${out} ${C.d}(${t('원본과 같은 폴더에서 더블클릭', 'double-click it next to the original')})${C.x}`);
  if (dec.converted) console.log(`${C.y}  ! ${t(`문자 인코딩 ${dec.charset}을(를) UTF-8로 바꿨습니다`, `Converted the text encoding from ${dec.charset} to UTF-8`)}${C.x}`);
  if (fontReport) printFonts(fontReport);
}

async function cmdPack(a) {
  const inp = await loadInput(a._[0], a);
  const read = readerFor(inp);
  let entries = [];
  let report = { external: [], missing: [], used: [] };
  if (inp.kind === 'package') {
    entries = Object.keys(inp.files).filter((n) => n !== 'manifest.json' && n !== 'mimetype').map((n) => ({ name: n, bytes: inp.files[n] }));
  } else {
    const html = entryHTML(read, inp.entry).html;
    // collect mode walks linked and @imported CSS too; files outside the deck folder are never read
    report = await Core.inlineHTML(html, { path: inp.entry, read, mode: 'collect' });
    const inside = report.used.filter((p) => p !== inp.entry && !RUNTIME_FILE_RE.test(p));
    entries = [{ name: inp.entry, bytes: read(inp.entry) }].concat(inside.map((p) => ({ name: p, bytes: read(p) })));
  }
  const entryIdx = entries.findIndex((e) => e.name === inp.entry);
  let entryText = entryHTML(() => entries[entryIdx].bytes, inp.entry, report).html;
  if (a['fetch-fonts']) {
    // web fonts referenced from the page or its CSS files go into those files as data URLs
    const fo = fontOpts(a, [entryText]);
    const all = { fetched: [], fetchFailed: [], fetchedBytes: 0 };
    const merge = (r) => { r.fetched.forEach((u) => all.fetched.includes(u) || all.fetched.push(u)); r.fetchFailed.forEach((u) => all.fetchFailed.includes(u) || all.fetchFailed.push(u)); all.fetchedBytes += r.fetchedBytes || 0; };
    const e0 = await embedWebFonts(entryText, 'html', inp.entry, fo); entryText = e0.text; merge(e0.report);
    for (const e of entries) {
      if (!/\.css$/i.test(e.name)) continue;
      const r = await embedWebFonts(Core.utf8Decode(e.bytes), 'css', e.name, fo);
      if (r.report.fetched.length) { e.bytes = Core.utf8Encode(r.text); merge(r.report); }
    }
    report.external = report.external.filter((u) => !all.fetched.includes(u) && !all.fetched.includes('https:' + u));
    report.fonts = all;
  }
  const html = Core.injectRuntime(entryText, runtimeSrc());
  entries[entryIdx] = { name: inp.entry, bytes: Core.utf8Encode(html) };
  const info = Core.scan(html);
  const files = entries.map((e) => ({ path: e.name, size: e.bytes.length, crc32: Core.crc32(e.bytes).toString(16).padStart(8, '0') }));
  const manifest = Core.buildManifest({ created: created(), title: info.title || inp.name, entry: inp.entry, width: info.width, height: info.height, staged: info.staged, duration: info.duration, slides: info.slides, files });
  const all = [{ name: 'mimetype', bytes: Core.utf8Encode('application/vnd.hdek+zip') }, { name: 'manifest.json', bytes: Core.utf8Encode(JSON.stringify(manifest, null, 2)) }].concat(entries);
  const zip = Core.writeZip(all, deflate, { date: FIXED_DATE });
  const out = path.resolve(a.out || defaultOut(inp, '.hdek'));
  if (inp.kind === 'package' && out === path.resolve(a._[0])) throw new Error(t('입력 파일을 덮어쓸 수 없습니다. -o 로 다른 이름을 지정하세요', 'Refusing to overwrite the input. Use -o to pick another name'));
  fs.writeFileSync(out, zip);
  console.log(`${C.g}✓${C.x} ${t('패키지', 'Package')}: ${out} ${C.d}(${kb(zip.length)}, ${t('파일', 'files')} ${entries.length}, ${t('슬라이드', 'slides')} ${slideCount(info)})${C.x}`);
  if (report.fonts) printFonts(report.fonts);
  printReport(report);
}

async function cmdUnpack(a) {
  const src = a._[0];
  if (!src) throw new Error(t('.hdek 파일을 지정하세요', 'Specify a .hdek file'));
  const files = await Core.readZip(new Uint8Array(fs.readFileSync(src)), inflate);
  const outDir = path.resolve(a.out || path.basename(src).replace(/\.(hdek|zip)$/i, ''));
  let written = 0;
  for (const [name, bytes] of Object.entries(files)) {
    const dest = path.resolve(outDir, name);
    if (!dest.startsWith(outDir + path.sep)) { console.log(`${C.y}  ! ${t('건너뜀(경로 이탈)', 'Skipped (path escapes folder)')}: ${name}${C.x}`); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
    written++;
  }
  console.log(`${C.g}✓${C.x} ${t(`${written}개 파일을 ${outDir} 에 풀었습니다`, `Extracted ${written} files to ${outDir}`)}`);
}

async function cmdCheck(a) {
  const inp = await loadInput(a._[0], a);
  const read = readerFor(inp);
  const html = entryHTML(read, inp.entry).html;
  const r = await Core.inlineHTML(html, { path: inp.entry, read, mode: 'collect' });
  entryHTML(read, inp.entry, r);
  r.missing = r.missing.filter((m) => !RUNTIME_FILE_RE.test(m));
  r.outside = r.outside.filter((m) => !RUNTIME_FILE_RE.test(m));
  const res = Core.lint(html, r);
  const info = res.info;
  const stage = !info.contract ? t('자동 인식', 'auto-detected') : info.staged ? info.width + '×' + info.height : t('반응형', 'responsive');
  console.log(`${C.b}${info.title || inp.name}${C.x}`);
  console.log(`  ${t('규약', 'Convention')}: ${info.contract ? 'hdek' : t('없음(자동 인식)', 'none (auto-detect)')}  ${t('무대', 'Stage')}: ${stage}  ${t('슬라이드', 'Slides')}: ${slideCount(info)}  ${t('단계 합계', 'Total steps')}: ${info.slides.reduce((s, x) => s + x.steps, 0)}`);
  info.slides.forEach((s, i) => console.log(`${C.d}   ${String(i + 1).padStart(2)}. ${s.title}${s.steps ? ' · ' + s.steps + t('단계', ' steps') : ''}${s.notes ? '' : ' · ' + t('노트 없음', 'no notes')}${C.x}`));
  const order = { error: 0, warn: 1, info: 2 };
  res.issues.sort((x, y) => order[x.level] - order[y.level]).forEach((it) => {
    const col = it.level === 'error' ? C.r : it.level === 'warn' ? C.y : C.d;
    console.log(`${col}  ${it.level === 'error' ? '✗' : it.level === 'warn' ? '!' : '·'} ${it.msg}${C.x}`);
  });
  const errs = res.issues.filter((x) => x.level === 'error').length;
  console.log(errs ? `${C.r}${t('오류', 'Errors')}: ${errs}${C.x}` : `${C.g}✓ ${t('발표 가능', 'Ready to present')}${C.x}`);
  process.exitCode = errs ? 1 : 0;
}

function requireAny(name) {
  const tries = [process.cwd(), ROOT];
  try { tries.push(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()); } catch { }
  for (const dir of tries) {
    try { return require(require.resolve(name, { paths: [dir] })); } catch { }
  }
  return null;
}

async function cmdExport(a) {
  if (!a.pdf && !a.pptx && !a.png) throw new Error(t('내보낼 형식을 지정하세요: --pdf, --pptx, --png', 'Pick a format: --pdf, --pptx, --png'));
  const pw = requireAny('playwright');
  if (!pw) throw new Error(t('내보내기에는 Playwright가 필요합니다: ', 'Export needs Playwright: ') + 'npm i -g playwright && npx playwright install chromium');
  const PptxGen = a.pptx ? requireAny('pptxgenjs') : null;
  if (a.pptx && !PptxGen) throw new Error(t('PPTX 내보내기에는 pptxgenjs가 필요합니다: ', 'PPTX export needs pptxgenjs: ') + 'npm i -g pptxgenjs');
  const inp = await loadInput(a._[0], a);
  const read = readerFor(inp);
  const deckHTML = Core.injectRuntime(entryHTML(read, inp.entry).html, runtimeSrc());
  const info = Core.scan(deckHTML);
  const W = info.staged ? info.width : 1920, H = info.staged ? info.height : 1080;
  const scale = parseFloat(a.scale) || 1;
  const wait = parseInt(a.wait, 10) || 400;
  const ORIGIN = 'http://deck.invalid/';
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
    // Files are served from the deck (folder or package) without copying them or inlining them into one string
    await page.route(ORIGIN + '**', (route) => {
      let p = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
      const bytes = p === inp.entry ? Core.utf8Encode(deckHTML) : read(p);
      if (!bytes) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), contentType: Core.mimeOf(p) });
    });
    await page.goto(ORIGIN + inp.entry.split('/').map(encodeURIComponent).join('/'));
    await page.waitForFunction(() => window.DeckWright && window.DeckWright.state && window.DeckWright.state().count > 0, null, { timeout: 30000 });
    await page.addStyleTag({ content: '.hdek-ui,.hdek-bar,.hdek-toast{display:none!important}' });
    const slides = await page.evaluate(() => window.DeckWright.slides());
    const shots = [];
    const pngDir = a.png ? path.resolve(a.png) : null;
    if (pngDir) fs.mkdirSync(pngDir, { recursive: true });
    for (let i = 0; i < slides.length; i++) {
      await page.evaluate((i) => { const s = window.DeckWright.slides()[i]; window.DeckWright.goto(i, s.steps, false); }, i);
      await page.waitForTimeout(wait);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      const buf = await page.screenshot({ type: 'png' });
      shots.push(buf);
      if (pngDir) fs.writeFileSync(path.join(pngDir, `slide-${String(i + 1).padStart(2, '0')}.png`), buf);
    }
    if (a.pdf) {
      const imgs = shots.map((b) => `<div class="p"><img src="data:image/png;base64,${b.toString('base64')}"></div>`).join('');
      const pg2 = await browser.newPage();
      await pg2.setContent(`<style>@page{size:${W}px ${H}px;margin:0}body{margin:0}.p{width:${W}px;height:${H}px;break-after:page}img{width:100%;height:100%;display:block}</style>${imgs}`);
      await pg2.pdf({ path: path.resolve(a.pdf), width: W + 'px', height: H + 'px', printBackground: true });
      console.log(`${C.g}✓${C.x} PDF: ${path.resolve(a.pdf)}`);
    }
    if (a.pptx) {
      const ppt = new PptxGen();
      ppt.defineLayout({ name: 'DECKWRIGHT', width: 13.333, height: 13.333 * H / W });
      ppt.layout = 'DECKWRIGHT';
      ppt.title = info.title || inp.name;
      const notesTxt = slides.map((s) => s.notes.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim());
      shots.forEach((b, i) => {
        const sl = ppt.addSlide();
        sl.addImage({ data: 'image/png;base64,' + b.toString('base64'), x: 0, y: 0, w: 13.333, h: 13.333 * H / W });
        if (notesTxt[i]) sl.addNotes(notesTxt[i]);
      });
      await ppt.writeFile({ fileName: path.resolve(a.pptx) });
      console.log(`${C.g}✓${C.x} PPTX: ${path.resolve(a.pptx)} ${C.d}(${t('슬라이드 이미지 + 발표자 노트, 애니메이션 없음', 'slide images + speaker notes, no animation')})${C.x}`);
    }
    if (pngDir) console.log(`${C.g}✓${C.x} PNG ×${shots.length}: ${pngDir}`);
  } finally {
    await browser.close();
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = args(rest);
  if (a.root && cmd !== 'build' && cmd !== 'pack' && cmd !== 'check' && cmd !== 'export') throw new Error(t('--root 는 build, pack, check, export 에서만 씁니다', '--root works with build, pack, check and export'));
  switch (cmd) {
    case 'build': return cmdBuild(a);
    case 'pack': return cmdPack(a);
    case 'inject': return cmdInject(a);
    case 'unpack': return cmdUnpack(a);
    case 'check': return cmdCheck(a);
    case 'export': return cmdExport(a);
    case 'runtime': { const s = runtimeSrc(); if (a.out) { fs.writeFileSync(a.out, s); console.log('✓ ' + a.out); } else process.stdout.write(s); return; }
    case '-v': case '--version': console.log(VERSION); return;
    case undefined: case '-h': case '--help': case 'help': usage(); return;
    default: usage(); console.error(`${C.r}${t('알 수 없는 명령: ', 'Unknown command: ')}${cmd}${C.x}`); process.exitCode = 1;
  }
}

main().catch((e) => { console.error(`${C.r}${t('오류', 'Error')}:${C.x} ${e.message}`); process.exitCode = 1; });
