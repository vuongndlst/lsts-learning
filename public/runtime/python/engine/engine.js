(()=>{
/* Python 10 — engine dùng chung cho mọi bài (giao diện "LSTS Py Studio" cho khối 10)
   - Nội dung từng bài: window.LESSON (baiNN/lesson.js); khối nội dung dùng chung: engine/kit.js
   - Chạy Python thật bằng Pyodide trong Web Worker (engine/py-worker.js + engine/runner.py); quá 3 giây thì dừng
   - Nova (AI mentor của LSTS Py Studio) gọi học sinh là "bạn", xưng "mình"
   - Lớp trò chơi: lộ trình bên trái, mã đồng bộ ở điểm dừng, Ngôi sao hi vọng, combo, BOSS có thanh máu, huy hiệu
   - Khung code kiểu VS Code: tô màu, tự thụt lề sau dấu :, không cho sao chép/dán (tập gõ code)
*/
"use strict";

const L = window.LESSON;
const CFG = { schoolName: "", teacherName: "", canvasSubmissionUrl: "", ...(window.PY10_CONFIG || {}) };
const PREFIX = "py10";
const CLASSES = ["10A1", "10A2", "10A3", "10A4", "10A5", "10A6", "10A7", "10A8", "10A9", "10A10"];
const XP_PASS = 10, XP_FIRST_TRY = 5, STAR_LOSS = 10, RUN_LIMIT_MS = 3000;
const STEPS = L.steps.filter(step=>step.kind!=='gate'||!selfStudy());
// Chặng "Luyện thêm" (kind: "extra", sau Boss): không bắt buộc, không ảnh hưởng chứng chỉ.
STEPS.filter(s => s.kind === "extra").forEach(s => s.challenges.forEach(c => { c.extra = true; }));
const REQUIRED = STEPS.filter(s => s.kind !== "extra").flatMap(s => (s.challenges || []).filter(c => !c.advanced && !c.bonus).map(c => c.id));
const { hl, esc, normalizeOutput } = window.PY;

let state = null;

/* ---------- tiện ích ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}
function codeHash(code) { return hashText("py10|" + String(code).toUpperCase().replace(/\s+/g, "")); }
function studentKey(st) { return hashText(`${st.name}|${st.className}`.toLowerCase()); }
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } }
const linesOf = s => (s == null || s === "" ? [] : String(s).replace(/\r/g, "").split("\n"));

/* ---------- lưu trạng thái ---------- */
function freshState(student) {
  return { student, active: STEPS[0].id, passed: {}, attempts: {}, drafts: {}, inputs: {}, gates: {},
    xp: 0, combo: 0, stars: {}, startedAt: new Date().toISOString(), completedAt: null };
}
function storageKey() { return `lsts:${PyCloud.user.id}:python-10:${PY10_CLOUD_CONFIG.runId}:${L.id}`; }
function save() {
  if (!state || !PyCloud.allowed()) return;
  state.student = PYAccount.student();
  state.completed = allRequiredDone();
  if (state.completed) state.badge = isGold() ? "gold" : "silver";
  PyCloud.save(L.id, state);
}
function load(student) {
  const remote={...PyCloud.state(L.id)};const q=new URLSearchParams(location.search),steps=L.steps.filter(s=>s.kind!=='gate'&&(q.has('cuoi')||s.kind!=='boss')),index=q.has('cuoi')?steps.findIndex(s=>s.kind==='boss'):Number(q.get('chang'));if(q.has('chang')||q.has('cuoi'))remote.active=steps[index]?.id||steps[0].id;
  state = { ...freshState(student), ...remote, student };
  for(const field of ["passed","attempts","drafts","inputs","gates","stars"]) if(!state[field]||typeof state[field]!=="object"||Array.isArray(state[field]))state[field]={};
}
function selfStudy() {return Boolean(window.PORTAL_SELF_STUDY);}

/* ---------- tiến độ ---------- */
function stepDone(step) {
  if (step.kind === "gate") return Boolean(state.gates[step.id]);
  if (step.kind === "extra") return true;
  return step.challenges.filter(c => !c.advanced).every(c => state.passed[c.id]);
}
function stepUnlocked(i) { return selfStudy() || STEPS.slice(0, i).every(stepDone); }
function bossStep() { return STEPS.find(s => s.kind === "boss"); }
function allRequiredDone() { return REQUIRED.every(id => state.passed[id]) && STEPS.filter(s => s.kind !== "gate").every(stepDone); }
function isGold() { const b = bossStep(); return allRequiredDone() && b.challenges.filter(c => c.advanced).every(c => state.passed[c.id]); }
function activeStep() { return STEPS.find(s => s.id === state.active); }
function percent() {
  const all = STEPS.filter(s => s.kind !== "extra" && s.kind !== "gate").flatMap(s => s.challenges.filter(c => !c.advanced).map(c => c.id));
  const done = all.filter(id => state.passed[id] || state.gates[id]).length;
  return Math.round(100 * done / all.length);
}

/* ---------- chạy Python (Pyodide trong worker) ---------- */
const PyRun = (() => {
  let worker = null, ready = false, ver = "", seq = 0, failed = "";
  const waiting = new Map();
  const readyCbs = [];
  function status(text, cls) { const el = $("#pyStatus"); if (el) { el.textContent = text; el.className = `py-status ${cls}`; } }
  function start() {
    ready = false; failed = "";
    status("Python đang khởi động…", "loading");
    worker = new Worker("../engine/py-worker.js", { type: "module" });
    worker.onmessage = e => {
      const m = e.data;
      if (m.kind === "ready") { ready = true; ver = m.ver; status(`Python ${ver} · sẵn sàng`, "ok"); readyCbs.splice(0).forEach(f => f()); }
      else if (m.kind === "fail") { failed = m.error; status("Không tải được Python", "bad"); readyCbs.splice(0).forEach(f => f()); }
      else if (m.kind === "result") { const w = waiting.get(m.id); if (w) { waiting.delete(m.id); clearTimeout(w.timer); w.resolve(m); } }
    };
    worker.onerror = () => { failed = "worker"; status("Không tải được Python", "bad"); };
  }
  function stop() { worker?.terminate(); worker=null; ready=false; failed="signed_out"; readyCbs.splice(0).forEach(f=>f()); for(const w of waiting.values()){clearTimeout(w.timer);w.resolve({out:"",err:{type:"WebError",msg:"Đã đóng phòng thực hành.",tb:""}})}waiting.clear(); }
  function whenReady() { return ready || failed ? Promise.resolve() : new Promise(r => readyCbs.push(r)); }
  async function run(code, inputs = [], seed = null) {
    await whenReady();
    if (!PyCloud.allowed()) return {ok:false,out:"",err:{type:"WebError",msg:"Cần đăng nhập.",tb:""}};
    if (failed) return { ok: false, out: "", err: { type: "WebError", msg: "Không tải được Python. Kiểm tra mạng rồi tải lại trang (F5).", line: 0, tb: "" } };
    const id = ++seq;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        worker.terminate(); start();
        resolve({ ok: false, out: "", err: { type: "Timeout", msg: "", line: 0, tb: "" } });
      }, RUN_LIMIT_MS + (ready ? 0 : 15000));
      waiting.set(id, { timer, resolve: m => resolve({ ok: !m.err, out: m.out || "", err: m.err }) });
      worker.postMessage({ id, code, inputs, seed });
    });
  }
  return { start, stop, run, whenReady, get ready() { return ready; } };
})();

