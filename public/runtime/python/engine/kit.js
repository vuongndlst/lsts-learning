/* Python 10 — bộ khối nội dung dùng chung cho lesson.js (nạp TRƯỚC lesson.js).
   PY.hl(code): tô màu cú pháp Python (dùng cho khung code, ví dụ, bảng giải mã).
   KIT.*: khối nội dung (ví dụ + terminal, giải mã, cú pháp, quy tắc đặt tên, tìm hiểu thêm…).
   Mọi ví dụ "code + terminal" được ghi vào KIT.examples để bộ kiểm tra chạy thật và so kết quả. */
"use strict";
(function () {
  const esc = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  /* ---------- tô màu cú pháp Python ---------- */
  const KW = new Set(["False", "None", "True", "and", "as", "assert", "break", "class", "continue", "def", "del", "elif",
    "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "not", "or", "pass",
    "raise", "return", "try", "while", "with", "yield"]);
  const BI = new Set(["print", "input", "int", "float", "str", "bool", "len", "range", "type", "list", "tuple", "dict",
    "set", "sum", "max", "min", "abs", "round", "sorted", "enumerate", "zip", "isinstance", "open", "chr", "ord"]);
  const TOK = /(#[^\n]*)|([rRbBfF]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?))|(\b\d+(?:\.\d+)?\b)|([A-Za-z_À-ỹ][\wÀ-ỹ]*)|(‹[^›]*›)/g;
  function hl(code) {
    let html = "", i = 0, m, prev = "";
    TOK.lastIndex = 0;
    while ((m = TOK.exec(code))) {
      html += esc(code.slice(i, m.index));
      const t = m[0];
      let cls = "";
      if (m[1]) cls = "c";
      else if (m[2]) cls = /^[rRbB]?[fF]/.test(t) ? "s f" : "s";
      else if (m[3]) cls = "n";
      else if (m[5]) cls = "ph";
      else if (KW.has(t)) cls = "k";
      else if (prev === "def" || prev === "class") cls = "fn";
      else if (BI.has(t) && code[TOK.lastIndex] === "(") cls = "b";
      else if (code[TOK.lastIndex] === "(") cls = "fn";
      html += cls ? `<span class="t-${cls.replace(" ", " t-")}">${esc(t)}</span>` : esc(t);
      if (m[4]) prev = t;
      i = TOK.lastIndex;
    }
    return html + esc(code.slice(i));
  }

  /* ---------- bỏ comment (# ngoài chuỗi) để kiểm tra quy tắc ---------- */
  function stripComments(code) {
    return String(code).split("\n").map(line => {
      let q = null;
      for (let k = 0; k < line.length; k++) {
        const ch = line[k];
        if (q) { if (ch === "\\") k++; else if (ch === q) q = null; }
        else if (ch === '"' || ch === "'") q = ch;
        else if (ch === "#") return line.slice(0, k).replace(/\s+$/, "");
      }
      return line;
    }).join("\n");
  }
  // Chỉ phần code ngoài chuỗi (để tìm lệnh, không bị nhầm với chữ trong ngoặc kép)
  function codeOnly(code) {
    return stripComments(code).replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g, m => m[0] + " ".repeat(Math.max(0, m.length - 2)) + m[0]);
  }
  function normalizeOutput(v = "") {
    return String(v).replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/[ \t]+$/g, "").replace(/\n+$/g, "").replace(/^\n+/, "");
  }
  window.PY = { hl, esc, stripComments, codeOnly, normalizeOutput };

  const DOCS = slug => `https://docs.python.org/3/${slug}`;
  const W3 = slug => `https://www.w3schools.com/python/${slug}.asp`;
  const examples = [];

  const editorView = (code, label = "main.py", note = "") => `
    <figure class="ex-code"><div class="ex-tabbar"><span class="ex-tab"><i class="py-dot"></i>${esc(label)}</span>${note ? `<span class="ex-note">${note}</span>` : ""}</div>
    <pre class="ex-pre"><code>${code.split("\n").map((l, i) => `<span class="ln">${i + 1}</span>${hl(l) || " "}`).join("\n")}</code></pre></figure>`;

  const termView = (out, nhap = "") => `
    <figure class="ex-term"><div class="ex-tabbar term"><span class="ex-tab">TERMINAL</span>${nhap ? `<span class="ex-note">nhập: ${esc(nhap.replace(/\n/g, " ⏎ "))}</span>` : ""}</div>
    <pre class="term-pre">${esc(out) || '<span class="muted">(không in gì)</span>'}</pre></figure>`;

  const KIT = {
    esc, hl, DOCS, W3, examples,
    // Đoạn code chỉ đọc
    demo: (code, label = "main.py", note = "") => editorView(code, label, note),
    // Code + terminal (kết quả chạy thật — bộ kiểm tra so lại). nhap: các dòng nhập, cách nhau \n
    codeVaManHinh: (code, man, label = "main.py", nhap = "") => {
      examples.push({ code, out: man, nhap });
      return `<div class="pair-view">${editorView(code, label)}${termView(man, nhap)}</div>`;
    },
    terminal: (out, nhap = "") => termView(out, nhap),
    // Bảng giải mã từng lệnh: rows [{code, y, nho?, nhan?}]
    giaiMa: (tieuDe, rows) => `<div class="gm"><div class="gm-title">${tieuDe}</div>
      ${rows.map(r => `<div class="gm-row ${r.nhan ? "focus" : ""}"><code class="gm-code">${hl(r.code)}</code>
        <div class="gm-y">${r.y}${r.nho ? `<small>${r.nho}</small>` : ""}</div></div>`).join("")}</div>`,
    // Thẻ CÚ PHÁP: { ten, mau: chuỗi | [chuỗi], phan?: [[‹…›, giải thích]], quyTac?: [html], viDu?, man?, nhap? }
    cuPhap: ({ ten, mau, phan = [], quyTac = [], viDu = "", man = "", nhap = "" }) => {
      if (viDu && man) examples.push({ code: viDu, out: man, nhap });
      return `<section class="cp-card"><header class="cp-head"><span class="cp-ico">{ }</span>CÚ PHÁP<span class="cp-ten">${ten}</span></header>
        <div class="cp-body ${viDu ? "" : "no-vd"}"><div class="cp-main">
          ${[].concat(mau).map(m => `<pre class="cp-mau">${hl(m)}</pre>`).join("")}
          ${phan.length ? `<dl class="cp-phan">${phan.map(([k, v]) => `<div><dt>${hl(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
          ${quyTac.length ? `<div class="cp-label">Quy tắc</div><ul class="cp-rules">${quyTac.map(r => `<li>${r}</li>`).join("")}</ul>` : ""}
        </div>
        ${viDu ? `<div class="cp-vidu"><div class="cp-label">Ví dụ</div><pre class="cp-code">${hl(viDu)}</pre>
          ${man ? `<div class="cp-label">Terminal${nhap ? ` (nhập ${esc(nhap.replace(/\n/g, " ⏎ "))})` : ""}</div><pre class="cp-man">${esc(man)}</pre>` : ""}</div>` : ""}
        </div></section>`;
    },
    // Quy tắc đặt tên biến Python (snake_case)
    tenBien: () => `<section class="cp-card ten-bien"><header class="cp-head"><span class="cp-ico">Aa</span>QUY TẮC ĐẶT TÊN BIẾN</header>
      <div class="cp-body"><div class="cp-main"><ol class="cp-rules num">
        <li>Chỉ gồm <strong>chữ cái</strong>, <strong>chữ số</strong> và dấu gạch dưới <code>_</code>.</li>
        <li><strong>Không bắt đầu bằng chữ số.</strong></li>
        <li>Không có <strong>dấu cách</strong> hay ký tự đặc biệt như <code>- @ # ! $</code>.</li>
        <li>Không trùng <strong>từ khoá</strong> của Python: <code>if</code>, <code>for</code>, <code>while</code>, <code>def</code>, <code>class</code>, <code>True</code>…</li>
        <li><strong>Phân biệt chữ hoa, chữ thường</strong>: <code>diem</code> và <code>Diem</code> là hai biến khác nhau.</li>
        <li>Quy ước của Python: tên <strong>có nghĩa</strong>, viết <strong>snake_case</strong> — chữ thường, các từ nối bằng <code>_</code>. Không dùng tiếng Việt có dấu.</li>
      </ol></div>
      <div class="cp-vidu"><div class="cp-label">Ví dụ</div><table class="tb-table">
        ${[["toc_do", 1, "snake_case, có nghĩa"], ["mau_toi_da", 1, "nhiều từ nối bằng _"], ["level2", 1, "chữ số đứng sau"],
           ["toc do", 0, "có dấu cách"], ["2mang", 0, "bắt đầu bằng chữ số"], ["toc-do", 0, "dấu - là phép trừ"],
           ["for", 0, "trùng từ khoá"], ["x", 2, "hợp lệ nhưng không nói lên ý nghĩa"]]
          .map(([t, ok, ly]) => `<tr class="${ok === 1 ? "ok" : ok === 2 ? "meh" : "sai"}"><td><code>${esc(t)}</code></td><td>${ok === 1 ? "Đúng" : ok === 2 ? "Nên tránh" : "Sai"}</td><td>${ly}</td></tr>`).join("")}
      </table></div></div></section>`,
    // Tìm hiểu thêm (không bắt buộc, không kiểm tra)
    moRong: (tieuDe, html) => `<details class="mo-rong"><summary><span class="mr-tag">TÌM HIỂU THÊM</span><span class="mr-title">${tieuDe}</span>
      <span class="mr-note">không bắt buộc · không kiểm tra</span></summary><div class="mo-rong-body">${html}</div></details>`,
    // Đoán trước — bấm mới hiện đáp án
    doan: (cauHoi, dapAn) => `<details class="guess"><summary><span class="g-tag">ĐOÁN TRƯỚC</span><span>${cauHoi}</span><span class="g-btn">Xem đáp án</span></summary><div class="g-body">${dapAn}</div></details>`,
    meo: html => `<div class="tip-strip"><span class="tip-tag">MẸO</span><div>${html}</div></div>`,
    luuY: html => `<div class="tip-strip warn"><span class="tip-tag">LƯU Ý</span><div>${html}</div></div>`,
    khai: (tieuDe, html, mau = "") => `<section class="concept ${mau}"><h3>${tieuDe}</h3>${html}</section>`,
    docThem: links => `<div class="read-more-box"><div><strong>Đọc thêm</strong><span>Mở ở tab mới, đọc xong quay lại.</span></div>
      <div class="resource-links">${links.map(([url, label]) => `<a href="${url}" target="_blank" rel="noopener">${label} ↗</a>`).join("")}</div></div>`,
    // Sơ đồ khối (như SGK): kieu "if" | "ifelse" | "while"; dk = điều kiện; a, b = việc khi đúng/sai (hoặc thân lặp)
    soDo: (kieu, dk, a, b = "", cap = "") => {
      const T = (x, y, s, cls = "") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="middle">${esc(s)}</text>`;
      const box = (x, y, w, s) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="40" rx="8" class="sd-box"/>${T(x, y + 25, s, "sd-code")}`;
      const dia = (x, y, s) => `<polygon points="${x},${y} ${x + 110},${y + 34} ${x},${y + 68} ${x - 110},${y + 34}" class="sd-dia"/>${T(x, y + 39, s, "sd-code")}`;
      const ar = (d) => `<path d="${d}" class="sd-ar" marker-end="url(#sdm)"/>`;
      const end = (x, y, s) => `<rect x="${x - 50}" y="${y}" width="100" height="34" rx="17" class="sd-end"/>${T(x, y + 22, s)}`;
      let g = "", h = 330;
      if (kieu === "while") {
        g = end(170, 6, "Bắt đầu") + ar("M170 40 V62") + dia(170, 66, dk) + T(186, 160, "Đúng", "sd-lb") + ar("M170 134 V168") +
          box(170, 172, 200, a) + ar("M70 192 H30 V100 H56") + `<path d="M70 192 H30" class="sd-ar"/>` + T(318, 92, "Sai", "sd-lb") +
          ar("M280 100 H330 V250") + end(330, 254, "Kết thúc");
        h = 300;
      } else {
        g = end(200, 6, "Bắt đầu") + ar("M200 40 V62") + dia(200, 66, dk) + T(76, 92, "Đúng", "sd-lb") + T(326, 92, "Sai", "sd-lb") +
          ar("M90 100 H80 V150") + box(80, 154, 150, a) +
          (kieu === "ifelse" ? ar("M310 100 H320 V150") + box(320, 154, 150, b) + ar("M320 194 V230 H215") : `<path d="M310 100 H375 V240 H215" class="sd-ar" marker-end="url(#sdm)"/>`) +
          ar("M80 194 V230 H185") + `<circle cx="200" cy="232" r="6" class="sd-dot"/>` + ar("M200 238 V270") + end(200, 274, "Lệnh tiếp theo");
        h = 320;
      }
      return `<figure class="so-do"><svg viewBox="0 0 400 ${h}" role="img" aria-label="Sơ đồ khối">
        <defs><marker id="sdm" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" class="sd-head"/></marker></defs>${g}</svg>
        ${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;
    },
    // Dùng trong quy tắc kiểm tra code
    co: (code, re) => new RegExp(re).test(codeOnly(code)),
    // như co() nhưng giữ nội dung chuỗi (để kiểm tra cả chữ trong ngoặc kép)
    coChuoi: (code, re) => new RegExp(re).test(stripComments(code)),
    // có ít nhất một comment (# nằm ngoài chuỗi)
    coComment: code => stripComments(code) !== String(code).split("\n").map(l => l.replace(/\s+$/, "")).join("\n"),
    khongCo: (code, re) => !new RegExp(re).test(codeOnly(code)),
    dem: (code, re) => (codeOnly(code).match(new RegExp(re, "g")) || []).length
  };
  window.KIT = KIT;
})();
