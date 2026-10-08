(()=>{
/* C++ Journey 8 — V2 engine (dùng chung cho Bài 1–5)
   - Nội dung từng bài: window.LESSON (bai0N/lesson.js), khối nội dung dùng chung: engine/kit.js
   - Học sinh: localStorage, mỗi bài một khoá riêng
   - Chạy C++: JSCPP (lưu sẵn, đã vá để vọng số nhập giống Programiz)
   - Robot Bit nổi ở góc màn hình, đi theo khi cuộn, nói lời dẫn và phản hồi (gọi học sinh là "bạn")
   - Lớp trò chơi: bản đồ, ổ khoá theo mã, Ngôi sao hi vọng (như Đường lên đỉnh Olympia), săn bọ, combo, pháo giấy,
     BOSS có thanh máu, huy hiệu
   - Khung code: tắt dán/kéo-thả/sao chép để học sinh tự gõ (tập gõ code)
*/
"use strict";

const L = window.LESSON;
const CFG = { schoolName: "", teacherName: "", canvasSubmissionUrl: "", ...(window.CPP_JOURNEY_CONFIG || {}) };
const PREFIX = "cpp8v2";
const CLASSES = ["8A1", "8A2", "8A3", "8A4", "8A5", "8A6", "8A7", "8A8", "8A9", "8A10"];
const XP_PASS = 10, XP_FIRST_TRY = 5, STAR_LOSS = 10;

const STEPS = L.steps.filter(step=>step.kind!=='gate'||!selfStudy());
// Nhiệm vụ bắt buộc: không tính nhiệm vụ nâng cao (BOSS) và nhiệm vụ phụ (ở điểm dừng).
const REQUIRED = STEPS.flatMap(s => (s.challenges || []).filter(c => !c.advanced && !c.bonus).map(c => c.id));

let state = null, cppBusy=false;

/* ---------- tiện ích ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(v = "") {
  return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

// Mã mở khoá: so sánh băm, không phân biệt hoa/thường, bỏ khoảng trắng.
function codeHash(code) { return hashText("cpp8v2|" + String(code).toUpperCase().replace(/\s+/g, "")); }
function studentKey(student) { return hashText(`${student.name}|${student.className}`.toLowerCase()); }
function safeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key, val) { try { localStorage.setItem(key, val); } catch { /* bỏ qua */ } }

function normalizeOutput(v = "") {
  return String(v).replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/[ \t]+$/g, "").replace(/\n+$/g, "").replace(/^\n+/, "");
}

function stripComments(code) {
  return String(code).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

window.CPP = { stripComments, normalizeOutput }; // lesson.js / kit.js dùng trong quy tắc kiểm tra

/* ---------- lưu trạng thái ---------- */
function freshState(student) {
  return { student, active: STEPS[0].id, passed: {}, attempts: {}, drafts: {}, inputs: {}, gates: {},
    xp: 0, combo: 0, stars: {}, startedAt: new Date().toISOString(), completedAt: null };
}
function save() {
 if(!state||!CppCloud.allowed())return;
 state.student=CPPAccount.student();state.completed=allRequiredDone();
 if(state.completed)state.badge=isGold()?"gold":"silver";
 CppCloud.save(L.id,state);
}
function load(student){const remote={...CppCloud.state(L.id)},q=new URLSearchParams(location.search),steps=L.steps.filter(s=>s.kind!=='gate'&&(q.has('cuoi')||s.kind!=='boss')),index=q.has('cuoi')?steps.findIndex(s=>s.kind==='boss'):Number(q.get('chang'));if(q.has('chang')||q.has('cuoi'))remote.active=steps[index]?.id||steps[0].id;state={...freshState(student),...remote,student};for(const f of ["passed","attempts","drafts","inputs","gates","stars","waitingChoice"])if(!state[f]||typeof state[f]!=="object"||Array.isArray(state[f]))state[f]={};}
function selfStudy(){return Boolean(window.PORTAL_SELF_STUDY);}

/* ---------- tiến độ ---------- */
function stepDone(step) {
  if (step.kind === "gate") return Boolean(state.gates[step.id]);
  return step.challenges.filter(c => !c.advanced && !c.bonus).every(c => state.passed[c.id]);
}
function stepUnlocked(index) { return selfStudy() || STEPS.slice(0,index).every(stepDone); }
function bossStep() { return STEPS.find(s => s.kind === "boss"); }
function allRequiredDone() { return REQUIRED.every(id => state.passed[id]) && STEPS.filter(s=>s.kind!=="gate").every(stepDone); }
function isGold() {
  return allRequiredDone() && bossStep().challenges.filter(c => c.advanced).every(c => state.passed[c.id]);
}
function activeStep() { return STEPS.find(s => s.id === state.active); }

/* ---------- chạy C++ ---------- */
// JSCPP cho gọi hàm viết SAU main mà không khai báo trước; g++ (Programiz) thì báo lỗi → web cũng báo lỗi.
function functionOrderError(code) {
  const c = stripComments(code);
  const mainAt = c.search(/\bint\s+main\s*\(/);
  if (mainAt < 0) return null;
  const defRe = /\b(?:void|int)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
  let m;
  while ((m = defRe.exec(c))) {
    const name = m[1];
    if (name === "main" || m.index < mainAt) continue;
    const truoc = c.slice(0, mainAt);
    if (new RegExp("\\b(?:void|int)\\s+" + name + "\\s*\\([^)]*\\)\\s*;").test(truoc)) continue;
    const goi = new RegExp("\\b" + name + "\\s*\\(").exec(c.slice(mainAt, m.index));
    if (goi) {
      const line = c.slice(0, mainAt + goi.index).split("\n").length;
      return `Máy chưa biết hàm "${name}" ở dòng ${line}: hàm này được viết SAU main().\n` +
        `👉 Đưa cả hàm ${name} lên TRÊN main(), hoặc khai báo trước main: ${m[0].replace(/\s*\{$/, "")};`;
    }
  }
  return null;
}

async function runCpp(code,input="") {
 const orderErr=functionOrderError(code);if(orderErr)return {ok:false,output:"",error:orderErr};
 const r=await CppRun.run(code,input);if(!r.ok)r.error=/Output limit/.test(r.error)?"In quá nhiều dữ liệu. Giảm số lần lặp hoặc số dòng in.":friendlyError(r.error,code);return r;
}
// Dịch thông báo lỗi của JSCPP sang lời dễ hiểu cho học sinh lớp 8.
function friendlyError(msg, code) {
  const lineMatch = msg.match(/line (\d+)/) || msg.match(/^(\d+):(\d+)/);
  const line = lineMatch ? Number(lineMatch[1]) : null;
  const lineText = line ? ` ở khoảng dòng ${line}` : "";
  if (/Parsing Failure/i.test(msg)) {
    return `Lỗi cú pháp${lineText}.\n👉 Thường gặp: thiếu dấu ; ở cuối dòng phía trên, thiếu dấu " hoặc thiếu ngoặc { } ( ).` +
      (line ? `\n👉 Xem dòng ${line} và dòng ngay trước nó.` : "");
  }
  const notExist = msg.match(/variable (\w+) does not exist/);
  if (notExist) {
    const name = notExist[1], lower = name.toLowerCase();
    const tip = ["cout", "cin", "endl"].includes(lower) && name !== lower
      ? `C++ phân biệt chữ hoa/thường: phải viết ${lower}, không phải ${name}.`
      : `Kiểm tra cách viết tên "${name}" (chữ hoa/thường, đúng từng chữ) và đã khai báo biến này chưa.`;
    return `Máy không biết tên "${name}"${lineText}.\n👉 ${tip}`;
  }
  if (/already declared|redefin/i.test(msg)) {
    return `Một biến bị khai báo hai lần${lineText}.\n👉 Mỗi tên biến chỉ khai báo (int ...) một lần; lần sau chỉ gán giá trị.`;
  }
  if (/Time limit exceeded/i.test(msg)) {
    return "Chương trình chạy mãi không dừng (quá 2 giây).\n👉 Kiểm tra điều kiện và bước tăng/giảm của vòng lặp.";
  }
  if (/must return a value/i.test(msg)) {
    return `Một hàm kiểu int chưa trả về giá trị${lineText}.\n👉 Hàm int phải có lệnh return ...; (main thì return 0;).`;
  }
  const noMethod = msg.match(/no method (\w+) in/);
  if (noMethod) {
    return `Gọi hàm "${noMethod[1]}" chưa đúng${lineText}.\n👉 Truyền đủ số giá trị, đúng thứ tự như các tham số khi viết hàm (kể cả cặp ngoặc tròn).`;
  }
  if (/cannot find|not found|include/i.test(msg) && !/#include\s*<iostream>/.test(code)) {
    return "Thiếu dòng #include <iostream> ở đầu chương trình.";
  }
  return `Chương trình bị lỗi${lineText}.\nThông báo gốc: ${msg.split("\n")[0].slice(0, 160)}`;
}

/* ---------- âm thanh & pháo giấy ---------- */
let audioCtx = null;
function soundOn() { return safeGet(`${PREFIX}:sound`) !== "off"; }
function beep(kind) {
  if (!soundOn()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { good: [660, 880], bad: [220, 180], win: [523, 659, 784, 1047], unlock: [440, 660, 880] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === "bad" ? "square" : "triangle";
      o.frequency.value = f;
      const t = audioCtx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.18);
    });
  } catch { /* trình duyệt chặn âm thanh: bỏ qua */ }
}

