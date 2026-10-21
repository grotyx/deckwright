/*! DeckWright core v0.1.2 | MIT License | https://github.com/grotyx/deckwright
 *  Shared by player.html (browser) and the CLI (Node):
 *  runtime injection, local asset inlining, .hdek (ZIP) read/write, manifest, static checks.
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.DeckWrightCore = root.HDeckCore = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FORMAT = 'hdek/1';
  var LANG = 'en';
  function setLang(l) { LANG = l === 'ko' ? 'ko' : 'en'; }
  function T(ko, en) { return LANG === 'ko' ? ko : en; }

  var MIME = {
    html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', ogv: 'video/ogg',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac',
    vtt: 'text/vtt', txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf', glb: 'model/gltf-binary', gltf: 'model/gltf+json'
  };
  function mimeOf(path) {
    var m = /\.([a-z0-9]+)$/i.exec(path || '');
    return (m && MIME[m[1].toLowerCase()]) || 'application/octet-stream';
  }

  // ---------------------------------------------------------------- bytes / text
  function utf8Encode(s) { return new TextEncoder().encode(s); }
  function utf8Decode(b) { return new TextDecoder('utf-8').decode(b); }
  function b64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var s = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function dataURL(bytes, mime) { return 'data:' + mime + ';base64,' + b64(bytes); }

  // ---------------------------------------------------------------- paths
  function isExternal(u) { return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(u); }
  function isSkippable(u) { return !u || /^(?:data:|blob:|#|about:|javascript:|mailto:|tel:)/i.test(u); }
  function dirname(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i + 1); }
  function normalize(p) {
    var out = [];
    p.split('/').forEach(function (seg) {
      if (!seg || seg === '.') return;
      if (seg === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else out.push('..'); }
      else out.push(seg);
    });
    return out.join('/');
  }
  function resolvePath(base, rel) {
    var clean = rel.replace(/[?#].*$/, '');
    try { clean = decodeURIComponent(clean); } catch (e) { }
    if (clean.charAt(0) === '/') return normalize(clean);
    return normalize(dirname(base) + clean);
  }
  function relPath(fromFile, toFile) {
    var a = dirname(fromFile).split('/').filter(Boolean), b = toFile.split('/');
    while (a.length && b.length > 1 && a[0] === b[0]) { a.shift(); b.shift(); }
    return a.map(function () { return '..'; }).concat(b).join('/');
  }

  // ---------------------------------------------------------------- HTML tokenizing
  // Split out script/style/comment blocks so attribute rewriting only touches plain markup.
  var BLOCK_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<!--[\s\S]*?-->/gi;
  function splitBlocks(html) {
    var parts = [], last = 0, m;
    BLOCK_RE.lastIndex = 0;
    while ((m = BLOCK_RE.exec(html))) {
      if (m.index > last) parts.push({ t: 'markup', s: html.slice(last, m.index) });
      var s = m[0];
      parts.push({ t: /^<script/i.test(s) ? 'script' : /^<style/i.test(s) ? 'style' : 'comment', s: s });
      last = m.index + s.length;
    }
    if (last < html.length) parts.push({ t: 'markup', s: html.slice(last) });
    return parts;
  }
  function getAttr(tag, name) {
    var re = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
    var m = re.exec(tag);
    return m ? (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]) : null;
  }
  function hasAttr(tag, name) { return new RegExp('\\s' + name + '(?=[\\s=>/])', 'i').test(tag); }
  function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
  function unescAttr(s) { return String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); }

  // ---------------------------------------------------------------- asset inlining
  /**
   * inlineHTML(html, opts) → Promise<{html, external[], missing[], used[]}>
   * opts.path     : (virtual) path of the HTML file, e.g. 'index.html'
   * opts.read     : async (path) → Uint8Array | null
   * opts.urlFor   : (bytes, mime, path) → string   (default: data URL)
   * opts.mode     : 'inline' (default) | 'collect' (only list files, leave HTML as is)
   */
  async function inlineHTML(html, opts) {
    opts = opts || {};
    var base = opts.path || 'index.html';
    var read = opts.read;
    var urlFor = opts.urlFor || function (bytes, mime) { return dataURL(bytes, mime); };
    var collect = opts.mode === 'collect';
    var report = { external: [], missing: [], used: [] };
    var cache = {};

    function note(list, v) { if (list.indexOf(v) < 0) list.push(v); }

    async function load(path) {
      if (path in cache) return cache[path];
      var b = null;
      try { b = await read(path); } catch (e) { b = null; }
      cache[path] = b;
      if (b) note(report.used, path); else note(report.missing, path);
      return b;
    }
    async function urlOf(ref, fromPath) {
      ref = unescAttr(ref.trim());
      if (isSkippable(ref)) return null;
      if (isExternal(ref)) { note(report.external, ref); return null; }
      var p = resolvePath(fromPath, ref);
      var bytes = await load(p);
      if (!bytes) return null;
      if (collect) return null;
      var hash = /#.*$/.exec(ref);
      if (/\.css$/i.test(p)) {
        var css = await inlineCSS(utf8Decode(bytes), p);
        return urlFor(utf8Encode(css), 'text/css', p);
      }
      return urlFor(bytes, mimeOf(p), p) + (hash && /\.svg$/i.test(p) ? hash[0] : '');
    }
    async function replaceAsync(str, re, fn) {
      var tasks = [], out = '', last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(str))) { tasks.push({ m: m.slice(), i: m.index, len: m[0].length }); if (!re.global) break; }
      for (var k = 0; k < tasks.length; k++) {
        var t = tasks[k];
        out += str.slice(last, t.i) + (await fn.apply(null, t.m));
        last = t.i + t.len;
      }
      return out + str.slice(last);
    }
    async function inlineCSS(css, fromPath, depth) {
      depth = depth || 0;
      css = await replaceAsync(css, /@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1\s*\)?([^;]*);/gi, async function (all, q, ref, media) {
        if (isExternal(ref)) { note(report.external, ref); return all; }
        var p = resolvePath(fromPath, ref);
        var b = await load(p);
        if (!b || collect || depth > 8) return all;
        var inner = await inlineCSS(utf8Decode(b), p, depth + 1);
        return media && media.trim() ? '@media ' + media.trim() + '{' + inner + '}' : inner;
      });
      css = await replaceAsync(css, /url\(\s*(["']?)([^"')]+)\1\s*\)/gi, async function (all, q, ref) {
        var u = await urlOf(ref, fromPath);
        return u ? 'url("' + u + '")' : all;
      });
      return css;
    }
    async function srcset(val, fromPath) {
      var items = val.split(',');
      var out = [];
      for (var i = 0; i < items.length; i++) {
        var bits = items[i].trim().split(/\s+/);
        if (!bits[0]) continue;
        var u = await urlOf(bits[0], fromPath);
        if (u) bits[0] = u;
        out.push(bits.join(' '));
      }
      return out.join(', ');
    }

    var parts = splitBlocks(html), out = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i], s = part.s;
      if (part.t === 'script') {
        var open = /^<script\b[^>]*>/i.exec(s)[0];
        var src = getAttr(open, 'src');
        if (src && !isSkippable(src)) {
          if (isExternal(src)) { note(report.external, src); out.push(s); continue; }
          var p = resolvePath(base, unescAttr(src));
          var b = await load(p);
          if (b && !collect) {
            var code = utf8Decode(b).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
            var tag = open.replace(/\s(src|integrity|crossorigin)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
            out.push(tag + code + '</script>');
            continue;
          }
        }
        out.push(s);
      } else if (part.t === 'style') {
        var m2 = /^(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)$/i.exec(s);
        out.push(m2 ? m2[1] + (await inlineCSS(m2[2], base)) + m2[3] : s);
      } else if (part.t === 'comment') {
        out.push(s);
      } else {
        s = await replaceAsync(s, /<([a-z][a-z0-9-]*)\b[^>]*>/gi, async function (tag, name) {
          name = name.toLowerCase();
          if (name === 'link') {
            var rel = (getAttr(tag, 'rel') || '').toLowerCase(), href = getAttr(tag, 'href');
            if (!href || isSkippable(href)) return tag;
            if (isExternal(href)) { if (/stylesheet|preload|icon|modulepreload/.test(rel)) note(report.external, href); return tag; }
            if (/stylesheet/.test(rel)) {
              var p2 = resolvePath(base, unescAttr(href));
              var b2 = await load(p2);
              if (!b2 || collect) return tag;
              var media = getAttr(tag, 'media');
              return '<style' + (media ? ' media="' + escAttr(media) + '"' : '') + ' data-hdek-from="' + escAttr(p2) + '">' + (await inlineCSS(utf8Decode(b2), p2)) + '</style>';
            }
            if (/icon|preload/.test(rel)) {
              var u0 = await urlOf(href, base);
              return u0 ? tag.replace(/(\shref\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/i, '$1"' + escAttr(u0) + '"') : tag;
            }
            return tag;
          }
          var attrs = ['src', 'poster', 'data-src', 'data-bg', 'background'];
          if (name === 'image' || name === 'feimage') attrs.push('href', 'xlink:href');
          if (name === 'object') attrs.push('data');
          if (name === 'iframe') attrs = []; // leave nested HTML alone
          for (var a = 0; a < attrs.length; a++) {
            var v = getAttr(tag, attrs[a]);
            if (v === null) continue;
            // skip data-* values that are colors or plain values (e.g. data-bg="231F20"), not paths
            if (/^data-|^background$/.test(attrs[a]) && !/[./]/.test(v)) continue;
            var u = await urlOf(v, base);
            if (u) tag = tag.replace(new RegExp('(\\s' + attrs[a].replace(':', '\\:') + '\\s*=\\s*)("[^"]*"|\'[^\']*\'|[^\\s>]+)', 'i'), '$1"' + escAttr(u) + '"');
          }
          var ss = getAttr(tag, 'srcset');
          if (ss) {
            var nv = await srcset(unescAttr(ss), base);
            tag = tag.replace(/(\ssrcset\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)/i, '$1"' + escAttr(nv) + '"');
          }
          var st = getAttr(tag, 'style');
          if (st && /url\(/i.test(st)) {
            var ns = await inlineCSS(unescAttr(st), base);
            tag = tag.replace(/(\sstyle\s*=\s*)("[^"]*"|'[^']*')/i, function (all, pre) { return pre + '"' + escAttr(ns) + '"'; });
          }
          return tag;
        });
        out.push(s);
      }
    }
    report.html = collect ? html : out.join('');
    return report;
  }

  // ---------------------------------------------------------------- runtime injection
  function hasRuntime(html) { return /<script\b[^>]*\bdata-hdek-runtime\b[^>]*>(?!\s*<\/script)/i.test(html) && /(deckwright|hdeck) runtime/i.test(html); }

  function injectRuntime(html, runtimeSrc, extraHead) {
    var code = runtimeSrc.replace(/<\/script/gi, '<\\/script');
    var tag = '<script data-hdek-runtime>\n' + code + '\n</script>';
    // remove any existing runtime (external reference or older version) and insert the current one
    html = html.replace(/<script\b[^>]*\bdata-hdek-runtime\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    if (extraHead) {
      if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, extraHead + '\n</head>');
      else html = extraHead + html;
    }
    var idx = html.search(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i);
    if (idx >= 0) return html.slice(0, idx) + tag + '\n' + html.slice(idx);
    var hidx = html.search(/<\/html\s*>/i);
    if (hidx >= 0) return html.slice(0, hidx) + tag + '\n' + html.slice(hidx);
    return html + '\n' + tag;
  }

  // ---------------------------------------------------------------- static scan
  function stripTags(s) { return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }

  function scan(html) {
    var info = { contract: false, staged: false, width: 1920, height: 1080, title: '', duration: 0, slides: [] };
    var t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    info.title = t ? stripTags(t[1]) : '';
    var root = /<[a-z]+\b[^>]*\sdata-hdek(?=[\s=>])[^>]*>/i.exec(html);
    if (root) {
      info.staged = getAttr(root[0], 'data-fit') !== 'none';
      info.width = parseInt(getAttr(root[0], 'data-width'), 10) || 1920;
      info.height = parseInt(getAttr(root[0], 'data-height'), 10) || 1080;
      info.title = getAttr(root[0], 'data-title') || info.title;
      info.duration = parseFloat(getAttr(root[0], 'data-duration')) || 0;
    }
    var markup = splitBlocks(html).filter(function (p) { return p.t === 'markup'; }).map(function (p) { return p.s; }).join('');
    var re = /<([a-z]+)\b[^>]*\sdata-slide(?=[\s=>/])(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?[^>]*>/gi, m, starts = [];
    while ((m = re.exec(markup))) starts.push({ i: m.index, tag: m[0], id: m[2] || m[3] || m[4] || '' });
    info.contract = !!(root || starts.length);
    if (!info.contract) {
      var g = markup.match(/<(section|div|article)\b[^>]*class\s*=\s*["'](?:[^"']*\s)?(slide|scene)(?:\s[^"']*)?["']/gi);
      info.guess = g ? g.length : 0;
    }
    starts.forEach(function (st, k) {
      var body = markup.slice(st.i, k + 1 < starts.length ? starts[k + 1].i : markup.length);
      var h = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(body);
      var notes = /<aside\b[^>]*class\s*=\s*["'][^"']*\bnotes\b[^"']*["'][^>]*>([\s\S]*?)<\/aside>/i.exec(body);
      var steps = 0, counter = 0, sm, sre = /\sdata-step(?:\s*=\s*["']?(\d*)["']?)?(?=[\s>])/gi;
      while ((sm = sre.exec(body))) { var n = parseInt(sm[1], 10); counter = n > 0 ? Math.max(counter, n) : counter + 1; }
      steps = Math.max(counter, parseInt(getAttr(st.tag, 'data-steps'), 10) || 0);
      info.slides.push({
        id: st.id || ('s' + (k + 1)),
        title: getAttr(st.tag, 'data-title') || (h ? stripTags(h[1]) : '') || (T('슬라이드 ', 'Slide ') + (k + 1)),
        steps: steps,
        notes: !!(notes && stripTags(notes[1]))
      });
    });
    return info;
  }

  function buildManifest(o) {
    return {
      format: FORMAT,
      generator: o.generator || 'deckwright',
      title: o.title || '',
      entry: o.entry || 'index.html',
      created: o.created || new Date().toISOString(),
      stage: { width: o.width || 1920, height: o.height || 1080, fit: o.staged === false ? 'none' : 'contain' },
      duration: o.duration || undefined,
      slides: (o.slides || []).map(function (s) { return { id: s.id, title: s.title, steps: s.steps }; }),
      files: o.files || undefined
    };
  }

  // ---------------------------------------------------------------- ZIP
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /** writeZip(entries[{name, bytes}], deflateRaw?) → Uint8Array (stored uncompressed without deflateRaw) */
  function writeZip(entries, deflateRaw) {
    var locals = [], centrals = [], offset = 0;
    var dt = new Date(), dosTime = ((dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1)) & 0xFFFF;
    var dosDate = (((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate()) & 0xFFFF;
    entries.forEach(function (e) {
      var name = utf8Encode(e.name), data = e.bytes, method = 0, comp = data;
      var already = /\.(png|jpe?g|gif|webp|avif|mp4|m4v|webm|mov|mp3|m4a|woff2?|zip|gz)$/i.test(e.name);
      if (deflateRaw && !already && data.length > 64) {
        var d = deflateRaw(data);
        if (d.length < data.length) { comp = d; method = 8; }
      }
      // mimetype goes first, uncompressed (EPUB/ODF convention)
      if (e.name === 'mimetype') { comp = data; method = 0; }
      var crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, comp.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      locals.push(new Uint8Array(lh.buffer), name, comp);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, comp.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      centrals.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + comp.length;
    });
    var cdSize = centrals.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    var all = locals.concat(centrals, [new Uint8Array(end.buffer)]);
    var total = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(total), pos = 0;
    all.forEach(function (b) { out.set(b, pos); pos += b.length; });
    return out;
  }

  /** readZip(bytes, inflateRaw?) → Promise<Object name→Uint8Array>  (browsers use DecompressionStream) */
  async function readZip(bytes, inflateRaw) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error(T('ZIP 형식이 아닙니다 (끝 레코드 없음)', 'Not a ZIP file (no end record)'));
    var count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    var files = {}, p = cdOff;
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error(T('ZIP 중앙 디렉터리가 손상되었습니다', 'ZIP central directory is damaged'));
      var flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
      var csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      var loff = dv.getUint32(p + 42, true);
      var nameBytes = bytes.subarray(p + 46, p + 46 + nlen);
      var name = (flags & 0x800) ? utf8Decode(nameBytes) : utf8Decode(nameBytes);
      p += 46 + nlen + xlen + clen;
      if (/\/$/.test(name)) continue;
      if (flags & 1) throw new Error(T('암호화된 ZIP은 지원하지 않습니다: ', 'Encrypted ZIP is not supported: ') + name);
      var lnlen = dv.getUint16(loff + 26, true), lxlen = dv.getUint16(loff + 28, true);
      var start = loff + 30 + lnlen + lxlen;
      var comp = bytes.subarray(start, start + csize);
      var data;
      if (method === 0) data = comp.slice();
      else if (method === 8) data = inflateRaw ? inflateRaw(comp) : await inflateBrowser(comp);
      else throw new Error(T('지원하지 않는 압축 방식(', 'Unsupported compression method (') + method + '): ' + name);
      files[normalize(name)] = data;
    }
    return files;
  }
  async function inflateBrowser(comp) {
    if (typeof DecompressionStream === 'undefined') throw new Error(T('이 브라우저는 ZIP 압축 해제를 지원하지 않습니다 (최신 Chrome/Edge/Safari/Firefox 필요)', 'This browser cannot unzip (needs a recent Chrome/Edge/Safari/Firefox)'));
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([comp]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // ---------------------------------------------------------------- package helpers
  function findEntry(files) {
    if (files['manifest.json']) {
      try {
        var m = JSON.parse(utf8Decode(files['manifest.json']));
        if (m.entry && files[normalize(m.entry)]) return { entry: normalize(m.entry), manifest: m };
      } catch (e) { }
    }
    if (files['index.html']) return { entry: 'index.html', manifest: null };
    var htmls = Object.keys(files).filter(function (k) { return /\.html?$/i.test(k); }).sort(function (a, b) { return a.split('/').length - b.split('/').length; });
    return htmls.length ? { entry: htmls[0], manifest: null } : null;
  }

  /** Merge a package (file map) into one self-contained HTML */
  async function packageToHTML(files, runtimeSrc, opts) {
    opts = opts || {};
    var found = findEntry(files);
    if (!found) throw new Error(T('패키지 안에 HTML 파일이 없습니다', 'No HTML file in the package'));
    var html = utf8Decode(files[found.entry]);
    var r = await inlineHTML(html, {
      path: found.entry,
      read: function (p) { return files[p] || null; },
      urlFor: opts.urlFor
    });
    var out = runtimeSrc ? injectRuntime(r.html, runtimeSrc) : r.html;
    return { html: out, entry: found.entry, manifest: found.manifest, external: r.external, missing: r.missing };
  }

  // ---------------------------------------------------------------- lint
  function lint(html, report) {
    html = html.replace(/<script\b[^>]*\bdata-hdek-runtime\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
    var info = scan(html), issues = [];
    function add(level, msg) { issues.push({ level: level, msg: msg }); }
    if (!info.contract) add('info', T('hdek 규약(data-hdek / data-slide)이 없어 자동 인식으로 엽니다. 대부분의 AI 생성 덱은 그대로 동작하지만, 규약을 쓰면 단계·노트가 가장 정확합니다.', 'No hdek markup (data-hdek / data-slide); the deck opens in auto-detect mode. Most AI-made decks work as is, but the markup gives the most precise steps and notes.'));
    if (info.contract && !info.slides.length) add('warn', T('data-slide 요소가 없습니다.', 'No data-slide elements.'));
    info.slides.forEach(function (s, i) { if (!s.notes) add('info', T((i + 1) + '번 슬라이드(' + s.title + ')에 발표자 노트가 없습니다.', 'Slide ' + (i + 1) + ' (' + s.title + ') has no speaker notes.')); });
    (report && report.external || []).forEach(function (u) {
      var kind = /fonts\.(googleapis|gstatic)|\.woff2?|\.ttf|\.otf/i.test(u) ? T('웹폰트', 'web font') : /\.css(\?|$)/i.test(u) ? T('스타일시트', 'stylesheet') : /\.m?js(\?|$)|cdn/i.test(u) ? T('스크립트', 'script') : T('자원', 'asset');
      add('warn', T('외부 ' + kind + ' 참조: ' + u + ' — 인터넷이 없는 곳에서는 깨집니다. 로컬 파일로 바꾸세요.', 'External ' + kind + ': ' + u + ' — breaks without internet. Use a local file.'));
    });
    (report && report.missing || []).forEach(function (p) { add('error', T('파일을 찾을 수 없습니다: ', 'File not found: ') + p); });
    if (/\b\d+(\.\d+)?v[wh]\b/.test(html) && info.staged) add('info', T('vw/vh 단위가 있습니다. 고정 무대(data-hdek) 덱에서는 px 단위가 화면 비율 변화에 더 안전합니다.', 'Uses vw/vh units. In a fixed-stage (data-hdek) deck, px units are safer across screen ratios.'));
    if (/Math\.random\(/.test(html)) add('info', T('Math.random()을 쓰고 있습니다. 발표자 창 미리보기와 청중 화면이 다르게 보일 수 있습니다.', 'Uses Math.random(); the presenter preview may differ from the audience screen.'));
    if (/\.(webm|mov|mkv|hevc)\b/i.test(html)) add('warn', T('WebM/MOV 영상은 일부 PC에서 재생되지 않습니다. H.264 MP4를 권장합니다.', 'WebM/MOV video does not play on some PCs. Use H.264 MP4.'));
    return { info: info, issues: issues };
  }

  return {
    FORMAT: FORMAT, setLang: setLang, mimeOf: mimeOf, dataURL: dataURL, utf8Encode: utf8Encode, utf8Decode: utf8Decode,
    resolvePath: resolvePath, relPath: relPath, isExternal: isExternal,
    inlineHTML: inlineHTML, injectRuntime: injectRuntime, hasRuntime: hasRuntime,
    scan: scan, buildManifest: buildManifest, lint: lint,
    crc32: crc32, writeZip: writeZip, readZip: readZip, findEntry: findEntry, packageToHTML: packageToHTML
  };
});
