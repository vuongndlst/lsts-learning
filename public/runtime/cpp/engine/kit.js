/* C++ Journey 8 — bộ khối nội dung dùng chung cho lesson.js (nạp TRƯỚC lesson.js).
   giaiMa(): bảng "Lệnh C++ | Nghĩa là | Khối Scratch" — không lặp nhãn ở từng dòng.
   scratch(): khối Scratch 3 tiếng Việt, viết bằng cú pháp scratchblocks tiếng Anh, engine tự vẽ + dịch.
*/
"use strict";
(function () {
  const esc = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const W3 = slug => `https://www.w3schools.com/cpp/cpp_${slug}.asp`;

  const scratch = (text, cap = "") =>
    `<figure class="sb-fig"><pre class="sb">${esc(text)}</pre>${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`;

  const KIT = {
    W3,
    esc,
    scratch,
    // Đoạn code mẫu (chỉ đọc)
    demo: (code, label = "Ví dụ") => `
      <div class="code-demo"><div class="code-demo-header"><span><span class="window-dots">● ● ●</span> &nbsp; ${label}</span><span>main.cpp</span></div>
      <pre><code>${esc(code)}</code></pre></div>`,
    // Code bên trái, màn hình bên phải
    codeVaManHinh: (code, man, label = "Ví dụ", nhap = "") => `
      <div class="pair-view">
        ${KIT.demo(code, label)}
        <div class="screen-card"><div class="screen-head">🖥 MÀN HÌNH${nhap ? ` · nhập <code>${esc(nhap)}</code>` : ""}</div><pre>${esc(man)}</pre></div>
      </div>`,
    // rows: [{code, y, nho?, sb?}] — sb = cú pháp scratchblocks (tuỳ chọn)
    giaiMa: (tieuDe, rows) => {
      const coSb = rows.some(r => r.sb);
      return `<div class="gm">
        <div class="gm-title">${tieuDe}</div>
        <div class="gm-head ${coSb ? "with-sb" : ""}"><span>Lệnh C++</span><span>Nghĩa là</span>${coSb ? "<span>Giống khối Scratch</span>" : ""}</div>
        ${rows.map(r => `<div class="gm-row ${coSb ? "with-sb" : ""} ${r.nhan ? "focus" : ""}">
          <code>${esc(r.code)}</code>
          <div>${r.y}${r.nho ? `<small>${r.nho}</small>` : ""}</div>
          ${coSb ? `<div class="gm-sb">${r.sb ? `<pre class="sb">${esc(r.sb)}</pre>` : `<span class="muted">—</span>`}</div>` : ""}
        </div>`).join("")}
      </div>`;
    },
    // Thẻ CÚ PHÁP: dạng tổng quát của lệnh. Chỗ cần thay viết trong ‹ › (tô màu riêng).
    // { ten, mau: chuỗi | [chuỗi], phan?: [[‹…›, giải thích]], quyTac?: [html], viDu?: code, man?: màn hình, nhap? }
    cuPhap: ({ ten, mau, phan = [], quyTac = [], viDu = "", man = "", nhap = "" }) => {
      const hl = s => esc(s).replace(/‹([^›]*)›/g, '<span class="ph">‹$1›</span>');
      return `<div class="cp-card">
        <div class="cp-head">📐 CÚ PHÁP · ${ten}</div>
        <div class="cp-body ${viDu ? "" : "no-vd"}">
          <div class="cp-main">
            ${[].concat(mau).map(m => `<pre class="cp-mau">${hl(m)}</pre>`).join("")}
            ${phan.length ? `<dl class="cp-phan">${phan.map(([k, v]) => `<div><dt>${hl(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
            ${quyTac.length ? `<div class="cp-label">Quy tắc</div><ul class="cp-rules">${quyTac.map(r => `<li>${r}</li>`).join("")}</ul>` : ""}
          </div>
          ${viDu ? `<div class="cp-vidu"><div class="cp-label">Ví dụ</div><pre class="cp-code">${esc(viDu)}</pre>
            ${man ? `<div class="cp-label">Màn hình${nhap ? ` (nhập ${esc(nhap)})` : ""}</div><pre class="cp-man">${esc(man)}</pre>` : ""}</div>` : ""}
        </div></div>`;
    },
    // Quy tắc đặt tên biến + ví dụ đúng/sai
    tenBien: () => `<div class="cp-card ten-bien">
      <div class="cp-head">🏷️ QUY TẮC ĐẶT TÊN BIẾN</div>
      <div class="cp-body">
        <div class="cp-main"><ol class="cp-rules num">
          <li>Chỉ dùng <strong>chữ cái tiếng Anh</strong> (a–z, A–Z), <strong>chữ số</strong> (0–9) và dấu gạch dưới <code>_</code>.</li>
          <li><strong>Không bắt đầu bằng chữ số.</strong></li>
          <li>Không có <strong>dấu cách</strong>, không có <strong>dấu tiếng Việt</strong>, không có ký tự đặc biệt như <code>- @ # !</code></li>
          <li>Không trùng <strong>từ khoá</strong> của C++: <code>int</code>, <code>return</code>, <code>if</code>, <code>for</code>…</li>
          <li><strong>Phân biệt chữ hoa, chữ thường</strong>: <code>soKeo</code> và <code>sokeo</code> là hai biến khác nhau.</li>
          <li>Nên đặt tên <strong>có nghĩa</strong>, viết kiểu <strong>camelCase</strong>: từ đầu viết thường, các từ sau viết hoa chữ cái đầu.</li>
        </ol></div>
        <div class="cp-vidu"><div class="cp-label">Ví dụ</div>
          <table class="tb-table">
            ${[["soKeo", 1, "camelCase, có nghĩa"], ["diem1", 1, "chữ số đứng sau được"], ["tien_com", 1, "có dấu _ được"],
               ["so keo", 0, "có dấu cách"], ["2keo", 0, "bắt đầu bằng chữ số"], ["so-keo", 0, "có dấu -"],
               ["sốKẹo", 0, "có dấu tiếng Việt"], ["int", 0, "trùng từ khoá"]]
              .map(([t, ok, ly]) => `<tr class="${ok ? "ok" : "sai"}"><td><code>${esc(t)}</code></td><td>${ok ? "✅ Đúng" : "❌ Sai"}</td><td>${ly}</td></tr>`).join("")}
          </table></div>
      </div></div>`,
    // Phần "Tìm hiểu thêm" (không bắt buộc, không kiểm tra) — thu gọn, bấm mới mở
    moRong: (tieuDe, html) => `<details class="mo-rong"><summary>🚀 <strong>Tìm hiểu thêm (không bắt buộc):</strong> ${tieuDe}
      <span class="mo-rong-btn">Mở ra</span></summary><div class="mo-rong-body">${html}</div></details>`,
    // Ô "Đoán trước" — bấm mới hiện đáp án
    doan: (cauHoi, dapAn) => `<details class="guess"><summary>🧠 <strong>Đoán trước:</strong> ${cauHoi} <span class="guess-btn">Xem đáp án</span></summary><div>${dapAn}</div></details>`,
    meo: html => `<div class="tip-strip">✨ ${html}</div>`,
    docThem: (links, tieuDe = "📚 Đọc thêm trên W3Schools") => `
      <div class="read-more-box"><div><strong>${tieuDe}</strong><span>Mở ở tab mới, đọc xong quay lại.</span></div>
      <div class="resource-links">${links.map(([slug, label]) => `<a href="${W3(slug)}" target="_blank" rel="noopener">${label} ↗</a>`).join("")}</div></div>`,
    // Dùng trong quy tắc kiểm tra code
    khongCo: (code, pattern) => !new RegExp(pattern).test(window.CPP.stripComments(code)),
    demLenh: (code, ten) => (window.CPP.stripComments(code).match(new RegExp("\\b" + ten + "\\b", "g")) || []).length
  };
  window.KIT = KIT;
})();