// Pháo giấy: nhỏ (bắn từ nút vừa bấm) mỗi lần đúng; lớn khi mở khoá / hạ BOSS.
function confetti(origin = null, big = false) {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const c = document.createElement("canvas");
  c.className = "confetti-layer";
  c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const colors = ["#2076d2", "#ef8a17", "#7451c7", "#168f67", "#f4c542", "#d94c55"];
  const ox = origin ? origin.x : c.width / 2, oy = origin ? origin.y : c.height * 0.35;
  const n = big ? 200 : 70;
  const parts = Array.from({ length: n }, () => {
    const a = big ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const v = (big ? 6 : 5) + Math.random() * (big ? 8 : 6);
    return { x: big ? Math.random() * c.width : ox, y: big ? -20 - Math.random() * 200 : oy,
      vx: big ? (Math.random() - 0.5) * 4 : Math.cos(a) * v, vy: big ? 2 + Math.random() * 4 : Math.sin(a) * v,
      r: 5 + Math.random() * 6, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3,
      col: colors[Math.floor(Math.random() * colors.length)] };
  });
  const t0 = performance.now(), dur = big ? 2800 : 1500;
  (function frame(t) {
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.99; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.globalAlpha = Math.max(0, 1 - (t - t0) / dur);
      ctx.fillStyle = p.col; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
    });
    if (t - t0 < dur) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

/* ---------- robot Bit (nổi ở góc, đi theo khi cuộn) ---------- */
function bitSvg(mood = "happy") {
  const mouth = mood === "sad" ? '<path d="M24 44 q8 -6 16 0" stroke="#17304f" stroke-width="3" fill="none" stroke-linecap="round"/>'
    : mood === "wow" ? '<circle cx="32" cy="43" r="4" fill="#17304f"/>'
    : '<path d="M24 41 q8 7 16 0" stroke="#17304f" stroke-width="3" fill="none" stroke-linecap="round"/>';
  const eyes = mood === "sad"
    ? '<path d="M18 30 h10 M36 30 h10" stroke="#17304f" stroke-width="4" stroke-linecap="round"/>'
    : '<circle cx="23" cy="31" r="5" fill="#17304f"/><circle cx="41" cy="31" r="5" fill="#17304f"/><circle cx="25" cy="29" r="1.6" fill="#fff"/><circle cx="43" cy="29" r="1.6" fill="#fff"/>';
  return `<svg class="bit-svg" viewBox="0 0 64 72" aria-hidden="true">
    <line x1="32" y1="4" x2="32" y2="14" stroke="#17304f" stroke-width="3"/>
    <circle cx="32" cy="5" r="4" fill="${mood === "sad" ? "#d94c55" : "#ef8a17"}"/>
    <rect x="8" y="14" width="48" height="40" rx="12" fill="#eaf4ff" stroke="#17304f" stroke-width="3"/>
    ${eyes}${mouth}
    <rect x="18" y="56" width="28" height="12" rx="5" fill="#2076d2" stroke="#17304f" stroke-width="3"/>
  </svg>`;
}

let bitTimer = null, bitLast = "";
function bitSay(html, mood = "happy", ms = 0) {
  const dock = $("#bitDock"), bubble = $("#bitBubble");
  if (!dock) return;
  bitLast = html;
  $("#bitText").innerHTML = html;
  $("#bitFace").innerHTML = bitSvg(mood);
  bubble.className = `bit-bubble-dock ${mood}`;
  dock.classList.remove("jump"); void dock.offsetWidth; dock.classList.add("jump");
  clearTimeout(bitTimer);
  if (ms) bitTimer = setTimeout(() => bubble.classList.add("hidden"), ms);
}

/* ---------- khung trang ---------- */
function shell() {
  document.title = `Bài ${L.number}: ${L.title} | C++ Journey 8`;
  document.body.innerHTML = `
  <header class="topbar">
    <a class="brand" href="../index.html" title="Về trang các bài">
      <div class="brand-badge">C++</div>
      <div><div class="eyebrow">C++ JOURNEY 8 · BÀI ${L.number}</div><h1>${esc(L.story)}</h1></div>
    </a>
    <div class="top-actions">
      <span class="xp-pill" id="xpPill" title="Điểm kinh nghiệm">⚡ 0 XP</span>
      <button id="errorsBtn" class="top-btn" type="button" title="Bảng lỗi thường gặp">🧰 Bảng lỗi</button>
      <button id="soundBtn" class="top-btn" type="button" title="Bật/tắt âm thanh"></button>
      <button id="studentBtn" class="student-chip" type="button"><span>👤</span><span id="studentText">Chưa có tên</span></button>
      <button id="newStudentBtn" class="new-student-button" type="button">Tài khoản</button>
    </div>
  </header>
  <nav class="journey-map" id="journeyMap" aria-label="Bản đồ hành trình"></nav>
  <main class="main-wrap"><div id="stepContainer"></div></main>
  <footer class="site-footer">
    <p>C++ Journey 8 · Bài ${L.number} · Khối Scratch vẽ bằng scratchblocks (MIT).</p>
    <button id="resetBtn" class="text-button danger-link" type="button">Tài khoản / tải bản sao bài làm</button>
  </footer>
  <div class="bit-dock" id="bitDock">
    <div class="bit-bubble-dock hidden" id="bitBubble" role="status" aria-live="polite">
      <button class="bit-close" type="button" aria-label="Ẩn lời Bit">×</button>
      <div id="bitText"></div>
    </div>
    <button class="bit-face" id="bitFace" type="button" title="Bit — bấm để nghe lại">${bitSvg()}</button>
  </div>
  <dialog id="errorsDialog" class="modal errors-modal">
    <div class="modal-card">
      <button class="icon-button close-button" type="button" data-close>×</button>
      <p class="eyebrow">QUY TẮC "3 TRƯỚC THẦY"</p>
      <h2>🧰 Bảng lỗi thường gặp</h2>
      <p class="muted">① Đọc thông báo lỗi → ② tìm trong bảng này → ③ hỏi bạn bên cạnh. Kẹt quá 3 phút thì giơ tay.</p>
      <div class="table-wrap"><table class="error-table">
        <thead><tr><th>Thông báo / dấu hiệu</th><th>Nguyên nhân</th><th>Cách sửa</th></tr></thead>
        <tbody>${L.errorTable.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody>
      </table></div>
    </div>
  </dialog>
  <dialog id="typeDialog" class="modal type-modal">
    <form method="dialog" class="modal-card type-card">
      <div class="type-bit">${bitSvg("wow")}</div>
      <h2>Ối, bạn ơi! ✋</h2>
      <p>Mình không cho sao chép hay dán code đâu nè. Bạn <strong>tự gõ từng dòng</strong> nhé —
        gõ tay giúp bạn nhớ lệnh và nhanh tay hơn. Sai chỗ nào mình chỉ cho!</p>
      <button class="primary-button wide" type="submit">OK, mình tự gõ 💪</button>
    </form>
  </dialog>
  <dialog id="certDialog" class="modal certificate-modal">
    <div class="modal-card certificate-card">
      <button class="icon-button close-button" type="button" data-close>×</button>
      <p class="eyebrow">BOSS ĐÃ BỊ HẠ GỤC</p>
      <h2>Chứng chỉ Bài ${L.number} 🎓</h2>
      <p>Lưu ảnh PNG rồi nộp lên Canvas cùng <strong>link Programiz bài cá nhân</strong> và ảnh chụp output.</p>
      <canvas id="certCanvas" width="1600" height="1131" aria-label="Chứng chỉ"></canvas>
      <div class="certificate-actions">
        <button id="savePng" class="primary-button" type="button">⬇ Lưu PNG</button>
        <button id="printPdf" class="secondary-button" type="button">🖨 In / Lưu PDF</button>
        <a id="canvasLink" class="secondary-button hidden" href="#" target="_blank" rel="noopener">↗ Mở Canvas để nộp</a>
      </div>
    </div>
  </dialog>`;
}

/* ---------- bản đồ ---------- */
function stepProgress(step) {
  if (step.kind === "gate") return "";
  const req = step.challenges.filter(c => !c.advanced && !c.bonus);
  return `${req.filter(c => state.passed[c.id]).length}/${req.length}`;
}
function renderMap() {
  const map = $("#journeyMap");
  map.innerHTML = `<div class="study-mode"><button id="studyMode" class="secondary-button">${selfStudy()?"Học theo lớp":"Tự học / học bù"}</button><span>Mọi chặng đều mở. Trên lớp, dừng theo hướng dẫn của giáo viên.</span></div><div class="map-track">${STEPS.map((step, i) => {
    const unlocked = stepUnlocked(i), done = stepDone(step), active = state.active === step.id;
    const icon = step.kind === "gate" ? (done ? "🔓" : "⏸") : step.kind === "boss" ? "👾" : done ? "✓" : step.number;
    const cls = ["map-node", step.kind, done ? "done" : "", active ? "active" : "", unlocked ? "" : "locked"].join(" ");
    const prog = unlocked && !done && step.kind !== "gate" ? `<span class="node-prog">${stepProgress(step)}</span>` : "";
    return `${i ? `<span class="map-link ${unlocked ? "lit" : ""}"></span>` : ""}
      <button class="${cls}" type="button" data-step="${step.id}" ${unlocked ? "" : "disabled"}>
        <span class="node-dot">${unlocked ? icon : "🔒"}${prog}</span>
        <span class="node-label">${esc(step.nav)}</span>
      </button>`;
  }).join("")}</div>`;
  $("#studyMode").onclick=()=>{state.navigationMode=selfStudy()?"guided":"self-study";save();renderAll(true)};
  $$(".map-node", map).forEach(btn => btn.addEventListener("click", () => go(btn.dataset.step)));
  const act = $(".map-node.active", map);
  if (act) map.scrollLeft = act.offsetLeft - (map.clientWidth - act.offsetWidth) / 2;
}

function go(stepId) {
  state.active = stepId;
  save();
  renderAll(true);
  window.scrollTo({ top: 0, behavior: "instant" });
}

function updateTop() {
  $("#xpPill").textContent = `⚡ ${state.xp} XP` + (state.combo >= 2 ? ` · 🔥x${state.combo}` : "");
  $("#studentText").textContent = `${state.student.name} · ${state.student.className}`;
  $("#soundBtn").textContent = soundOn() ? "🔊" : "🔇";
}

/* ---------- khối Scratch (scratchblocks, tiếng Việt) ---------- */
function renderScratch(root) {
  const sb = window.scratchblocks;
  if (sb && sb.appendStyles && !renderScratch.styled) { sb.appendStyles(); renderScratch.styled = true; }
  $$("pre.sb", root).forEach(pre => {
    if (!sb) { pre.classList.add("sb-fallback"); return; }
    try {
      const doc = sb.parse(pre.textContent, { languages: ["en"] });
      if (sb.allLanguages && sb.allLanguages.vi) doc.translate(sb.allLanguages.vi);
      const svg = sb.render(doc, { style: "scratch3", scale: 0.95 });
      svg.classList.add("sb-svg");
      pre.replaceWith(svg);
    } catch { pre.classList.add("sb-fallback"); }
  });
}

/* ---------- trang từng bước ---------- */
function renderAll(entering = false) {
  const idx = STEPS.findIndex(s => s.id === state.active);
  if (idx < 0 || !stepUnlocked(idx)) {
    const last = [...STEPS].reverse().find(s => stepUnlocked(STEPS.indexOf(s)));
    state.active = last.id;
  }
  if (allRequiredDone() && !state.completedAt) {
    state.completedAt = new Date().toISOString();
    saveBadge(); save();
  }
  updateTop();
  renderMap();
  const step = activeStep();
  if (step.kind === "gate") renderGate(step); else renderStage(step);
  renderScratch($("#stepContainer"));
  if (entering || !bitLast) {
    const msg = step.kind === "gate"
      ? (stepDone(step) ? "Đã mở khoá! Đi tiếp thôi bạn ơi." : "Dừng lại một chút nhé! Nhìn lên bảng, nghe thầy chốt rồi cùng luyện tập với bạn bên cạnh.")
      : step.bit;
    if (msg) bitSay(msg, step.kind === "boss" ? "wow" : "happy", 8000);
  }
}

function renderStage(step) {
  const isBoss = step.kind === "boss";
  const idx = STEPS.indexOf(step);
  const next = STEPS[idx + 1];
  const required = step.challenges.filter(c => !c.advanced && !c.bonus);
  const advanced = step.challenges.filter(c => c.advanced);
  $("#stepContainer").innerHTML = `
  <article class="stage-page ${isBoss ? "boss-stage" : ""}">
    <header class="stage-hero">
      <div class="stage-kicker">${esc(step.kicker)}</div>
      <h2>${esc(step.title)}</h2>
      ${step.objectives ? `<div class="stage-objectives">${step.objectives.map(o => `<span>🎯 ${esc(o)}</span>`).join("")}</div>` : ""}
      ${isBoss ? bossBar(step) : ""}
    </header>
    <div class="lesson-body">
      ${step.lesson || ""}
      <section class="challenge-section">
        <h3 class="section-heading"><span class="doodle">${isBoss ? "👾" : "⚡"}</span>${isBoss ? "Hạ BOSS" : "Nhiệm vụ của chặng"}
          <span class="section-count">${required.filter(c => state.passed[c.id]).length}/${required.length} xong</span></h3>
        <div class="challenge-list">${required.map(renderChallenge).join("")}</div>
      </section>
      ${advanced.length ? `<section class="challenge-section advanced-section">
        <h3 class="section-heading"><span class="doodle">🥇</span>Nâng cao — xong sớm thì làm, đạt cả ${advanced.length} để có huy hiệu vàng</h3>
        <div class="challenge-list">${advanced.map(renderChallenge).join("")}</div>
      </section>` : ""}
      <div class="stage-footer">
        <div class="stage-complete-note" id="stageNote"></div>
        ${next ? `<button id="nextBtn" class="primary-button big" type="button">${nextLabel(next)}</button>`
               : `<button id="certBtn" class="certificate-button" type="button">🏆 Mở chứng chỉ</button>`}
      </div>
    </div>
  </article>`;
  const media=document.createElement("div");$("#stepContainer .challenge-section").before(media);CPPMedia.mount(media,L.media,step.id);
  step.challenges.forEach(bindChallenge);
  $("#nextBtn")?.addEventListener("click", () => { if (stepDone(step)) go(next.id); });
  $("#certBtn")?.addEventListener("click", openCertificate);
  refreshFooter(step);
}

function nextLabel(next) {
  return next.kind === "gate" ? "Đến điểm dừng ⏸" : next.kind === "boss" ? "Vào BOSS 👾" : `Sang Chặng ${next.number} →`;
}

function bossBar(step) {
  const req = step.challenges.filter(c => !c.advanced && !c.bonus);
  const hit = req.filter(c => state.passed[c.id]).length;
  const hp = Math.round(100 * (1 - hit / req.length));
  return `<div class="boss-hp"><span class="boss-face">👾</span>
    <div class="hp-wrap"><div class="hp-label">${esc(step.bossName || "BOSS")} · máu <strong id="hpText">${hp}%</strong></div>
    <div class="hp-track"><div class="hp-bar" id="hpBar" style="width:${hp}%"></div></div></div></div>`;
}

function refreshFooter(step) {
  const note = $("#stageNote");
  const done = stepDone(step);
  const next = $("#nextBtn");
  if (next) next.disabled = !done && !selfStudy();
  const req = step.challenges.filter(c => !c.advanced && !c.bonus);
  const cnt = $(".section-count");
  if (cnt) cnt.textContent = `${req.filter(c => state.passed[c.id]).length}/${req.length} xong`;
  if (step.kind === "boss") {
    const hit = req.filter(c => state.passed[c.id]).length;
    const hp = Math.round(100 * (1 - hit / req.length));
    if ($("#hpBar")) { $("#hpBar").style.width = `${hp}%`; $("#hpText").textContent = `${hp}%`; }
    const cert = $("#certBtn");
    if (cert) cert.disabled = !allRequiredDone();
    if (note) note.textContent = allRequiredDone()
      ? (isGold() ? "🥇 BOSS bị hạ + đủ nhiệm vụ nâng cao: chứng chỉ có huy hiệu vàng!" : "🏆 BOSS bị hạ! Mở chứng chỉ để lưu và nộp.")
      : `Còn ${req.length - hit} đòn nữa để hạ BOSS.`;
    return;
  }
  if (note) note.textContent = done ? "⭐ Hoàn thành chặng!" : "Làm xong các nhiệm vụ ở trên là bạn đi tiếp được nhé!";
}

function renderGate(step) {
  const done = stepDone(step);
  const next = STEPS[STEPS.indexOf(step) + 1];
  $("#stepContainer").innerHTML = `
  <article class="stage-page gate-page">
    <div class="gate-hero ${done ? "open" : ""}">
      <div class="gate-icon">${done ? "🔓" : "⏸"}</div>
      <div>
        <div class="stage-kicker">${esc(step.kicker)}</div>
        <h2>${done ? "Đã mở khoá!" : "DỪNG LẠI — NHÌN LÊN BẢNG"}</h2>
        <p>${done ? "Bạn đi tiếp được rồi." : "Cả lớp cùng dừng ở đây. Đừng làm tiếp một mình nhé."}</p>
      </div>
    </div>
    <div class="lesson-body">
      <ol class="gate-steps">${(selfStudy()?["Tự tóm tắt kiến thức vừa học bằng lời của bạn.","Chạy lại ví dụ và đối chiếu kết quả; nếu cần, chọn một bài trong xưởng thử thách.","Ghi câu hỏi chưa hiểu để hỏi giáo viên trong buổi kế tiếp.","Tiếp tục học mà không cần mã đồng bộ; nhiệm vụ chính vẫn phải hoàn thành thật."]:step.todo).map((t, i) => `<li><span>${i + 1}</span><div>${t}</div></li>`).join("")}</ol>
      <div class="unlock-box">
        ${done || selfStudy()
          ? `<button id="gateNext" class="primary-button big" type="button">${nextLabel(next)}</button>`
          : `<label for="gateCode"><strong>🔑 Mã mở khoá</strong> <span class="muted">(thầy hiện trên slide sau phần luyện tập)</span></label>
             <div class="unlock-row"><input id="gateCode" type="text" autocomplete="off" placeholder="Nhập mã…" maxlength="20" />
             <button id="gateBtn" class="primary-button" type="button">Mở khoá</button></div>
             <div id="gateMsg" class="result-line hidden" role="status"></div>`}
      </div>
      ${step.challenges && step.challenges.length ? `
      <section class="challenge-section bonus-section">
        <h3 class="section-heading"><span class="doodle">🎁</span>Trong lúc chờ: nhiệm vụ phụ (không bắt buộc, +XP)</h3>
        <div class="challenge-list">${step.challenges.filter(c=>!c.waitingBank).map(renderChallenge).join("")}</div>
      </section>` : ""}
    </div>
  </article>`;
  step.challenges?.filter(c=>!c.waitingBank).forEach(bindChallenge);
  mountWaitingBank(step);
  $("#gateNext")?.addEventListener("click", () => go(next.id));
  const tryCode = () => {
    if (codeHash($("#gateCode").value) === step.codeHash) {
      state.gates[step.id] = true;
      save(); beep("unlock"); confetti(null, true);
      renderAll(true);
    } else {
      const m = $("#gateMsg");
      m.className = "result-line bad"; m.textContent = "❌ Mã chưa đúng. Chờ thầy hiện mã trên slide nhé.";
      bitSay("Mã này chưa đúng rồi. Chờ thầy hiện mã trên slide nhé!", "sad", 5000);
      beep("bad");
    }
  };
  $("#gateBtn")?.addEventListener("click", tryCode);
  $("#gateCode")?.addEventListener("keydown", e => { if (e.key === "Enter") tryCode(); });
}

/* ---------- nhiệm vụ ---------- */

function mountWaitingBank(step){
 const tasks=(step.challenges||[]).filter(c=>c.waitingBank);if(!tasks.length)return;
 const area=document.createElement("section");area.className="waiting-bank";area.innerHTML=`<h3>🚀 Xưởng thử thách trong lúc chờ</h3><p>Ưu tiên nhiệm vụ chính. Khi đã làm xong, chọn một bài phù hợp; không cần hoàn thành cả ngân hàng. Khi thầy chốt kiến thức, hãy dừng và nghe hướng dẫn.</p><label class="field">Chọn thử thách<select id="waiting-task">${tasks.map(c=>`<option value="${esc(c.id)}">${esc(c.tier)} · ${c.minutes} phút · ${esc(c.title)}${state.passed[c.id]?" ✓":""}</option>`).join("")}</select></label><div id="waiting-card"></div>`;$("#stepContainer article").append(area);
 const select=area.querySelector('select'),holder=area.querySelector('#waiting-card');select.value=tasks.some(c=>c.id===state.waitingChoice[step.id])?state.waitingChoice[step.id]:tasks[0].id;
 const show=()=>{state.waitingChoice[step.id]=select.value;save();const c=tasks.find(c=>c.id===select.value);holder.innerHTML=renderChallenge(c);bindChallenge(c)};select.onchange=show;show();
}

function renderChallenge(c) {
  const passed = Boolean(state.passed[c.id]);
  const tag = c.waitingBank ? "🚀 "+c.tier : c.bonus ? "+XP" : c.advanced ? "🥇 NÂNG CAO" : "1 SAO";
  let body = "", actions = "";

  if (c.type === "choice") {
    const opts = c.options.map(o => (typeof o === "string" ? { text: o } : o));
    body = `
      ${c.code ? codeBlock(c.code, c.input) : ""}
      ${c.bet && !passed && !state.attempts[c.id] ? starRow(c) : ""}
      <div class="choice-grid ${c.mono ? "mono-grid" : ""}">${opts.map((o, i) => `
        <label class="choice-option"><input type="radio" name="${c.id}" value="${i}" />
        <span class="${c.mono ? "mono" : ""}">${esc(o.text)}</span></label>`).join("")}</div>`;
    actions = `<button class="primary-button" data-act="choice" type="button">Kiểm tra đáp án</button>`;
  }

  if (c.type === "sequence") {
    const items = c.shuffle || c.answer;
    body = `
      <div class="seq-wrap">
        <div><div class="mini-label">Các dòng (bấm theo thứ tự)</div>
          <div class="sequence-pool">${items.map((it, i) => `<button type="button" class="sequence-button ${c.mono ? "mono" : ""}" data-i="${i}">${esc(it)}</button>`).join("")}</div></div>
        <div><div class="mini-label">Chương trình của bạn</div>
          <div class="sequence-answer ${c.mono ? "as-code" : ""}" aria-live="polite"><span class="muted">Chưa có dòng nào.</span></div></div>
      </div>`;
    actions = `<button class="primary-button" data-act="seq-check" type="button">Kiểm tra</button>
      <button class="secondary-button" data-act="seq-undo" type="button">↶ Bỏ dòng cuối</button>
      <button class="secondary-button" data-act="seq-reset" type="button">Làm lại</button>`;
  }

  if (c.type === "code") {
    const draft = state.drafts[c.id] ?? c.starter;
    const needInput = Boolean(c.tests && c.tests.some(t => t.input));
    const inputVal = state.inputs[c.id] ?? (c.tests && c.tests[0] ? c.tests[0].input || "" : "");
    const tests = c.tests || [{ input: "", expected: c.expected }];
    const target = tests.length > 1
      ? `<table class="test-table"><tr><th>Nhập</th><th>Màn hình cần đạt</th></tr>
          ${tests.map(t => `<tr><td><code>${esc(t.input || "(không)")}</code></td><td><pre>${esc(t.expected)}</pre></td></tr>`).join("")}</table>`
      : `<pre class="expected-output">${esc(tests[0].expected)}</pre>`;
    body = `
      <div class="task-grid">
        <div class="requirement-box">
          <div class="requirement-title">🎯 BIT NHỜ BẠN</div>
          <ul>${(c.requirements || []).map(r => `<li>${esc(r)}</li>`).join("")}</ul>
        </div>
        <div class="target-box"><div class="expected-label">${tests.length > 1 ? "Các ca mình sẽ thử" : "Màn hình Bit cần thấy"}${tests[0].input && tests.length === 1 ? ` (nhập <code>${esc(tests[0].input)}</code>)` : ""}</div>${target}</div>
      </div>
      ${c.bugs ? `<div class="bug-board">${c.bugs.map((b, i) => `<span class="bug" data-bug="${i}">🐛 <small>${esc(b.label)}</small></span>`).join("")}</div>` : ""}
      <div class="code-lab">
        <div class="editor-shell">
          <div class="editor-toolbar"><span>main.cpp</span>
            <button type="button" class="small-button" data-act="reset-code">↺ Code ban đầu</button></div>
          <div class="editor-body"><pre class="gutter" aria-hidden="true"></pre>
          <textarea class="code-editor" spellcheck="false" aria-label="Trình soạn thảo C++">${esc(draft)}</textarea></div>
        </div>
        <div class="console-shell">
          ${needInput ? `<div class="console-toolbar"><span>📥 DỮ LIỆU NHẬP</span><small>cách nhau dấu cách</small></div>
            <input class="stdin-box" type="text" spellcheck="false" aria-label="Dữ liệu nhập" value="${esc(inputVal)}" />` : ""}
          <div class="console-toolbar"><span>🖥 MÀN HÌNH</span></div>
          <pre class="console-output">Bấm “▶ Chạy” để xem.</pre>
        </div>
      </div>`;
    actions = `<button class="secondary-button" data-act="run" type="button">▶ Chạy</button>
      <button class="primary-button" data-act="check" type="button">⭐ Kiểm tra & nhận sao</button>`;
  }

  const hints = c.hints || (c.hint ? [c.hint] : []);
  const hintBlock = hints.length && !passed
    ? `<button class="hint-btn" type="button" data-act="hint">🛟 Cần gợi ý?</button>` : "";

  return `
  <article class="challenge-card ${passed ? "passed" : ""} ${c.advanced ? "advanced" : ""} ${c.bonus ? "bonus" : ""}" data-card="${c.id}">
    <header class="challenge-header">
      <div class="challenge-title-wrap"><div class="challenge-icon">${passed ? "✅" : c.icon || "⭐"}</div>
        <div><h4>${esc(c.title)}</h4><p>${c.prompt}</p></div></div>
      <span class="challenge-badge">${passed ? "⭐ ĐÃ XONG" : tag}</span>
    </header>
    <div class="challenge-content">
      ${body}
      <div class="action-row">${actions}${hintBlock}</div>
      <div class="result-line hidden" data-result role="status"></div>
      <div class="hint-list" data-hints></div>
    </div>
  </article>`;
}

function codeBlock(code, input) {
  return `<div class="code-demo"><div class="code-demo-header"><span><span class="window-dots">● ● ●</span></span><span>main.cpp${input ? ` · nhập: ${esc(input)}` : ""}</span></div><pre><code>${esc(code)}</code></pre></div>`;
}

// Ngôi sao hi vọng (như Đường lên đỉnh Olympia): chọn TRƯỚC khi trả lời, mỗi chặng 1 lần.
// Đúng ngay lần này: XP câu này ×2. Sai: −10 XP.
function stepOf(c) { return STEPS.find(s => (s.challenges || []).some(x => x.id === c.id)); }
function starRow(c) {
  const used = state.stars[stepOf(c).id];
  if (used && used !== c.id) return `<div class="star-row used">⭐ Chặng này bạn đã dùng Ngôi sao hi vọng rồi.</div>`;
  return `<div class="star-row" data-star>
    <button type="button" class="star-toggle" aria-pressed="false"><span class="star-icon">☆</span> Chọn Ngôi sao hi vọng</button>
    <span class="star-rule">Đúng ngay lần này: <strong>XP ×2</strong> · Sai: <strong>−${STAR_LOSS} XP</strong> · Mỗi chặng chỉ <strong>1 ngôi sao</strong></span>
  </div>`;
}

// Kết quả hiện NGAY DƯỚI NÚT bấm; Bit ở góc nói lời ngắn.
function result(card, type, msg, extraHtml = "") {
  const el = $("[data-result]", card);
  el.className = `result-line ${type}`;
  el.innerHTML = `<span class="result-icon">${type === "good" ? "✅" : type === "bad" ? "❌" : "💡"}</span><div class="result-text">${esc(msg)}${extraHtml}</div>`;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function bindChallenge(c) {
  const card = $(`[data-card="${c.id}"]`);
  if (!card) return;

  const hints = c.hints || (c.hint ? [c.hint] : []);
  let shown = 0;
  $('[data-act="hint"]', card)?.addEventListener("click", e => {
    if (shown >= hints.length) return;
    $("[data-hints]", card).insertAdjacentHTML("beforeend", `<div class="hint-item"><strong>Gợi ý ${shown + 1}:</strong> ${esc(hints[shown])}</div>`);
    shown++;
    e.target.textContent = shown < hints.length ? "🛟 Gợi ý rõ hơn" : "🛟 Hết gợi ý";
    e.target.disabled = shown >= hints.length;
  });

  if (c.type === "choice") {
    let star = false;
    $(".star-toggle", card)?.addEventListener("click", e => {
      star = !star;
      const t = e.currentTarget;
      t.classList.toggle("on", star); t.setAttribute("aria-pressed", String(star));
      t.innerHTML = star ? `<span class="star-icon">⭐</span> Đã chọn Ngôi sao hi vọng` : `<span class="star-icon">☆</span> Chọn Ngôi sao hi vọng`;
      if (star) {
        beep("unlock");
        bitSay(`<strong>Ngôi sao hi vọng!</strong> Đúng thì XP nhân đôi, sai thì mất ${STAR_LOSS} XP. Đọc kỹ code rồi hãy chọn nhé!`, "wow", 6000);
      }
    });
    $('[data-act="choice"]', card).addEventListener("click", ev => {
      const sel = $(`input[name="${c.id}"]:checked`, card);
      if (!sel) return result(card, "info", "Chọn một đáp án trước nhé.");
      const opts = c.options.map(o => (typeof o === "string" ? { text: o } : o));
      const picked = opts[Number(sel.value)];
      const right = picked.text === c.answer;
      const starNow = star && !state.passed[c.id];
      if (starNow) state.stars[stepOf(c).id] = c.id;
      star = false;
      $("[data-star]", card)?.remove();
      attempt(c.id);
      $$(".choice-option", card).forEach(l => l.classList.remove("right", "wrong"));
      sel.closest(".choice-option").classList.add(right ? "right" : "wrong");
      if (right) pass(c, card, c.why || "Chính xác!", ev.currentTarget, starNow);
      else {
        let msg = picked.why || "Chưa đúng. Đọc lại phần giải thích phía trên rồi thử lại.";
        if (starNow) { state.xp = Math.max(0, state.xp - STAR_LOSS); msg += ` ⭐ Ngôi sao hi vọng chưa may mắn: −${STAR_LOSS} XP.`; }
        miss(card, msg);
      }
    });
  }

  if (c.type === "sequence") {
    const items = c.shuffle || c.answer;
    let picked = [];
    const box = $(".sequence-answer", card);
    const draw = () => {
      box.innerHTML = picked.length
        ? picked.map((i, n) => `<span class="picked ${c.mono ? "mono" : ""}">${c.mono ? "" : `${n + 1}. `}${esc(items[i])}</span>`).join("")
        : `<span class="muted">Chưa có dòng nào.</span>`;
      $$(".sequence-button", card).forEach(b => b.classList.toggle("selected", picked.includes(Number(b.dataset.i))));
    };
    $$(".sequence-button", card).forEach(btn => btn.addEventListener("click", () => {
      if (!picked.includes(Number(btn.dataset.i))) { picked.push(Number(btn.dataset.i)); draw(); }
    }));
    $('[data-act="seq-undo"]', card).addEventListener("click", () => { picked.pop(); draw(); });
    $('[data-act="seq-reset"]', card).addEventListener("click", () => { picked = []; draw(); $("[data-result]", card).classList.add("hidden"); });
    $('[data-act="seq-check"]', card).addEventListener("click", ev => {
      if (picked.length !== c.answer.length) return result(card, "info", "Chọn đủ tất cả các dòng nhé.");
      attempt(c.id);
      const order = picked.map(i => items[i]);
      const wrongAt = order.findIndex((v, i) => v !== c.answer[i]);
      if (wrongAt < 0) pass(c, card, c.why || "Đúng thứ tự!", ev.currentTarget);
      else miss(card, `Dòng thứ ${wrongAt + 1} chưa đúng chỗ. ${c.hintWrong || "Nghĩ xem dòng nào máy cần đọc trước."}`);
    });
  }

  if (c.type === "code") {
    const ed = $(".code-editor", card), gut = $(".gutter", card), out = $(".console-output", card), stdin = $(".stdin-box", card);
    const sync = () => {
      const n = ed.value.split("\n").length;
      ed.rows = Math.max(6, n + 1);
      gut.textContent = Array.from({ length: Math.max(n, ed.rows) }, (_, i) => i + 1).join("\n");
      updateBugs(c, card, ed.value);
    };
    sync();
    ed.addEventListener("input", () => { state.drafts[c.id] = ed.value; save(); sync(); });
    guardTyping(ed);
    // Chèn chữ bằng insertText để Ctrl+Z (hoàn tác) vẫn dùng được; xoá trước `back` ký tự nếu cần.
    const put = (text, back = 0) => {
      ed.setSelectionRange(ed.selectionStart - back, ed.selectionEnd);
      if (!document.execCommand("insertText", false, text)) {
        const s = ed.selectionStart;
        ed.value = ed.value.slice(0, s) + text + ed.value.slice(ed.selectionEnd);
        ed.selectionStart = ed.selectionEnd = s + text.length;
        ed.dispatchEvent(new Event("input"));
      }
    };
    const lineBefore = () => { const b = ed.value.slice(0, ed.selectionStart); return b.slice(b.lastIndexOf("\n") + 1); };
    // Gõ } ở đầu dòng: tự lùi lề 4 dấu cách
    ed.addEventListener("beforeinput", e => {
      if (e.inputType === "insertText" && e.data === "}" && ed.selectionStart === ed.selectionEnd && /^ {4,}$/.test(lineBefore())) {
        e.preventDefault(); put("}", 4);
      }
    });
    ed.addEventListener("keydown", e => {
      if (e.key === "Tab") { e.preventDefault(); put("    "); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('[data-act="run"]', card).click(); return; }
      if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
        // Xuống dòng giữ lề dòng trên; sau dấu { thì thụt thêm 4 dấu cách (giống Programiz)
        e.preventDefault();
        const line = lineBefore();
        put("\n" + line.match(/^ */)[0] + (/\{\s*$/.test(line) ? "    " : ""));
      }
    });
    stdin?.addEventListener("input", () => { state.inputs[c.id] = stdin.value; save(); });
    $('[data-act="reset-code"]', card).addEventListener("click", () => {
      ed.value = c.starter; state.drafts[c.id] = c.starter; save(); sync();
      out.textContent = "Đã trả về code ban đầu."; out.classList.remove("error");
    });
    $('[data-act="run"]', card).addEventListener("click", async () => {
      if(cppBusy||!CppCloud.allowed())return;cppBusy=true;const buttons=[...card.querySelectorAll("button")];buttons.forEach(b=>b.disabled=true);
      try{const r=await runCpp(ed.value,stdin?stdin.value:"");if(state&&CppCloud.allowed()&&card.isConnected)showRun(out,r)}finally{cppBusy=false;buttons.forEach(b=>b.disabled=false)}
    });
    $(' [data-act="check"]'.trim(), card).addEventListener("click", async ev => {
      if(cppBusy||!CppCloud.allowed())return;cppBusy=true;const buttons=[...card.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
      try {
      attempt(c.id);
      const v = await checkCode(c, ed.value, stdin ? stdin.value : "");
      if(!state||!CppCloud.allowed()||!card.isConnected)return;
      if (v.input != null && stdin) stdin.value = v.input;
      showRun(out, v.run);
      if (v.ok) pass(c, card, v.msg, card.querySelector('[data-act="check"]')); else miss(card, v.msg);
      }finally{cppBusy=false;buttons.forEach(b=>b.disabled=false)}
    });
  }
}

// Tập gõ code: không cho dán, kéo-thả, sao chép/cắt trong khung code.
// Học sinh thử sao chép/dán thì mới hiện popup nhắc (không ghi chú sẵn trên trang).
function noPasteMsg() {
  const d = $("#typeDialog");
  if (d && !d.open) d.showModal();
}
function guardTyping(ed) {
  ["paste", "drop", "copy", "cut"].forEach(ev => ed.addEventListener(ev, e => { e.preventDefault(); noPasteMsg(); }));
  ed.addEventListener("dragover", e => e.preventDefault());
  ed.addEventListener("beforeinput", e => {
    if (/^insertFrom(Paste|Drop|Yank)/.test(e.inputType || "")) { e.preventDefault(); noPasteMsg(); }
  });
  ed.addEventListener("contextmenu", e => e.preventDefault());
}
// Code mẫu trên trang (ví dụ, bảng giải mã, đáp án): không sao chép được.
function guardCopy() {
  const el = n => (n && n.nodeType === 1 ? n : n && n.parentElement);
  const inLesson = n => { const e = el(n); return Boolean(e && e.closest(".stage-page") && !e.closest("input")); };
  ["copy", "cut"].forEach(ev => document.addEventListener(ev, e => {
    const sel = document.getSelection();
    if (sel && inLesson(sel.anchorNode)) {
      e.preventDefault();
      noPasteMsg();
    }
  }));
  document.addEventListener("dragstart", e => { if (inLesson(e.target)) e.preventDefault(); });
}

function updateBugs(c, card, code) {
  if (!c.bugs) return;
  c.bugs.forEach((b, i) => {
    const el = $(`[data-bug="${i}"]`, card);
    const fixed = b.fixed(code);
    if (fixed && !el.classList.contains("dead")) { el.classList.add("dead"); el.firstChild.textContent = "💥 "; beep("good"); }
    if (!fixed && el.classList.contains("dead")) { el.classList.remove("dead"); el.firstChild.textContent = "🐛 "; }
  });
}

function showRun(out, r) {
  out.classList.toggle("error", !r.ok);
  out.textContent = r.ok ? (r.output || "(Chương trình chạy xong nhưng không in gì ra.)") : `⚠ LỖI\n${r.error}`;
}

function firstDiff(actual, expected) {
  const a = actual.split("\n"), e = expected.split("\n");
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if ((a[i] ?? "") !== (e[i] ?? "")) {
      if (a[i] === undefined) return `Màn hình của bạn mới có ${a.length} dòng, cần ${e.length} dòng.`;
      if (e[i] === undefined) return `Màn hình của bạn có ${a.length} dòng, chỉ cần ${e.length} dòng.`;
      return `Dòng ${i + 1} chưa khớp:\n• của bạn: "${a[i]}"\n• cần:      "${e[i]}"`;
    }
  }
  return "";
}

async function checkCode(c, code, currentInput) {
  const tests = c.tests || [{ input: currentInput, expected: c.expected }];
  let lastRun = null;
  for (const [n, t] of tests.entries()) {
    const r = await runCpp(code, t.input || "");
    lastRun = r;
    if (!r.ok) return { ok: false, run: r, input: t.input, msg: "Code chưa chạy được. Bạn đọc dòng ⚠ LỖI trong ô MÀN HÌNH rồi sửa nhé (bí quá thì mở 🧰 Bảng lỗi)." };
    if (t.expected != null) {
      const a = normalizeOutput(r.output), e = normalizeOutput(t.expected);
      if (a !== e) {
        const where = tests.length > 1 ? `Ca ${n + 1} (nhập ${t.input || "không"}) chưa đúng.\n` : "";
        return { ok: false, run: r, input: t.input, msg: where + (firstDiff(a, e) || "Màn hình chưa khớp mẫu.") };
      }
    }
  }
  for (const rule of c.rules || []) {
    if (!rule.test(code, lastRun.output)) return { ok: false, run: lastRun, msg: rule.msg };
  }
  if (c.bugs && !c.bugs.every(b => b.fixed(code))) {
    return { ok: false, run: lastRun, msg: "Màn hình đúng rồi, nhưng vẫn còn bọ trốn trong code! Xem con 🐛 nào chưa nổ nhé." };
  }
  return { ok: true, run: lastRun, msg: c.why || "Chính xác! Màn hình khớp mẫu." + (tests.length > 1 ? ` Đạt cả ${tests.length} ca.` : "") };
}

function attempt(id) { state.attempts[id] = (state.attempts[id] || 0) + 1; save(); }

function nextOpenCard(card) {
  const all = $$(".challenge-card", $("#stepContainer"));
  const i = all.indexOf(card);
  return [...all.slice(i + 1), ...all.slice(0, i)].find(el => !el.classList.contains("passed") && !el.classList.contains("advanced") && !el.classList.contains("bonus"));
}

function pass(c, card, msg, btn, starNow = false) {
  if(!state||!CppCloud.allowed())return;
  const first = !state.passed[c.id];
  let extra = "";
  if (first) {
    state.passed[c.id] = true;
    let gain = XP_PASS;
    if (state.attempts[c.id] === 1) {
      state.combo += 1; gain += XP_FIRST_TRY;
      if (state.combo >= 2) { gain += state.combo * 2; extra = ` 🔥 Combo x${state.combo}!`; }
    } else state.combo = 0;
    if (starNow) { gain *= 2; extra += " ⭐ Ngôi sao hi vọng: XP nhân đôi!"; }
    state.xp += gain;
    extra = ` +${gain} XP.` + extra;
    if (allRequiredDone() && !state.completedAt) state.completedAt = new Date().toISOString();
    saveBadge();
  }
  save();
  card.classList.add("passed");
  $(".challenge-badge", card).textContent = "⭐ ĐÃ XONG";
  $(".challenge-icon", card).textContent = "✅";
  $('[data-act="hint"]', card)?.remove();

  const step = activeStep();
  const nextCard = nextOpenCard(card);
  const stageNowDone = step.kind !== "gate" && stepDone(step);
  let cta = "";
  if (nextCard) cta = `<button class="mini-cta" type="button" data-go-next>Nhiệm vụ còn lại →</button>`;
  else if (stageNowDone && step.kind !== "boss") cta = `<button class="mini-cta" type="button" data-go-step>${nextLabel(STEPS[STEPS.indexOf(step) + 1])}</button>`;
  result(card, "good", msg + extra, cta);
  $("[data-go-next]", card)?.addEventListener("click", () => nextCard.scrollIntoView({ block: "start", behavior: "smooth" }));
  $("[data-go-step]", card)?.addEventListener("click", () => go(STEPS[STEPS.indexOf(step) + 1].id));

  const r = btn ? btn.getBoundingClientRect() : null;
  confetti(r ? { x: r.left + r.width / 2, y: r.top } : null, starNow);
  beep(starNow ? "win" : "good");
  const cheers = ["Tuyệt vời!", "Quá đỉnh!", "Chuẩn luôn!", "Bạn giỏi quá!", "Xuất sắc!"];
  bitSay(`<strong>${cheers[Math.floor(Math.random() * cheers.length)]}</strong>${extra}`, "happy", 3500);
  updateTop();
  renderMap();
  if (step.kind !== "gate") refreshFooter(step);
  if (step.kind === "boss" && first && allRequiredDone()) {
    beep("win"); confetti(null, true);
    bitSay("<strong>BOSS gục rồi!</strong> Lưu chứng chỉ để nộp nhé. Còn sức thì thử nhiệm vụ nâng cao để lấy huy hiệu vàng!", "wow");
    if (!c.advanced) setTimeout(openCertificate, 1200);
  }
}

function miss(card, msg) {
  state.combo = 0; save(); updateTop();
  result(card, "bad", msg);
  bitSay("Chưa đúng — đọc dòng ❌ ngay dưới nút nhé. Bạn làm được!", "sad", 3500);
  beep("bad");
}

/* ---------- huy hiệu & chứng chỉ ---------- */
function saveBadge() {
  if (!allRequiredDone()) return;
  state.badge=isGold()?"gold":"silver";
}

function certId() {
  return `CPP8-B${String(L.number).padStart(2, "0")}-${state.student.className}-${hashText(`${state.student.userId}|${L.id}|${state.completedAt}`)}`;
}

function openCertificate() {
  if (!allRequiredDone()) return;
  drawCertificate();
  const link = $("#canvasLink");
  if (CFG.canvasSubmissionUrl) { link.href = CFG.canvasSubmissionUrl; link.classList.remove("hidden"); }
  const d = $("#certDialog");
  if (!d.open) d.showModal();
}

function drawCertificate() {
  const cv = $("#certCanvas"), ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  const gold = isGold();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fffdf7"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(44,107,171,.10)"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = "#17304f"; ctx.lineWidth = 12; rr(ctx, 40, 40, W - 80, H - 80, 28); ctx.stroke();
  ctx.strokeStyle = gold ? "#d9a400" : "#2076d2"; ctx.lineWidth = 4; rr(ctx, 66, 66, W - 132, H - 132, 22); ctx.stroke();
  ctx.fillStyle = "#173b78"; rr(ctx, 120, 130, 170, 115, 24); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "900 58px Segoe UI, Arial"; ctx.textAlign = "center"; ctx.fillText("C++", 205, 207);
  ctx.beginPath(); ctx.arc(W - 210, 190, 72, 0, Math.PI * 2);
  ctx.fillStyle = gold ? "#ffd44d" : "#dfe6ee"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = gold ? "#b47700" : "#8a97a8"; ctx.stroke();
  ctx.font = "64px Segoe UI Emoji, Apple Color Emoji, sans-serif"; ctx.fillText(L.badge.icon, W - 210, 213);
  ctx.font = "800 20px Segoe UI, Arial"; ctx.fillStyle = gold ? "#7d5600" : "#4f5d70";
  ctx.fillText(gold ? "HUY HIỆU VÀNG" : "HUY HIỆU BẠC", W - 210, 292);
  ctx.fillStyle = "#17304f"; ctx.font = "900 30px Segoe UI, Arial"; ctx.fillText("CHỨNG NHẬN HOÀN THÀNH TỰ HỌC", W / 2, 165);
  ctx.fillStyle = "#2076d2"; fit(ctx, `BÀI ${L.number}: ${L.title.toUpperCase()}`, W / 2, 235, 980, 54, 34, "#2076d2");
  ctx.fillStyle = "#61708a"; ctx.font = "500 26px Segoe UI, Arial"; ctx.fillText(`C++ Journey 8 · ${L.story}`, W / 2, 285);
  ctx.fillStyle = "#17304f"; ctx.font = "500 25px Segoe UI, Arial"; ctx.fillText("Chứng nhận học sinh", W / 2, 385);
  fit(ctx, state.student.name, W / 2, 460, 1100, 56, 36, "#6547bb");
  ctx.strokeStyle = "#d1c8b7"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(260, 490); ctx.lineTo(W - 260, 490); ctx.stroke();
  ctx.fillStyle = "#17304f"; ctx.font = "700 28px Segoe UI, Arial"; ctx.fillText(`Lớp ${state.student.className}`, W / 2, 545);
  ctx.font = "500 25px Segoe UI, Arial";
  ctx.fillText(`đã vượt 4 chặng, hạ BOSS · ${state.xp} XP${gold ? " · hoàn thành cả nhiệm vụ nâng cao" : ""}`, W / 2, 600);
  ctx.font = "700 20px Segoe UI, Arial";
  L.skills.forEach((b, i) => {
    const w = 295, x = 195 + (i % 3) * 410, y = 672 + Math.floor(i / 3) * 78;
    ctx.fillStyle = i % 2 ? "#fff1db" : "#eaf4ff"; rr(ctx, x, y, w, 52, 26); ctx.fill();
    ctx.strokeStyle = i % 2 ? "#ef8a17" : "#2076d2"; ctx.lineWidth = 2; rr(ctx, x, y, w, 52, 26); ctx.stroke();
    ctx.fillStyle = "#17304f"; ctx.textAlign = "center"; ctx.fillText(b, x + w / 2, y + 34);
  });
  const date = new Date(state.completedAt || Date.now()).toLocaleDateString("vi-VN");
  ctx.fillStyle = "#61708a"; ctx.font = "500 19px Segoe UI, Arial"; ctx.textAlign = "left";
  ctx.fillText(`Ngày hoàn thành: ${date}`, 120, 965);
  ctx.fillText(`Mã xác nhận: ${certId()}`, 120, 1000);
  ctx.textAlign = "right";
  const issuer = [CFG.schoolName, CFG.teacherName ? `GV: ${CFG.teacherName}` : ""].filter(Boolean).join(" · ");
  ctx.fillText(issuer || "Tạo trực tiếp từ tiến độ trên web", W - 120, 965);
  ctx.fillText(L.certNote || "Nộp kèm: link Programiz bài cá nhân + ảnh output", W - 120, 1000);
}

function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}

function fit(ctx, text, x, y, maxW, size, min, color) {
  while (size > min) { ctx.font = `900 ${size}px Segoe UI, Arial`; if (ctx.measureText(text).width <= maxW) break; size -= 2; }
  ctx.font = `900 ${size}px Segoe UI, Arial`;
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.fillText(text, x, y);
}

function fileSafe(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
}

function savePng() {
  drawCertificate();
  $("#certCanvas").toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ChungChi-Bai${L.number}-${fileSafe(state.student.name)}-${state.student.className}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function printPdf() {
  drawCertificate();
  const data = $("#certCanvas").toDataURL("image/png");
  const win = window.open("", "_blank");
  if (!win) return alert("Trình duyệt đang chặn cửa sổ in. Cho phép popup rồi thử lại.");
  win.document.write(`<!doctype html><html><head><title>Chứng chỉ Bài ${L.number}</title><style>html,body{margin:0}body{display:grid;place-items:center;min-height:100vh}img{max-width:100%}@page{size:A4 landscape;margin:0}@media print{img{width:100vw}}</style></head><body><img src="${data}"/></body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 300);
}

/* ---------- khởi động ---------- */
function boot() {
  shell();
  load(CPPAccount.student());
  $("#studentBtn").addEventListener("click",CPPAccount.profile);
  $("#newStudentBtn").addEventListener("click",CPPAccount.profile);
  $("#resetBtn").addEventListener("click",CPPAccount.profile);
  $("#errorsBtn").addEventListener("click", () => $("#errorsDialog").showModal());
  $("#soundBtn").addEventListener("click", () => { safeSet(`${PREFIX}:sound`, soundOn() ? "off" : "on"); $("#soundBtn").textContent = soundOn() ? "🔊" : "🔇"; });
  $$("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
  $("#savePng").addEventListener("click", savePng);
  $("#printPdf").addEventListener("click", printPdf);
  $(".bit-close").addEventListener("click", () => $("#bitBubble").classList.add("hidden"));
  $("#bitFace").addEventListener("click", () => {
    const b = $("#bitBubble");
    if (b.classList.contains("hidden") && bitLast) { b.classList.remove("hidden"); } else b.classList.add("hidden");
  });
  $("#soundBtn").textContent = soundOn() ? "🔊" : "🔇";
  guardCopy();
  renderAll(true);CPPAccount.controls();
}

window.CPP_ENGINE={remoteState(){if(!CppCloud.allowed())return;load(CPPAccount.student());renderAll(true)},profileChanged(){if(!state||!CppCloud.allowed())return;state.student=CPPAccount.student();updateTop()},dispose(){CppRun.stop();clearTimeout(bitTimer);state=null}};
if(CppCloud.allowed())boot();

})();
