/* Game quest 3D — thế giới theo chủ đề bài học. Đọc window.BAI (data.js) + window.QUEST.
 *
 * Mỗi chặng là một trạm trong thế giới; tới trạm thì mở đúng chặng của trang bài học trong khung nhúng
 * (index.html?nhung=1&chang=i). Qua checkpoint chặng -> trạm sáng xanh, trạm sau mở khoá. Qua hết -> CỔNG
 * checkpoint cuối mở (index.html?nhung=1&cuoi=1) -> chứng chỉ như trang thường.
 * Tiến độ, đáp án, chứng chỉ: KHÔNG làm lại ở đây — do app.js xử lý, lưu cùng khoá localStorage.
 *
 * Điều khiển: WASD / phím mũi tên; E, Enter, Space để vào trạm; kéo chuột để xoay; lăn chuột để gần/xa.
 * Cảm ứng (iPad): chạm-kéo nửa trái = cần điều khiển; chạm vào trạm = tự đi tới; nút "Vào trạm".
 * Âm thanh tự tạo bằng Web Audio (không tải file nhạc). Máy yếu: tự chuyển chế độ nhẹ.
 */
import * as THREE from "three";

const B = window.BAI;
const CFG = Object.assign({ ten: "Thế giới " + B.tieu_de, trang_doc: "index.html",
  mau: "#38BDF8", mau_phu: "#A78BFA", bieu_tuong: "AI", ky_hieu: ["AI", "ML", "∑", "∇"],
  dung_sau_chang: true }, window.QUEST || {});
CFG.ten_dao = CFG.ten_dao || CFG.ten;
const TIEN_TO = B.tien_to_luu || "ml1_";
const LUU = TIEN_TO + B.ma;
const LUU_Q = TIEN_TO + "quest";
const N = B.chang.length;
const IT_CHUYEN_DONG = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CAM_UNG = matchMedia("(pointer: coarse)").matches;
const R_DAO = 25;
document.documentElement.style.setProperty("--q-tuoi", CFG.mau);
document.documentElement.style.setProperty("--q-vang", CFG.mau_phu);

// ------------------------------------------------------------------ lưu trữ
function doc(k, md) { try { return JSON.parse(localStorage.getItem(k)) || md; } catch (e) { return md; } }
function luu(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* chế độ ẩn danh */ } }
let TT = doc(LUU, {});
const QS = Object.assign({ am: true, chat_luong: "tu_dong" }, doc(LUU_Q, {}));
function luuQS() { luu(LUU_Q, QS); }
function qua() { return TT.qua || 0; }
function passed(i) { return Array.isArray(TT.passedStages) ? TT.passedStages.includes(i) : i < qua(); }

// ------------------------------------------------------------------ DOM
function h(tag, at, con) {
  const e = document.createElement(tag);
  for (const k in at || {}) {
    if (k === "text") e.textContent = at[k];
    else if (k === "html") e.innerHTML = at[k];
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), at[k]);
    else e.setAttribute(k, at[k]);
  }
  (con || []).forEach(c => c && e.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return e;
}
const ICON = {
  loa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  tat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  dong: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};
const goc = document.getElementById("quest");

// ------------------------------------------------------------------ WebGL
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
} catch (e) {
  document.body.appendChild(h("div", { class: "q-loi" }, [h("div", { class: "q-the", style: "padding:24px;max-width:480px" }, [
    h("h2", { text: "Máy này chưa chạy được đồ hoạ 3D" }),
    h("p", { text: "Em vẫn học đủ các chặng ở trang bài học dạng đọc; tiến độ và chứng chỉ được dùng chung." }),
    h("a", { class: "q-vao", href: CFG.trang_doc, style: "display:inline-grid;place-items:center;text-decoration:none", text: "Mở trang bài học" })])]));
  throw e;
}
window.__questOK = true;
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
goc.appendChild(renderer.domElement);
renderer.domElement.setAttribute("tabindex", "0");
renderer.domElement.setAttribute("aria-label", "Thế giới 3D " + CFG.ten_dao + ". Dùng phím mũi tên để đi, E để vào trạm.");

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#101A39", 65, 190);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);

// ------------------------------------------------------------------ vật liệu, tiện ích
const vl = (mau, them) => new THREE.MeshStandardMaterial(Object.assign({ color: mau, flatShading: true, roughness: 0.85 }, them || {}));
function rngHat(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = rngHat(B.bai * 9973 + 17);
function bong(m) { m.castShadow = true; m.receiveShadow = true; return m; }
function viTri(goc_do, r) { const a = goc_do * Math.PI / 180; return new THREE.Vector3(r * Math.cos(a), 0, -r * Math.sin(a)); }

// chữ trên canvas -> texture (chờ font để chữ tiếng Việt đẹp)
function veChu(w, hh, ve) {
  const c = document.createElement("canvas"); c.width = w; c.height = hh;
  const g = c.getContext("2d"); ve(g, w, hh);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function hopTron(g, x, y, w, hh, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, hh, r) : g.rect(x, y, w, hh); }
const FONT = '"Be Vietnam Pro", "Segoe UI", sans-serif';

// ------------------------------------------------------------------ trời, ánh sáng, mây
const troi = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { tren: { value: new THREE.Color("#0B1430") }, giua: { value: new THREE.Color("#264C84") }, duoi: { value: new THREE.Color("#5677A8") } },
  vertexShader: "varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: "uniform vec3 tren; uniform vec3 giua; uniform vec3 duoi; varying vec3 p; void main(){ float y = normalize(p).y;" +
    " vec3 c = y > 0. ? mix(giua, tren, pow(y, .55)) : duoi; gl_FragColor = vec4(c, 1.); }",
}));
scene.add(troi);
scene.add(new THREE.HemisphereLight("#B9D9FF", "#15264C", 1.5));
const mat_troi = new THREE.DirectionalLight("#E8F2FF", 2.0);
mat_troi.position.set(28, 48, 22);
mat_troi.castShadow = true;
mat_troi.shadow.mapSize.set(2048, 2048);
Object.assign(mat_troi.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 5, far: 120 });
mat_troi.shadow.bias = -0.0006;
scene.add(mat_troi);

const may = new THREE.Group();
for (let i = 0; i < 9; i++) {
  const dam = new THREE.Group();
  for (let j = 0; j < 4; j++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2 + rnd() * 1.8, 0), vl("#A8C8FF", { roughness: 1, emissive: "#5070B0", emissiveIntensity: 0.1 }));
    s.position.set(j * 2.6 - 4, rnd() * 1.2, rnd() * 1.6);
    dam.add(s);
  }
  const a = rnd() * Math.PI * 2, r = 60 + rnd() * 60;
  dam.position.set(Math.cos(a) * r, 22 + rnd() * 14, Math.sin(a) * r);
  dam.userData.v = 0.4 + rnd() * 0.6;
  may.add(dam);
}
scene.add(may);

// ------------------------------------------------------------------ nền cảnh và đường đi giữa các trạm
const CANH = CFG.kieu || "network";
const DO_THI = new Set(["factory", "code", "tools", "statistics", "charts", "linear", "time", "deploy"]);
const RUNG = new Set(["clean", "tree", "forest", "neighbors", "cluster", "reward"]);
const mauNen = DO_THI.has(CANH) ? "#111D36" : RUNG.has(CANH) ? "#12312F" : "#15243E";
const sanNgoai = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), vl(mauNen, { metalness: 0.12, roughness: 0.9 }));
sanNgoai.rotation.x = -Math.PI / 2; sanNgoai.position.y = -1.25; sanNgoai.receiveShadow = true; scene.add(sanNgoai);
const luoiPho = new THREE.GridHelper(360, 72, "#37629B", "#203451");
luoiPho.position.y = -1.23; scene.add(luoiPho);
function thanhPho() {
  const g = new THREE.Group();
  const san = new THREE.Mesh(new THREE.CylinderGeometry(R_DAO, R_DAO, 1.2, 72), vl(RUNG.has(CANH) ? "#294C45" : DO_THI.has(CANH) ? "#182B4C" : "#293451", { metalness: 0.25, roughness: 0.72 }));
  san.position.y = -0.6; san.receiveShadow = true; g.add(san);
  const vien = new THREE.Mesh(new THREE.TorusGeometry(R_DAO - 0.3, 0.14, 8, 72),
    new THREE.MeshBasicMaterial({ color: CFG.mau }));
  vien.rotation.x = Math.PI / 2; vien.position.y = 0.07; g.add(vien);
  const duong = new THREE.Mesh(new THREE.RingGeometry(12.6, 15.0, 72), vl("#2B3C59", { metalness: 0.45 }));
  duong.rotation.x = -Math.PI / 2; duong.position.y = 0.025; duong.receiveShadow = true; g.add(duong);
  for (const r of [12.7, 14.9]) {
    const den = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.09, 72), new THREE.MeshBasicMaterial({ color: CFG.mau, side: THREE.DoubleSide }));
    den.rotation.x = -Math.PI / 2; den.position.y = 0.036; g.add(den);
  }
  const qt = new THREE.Mesh(new THREE.CircleGeometry(4.7, 48), vl("#263B60", { metalness: 0.5 }));
  qt.rotation.x = -Math.PI / 2; qt.position.y = 0.04; qt.receiveShadow = true; g.add(qt);
  const tam = new THREE.Mesh(new THREE.RingGeometry(4.4, 4.55, 48), new THREE.MeshBasicMaterial({ color: CFG.mau_phu, side: THREE.DoubleSide }));
  tam.rotation.x = -Math.PI / 2; tam.position.y = 0.05; g.add(tam);
  for (const [z0, z1] of [[4.4, 22], [-4.4, -17]]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(3, Math.abs(z1 - z0)), vl("#2B3C59", { metalness: 0.4 }));
    d.rotation.x = -Math.PI / 2; d.position.set(0, 0.03, (z0 + z1) / 2); d.receiveShadow = true; g.add(d);
    for (const x of [-1.36, 1.36]) {
      const vach = new THREE.Mesh(new THREE.PlaneGeometry(0.08, Math.abs(z1 - z0)), new THREE.MeshBasicMaterial({ color: CFG.mau, side: THREE.DoubleSide }));
      vach.rotation.x = -Math.PI / 2; vach.position.set(x, 0.045, (z0 + z1) / 2); g.add(vach);
    }
  }
  return g;
}
scene.add(thanhPho());