/* ---------- lỗi Python → lời Nova ---------- */
function friendlyError(err, code) {
  const line = err.line ? ` ở dòng ${err.line}` : "";
  const src = err.line ? (String(code).split("\n")[err.line - 1] || "").trim() : "";
  const m = err.msg || "";
  switch (err.type) {
    case "Timeout": return "Chương trình chạy quá 3 giây mà chưa dừng — có thể là vòng lặp vô hạn. Kiểm tra điều kiện dừng và lệnh cập nhật biến trong vòng lặp.";
    case "HetNhap": return `Chương trình gọi input()${line} nhưng hết dữ liệu nhập. Thêm giá trị vào ô DỮ LIỆU NHẬP (mỗi dòng một giá trị) hoặc bớt lệnh input().`;
    case "IndentationError":
    case "TabError":
      if (/expected an indented block/.test(m)) return `Sau dấu : phải có ít nhất một lệnh thụt vào 4 dấu cách${line}.`;
      if (/unexpected indent/.test(m)) return `Dòng này bị thụt lề thừa${line}. Lệnh không nằm trong khối nào thì phải sát lề trái.`;
      return `Thụt lề chưa khớp${line}. Các lệnh cùng một khối phải thụt vào bằng nhau (4 dấu cách mỗi bậc).`;
    case "SyntaxError":
      if (/unterminated string|EOL while scanning/.test(m)) return `Chuỗi chưa đóng ngoặc kép${line}. Mỗi chuỗi mở bằng " thì phải đóng bằng ".`;
      if (/was never closed|unexpected EOF/.test(m)) return `Có dấu ngoặc mở mà chưa đóng${line}. Đếm lại ( ) [ ] { } cho đủ cặp.`;
      if (/expected ':'/.test(m)) return `Thiếu dấu : ở cuối dòng${line}. Sau if, elif, else, for, while, def… luôn có dấu :.`;
      if (/invalid syntax\. Maybe you meant '==' or ':='/.test(m) || (/=/.test(src) && /^(if|elif|while)\b/.test(src) && !/==|!=|<=|>=/.test(src)))
        return `Trong điều kiện phải dùng == để so sánh${line}, không dùng = (= là lệnh gán).`;
      if (/invalid decimal literal|invalid syntax/.test(m) && /^\s*\d/.test(src.split("=")[0] || "")) return `Tên biến không được bắt đầu bằng chữ số${line}.`;
      if (/Missing parentheses in call to 'print'/.test(m)) return `print là một hàm: phải viết print(...) có cặp ngoặc tròn${line}.`;
      if (/invalid character/.test(m)) return `Có ký tự lạ${line} — thường do gõ dấu tiếng Việt hoặc ngoặc kép kiểu “ ” trong code. Gõ lại bằng bàn phím tiếng Anh.`;
      if (/cannot assign to/.test(m)) return `Vế trái của dấu = phải là một tên biến${line}. Ví dụ: diem = diem + 1, không viết diem + 1 = diem.`;
      return `Lỗi cú pháp${line}: Python không hiểu cách viết. Soát dấu ngoặc, dấu :, dấu phẩy và ngoặc kép ở dòng đó và dòng ngay trên.`;
    case "NameError": {
      const n = (m.match(/name '(\w+)'/) || [])[1] || "?";
      if (n !== n.toLowerCase() && ["print", "input", "int", "float", "str", "len", "range", "type"].includes(n.toLowerCase()))
        return `Python phân biệt chữ hoa, chữ thường: phải viết ${n.toLowerCase()}, không phải ${n}${line}.`;
      return `Python chưa biết tên "${n}"${line}. Kiểm tra chính tả (cả chữ hoa/thường), hoặc gán giá trị cho biến trước khi dùng. Nếu là chữ cần in thì phải đặt trong ngoặc kép.`;
    }
    case "TypeError":
      if (/can only concatenate str|unsupported operand type\(s\) for \+: 'int' and 'str'|must be str, not int/.test(m))
        return `Không cộng được chuỗi với số${line}. Đổi số sang chuỗi bằng str(...), dùng dấu phẩy trong print, hoặc dùng f-string.`;
      if (/not supported between instances of 'str' and 'int'|'>' not supported|'<' not supported/.test(m))
        return `Đang so sánh chuỗi với số${line}. Dữ liệu từ input() là chuỗi — đổi sang số bằng int(...) trước khi so sánh.`;
      if (/unsupported operand type/.test(m)) return `Phép tính dùng sai kiểu dữ liệu${line} (thường do quên int(...) cho dữ liệu từ input()).`;
      if (/missing \d+ required positional argument|takes \d+ positional argument/.test(m)) return `Gọi hàm chưa đúng số đối số${line}. Truyền đủ và đúng thứ tự như các tham số khi định nghĩa hàm.`;
      if (/object is not callable/.test(m)) return `Đang gọi một thứ không phải hàm${line} — có thể bạn đã đặt tên biến trùng tên hàm (ví dụ biến tên print, sum, max).`;
      if (/object is not subscriptable/.test(m)) return `Không lấy phần tử [ ] được từ giá trị này${line}. Kiểm tra lại biến đó có phải list/chuỗi không.`;
      return `Sai kiểu dữ liệu${line}: ${m}`;
    case "ValueError":
      if (/invalid literal for int\(\)/.test(m)) return `Không đổi được "${(m.match(/: '(.*)'$/) || [])[1] || ""}" thành số nguyên${line}. Dữ liệu nhập phải là số nguyên (không có chữ, không có dấu chấm).`;
      if (/could not convert string to float/.test(m)) return `Không đổi được dữ liệu nhập thành số thực${line}. Số thập phân viết bằng dấu chấm, ví dụ 7.5.`;
      return `Giá trị không hợp lệ${line}: ${m}`;
    case "ZeroDivisionError": return `Chia cho 0${line}. Kiểm tra số chia trước khi chia.`;
    case "IndexError": return `Chỉ số vượt ra ngoài${line}. Chỉ số bắt đầu từ 0; phần tử cuối có chỉ số len(...) - 1.`;
    case "KeyError": return `Không có khoá ${m} trong dictionary${line}. Kiểm tra bằng toán tử in trước khi lấy.`;
    case "AttributeError": return `Kiểu dữ liệu này không có thuộc tính/phương thức đó${line}: ${m}`;
    case "RecursionError": return `Hàm gọi lại chính nó quá nhiều lần${line}.`;
    case "AssertionError": return `Một lệnh assert sai${line} — chương trình chưa đúng với ca kiểm thử đó.`;
    default: return `Chương trình gặp lỗi ${err.type}${line}: ${m}`;
  }
}
function errorBlock(err, code) {
  if (!err) return "";
  const tb = err.tb ? `<pre class="tb">${esc(err.tb)}</pre>` : "";
  return `<div class="err-explain"><span class="err-tag">${esc(err.type === "HetNhap" ? "Thiếu dữ liệu nhập" : err.type === "Timeout" ? "Quá thời gian" : err.type)}</span>${esc(friendlyError(err, code))}</div>${tb}`;
}

/* ---------- âm thanh, pháo giấy ---------- */
let audioCtx = null;
function soundOn() { return safeGet(`${PREFIX}:sound`) === "on"; }
function beep(kind) {
  if (!soundOn()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { good: [784, 1175], bad: [233, 196], win: [523, 659, 784, 1047], unlock: [587, 880] }[kind] || [440];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === "bad" ? "sawtooth" : "sine"; o.frequency.value = f;
      const t = audioCtx.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.2);
    });
  } catch { /* bỏ qua */ }
}
function confetti(origin = null, big = false) {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.className = "confetti-layer"; c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const colors = ["#3776AB", "#FFD43B", "#5EE0B5", "#6D4AFF", "#7DB6E8"];
  const ox = origin ? origin.x : c.width / 2, oy = origin ? origin.y : c.height * 0.3;
  const n = big ? 160 : 40;
  const parts = Array.from({ length: n }, () => {
    const a = big ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
    const v = (big ? 5 : 4) + Math.random() * (big ? 7 : 5);
    return { x: big ? Math.random() * c.width : ox, y: big ? -20 - Math.random() * 200 : oy, vx: big ? (Math.random() - 0.5) * 3 : Math.cos(a) * v,
      vy: big ? 2 + Math.random() * 3 : Math.sin(a) * v, r: 3 + Math.random() * 4, col: colors[Math.floor(Math.random() * colors.length)] };
  });
  const t0 = performance.now(), dur = big ? 2400 : 1100;
  (function frame(t) {
    ctx.clearRect(0, 0, c.width, c.height);
    parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.vx *= 0.99;
      ctx.globalAlpha = Math.max(0, 1 - (t - t0) / dur); ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.r, p.r); });
    if (t - t0 < dur) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

