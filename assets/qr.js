/* ============================================================
   Tiny QR encoder — byte mode, ECC level L, versions 1..10.
   Enough for any Instagram / WhatsApp / Google URL.

   Why this exists: you will post hundreds of reels. Paste the URL
   into config.js and the code is drawn in the browser. No files to
   generate, nothing to upload, works offline.

   window.qrSvg(text, size)  ->  a data: URI you can put in <img src>
   ============================================================ */
(function () {

  /* ---- Galois field GF(256) ---- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11d;
    }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  /* ---- Reed–Solomon ---- */
  function rsPoly(n) {
    var p = [1];
    for (var i = 0; i < n; i++) {
      var q = p.concat([0]);
      for (var j = 0; j < p.length; j++) q[j + 1] ^= mul(p[j], EXP[i]);
      p = q;
    }
    return p;
  }
  function rsEncode(data, ecLen) {
    var gen = rsPoly(ecLen), res = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift(); res.push(0);
      for (var j = 0; j < ecLen; j++) res[j] ^= mul(gen[j + 1], factor);
    }
    return res;
  }

  /* ---- capacity tables, ECC level L, versions 1..10 ----
     [ total codewords, ec codewords per block, block counts ]        */
  var VER = {
    1:  { tot: 26,  ec: 7,  g1: 1, d1: 19 },
    2:  { tot: 44,  ec: 10, g1: 1, d1: 34 },
    3:  { tot: 70,  ec: 15, g1: 1, d1: 55 },
    4:  { tot: 100, ec: 20, g1: 1, d1: 80 },
    5:  { tot: 134, ec: 26, g1: 1, d1: 108 },
    6:  { tot: 172, ec: 18, g1: 2, d1: 68 },
    7:  { tot: 196, ec: 20, g1: 2, d1: 78 },
    8:  { tot: 242, ec: 24, g1: 2, d1: 97 },
    9:  { tot: 292, ec: 30, g1: 2, d1: 116 },
    10: { tot: 346, ec: 18, g1: 2, d1: 68, g2: 2, d2: 69 }
  };
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function utf8(str) {
    var out = [], s = encodeURIComponent(str);
    for (var i = 0; i < s.length; i++) {
      if (s[i] === "%") { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; }
      else out.push(s.charCodeAt(i));
    }
    return out;
  }

  function build(text) {
    var bytes = utf8(text), ver = 0, spec = null;
    for (var v = 1; v <= 10; v++) {
      var s = VER[v];
      var cap = s.g1 * s.d1 + (s.g2 || 0) * (s.d2 || 0);
      var lenBits = v < 10 ? 8 : 16;
      if ((4 + lenBits + bytes.length * 8) <= cap * 8) { ver = v; spec = s; break; }
    }
    if (!ver) throw new Error("QR: text too long");

    /* --- bit stream --- */
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4);                                   // byte mode
    push(bytes.length, ver < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    var capBits = (spec.g1 * spec.d1 + (spec.g2 || 0) * (spec.d2 || 0)) * 8;
    for (i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var pad = [0xEC, 0x11], k = 0;
    while (bits.length < capBits) { push(pad[k++ % 2], 8); }

    var codes = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      codes.push(b);
    }

    /* --- split into blocks, add EC --- */
    var blocks = [], ecs = [], p = 0, bi;
    for (bi = 0; bi < spec.g1; bi++) { blocks.push(codes.slice(p, p + spec.d1)); p += spec.d1; }
    for (bi = 0; bi < (spec.g2 || 0); bi++) { blocks.push(codes.slice(p, p + spec.d2)); p += spec.d2; }
    for (bi = 0; bi < blocks.length; bi++) ecs.push(rsEncode(blocks[bi], spec.ec));

    var out = [], maxD = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < maxD; i++)
      for (bi = 0; bi < blocks.length; bi++)
        if (i < blocks[bi].length) out.push(blocks[bi][i]);
    for (i = 0; i < spec.ec; i++)
      for (bi = 0; bi < ecs.length; bi++) out.push(ecs[bi][i]);

    /* --- matrix --- */
    var n = ver * 4 + 17;
    var m = [], reserved = [];
    for (i = 0; i < n; i++) { m.push(new Array(n).fill(0)); reserved.push(new Array(n).fill(0)); }

    function finder(r, c) {
      for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
        var rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        var on = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
                 (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6)) ||
                 (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
        m[rr][cc] = on ? 1 : 0; reserved[rr][cc] = 1;
      }
    }
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

    var al = ALIGN[ver];
    for (i = 0; i < al.length; i++) for (var jj = 0; jj < al.length; jj++) {
      var r = al[i], c = al[jj];
      if (reserved[r] && reserved[r][c]) continue;
      for (var dr2 = -2; dr2 <= 2; dr2++) for (var dc2 = -2; dc2 <= 2; dc2++) {
        m[r + dr2][c + dc2] = (Math.abs(dr2) === 2 || Math.abs(dc2) === 2 ||
                               (dr2 === 0 && dc2 === 0)) ? 1 : 0;
        reserved[r + dr2][c + dc2] = 1;
      }
    }
    for (i = 8; i < n - 8; i++) {
      m[6][i] = (i % 2 === 0) ? 1 : 0; reserved[6][i] = 1;
      m[i][6] = (i % 2 === 0) ? 1 : 0; reserved[i][6] = 1;
    }
    m[n - 8][8] = 1; reserved[n - 8][8] = 1;                 // dark module
    for (i = 0; i < 9; i++) {
      if (!reserved[8][i]) reserved[8][i] = 1;
      if (!reserved[i][8]) reserved[i][8] = 1;
    }
    for (i = 0; i < 8; i++) { reserved[8][n - 1 - i] = 1; reserved[n - 1 - i][8] = 1; }

    /* --- place data, zig-zag --- */
    var idx = 0, bit = 0, up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var t = 0; t < n; t++) {
        var row = up ? (n - 1 - t) : t;
        for (var s2 = 0; s2 < 2; s2++) {
          var cc2 = col - s2;
          if (reserved[row][cc2]) continue;
          var v2 = 0;
          if (idx < out.length) v2 = (out[idx] >> (7 - bit)) & 1;
          m[row][cc2] = v2;
          bit++; if (bit === 8) { bit = 0; idx++; }
        }
      }
      up = !up;
    }

    /* --- masking --- */
    function maskFn(k, r, c) {
      switch (k) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
        case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
        default: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
      }
    }
    function penalty(g) {
      var pen = 0, r, c, run, dark = 0;
      for (r = 0; r < n; r++) {
        run = 1;
        for (c = 1; c < n; c++) {
          if (g[r][c] === g[r][c - 1]) { run++; }
          else { if (run >= 5) pen += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) pen += 3 + (run - 5);
      }
      for (c = 0; c < n; c++) {
        run = 1;
        for (r = 1; r < n; r++) {
          if (g[r][c] === g[r - 1][c]) { run++; }
          else { if (run >= 5) pen += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) pen += 3 + (run - 5);
      }
      for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++)
        if (g[r][c] === g[r][c + 1] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 1][c + 1]) pen += 3;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (g[r][c]) dark++;
      pen += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
      return pen;
    }

    var best = null, bestPen = Infinity, bestMask = 0;
    for (var mk = 0; mk < 8; mk++) {
      var g = m.map(function (row2) { return row2.slice(); });
      for (r = 0; r < n; r++) for (c = 0; c < n; c++)
        if (!reserved[r][c] && maskFn(mk, r, c)) g[r][c] ^= 1;
      /* format info for ECC L + this mask */
      var fmt = (0x01 << 3) | mk;               // 01 = level L
      var rem = fmt;
      for (i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
      var format = ((fmt << 10) | rem) ^ 0x5412;
      for (i = 0; i < 15; i++) {
        var bitv = (format >> i) & 1;
        if (i < 6) g[i][8] = bitv;
        else if (i < 8) g[i + 1][8] = bitv;
        else if (i === 8) g[8][7] = bitv;
        else g[8][14 - i] = bitv;
        if (i < 8) g[8][n - 1 - i] = bitv;
        else g[n - 15 + i][8] = bitv;
      }
      g[n - 8][8] = 1;
      var pn = penalty(g);
      if (pn < bestPen) { bestPen = pn; best = g; bestMask = mk; }
    }
    return best;
  }

  window.qrMatrix = build;

  window.qrSvg = function (text, size) {
    size = size || 640;
    var m, n;
    try { m = build(text); n = m.length; }
    catch (e) { return ""; }
    var quiet = 4, total = n + quiet * 2, cell = size / total, d = "";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!m[r][c]) continue;
        var x = (c + quiet) * cell, y = (r + quiet) * cell;
        d += "M" + x.toFixed(2) + " " + y.toFixed(2) +
             "h" + cell.toFixed(2) + "v" + cell.toFixed(2) + "h-" + cell.toFixed(2) + "z";
      }
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<rect width="' + size + '" height="' + size + '" fill="#fff"/>' +
      '<path d="' + d + '" fill="#1A1008"/></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
})();