// Cảnh nền: đô thị có nhà, các chủ đề còn lại có công trình theo hình thái riêng.
const toaNha = new THREE.Group();
for (let i = 0; i < (DO_THI.has(CANH) ? 68 : 0); i++) {
  const a = (i / 76) * Math.PI * 2 + (rnd() - 0.5) * 0.05;
  const r = 34 + rnd() * 68, w = 3 + rnd() * 6, h = 10 + rnd() * 33;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (0.8 + rnd() * 0.5)),
    vl(i % 4 === 0 ? "#1C3154" : "#152742", { metalness: 0.25, roughness: 0.7 }));
  tower.position.set(x, h / 2 - 1, z); tower.castShadow = i < 22; toaNha.add(tower);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.12, w + 0.12), new THREE.MeshBasicMaterial({ color: i % 3 ? CFG.mau : CFG.mau_phu }));
  crown.position.set(x, h - 0.9, z); toaNha.add(crown);
  if (i % 2 === 0) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.65, 0.08), new THREE.MeshBasicMaterial({ color: CFG.mau }));
    strip.position.set(x + w / 2 + 0.05, h * 0.42, z + w / 2 + 0.05); toaNha.add(strip);
  }
}
scene.add(toaNha);

const CANH_CHUYEN = [];
function canhChuDe() {
  const g = new THREE.Group(); scene.add(g);
  const light = new THREE.MeshBasicMaterial({ color: CFG.mau });
  const pale = new THREE.MeshBasicMaterial({ color: CFG.mau_phu });
  const sphere = new THREE.SphereGeometry(0.7, 12, 8);
  for (let i = 0; i < (DO_THI.has(CANH) ? 10 : 26); i++) {
    const a = i * Math.PI * 2 / (DO_THI.has(CANH) ? 10 : 26), r = 36 + (i % 3) * 7;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (RUNG.has(CANH)) {
      // Cây thấp đa giác, cụm điểm hoặc vòng thưởng tùy bài.
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2.6,6),vl("#496B5C"));trunk.position.set(x,.2,z);g.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(CANH === "forest" ? 1.9 : 1.3, CANH === "forest" ? 4.4 : 3.1, 6),
        vl(i%2 ? CFG.mau : "#4D9A7F",{emissive:CFG.mau,emissiveIntensity:.08}));crown.position.set(x,3.0,z);g.add(crown);
      if (CANH === "cluster" || CANH === "neighbors") {
        for (let j=0;j<3;j++){const dot=new THREE.Mesh(new THREE.IcosahedronGeometry(.35,0),j%2?light:pale);dot.position.set(x+(j-1)*1.2,1.1+j*.4,z+(j%2)*1.2);g.add(dot);}
      }
    } else if (!DO_THI.has(CANH)) {
      const h = 2.5+(i%4)*1.2;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.25,.4,h,6),vl("#3D5478"));pillar.position.set(x,h/2-1,z);g.add(pillar);
      const ball = new THREE.Mesh(sphere,i%2?light:pale);ball.position.set(x,h-.2,z);g.add(ball);
      if (CANH === "boundary" || CANH === "vector" || CANH === "correlation") {
        const arrow = new THREE.Mesh(new THREE.ConeGeometry(.4,1.1,6),light);arrow.position.set(x,h+1,z);arrow.rotation.z=Math.PI/4;g.add(arrow);
      }
    }
  }
  // Công trình giữa nền cho mỗi nhóm nội dung: nhìn rõ ngay từ màn bắt đầu.
  const a = CFG.bai || B.bai;
  if (["statistics","charts","linear","time","evaluate"].includes(CANH)) {
    for(let k=0;k<7;k++){const h=3+((k*3+a)%7)*1.3;const bar=new THREE.Mesh(new THREE.BoxGeometry(1.2,h,1.2),vl(k%2?CFG.mau:CFG.mau_phu,{emissive:CFG.mau,emissiveIntensity:.15}));bar.position.set(-9+k*3,h/2,-34);g.add(bar);}
  } else if (["network","neural","labels","bayes","cluster"].includes(CANH)) {
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){const node=new THREE.Mesh(new THREE.IcosahedronGeometry(.65,1),row===2?pale:light);node.position.set(-5+col*5,2+row*2,-34);g.add(node);CANH_CHUYEN.push({mesh:node,base:node.position.y,phase:row*3+col});}
  } else if (["vector","boundary","logistic","correlation"].includes(CANH)) {
    const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.22,8,36),light);ring.position.set(0,9,-34);ring.rotation.x=.35;g.add(ring);CANH_CHUYEN.push({mesh:ring,spin:true});
    for(let k=0;k<5;k++){const dot=new THREE.Mesh(sphere,k%2?light:pale);dot.position.set(-6+k*3,3+k%2*2,-34);g.add(dot);}
  } else if (["tree","forest","clean","reward"].includes(CANH)) {
    for(let k=0;k<5;k++){const x=-9+k*4.5,h=4+(k%3)*1.5;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.3,.5,h,6),vl("#416458"));trunk.position.set(x,h/2,-34);g.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.7,h*.85,7),vl(CFG.mau,{emissive:CFG.mau,emissiveIntensity:.08}));crown.position.set(x,h+1,-34);g.add(crown);}
  } else {
    for(let k=0;k<4;k++){const h=5+(k%2)*2;const tower=new THREE.Mesh(new THREE.BoxGeometry(3,h,3),vl("#31516A"));tower.position.set(-7+k*4.5,h/2,-34);g.add(tower);const cap=new THREE.Mesh(new THREE.BoxGeometry(3.3,.22,3.3),k%2?light:pale);cap.position.set(-7+k*4.5,h+.2,-34);g.add(cap);}
  }
}
canhChuDe();

// ------------------------------------------------------------------ vật cản (va chạm hình tròn)
const VAT_CAN = [];
function vatCan(x, z, r) { VAT_CAN.push({ x, z, r }); }

// ------------------------------------------------------------------ trạm
const GOC_TRAM = (() => {
  const trai = Math.ceil(N / 2), phai = N - trai, ds = [];
  const chia = (a, b, n) => n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  chia(222, 138, trai).forEach(a => ds.push(a));
  chia(42, -42, phai).forEach(a => ds.push(a));
  return ds;
})();
const MAU_TT = { khoa: "#94A3B8", mo: "#38BDF8", xong: "#22C55E" };
const TRAM = [];