/* ---------- Nova: AI mentor của LSTS Py Studio ---------- */
function novaSvg(mood = "idle") {
  const eyes = {
    idle: '<rect x="20" y="27" width="7" height="11" rx="3.5"/><rect x="37" y="27" width="7" height="11" rx="3.5"/>',
    happy: '<path d="M18 34 q5 -7 10 0 M36 34 q5 -7 10 0" stroke-width="4" stroke-linecap="round" fill="none"/>',
    think: '<rect x="20" y="30" width="8" height="5" rx="2.5"/><rect x="37" y="27" width="7" height="10" rx="3.5"/>',
    oops: '<path d="M19 28 l8 8 M27 28 l-8 8 M37 28 l8 8 M45 28 l-8 8" stroke-width="3.5" stroke-linecap="round"/>'
  }[mood] || "";
  return `<svg class="nova-svg ${mood}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="ng" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3776AB"/><stop offset="1" stop-color="#6D4AFF"/></linearGradient></defs>
    <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#ng)"/>
    <rect x="10" y="16" width="44" height="30" rx="12" fill="#0E1726"/>
    <g fill="#FFD43B" stroke="#FFD43B">${eyes}</g>
    <circle cx="52" cy="12" r="5" fill="#FFD43B" stroke="#0E1726" stroke-width="2"/>
  </svg>`;
}
let novaTimer = null, novaLast = "";
function nova(html, mood = "idle", ms = 0) {
  const box = $("#novaMsg"); if (!box) return;
  novaLast = html;
  $("#novaText").innerHTML = html;
  $("#novaFace").innerHTML = novaSvg(mood);
  box.className = `nova-msg ${mood}`;
  clearTimeout(novaTimer);
  if (ms) novaTimer = setTimeout(() => box.classList.add("hidden"), ms);
}

