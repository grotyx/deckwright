// Build release files:
//   skills/deckwright/player.html   (player shipped with the skill)
//   docs/                           (GitHub Pages: player, demo deck, demo .hdek)
//   dist/                           (local build output used by tests; git-ignored)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = path.join(ROOT, 'skills', 'deckwright');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const dist = path.join(ROOT, 'dist');
const docs = path.join(ROOT, 'docs');
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(docs, { recursive: true });

const runtimePath = 'skills/deckwright/runtime/deckwright-runtime.js';
const runtime = rd(runtimePath);
const core = rd('skills/deckwright/core/deckwright-core.js');
const safeJS = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const runtimeJSON = JSON.stringify(runtime).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--');

let player = rd('player/player.src.html');
player = player.replace('/*__CORE__*/', () => safeJS(core));
player = player.replace('/*__RUNTIME_JSON__*/""', () => runtimeJSON);
for (const out of [path.join(dist, 'player.html'), path.join(SKILL, 'player.html'), path.join(docs, 'player.html')]) fs.writeFileSync(out, player);
fs.copyFileSync(path.join(ROOT, runtimePath), path.join(dist, 'deckwright-runtime.js'));

const cli = path.join(SKILL, 'scripts', 'deckwright.mjs');
const run = (...a) => execFileSync(process.execPath, [cli, ...a], { stdio: 'inherit', cwd: ROOT });
run('build', 'examples/demo', '-o', 'dist/demo.html');
run('pack', 'examples/demo', '-o', 'dist/demo.hdek');
run('build', 'examples/ai-style/index.html', '-o', 'dist/ai-style.html');
fs.copyFileSync(path.join(dist, 'demo.html'), path.join(docs, 'demo.html'));
fs.copyFileSync(path.join(dist, 'demo.hdek'), path.join(docs, 'demo.hdek'));
console.log('✓ player.html (' + Math.round(player.length / 1024) + ' KB) → dist/, docs/, skills/deckwright/');

// Skill zip for claude.ai (Settings → Capabilities → Skills → Upload) and manual installs
const Core = createRequire(import.meta.url)(path.join(SKILL, 'core', 'deckwright-core.js'));
const entries = [];
(function walk(dir, rel) {
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name), r = rel ? rel + '/' + name : name;
    if (fs.statSync(abs).isDirectory()) walk(abs, r);
    else entries.push({ name: 'deckwright/' + r, bytes: new Uint8Array(fs.readFileSync(abs)) });
  }
})(SKILL, '');
const skillZip = Core.writeZip(entries, (b) => new Uint8Array(zlib.deflateRawSync(b, { level: 9 })));
fs.writeFileSync(path.join(docs, 'deckwright-skill.zip'), skillZip);
fs.writeFileSync(path.join(dist, 'deckwright-skill.zip'), skillZip);
console.log('✓ deckwright-skill.zip (' + Math.round(skillZip.length / 1024) + ' KB, ' + entries.length + ' files) → docs/, dist/');