function nhanTram(i, tt) {
  const c = B.chang[i];
  return veChu(640, 190, (g, w, hh) => {
    hopTron(g, 6, 6, w - 12, hh - 12, 34); g.fillStyle = "rgba(11,21,38,0.86)"; g.fill();
    g.lineWidth = 6; g.strokeStyle = MAU_TT[tt]; g.stroke();
    g.fillStyle = MAU_TT[tt]; g.font = "700 38px " + FONT; g.textBaseline = "middle";
    g.fillText("CHẶNG " + (i + 1) + (tt === "xong" ? "  ✓ XONG" : tt === "khoa" ? "  · KHOÁ" : "  · ĐANG MỞ"), 36, 58);
    g.fillStyle = "#F8FAFC"; g.font = "700 50px " + FONT;
    let t = c.ten_ngan || c.ten;
    while (g.measureText(t).width > w - 72 && t.length > 4) t = t.slice(0, -2) + "…";
    g.fillText(t, 36, 128);
  });
}
function manHinhTram(i) {
  return veChu(512, 320, (g, w, hh) => {
    const laThongKe = ["statistics","charts","linear","time","evaluate"].includes(CANH);
    g.fillStyle = "#071426"; g.fillRect(0, 0, w, hh);
    g.fillStyle = "#162F50"; g.fillRect(0, 0, w, 54);
    g.fillStyle = CFG.mau; g.fillRect(0, 51, w, 3);
    g.fillStyle = "#F8FAFC"; g.font = "700 30px " + FONT; g.textBaseline = "middle";
    g.fillText("TRẠM " + (i + 1) + "  ·  " + (B.chang[i].ten_ngan || B.chang[i].ten).toUpperCase(), 22, 29, w - 44);
    g.strokeStyle = "rgba(125,190,240,.22)"; g.lineWidth = 2;
    for (let x = 30; x < w; x += 56) { g.beginPath(); g.moveTo(x, 76); g.lineTo(x, 292); g.stroke(); }
    for (let y = 85; y < hh; y += 45) { g.beginPath(); g.moveTo(24, y); g.lineTo(w - 24, y); g.stroke(); }
    g.strokeStyle = CFG.mau; g.fillStyle = CFG.mau; g.lineWidth = 7;
    if (laThongKe) {
      const cao = [[95, 160, 115, 205, 130], [135, 80, 210, 115, 160], [190, 120, 155, 80, 205], [60, 125, 175, 215, 130], [115, 185, 90, 205, 150]][i % 5];
      cao.forEach((v, j) => { g.globalAlpha = 0.55 + j * 0.08; g.fillRect(55 + j * 88, 286 - v, 48, v); });
      g.globalAlpha = 1;
      g.fillStyle = "#D5E8FF"; g.font = "600 25px " + FONT; g.fillText("ĐỌC DỮ LIỆU  →  RÚT KẾT LUẬN", 36, 297);
    } else {
      const pts = [[45, 255], [128, 212], [205, 174], [290, 131], [385, 94], [470, 75]];
      g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      pts.forEach(p => { g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = CFG.mau_phu; g.lineWidth = 3; g.beginPath(); g.moveTo(55, 256); g.lineTo(275, 116); g.stroke();
      g.fillStyle = "#D5E8FF"; g.font = "600 27px " + FONT; g.fillText((CFG.ky_hieu || []).slice(0,3).join("  ·  ").toUpperCase(), 30, 298, w - 60);
    }
  });
}
function robotNho(mau) {
  const g = new THREE.Group();
  const than = bong(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), vl(mau, { roughness: 0.5 })));
  than.position.y = 0.75; g.add(than);
  const dau = bong(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.5), vl("#F1F5F9", { roughness: 0.4 })));
  dau.position.y = 1.45; g.add(dau);
  const mat = new THREE.MeshBasicMaterial({ color: "#38BDF8" });
  for (const x of [-0.14, 0.14]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat); e.position.set(x, 1.48, 0.26); g.add(e); }
  const ang = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3), vl("#475569"));
  ang.position.y = 1.83; g.add(ang);
  const bi = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: "#FBBF24" }));
  bi.position.y = 2.0; g.add(bi);
  for (const x of [-0.18, 0.18]) { const c = bong(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.2), vl("#334155"))); c.position.set(x, 0.2, 0); g.add(c); }
  return g;
}
function taoTram(i) {
  const p = viTri(GOC_TRAM[i], 13.8);
  const g = new THREE.Group(); g.position.copy(p); g.lookAt(0, 0, 0);
  const nen = bong(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.6, 0.5, 6), vl("#CBD5E1")));
  nen.position.y = 0.25; g.add(nen);
  const vong = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.05, 6), new THREE.MeshBasicMaterial({ color: MAU_TT.khoa, transparent: true, opacity: 0.9 }));
  vong.rotation.x = -Math.PI / 2; vong.rotation.z = Math.PI / 6; vong.position.y = 0.52; g.add(vong);
  const cot = bong(new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), vl("#475569")));
  cot.position.set(0, 1.3, -0.9); g.add(cot);
  const vo = bong(new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.45, 0.22), vl("#1E293B")));
  vo.position.set(0, 2.6, -0.9); vo.rotation.x = -0.12; g.add(vo);
  const man = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), new THREE.MeshBasicMaterial({ map: manHinhTram(i), toneMapped: false }));
  man.position.set(0, 2.6, -0.775); man.rotation.x = -0.12; g.add(man);
  const tinh_the = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), vl(MAU_TT.khoa, { emissive: MAU_TT.khoa, emissiveIntensity: 0.6, roughness: 0.3 }));
  tinh_the.position.set(0, 4.25, -0.9); tinh_the.castShadow = true; g.add(tinh_the);
  const rb = robotNho("#00599C"); rb.position.set(1.55, 0.5, -0.1); rb.rotation.y = -0.5; g.add(rb);
  const nhan = new THREE.Sprite(new THREE.SpriteMaterial({ map: nhanTram(i, "khoa"), depthTest: false, transparent: true }));
  nhan.scale.set(4.6, 1.37, 1); nhan.position.set(0, 6.0, -0.9); nhan.renderOrder = 10; g.add(nhan);
  const cham = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 6, 12), new THREE.MeshBasicMaterial({ visible: false }));
  cham.position.y = 3; cham.userData.tram = i; g.add(cham);
  scene.add(g);
  vatCan(p.x, p.z, 2.7);
  return { i, g, vong, tinh_the, nhan, rb, cham, p, tt: "", cho_dung: p.clone().multiplyScalar(0.72) };
}
for (let i = 0; i < N; i++) TRAM.push(taoTram(i));

// ------------------------------------------------------------------ cổng checkpoint cuối
const CONG = (() => {
  const g = new THREE.Group(); g.position.set(0, 0, -19.5);
  const da = vl("#64748B", { roughness: 0.7 });
  for (const x of [-3.1, 3.1]) {
    const c = bong(new THREE.Mesh(new THREE.BoxGeometry(1.3, 6.4, 1.3), da)); c.position.set(x, 3.2, 0); g.add(c);
    const d = bong(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), vl("#475569"))); d.position.set(x, 0.25, 0); g.add(d);
    vatCan(x, -19.5, 1.1);
  }
  const tren = bong(new THREE.Mesh(new THREE.BoxGeometry(8.2, 1.1, 1.6), vl("#00599C", { roughness: 0.5 })));
  tren.position.y = 6.9; g.add(tren);
  const chu = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 0.95), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false,
    map: veChu(1024, 128, (c, w, hh) => { c.fillStyle = "#FFFFFF"; c.font = "700 64px " + FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("CHECKPOINT CUỐI", w / 2, hh / 2 + 4); }) }));
  chu.position.set(0, 6.9, 0.81); g.add(chu);
  const cong_mat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { t: { value: 0 }, mo: { value: 0 } },
    vertexShader: "varying vec2 v; void main(){ v = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: "uniform float t; uniform float mo; varying vec2 v; void main(){ vec2 p = v - .5; float r = length(p * vec2(1., .85));" +
      " float a = atan(p.y, p.x); float s = sin(a * 5. + t * 2. - r * 18.) * .5 + .5; vec3 c1 = vec3(.0,.35,.61); vec3 c2 = vec3(.22,.74,.97);" +
      " vec3 c = mix(c1, c2, s) + vec3(1.,.85,.4) * smoothstep(.12,.0,r) * mo; float al = smoothstep(.62,.45,r) * (.35 + .6 * mo);" +
      " gl_FragColor = vec4(mix(vec3(.55,.6,.68), c, .25 + .75 * mo), al); }",
  });
  const cua = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 6.2), cong_mat);
  cua.position.set(0, 3.2, 0); g.add(cua);
  const song = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const b = bong(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6.2, 6), vl("#334155", { metalness: 0.5, roughness: 0.4 })));
    b.position.set(-2.1 + k * 0.84, 3.2, 0.3); song.add(b);
  }
  g.add(song);
  const nhan = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  nhan.scale.set(5.6, 1.35, 1); nhan.position.set(0, 9.0, 0); nhan.renderOrder = 10; g.add(nhan);
  const cham = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 3), new THREE.MeshBasicMaterial({ visible: false }));
  cham.position.y = 4; cham.userData.cong = true; g.add(cham);
  scene.add(g);
  return { g, cong_mat, song, nhan, cham, p: new THREE.Vector3(0, 0, -19.5), cho_dung: new THREE.Vector3(0, 0, -15.2), tt: "" };
})();
function nhanCong(tt) {
  return veChu(760, 180, (g, w, hh) => {
    hopTron(g, 6, 6, w - 12, hh - 12, 34); g.fillStyle = "rgba(11,21,38,0.86)"; g.fill();
    g.lineWidth = 6; g.strokeStyle = tt === "mo" ? "#FBBF24" : tt === "xong" ? "#22C55E" : "#94A3B8"; g.stroke();
    g.textBaseline = "middle"; g.fillStyle = g.strokeStyle; g.font = "700 36px " + FONT;
    g.fillText(tt === "xong" ? "✓ ĐÃ NHẬN CHỨNG CHỈ" : tt === "mo" ? "CỔNG ĐÃ MỞ" : "CỔNG KHOÁ", 36, 58);
    g.fillStyle = "#F8FAFC"; g.font = "600 38px " + FONT;
    g.fillText(tt === "khoa" && !window.PORTAL_SELF_STUDY ? "Qua đủ " + N + " trạm để mở" : B.cuoi.so_cau + " câu · đạt " + B.cuoi.dat + " nhận chứng chỉ", 36, 124);
  });
}