/* ---------- icon (nét mảnh) ---------- */
const IC = {
  bug: '<path d="M8 9h8M9 9a3 3 0 0 1 6 0M7 13h10M12 9v11M6 20l2-2M18 20l-2-2M6 10l2 1M18 10l-2 1M5 15h2M17 15h2"/><rect x="7" y="9" width="10" height="11" rx="5"/>',
  sound: '<path d="M4 9h3l4-4v14l-4-4H4z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9h3l4-4v14l-4-4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  skull: '<path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M10 20v-2M14 20v-2"/>',
  star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
  reset: '<path d="M4 4v6h6"/><path d="M5 15a8 8 0 1 0 2-8.5L4 10"/>',
  hint: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  cert: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>'
};
const ic = (k, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;

/* ---------- khung trang ---------- */
function shell() {
  document.title = `Bài ${L.number}: ${L.title} · Python 10`;
  document.body.innerHTML = `
  <header class="topbar">
    <a class="brand" href="../index.html" title="Về trang các bài">
      <span class="logo"><i></i><i></i></span>
      <span class="brand-text"><b>LSTS Py Studio</b><small>Python · Khối 10</small></span>
    </a>
    <div class="crumb"><span>Bài ${L.number}</span><b>${esc(L.title)}</b></div>
    <div class="top-actions">
      <span id="pyStatus" class="py-status loading">Python đang khởi động…</span>
      <span class="xp-pill" id="xpPill">${ic("bolt")}<b>0</b> EXP</span>
      <button id="errorsBtn" class="icon-btn" type="button" title="Lỗi thường gặp">${ic("bug")}<span>Lỗi thường gặp</span></button>
      <button id="soundBtn" class="icon-btn only" type="button" title="Bật/tắt âm thanh"></button>
      <button id="studentBtn" class="icon-btn" type="button" title="Đổi học sinh">${ic("user")}<span id="studentText">—</span></button>
    </div>
  </header>
  <div class="layout">
    <aside class="rail" id="rail" aria-label="Lộ trình bài học"></aside>
    <main class="main"><div id="stepContainer"></div>
      <footer class="site-footer"><span>LSTS Py Studio · Python 10 · Bài ${L.number} · chạy Python thật bằng Pyodide</span>
        <button id="resetBtn" class="text-button" type="button">Tải bản sao / tài khoản</button></footer>
    </main>
  </div>
  <div class="nova" id="nova">
    <div class="nova-msg hidden" id="novaMsg" role="status" aria-live="polite">
      <div class="nova-name">Nova <small>AI mentor · LSTS Py Studio</small><button class="nova-close" type="button" aria-label="Ẩn">×</button></div>
      <div id="novaText"></div>
    </div>
    <button class="nova-face" id="novaFace" type="button" title="Nova — bấm để xem lại lời nhắn">${novaSvg()}</button>
  </div>
  <dialog id="errorsDialog" class="modal wide">
    <div class="modal-card"><button class="close-x" type="button" data-close>×</button>
      <p class="eyebrow">QUY TẮC "3 TRƯỚC THẦY"</p><h2>Lỗi thường gặp</h2>
      <p class="muted">① Đọc dòng cuối của thông báo lỗi và số dòng → ② tìm trong bảng này → ③ hỏi bạn cùng nhóm. Kẹt quá 3 phút thì giơ tay.</p>
      <div class="table-wrap"><table class="error-table"><thead><tr><th>Thông báo / dấu hiệu</th><th>Nguyên nhân</th><th>Cách sửa</th></tr></thead>
      <tbody>${L.errorTable.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
    </div>
  </dialog>
  <dialog id="typeDialog" class="modal">
    <form method="dialog" class="modal-card type-card">
      <div class="id-face">${novaSvg("think")}</div>
      <h2>Khoan đã!</h2>
      <p>Ở LSTS Py Studio, code được <b>gõ tay</b> — sao chép và dán đều bị tắt trong khung này. Gõ lại từng dòng giúp bạn nhớ cú pháp và nhanh tay hơn khi làm game. Kẹt chỗ nào thì mở gợi ý nhé.</p>
      <button class="btn primary wide" type="submit">Mình tự gõ</button>
    </form>
  </dialog>
  <dialog id="certDialog" class="modal wide">
    <div class="modal-card"><button class="close-x" type="button" data-close>×</button>
      <p class="eyebrow">BOSS ĐÃ BỊ HẠ</p><h2>Chứng chỉ Bài ${L.number}</h2>
      <p class="muted">Lưu chứng chỉ tự học dạng PNG. Đây là kết quả quá trình, chưa phải điểm do giáo viên xác minh.</p>
      <canvas id="certCanvas" width="1600" height="1000" aria-label="Chứng chỉ"></canvas>
      <div class="row-btns"><button id="savePng" class="btn primary" type="button">Lưu PNG</button>
        <button id="printPdf" class="btn" type="button">In / Lưu PDF</button>
        <a id="canvasLink" class="btn hidden" href="#" target="_blank" rel="noopener">Mở Canvas để nộp ↗</a></div>
    </div>
  </dialog>`;
}

/* ---------- lộ trình ---------- */
function renderRail() {
  const rail = $("#rail");
  const pct = percent();
  rail.innerHTML = `
    <div class="rail-head"><div class="eyebrow">BÀI ${L.number}</div><div class="rail-title">${esc(L.title)}</div>
      <div class="rail-story">${esc(L.story)}</div>
      <div class="prog"><div class="prog-bar" style="width:${pct}%"></div></div><div class="prog-text">${pct}% nhiệm vụ đạt</div><button id="studyMode" class="btn">${selfStudy()?"Học theo lớp":"Tự học / học bù"}</button><p class="muted">Con có thể chọn mọi chặng. Hoàn thành cần đạt các nhiệm vụ bắt buộc và Boss.</p></div>
    <ol class="steps">${STEPS.map((s, i) => {
      const un = stepUnlocked(i), done = stepDone(s), act = state.active === s.id;
      const ex = s.kind === "extra";
      const mark = !un ? ic("lock") : ex ? ic("bolt") : done ? ic("check") : s.kind === "gate" ? ic("pause") : s.kind === "boss" ? ic("skull") : `<b>${s.number}</b>`;
      const sub = s.kind === "gate" ? "Điểm dừng" : s.kind === "boss" ? "Boss" : ex ? "Không bắt buộc" : `Chặng ${s.number}`;
      const req = s.kind === "gate" ? null : s.challenges.filter(c => !c.advanced);
      const prog = req && un && (ex || !done) ? `<span class="st-prog">${req.filter(c => state.passed[c.id]).length}/${req.length}</span>` : "";
      return `<li><button type="button" class="st ${s.kind} ${done ? "done" : ""} ${act ? "active" : ""}" data-step="${s.id}" ${un ? "" : "disabled"}>
        <span class="st-mark">${mark}</span><span class="st-text"><small>${sub}</small>${esc(s.nav)}</span>${prog}</button></li>`;
    }).join("")}</ol>`;
  $("#studyMode").onclick=()=>{state.navigationMode=selfStudy()?"guided":"self-study";save();renderAll(true)};
  $$(".st", rail).forEach(b => b.addEventListener("click", () => go(b.dataset.step)));
}
function go(id) { state.active = id; save(); renderAll(true); window.scrollTo({ top: 0, behavior: "instant" }); }
function updateTop() {
  $("#xpPill b").textContent = state.xp;
  $("#xpPill").classList.toggle("combo", state.combo >= 2);
  $("#xpPill").title = state.combo >= 2 ? `Chuỗi đúng ngay lần đầu: ${state.combo}` : "Điểm kinh nghiệm";
  $("#studentText").textContent = `${state.student.name} · ${state.student.className}`;
  $("#soundBtn").innerHTML = ic(soundOn() ? "sound" : "mute");
}

/* ---------- trang từng bước ---------- */
function renderAll(entering = false) {
  const idx = STEPS.findIndex(s => s.id === state.active);
  if (idx < 0 || !stepUnlocked(idx)) state.active = [...STEPS].reverse().find(s => stepUnlocked(STEPS.indexOf(s))).id;
  if (allRequiredDone() && !state.completedAt) { state.completedAt = new Date().toISOString(); saveBadge(); save(); }
  updateTop(); renderRail();
  const step = activeStep();
  if (step.kind === "gate") renderGate(step); else renderStage(step);
  if (entering || !novaLast) {
    const msg = step.kind === "gate"
      ? (stepDone(step) ? "Đã đồng bộ. Đi tiếp thôi!" : "Điểm dừng. Cả lớp cùng chốt kiến thức với thầy, làm luyện tập nhóm, rồi nhập mã đồng bộ để đi tiếp.")
      : step.nova;
    if (msg) nova(msg, step.kind === "boss" ? "think" : "idle", 9000);
  }
}

function renderStage(step) {
  const isBoss = step.kind === "boss";
  const next = STEPS[STEPS.indexOf(step) + 1];
  const req = step.challenges.filter(c => !c.advanced), adv = step.challenges.filter(c => c.advanced);
  $("#stepContainer").innerHTML = `
  <article class="stage ${isBoss ? "boss" : ""}">
    <header class="hero">
      <div class="kicker">${esc(step.kicker)}</div>
      <h1>${esc(step.title)}</h1>
      ${step.objectives ? `<ul class="goals">${step.objectives.map(o => `<li>${ic("check")}${esc(o)}</li>`).join("")}</ul>` : ""}
      ${isBoss ? bossBar(step) : ""}
    </header>
    ${step.lesson ? `<div class="lesson">${step.lesson}</div>` : ""}
    <section class="tasks">
      <h2 class="sec-h">${isBoss ? "Hạ Boss" : "Nhiệm vụ"}<span class="sec-count" id="secCount"></span></h2>
      ${req.map(renderChallenge).join("")}
    </section>
    ${adv.length ? `<section class="tasks adv"><h2 class="sec-h">Nâng cao<span class="sec-sub">không bắt buộc — làm đủ ${adv.length} nhiệm vụ để có huy hiệu vàng</span></h2>${adv.map(renderChallenge).join("")}</section>` : ""}
    <div class="stage-foot"><div class="foot-note" id="stageNote"></div>
      <div class="foot-btns">${isBoss || !next ? `<button id="certBtn" class="btn gold big" type="button">${ic("cert")} Mở chứng chỉ</button>` : ""}
        ${next ? `<button id="nextBtn" class="btn ${isBoss ? "" : "primary"} big" type="button">${nextLabel(next)}</button>` : ""}</div></div>
  </article>`;
  const media=document.createElement("div");$("#stepContainer .tasks").before(media);PYMedia.mount(media,L.media,step.id);
  step.challenges.forEach(bindChallenge);
  $("#nextBtn")?.addEventListener("click", () => { if (stepDone(step) || selfStudy()) go(next.id); });
  $("#certBtn")?.addEventListener("click", openCertificate);
  refreshFooter(step);
}
function nextLabel(n) { return n.kind === "gate" ? "Đến điểm dừng →" : n.kind === "boss" ? "Vào Boss →" : n.kind === "extra" ? "Luyện thêm →" : `Sang Chặng ${n.number} →`; }
function bossBar(step) {
  const req = step.challenges.filter(c => !c.advanced);
  const hp = Math.round(100 * (1 - req.filter(c => state.passed[c.id]).length / req.length));
  return `<div class="boss-card"><div class="boss-ava">${ic("skull")}</div><div class="boss-info">
    <div class="boss-name">${esc(step.bossName || "BOSS")}<span>HP <b id="hpText">${hp}%</b></span></div>
    <div class="hp"><div class="hp-bar" id="hpBar" style="width:${hp}%"></div></div>
    ${step.bossLine ? `<p class="boss-line">“${esc(step.bossLine)}”</p>` : ""}</div></div>`;
}
function refreshFooter(step) {
  const note = $("#stageNote"), done = stepDone(step), next = $("#nextBtn");
  if (next) next.disabled = !done && !selfStudy();
  const req = step.challenges.filter(c => !c.advanced), hit = req.filter(c => state.passed[c.id]).length;
  const cnt = $("#secCount"); if (cnt) cnt.textContent = `${hit}/${req.length}`;
  if (step.kind === "extra") {
    if (note) note.textContent = `Luyện thêm không bắt buộc, không ảnh hưởng chứng chỉ — làm được bài nào hay bài đó (${hit}/${req.length}).`;
    return;
  }
  if (step.kind === "boss") {
    const hp = Math.round(100 * (1 - hit / req.length));
    if ($("#hpBar")) { $("#hpBar").style.width = `${hp}%`; $("#hpText").textContent = `${hp}%`; }
    const cert = $("#certBtn"); if (cert) cert.disabled = !allRequiredDone();
    if (note) note.textContent = allRequiredDone() ? (isGold() ? "Boss bị hạ, đủ cả nhiệm vụ nâng cao — chứng chỉ có huy hiệu vàng." : "Boss bị hạ. Mở chứng chỉ để lưu và nộp.") : `Còn ${req.length - hit} đòn nữa.`;
    return;
  }
  if (note) note.textContent = done ? "Hoàn thành chặng." : "Xong các nhiệm vụ ở trên để đi tiếp.";
}

function renderGate(step) {
  const done = stepDone(step), next = STEPS[STEPS.indexOf(step) + 1];
  $("#stepContainer").innerHTML = `
  <article class="stage gate">
    <header class="hero gate-hero ${done ? "open" : ""}">
      <div class="kicker">${esc(step.kicker)}</div>
      <h1>${done ? "Đã đồng bộ với lớp" : "Điểm dừng — nhìn lên bảng"}</h1>
      <p class="hero-sub">${done ? "Bạn đi tiếp được rồi." : "Cả lớp dừng ở đây để cùng chốt kiến thức. Đừng đi tiếp một mình."}</p>
    </header>
    ${selfStudy()?`<p class="cloud-note">Học bù: làm các việc dưới đây rồi tiếp tục học. Không cần mã đồng bộ; mã và kết quả nhiệm vụ được ghi riêng.</p>`:""}<ol class="gate-steps">${step.todo.map((t, i) => `<li><span>${i + 1}</span><div>${t}</div></li>`).join("")}</ol>
    <div class="unlock">
      ${done || selfStudy() ? `<button id="gateNext" class="btn primary big" type="button">${nextLabel(next)}</button>`
        : `<div class="term-login"><div class="tl-head">sync@py-studio</div>
            <label for="gateCode" class="tl-label">$ nhập mã đồng bộ (thầy hiện trên slide sau phần luyện tập nhóm)</label>
            <div class="tl-row"><span class="tl-prompt">›</span><input id="gateCode" type="text" autocomplete="off" spellcheck="false" maxlength="20" placeholder="MÃ…" />
            <button id="gateBtn" class="btn primary" type="button">Đồng bộ</button></div>
            <div id="gateMsg" class="tl-msg" role="status"></div></div>`}
    </div>
    ${step.challenges && step.challenges.length ? `<section class="tasks bonus"><h2 class="sec-h">Trong lúc chờ<span class="sec-sub">nhiệm vụ phụ · không bắt buộc · +EXP</span></h2>${step.challenges.map(renderChallenge).join("")}</section>` : ""}
  </article>`;
  step.challenges?.forEach(bindChallenge);
  $("#gateNext")?.addEventListener("click", () => go(next.id));
  const tryCode = () => {
    if (codeHash($("#gateCode").value) === step.codeHash) {
      state.gates[step.id] = true; save(); beep("unlock"); confetti(null, true); renderAll(true);
    } else {
      $("#gateMsg").textContent = "✗ Mã chưa đúng. Chờ thầy hiện mã trên slide nhé.";
      nova("Mã này chưa khớp. Chờ thầy hiện mã trên slide nhé.", "oops", 5000); beep("bad");
    }
  };
  $("#gateBtn")?.addEventListener("click", tryCode);
  $("#gateCode")?.addEventListener("keydown", e => { if (e.key === "Enter") tryCode(); });
}

/* ---------- nhiệm vụ ---------- */
const TYPE_TAG = { choice: "Dự đoán", sequence: "Sắp xếp", code: "Viết code" };
function renderChallenge(c) {
  const passed = Boolean(state.passed[c.id]);
  const tag = c.tag || (c.bugs ? "Săn bọ" : TYPE_TAG[c.type]);
  let body = "", actions = "";
  if (c.type === "choice") {
    const opts = c.options.map(o => (typeof o === "string" ? { text: o } : o));
    body = `${c.code ? window.KIT.demo(c.code, "main.py", c.input ? `nhập: ${esc(c.input.replace(/\n/g, " ⏎ "))}` : "") : ""}
      ${c.bet && !passed && !state.attempts[c.id] ? starRow(c) : ""}
      <div class="choices ${c.mono ? "mono" : ""}">${opts.map((o, i) => `<label class="choice"><input type="radio" name="${c.id}" value="${i}" /><span class="ch-key">${"ABCDEF"[i]}</span><span class="ch-text">${esc(o.text)}</span></label>`).join("")}</div>`;
    actions = `<button class="btn primary" data-act="choice" type="button">Kiểm tra</button>`;
  }
  if (c.type === "sequence") {
    const items = c.shuffle || c.answer;
    body = `<div class="seq"><div><div class="mini-label">Các dòng — bấm theo thứ tự</div>
        <div class="seq-pool">${items.map((it, i) => `<button type="button" class="seq-item ${c.mono !== false ? "mono" : ""}" data-i="${i}">${c.mono !== false ? hl(it) : esc(it)}</button>`).join("")}</div></div>
      <div><div class="mini-label">Chương trình của bạn</div><div class="seq-answer ${c.mono !== false ? "as-code" : ""}" aria-live="polite"><span class="muted">Chưa có dòng nào.</span></div></div></div>`;
    actions = `<button class="btn primary" data-act="seq-check" type="button">Kiểm tra</button>
      <button class="btn ghost" data-act="seq-undo" type="button">Bỏ dòng cuối</button><button class="btn ghost" data-act="seq-reset" type="button">Làm lại</button>`;
  }
  if (c.type === "code") {
    const draft = state.drafts[c.id] ?? c.starter;
    const tests = c.tests || [{ input: "", expected: c.expected }];
    const needInput = tests.some(t => t.input);
    const inputVal = state.inputs[c.id] ?? (tests[0].input || "");
    const target = tests.length > 1
      ? `<table class="test-table"><thead><tr><th>Ca</th><th>Nhập</th><th>Terminal cần đạt</th></tr></thead><tbody>
          ${tests.map((t, i) => `<tr><td>${i + 1}</td><td><pre>${esc(t.input || "(không)")}</pre></td><td><pre>${esc(t.expected)}</pre></td></tr>`).join("")}</tbody></table>`
      : `<pre class="expected">${esc(tests[0].expected)}</pre>`;
    body = `<div class="brief"><div class="req"><div class="mini-label">Yêu cầu</div><ul>${(c.requirements || []).map(r => `<li>${r}</li>`).join("")}</ul></div>
        <div class="target"><div class="mini-label">${tests.length > 1 ? "Các ca kiểm thử" : "Terminal cần đạt"}${tests.length === 1 && tests[0].input ? ` · nhập <code>${esc(tests[0].input.replace(/\n/g, " ⏎ "))}</code>` : ""}</div>${target}</div></div>
      ${c.bugs ? `<div class="bugs">${c.bugs.map((b, i) => `<span class="bug" data-bug="${i}">${ic("bug")}<small>${esc(b.label)}</small></span>`).join("")}</div>` : ""}
      <div class="ide">
        <div class="ide-bar"><span class="ex-tab"><i class="py-dot"></i>main.py</span><span class="ide-hint">Ctrl + Enter để chạy</span>
          <button type="button" class="ide-btn" data-act="reset-code" title="Trả về code ban đầu">${ic("reset")}</button></div>
        <div class="ed"><pre class="ed-gutter" aria-hidden="true"></pre><div class="ed-area"><pre class="ed-hl" aria-hidden="true"></pre>
          <textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="Khung soạn code Python">${esc(draft)}</textarea></div></div>
        ${needInput ? `<div class="stdin"><label><span class="mini-label">Dữ liệu nhập</span><small>mỗi dòng là một lần input()</small></label>
          <textarea class="stdin-box" rows="${Math.max(2, linesOf(inputVal).length)}" spellcheck="false">${esc(inputVal)}</textarea></div>` : ""}
        <div class="term"><div class="term-bar"><span class="ex-tab">TERMINAL</span></div><div class="term-out"><span class="muted">Bấm Chạy để xem kết quả.</span></div></div>
      </div>`;
    actions = `<button class="btn" data-act="run" type="button">${ic("play")} Chạy</button><button class="btn primary" data-act="check" type="button">Nộp kiểm tra</button>`;
  }
  const hints = c.hints || (c.hint ? [c.hint] : []);
  return `
  <article class="task ${passed ? "passed" : ""} ${c.advanced ? "advanced" : ""} ${c.bonus ? "bonus" : ""}" data-card="${c.id}">
    <header class="task-head"><div class="task-meta"><span class="task-tag">${esc(tag)}</span><span class="task-xp">${c.bonus ? "+EXP" : c.advanced ? "Nâng cao" : c.extra ? `Luyện thêm${c.level ? " · " + "★".repeat(c.level) : ""}` : "+10 EXP"}</span></div>
      <h3>${passed ? ic("check", "ok") : ""}${esc(c.title)}</h3><p class="task-prompt">${c.prompt}</p></header>
    <div class="task-body">${body}
      <div class="actions">${actions}${hints.length && !passed ? `<button class="btn ghost hint-btn" type="button" data-act="hint">${ic("hint")} Gợi ý</button>` : ""}</div>
      <div class="result hidden" data-result role="status"></div><div class="hints" data-hints></div>
    </div>
  </article>`;
}

function stepOf(c) { return STEPS.find(s => (s.challenges || []).some(x => x.id === c.id)); }
function starRow(c) {
  const used = state.stars[stepOf(c).id];
  if (used && used !== c.id) return `<div class="star-row used">${ic("star")} Chặng này bạn đã dùng Ngôi sao hi vọng.</div>`;
  return `<div class="star-row" data-star><button type="button" class="star-toggle" aria-pressed="false">${ic("star")}<span>Ngôi sao hi vọng</span></button>
    <span class="star-rule">Đúng ngay lần này: <b>EXP ×2</b> · Sai: <b>−${STAR_LOSS} EXP</b> · mỗi chặng 1 lần</span></div>`;
}

function result(card, type, msg, extra = "") {
  const el = $("[data-result]", card);
  el.className = `result ${type}`;
  el.innerHTML = `<span class="r-ico">${type === "good" ? ic("check") : type === "bad" ? "✗" : "i"}</span><div class="r-text">${msg}${extra}</div>`;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function bindChallenge(c) {
  const card = $(`[data-card="${c.id}"]`); if (!card) return;
  const hints = c.hints || (c.hint ? [c.hint] : []);
  let shown = 0;
  $('[data-act="hint"]', card)?.addEventListener("click", e => {
    if (shown >= hints.length) return;
    $("[data-hints]", card).insertAdjacentHTML("beforeend", `<div class="hint"><b>Gợi ý ${shown + 1}</b>${hints[shown]}</div>`);
    shown++;
    const b = e.currentTarget; b.lastChild.textContent = shown < hints.length ? " Gợi ý tiếp" : " Hết gợi ý"; b.disabled = shown >= hints.length;
  });

  if (c.type === "choice") {
    let star = false;
    $(".star-toggle", card)?.addEventListener("click", e => {
      star = !star; const t = e.currentTarget;
      t.classList.toggle("on", star); t.setAttribute("aria-pressed", String(star));
      if (star) { beep("unlock"); nova(`<b>Ngôi sao hi vọng.</b> Đúng ngay lần này thì EXP nhân đôi, sai thì mất ${STAR_LOSS} EXP. Chắc chắn rồi hãy chọn.`, "think", 6000); }
    });
    $('[data-act="choice"]', card).addEventListener("click", ev => {
      const sel = $(`input[name="${c.id}"]:checked`, card);
      if (!sel) return result(card, "info", "Chọn một đáp án trước nhé.");
      const opts = c.options.map(o => (typeof o === "string" ? { text: o } : o));
      const picked = opts[Number(sel.value)], right = picked.text === c.answer;
      const starNow = star && !state.passed[c.id];
      if (starNow) state.stars[stepOf(c).id] = c.id;
      star = false; $("[data-star]", card)?.remove();
      attempt(c.id);
      $$(".choice", card).forEach(l => l.classList.remove("right", "wrong"));
      sel.closest(".choice").classList.add(right ? "right" : "wrong");
      if (right) pass(c, card, c.why || "Chính xác.", ev.currentTarget, starNow);
      else {
        let msg = esc(picked.why || "Chưa đúng. Đọc lại phần giải thích phía trên rồi thử lại.");
        if (starNow) { state.xp = Math.max(0, state.xp - STAR_LOSS); msg += ` <b>Ngôi sao hi vọng: −${STAR_LOSS} EXP.</b>`; }
        miss(card, msg);
      }
    });
  }

  if (c.type === "sequence") {
    const items = c.shuffle || c.answer; let picked = [];
    const box = $(".seq-answer", card), mono = c.mono !== false;
    const draw = () => {
      box.innerHTML = picked.length ? picked.map((i, n) => `<span class="picked">${mono ? hl(items[i]) : `${n + 1}. ${esc(items[i])}`}</span>`).join("") : `<span class="muted">Chưa có dòng nào.</span>`;
      $$(".seq-item", card).forEach(b => b.classList.toggle("selected", picked.includes(Number(b.dataset.i))));
    };
    $$(".seq-item", card).forEach(b => b.addEventListener("click", () => { if (!picked.includes(Number(b.dataset.i))) { picked.push(Number(b.dataset.i)); draw(); } }));
    $('[data-act="seq-undo"]', card).addEventListener("click", () => { picked.pop(); draw(); });
    $('[data-act="seq-reset"]', card).addEventListener("click", () => { picked = []; draw(); $("[data-result]", card).classList.add("hidden"); });
    $('[data-act="seq-check"]', card).addEventListener("click", ev => {
      if (picked.length !== c.answer.length) return result(card, "info", "Chọn đủ tất cả các dòng nhé.");
      attempt(c.id);
      const order = picked.map(i => items[i]), wrongAt = order.findIndex((v, i) => v !== c.answer[i]);
      if (wrongAt < 0) pass(c, card, c.why || "Đúng thứ tự.", ev.currentTarget);
      else miss(card, `Dòng thứ ${wrongAt + 1} chưa đúng chỗ. ${esc(c.hintWrong || "Nghĩ xem Python cần chạy dòng nào trước.")}`);
    });
  }

  if (c.type === "code") bindEditor(c, card);
}

/* ---------- khung soạn code kiểu VS Code ---------- */
function bindEditor(c, card) {
  const ta = $(".ed-ta", card), hlPre = $(".ed-hl", card), gut = $(".ed-gutter", card), out = $(".term-out", card), stdin = $(".stdin-box", card);
  const sync = () => {
    const n = ta.value.split("\n").length;
    ta.rows = Math.max(5, n + 1);
    gut.textContent = Array.from({ length: Math.max(n, ta.rows) }, (_, i) => i + 1).join("\n");
    hlPre.innerHTML = hl(ta.value) + "\n ";
    updateBugs(c, card, ta.value);
  };
  sync();
  ta.addEventListener("input", () => { state.drafts[c.id] = ta.value; save(); sync(); });
  ta.addEventListener("scroll", () => { hlPre.scrollLeft = ta.scrollLeft; });
  guardTyping(ta);
  const put = (text, back = 0) => {
    ta.setSelectionRange(ta.selectionStart - back, ta.selectionEnd);
    if (!document.execCommand("insertText", false, text)) {
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + text.length;
      ta.dispatchEvent(new Event("input"));
    }
  };
  const lineBefore = () => { const b = ta.value.slice(0, ta.selectionStart); return b.slice(b.lastIndexOf("\n") + 1); };
  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('[data-act="run"]', card).click(); return; }
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); put("    "); return; }
    if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      const lb = lineBefore(); const lead = lb.match(/^ */)[0].length;
      if (lead) { const s = ta.selectionStart - lb.length; ta.setSelectionRange(s, s + Math.min(4, lead)); put(""); }
      return;
    }
    if (e.key === "Backspace" && ta.selectionStart === ta.selectionEnd) {
      const lb = lineBefore();
      if (lb.length && /^ +$/.test(lb)) { e.preventDefault(); put("", lb.length % 4 || 4); }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const line = lineBefore(), ind = line.match(/^ */)[0];
      const code = line.replace(/#.*$/, "").trimEnd();
      let extra = code.endsWith(":") ? "    " : "";
      if (/^\s*(return|break|continue|pass)\b/.test(line) && ind.length >= 4) { put("\n" + ind.slice(4)); return; }
      put("\n" + ind + extra);
    }
  });
  stdin?.addEventListener("input", () => { state.inputs[c.id] = stdin.value; stdin.rows = Math.max(2, linesOf(stdin.value).length); save(); });
  $('[data-act="reset-code"]', card).addEventListener("click", () => {
    if (!confirm("Trả khung code về như ban đầu? Phần bạn đã gõ sẽ mất.")) return;
    ta.value = c.starter; state.drafts[c.id] = c.starter; save(); sync();
    out.innerHTML = `<span class="muted">Đã trả về code ban đầu.</span>`;
  });
  const runBtn = $('[data-act="run"]', card), checkBtn = $('[data-act="check"]', card);
  const busy = on => { [runBtn, checkBtn].forEach(b => { b.disabled = on; }); card.classList.toggle("running", on); };
  runBtn.addEventListener("click", async () => {
    busy(true); out.innerHTML = `<span class="muted">Đang chạy…</span>`;
    const r = await PyRun.run(ta.value, linesOf(stdin ? stdin.value : ""), c.seed ?? null);
    if(!state || !PyCloud.allowed())return;
    busy(false); showRun(out, r, ta.value);
  });
  checkBtn.addEventListener("click", async ev => {
    busy(true); out.innerHTML = `<span class="muted">Đang chấm…</span>`;
    attempt(c.id);
    const v = await checkCode(c, ta.value, stdin ? stdin.value : "");
    if(!state || !PyCloud.allowed())return;
    busy(false);
    if (v.input != null && stdin) { stdin.value = v.input; stdin.rows = Math.max(2, linesOf(v.input).length); }
    showRun(out, v.run, ta.value);
    if (v.ok) pass(c, card, v.msg, ev.currentTarget); else miss(card, v.msg);
  });
}

