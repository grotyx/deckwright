"""DeckWright tests: runtime, presenter view, ink, print, player and CLI in real Chromium (file://).
Run: npm test   (or: node tools/build.mjs && python3 test/run_tests.py)
Needs: pip install playwright pdfplumber python-pptx; npm i -g playwright pptxgenjs (for export)
"""
import os, sys, subprocess, tempfile, json, zipfile
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
TMP = tempfile.mkdtemp(prefix='deckwright-test-')
results = []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('  ✓ ' if cond else '  ✗ ') + name + ('' if cond else f'  → {detail}'))

def cli(*args):
    return subprocess.run(['node', os.path.join(ROOT, 'skills', 'deckwright', 'scripts', 'deckwright.mjs'), *args], cwd=ROOT, capture_output=True, text=True)

def url(p): return 'file://' + os.path.abspath(p)

with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # ------------------------------------------------------------ single HTML
    print('Single HTML (dist/demo.html)')
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url(os.path.join(DIST, 'demo.html'))); pg.wait_for_timeout(500)
    st = lambda: pg.evaluate('DeckWright.state()')
    s = st()
    check('contract mode, 7 slides', s['mode'] == 'contract' and s['count'] == 7, s)
    check('1920×1080 stage scaled to fit', 'scale(' in pg.evaluate("document.querySelector('[data-hdek]').style.transform"))
    for _ in range(3): pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(120)
    check('→ ×3: slide 2, step 2', st()['slide'] == 1 and st()['step'] == 2, st())
    pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(30)
    ops = pg.evaluate("[...document.querySelectorAll('.hdek-current .hdek-step')].map(e=>getComputedStyle(e).opacity)")
    check('← snaps to previous step without animation', ops[:2] == ['1', '0'], ops)
    pg.keyboard.type('3'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(1500)
    check('number+Enter jumps to slide 3, JS hook counter reaches 128', pg.evaluate("document.querySelector('[data-count]').textContent") == '128', pg.evaluate("document.querySelector('[data-count]').textContent"))
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(50)
    check('hook slide: back restores state instantly', pg.evaluate("document.querySelector('[data-bar]').style.height") == '0%')
    pg.keyboard.type('5'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    pg.click('.card >> nth=0'); pg.wait_for_timeout(150)
    check('clicking a cursor:pointer element does not advance', st()['slide'] == 4)
    pg.mouse.click(1200, 80); pg.wait_for_timeout(150)
    check('clicking empty space advances', st()['slide'] == 5)
    pg.mouse.wheel(0, 150); pg.wait_for_timeout(150)
    check('wheel down = next step', st()['step'] == 1, st())
    pg.keyboard.press('b'); check('B = black screen', pg.evaluate("document.querySelector('.hdek-blank').classList.contains('on')"))
    pg.keyboard.press('b')
    check('position stored in URL hash', pg.evaluate('location.hash') == '#6.1', pg.evaluate('location.hash'))

    # presenter view
    with ctx.expect_page() as pi: pg.keyboard.press('s')
    pp = pi.value; pp.wait_for_timeout(1800)
    frames = {f.name: f for f in pp.frames if f.name.startswith('hdek-preview')}
    check('presenter view opens with 2 previews', len(frames) == 2, list(frames))
    check('presenter slide number', pp.inner_text('#num') == '6 / 7', pp.inner_text('#num'))
    check('current preview matches audience', frames['hdek-preview-cur'].evaluate('DeckWright.state().step') == 1)
    check('next preview shows next step', frames['hdek-preview-nxt'].evaluate('[DeckWright.state().slide, DeckWright.state().step]') == [5, 2])
    check('notes shown', 'data-step-out' in pp.inner_text('#notes'))
    pp.keyboard.press('ArrowRight'); pp.wait_for_timeout(300)
    check('advancing in presenter moves audience', st()['step'] == 2, st())
    pp.click('button[data-act="list"]'); pp.click('#list li >> nth=1'); pp.wait_for_timeout(300)
    check('pick slide from list', st()['slide'] == 1, st())
    # ink drawn in the presenter view is stored on the audience side
    pp.click('button[data-act="pen"]')
    box = pp.locator('#curbox').bounding_box()
    pp.mouse.move(box['x'] + 50, box['y'] + 60); pp.mouse.down()
    for k in range(10): pp.mouse.move(box['x'] + 50 + k * 20, box['y'] + 60 + k * 6)
    pp.mouse.up(); pp.wait_for_timeout(200)
    ink = pg.evaluate('DeckWright.ink()')
    check('presenter ink saved in audience data', len(ink.get('steps', [])) == 1, ink.keys())
    px = pg.evaluate("(()=>{const c=document.querySelector('.hdek-ink');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n})()")
    check('ink rendered on audience canvas', px > 100, px)
    pp.keyboard.press('Escape')
    pg.reload(); pg.wait_for_timeout(500)
    check('position and ink survive reload', st()['slide'] == 1 and len(pg.evaluate('DeckWright.ink()').get('steps', [])) == 1, st())
    # print
    pdf = os.path.join(TMP, 'print.pdf')
    pg.pdf(path=pdf, prefer_css_page_size=True, print_background=True)
    import pdfplumber
    with pdfplumber.open(pdf) as d: n = len(d.pages)
    check('Ctrl+P print = one page per slide', n == 7, n)
    check('state restored after print', st()['slide'] == 1 and pg.evaluate("getComputedStyle(document.querySelectorAll('.hdek-slide')[0]).display") == 'none')
    check('no page errors', not errors, errors)
    ctx.close()

    # UI language follows the browser (ko / en)
    for loc, word in (('ko-KR', '다음'), ('en-US', 'Next')):
        ctx = browser.new_context(viewport={'width': 1280, 'height': 720}, locale=loc); pg = ctx.new_page()
        pg.goto(url(os.path.join(DIST, 'demo.html'))); pg.wait_for_timeout(400)
        pg.keyboard.press('?'); pg.wait_for_timeout(100)
        check(f'UI language follows browser ({loc})', word in pg.inner_text('.hdek-help'), pg.inner_text('.hdek-help')[:80])
        ctx.close()

    # ------------------------------------------------------------ deck without contract
    print('AI-style deck without contract (heuristic)')
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page()
    pg.goto(url(os.path.join(DIST, 'ai-style.html'))); pg.wait_for_timeout(500)
    s = pg.evaluate('DeckWright.state()')
    check('heuristic mode, 4 slides', s['mode'] == 'heuristic' and s['count'] == 4, s)
    check('.notes used as speaker notes', 'knows nothing about deckwright' in pg.evaluate('DeckWright.slides()[0].notes'))
    for _ in range(3): pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(120)
    s = pg.evaluate('DeckWright.state()')
    check('.fragment as steps (slide 3, step 1)', s['slide'] == 2 and s['step'] == 1, s)
    check('no double move with the deck\'s own key handler', pg.evaluate("document.querySelectorAll('.slide.active').length") == 1)
    ctx.close()

    # ------------------------------------------------------------ deck with its own engine (driver)
    print('Deck with its own navigation engine (driver)')
    out = os.path.join(TMP, 'stage.html'); cli('build', 'test/fixtures/stage-engine', '-o', out)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url(out)); pg.wait_for_function('window.DeckWright && DeckWright.state().count>1')
    st = lambda: pg.evaluate('[DeckWright.state().slide, DeckWright.state().step]')
    check('driver mode, 4 scenes', pg.evaluate('DeckWright.state().mode') == 'driver' and pg.evaluate('DeckWright.state().count') == 4)
    check('aside.note inside scene used as notes', pg.evaluate('DeckWright.slides()[3].notes') == '끝 노트')
    seq = []
    for _ in range(4): pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(80); seq.append(st())
    check('→ handled by deck engine, state tracked', seq == [[0, 1], [0, 2], [1, 0], [1, 1]], seq)
    check('matches deck\'s own counter', pg.inner_text('#count') == '2/4')
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(150)
    check('↓ (unknown to deck) handled by runtime', st() == [2, 0], st())
    pg.mouse.click(900, 400); pg.wait_for_timeout(150)
    check('click handled by deck: no double move', st() == [3, 0], st())
    pg.keyboard.type('4'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    check('number jump: deck does not also handle Enter', st() == [3, 0], st())
    pg.evaluate('DeckWright.goto(3, 2, false)'); pg.wait_for_timeout(100)
    check('goto(slide, step) snaps', st() == [3, 2], st())
    with ctx.expect_page() as pi: pg.keyboard.press('s')
    pp = pi.value; pp.wait_for_timeout(1800)
    fr = {f.name: f for f in pp.frames if f.name.startswith('hdek-preview')}
    check('driver presenter previews in sync', fr['hdek-preview-cur'].evaluate('[DeckWright.state().slide,DeckWright.state().step]') == [3, 2] and fr['hdek-preview-nxt'].evaluate('[DeckWright.state().slide,DeckWright.state().step]') == [3, 3])
    check('previews do not change audience state', st() == [3, 2], st())
    pdf = os.path.join(TMP, 'stage.pdf'); pg.pdf(path=pdf, prefer_css_page_size=True, print_background=True)
    import pdfplumber
    with pdfplumber.open(pdf) as d: n = len(d.pages)
    check('driver deck print = one page per scene', n == 4, n)
    check('driver: no page errors', not errors, errors)
    ctx.close()

    # ------------------------------------------------------------ stacked fixed-size slides (autostage)
    print('Stacked fixed-size slides (autostage)')
    out = os.path.join(TMP, 'stacked.html'); cli('build', 'test/fixtures/stacked-pt', '-o', out)
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page()
    pg.goto(url(out)); pg.wait_for_function('window.DeckWright && DeckWright.state().count>1')
    check('starts after deck\'s load handlers (measurements non-zero)', pg.evaluate("[...document.querySelectorAll('.fit')].every(e=>e.textContent==='measured')"))
    check('sibling aside.notes used as notes', pg.evaluate('DeckWright.slides()[1].notes').find('노트 2') >= 0)
    r = pg.evaluate("(()=>{const r=document.querySelector('.hdek-current').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
    check('720pt×405pt slide fills the viewport', abs(r[2] - 1280) < 2 and abs(r[3] - 720) < 2, r)
    check('notes hidden on screen', pg.evaluate("getComputedStyle(document.querySelector('aside.notes')).display") == 'none')
    ctx.close()

    # ------------------------------------------------------------ player
    print('player.html + .hdek')
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url(os.path.join(DIST, 'player.html')))
    pg.set_input_files('#file', os.path.join(DIST, 'demo.hdek')); pg.wait_for_selector('#info', state='visible')
    check('package info shown', ('7 slides' in pg.inner_text('#meta') or '슬라이드 7개' in pg.inner_text('#meta')), pg.inner_text('#meta'))
    pg.click('#start'); pg.wait_for_timeout(800)
    check('start presenting from player', pg.evaluate('DeckWright.state().count') == 7)
    with ctx.expect_page() as pi: pg.keyboard.press('s')
    pp = pi.value; pp.wait_for_timeout(1800)
    fr = [f for f in pp.frames if f.name.startswith('hdek-preview')]
    check('player-mode presenter previews work', all(f.evaluate('!!window.DeckWright') for f in fr) and len(fr) == 2)
    check('player: no page errors', not errors, errors)
    # open folder
    pg2 = ctx.new_page(); pg2.goto(url(os.path.join(DIST, 'player.html')))
    fx = os.path.join(ROOT, 'test', 'fixtures', 'assets-deck')
    pg2.set_input_files('#dir', fx); pg2.wait_for_selector('#info', state='visible')
    check('open folder: warns about external web font', 'fonts.googleapis.com' in pg2.inner_text('#issues'))
    pg2.click('#start'); pg2.wait_for_timeout(800)
    check('folder deck: CSS fonts/backgrounds inlined', pg2.evaluate("getComputedStyle(document.querySelector('section')).backgroundImage.startsWith('url(\"data:image/png')"))
    ctx.close()

    browser.close()

# ------------------------------------------------------------ CLI
print('CLI')
out = os.path.join(TMP, 'a.hdek')
r = cli('pack', 'test/fixtures/assets-deck', '-o', out)
check('pack succeeds', r.returncode == 0, r.stderr)
z = zipfile.ZipFile(out); names = z.namelist()
check('mimetype first and stored', names[0] == 'mimetype' and z.getinfo('mimetype').compress_type == 0, names)
check('manifest + non-ASCII (Korean) file name preserved', 'manifest.json' in names and 'img/한글 그림.png' in names, names)
check('standard unzip integrity', z.testzip() is None)
m = json.loads(z.read('manifest.json')); check('manifest format', m['format'] == 'hdek/1' and len(m['slides']) == 2, m)
r = cli('unpack', out, '-o', os.path.join(TMP, 'u'))
check('unpack succeeds', r.returncode == 0 and os.path.exists(os.path.join(TMP, 'u', 'index.html')), r.stderr)
r = cli('check', 'examples/demo'); check('check: demo has no errors', r.returncode == 0, r.stdout)
r = cli('export', 'dist/demo.hdek', '--pptx', os.path.join(TMP, 'd.pptx'), '--pdf', os.path.join(TMP, 'd.pdf'))
check('export PDF/PPTX', r.returncode == 0 and os.path.getsize(os.path.join(TMP, 'd.pptx')) > 50000, r.stderr or r.stdout)
try:
    from pptx import Presentation
    p = Presentation(os.path.join(TMP, 'd.pptx'))
    check('PPTX has 7 slides + notes', len(p.slides) == 7 and 'title slide' in p.slides[0].notes_slide.notes_text_frame.text)
except ImportError:
    pass

ok = sum(1 for r in results if r[1]); total = len(results)
print(f'\n{ok}/{total} passed')
sys.exit(0 if ok == total else 1)