// ------------------------------------------------------------------ lõi dữ liệu ở quảng trường, biển chào
const TUONG = (() => {
  const g = new THREE.Group();
  const be = bong(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, 1.1, 6), vl("#CBD5E1")));
  be.position.y = 0.55; g.add(be);
  const mat = veChu(512, 512, (c, w, hh) => {
    c.fillStyle = CFG.mau; c.fillRect(0, 0, w, hh);
    c.fillStyle = "#071426"; c.font = "800 205px " + FONT; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(CFG.bieu_tuong, w / 2, hh / 2 + 10);
  });
  mat.center.set(0.5, 0.5); mat.rotation = Math.PI / 2;   // nắp hình trụ đã xoay đứng -> xoay chữ lại cho thẳng
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.35, 6), [vl("#004482", { roughness: 0.4 }),
    new THREE.MeshBasicMaterial({ map: mat, toneMapped: false }), new THREE.MeshBasicMaterial({ map: mat, toneMapped: false })]);
  hex.rotation.x = Math.PI / 2; hex.castShadow = true;
  const quay = new THREE.Group(); quay.add(hex); quay.position.y = 2.9; g.add(quay);
  scene.add(g); vatCan(0, 0, 1.9);
  return quay;
})();
(() => {
  const g = new THREE.Group(); g.position.set(3.4, 0, 19); g.rotation.y = -0.35;
  for (const x of [-1.1, 1.1]) { const c = bong(new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.22), vl("#5B789A", { metalness: 0.7 }))); c.position.set(x, 1.1, 0); g.add(c); }
  const bang = bong(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 0.16), vl("#132C50", { metalness: 0.65 })));
  bang.position.y = 2.0; g.add(bang);
  const chu = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.1), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false,
    map: veChu(600, 220, (c, w, hh) => { c.fillStyle = "#EAFBFF"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = "700 56px " + FONT; c.fillText(CFG.ten_dao, w / 2, 80, w - 20); c.font = "600 35px " + FONT; c.fillText(B.nhan + " · LSTS LEARNING", w / 2, 160, w - 20); }) }));
  chu.position.set(0, 2.0, 0.09); g.add(chu);
  scene.add(g); vatCan(3.4, 19, 1.4);
})();

// ------------------------------------------------------------------ cột dữ liệu và mô-đun công nghệ trong quảng trường
(() => {
  const vi = [];
  for (let k = 0; k < 400 && vi.length < 40; k++) {
    const a = rnd() * Math.PI * 2, r = 5.5 + rnd() * (R_DAO - 7.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(r - 13.8) < 2.4) continue;
    if (Math.abs(x) < 2.8 && (z > 3 || z < -3)) continue;
    if (TRAM.some(t => Math.hypot(t.p.x - x, t.p.z - z) < 4.6)) continue;
    if (Math.hypot(x, z + 19.5) < 6 || Math.hypot(x - 3.4, z - 19) < 3) continue;
    if (vi.some(v => Math.hypot(v[0] - x, v[1] - z) < 2.1)) continue;
    vi.push([x, z, 0.8 + rnd() * 0.7, rnd()]);
  }
  const cay = vi.filter(v => v[3] < 0.82), da = vi.filter(v => v[3] >= 0.82);
  const thanGeo = DO_THI.has(CANH) ? new THREE.BoxGeometry(1.1,2.8,1.1) : new THREE.CylinderGeometry(RUNG.has(CANH)?.18:.12,RUNG.has(CANH)?.28:.2,2.8,6);
  const dauGeo = DO_THI.has(CANH) ? new THREE.BoxGeometry(1.15,.1,1.15) : RUNG.has(CANH) ? new THREE.ConeGeometry(1.15,1.7,6) : new THREE.OctahedronGeometry(.65,0);
  const than = new THREE.InstancedMesh(thanGeo, vl(RUNG.has(CANH)?"#526E5C":"#294668", { metalness: DO_THI.has(CANH)?.7:.3 }), cay.length);
  const la1 = new THREE.InstancedMesh(dauGeo, vl(CFG.mau, { emissive: CFG.mau, emissiveIntensity: 0.45 }), cay.length);
  const la2 = new THREE.InstancedMesh(dauGeo, vl(CFG.mau_phu, { emissive: CFG.mau_phu, emissiveIntensity: 0.45 }), cay.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  cay.forEach(([x, z, k], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    s.set(k, k, k);
    than.setMatrixAt(i, m.compose(p.set(x, 1.4 * k, z), q, s));
    la1.setMatrixAt(i, m.compose(p.set(x, 1.1 * k, z), q, s));
    la2.setMatrixAt(i, m.compose(p.set(x, 2.35 * k, z), q, s));
    vatCan(x, z, 0.75 * k);
  });
  const dg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), vl("#6E82A5", { metalness: 0.6 }), da.length);
  da.forEach(([x, z, k], i) => {
    q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd()));
    dg.setMatrixAt(i, m.compose(p.set(x, 0.35 * k, z), q, s.set(k * 1.2, k * 0.8, k)));
    vatCan(x, z, 0.85 * k);
  });
  for (const im of [than, la1, la2, dg]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }
})();

// ------------------------------------------------------------------ ký hiệu bài học bay lơ lửng
const KY_HIEU = [];
(() => {
  const ds = CFG.ky_hieu;
  ds.forEach((t, k) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0.75, depthWrite: false,
      map: veChu(256, 128, (c, w, hh) => { c.fillStyle = "#FFFFFF"; c.font = "700 64px Consolas, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
        c.shadowColor = "rgba(0,89,156,.8)"; c.shadowBlur = 16; c.fillText(t, w / 2, hh / 2, w - 16); }) }));
    const a = (k / ds.length) * Math.PI * 2 + rnd(), r = R_DAO + 5 + rnd() * 10;
    sp.position.set(Math.cos(a) * r, rnd() * 10, Math.sin(a) * r);
    sp.scale.set(2.4, 1.2, 1);
    sp.userData = { v: 0.4 + rnd() * 0.6, a, r };
    KY_HIEU.push(sp); scene.add(sp);
  });
})();

// ------------------------------------------------------------------ nhân vật Bit
const BIT = (() => {
  const g = new THREE.Group();
  const than = new THREE.Group(); g.add(than);
  const trang = vl("#F1F5F9", { roughness: 0.35, flatShading: false });
  const xanh = vl("#00599C", { roughness: 0.4, flatShading: false });
  const bung = bong(new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 18), trang)); bung.scale.set(1, 1.08, 1); than.add(bung);
  const vanh = bong(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 10, 36), xanh)); vanh.rotation.x = Math.PI / 2; vanh.position.y = -0.05; than.add(vanh);
  // kính mặt: dải cầu ngay ngoài thân, quay về phía trước (+z)
  const kinh = new THREE.Mesh(new THREE.SphereGeometry(0.645, 28, 10, Math.PI / 2 - 1.05, 2.1, 1.02, 0.9),
    new THREE.MeshStandardMaterial({ color: "#0B1526", roughness: 0.15, metalness: 0.3 }));
  kinh.scale.set(1, 1.08, 1); than.add(kinh);
  const mat = new THREE.MeshBasicMaterial({ color: "#5EEAD4" });
  const mat_trai = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.1, 4, 8), mat); mat_trai.position.set(-0.17, 0.12, 0.66); than.add(mat_trai);
  const mat_phai = mat_trai.clone(); mat_phai.position.x = 0.17; than.add(mat_phai);
  for (const x of [-0.64, 0.64]) { const tai = bong(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16), xanh)); tai.rotation.z = Math.PI / 2; tai.position.set(x, 0.12, 0); than.add(tai); }
  const ang = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.38), vl("#475569")); ang.position.y = 0.82; than.add(ang);
  const den = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: "#FBBF24" })); den.position.y = 1.03; than.add(den);
  const lua = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 24), new THREE.MeshBasicMaterial({ color: "#38BDF8", transparent: true, opacity: 0.85 }));
  lua.rotation.x = Math.PI / 2; lua.position.y = -0.7; than.add(lua);
  const bong_dat = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.22, depthWrite: false }));
  bong_dat.rotation.x = -Math.PI / 2; bong_dat.position.y = 0.04;
  scene.add(g); scene.add(bong_dat);
  g.position.set(0, 0, 21);
  g.rotation.y = Math.PI;
  return { g, than, den, lua, bong_dat, mat: [mat_trai, mat_phai] };
})();