function noPasteMsg() { const d = $("#typeDialog"); if (d && !d.open) d.showModal(); }
function guardTyping(ta) {
  ["paste", "drop", "copy", "cut"].forEach(ev => ta.addEventListener(ev, e => { e.preventDefault(); noPasteMsg(); }));
  ta.addEventListener("dragover", e => e.preventDefault());
  ta.addEventListener("beforeinput", e => { if (/^insertFrom(Paste|Drop|Yank)/.test(e.inputType || "")) { e.preventDefault(); noPasteMsg(); } });
  ta.addEventListener("contextmenu", e => e.preventDefault());
}
function guardCopy() {
  const el = n => (n && n.nodeType === 1 ? n : n && n.parentElement);
  const inLesson = n => { const e = el(n); return Boolean(e && e.closest(".stage") && !e.closest("input, .stdin-box")); };
  ["copy", "cut"].forEach(ev => document.addEventListener(ev, e => { const s = document.getSelection(); if (s && inLesson(s.anchorNode)) { e.preventDefault(); noPasteMsg(); } }));
  document.addEventListener("dragstart", e => { if (inLesson(e.target)) e.preventDefault(); });
}

function updateBugs(c, card, code) {
  if (!c.bugs) return;
  c.bugs.forEach((b, i) => {
    const el = $(`[data-bug="${i}"]`, card), fixed = b.fixed(code);
    if (fixed && !el.classList.contains("dead")) { el.classList.add("dead"); beep("good"); }
    if (!fixed) el.classList.remove("dead");
  });
}

