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
const VERSION = '0.1.2';

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
  deckwright build  <입력> [-o 출력.html]     런타임과 모든 자원을 넣은 단독 HTML 한 개
  deckwright pack   <입력> [-o 출력.hdek]     ZIP 패키지(.hdek)로 묶기 (큰 영상이 많을 때)
  deckwright unpack <파일.hdek> [-o 폴더]     패키지 풀기
  deckwright check  <입력>                    규약·외부 자원·폰트·노트 점검
  deckwright export <입력> [--pdf a.pdf] [--pptx a.pptx] [--png 폴더] [--scale 1]
                                             슬라이드별 최종 화면을 PDF/PPTX/PNG로 (Playwright 필요)
  deckwright runtime [-o 파일.js]             런타임 JS만 꺼내기

<입력>은 HTML 파일, index.html이 있는 폴더, 또는 .hdek 파일입니다.`,
`${C.b}DeckWright ${VERSION}${C.x} — tools for HTML presentation files (.html / .hdek)

Usage:
  deckwright inject <file.html> [-o out.html] Presentable HTML next to the original (runtime only; images/video stay in place)
  deckwright build  <input> [-o out.html]     One self-contained HTML with the runtime and every asset inlined
  deckwright pack   <input> [-o out.hdek]     ZIP package (.hdek), better for decks with large videos
  deckwright unpack <file.hdek> [-o dir]      Extract a package
  deckwright check  <input>                   Check conventions, external assets, fonts and notes
  deckwright export <input> [--pdf a.pdf] [--pptx a.pptx] [--png dir] [--scale 1]
                                             Final state of each slide as PDF/PPTX/PNG (needs Playwright)
  deckwright runtime [-o file.js]             Print or save the runtime script