// ------------------------------------------------------------------ âm thanh (Web Audio, tự tạo)
const AM = { ctx: null };
function khoiDongAm() {
  if (AM.ctx) { if (AM.ctx.state === "suspended") AM.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  const ctx = AM.ctx = new C();
  AM.tong = ctx.createGain(); AM.tong.gain.value = QS.am ? 0.8 : 0; AM.tong.connect(ctx.destination);
  AM.nhac = ctx.createGain(); AM.nhac.gain.value = 0.16;
  const loc = ctx.createBiquadFilter(); loc.type = "lowpass"; loc.frequency.value = 1500;
  AM.nhac.connect(loc); loc.connect(AM.tong);
  AM.hu = ctx.createGain(); AM.hu.gain.value = 0.9; AM.hu.connect(AM.tong);
  // tiếng động cơ lướt của Bit — to/nhỏ theo tốc độ
  const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 72;
  const lf = ctx.createBiquadFilter(); lf.type = "lowpass"; lf.frequency.value = 260;
  AM.u = ctx.createGain(); AM.u.gain.value = 0;
  o.connect(lf); lf.connect(AM.u); AM.u.connect(AM.hu); o.start();
  AM.u_o = o;
  const HOP = [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]];
  const NGU = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  let t_hop = ctx.currentTime + 0.1, k_hop = 0, t_not = ctx.currentTime + 0.5;
  AM.hen = setInterval(() => {
    if (!AM.ctx || ctx.state !== "running") return;
    while (t_hop < ctx.currentTime + 1.5) {
      HOP[k_hop % 4].forEach((f, j) => not(f / (j === 0 ? 2 : 1), t_hop, 4.2, "triangle", 0.09, AM.nhac, 1.4, 1.6));
      t_hop += 4; k_hop++;
    }
    while (t_not < ctx.currentTime + 1.5) {
      if (rnd() < 0.55) not(NGU[Math.floor(rnd() * NGU.length)], t_not, 0.6, "sine", 0.05, AM.nhac, 0.01, 0.55);
      t_not += 0.5;
    }
  }, 250);
}
function not(f, t0, dai, kieu, vol, dich, len, tat) {
  const ctx = AM.ctx; if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = kieu; o.frequency.value = f;
  len = len || 0.01; tat = tat || dai * 0.8;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + len);
  g.gain.setValueAtTime(vol, Math.max(t0 + len, t0 + dai - tat));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dai);
  o.connect(g); g.connect(dich || AM.hu);
  o.start(t0); o.stop(t0 + dai + 0.05);
}
const SFX = {
  mo() { const t = AM.ctx && AM.ctx.currentTime; if (!t) return; not(660, t, 0.14, "sine", 0.25); not(990, t + 0.08, 0.2, "sine", 0.22); },
  dong() { const t = AM.ctx && AM.ctx.currentTime; if (!t) return; not(880, t, 0.12, "sine", 0.2); not(587, t + 0.07, 0.18, "sine", 0.18); },
  khoa() { const t = AM.ctx && AM.ctx.currentTime; if (!t) return; not(196, t, 0.16, "square", 0.08); not(185, t + 0.14, 0.22, "square", 0.08); },
  qua() { const t = AM.ctx && AM.ctx.currentTime; if (!t) return; [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => not(f, t + k * 0.09, 0.5, "triangle", 0.22)); },
  cong() {
    const ctx = AM.ctx; if (!ctx) return; const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sawtooth";
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(700, t + 1.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1200;
    o.connect(f); f.connect(g); g.connect(AM.hu); o.start(t); o.stop(t + 1.5);
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((ff, k) => not(ff, t + 0.9 + k * 0.1, 0.7, "triangle", 0.2));
  },
  bay() {
    const ctx = AM.ctx; if (!ctx) return; const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 0.5);
    const g = ctx.createGain(); g.gain.value = 0.35;
    s.connect(f); f.connect(g); g.connect(AM.hu); s.start(t);
  },
};
function datAm(bat) {
  QS.am = bat; luuQS();
  if (AM.tong) AM.tong.gain.setTargetAtTime(bat ? 0.8 : 0, AM.ctx.currentTime, 0.05);
  nutAm.innerHTML = bat ? ICON.loa : ICON.tat;
  nutAm.setAttribute("aria-label", bat ? "Tắt âm thanh" : "Bật âm thanh");
  nutAm.title = nutAm.getAttribute("aria-label") + " (M)";
}
function nhacNho(nho) { if (AM.nhac) AM.nhac.gain.setTargetAtTime(nho ? 0.05 : 0.16, AM.ctx.currentTime, 0.3); }

// ------------------------------------------------------------------ HUD
const hud = h("div", { class: "q-hud" });
const tieuDe = h("div", { class: "q-the q-tieu-de" }, [
  h("div", { class: "q-nho", text: CFG.ten_dao.toUpperCase() + " · " + B.nhan.toUpperCase() }),
  h("div", { class: "q-lon", text: B.tieu_de })]);
const hangKhoa = h("div", { class: "q-khoa-hang", "aria-label": "Tiến độ các trạm" });
tieuDe.appendChild(hangKhoa);
const nutAm = h("button", { class: "q-nut", onclick: () => { khoiDongAm(); datAm(!QS.am); } });
const nutMenu = h("button", { class: "q-nut", "aria-label": "Menu", "aria-expanded": "false", html: ICON.menu + '<span class="q-chu-nut">Menu</span>',
  onclick: (e) => { e.stopPropagation(); moMenu(!menu.classList.contains("hien")); } });
hud.append(tieuDe, h("div", { class: "q-nut-hang" }, [nutAm, nutMenu]));
document.body.appendChild(hud);
const menu = h("div", { class: "q-the q-menu", role: "menu" });
document.body.appendChild(menu);
function moMenu(hien) {
  menu.classList.toggle("hien", hien); nutMenu.setAttribute("aria-expanded", String(hien));
  if (!hien) return;
  menu.innerHTML = "";
  menu.appendChild(h("h4", { text: "Dịch chuyển tới" }));
  TRAM.forEach(t => menu.appendChild(h("button", { text: "Trạm " + (t.i + 1) + " · " + (B.chang[t.i].ten_ngan || B.chang[t.i].ten) + (passed(t.i) ? " ✓" : ""),
    onclick: () => { moMenu(false); dichChuyen(t); }, ...(t.i > qua() && !window.PORTAL_SELF_STUDY ? { disabled: "" } : {}) })));
  menu.appendChild(h("button", { text: "Cổng checkpoint cuối", onclick: () => { moMenu(false); dichChuyen(CONG); }, ...(qua() < N && !window.PORTAL_SELF_STUDY ? { disabled: "" } : {}) }));
  menu.appendChild(h("h4", { text: "Hiển thị" }));
  [["tu_dong", "Tự động"], ["cao", "Đẹp (máy mạnh)"], ["nhe", "Nhẹ (máy yếu)"]].forEach(([k, t]) =>
    menu.appendChild(h("button", { class: QS.chat_luong === k ? "chon" : "", text: (QS.chat_luong === k ? "● " : "○ ") + t,
      onclick: () => { QS.chat_luong = k; luuQS(); apChatLuong(k === "nhe" || (k === "tu_dong" && CHAT.nhe_tu_dong)); moMenu(false); } })));
  menu.appendChild(h("h4", { text: "Khác" }));
  menu.appendChild(h("a", { href: CFG.trang_doc, text: "Chế độ đọc (trang bài học thường)" }));
  menu.appendChild(h("button", { text: "Cách điều khiển", onclick: () => { moMenu(false); thongBao(CAM_UNG ?
    "Kéo ở nửa trái màn hình để đi · chạm vào trạm để tự đi tới · bấm nút vàng để vào trạm." :
    "WASD hoặc phím mũi tên để đi · E / Enter để vào trạm · kéo chuột để xoay · lăn chuột để gần/xa · M tắt tiếng.", "", 6000); } }));
}
document.addEventListener("click", (e) => { if (!menu.contains(e.target) && !nutMenu.contains(e.target)) moMenu(false); });