function showRun(out, r, code) {
  const text = r.out ? `<pre class="term-text">${esc(r.out)}</pre>` : (r.ok ? `<span class="muted">(Chương trình chạy xong nhưng không in gì.)</span>` : "");
  out.innerHTML = text + (r.ok ? "" : errorBlock(r.err, code));
  out.classList.toggle("has-err", !r.ok);
}

function firstDiff(a, e) {
  const A = a.split("\n"), E = e.split("\n");
  for (let i = 0; i < Math.max(A.length, E.length); i++) {
    if ((A[i] ?? "") !== (E[i] ?? "")) {
      if (A[i] === undefined) return `Terminal của bạn mới có ${A.length} dòng, cần ${E.length} dòng.`;
      if (E[i] === undefined) return `Terminal của bạn có ${A.length} dòng, chỉ cần ${E.length} dòng.`;
      return `Dòng ${i + 1} chưa khớp:<pre class="diff"><span class="d-you">bạn: ${esc(A[i])}</span>\n<span class="d-need">cần: ${esc(E[i])}</span></pre>`;
    }
  }
  return "";
}

async function checkCode(c, code, currentInput) {
  const tests = c.tests || [{ input: currentInput, expected: c.expected }];
  let last = null;
  for (const [n, t] of tests.entries()) {
    const r = await PyRun.run(code, linesOf(t.input), c.seed ?? null);
    last = r;
    const where = tests.length > 1 ? `Ca ${n + 1}${t.input ? ` (nhập ${esc(t.input.replace(/\n/g, " ⏎ "))})` : ""}: ` : "";
    if (!r.ok) return { ok: false, run: r, input: t.input, msg: where + "code chưa chạy được. Đọc phần lỗi trong TERMINAL rồi sửa nhé." };
    if (t.expected != null) {
      const a = normalizeOutput(r.out), e = normalizeOutput(t.expected);
      if (a !== e) return { ok: false, run: r, input: t.input, msg: where + (firstDiff(a, e) || "Terminal chưa khớp mẫu.") };
    }
  }
  for (const rule of c.rules || []) if (!rule.test(code, last.out)) return { ok: false, run: last, msg: rule.msg };
  if (c.bugs && !c.bugs.every(b => b.fixed(code))) return { ok: false, run: last, msg: "Terminal đúng rồi, nhưng vẫn còn bọ trong code. Xem con bọ nào chưa bị hạ." };
  return { ok: true, run: last, msg: c.why || ("Chính xác — terminal khớp mẫu." + (tests.length > 1 ? ` Đạt cả ${tests.length} ca.` : "")) };
}