<input> is an HTML file, a folder containing index.html, or a .hdek file.`));
}

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '-o' || v === '--out') a.out = argv[++i];
    else if (v.startsWith('--')) { const k = v.slice(2); const nx = argv[i + 1]; if (nx && !nx.startsWith('-')) { a[k] = nx; i++; } else a[k] = true; }
    else a._.push(v);
  }
  return a;
}

const runtimeSrc = () => fs.readFileSync(RUNTIME_PATH, 'utf8');
const inflate = (b) => new Uint8Array(zlib.inflateRawSync(b));
const deflate = (b) => new Uint8Array(zlib.deflateRawSync(b, { level: 9 }));
const kb = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB';

/** Read the input as { kind, entry, read } */
async function loadInput(input) {
  if (!input) throw new Error(t('입력 파일을 지정하세요', 'Specify an input file'));
  const abs = path.resolve(input);
  if (!fs.existsSync(abs)) throw new Error(t('파일이 없습니다: ', 'File not found: ') + input);
  const st = fs.statSync(abs);
  if (st.isFile() && /\.(hdek|zip)$/i.test(abs)) {
    const files = await Core.readZip(new Uint8Array(fs.readFileSync(abs)), inflate);
    const f = Core.findEntry(files);
    if (!f) throw new Error(t('패키지에 HTML이 없습니다', 'No HTML file in the package'));
    return { kind: 'package', files, entry: f.entry, manifest: f.manifest, name: path.basename(abs).replace(/\.(hdek|zip)$/i, '') };
  }
  let dir, entry;
  if (st.isDirectory()) {
    dir = abs;
    entry = fs.existsSync(path.join(dir, 'index.html')) ? 'index.html' : fs.readdirSync(dir).find((n) => /\.html?$/i.test(n));
    if (!entry) throw new Error(t('폴더 안에 HTML 파일이 없습니다', 'No HTML file in the folder'));
  } else { dir = path.dirname(abs); entry = path.basename(abs); }
  const read = (p) => {
    const full = path.join(dir, p);
    try { return fs.statSync(full).isFile() ? new Uint8Array(fs.readFileSync(full)) : null; } catch { return null; }
  };
  return { kind: 'fs', dir, entry, read, name: st.isDirectory() ? path.basename(dir) : entry.replace(/\.html?$/i, '') };
}

function readerFor(inp) {
  if (inp.kind === 'package') return (p) => inp.files[p] || null;
  return inp.read;
}

async function buildSingle(inp) {
  const html = Core.utf8Decode(readerFor(inp)(inp.entry));
  const r = await Core.inlineHTML(html, { path: inp.entry, read: readerFor(inp) });
  const info = Core.scan(r.html);
  const manifest = Core.buildManifest({ title: info.title, entry: 'index.html', width: info.width, height: info.height, staged: info.staged, duration: info.duration, slides: info.slides });
  const head = `<script type="application/hdek+json" id="hdek-manifest">${JSON.stringify(manifest).replace(/</g, '\\u003c')}</script>`;
  const out = Core.injectRuntime(r.html, runtimeSrc(), head);
  return { html: out, report: r, info };
}

function defaultOut(inp, ext) { return path.resolve(inp.name + ext); }
const slideCount = (info) => info.slides.length || (info.guess ? '~' + info.guess : '?');

function printReport(report) {
  report.missing = (report.missing || []).filter((m) => !RUNTIME_FILE_RE.test(m));
  report.missing.forEach((m) => console.log(`${C.r}  ✗ ${t('없는 파일', 'Missing file')}: ${m}${C.x}`));
  (report.external || []).forEach((m) => console.log(`${C.y}  ! ${t('외부 참조(오프라인에서 깨짐)', 'External reference (breaks offline)')}: ${m}${C.x}`));
}

async function cmdBuild(a) {
  const inp = await loadInput(a._[0]);
  const { html, report, info } = await buildSingle(inp);
  const out = path.resolve(a.out || defaultOut(inp, '.html'));
  if (inp.kind === 'fs' && out === path.resolve(path.join(inp.dir, inp.entry))) throw new Error(t('입력 파일을 덮어쓸 수 없습니다. -o 로 다른 이름을 지정하세요', 'Refusing to overwrite the input. Use -o to pick another name'));
  fs.writeFileSync(out, html);
  console.log(`${C.g}✓${C.x} ${t('단독 HTML', 'Single HTML')}: ${out} ${C.d}(${kb(Buffer.byteLength(html))}, ${t('슬라이드', 'slides')} ${slideCount(info)}, ${t('자원', 'assets')} ${report.used.length})${C.x}`);
  printReport(report);
  if (Buffer.byteLength(html) > 60 * 1048576) console.log(`${C.y}  ! ${t("파일이 큽니다. 영상이 많다면 'deckwright pack'으로 .hdek 패키지를 쓰는 편이 빠릅니다.", "Large file. For video-heavy decks, 'deckwright pack' (.hdek) loads faster.")}${C.x}`);
}

async function cmdInject(a) {
  const src = a._[0];
  if (!src || !/\.html?$/i.test(src)) throw new Error(t('HTML 파일을 지정하세요', 'Specify an HTML file'));
  const html = fs.readFileSync(src, 'utf8');
  const out = path.resolve(a.out || src.replace(/\.html?$/i, '_DeckWright.html'));
  if (out === path.resolve(src)) throw new Error(t('원본을 덮어쓸 수 없습니다', 'Refusing to overwrite the original'));
  if (path.dirname(out) !== path.dirname(path.resolve(src))) console.log(`${C.y}  ! ${t('출력이 원본과 다른 폴더입니다. 그림·영상 경로가 맞지 않을 수 있습니다.', 'Output is in a different folder from the original; relative image/video paths may break.')}${C.x}`);
  fs.writeFileSync(out, Core.injectRuntime(html, runtimeSrc()));
  console.log(`${C.g}✓${C.x} ${out} ${C.d}(${t('원본과 같은 폴더에서 더블클릭', 'double-click it next to the original')})${C.x}`);
}

async function cmdPack(a) {
  const inp = await loadInput(a._[0]);
  const read = readerFor(inp);
  let entries = [];
  let report = { external: [], missing: [], used: [] };
  if (inp.kind === 'package') {
    entries = Object.keys(inp.files).filter((n) => n !== 'manifest.json' && n !== 'mimetype').map((n) => ({ name: n, bytes: inp.files[n] }));
  } else {
    const html = Core.utf8Decode(read(inp.entry));
    report = await Core.inlineHTML(html, { path: inp.entry, read, mode: 'collect' });
    // Files outside the deck folder (e.g. a dev copy of the runtime) are replaced by runtime injection
    const inside = report.used.filter((p) => !p.startsWith('..') && p !== inp.entry && !RUNTIME_FILE_RE.test(p));
    const extra = [];
    for (const p of inside.filter((p) => /\.css$/i.test(p))) {
      const r2 = await Core.inlineHTML('<style>' + Core.utf8Decode(read(p)) + '</style>', { path: p, read, mode: 'collect' });
      r2.used.forEach((u) => { if (!inside.includes(u) && !extra.includes(u)) extra.push(u); });
      r2.external.forEach((u) => report.external.includes(u) || report.external.push(u));
    }
    entries = [{ name: inp.entry, bytes: read(inp.entry) }].concat(inside.concat(extra).map((p) => ({ name: p, bytes: read(p) })));
  }
  const entryIdx = entries.findIndex((e) => e.name === inp.entry);
  const html = Core.injectRuntime(Core.utf8Decode(entries[entryIdx].bytes), runtimeSrc());
  entries[entryIdx] = { name: inp.entry, bytes: Core.utf8Encode(html) };
  const info = Core.scan(html);
  const files = entries.map((e) => ({ path: e.name, size: e.bytes.length, crc32: Core.crc32(e.bytes).toString(16).padStart(8, '0') }));
  const manifest = Core.buildManifest({ title: info.title || inp.name, entry: inp.entry, width: info.width, height: info.height, staged: info.staged, duration: info.duration, slides: info.slides, files });
  const all = [{ name: 'mimetype', bytes: Core.utf8Encode('application/vnd.hdek+zip') }, { name: 'manifest.json', bytes: Core.utf8Encode(JSON.stringify(manifest, null, 2)) }].concat(entries);
  const zip = Core.writeZip(all, deflate);
  const out = path.resolve(a.out || defaultOut(inp, '.hdek'));
  fs.writeFileSync(out, zip);
  console.log(`${C.g}✓${C.x} ${t('패키지', 'Package')}: ${out} ${C.d}(${kb(zip.length)}, ${t('파일', 'files')} ${entries.length}, ${t('슬라이드', 'slides')} ${slideCount(info)})${C.x}`);
  printReport(report);
}

async function cmdUnpack(a) {
  const src = a._[0];
  if (!src) throw new Error(t('.hdek 파일을 지정하세요', 'Specify a .hdek file'));
  const files = await Core.readZip(new Uint8Array(fs.readFileSync(src)), inflate);
  const outDir = path.resolve(a.out || path.basename(src).replace(/\.(hdek|zip)$/i, ''));
  for (const [name, bytes] of Object.entries(files)) {
    const dest = path.resolve(outDir, name);
    if (!dest.startsWith(outDir + path.sep)) { console.log(`${C.y}  ! ${t('건너뜀(경로 이탈)', 'Skipped (path escapes folder)')}: ${name}${C.x}`); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
  }
  console.log(`${C.g}✓${C.x} ${t(`${Object.keys(files).length}개 파일을 ${outDir} 에 풀었습니다`, `Extracted ${Object.keys(files).length} files to ${outDir}`)}`);
}

async function cmdCheck(a) {
  const inp = await loadInput(a._[0]);
  const read = readerFor(inp);
  const html = Core.utf8Decode(read(inp.entry));
  const r = await Core.inlineHTML(html, { path: inp.entry, read, mode: 'collect' });
  r.missing = r.missing.filter((m) => !RUNTIME_FILE_RE.test(m));
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
  const pw = requireAny('playwright');
  if (!pw) throw new Error(t('내보내기에는 Playwright가 필요합니다: ', 'Export needs Playwright: ') + 'npm i -g playwright && npx playwright install chromium');
  const inp = await loadInput(a._[0]);
  const { html, info } = await buildSingle(inp);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deckwright-'));
  const file = path.join(tmp, 'deck.html');
  fs.writeFileSync(file, html);
  const W = info.staged ? info.width : 1920, H = info.staged ? info.height : 1080;
  const scale = parseFloat(a.scale) || 1;
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(file).href);
  await page.waitForFunction(() => window.DeckWright && window.DeckWright.state && window.DeckWright.state().count > 0, null, { timeout: 30000 });
  await page.addStyleTag({ content: '.hdek-ui,.hdek-bar,.hdek-toast{display:none!important}' });
  const slides = await page.evaluate(() => window.DeckWright.slides());
  const shots = [];
  const pngDir = a.png ? path.resolve(a.png) : null;
  if (pngDir) fs.mkdirSync(pngDir, { recursive: true });
  const wait = parseInt(a.wait, 10) || 400;
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
    const PptxGen = requireAny('pptxgenjs');
    if (!PptxGen) throw new Error(t('PPTX 내보내기에는 pptxgenjs가 필요합니다: ', 'PPTX export needs pptxgenjs: ') + 'npm i -g pptxgenjs');
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
  if (!a.pdf && !a.pptx && !pngDir) console.log(t('내보낼 형식을 지정하세요: --pdf, --pptx, --png', 'Pick a format: --pdf, --pptx, --png'));
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = args(rest);
  switch (cmd) {
    case 'build': return cmdBuild(a);
    case 'pack': return cmdPack(a);
    case 'inject': return cmdInject(a);
    case 'unpack': return cmdUnpack(a);
    case 'check': return cmdCheck(a);
    case 'export': return cmdExport(a);
    case 'runtime': { const s = runtimeSrc(); if (a.out) { fs.writeFileSync(a.out, s); console.log('✓ ' + a.out); } else process.stdout.write(s); return; }
    case '-v': case '--version': console.log(VERSION); return;
    default: usage();
  }
}

main().catch((e) => { console.error(`${C.r}${t('오류', 'Error')}:${C.x} ${e.message}`); process.exitCode = 1; });