const goiY = h("div", { class: "q-the q-goi-y", role: "status", "aria-live": "polite" });
document.body.appendChild(goiY);
const thongBaoEl = h("div", { class: "q-the q-thong-bao", role: "status", "aria-live": "polite" });
document.body.appendChild(thongBaoEl);
let henTB = null;
function thongBao(txt, loai, ms) {
  thongBaoEl.textContent = txt; thongBaoEl.className = "q-the q-thong-bao hien " + (loai || "");
  clearTimeout(henTB); henTB = setTimeout(() => thongBaoEl.classList.remove("hien"), ms || 3500);
}
const manChuyen = h("div", { class: "q-man-chuyen" });
document.body.appendChild(manChuyen);

function veKhoaHUD() {
  hangKhoa.innerHTML = "";
  for (let i = 0; i < N; i++) {
    const cls = passed(i) ? "xong" : (i === qua() || window.PORTAL_SELF_STUDY) ? "mo" : "";
    hangKhoa.appendChild(h("span", { class: "q-khoa " + cls, title: "Chặng " + (i + 1) + (cls === "xong" ? " — đã qua" : cls === "mo" ? " — đang mở" : " — khoá"),
      text: passed(i) ? "✓" : String(i + 1) }));
  }
  hangKhoa.appendChild(h("span", { class: "q-khoa cuoi " + (TT.dat ? "xong" : qua() >= N ? "mo" : ""), text: TT.dat ? "✓ Chứng chỉ" : "Checkpoint" }));
}

// ------------------------------------------------------------------ trạng thái trạm / cổng
function capNhatTrangThai(vuaDoi) {
  TRAM.forEach(t => {
    const tt = passed(t.i) ? "xong" : (t.i === qua() || window.PORTAL_SELF_STUDY) ? "mo" : "khoa";
    if (tt === t.tt) return;
    t.tt = tt;
    const m = new THREE.Color(MAU_TT[tt]);
    t.vong.material.color.copy(m);
    t.tinh_the.material.color.copy(m); t.tinh_the.material.emissive.copy(m);
    t.tinh_the.material.emissiveIntensity = tt === "khoa" ? 0.15 : 0.9;
    t.nhan.material.map.dispose(); t.nhan.material.map = nhanTram(t.i, tt); t.nhan.material.needsUpdate = true;
    if (vuaDoi && tt === "xong") phaoHoa(t.p.clone().setY(4.2), "#22C55E");
  });
  const ttc = TT.dat ? "xong" : qua() >= N || window.PORTAL_SELF_STUDY ? "mo" : "khoa";
  if (ttc !== CONG.tt) {
    const cu = CONG.tt; CONG.tt = ttc;
    if (CONG.nhan.material.map) CONG.nhan.material.map.dispose();
    CONG.nhan.material.map = nhanCong(ttc); CONG.nhan.material.needsUpdate = true;
    CONG.mo_muc_tieu = ttc === "khoa" ? 0 : 1;
    if (vuaDoi && cu === "khoa" && ttc === "mo") { SFX.cong(); phaoHoa(new THREE.Vector3(0, 7, -19), "#FBBF24"); }
    if (vuaDoi && ttc === "xong") { for (let k = 0; k < 3; k++) setTimeout(() => phaoHoa(new THREE.Vector3((k - 1) * 4, 8 + k, -19), ["#FBBF24", "#38BDF8", "#F472B6"][k]), k * 350); }
  }
  veKhoaHUD();
}
function docLaiTienDo(tuKhung) {
  const cu = { qua: qua(), dat: !!TT.dat, stages:JSON.stringify(TT.passedStages) };
  TT = doc(LUU, {});
  const doi = qua() !== cu.qua || !!TT.dat !== cu.dat || JSON.stringify(TT.passedStages)!==cu.stages;
  capNhatTrangThai(doi);
  if (doi) veGoiY(gan);
  if (!doi || !tuKhung) return;
  if (TT.dat && !cu.dat) { SFX.qua(); thongBao("Em đã đạt checkpoint cuối và nhận chứng chỉ.", "tot", 5000); }
  else if (qua() > cu.qua) {
    SFX.qua();
    thongBao(qua() >= N ? "Em đã qua cả " + N + " trạm — Cổng checkpoint cuối đã mở!" :
      "Đã qua Chặng " + qua() + ". Con có thể chọn trạm tiếp theo hoặc ôn lại.", "tot", 4500);
  }
}

// ------------------------------------------------------------------ pháo hoa (hạt)
const PHAO = [];
const HAT = veChu(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.4, "rgba(255,255,255,.85)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
function phaoHoa(o, mau) {
  const n = IT_CHUYEN_DONG ? 24 : CHAT.nhe ? 40 : 90;
  const geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3), v = [];
  for (let k = 0; k < n; k++) {
    p.set([o.x, o.y, o.z], k * 3);
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = 3 + Math.random() * 5;
    v.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.abs(Math.sin(b)) * s + 2, Math.sin(a) * Math.cos(b) * s));
  }
  geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: mau, size: 0.5, map: HAT, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending }));
  pts.userData = { v, song: 0 }; scene.add(pts); PHAO.push(pts);
}

// ------------------------------------------------------------------ khung bài học (iframe)
const khung = h("div", { class: "q-khung", role: "dialog", "aria-modal": "true" });
const khungTieuDe = h("b");
const khungDong = h("button", { class: "q-nut", html: ICON.dong + '<span class="q-chu-nut">Về thế giới 3D</span>', "aria-label": "Đóng, về thế giới 3D", onclick: () => dongKhung() });
const iframe = h("iframe", { title: "Bài học" });
khung.appendChild(h("div", { class: "q-khung-trong" }, [h("div", { class: "q-khung-dau" }, [khungTieuDe, khungDong]), iframe]));
document.body.appendChild(khung);
let khungMo = false, moLucQua = 0;
function moKhung(src, tieu_de) {
  khungMo = true; khungTieuDe.textContent = tieu_de;
  moLucQua = qua();
  const u=new URL(src,location.href),q=new URLSearchParams(location.search);u.searchParams.set('class',q.get('class'));u.searchParams.set('lesson',q.get('lesson'));u.searchParams.set('personal',q.get('personal')||'0');u.searchParams.set('mode','read');if(q.get('guest')==='1')u.searchParams.set('guest','1');iframe.src=u.href; khung.classList.add("hien");
  SFX.mo(); nhacNho(true); if (AM.u) AM.u.gain.value = 0;
  PHIM.clear(); CAN.hoat = false;
  setTimeout(() => khungDong.focus(), 50);
}
function dongKhung() {
  if (!khungMo) return;
  khungMo = false; khung.classList.remove("hien");
  iframe.src = "about:blank";
  SFX.dong(); nhacNho(false);
  docLaiTienDo(true);
  renderer.domElement.focus();
}
const tamDung = h("div", { class: "q-man an", role: "dialog", "aria-modal": "true" });
const tamDungTieuDe = h("h1");
const tamDungNoiDung = h("p", { class: "q-cau" });
const tamDungNut = h("button", { class: "q-vao", text: "Đã chốt cùng lớp · Tiếp tục →", onclick: () => {
  tamDung.classList.add("an"); dangChoi = true;
  dich = qua() < N ? TRAM[qua()] : CONG;
  renderer.domElement.focus();
} });
tamDung.appendChild(h("div", { class: "q-the" }, [
  h("div", { class: "q-nho", text: "DỪNG SAU CHECKPOINT" }), tamDungTieuDe, tamDungNoiDung,
  h("div", { class: "q-hang" }, [tamDungNut])
]));
document.body.appendChild(tamDung);
function dungDeThaoLuan(chang) {
  dangChoi = false; PHIM.clear(); CAN.hoat = false;
  tamDungTieuDe.textContent = "Đã hoàn thành Chặng " + chang;
  tamDungNoiDung.textContent = "Dừng tại đây. Quay về slide để trao đổi với lớp và ghi bài. " +
    (chang < N ? "Khi giáo viên cho phép, em mới đi tiếp tới Chặng " + (chang + 1) + "." :
      "Khi giáo viên cho phép, em mới mở checkpoint cuối.");
  tamDung.classList.remove("an"); tamDungNut.focus();
}
window.addEventListener("message", (e) => {
  if (e.source !== iframe.contentWindow || (location.origin !== "null" && e.origin !== location.origin)) return;
  const d = e.data || {};
  if (d.ma !== B.ma) return;
  if (d.loai === "tien_do") docLaiTienDo(true);
  if (d.loai === "dong") {
    dongKhung();
    if (CFG.dung_sau_chang && d.vua_xong && qua() > moLucQua) dungDeThaoLuan(d.vua_xong);
    else if (d.tiep) dich = qua() < N ? TRAM[qua()] : CONG;
  }
});
window.addEventListener("storage", (e) => { if (e.key === LUU) docLaiTienDo(true); });