function attempt(id) { state.attempts[id] = (state.attempts[id] || 0) + 1; save(); }
function nextOpenCard(card) {
  const all = $$(".task", $("#stepContainer")), i = all.indexOf(card);
  return [...all.slice(i + 1), ...all.slice(0, i)].find(el => !el.classList.contains("passed") && !el.classList.contains("advanced") && !el.classList.contains("bonus"));
}

function pass(c, card, msg, btn, starNow = false) {
  if(!state || !PyCloud.allowed())return;
  const first = !state.passed[c.id];
  let extra = "";
  if (first) {
    state.passed[c.id] = true;
    let gain = XP_PASS;
    if (state.attempts[c.id] === 1) { state.combo += 1; gain += XP_FIRST_TRY; if (state.combo >= 2) { gain += state.combo * 2; extra = ` · chuỗi ×${state.combo}`; } }
    else state.combo = 0;
    if (starNow) { gain *= 2; extra += " · Ngôi sao hi vọng: EXP ×2"; }
    state.xp += gain; extra = ` <b>+${gain} EXP</b>${extra}`;
    if (allRequiredDone() && !state.completedAt) state.completedAt = new Date().toISOString();
    saveBadge();
  }
  save();
  card.classList.add("passed");
  $(".task-head h3", card).insertAdjacentHTML("afterbegin", first ? ic("check", "ok") : "");
  $('[data-act="hint"]', card)?.remove();
  const step = activeStep(), nextCard = nextOpenCard(card), stageDone = step.kind !== "gate" && stepDone(step);
  let cta = "";
  if (nextCard) cta = `<button class="mini-cta" type="button" data-go-next>Nhiệm vụ tiếp →</button>`;
  else if (stageDone && step.kind !== "boss" && STEPS[STEPS.indexOf(step) + 1]) cta = `<button class="mini-cta" type="button" data-go-step>${nextLabel(STEPS[STEPS.indexOf(step) + 1])}</button>`;
  result(card, "good", msg + extra, cta);
  $("[data-go-next]", card)?.addEventListener("click", () => nextCard.scrollIntoView({ block: "start", behavior: "smooth" }));
  $("[data-go-step]", card)?.addEventListener("click", () => go(STEPS[STEPS.indexOf(step) + 1].id));
  const r = btn ? btn.getBoundingClientRect() : null;
  confetti(r ? { x: r.left + r.width / 2, y: r.top } : null, starNow); beep(starNow ? "win" : "good");
  const cheers = ["Chuẩn.", "Gọn gàng!", "Đúng rồi!", "Code sạch đấy.", "Tốt lắm!"];
  nova(`<b>${cheers[Math.floor(Math.random() * cheers.length)]}</b>${extra}`, "happy", 3500);
  updateTop(); renderRail(); if (step.kind !== "gate") refreshFooter(step);
  if (step.kind === "boss" && first && allRequiredDone()) {
    beep("win"); confetti(null, true);
    nova("<b>Boss đã bị hạ.</b> Lưu chứng chỉ để nộp. Còn thời gian thì thử phần Nâng cao để lấy huy hiệu vàng.", "happy");
    if (!c.advanced) setTimeout(openCertificate, 1100);
  }
}
function miss(card, msg) {
  state.combo = 0; save(); updateTop();
  result(card, "bad", msg);
  nova("Chưa khớp — xem dòng ✗ ngay dưới nút và phần TERMINAL nhé.", "oops", 3500);
  beep("bad");
}