function vaoTram(t) {
  if (t === CONG) {
    if (qua() < N && !window.PORTAL_SELF_STUDY) { SFX.khoa(); thongBao("Cổng còn khoá — qua đủ " + N + " trạm trước nhé.", "xau"); return; }
    moKhung(CFG.trang_doc + "?nhung=1&cuoi=1", "Checkpoint cuối — " + B.cuoi.so_cau + " câu, đạt " + B.cuoi.dat + " nhận chứng chỉ");
    return;
  }
  if (t.i > qua() && !window.PORTAL_SELF_STUDY) { SFX.khoa(); thongBao("Trạm " + (t.i + 1) + " còn khoá — qua Chặng " + (qua() + 1) + " trước nhé.", "xau"); return; }
  moKhung(CFG.trang_doc + "?nhung=1&dung_sau_chang=" + (CFG.dung_sau_chang ? "1" : "0") + "&chang=" + t.i,
    "Chặng " + (t.i + 1) + " · " + B.chang[t.i].ten);
}

// ------------------------------------------------------------------ điều khiển
const PHIM = new Set();
const CAN = { hoat: false, id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
const canEl = h("div", { class: "q-can" }, [h("i")]);
document.body.appendChild(canEl);
if (CAM_UNG) document.body.appendChild(h("div", { class: "q-can-goi-y", text: "Kéo ở đây để đi" }));
const camXaMacDinh = () => innerWidth / innerHeight < 0.8 ? 17 : 13;   // màn hình dọc (iPad dọc, điện thoại): lùi xa hơn
let camYaw = 0, camXa = camXaMacDinh(), dich = null;

addEventListener("keydown", (e) => {
  if (khungMo) { if (e.key === "Escape") dongKhung(); return; }
  if (manDau && !manDau.classList.contains("an")) return;
  const k = e.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  if (k === "e" || k === "enter" || k === " ") { if (gan) vaoTram(gan); return; }
  if (k === "m") { khoiDongAm(); datAm(!QS.am); return; }
  if (k === "escape") { moMenu(false); return; }
  PHIM.add(k); dich = null;
});
addEventListener("keyup", (e) => PHIM.delete(e.key.toLowerCase()));
addEventListener("blur", () => PHIM.clear());

const cv = renderer.domElement;
const keo = { id: null, x: 0, y: 0, di: 0 };
const ray = new THREE.Raycaster(), chuot = new THREE.Vector2();
function batCon(id) { try { cv.setPointerCapture(id); } catch (e) { /* trình duyệt cũ */ } }
cv.addEventListener("pointerdown", (e) => {
  khoiDongAm();
  if (e.pointerType === "touch" && e.clientX < innerWidth * 0.45 && !CAN.hoat) {
    Object.assign(CAN, { hoat: true, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
    canEl.style.left = e.clientX + "px"; canEl.style.top = e.clientY + "px"; canEl.classList.add("hien");
    canEl.firstChild.style.transform = ""; dich = null;
    batCon(e.pointerId); return;
  }
  Object.assign(keo, { id: e.pointerId, x: e.clientX, y: e.clientY, di: 0 });
  batCon(e.pointerId);
});
cv.addEventListener("pointermove", (e) => {
  if (CAN.hoat && e.pointerId === CAN.id) {
    let dx = e.clientX - CAN.x0, dy = e.clientY - CAN.y0; const l = Math.hypot(dx, dy), m = 52;
    if (l > m) { dx *= m / l; dy *= m / l; }
    CAN.dx = dx / m; CAN.dy = dy / m;
    canEl.firstChild.style.transform = "translate(" + dx + "px," + dy + "px)"; return;
  }
  if (e.pointerId !== keo.id) return;
  const dx = e.clientX - keo.x; keo.di += Math.abs(dx) + Math.abs(e.clientY - keo.y);
  keo.x = e.clientX; keo.y = e.clientY;
  if (keo.di > 6) camYaw -= dx * 0.006;
});
function thaTay(e) {
  if (CAN.hoat && e.pointerId === CAN.id) { CAN.hoat = false; CAN.dx = CAN.dy = 0; canEl.classList.remove("hien"); return; }
  if (e.pointerId !== keo.id) return;
  keo.id = null;
  if (keo.di > 8 || e.type === "pointercancel") return;
  // chạm/nhấp: vào trạm (nếu đang đứng gần) hoặc tự đi tới trạm đó
  chuot.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(chuot, camera);
  const hit = ray.intersectObjects([...TRAM.map(t => t.cham), CONG.cham], false)[0];
  if (!hit) return;
  const t = hit.object.userData.cong ? CONG : TRAM[hit.object.userData.tram];
  if (gan === t) vaoTram(t); else dich = t;
}
cv.addEventListener("pointerup", thaTay);
cv.addEventListener("pointercancel", thaTay);
cv.addEventListener("wheel", (e) => { e.preventDefault(); camXa = Math.min(20, Math.max(8, camXa + e.deltaY * 0.01)); }, { passive: false });

function dichChuyen(t) {
  manChuyen.classList.add("hien"); SFX.bay();
  setTimeout(() => {
    BIT.g.position.set(t.cho_dung.x, 0, t.cho_dung.z);
    BIT.g.rotation.y = Math.atan2(t.p.x - t.cho_dung.x, t.p.z - t.cho_dung.z);
    camYaw = Math.atan2(-(t.p.x - t.cho_dung.x), -(t.p.z - t.cho_dung.z));
    datCamera(1); dich = null;
    manChuyen.classList.remove("hien");
  }, 260);
}

// ------------------------------------------------------------------ lời nhắc khi đứng gần trạm
let gan = null;
function veGoiY(t) {
  if (!t) { goiY.classList.remove("hien"); return; }
  goiY.innerHTML = "";
  let nho, lon, mo, nut, vao_dc;
  if (t === CONG) {
    vao_dc = qua() >= N || window.PORTAL_SELF_STUDY;
    nho = TT.dat ? "ĐÃ NHẬN CHỨNG CHỈ" : vao_dc ? "CỔNG ĐÃ MỞ" : "CỔNG KHOÁ";
    lon = "Checkpoint cuối";
    mo = vao_dc ? B.cuoi.so_cau + " câu, đạt " + B.cuoi.dat + " câu nhận chứng chỉ. Làm lại không giới hạn, mỗi lần là đề mới." :
      window.PORTAL_SELF_STUDY?"Thử sức với checkpoint cuối bất kỳ lúc nào.":"Qua đủ " + N + " trạm để mở cổng. Em đã qua " + qua() + "/" + N + ".";
    nut = TT.dat ? "Xem chứng chỉ" : "Vào làm bài";
  } else {
    const c = B.chang[t.i];
    vao_dc = t.i <= qua() || window.PORTAL_SELF_STUDY;
    nho = "CHẶNG " + (t.i + 1) + " / " + N + " · khoảng " + c.phut + " phút" + (passed(t.i) ? " · ✓ đã qua" : "");
    lon = c.ten;
    mo = vao_dc ? (c.khoi_dong ? "Robot hỏi: " + c.khoi_dong.replace(/<[^>]+>/g, "") : c.muc_tieu) :
      "Trạm còn khoá — qua Chặng " + (qua() + 1) + " trước nhé.";
    nut = passed(t.i) ? "Ôn lại chặng" : "Vào trạm";
  }
  goiY.append(h("div", { class: "q-nho", text: nho }), h("div", { class: "q-lon", text: lon }), h("p", { text: mo }));
  const b = h("button", { class: "q-vao", text: nut + " ▶", onclick: () => vaoTram(t) });
  if (!vao_dc) b.disabled = true;
  goiY.appendChild(h("div", { class: "q-hanh-dong" }, [b, CAM_UNG ? null : h("span", { class: "q-phim", html: "hoặc nhấn <kbd>E</kbd> / <kbd>Enter</kbd>" })]));
  goiY.classList.add("hien");
}

// ------------------------------------------------------------------ chất lượng hiển thị
const CHAT = { nhe: false, nhe_tu_dong: false, dem: 0, tong: 0 };
function apChatLuong(nhe) {
  CHAT.nhe = nhe;
  renderer.setPixelRatio(Math.min(devicePixelRatio, nhe ? 1 : 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !nhe;
  mat_troi.castShadow = !nhe;
  scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  may.visible = !nhe;
}
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
apChatLuong(QS.chat_luong === "nhe");

// ------------------------------------------------------------------ vòng lặp
const dong_ho = new THREE.Clock();
const huong = new THREE.Vector3(), tam = new THREE.Vector3();
function datCamera(k) {
  const p = BIT.g.position;
  tam.set(p.x + Math.sin(camYaw) * camXa, 6 + camXa * 0.3, p.z + Math.cos(camYaw) * camXa);
  camera.position.lerp(tam, k);
  camera.lookAt(p.x - Math.sin(camYaw) * 2.5, 2.4, p.z - Math.cos(camYaw) * 2.5);
}
function vaCham(p) {
  const r = Math.hypot(p.x, p.z), gh = R_DAO - 1.2;
  if (r > gh) { p.x *= gh / r; p.z *= gh / r; }
  for (const c of VAT_CAN) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.6;
    if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
  }
}
function khung_hinh() {
  requestAnimationFrame(khung_hinh);
  const dt = Math.min(dong_ho.getDelta(), 0.05), t = dong_ho.elapsedTime;
  if (document.hidden || khungMo) return;
  // tự hạ chất lượng nếu máy chậm (đo 120 khung hình đầu)
  if (QS.chat_luong === "tu_dong" && CHAT.dem < 120 && dangChoi) {
    CHAT.dem++; CHAT.tong += dt;
    if (CHAT.dem === 120 && CHAT.tong / 120 > 1 / 32 && !CHAT.nhe) { CHAT.nhe_tu_dong = true; apChatLuong(true); thongBao("Máy hơi chậm — đã chuyển sang hiển thị nhẹ.", "", 3000); }
  }
  // di chuyển
  let ix = 0, iz = 0;
  if (dangChoi) {
    if (PHIM.has("w") || PHIM.has("arrowup")) iz -= 1;
    if (PHIM.has("s") || PHIM.has("arrowdown")) iz += 1;
    if (PHIM.has("a") || PHIM.has("arrowleft")) ix -= 1;
    if (PHIM.has("d") || PHIM.has("arrowright")) ix += 1;
    if (CAN.hoat) { ix += CAN.dx; iz += CAN.dy; }
  }
  const sy = Math.sin(camYaw), cy = Math.cos(camYaw);
  huong.set(ix * cy + iz * sy, 0, -ix * sy + iz * cy);
  if (dich && huong.lengthSq() < 0.01) {
    huong.set(dich.cho_dung.x - BIT.g.position.x, 0, dich.cho_dung.z - BIT.g.position.z);
    if (huong.length() < 0.6) { dich = null; huong.set(0, 0, 0); }
  }
  const l = Math.min(1, huong.length());
  if (l > 0.05) {
    huong.normalize();
    BIT.g.position.addScaledVector(huong, 7.5 * l * dt);
    const muc = Math.atan2(huong.x, huong.z);
    let d = muc - BIT.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    BIT.g.rotation.y += d * Math.min(1, dt * 10);
  }
  vaCham(BIT.g.position);
  BIT.than.position.y = 1.15 + (IT_CHUYEN_DONG ? 0 : Math.sin(t * 3) * 0.08);
  BIT.than.rotation.x = l * 0.18;
  BIT.bong_dat.position.set(BIT.g.position.x, 0.04, BIT.g.position.z);
  BIT.lua.scale.setScalar(1 + l * 0.35 + Math.sin(t * 20) * 0.05);
  BIT.den.material.color.setHSL(0.12, 1, 0.55 + Math.sin(t * 4) * 0.12);
  const chop = (t % 3.2) < 0.12 ? 0.15 : 1; BIT.mat.forEach(m => { m.scale.y = chop; });
  if (AM.u) AM.u.gain.setTargetAtTime(l * 0.045, AM.ctx.currentTime, 0.1);
  if (AM.u_o) AM.u_o.frequency.setTargetAtTime(72 + l * 40, AM.ctx.currentTime, 0.1);
  datCamera(1 - Math.exp(-dt * 6));
  // trạm gần nhất
  let moi = null, dmin = 1e9;
  for (const tr of [...TRAM, CONG]) {
    const d = BIT.g.position.distanceTo(tr.cho_dung);
    const nguong = tr === CONG ? 4.8 : 3.6;
    if (d < nguong && d < dmin) { dmin = d; moi = tr; }
  }
  if (moi !== gan) { gan = moi; veGoiY(gan); }
  if (dich && gan === dich) { dich = null; }
  // hoạt cảnh
  TRAM.forEach((tr, k) => {
    tr.tinh_the.rotation.y = t * (tr.tt === "khoa" ? 0.3 : 1.2);
    tr.tinh_the.position.y = 4.25 + (IT_CHUYEN_DONG ? 0 : Math.sin(t * 2 + k) * 0.15);
    tr.vong.material.opacity = tr === gan ? 0.95 : tr.tt === "mo" ? 0.55 + Math.sin(t * 3) * 0.3 : 0.7;
    tr.rb.position.y = 0.5 + (IT_CHUYEN_DONG ? 0 : Math.abs(Math.sin(t * 2.2 + k)) * 0.08);
    tr.rb.rotation.y = tr === gan ? Math.atan2(BIT.g.position.x - tr.g.position.x, BIT.g.position.z - tr.g.position.z) - tr.g.rotation.y : -0.5;
  });
  TUONG.rotation.y = t * 0.5;
  if (!IT_CHUYEN_DONG) CANH_CHUYEN.forEach(c => { if (c.spin) c.mesh.rotation.y = t * 0.55; else c.mesh.position.y = c.base + Math.sin(t * 1.5 + c.phase) * 0.22; });
  CONG.cong_mat.uniforms.t.value = t;
  const mo = CONG.cong_mat.uniforms.mo;
  mo.value += ((CONG.mo_muc_tieu || 0) - mo.value) * Math.min(1, dt * 1.5);
  CONG.song.position.y = -mo.value * 6.6;
  may.children.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 140) c.position.x = -140; });
  KY_HIEU.forEach(s => { s.position.y += s.userData.v * dt * (IT_CHUYEN_DONG ? 0.2 : 1); if (s.position.y > 16) s.position.y = -1; s.material.opacity = 0.75 * Math.min(1, (16 - s.position.y) / 4, (s.position.y + 1) / 3); });
  for (let k = PHAO.length - 1; k >= 0; k--) {
    const pts = PHAO[k], u = pts.userData; u.song += dt;
    const a = pts.geometry.attributes.position;
    u.v.forEach((v, j) => { v.y -= 6 * dt; a.array[j * 3] += v.x * dt; a.array[j * 3 + 1] += v.y * dt; a.array[j * 3 + 2] += v.z * dt; });
    a.needsUpdate = true; pts.material.opacity = Math.max(0, 1 - u.song / 1.8);
    if (u.song > 1.8) { scene.remove(pts); pts.geometry.dispose(); pts.material.dispose(); PHAO.splice(k, 1); }
  }
  renderer.render(scene, camera);
}

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  camXa = camXaMacDinh();
  renderer.setSize(innerWidth, innerHeight);
});
document.addEventListener("visibilitychange", () => {
  if (!AM.ctx) return;
  if (document.hidden) AM.ctx.suspend(); else if (dangChoi) AM.ctx.resume();
});