/* ---------- huy hiệu & chứng chỉ ---------- */
function saveBadge() {
  if (!allRequiredDone()) return;
  state.badge = isGold() ? "gold" : "silver";
}
function certId() { return `PY10-B${String(L.number).padStart(2, "0")}-${state.student.className}-${hashText(`${state.student.userId}|${L.id}|${state.completedAt}`)}`; }
function openCertificate() {
  if (!allRequiredDone()) return;
  drawCertificate();
  const link = $("#canvasLink"); if (CFG.canvasSubmissionUrl) { link.href = CFG.canvasSubmissionUrl; link.classList.remove("hidden"); }
  const d = $("#certDialog"); if (!d.open) d.showModal();
}
function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}
function fitText(ctx, text, x, y, maxW, size, min, weight = 800) {
  while (size > min) { ctx.font = `${weight} ${size}px "Be Vietnam Pro", Segoe UI, Arial`; if (ctx.measureText(text).width <= maxW) break; size -= 2; }
  ctx.font = `${weight} ${size}px "Be Vietnam Pro", Segoe UI, Arial`; ctx.fillText(text, x, y);
}
function drawCertificate() {
  const cv = $("#certCanvas"), ctx = cv.getContext("2d"), W = cv.width, H = cv.height, gold = isGold();
  const F = (w, s) => `${w} ${s}px "Be Vietnam Pro", Segoe UI, Arial`;
  ctx.fillStyle = "#0E1726"; ctx.fillRect(0, 0, W, H);
  // lưới mờ + dải màu
  ctx.strokeStyle = "rgba(125,182,232,.07)"; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "#3776AB"); g.addColorStop(1, "#6D4AFF");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = "#FFFFFF"; rr(ctx, 70, 70, W - 140, H - 140, 28); ctx.fill();
  // logo
  ctx.fillStyle = "#3776AB"; rr(ctx, 130, 130, 56, 56, 14); ctx.fill(); ctx.fillStyle = "#FFD43B"; rr(ctx, 162, 162, 56, 56, 14); ctx.fill();
  ctx.textAlign = "left"; ctx.fillStyle = "#0E1726"; ctx.font = F(800, 30); ctx.fillText("LSTS Py Studio", 250, 168);
  ctx.fillStyle = "#5A6678"; ctx.font = F(500, 20); ctx.fillText("Lập trình Python · Khối 10", 250, 200);
  // huy hiệu
  ctx.beginPath(); ctx.arc(W - 220, 190, 70, 0, Math.PI * 2); ctx.fillStyle = gold ? "#FFD43B" : "#E3E8EF"; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = gold ? "#A16207" : "#98A3B3"; ctx.stroke();
  ctx.textAlign = "center"; ctx.fillStyle = "#0E1726"; ctx.font = F(900, 40); ctx.fillText(`B${L.number}`, W - 220, 204);
  ctx.font = F(700, 17); ctx.fillStyle = gold ? "#A16207" : "#5A6678"; ctx.fillText(gold ? "HUY HIỆU VÀNG" : "HUY HIỆU BẠC", W - 220, 290);
  // nội dung — chỉ giữ thông tin chính
  ctx.fillStyle = "#3776AB"; ctx.font = F(800, 24); ctx.fillText("CHỨNG CHỈ HOÀN THÀNH", W / 2, 360);
  ctx.fillStyle = "#0E1726"; fitText(ctx, `Bài ${L.number} · ${L.title}`, W / 2, 430, 1100, 52, 30, 800);
  ctx.fillStyle = "#5A6678"; ctx.font = F(500, 24); ctx.fillText("Chứng nhận học sinh", W / 2, 520);
  ctx.fillStyle = "#2B5B84"; fitText(ctx, state.student.name, W / 2, 600, 1100, 62, 34, 800);
  ctx.strokeStyle = "#DEE4EC"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(380, 630); ctx.lineTo(W - 380, 630); ctx.stroke();
  ctx.fillStyle = "#0E1726"; ctx.font = F(700, 28); ctx.fillText(`Lớp ${state.student.className}`, W / 2, 682);
  const date = new Date(state.completedAt || Date.now()).toLocaleDateString("vi-VN");
  ctx.fillStyle = "#5A6678"; ctx.font = F(500, 19); ctx.textAlign = "left";
  ctx.fillText(`Ngày hoàn thành: ${date}`, 130, H - 120); ctx.fillText(`Mã xác nhận: ${certId()}`, 130, H - 92);
  ctx.textAlign = "right";
  ctx.fillText(CFG.schoolName || "Trường THCS và THPT Đinh Thiện Lý", W - 130, H - 120);
  if (CFG.teacherName) ctx.fillText(`Giáo viên: ${CFG.teacherName}`, W - 130, H - 92);
}
function fileSafe(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, ""); }
function savePng() {
  drawCertificate();
  $("#certCanvas").toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `ChungChi-Python10-Bai${L.number}-${fileSafe(state.student.name)}-${state.student.className}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
function printPdf() {
  drawCertificate();
  const data = $("#certCanvas").toDataURL("image/png"), win = window.open("", "_blank");
  if (!win) return alert("Trình duyệt đang chặn cửa sổ in. Cho phép popup rồi thử lại.");
  win.document.write(`<!doctype html><html><head><title>Chứng chỉ Bài ${L.number}</title><style>html,body{margin:0}body{display:grid;place-items:center;min-height:100vh}img{max-width:100%}@page{size:A4 landscape;margin:0}@media print{img{width:100vw}}</style></head><body><img src="${data}"/></body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 300);
}

/* ---------- khởi động ---------- */
function boot() {
  shell();
  PyRun.start();
  load(PYAccount.student());
  $("#studentBtn").addEventListener("click", PYAccount.profile);
  $("#resetBtn").addEventListener("click", PYAccount.profile);
  $("#errorsBtn").addEventListener("click", () => $("#errorsDialog").showModal());
  $("#soundBtn").addEventListener("click", () => { safeSet(`${PREFIX}:sound`, soundOn() ? "off" : "on"); $("#soundBtn").innerHTML = ic(soundOn() ? "sound" : "mute"); });
  $$("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
  $("#savePng").addEventListener("click", savePng);
  $("#printPdf").addEventListener("click", printPdf);
  $(".nova-close").addEventListener("click", () => $("#novaMsg").classList.add("hidden"));
  $("#novaFace").addEventListener("click", () => { const b = $("#novaMsg"); if (b.classList.contains("hidden") && novaLast) b.classList.remove("hidden"); else b.classList.add("hidden"); });
  $("#soundBtn").innerHTML = ic(soundOn() ? "sound" : "mute");
  guardCopy();
  renderAll(true);
  PYAccount.controls();
}

window.PY_ENGINE={
 remoteState(){if(!PyCloud.allowed())return;load(PYAccount.student());renderAll(true)},
 profileChanged(){if(!state||!PyCloud.allowed())return;state.student=PYAccount.student();updateTop()},
 dispose(){PyRun.stop();state=null;}
};
if(PyCloud.allowed())boot();

})();