// ------------------------------------------------------------------ màn đầu
let dangChoi = false;
const manDau = h("div", { class: "q-man q-intro" });
const nutVao = h("button", { class: "q-vao", text: "Đang tải…", disabled: "" });
manDau.appendChild(h("div", { class: "q-the" }, [
  h("div", { class: "q-nho", text: B.khoa + " · " + B.nhan }),
  h("h1", { text: CFG.ten_dao }),
  h("p", { class: "q-cau", text: B.cau_hoi }),
  h("p", { text: "Chọn bất kỳ trạm nào để khám phá. Khi học trên lớp, dừng và trao đổi theo lời nhắc của giáo viên." }),
  h("p", { class: "q-nho", text: CAM_UNG ? "Kéo để di chuyển hoặc chạm trạm để đi tới." : "Di chuyển: WASD/phím mũi tên · Vào trạm: E · Xoay nhìn: kéo chuột." }),
  h("div", { class: "q-hang" }, [nutVao, h("a", { class: "q-lien-ket", href: CFG.trang_doc, text: "Học ở chế độ đọc" })]),
]));
document.body.appendChild(manDau);
nutVao.addEventListener("click", () => {
  try { khoiDongAm(); datAm(QS.am); } catch (e) { /* âm thanh không được làm gián đoạn bài học */ }
  manDau.classList.add("an"); dangChoi = true; renderer.domElement.focus();
  if (!TT.ten) moKhung(CFG.trang_doc + "?nhung=1", "Nhập họ tên và lớp để bắt đầu");
  else thongBao("Chào " + TT.ten.split(" ").pop() + "! " + (qua() >= N ? "Cổng checkpoint cuối đã mở." : "Tới Trạm " + (qua() + 1) + " nhé."), "", 3500);
});

// ------------------------------------------------------------------ khởi động
datAm(QS.am);
capNhatTrangThai(false);
datCamera(1);
const sanSang = () => { nutVao.disabled = false; nutVao.textContent = qua() > 0 ? "Đi tiếp ▶" : "Bắt đầu khám phá ▶"; };
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
  TRAM.forEach(t => { t.tt = ""; }); CONG.tt = ""; capNhatTrangThai(false); sanSang();
}, sanSang);
khung_hinh();
window.__questReady = true;
