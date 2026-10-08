/* Khối TƯƠNG TÁC (2D/3D, đổi số liệu) cho web bài học ML Level 1.
 * Mỗi khối là window.ML1_TT[<loại>](k, el) -> phần tử DOM; app.js gọi khi gặp k.t chưa có sẵn.
 * Mọi số liệu trong khối đều do notebook/script chạy thật tính trước (data.js), trang chỉ hiển thị.
 *
 *  tra_bang        thanh trượt qua các mốc đã tính sẵn -> số lớn + biểu đồ đường/cột (+ phân bố tuỳ chọn)
 *  du_doan_tu      gõ một từ -> xác suất từ tiếp theo (đếm cặp từ), nút "máy viết tiếp"
 *  phan_tan_3d     điểm 3D xoay được (Plotly, tải khi cần), chọn cột cho 3 trục
 *  loc_bang        chọn điều kiện lọc + phép tính -> kết quả và dòng lệnh pandas tương ứng
 *  histogram       thanh trượt số cột (bins) -> histogram vẽ lại
 *  chay_tung_dong  chạy code Python từng dòng: dòng đang chạy, bảng biến, màn hình in
 *  duong_thang     kéo hệ số góc a, hệ số chặn b -> đường ŷ = ax + b trên đám điểm, MSE đổi ngay
 *  mat_3d          mặt sai số 3D (Plotly) + thanh trượt đi từng bước của gradient descent
 *  cong_tac        bật/tắt từng bước (vd các bước làm sạch) -> số liệu của tổ hợp đó (tính sẵn) + dòng lệnh
 *  chia_du_lieu    lưới ô (mỗi ô một dòng): chọn test_size, bật stratify, chia lại -> ô nào vào tập kiểm tra
 *  bieu_do_hop     chọn cột số × cách chia nhóm -> các hộp (tứ phân vị tính sẵn bằng pandas) + bảng số
 *  phan_tan_2d     chọn cột trục ngang, trục đứng -> biểu đồ phân tán + hệ số r (tính sẵn bằng pandas)
 *  knn             kéo điểm mới trên tập huấn luyện, chọn K, bật/tắt đưa về 0 – 1 -> K láng giềng bỏ phiếu
 *  mat_phang       hồi quy 2 cột: điểm 3D + mặt phẳng model tìm được (Plotly), bật/tắt mặt phẳng
 *  nguong_nham_lan kéo ngưỡng xác suất -> chấm từng bạn (viền đỏ = sai) + ma trận nhầm lẫn (tính sẵn)
 *  chia_nhanh      chọn cột, kéo ngưỡng -> hai nhánh (số Đạt / Chưa đạt) + Gini còn lại (tính sẵn)
 *  nhan_bayes      chọn mức từng cột -> phép nhân Naive Bayes cho từng nhãn, bật/tắt làm mịn +1
 *  kiem_dinh_cheo  lưới ô, bấm từng vòng -> phần làm kiểm tra + điểm từng vòng + trung bình (tính sẵn)
 *  can_tieu_chi    kéo mức ưu tiên từng tiêu chí -> xếp hạng model (số đo thật + đánh giá định tính)
 *  kmeans_buoc     chọn k và điểm xuất phát, bấm từng bước gán nhóm / dời tâm (tính sẵn)
 *  me_cung         Q-learning trên mê cung: kéo số tập đã học -> mũi tên hướng tốt nhất + đường đi
 *  chuoi_du_bao    kéo cửa sổ ngày trên chuỗi thời gian, bật/tắt đường dự báo, MAE của đoạn đang xem
 *  app_thu         giả lập app Gradio: thanh trượt + nút Dự đoán, kết quả tra lưới model tính sẵn, chặn ngoài vùng
 *  no_ron          một nơ-ron: kéo w1, w2, b -> đường ranh giới, số đoán đúng, xác suất cho một bạn
 *  keo_diem        kéo các chấm trên trục số -> số trung bình, trung vị, độ lệch chuẩn (chia n, như SGK) đổi ngay
 */
(function () {
  "use strict";
  var CSS = getComputedStyle(document.documentElement);
  function v(n, d) { var x = CSS.getPropertyValue(n).trim(); return x || d; }
  var MAU = { chinh: v("--xanh-tuoi", "#2563EB"), dam: v("--xanh", "#0F172A"), teal: v("--teal", "#0D9488"),
    vang: "#F59E0B", xam: "#94A3B8", vien: v("--vien", "#E2E8F0"), chu: v("--chu", "#0F172A"),
    phu: v("--chu-phu", "#475569") };
  var BANG_MAU = [MAU.chinh, MAU.vang, MAU.teal, "#DC2626", "#7C3AED", "#64748B"];
  var FONT = '"Be Vietnam Pro", "Segoe UI", sans-serif';
  function so(x, d) { return Number(x).toFixed(d === undefined ? 1 : d); }
  var el;

  function khung(k, loai) {
    var o = el("div", { class: "demo tt tt-" + loai }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    if (k.huong_dan) o.appendChild(el("p", { html: k.huong_dan }));
    return o;
  }
  function canvas(w, h) {
    var c = el("canvas", { class: "tt-ve", width: w * 2, height: h * 2 });
    c.style.width = "100%"; c.style.maxWidth = w + "px"; c.style.aspectRatio = w + " / " + h;
    var g = c.getContext("2d"); g.scale(2, 2);
    return { c: c, g: g, w: w, h: h };
  }
  // Trục + lưới cho vùng vẽ; trả về hàm đổi toạ độ.
  function truc(cv, xmin, xmax, ymin, ymax, nhanX, nhanY, vachY) {
    var g = cv.g, L = 52, R = 14, T = 12, B = 48, W = cv.w - L - R, H = cv.h - T - B;
    g.clearRect(0, 0, cv.w, cv.h);
    g.font = "12px " + FONT; g.fillStyle = MAU.phu; g.strokeStyle = MAU.vien; g.lineWidth = 1;
    (vachY || []).forEach(function (y) {
      var py = T + H - (y - ymin) / (ymax - ymin) * H;
      g.beginPath(); g.moveTo(L, py); g.lineTo(L + W, py); g.stroke();
      g.textAlign = "right"; g.fillText(so(y, y % 1 === 0 ? 0 : Math.abs(y * 10 - Math.round(y * 10)) < 1e-9 ? 1 : 2), L - 6, py + 4);
    });
    g.strokeStyle = MAU.xam; g.beginPath(); g.moveTo(L, T); g.lineTo(L, T + H); g.lineTo(L + W, T + H); g.stroke();
    g.textAlign = "center"; g.fillText(nhanX || "", L + W / 2, cv.h - 6);
    g.save(); g.translate(13, T + H / 2); g.rotate(-Math.PI / 2); g.fillText(nhanY || "", 0, 0); g.restore();
    return { x: function (x) { return L + (x - xmin) / (xmax - xmin) * W; },
             y: function (y) { return T + H - (y - ymin) / (ymax - ymin) * H; }, L: L, T: T, W: W, H: H };
  }
  // Vạch "đẹp" (bước 1, 2, 5 × 10^k) nằm trong [lo, hi].
  function vachDep(lo, hi, n) {
    var tho = (hi - lo) / (n || 5), mu = Math.pow(10, Math.floor(Math.log10(tho))), r = tho / mu;
    var buoc = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mu, a = [];
    for (var x = Math.ceil(lo / buoc) * buoc; x <= hi + 1e-9; x += buoc) a.push(+x.toFixed(6));
    return a;
  }
  function vachDeu(lo, hi, n) { var a = [], b = (hi - lo) / n; for (var i = 0; i <= n; i++) a.push(+(lo + i * b).toFixed(6)); return a; }

  // ---------------------------------------------------------------- tra_bang
  function traBang(k) {
    var o = khung(k, "tra-bang");
    var n = k.khoa.length, r = el("input", { type: "range", min: 0, max: n - 1, step: 1, value: k.bat_dau || 0, "aria-label": k.nhan_truot });
    var nhan = el("div", { class: "thong-bao" }), lon = el("div", { class: "tt-so-lon" }), ghi = el("p", { class: "tt-ghi" });
    var cv = canvas(640, 260), cv2 = k.phan_bo ? canvas(640, 220) : null;
    o.appendChild(nhan); o.appendChild(r); o.appendChild(lon); o.appendChild(cv.c);
    if (cv2) { o.appendChild(el("p", { class: "tt-nhan-phu", html: k.nhan_phan_bo || "" })); o.appendChild(cv2.c); }
    o.appendChild(ghi);
    var ymin = k.ymin !== undefined ? k.ymin : 0, ymax = k.ymax !== undefined ? k.ymax : Math.max.apply(null, k.so.concat(k.so2 || [])) * 1.1;
    function ve() {
      var i = +r.value, t = truc(cv, -0.5, n - 0.5, ymin, ymax, k.truc_x, k.truc_y, vachDeu(ymin, ymax, 4)), g = cv.g;
      nhan.innerHTML = (k.nhan_truot || "") + ": <b>" + k.khoa[i] + "</b>";
      var sl_ = k.so_le === undefined ? 1 : k.so_le;
      lon.innerHTML = k.so2 ?
        "<span>" + k.ten_so + "</span><b>" + so(k.so[i], sl_) + (k.don_vi || "") + "</b><span>" + k.ten_so2 +
          '</span><b style="color:' + MAU.vang + '">' + so(k.so2[i], sl_) + (k.don_vi || "") + "</b>" +
          "<small>" + (k.ten_chenh || "chênh") + " " + so(k.so[i] - k.so2[i], sl_) + " điểm</small>" :
        "<span>" + (k.nhan_so || "") + "</span><b>" + so(k.so[i], sl_) + (k.don_vi || "") + "</b>";
      ghi.innerHTML = k.ghi ? (k.ghi[i] || "") : "";
      g.textAlign = "center"; g.fillStyle = MAU.phu; g.font = "12px " + FONT;
      k.khoa.forEach(function (kk, j) { g.fillText(String(kk), t.x(j), t.T + t.H + 16); });
      if (k.kieu === "cot") {
        k.so.forEach(function (s, j) {
          var bw = t.W / n * 0.62; g.fillStyle = j === i ? MAU.chinh : "#BFDBFE";
          g.fillRect(t.x(j) - bw / 2, t.y(s), bw, t.y(ymin) - t.y(s));
        });
      } else {
        g.strokeStyle = MAU.chinh; g.lineWidth = 2.5; g.beginPath();
        k.so.forEach(function (s, j) { var px = t.x(j), py = t.y(s); j ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
        k.so.forEach(function (s, j) {
          g.beginPath(); g.arc(t.x(j), t.y(s), j === i ? 7 : 4, 0, 7);
          g.fillStyle = j === i ? MAU.dam : MAU.chinh; g.fill();
        });
        if (k.so2) {                                          // đường thứ hai (màu cam) + chú thích
          g.strokeStyle = MAU.vang; g.lineWidth = 2.5; g.beginPath();
          k.so2.forEach(function (s, j) { var px = t.x(j), py = t.y(s); j ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
          k.so2.forEach(function (s, j) { g.beginPath(); g.arc(t.x(j), t.y(s), j === i ? 7 : 4, 0, 7); g.fillStyle = MAU.vang; g.fill(); });
          g.font = "600 12.5px " + FONT; g.textAlign = "left";
          g.fillStyle = MAU.chinh; g.fillText("● " + k.ten_so, t.L + 10, t.T + 14);
          g.fillStyle = MAU.vang; g.fillText("● " + k.ten_so2, t.L + 10, t.T + 32);
          g.font = "12px " + FONT;
          g.strokeStyle = "rgba(15,23,42,.25)"; g.setLineDash([4, 4]); g.beginPath();
          g.moveTo(t.x(i), t.T); g.lineTo(t.x(i), t.T + t.H); g.stroke(); g.setLineDash([]);
        }
      }
      if (cv2) {
        var pb = k.phan_bo[i], m = pb.gia_tri.length, top = Math.max.apply(null, pb.gia_tri.concat([1])) * 1.15;
        var t2 = truc(cv2, -0.5, m - 0.5, 0, top, k.truc_x_phu || "", k.truc_y_phu || "", vachDeu(0, top, 3)), g2 = cv2.g;
        pb.gia_tri.forEach(function (s, j) {
          var bw = t2.W / m * 0.6; g2.fillStyle = (pb.to || []).indexOf(j) >= 0 ? MAU.vang : MAU.chinh;
          g2.fillRect(t2.x(j) - bw / 2, t2.y(s), bw, t2.y(0) - t2.y(s));
          g2.fillStyle = MAU.phu; g2.textAlign = "center"; g2.fillText(String(pb.nhan[j]), t2.x(j), t2.T + t2.H + 16);
          if (s) { g2.fillStyle = MAU.chu; g2.fillText(String(s), t2.x(j), t2.y(s) - 5); }
        });
      }
    }
    r.addEventListener("input", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- du_doan_tu
  function duDoanTu(k) {
    var o = khung(k, "du-doan-tu");
    var ip = el("input", { type: "text", value: k.mac_dinh || "", placeholder: "Gõ một từ, ví dụ: trời", "aria-label": "từ đầu vào" });
    var goi = el("div", { class: "tt-goi-y" }, (k.goi_y || []).map(function (w) {
      return el("button", { type: "button", class: "tt-chip", text: w, onclick: function () { ip.value = w; ve(); } });
    }));
    var cv = canvas(640, 240), thongbao = el("p", { class: "tt-ghi" });
    var nut = el("button", { type: "button", class: "nut phu", text: "Cho máy viết tiếp 5 từ" }), cau = el("p", { class: "tt-cau" });
    o.appendChild(el("div", { class: "tt-hang" }, [ip])); o.appendChild(goi); o.appendChild(cv.c); o.appendChild(thongbao);
    o.appendChild(nut); o.appendChild(cau);
    var daThay = {};
    Object.keys(k.cap).forEach(function (a) { daThay[a] = 1; Object.keys(k.cap[a]).forEach(function (b) { daThay[b] = 1; }); });
    function tuCuoi() { var a = ip.value.trim().toLowerCase().split(/\s+/); return a[a.length - 1] || ""; }
    function phanBo(w) {
      var d = k.cap[w]; if (!d) return [];
      var tong = 0, a = Object.keys(d).map(function (x) { tong += d[x]; return [x, d[x]]; });
      a.sort(function (p, q) { return q[1] - p[1]; });
      return a.slice(0, k.top || 5).map(function (p) { return [p[0], 100 * p[1] / tong, p[1]]; });
    }
    function ve() {
      var w = tuCuoi(), pb = phanBo(w), g = cv.g;
      if (!pb.length) {
        truc(cv, 0, 1, 0, 1, "", "");
        thongbao.innerHTML = !w ? "" : daThay[w]
          ? "Trong " + k.so_cau + " câu đã học, “" + w + "” chỉ đứng <b>cuối câu</b> — máy chưa gặp từ nào đi sau nó, nên không đoán được."
          : "Máy <b>chưa từng thấy</b> từ “" + w + "” trong " + k.so_cau + " câu đã học — nên không đoán được. Đây là giới hạn của dữ liệu.";
        return;
      }
      var t = truc(cv, -0.5, pb.length - 0.5, 0, 100, "Từ tiếp theo", "Xác suất (%)", [0, 25, 50, 75, 100]);
      pb.forEach(function (p, j) {
        var bw = t.W / pb.length * 0.55; g.fillStyle = j ? "#93C5FD" : MAU.chinh;
        g.fillRect(t.x(j) - bw / 2, t.y(p[1]), bw, t.y(0) - t.y(p[1]));
        g.fillStyle = MAU.chu; g.textAlign = "center"; g.font = "600 13px " + FONT;
        g.fillText(p[0], t.x(j), t.T + t.H + 17); g.font = "12px " + FONT;
        g.fillText(so(p[1], 0) + "%", t.x(j), t.y(p[1]) - 6);
      });
      thongbao.innerHTML = "Sau “<b>" + w + "</b>”, máy đếm được " + pb.reduce(function (s, p) { return s + p[2]; }, 0) +
        " lần xuất hiện trong " + k.so_cau + " câu và chọn từ hay đi sau nhất.";
    }
    nut.addEventListener("click", function () {
      var a = ip.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < 5; i++) { var pb = phanBo(a[a.length - 1]); if (!pb.length) break; a.push(pb[0][0]); }
      cau.innerHTML = "Máy viết: <b>" + a.join(" ") + "</b>"; ip.value = a.join(" "); ve();
    });
    ip.addEventListener("input", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- phan_tan_3d (Plotly)
  var dangTaiPlotly = null;
  function taiPlotly() {
    if (window.Plotly) return Promise.resolve();
    if (!dangTaiPlotly) dangTaiPlotly = new Promise(function (ok, loi) {
      var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js";
      s.onload = ok; s.onerror = loi; document.head.appendChild(s);
    });
    return dangTaiPlotly;
  }
  function phanTan3d(k) {
    var o = khung(k, "phan-tan-3d"), chon = [];
    var hang = el("div", { class: "tt-hang" });
    ["Trục X", "Trục Y", "Trục Z"].forEach(function (tn, i) {
      var s = el("select", { "aria-label": tn }, k.cot.map(function (c) { return el("option", { value: c, text: c }); }));
      s.value = k.mac_dinh[i]; s.addEventListener("change", ve); chon.push(s);
      hang.appendChild(el("label", {}, [tn + " ", s]));
    });
    var vung = el("div", { class: "tt-3d" }, [el("p", { class: "tt-ghi", text: "Đang tải hình 3D…" })]);
    o.appendChild(hang); o.appendChild(vung);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      taiPlotly().then(function () {
        var nhom = {}; k.du_lieu[k.nhan].forEach(function (n, i) { (nhom[n] = nhom[n] || []).push(i); });
        var ds = Object.keys(nhom).map(function (n, j) {
          var id = nhom[n], lay = function (c) { return id.map(function (i) { return k.du_lieu[c][i]; }); };
          return { type: "scatter3d", mode: "markers", name: n, x: lay(chon[0].value), y: lay(chon[1].value), z: lay(chon[2].value),
            marker: { size: 3.5, color: (k.mau || {})[n] || BANG_MAU[j % BANG_MAU.length], opacity: 0.85 } };
        });
        vung.innerHTML = "";
        window.Plotly.newPlot(vung, ds, { margin: { l: 0, r: 0, t: 0, b: 0 }, height: 420, font: { family: FONT, size: 12 },
          legend: { orientation: "h", y: 1.02 },
          scene: { xaxis: { title: chon[0].value }, yaxis: { title: chon[1].value }, zaxis: { title: chon[2].value } } },
          { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["toImage"] });
      }).catch(function () { vung.innerHTML = '<p class="tt-ghi">Không tải được thư viện vẽ 3D — kiểm tra kết nối mạng.</p>'; });
    }
    ve();
    return o;
  }

  // ---------------------------------------------------------------- loc_bang (pandas)
  function locBang(k) {
    var o = khung(k, "loc-bang"), D = k.du_lieu, n = D[k.cot_so[0]].length;
    var sCot = el("select", { "aria-label": "cột để lọc" }, [el("option", { value: "", text: "(không lọc)" })].concat(
      k.cot_loc.map(function (c) { return el("option", { value: c.ten, text: c.ten }); })));
    var sGt = el("select", { "aria-label": "giá trị lọc" });
    var sSo = el("select", { "aria-label": "cột số" }, k.cot_so.map(function (c) { return el("option", { value: c, text: c }); }));
    var PHEP = [["mean", "trung bình"], ["max", "lớn nhất"], ["min", "nhỏ nhất"], ["count", "đếm số dòng"]];
    var sPhep = el("select", { "aria-label": "phép tính" }, PHEP.map(function (p) { return el("option", { value: p[0], text: p[1] }); }));
    var ma = el("pre", { class: "tt-ma" }), kq = el("div", { class: "tt-so-lon" });
    o.appendChild(el("div", { class: "tt-hang" }, [el("label", {}, ["Lọc theo ", sCot]), el("label", {}, ["bằng ", sGt])]));
    o.appendChild(el("div", { class: "tt-hang" }, [el("label", {}, ["Cột ", sSo]), el("label", {}, ["Phép tính ", sPhep])]));
    o.appendChild(ma); o.appendChild(kq);
    function doiGt() {
      var c = k.cot_loc.filter(function (x) { return x.ten === sCot.value; })[0];
      sGt.innerHTML = ""; sGt.disabled = !c;
      (c ? c.gia_tri : []).forEach(function (g) { sGt.appendChild(el("option", { value: g, text: g })); });
      tinh();
    }
    function tinh() {
      var id = []; for (var i = 0; i < n; i++) if (!sCot.value || String(D[sCot.value][i]) === sGt.value) id.push(i);
      var x = id.map(function (i) { return D[sSo.value][i]; }), p = sPhep.value, r;
      if (p === "count") r = x.length;
      else if (!x.length) r = NaN;
      else if (p === "mean") r = x.reduce(function (a, b) { return a + b; }, 0) / x.length;
      else r = Math[p].apply(null, x);
      var loc = sCot.value ? k.ten_df + '[' + k.ten_df + '["' + sCot.value + '"] == "' + sGt.value + '"]' : k.ten_df;
      ma.textContent = (p === "count" ? "len(" + loc + ")" : loc + '["' + sSo.value + '"].' + p + "()");
      kq.innerHTML = "<span>Kết quả</span><b>" + (isNaN(r) ? "—" : so(r, p === "count" ? 0 : 2)) + "</b>" +
        '<small>' + id.length + " / " + n + " dòng thoả điều kiện</small>";
    }
    [sGt, sSo, sPhep].forEach(function (s) { s.addEventListener("change", tinh); });
    sCot.addEventListener("change", doiGt); doiGt();
    return o;
  }

  // ---------------------------------------------------------------- histogram
  function histogram(k) {
    var o = khung(k, "histogram"), a, lo, hi;
    function chonCot(c) {                                 // k.cot: nhiều cột để chọn; không có thì dùng k.gia_tri
      a = c ? c.gia_tri : k.gia_tri; lo = Math.min.apply(null, a); hi = Math.max.apply(null, a);
      if (c) { k.ma_cot = c.ma_cot; k.nhan_x = c.nhan_x; }
    }
    chonCot(k.cot ? k.cot[0] : null);
    var r = el("input", { type: "range", min: k.bins_min || 3, max: k.bins_max || 30, step: 1, value: k.mac_dinh || 10, "aria-label": "số cột" });
    var ma = el("pre", { class: "tt-ma" }), cv = canvas(640, 260);
    if (k.cot) {
      var sc = el("select", { "aria-label": "chọn cột" }, k.cot.map(function (c, i) { return el("option", { value: i, text: c.ten }); }));
      sc.addEventListener("change", function () { chonCot(k.cot[+sc.value]); ve(); });
      o.appendChild(el("div", { class: "tt-hang" }, [el("label", {}, ["Cột ", sc])]));
    }
    o.appendChild(r); o.appendChild(ma); o.appendChild(cv.c);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      var b = +r.value, w = (hi - lo) / b, dem = new Array(b).fill(0);
      a.forEach(function (x) { dem[Math.min(b - 1, Math.floor((x - lo) / w))]++; });
      var buoc = Math.max(1, Math.ceil(Math.max.apply(null, dem) / 4)), top = buoc * 5, vach = [];
      for (var v = 0; v <= top; v += buoc) vach.push(v);            // so ban la so nguyen
      var t = truc(cv, lo, hi, 0, top, k.nhan_x, "Số bạn", vach), g = cv.g;
      dem.forEach(function (d, i) {
        g.fillStyle = MAU.chinh; g.fillRect(t.x(lo + i * w) + 1, t.y(d), t.x(lo + w) - t.x(lo) - 2, t.y(0) - t.y(d));
      });
      g.fillStyle = MAU.phu; g.textAlign = "center";
      vachDeu(lo, hi, 5).forEach(function (x, j) { g.textAlign = j === 5 ? "right" : j ? "center" : "left"; g.fillText(so(x, x % 1 ? 1 : 0), t.x(x), t.T + t.H + 16); });
      if (k.duong) {                                         // đường trung bình (đỏ, nét đứt) và trung vị (navy)
        [[tv(a), MAU.dam, [], "trung vị " + so(tv(a), tv(a) % 1 ? 1 : 0), "right", -6], [tb(a), "#DC2626", [6, 4], "trung bình " + so(tb(a), k.so_le || 1), "left", 6]].forEach(function (d) {
          g.strokeStyle = d[1]; g.lineWidth = 2.2; g.setLineDash(d[2]); g.beginPath(); g.moveTo(t.x(d[0]), t.T); g.lineTo(t.x(d[0]), t.T + t.H); g.stroke(); g.setLineDash([]);
          g.fillStyle = d[1]; g.font = "600 12.5px " + FONT; g.textAlign = d[4]; g.fillText(d[3], t.x(d[0]) + d[5], t.T + 14);
        });
        g.font = "12px " + FONT;
      }
      ma.textContent = 'plt.hist(' + k.ma_cot + ', bins=' + b + ')';
    }
    r.addEventListener("input", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- chay_tung_dong (Python)
  function chayTungDong(k) {
    var o = khung(k, "chay-tung-dong"), i = 0;
    var ma = el("div", { class: "tt-code" }), bien = el("table", { class: "bang tt-bien" }), man = el("pre", { class: "tt-man-hinh" });
    var truoc = el("button", { type: "button", class: "nut phu", text: "◀ Lùi" }), sau = el("button", { type: "button", class: "nut", text: "Chạy dòng tiếp ▶" });
    var dem = el("span", { class: "tt-ghi" });
    var dong = k.code.map(function (c, j) { return el("div", { class: "tt-dong" }, [el("span", { class: "tt-so", text: String(j + 1) }), el("code", { text: c })]); });
    dong.forEach(function (d) { ma.appendChild(d); });
    o.appendChild(el("div", { class: "tt-hai-cot" }, [ma, el("div", {}, [el("div", { class: "tt-nhan-phu", text: "Biến đang có" }), bien,
      el("div", { class: "tt-nhan-phu", text: "Màn hình" }), man])]));
    o.appendChild(el("div", { class: "tt-hang" }, [truoc, sau, dem]));
    function ve() {
      var b = k.buoc[i];
      dong.forEach(function (d, j) { d.classList.toggle("dang-chay", b && j === b.dong); });
      bien.innerHTML = "<tr><th>Tên</th><th>Giá trị</th><th>Kiểu</th></tr>" + Object.keys(b ? b.bien : {}).map(function (t) {
        return "<tr><td><code>" + t + "</code></td><td>" + b.bien[t][0] + "</td><td>" + b.bien[t][1] + "</td></tr>"; }).join("");
      man.textContent = b ? b.in : "";
      dem.textContent = "Bước " + i + " / " + (k.buoc.length - 1);
      truoc.disabled = i === 0; sau.disabled = i === k.buoc.length - 1;
    }
    truoc.addEventListener("click", function () { if (i > 0) { i--; ve(); } });
    sau.addEventListener("click", function () { if (i < k.buoc.length - 1) { i++; ve(); } });
    ve();
    return o;
  }

  // Toạ độ con trỏ trong hệ toạ độ vẽ của canvas (canvas co giãn theo CSS).
  function viTri(cv, e) {
    var r = cv.c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * cv.w / r.width, y: (e.clientY - r.top) * cv.h / r.height };
  }
  function the(nhan, id) { return el("div", { class: "tt-the" }, [el("span", { text: nhan }), el("b", { "data-id": id })]); }
  function tb(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function tv(a) { var b = a.slice().sort(function (p, q) { return p - q; }), n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; }
  function dlc(a) { var m = tb(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / a.length); }

  // ---------------------------------------------------------------- keo_diem (1D: trung bình, trung vị, độ lệch chuẩn)
  function keoDiem(k) {
    var o = khung(k, "keo-diem"), goc = k.gia_tri.slice(), a = goc.slice(), chon = -1, keo = false;
    var cv = canvas(640, 200), hang = el("div", { class: "tt-the-hang" });
    var HIEN = k.hien || ["tb", "tv", "dlc"], TEN = { tb: "Số trung bình", tv: "Trung vị", dlc: "Độ lệch chuẩn" };
    HIEN.forEach(function (h) { hang.appendChild(the(TEN[h], h)); });
    var ds = el("p", { class: "tt-ghi" }), lai = el("button", { type: "button", class: "nut phu", text: "Đặt lại" });
    cv.c.tabIndex = 0; cv.c.setAttribute("aria-label", "Kéo các chấm; hoặc bấm chọn một chấm rồi dùng phím mũi tên");
    o.appendChild(cv.c); o.appendChild(hang); o.appendChild(ds); o.appendChild(el("div", { class: "tt-hang" }, [lai]));
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    var t;
    function lamTron(x) { return Math.min(k.hi, Math.max(k.lo, Math.round(x / k.buoc) * k.buoc)); }
    function ve() {
      t = truc(cv, k.lo, k.hi, 0, 1, k.nhan_x, "", []);
      var g = cv.g, m = tb(a), s = dlc(a), d = tv(a), y0 = t.y(0);
      if (HIEN.indexOf("dlc") >= 0) {                       // dải ±1 độ lệch chuẩn
        g.fillStyle = "rgba(13,148,136,.12)"; g.fillRect(t.x(m - s), t.T, t.x(m + s) - t.x(m - s), t.H);
      }
      g.fillStyle = MAU.phu; g.textAlign = "center";
      vachDeu(k.lo, k.hi, k.so_vach || 8).forEach(function (x) { g.fillText(so(x, x % 1 ? 1 : 0), t.x(x), y0 + 16); });
      function duong(x, mau, net, chu, canh) {
        g.strokeStyle = mau; g.lineWidth = 2; g.setLineDash(net); g.beginPath(); g.moveTo(t.x(x), t.T); g.lineTo(t.x(x), y0); g.stroke(); g.setLineDash([]);
        g.fillStyle = mau; g.font = "600 12px " + FONT; g.textAlign = canh; g.fillText(chu, t.x(x) + (canh === "left" ? 6 : -6), t.T + 12); g.textAlign = "center"; g.font = "12px " + FONT;
      }
      if (HIEN.indexOf("tv") >= 0) duong(d, MAU.dam, [], "trung vị", "right");
      if (HIEN.indexOf("tb") >= 0) duong(m, "#DC2626", [6, 4], "trung bình", "left");
      var dem = {};                                          // chấm trùng giá trị thì xếp chồng lên
      a.forEach(function (x, i) {
        var key = x.toFixed(4), c = dem[key] = (dem[key] || 0) + 1;
        var px = t.x(x), py = y0 - 16 - (c - 1) * 22;
        g.beginPath(); g.arc(px, py, i === chon ? 10 : 8.5, 0, 2 * Math.PI);
        g.fillStyle = i === chon ? MAU.vang : MAU.chinh; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke();
      });
      var giaTri = { tb: m, tv: d, dlc: s };
      HIEN.forEach(function (h) { hang.querySelector('[data-id="' + h + '"]').textContent = so(giaTri[h], k.so_le === undefined ? 1 : k.so_le) + (k.don_vi ? " " + k.don_vi : ""); });
      ds.textContent = "Dãy hiện tại: " + a.map(function (x) { return so(x, x % 1 ? 1 : 0); }).join(" · ");
    }
    function gan(p) {                                       // chấm gần con trỏ nhất (trong 18 px)
      var best = -1, bd = 18 * 18, dem = {};
      a.forEach(function (x, i) {
        var key = x.toFixed(4), c = dem[key] = (dem[key] || 0) + 1, dx = t.x(x) - p.x, dy = (t.y(0) - 16 - (c - 1) * 22) - p.y;
        if (dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = i; }
      });
      return best;
    }
    cv.c.addEventListener("pointerdown", function (e) { var i = gan(viTri(cv, e)); if (i >= 0) { chon = i; keo = true; cv.c.setPointerCapture(e.pointerId); ve(); } });
    cv.c.addEventListener("pointermove", function (e) {
      if (!keo) return; var p = viTri(cv, e);
      a[chon] = lamTron(k.lo + (p.x - t.L) / t.W * (k.hi - k.lo)); ve();
    });
    cv.c.addEventListener("pointerup", function () { keo = false; });
    cv.c.addEventListener("keydown", function (e) {
      if (chon < 0) chon = 0;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") a[chon] = lamTron(a[chon] + k.buoc);
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") a[chon] = lamTron(a[chon] - k.buoc);
      else if (e.key === "Tab") return;
      else if (e.key === " ") chon = (chon + 1) % a.length;
      else return;
      e.preventDefault(); ve();
    });
    lai.addEventListener("click", function () { a = goc.slice(); chon = -1; ve(); });
    cv.c.style.touchAction = "none";
    ve();
    return o;
  }

  // ---------------------------------------------------------------- duong_thang (2D: kéo a, b -> MSE)
  function duongThang(k) {
    var o = khung(k, "duong-thang"), X = k.x, Y = k.y, n = X.length;
    function truot(ten, lo, hi, v) {
      var r = el("input", { type: "range", min: lo, max: hi, step: k.buoc || 0.01, value: v, "aria-label": ten });
      return r;
    }
    var ra = truot("hệ số góc a", k.a_min, k.a_max, k.a0), rb = truot("hệ số chặn b", k.b_min, k.b_max, k.b0);
    var la = el("span"), lb = el("span");
    o.appendChild(el("label", { class: "tt-nhan-phu" }, ["Hệ số góc a = ", la])); o.appendChild(ra);
    o.appendChild(el("label", { class: "tt-nhan-phu" }, ["Hệ số chặn b = ", lb])); o.appendChild(rb);
    var cv = canvas(640, 300), hang = el("div", { class: "tt-the-hang" }, [the("Đường đang thử", "pt"), the("Sai số MSE", "mse"), the("MSE nhỏ nhất có thể", "tot")]);
    var nut = el("button", { type: "button", class: "nut phu", text: "Hiện đường tốt nhất" }), hienTot = false;
    o.appendChild(cv.c); o.appendChild(hang); o.appendChild(el("div", { class: "tt-hang" }, [nut]));
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function mse(a, b) { var s = 0; for (var i = 0; i < n; i++) { var e = Y[i] - (a * X[i] + b); s += e * e; } return s / n; }
    var xlo = k.x_min, xhi = k.x_max, ylo = k.y_min, yhi = k.y_max;
    function ve() {
      var a = +ra.value, b = +rb.value;
      la.textContent = so(a, 2); lb.textContent = so(b, 2);
      var t = truc(cv, xlo, xhi, ylo, yhi, k.nhan_x, k.nhan_y, vachDeu(ylo, yhi, k.so_vach_y || 5)), g = cv.g;
      g.fillStyle = MAU.phu; g.textAlign = "center";
      vachDeu(xlo, xhi, k.so_vach_x || 7).forEach(function (x) { g.fillText(so(x, x % 1 ? 1 : 0), t.x(x), t.T + t.H + 16); });
      g.save(); g.beginPath(); g.rect(t.L, t.T, t.W, t.H); g.clip();
      for (var i = 0; i < n; i += (k.moi_bao_nhieu || 1)) {         // đoạn sai lệch y − ŷ (một phần các điểm cho đỡ rối)
        g.strokeStyle = "rgba(245,158,11,.55)"; g.lineWidth = 1; g.beginPath();
        g.moveTo(t.x(X[i]), t.y(Y[i])); g.lineTo(t.x(X[i]), t.y(a * X[i] + b)); g.stroke();
      }
      for (i = 0; i < n; i++) { g.fillStyle = "rgba(100,116,139,.55)"; g.beginPath(); g.arc(t.x(X[i]), t.y(Y[i]), 2.6, 0, 7); g.fill(); }
      function ke(a_, b_, mau, net) { g.strokeStyle = mau; g.lineWidth = 3; g.setLineDash(net); g.beginPath(); g.moveTo(t.x(xlo), t.y(a_ * xlo + b_)); g.lineTo(t.x(xhi), t.y(a_ * xhi + b_)); g.stroke(); g.setLineDash([]); }
      if (hienTot) ke(k.a_tot, k.b_tot, MAU.teal, [7, 5]);
      ke(a, b, MAU.chinh, []);
      g.restore();
      hang.querySelector('[data-id="pt"]').textContent = "ŷ = " + so(a, 2) + "x " + (b < 0 ? "− " : "+ ") + so(Math.abs(b), 2);
      hang.querySelector('[data-id="mse"]').textContent = so(mse(a, b), 2);
      hang.querySelector('[data-id="tot"]').textContent = hienTot ? so(mse(k.a_tot, k.b_tot), 2) : "?";
    }
    ra.addEventListener("input", ve); rb.addEventListener("input", ve);
    nut.addEventListener("click", function () { hienTot = !hienTot; nut.textContent = hienTot ? "Ẩn đường tốt nhất" : "Hiện đường tốt nhất"; ve(); });
    ve();
    return o;
  }

  // ---------------------------------------------------------------- mat_3d (mặt sai số + đường đi, Plotly)
  function mat3d(k) {
    var o = khung(k, "mat-3d"), vung = el("div", { class: "tt-3d" });
    var r = el("input", { type: "range", min: 0, max: k.duong.x.length - 1, step: 1, value: 0, "aria-label": "số bước đã đi" });
    var nhan = el("div", { class: "thong-bao" });
    o.appendChild(vung); o.appendChild(nhan); o.appendChild(r);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    var san = false;
    function ve() {
      var i = +r.value, d = k.duong;
      nhan.innerHTML = "Bước <b>" + (d.buoc ? d.buoc[i] : i) + "</b>: a = " + so(d.x[i], 3) + ", b = " + so(d.y[i], 3) + ", MSE = <b>" + so(d.z[i], 3) + "</b>";
      if (!san) return;
      Plotly.restyle(vung, { x: [d.x.slice(0, i + 1)], y: [d.y.slice(0, i + 1)], z: [d.z.slice(0, i + 1)] }, [1]);
    }
    taiPlotly().then(function () {
      var d = k.duong;
      Plotly.newPlot(vung, [
        { type: "surface", x: k.truc_x, y: k.truc_y, z: k.z, colorscale: [[0, "#1E3A8A"], [0.35, "#2563EB"], [0.7, "#93C5FD"], [1, "#EFF6FF"]],
          opacity: 0.92, showscale: false, contours: { z: { show: true, usecolormap: true, project: { z: true } } } },
        { type: "scatter3d", mode: "lines+markers", x: [d.x[0]], y: [d.y[0]], z: [d.z[0]],
          line: { color: "#F59E0B", width: 6 }, marker: { size: 3.5, color: "#DC2626" }, name: "đường đi" }],
        { margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, font: { family: FONT },
          scene: { xaxis: { title: k.nhan_x }, yaxis: { title: k.nhan_y }, zaxis: { title: k.nhan_z },
                   camera: { eye: { x: 1.6, y: -1.5, z: 0.9 } } } },
        { displaylogo: false, responsive: true });
      san = true; ve();
    }).catch(function () { vung.innerHTML = '<p class="tt-ghi">Không tải được thư viện vẽ 3D — kiểm tra kết nối mạng.</p>'; });
    r.addEventListener("input", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- cong_tac (bật/tắt từng bước -> kết quả tính sẵn)
  function congTac(k) {
    var o = khung(k, "cong-tac"), bat = k.cong_tac.map(function (c) { return !!c.mac_dinh; });
    var hop = el("div", { class: "tt-cong-tac" }), ma = el("pre", { class: "tt-ma" }), bao = el("div", { class: "thong-bao" });
    var hang = el("div", { class: "tt-the-hang" }, k.chi_so.map(function (c) { return the(c.ten, c.khoa); }));
    k.cong_tac.forEach(function (c, i) {
      var cb = el("input", { type: "checkbox", id: "ct-" + k.tieu_de.length + "-" + i });
      cb.checked = bat[i];
      cb.addEventListener("change", function () { bat[i] = cb.checked; ve(); });
      hop.appendChild(el("label", { class: "tt-cong-tac-dong" }, [cb, el("span", { html: "<b>" + (i + 1) + ".</b> " + c.ten })]));
    });
    o.appendChild(hop); o.appendChild(hang); o.appendChild(bao); o.appendChild(ma);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      var khoa = bat.map(function (b) { return b ? "1" : "0"; }).join(""), r = k.bang[khoa];
      k.chi_so.forEach(function (c) {
        var v = r[c.khoa], x = hang.querySelector('[data-id="' + c.khoa + '"]');
        x.textContent = so(v, c.so_le || 0);
        x.style.color = c.nguong !== undefined && v > c.nguong ? "#DC2626" : "";
      });
      var dong = [k.dau || ""].concat(k.cong_tac.filter(function (c, i) { return bat[i]; }).map(function (c) { return c.ma; }));
      ma.textContent = dong.filter(Boolean).join("\n") || "# chưa bật bước nào";
      var tb = (k.nhan_xet || []).filter(function (n) { return n.khi.split("").every(function (ch, i) { return ch === "?" || ch === khoa[i]; }); });
      bao.innerHTML = tb.length ? tb[0].html : "";
      bao.style.display = tb.length ? "" : "none";
    }
    ve();
    return o;
  }

  // ---------------------------------------------------------------- chia_du_lieu (lưới ô: ai vào tập kiểm tra)
  function chiaDuLieu(k) {
    var o = khung(k, "chia-du-lieu"), nhan = k.nhan, n = nhan.length, ts = k.ti_le[1] || k.ti_le[0], st = false, s = 0;
    var nutTs = k.ti_le.map(function (x) {
      var b = el("button", { type: "button", class: "tt-chip", text: "test_size = " + so(x, 1) });
      b.addEventListener("click", function () { ts = x; ve(); }); return b;
    });
    var cb = el("input", { type: "checkbox" }); cb.addEventListener("change", function () { st = cb.checked; ve(); });
    var lai = el("button", { type: "button", class: "nut phu", text: "Chia lại" });
    lai.addEventListener("click", function () { s = (s + 1) % k.so_lan; ve(); });
    o.appendChild(el("div", { class: "tt-hang" }, nutTs.concat([el("label", { class: "tt-cong-tac-dong" }, [cb, el("span", { text: "stratify=y" })]), lai])));
    var luoi = el("div", { class: "tt-luoi" }), o_ = [];
    for (var i = 0; i < n; i++) { var c = el("span", { class: "tt-o " + (nhan[i] === k.nhan_it ? "it" : "nhieu"), title: nhan[i] }); o_.push(c); luoi.appendChild(c); }
    var chu = el("div", { class: "tt-chu-giai", html: '<span class="tt-o nhieu"></span> ' + k.ten_nhieu + ' &nbsp; <span class="tt-o it"></span> ' + k.ten_it +
      ' &nbsp; <span class="tt-o nhieu test"></span> ô viền đậm = vào tập kiểm tra' });
    var hang = el("div", { class: "tt-the-hang" }, [the("Tập huấn luyện", "tr"), the("Tập kiểm tra", "te"), the(k.ten_it + " trong tập kiểm tra", "it")]);
    var ma = el("pre", { class: "tt-ma" });
    o.appendChild(luoi); o.appendChild(chu); o.appendChild(hang); o.appendChild(ma);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    var tongIt = nhan.filter(function (x) { return x === k.nhan_it; }).length;
    function ve() {
      var te = k.bang[ts + "|" + (st ? 1 : 0) + "|" + s], la = {};
      te.forEach(function (i) { la[i] = 1; });
      o_.forEach(function (c, i) { c.classList.toggle("test", !!la[i]); });
      nutTs.forEach(function (b, j) { b.classList.toggle("dang-chon", k.ti_le[j] === ts); });
      var it = te.filter(function (i) { return nhan[i] === k.nhan_it; }).length;
      hang.querySelector('[data-id="tr"]').textContent = (n - te.length) + " bạn";
      hang.querySelector('[data-id="te"]').textContent = te.length + " bạn";
      hang.querySelector('[data-id="it"]').textContent = it + " bạn · " + so(100 * it / te.length, 0) + "%";
      ma.textContent = "train_test_split(X, y, test_size=" + ts + ", random_state=" + s + (st ? ", stratify=y" : "") + ")\n" +
        "# cả bảng: " + tongIt + "/" + n + " bạn " + k.ten_it + " = " + so(100 * tongIt / n, 0) + "%";
    }
    ve();
    return o;
  }

  // ---------------------------------------------------------------- bieu_do_hop (chọn cột × cách chia nhóm)
  function bieuDoHop(k) {
    var o = khung(k, "bieu-do-hop");
    var sc = el("select", { "aria-label": "cột số" }, k.cot.map(function (c) { return el("option", { value: c, text: c }); }));
    var sn = el("select", { "aria-label": "chia nhóm theo" }, k.nhom.map(function (c) { return el("option", { value: c, text: c }); }));
    o.appendChild(el("div", { class: "tt-hang" }, [el("label", {}, ["Cột ", sc]), el("label", {}, ["Chia nhóm theo ", sn])]));
    var cv = canvas(640, 280), ma = el("pre", { class: "tt-ma" }), bang = el("table", { class: "bang" });
    o.appendChild(cv.c); o.appendChild(bang); o.appendChild(ma);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      var d = k.bang[sc.value + "|" + sn.value], ten = Object.keys(d), m = ten.length;
      var lo = Infinity, hi = -Infinity;
      ten.forEach(function (n) { var h = d[n]; lo = Math.min(lo, h.min); hi = Math.max(hi, h.max); });
      var pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
      var g = cv.g, L = 96, R = 16, T = 10, B = 40, W = cv.w - L - R, H = cv.h - T - B;
      g.clearRect(0, 0, cv.w, cv.h);
      var X = function (x) { return L + (x - lo) / (hi - lo) * W; };
      g.font = "12px " + FONT; g.strokeStyle = MAU.vien; g.fillStyle = MAU.phu; g.textAlign = "center";
      vachDep(lo, hi, 6).forEach(function (x) { g.beginPath(); g.moveTo(X(x), T); g.lineTo(X(x), T + H); g.stroke(); g.fillText(so(x, x % 1 ? 1 : 0), X(x), T + H + 16); });
      g.fillText(sc.value, L + W / 2, cv.h - 4);
      ten.forEach(function (n, i) {
        var h = d[n], y = T + (i + 0.5) * H / m, bh = Math.min(34, H / m * 0.55), mau = BANG_MAU[i % BANG_MAU.length];
        g.strokeStyle = MAU.dam; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(X(h.rau_duoi), y); g.lineTo(X(h.q1), y); g.moveTo(X(h.q3), y); g.lineTo(X(h.rau_tren), y);
        g.moveTo(X(h.rau_duoi), y - bh / 3); g.lineTo(X(h.rau_duoi), y + bh / 3); g.moveTo(X(h.rau_tren), y - bh / 3); g.lineTo(X(h.rau_tren), y + bh / 3); g.stroke();
        g.fillStyle = mau; g.globalAlpha = 0.28; g.fillRect(X(h.q1), y - bh / 2, X(h.q3) - X(h.q1), bh); g.globalAlpha = 1;
        g.strokeStyle = mau; g.lineWidth = 2; g.strokeRect(X(h.q1), y - bh / 2, X(h.q3) - X(h.q1), bh);
        g.strokeStyle = "#DC2626"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X(h.q2), y - bh / 2); g.lineTo(X(h.q2), y + bh / 2); g.stroke();
        g.fillStyle = "#DC2626"; (h.la || []).forEach(function (x) { g.beginPath(); g.arc(X(x), y, 3.5, 0, 7); g.fill(); });
        g.fillStyle = MAU.chu; g.textAlign = "right"; g.fillText(n + " (" + h.n + ")", L - 8, y + 4); g.textAlign = "center";
      });
      bang.innerHTML = "<tr><th>Nhóm</th><th>Số bạn</th><th>Q1</th><th>Trung vị</th><th>Q3</th><th>Giá trị bất thường</th></tr>" +
        ten.map(function (n) { var h = d[n]; return "<tr><td>" + n + "</td><td>" + h.n + "</td><td>" + so(h.q1, 2) + "</td><td><b>" + so(h.q2, 2) + "</b></td><td>" + so(h.q3, 2) + "</td><td>" + (h.la.length || "—") + "</td></tr>"; }).join("");
      var by = (k.cot_nhom || {})[sn.value];               // tên cột thật trong bảng; không có thì vẽ cả khối
      ma.textContent = 'df.boxplot(column="' + sc.value + '"' + (by ? ', by="' + by + '"' : "") + ', vert=False)';
    }
    sc.addEventListener("change", ve); sn.addEventListener("change", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- phan_tan_2d (chọn cột X, Y -> chấm + r tính sẵn)
  function phanTan2d(k) {
    var o = khung(k, "phan-tan-2d"), D = k.du_lieu, n = D[k.cot[0]].length;
    function chon(ten, mac) { var s = el("select", { "aria-label": ten }, k.cot.map(function (c) { return el("option", { value: c, text: c }); })); s.value = mac; return s; }
    var sx = chon("trục ngang", k.x0 || k.cot[0]), sy = chon("trục đứng", k.y0 || k.cot[1]);
    o.appendChild(el("div", { class: "tt-hang" }, [el("label", {}, ["Trục ngang ", sx]), el("label", {}, ["Trục đứng ", sy])]));
    var cv = canvas(640, 320), hang = el("div", { class: "tt-the-hang" }, [the("Hệ số tương quan r", "r"), the("Đọc là", "doc")]);
    var ma = el("pre", { class: "tt-ma" });
    o.appendChild(cv.c); o.appendChild(hang); o.appendChild(ma);
    if (k.nhan) {
      var nhom = {}; k.du_lieu[k.nhan].forEach(function (v) { nhom[v] = 1; });
      o.appendChild(el("div", { class: "tt-chu-giai", html: (k.thu_tu || Object.keys(nhom)).map(function (v, i) {
        return '<span class="tt-o" style="opacity:1;border-radius:50%;background:' + BANG_MAU[i % BANG_MAU.length] + '"></span> ' + ((k.ten_nhan || {})[v] || v); }).join(" &nbsp; ") }));
    }
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function doc(r) {
      var a = Math.abs(r), muc = a >= 0.7 ? "mạnh" : a >= 0.3 ? "vừa" : "yếu hoặc gần như không";   // cùng mốc với bài 10
      return (r > 0 ? "dương, " : "âm, ") + muc;
    }
    function ve() {
      var X = D[sx.value], Y = D[sy.value];
      var xlo = Math.min.apply(null, X), xhi = Math.max.apply(null, X), ylo = Math.min.apply(null, Y), yhi = Math.max.apply(null, Y);
      var px = (xhi - xlo) * 0.05 || 1, py = (yhi - ylo) * 0.05 || 1; xlo -= px; xhi += px; ylo -= py; yhi += py;
      var t = truc(cv, xlo, xhi, ylo, yhi, sx.value, sy.value, vachDep(ylo, yhi, 5)), g = cv.g;
      g.fillStyle = MAU.phu; g.textAlign = "center";
      vachDep(xlo, xhi, 6).forEach(function (x) { g.fillText(so(x, x % 1 ? 1 : 0), t.x(x), t.T + t.H + 16); });
      var mauCua = {}, dem = 0;
      (k.thu_tu || []).forEach(function (v) { mauCua[v] = BANG_MAU[dem++ % BANG_MAU.length]; });
      for (var i = 0; i < n; i++) {
        var nh = k.nhan ? D[k.nhan][i] : "";
        if (!(nh in mauCua)) mauCua[nh] = BANG_MAU[dem++ % BANG_MAU.length];
        g.fillStyle = mauCua[nh]; g.globalAlpha = 0.6; g.beginPath(); g.arc(t.x(X[i]), t.y(Y[i]), 3.2, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      var r = sx.value === sy.value ? 1 : k.r[sx.value + "|" + sy.value];
      hang.querySelector('[data-id="r"]').textContent = so(r, 2);
      hang.querySelector('[data-id="doc"]').textContent = sx.value === sy.value ? "một cột với chính nó" : doc(r);
      ma.textContent = 'plt.scatter(df["' + sx.value + '"], df["' + sy.value + '"])\n' +
        'df["' + sx.value + '"].corr(df["' + sy.value + '"])   # ' + so(r, 3);
    }
    sx.addEventListener("change", ve); sy.addEventListener("change", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- knn (kéo điểm mới, chọn K, bật/tắt thang đo 0 – 1)
  function knn(k) {
    var o = khung(k, "knn"), X = k.x, Y = k.y, L_ = k.nhan, n = X.length, q = k.diem_moi.slice(), keo = false;
    var rk = el("input", { type: "range", min: 1, max: k.k_max || 25, step: 2, value: k.k0 || 5, "aria-label": "K" });
    var lk = el("span"), cb = el("input", { type: "checkbox" }); cb.checked = true;
    o.appendChild(el("div", { class: "tt-hang" }, [el("label", { class: "tt-nhan-phu" }, ["K = ", lk]),
      el("label", { class: "tt-cong-tac-dong" }, [cb, el("span", { text: "Đưa hai cột về 0 – 1 trước khi đo" })])]));
    o.appendChild(rk);
    var cv = canvas(640, 340), hang = el("div", { class: "tt-the-hang" }, [the("Điểm mới", "q"), the("Phiếu bầu", "p"), the("KNN đoán", "d")]);
    cv.c.tabIndex = 0; cv.c.style.touchAction = "none";
    cv.c.setAttribute("aria-label", "Kéo ngôi sao (điểm mới); hoặc dùng phím mũi tên");
    o.appendChild(cv.c); o.appendChild(hang);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    var xlo = k.x_min, xhi = k.x_max, ylo = k.y_min, yhi = k.y_max, t;
    function ve() {
      var K = +rk.value; lk.textContent = K;
      t = truc(cv, xlo, xhi, ylo, yhi, k.nhan_x, k.nhan_y, vachDep(ylo, yhi, 5));
      var g = cv.g; g.fillStyle = MAU.phu; g.textAlign = "center";
      vachDep(xlo, xhi, 7).forEach(function (x) { g.fillText(so(x, x % 1 ? 1 : 0), t.x(x), t.T + t.H + 16); });
      var sx = cb.checked ? (k.max_x - k.min_x) : 1, sy = cb.checked ? (k.max_y - k.min_y) : 1;
      var d = []; for (var i = 0; i < n; i++) { var dx = (X[i] - q[0]) / sx, dy = (Y[i] - q[1]) / sy; d.push([dx * dx + dy * dy, i]); }
      d.sort(function (a, b) { return a[0] - b[0]; });
      var gan = d.slice(0, K), dem = {};
      g.save(); g.beginPath(); g.rect(t.L, t.T, t.W, t.H); g.clip();
      gan.forEach(function (p) { var i = p[1]; dem[L_[i]] = (dem[L_[i]] || 0) + 1;
        g.strokeStyle = "rgba(15,23,42,.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(t.x(q[0]), t.y(q[1])); g.lineTo(t.x(X[i]), t.y(Y[i])); g.stroke(); });
      var laGan = {}; gan.forEach(function (p) { laGan[p[1]] = 1; });
      for (i = 0; i < n; i++) {
        g.beginPath(); g.arc(t.x(X[i]), t.y(Y[i]), laGan[i] ? 5.5 : 3.2, 0, 7);
        g.fillStyle = L_[i] === k.nhan_a ? MAU.chinh : MAU.vang; g.globalAlpha = laGan[i] ? 1 : 0.45; g.fill();
        if (laGan[i]) { g.lineWidth = 1.5; g.strokeStyle = MAU.dam; g.stroke(); }
      }
      g.globalAlpha = 1;
      var px = t.x(q[0]), py = t.y(q[1]);                   // ngôi sao = điểm mới
      g.beginPath(); for (var s = 0; s < 10; s++) { var r = s % 2 ? 5 : 12, a = -Math.PI / 2 + s * Math.PI / 5; g.lineTo(px + r * Math.cos(a), py + r * Math.sin(a)); }
      g.closePath(); g.fillStyle = "#DC2626"; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke();
      g.restore();
      var a_ = dem[k.nhan_a] || 0, b_ = dem[k.nhan_b] || 0;
      hang.querySelector('[data-id="q"]').textContent = "(" + so(q[0], 1) + "; " + so(q[1], 0) + ")";
      hang.querySelector('[data-id="p"]').textContent = k.ten_a + " " + a_ + " · " + k.ten_b + " " + b_;
      hang.querySelector('[data-id="d"]').textContent = a_ > b_ ? k.ten_a : k.ten_b;
    }
    function dat(e) { var p = viTri(cv, e);
      q[0] = Math.min(xhi, Math.max(xlo, xlo + (p.x - t.L) / t.W * (xhi - xlo)));
      q[1] = Math.min(yhi, Math.max(ylo, ylo + (t.T + t.H - p.y) / t.H * (yhi - ylo))); ve(); }
    cv.c.addEventListener("pointerdown", function (e) { keo = true; cv.c.setPointerCapture(e.pointerId); dat(e); });
    cv.c.addEventListener("pointermove", function (e) { if (keo) dat(e); });
    cv.c.addEventListener("pointerup", function () { keo = false; });
    cv.c.addEventListener("keydown", function (e) {
      var bx = (xhi - xlo) / 50, by = (yhi - ylo) / 50;
      if (e.key === "ArrowRight") q[0] = Math.min(xhi, q[0] + bx); else if (e.key === "ArrowLeft") q[0] = Math.max(xlo, q[0] - bx);
      else if (e.key === "ArrowUp") q[1] = Math.min(yhi, q[1] + by); else if (e.key === "ArrowDown") q[1] = Math.max(ylo, q[1] - by);
      else return; e.preventDefault(); ve();
    });
    rk.addEventListener("input", ve); cb.addEventListener("change", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- mat_phang (hồi quy 2 cột: điểm 3D + mặt phẳng)
  function matPhang(k) {
    var o = khung(k, "mat-phang"), vung = el("div", { class: "tt-3d" }), cb = el("input", { type: "checkbox" });
    cb.checked = true;
    o.appendChild(el("label", { class: "tt-cong-tac-dong" }, [cb, el("span", { html: "Hiện mặt phẳng " + k.cong_thuc })]));
    o.appendChild(vung);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    taiPlotly().then(function () {
      var xs = [Math.min.apply(null, k.x), Math.max.apply(null, k.x)], ys = [Math.min.apply(null, k.y), Math.max.apply(null, k.y)];
      var z = ys.map(function (yy) { return xs.map(function (xx) { return k.a1 * xx + k.a2 * yy + k.b; }); });
      Plotly.newPlot(vung, [
        { type: "scatter3d", mode: "markers", x: k.x, y: k.y, z: k.z, name: "điểm",
          marker: { size: 3.5, opacity: 0.85, color: k.nhan ? k.nhan.map(function (v) { return (k.thu_tu || []).indexOf(v) > 0 ? MAU.vang : MAU.chinh; }) : MAU.chinh } },
        { type: "surface", x: xs, y: ys, z: z, opacity: 0.3, showscale: false, colorscale: [[0, "#F59E0B"], [1, "#F59E0B"]], name: "mặt phẳng" }],
        { margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: false, font: { family: FONT },
          scene: { xaxis: { title: k.nhan_x }, yaxis: { title: k.nhan_y }, zaxis: { title: k.nhan_z }, camera: { eye: { x: 1.7, y: -1.4, z: 0.8 } } } },
        { displaylogo: false, responsive: true });
      cb.addEventListener("change", function () { Plotly.restyle(vung, { visible: cb.checked }, [1]); });
    }).catch(function () { vung.innerHTML = '<p class="tt-ghi">Không tải được thư viện vẽ 3D — kiểm tra kết nối mạng.</p>'; });
    return o;
  }

  // ---------------------------------------------------------------- nguong_nham_lan (kéo ngưỡng -> chấm + ma trận nhầm lẫn)
  function nguongNhamLan(k) {
    var o = khung(k, "nguong-nham-lan"), M = k.moc, n = M.length;
    var r = el("input", { type: "range", min: 0, max: n - 1, step: 1, value: k.bat_dau || 0, "aria-label": "ngưỡng" });
    var nhan = el("div", { class: "thong-bao" }), cv = canvas(640, 190);
    var mt = el("table", { class: "bang tt-ma-tran" }), hang = el("div", { class: "tt-the-hang" }, [the("Độ chính xác", "acc"), the("Bỏ sót", "bs"), the("Báo nhầm", "bn")]);
    o.appendChild(nhan); o.appendChild(r); o.appendChild(cv.c); o.appendChild(el("div", { class: "tt-hai-cot" }, [mt, hang]));
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      var m = M[+r.value], g = cv.g, L = 96, R = 16, T = 12, B = 34, W = cv.w - L - R, H = cv.h - T - B;
      nhan.innerHTML = "Ngưỡng xác suất " + k.ten_duong + " = <b>" + so(m.t, 2) + "</b> — từ ngưỡng trở lên thì đoán " + k.ten_duong;
      g.clearRect(0, 0, cv.w, cv.h);
      var X = function (p) { return L + p * W; };
      g.strokeStyle = MAU.vien; g.fillStyle = MAU.phu; g.font = "12px " + FONT; g.textAlign = "center";
      [0, 0.25, 0.5, 0.75, 1].forEach(function (p) { g.beginPath(); g.moveTo(X(p), T); g.lineTo(X(p), T + H); g.stroke(); g.fillText(so(p, 2), X(p), T + H + 16); });
      g.fillText("Xác suất " + k.ten_duong + " model đưa ra", L + W / 2, cv.h - 2);
      var hangY = {}; hangY[k.nhan_am] = T + H * 0.3; hangY[k.nhan_duong] = T + H * 0.75;
      g.textAlign = "right"; g.fillStyle = MAU.chu;
      g.fillText("Thật " + k.ten_am, L - 8, hangY[k.nhan_am] + 4); g.fillText("Thật " + k.ten_duong, L - 8, hangY[k.nhan_duong] + 4);
      k.xac_suat.forEach(function (p, i) {
        var that = k.nhan[i], doan = p >= m.t ? k.nhan_duong : k.nhan_am, sai = that !== doan;
        var jit = ((i * 37) % 11 - 5) * 3.2;
        g.beginPath(); g.arc(X(p), hangY[that] + jit, sai ? 5.5 : 4, 0, 7);
        g.fillStyle = that === k.nhan_duong ? MAU.chinh : MAU.vang; g.globalAlpha = sai ? 1 : 0.55; g.fill(); g.globalAlpha = 1;
        if (sai) { g.strokeStyle = "#DC2626"; g.lineWidth = 2; g.stroke(); }
      });
      g.strokeStyle = "#DC2626"; g.lineWidth = 2.5; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(X(m.t), T); g.lineTo(X(m.t), T + H); g.stroke(); g.setLineDash([]);
      var dungAm = k.tong_am - m.bo_sot, dungDuong = k.tong_duong - m.bao_nham;
      mt.innerHTML = "<tr><th></th><th>Đoán " + k.ten_am + "</th><th>Đoán " + k.ten_duong + "</th></tr>" +
        "<tr><th>Thật " + k.ten_am + "</th><td class='dung'>" + dungAm + " đúng</td><td class='sai'>" + m.bo_sot + " bỏ sót</td></tr>" +
        "<tr><th>Thật " + k.ten_duong + "</th><td class='sai'>" + m.bao_nham + " báo nhầm</td><td class='dung'>" + dungDuong + " đúng</td></tr>";
      hang.querySelector('[data-id="acc"]').textContent = so(m.acc, 1) + "%";
      hang.querySelector('[data-id="bs"]').textContent = m.bo_sot + " bạn";
      hang.querySelector('[data-id="bn"]').textContent = m.bao_nham + " bạn";
    }
    r.addEventListener("input", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- chia_nhanh (chọn cột, kéo ngưỡng -> hai nhánh + Gini)
  function chiaNhanh(k) {
    var o = khung(k, "chia-nhanh"), ten = Object.keys(k.bang);
    var sc = el("select", { "aria-label": "cột" }, ten.map(function (c) { return el("option", { value: c, text: c }); }));
    var r = el("input", { type: "range", min: 0, max: 1, step: 1, value: 0, "aria-label": "ngưỡng" });
    var nhan = el("div", { class: "thong-bao" }), cv = canvas(640, 165);
    var hang = el("div", { class: "tt-the-hang" }, [the("Gini trước khi chia", "g0"), the("Gini còn lại sau khi chia", "g1"), the("Giảm được", "gd")]);
    o.appendChild(el("div", { class: "tt-hang" }, [el("label", {}, ["Hỏi theo cột ", sc])])); o.appendChild(nhan); o.appendChild(r);
    o.appendChild(cv.c); o.appendChild(hang);
    var tot = el("p", { class: "tt-ghi" }); o.appendChild(tot);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function doiCot() { var d = k.bang[sc.value]; r.max = d.length - 1; r.value = Math.floor(d.length / 2); ve(); }
    function ve() {
      var d = k.bang[sc.value], m = d[+r.value], g = cv.g;
      nhan.innerHTML = "Câu hỏi: <b>" + sc.value + " ≤ " + so(m.t, k.so_le[sc.value] || 0) + "</b> ?";
      g.clearRect(0, 0, cv.w, cv.h);
      [["Có (≤)", m.trai, 20], ["Không (>)", m.phai, 340]].forEach(function (nh) {
        var x0 = nh[2], w = 280, tong = nh[1][0] + nh[1][1], gi = tong ? 1 - Math.pow(nh[1][0] / tong, 2) - Math.pow(nh[1][1] / tong, 2) : 0;
        g.fillStyle = MAU.chu; g.font = "600 14px " + FONT; g.textAlign = "left";
        g.fillText(nh[0] + " — " + tong + " bạn", x0, 22);
        var h = 150, y0 = 36, wA = tong ? w * nh[1][0] / tong : 0;
        g.fillStyle = MAU.chinh; g.fillRect(x0, y0, wA, 46); g.fillStyle = MAU.vang; g.fillRect(x0 + wA, y0, w - wA, 46);
        if (!tong) { g.fillStyle = MAU.vien; g.fillRect(x0, y0, w, 46); }
        g.font = "13px " + FONT; g.fillStyle = MAU.chu;
        g.fillText(k.ten[0] + ": " + nh[1][0] + "   " + k.ten[1] + ": " + nh[1][1], x0, y0 + 70);
        g.fillText("Gini nhánh: " + so(gi, 3), x0, y0 + 92);
        g.fillStyle = gi < 0.2 ? MAU.teal : gi < 0.4 ? MAU.phu : "#DC2626";
        g.fillText(gi < 0.2 ? "khá thuần" : gi < 0.4 ? "còn lẫn" : "lẫn nhiều", x0, y0 + 114);
      });
      hang.querySelector('[data-id="g0"]').textContent = so(k.gini_goc, 3);
      hang.querySelector('[data-id="g1"]').textContent = so(m.gini, 3);
      hang.querySelector('[data-id="gd"]').textContent = so(k.gini_goc - m.gini, 3);
      var tb = null; ten.forEach(function (c) { k.bang[c].forEach(function (x) { if (!tb || x.gini < tb.gini) tb = { c: c, t: x.t, gini: x.gini }; }); });
      tot.innerHTML = m.gini <= tb.gini + 1e-9 ? "<b>Đây chính là câu hỏi máy chọn đầu tiên</b> — Gini còn lại nhỏ nhất trong mọi câu hỏi đã thử."
        : "Còn câu hỏi làm Gini nhỏ hơn nữa — thử tiếp cột khác hoặc ngưỡng khác.";
    }
    sc.addEventListener("change", doiCot); r.addEventListener("input", ve); doiCot();
    return o;
  }

  // ---------------------------------------------------------------- nhan_bayes (chọn mức từng cột -> phép nhân Naive Bayes)
  function nhanBayes(k) {
    var o = khung(k, "nhan-bayes"), cot = Object.keys(k.bang), chon = {};
    var hangChon = el("div", { class: "tt-hang" });
    cot.forEach(function (c) {
      var s = el("select", { "aria-label": c }, k.muc.map(function (m) { return el("option", { value: m, text: m }); }));
      s.value = k.mac_dinh[c]; chon[c] = s; s.addEventListener("change", ve);
      hangChon.appendChild(el("label", {}, [c + " ", s]));
    });
    var cb = el("input", { type: "checkbox" });
    hangChon.appendChild(el("label", { class: "tt-cong-tac-dong" }, [cb, el("span", { text: "Làm mịn: cộng 1 vào mỗi ô đếm" })]));
    cb.addEventListener("change", ve);
    var bang = el("table", { class: "bang" }), cv = canvas(640, 120), kl = el("div", { class: "thong-bao" });
    o.appendChild(hangChon); o.appendChild(bang); o.appendChild(cv.c); o.appendChild(kl);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function phan(a, b) { return a + "/" + b; }
    function ve() {
      var lam = cb.checked ? 1 : 0, M = k.muc.length, tich = [], dong = [];
      [0, 1].forEach(function (j) {
        var n = k.n[j], p = n / (k.n[0] + k.n[1]), txt = [phan(n, k.n[0] + k.n[1])];
        cot.forEach(function (c) {
          var dem = k.bang[c][chon[c].value][j] + lam, mau = n + lam * M;
          p *= dem / mau; txt.push(phan(dem, mau));
        });
        tich.push(p); dong.push("<tr><td><b>" + k.ten_lop[j] + "</b></td><td>" + txt.join(" × ") + "</td><td><b>" + so(p, 4) + "</b></td></tr>");
      });
      bang.innerHTML = "<tr><th>Nhãn</th><th>P(nhãn) × P(" + cot.join(" | nhãn) × P(") + " | nhãn)</th><th>Tích</th></tr>" + dong.join("");
      var g = cv.g, tong = tich[0] + tich[1]; g.clearRect(0, 0, cv.w, cv.h);
      [0, 1].forEach(function (j) {
        var y = 16 + j * 50, w = tong ? 430 * tich[j] / tong : 0;
        g.fillStyle = j ? MAU.vang : MAU.chinh; g.fillRect(130, y, w, 34);
        g.fillStyle = MAU.chu; g.font = "600 14px " + FONT; g.textAlign = "right"; g.fillText(k.ten_lop[j], 120, y + 22);
        g.textAlign = "left"; g.fillText(tong ? so(100 * tich[j] / tong, 1) + "%" : "0", 136 + w, y + 22);
      });
      if (!tong) kl.innerHTML = "Cả hai tích đều bằng 0 — máy không so được. Bật làm mịn để sửa.";
      else {
        var i = tich[0] >= tich[1] ? 0 : 1, gap = tich[1 - i] ? tich[i] / tich[1 - i] : Infinity;
        kl.innerHTML = "Naive Bayes đoán <b>" + k.ten_lop[i] + "</b>" + (isFinite(gap) ? " — tích lớn gấp " + so(gap, 1) + " lần." : " — tích bên kia bằng 0.");
      }
    }
    ve();
    return o;
  }

  // ---------------------------------------------------------------- kiem_dinh_cheo (lưới ô, k vòng, điểm từng vòng)
  function kiemDinhCheo(k) {
    var o = khung(k, "kiem-dinh-cheo"), n = k.nhan.length, K = k.phan.length, v = 0;
    var nut = [];
    var hangNut = el("div", { class: "tt-hang" });
    for (var i = 0; i < K; i++) (function (i) {
      var b = el("button", { type: "button", class: "tt-chip", text: "Vòng " + (i + 1) });
      b.addEventListener("click", function () { v = i; ve(); }); nut.push(b); hangNut.appendChild(b);
    })(i);
    var luoi = el("div", { class: "tt-luoi tt-luoi-nho" }), o_ = [];
    for (i = 0; i < n; i++) { var c = el("span", { class: "tt-o " + (k.nhan[i] === k.nhan_it ? "it" : "nhieu") }); o_.push(c); luoi.appendChild(c); }
    var cv = canvas(640, 150), hang = el("div", { class: "tt-the-hang" }, [the("Điểm vòng này", "d"), the("Trung bình tới vòng này", "tb"), the("Dao động", "dd")]);
    o.appendChild(hangNut); o.appendChild(luoi);
    o.appendChild(el("div", { class: "tt-chu-giai", html: '<span class="tt-o nhieu test"></span> ô viền đậm = phần đang làm <b>kiểm tra</b> ở vòng này; ô mờ = dùng để <b>huấn luyện</b>' }));
    o.appendChild(hang); o.appendChild(cv.c);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      var la = {}; k.phan[v].forEach(function (i) { la[i] = 1; });
      o_.forEach(function (c, i) { c.classList.toggle("test", !!la[i]); });
      nut.forEach(function (b, j) { b.classList.toggle("dang-chon", j === v); });
      var d = k.diem.slice(0, v + 1), tb = d.reduce(function (a, b) { return a + b; }, 0) / d.length;
      hang.querySelector('[data-id="d"]').textContent = so(k.diem[v], 1) + "%";
      hang.querySelector('[data-id="tb"]').textContent = so(tb, 1) + "%";
      hang.querySelector('[data-id="dd"]').textContent = so(Math.min.apply(null, d), 1) + " – " + so(Math.max.apply(null, d), 1) + "%";
      var t = truc(cv, -0.5, K - 0.5, k.ymin, 100, "Vòng", "Đúng (%)", vachDep(k.ymin, 100, 3)), g = cv.g;
      k.diem.forEach(function (s, j) {
        var bw = t.W / K * 0.5; g.fillStyle = j <= v ? MAU.chinh : "#E2E8F0"; g.fillRect(t.x(j) - bw / 2, t.y(s), bw, t.y(k.ymin) - t.y(s));
        g.fillStyle = MAU.phu; g.textAlign = "center"; g.fillText(String(j + 1), t.x(j), t.T + t.H + 16);
      });
      g.strokeStyle = "#DC2626"; g.setLineDash([6, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(t.L, t.y(tb)); g.lineTo(t.L + t.W, t.y(tb)); g.stroke(); g.setLineDash([]);
    }
    ve();
    return o;
  }

  // ---------------------------------------------------------------- can_tieu_chi (trọng số tiêu chí -> xếp hạng model)
  function canTieuChi(k) {
    var o = khung(k, "can-tieu-chi"), tc = k.tieu_chi, md = Object.keys(k.model), w = tc.map(function (c) { return c.mac_dinh; });
    var hop_ = el("div", { class: "tt-the-hang" });
    tc.forEach(function (c, i) {
      var r = el("input", { type: "range", min: 0, max: 3, step: 1, value: w[i], "aria-label": c.ten }), l = el("b", { class: "tt-muc" });
      r.addEventListener("input", function () { w[i] = +r.value; ve(); });
      hop_.appendChild(el("div", { class: "tt-the" }, [el("span", { text: c.ten }), l, r]));
      c._l = l;
    });
    var cv = canvas(640, 40 + 34 * md.length), bang = el("table", { class: "bang" });
    o.appendChild(hop_); o.appendChild(cv.c); o.appendChild(bang);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    var MUC = ["không quan tâm", "hơi quan trọng", "quan trọng", "rất quan trọng"];
    function chuan(c, v) {                                       // đưa về 0 – 1, 1 là tốt nhất
      var a = md.map(function (m) { return k.model[m][c.khoa]; }), lo = Math.min.apply(null, a), hi = Math.max.apply(null, a);
      if (hi === lo) return 1;
      return c.cang_nho_cang_tot ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo);
    }
    function ve() {
      tc.forEach(function (c, i) { c._l.textContent = MUC[w[i]]; });
      var tong = w.reduce(function (a, b) { return a + b; }, 0) || 1;
      var diem = md.map(function (m) { return [m, tc.reduce(function (s, c, i) { return s + w[i] * chuan(c, k.model[m][c.khoa]); }, 0) / tong]; });
      diem.sort(function (a, b) { return b[1] - a[1]; });
      var g = cv.g; g.clearRect(0, 0, cv.w, cv.h); g.font = "13px " + FONT;
      diem.forEach(function (d, j) {
        var y = 14 + j * 34; g.fillStyle = MAU.chu; g.textAlign = "right"; g.fillText((j + 1) + ". " + d[0], 150, y + 18);
        g.fillStyle = j === 0 ? MAU.chinh : "#93C5FD"; g.fillRect(160, y, 420 * d[1], 24);
        g.fillStyle = MAU.chu; g.textAlign = "left"; g.fillText(so(100 * d[1], 0) + " điểm", 166 + 420 * d[1], y + 17);
      });
      bang.innerHTML = "<tr><th>Model</th>" + tc.map(function (c) { return "<th>" + (c.cot || c.ten) + "</th>"; }).join("") + "</tr>" +
        md.map(function (m) { return "<tr><td>" + m + "</td>" + tc.map(function (c) { return "<td>" + c.hien(k.model[m][c.khoa]) + "</td>"; }).join("") + "</tr>"; }).join("");
    }
    tc.forEach(function (c) { c.hien = c.kieu === "phan_tram" ? function (v) { return so(v, 1) + "%"; } : c.kieu === "giay" ? function (v) { return so(v * 1000, 1) + " ms"; } : c.kieu === "sao" ? function (v) { return "★★★".slice(0, v) + "☆☆☆".slice(v); } : function (v) { return String(v); }; });
    ve();
    return o;
  }

  // ---------------------------------------------------------------- kmeans_buoc (k, điểm xuất phát, bấm từng bước)
  function kmeansBuoc(k) {
    var o = khung(k, "kmeans-buoc"), K = String(k.k_mac_dinh), s = "0", i = 0;
    var sk = el("select", { "aria-label": "số nhóm k" }, k.cac_k.map(function (x) { return el("option", { value: String(x), text: "k = " + x }); }));
    var ss = el("select", { "aria-label": "điểm xuất phát" }, k.cac_seed.map(function (x, j) { return el("option", { value: String(j), text: "Xuất phát " + (j + 1) }); }));
    sk.value = K;
    var lui = el("button", { type: "button", class: "nut phu", text: "◀ Lùi" }), toi = el("button", { type: "button", class: "nut", text: "Bước tiếp ▶" });
    var nhan = el("div", { class: "thong-bao" }), cv = canvas(640, 330);
    var hang = el("div", { class: "tt-the-hang" }, [the("Bước", "b"), the("Tổng khoảng cách² tới tâm", "in")]);
    o.appendChild(el("div", { class: "tt-hang" }, [el("label", {}, ["Số nhóm ", sk]), el("label", {}, ["", ss]), lui, toi]));
    o.appendChild(nhan); o.appendChild(cv.c); o.appendChild(hang);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    var MAUN = [MAU.chinh, MAU.vang, MAU.teal, "#7C3AED", "#DC2626"];
    function ve() {
      var ds = k.buoc[K + "|" + s], b = ds[i], g = cv.g;
      var t = truc(cv, -0.03, 1.03, -0.03, 1.03, k.nhan_x, k.nhan_y, [0, 0.25, 0.5, 0.75, 1]);
      g.fillStyle = MAU.phu; g.textAlign = "center";
      [0, 0.25, 0.5, 0.75, 1].forEach(function (x) { g.fillText(so(x, 2), t.x(x), t.T + t.H + 16); });
      for (var j = 0; j < k.x.length; j++) {
        g.beginPath(); g.arc(t.x(k.x[j]), t.y(k.y[j]), 3.4, 0, 7);
        g.fillStyle = b.gan ? MAUN[b.gan[j]] : "#94A3B8"; g.globalAlpha = 0.7; g.fill();
      }
      g.globalAlpha = 1;
      b.tam.forEach(function (c, j) {
        var px = t.x(c[0]), py = t.y(c[1]);
        g.fillStyle = "#fff"; g.strokeStyle = MAUN[j]; g.lineWidth = 3;
        g.beginPath(); g.moveTo(px - 9, py - 9); g.lineTo(px + 9, py + 9); g.moveTo(px + 9, py - 9); g.lineTo(px - 9, py + 9);
        g.strokeStyle = "#0F172A"; g.lineWidth = 6; g.stroke(); g.strokeStyle = MAUN[j]; g.lineWidth = 3.5; g.stroke();
      });
      nhan.innerHTML = b.viec;
      hang.querySelector('[data-id="b"]').textContent = i + " / " + (ds.length - 1);
      hang.querySelector('[data-id="in"]').textContent = b.inertia === null ? "—" : so(b.inertia, 2);
      lui.disabled = i === 0; toi.disabled = i === ds.length - 1;
    }
    lui.addEventListener("click", function () { if (i > 0) { i--; ve(); } });
    toi.addEventListener("click", function () { var ds = k.buoc[K + "|" + s]; if (i < ds.length - 1) { i++; ve(); } });
    sk.addEventListener("change", function () { K = sk.value; i = 0; ve(); });
    ss.addEventListener("change", function () { s = ss.value; i = 0; ve(); });
    ve();
    return o;
  }

  // ---------------------------------------------------------------- me_cung (Q-learning: kéo số tập -> mũi tên + đường đi)
  function meCung(k) {
    var o = khung(k, "me-cung"), M = k.moc, n = k.luoi.length;
    var r = el("input", { type: "range", min: 0, max: M.length - 1, step: 1, value: 0, "aria-label": "số tập đã học" });
    var nhan = el("div", { class: "thong-bao" }), cv = canvas(420, 420), kq = el("div", { class: "tt-the-hang" }, [the("Đi theo bảng Q", "kq"), the("Số bước", "sb")]);
    cv.c.style.maxWidth = "420px";
    o.appendChild(nhan); o.appendChild(r); o.appendChild(el("div", { class: "tt-hai-cot" }, [cv.c, kq]));
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    var MUI = [[0, -1], [0, 1], [-1, 0], [1, 0]];                // lên, xuống, trái, phải (dx, dy)
    function ve() {
      var m = M[+r.value], g = cv.g, s = 400 / n, x0 = 10, y0 = 10;
      nhan.innerHTML = "Đã học <b>" + m.tap + "</b> tập";
      g.clearRect(0, 0, cv.w, cv.h);
      var qmax = Math.max.apply(null, m.qmax.map(Math.abs).concat([1]));
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        var ky = k.luoi[i][j], x = x0 + j * s, y = y0 + i * s, q = m.qmax[i * n + j];
        g.fillStyle = ky === "#" ? "#334155" : ky === "H" ? "#FCA5A5" : ky === "G" ? "#86EFAC" :
          (q > 0 ? "rgba(37,99,235," + (0.12 + 0.5 * q / qmax) + ")" : q < 0 ? "rgba(245,158,11," + (0.1 + 0.4 * -q / qmax) + ")" : "#F8FAFC");
        g.fillRect(x, y, s - 2, s - 2);
        g.fillStyle = MAU.chu; g.font = "600 13px " + FONT; g.textAlign = "left";
        if (ky === "S") g.fillText("Xuất phát", x + 4, y + 16);
        if (ky === "G") g.fillText("Đích +10", x + 4, y + 16);
        if (ky === "H") g.fillText("Hố −10", x + 4, y + 16);
        if ((ky === "." || ky === "S") && m.huong[i * n + j] >= 0) {
          var d = MUI[m.huong[i * n + j]], cx = x + s / 2, cy = y + s / 2 + 6, L = s * 0.28;
          g.strokeStyle = MAU.dam; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - d[0] * L, cy - d[1] * L); g.lineTo(cx + d[0] * L, cy + d[1] * L); g.stroke();
          g.beginPath(); g.moveTo(cx + d[0] * L, cy + d[1] * L);
          g.lineTo(cx + d[0] * L - d[0] * 9 - d[1] * 6, cy + d[1] * L - d[1] * 9 - d[0] * 6);
          g.lineTo(cx + d[0] * L - d[0] * 9 + d[1] * 6, cy + d[1] * L - d[1] * 9 + d[0] * 6); g.closePath(); g.fillStyle = MAU.dam; g.fill();
        }
      }
      g.strokeStyle = "#DC2626"; g.lineWidth = 5; g.globalAlpha = 0.7; g.beginPath();
      m.duong.forEach(function (p, i) { var px = x0 + p[1] * s + s / 2, py = y0 + p[0] * s + s / 2; i ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.stroke(); g.globalAlpha = 1;
      kq.querySelector('[data-id="kq"]').textContent = m.ket_qua;
      kq.querySelector('[data-id="sb"]').textContent = m.ket_qua === "tới đích" ? (m.duong.length - 1) + " bước" : "—";
    }
    r.addEventListener("input", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- chuoi_du_bao (cửa sổ ngày + bật/tắt đường dự báo + MAE)
  function chuoiDuBao(k) {
    var o = khung(k, "chuoi-du-bao"), n = k.ngay.length, W = k.do_rong || 60, bat = k.duong.map(function () { return true; });
    var r = el("input", { type: "range", min: 0, max: n - W, step: 1, value: 0, "aria-label": "đoạn ngày" });
    var hangCb = el("div", { class: "tt-hang" }), nhan = el("div", { class: "thong-bao" });
    var MAUD = [MAU.vang, MAU.teal, "#7C3AED", "#DC2626"];
    k.duong.forEach(function (d, i) {
      var cb = el("input", { type: "checkbox" }); cb.checked = true;
      cb.addEventListener("change", function () { bat[i] = cb.checked; ve(); });
      hangCb.appendChild(el("label", { class: "tt-cong-tac-dong" }, [cb, el("span", { html: '<b style="color:' + MAUD[i] + '">━</b> ' + d.ten })]));
    });
    var cv = canvas(640, 280), hang = el("div", { class: "tt-the-hang" }, k.duong.map(function (d, i) { return the("MAE — " + d.ten, "m" + i); }));
    o.appendChild(nhan); o.appendChild(r); o.appendChild(hangCb); o.appendChild(cv.c); o.appendChild(hang);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      var a = +r.value, b = a + W, that = k.that.slice(a, b), hi = 0;
      [that].concat(k.duong.map(function (d) { return d.gia_tri.slice(a, b); })).forEach(function (s) { hi = Math.max(hi, Math.max.apply(null, s)); });
      hi = Math.ceil(hi / 50) * 50;
      nhan.innerHTML = "Từ <b>" + k.ngay[a] + "</b> đến <b>" + k.ngay[b - 1] + "</b>";
      var t = truc(cv, 0, W - 1, 0, hi, "Ngày", k.nhan_y, vachDep(0, hi, 5)), g = cv.g;
      g.fillStyle = MAU.phu; g.textAlign = "center";
      for (var j = 0; j < W; j += 10) g.fillText(k.ngay[a + j], t.x(j), t.T + t.H + 16);
      function ke(s, mau, day) { g.strokeStyle = mau; g.lineWidth = day; g.beginPath(); s.forEach(function (v, j) { j ? g.lineTo(t.x(j), t.y(v)) : g.moveTo(t.x(j), t.y(v)); }); g.stroke(); }
      k.duong.forEach(function (d, i) { if (bat[i]) ke(d.gia_tri.slice(a, b), MAUD[i], 1.8); });
      ke(that, MAU.dam, 2.6);
      k.duong.forEach(function (d, i) {
        var s = d.gia_tri.slice(a, b), m = s.reduce(function (acc, v, j) { return acc + Math.abs(v - that[j]); }, 0) / W;
        hang.querySelector('[data-id="m' + i + '"]').textContent = so(m, 1);
      });
    }
    r.addEventListener("input", ve); ve();
    return o;
  }

  // ---------------------------------------------------------------- app_thu (giả lập giao diện Gradio, kết quả tra lưới tính sẵn)
  function appThu(k) {
    var o = khung(k, "app-thu"), app = el("div", { class: "tt-app" }), vao = [];
    app.appendChild(el("div", { class: "tt-app-ten", text: k.ten_app }));
    k.dau_vao.forEach(function (d) {
      var r = el("input", { type: "range", min: d.min, max: d.max, step: d.buoc, value: d.mac_dinh, "aria-label": d.ten }), l = el("b");
      vao.push({ d: d, r: r, l: l });
      app.appendChild(el("label", { class: "tt-nhan-phu" }, [d.ten + ": ", l])); app.appendChild(r);
    });
    var chan = el("input", { type: "checkbox" });
    var nut = el("button", { type: "button", class: "nut", text: "Dự đoán" }), ra = el("div", { class: "tt-app-ra" });
    app.appendChild(el("label", { class: "tt-cong-tac-dong" }, [chan, el("span", { text: "Bật chặn đầu vào ngoài vùng dữ liệu" })]));
    app.appendChild(nut); app.appendChild(ra);
    o.appendChild(app);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function nhan() { vao.forEach(function (v) { v.l.textContent = so(+v.r.value, v.d.buoc < 1 ? 1 : 0) + " " + v.d.don_vi; }); }
    function doan() {
      var gt = vao.map(function (v) { return +v.r.value; });
      var ngoai = vao.filter(function (v, i) { return gt[i] < v.d.vung[0] || gt[i] > v.d.vung[1]; });
      if (chan.checked && ngoai.length) { ra.innerHTML = "<b>Ngoài phạm vi dữ liệu</b> — app không dự đoán. (" + ngoai.map(function (v) { return v.d.ten; }).join(", ") + ")"; ra.className = "tt-app-ra canh-bao"; return; }
      var i = Math.round((gt[0] - k.luoi.x0) / k.luoi.bx), j = Math.round((gt[1] - k.luoi.y0) / k.luoi.by);
      var p = k.luoi.p[i][j];
      ra.className = "tt-app-ra";
      ra.innerHTML = "Xác suất Đạt: <b>" + so(p, 1) + "%</b>" + (ngoai.length ? '<br><span class="tt-ghi">⚠ Đầu vào ngoài vùng dữ liệu đã học — model vẫn trả lời rất chắc, nhưng không đáng tin.</span>' : "");
    }
    vao.forEach(function (v) { v.r.addEventListener("input", nhan); });
    nut.addEventListener("click", doan); nhan(); doan();
    return o;
  }

  // ---------------------------------------------------------------- no_ron (kéo w1, w2, b -> đường ranh giới + độ chính xác)
  function noRon(k) {
    var o = khung(k, "no-ron"), tham = [k.w0[0], k.w0[1], k.w0[2]], ten = ["w₁ (giờ tự học)", "w₂ (phút mạng)", "b (hệ số chặn)"];
    var rs = [], ls = [];
    ten.forEach(function (tn, i) {
      var r = el("input", { type: "range", min: -15, max: 15, step: 0.1, value: tham[i], "aria-label": tn }), l = el("b");
      r.addEventListener("input", function () { tham[i] = +r.value; ve(); }); rs.push(r); ls.push(l);
      o.appendChild(el("label", { class: "tt-nhan-phu" }, [tn + " = ", l])); o.appendChild(r);
    });
    var nut = el("button", { type: "button", class: "nut phu", text: "Dùng trọng số máy tìm được" });
    nut.addEventListener("click", function () { tham = k.w_may.slice(); rs.forEach(function (r, i) { r.value = tham[i]; }); ve(); });
    var cv = canvas(640, 330), hang = el("div", { class: "tt-the-hang" }, [the("Đoán đúng (tập huấn luyện)", "acc"), the(k.vd.ten, "vd")]);
    o.appendChild(el("div", { class: "tt-hang" }, [nut])); o.appendChild(cv.c); o.appendChild(hang);
    if (k.ghi) o.appendChild(el("p", { class: "tt-ghi", html: k.ghi }));
    function ve() {
      ls.forEach(function (l, i) { l.textContent = so(tham[i], 1); });
      var t = truc(cv, -0.03, 1.03, -0.03, 1.03, k.nhan_x, k.nhan_y, [0, 0.25, 0.5, 0.75, 1]), g = cv.g;
      g.fillStyle = MAU.phu; g.textAlign = "center";
      [0, 0.25, 0.5, 0.75, 1].forEach(function (x) { g.fillText(so(x, 2), t.x(x), t.T + t.H + 16); });
      var dung = 0;
      for (var i = 0; i < k.x.length; i++) {
        var z = tham[0] * k.x[i] + tham[1] * k.y[i] + tham[2], doan = z > 0 ? 1 : 0;
        if (doan === k.nhan[i]) dung++;
        g.beginPath(); g.arc(t.x(k.x[i]), t.y(k.y[i]), doan === k.nhan[i] ? 3.4 : 5, 0, 7);
        g.fillStyle = k.nhan[i] ? MAU.chinh : MAU.vang; g.globalAlpha = 0.75; g.fill(); g.globalAlpha = 1;
        if (doan !== k.nhan[i]) { g.strokeStyle = "#DC2626"; g.lineWidth = 1.8; g.stroke(); }
      }
      // đường w1·x + w2·y + b = 0 trong khung [0, 1] × [0, 1]
      g.save(); g.beginPath(); g.rect(t.L, t.T, t.W, t.H); g.clip();
      g.strokeStyle = MAU.dam; g.lineWidth = 3;
      g.beginPath();
      if (Math.abs(tham[1]) > 1e-6) { g.moveTo(t.x(-0.1), t.y(-(tham[0] * -0.1 + tham[2]) / tham[1])); g.lineTo(t.x(1.1), t.y(-(tham[0] * 1.1 + tham[2]) / tham[1])); }
      else if (Math.abs(tham[0]) > 1e-6) { var xc = -tham[2] / tham[0]; g.moveTo(t.x(xc), t.y(-0.1)); g.lineTo(t.x(xc), t.y(1.1)); }
      g.stroke(); g.restore();
      var zv = tham[0] * k.vd.x1 + tham[1] * k.vd.x2 + tham[2];
      hang.querySelector('[data-id="acc"]').textContent = so(100 * dung / k.x.length, 1) + "%";
      hang.querySelector('[data-id="vd"]').textContent = so(100 / (1 + Math.exp(-zv)), 0) + "% Đạt";
    }
    ve();
    return o;
  }

  window.ML1_TT = {
    init: function (hamEl) { el = hamEl; },
    tra_bang: traBang, du_doan_tu: duDoanTu, phan_tan_3d: phanTan3d, loc_bang: locBang,
    histogram: histogram, chay_tung_dong: chayTungDong, keo_diem: keoDiem,
    duong_thang: duongThang, mat_3d: mat3d, cong_tac: congTac, chia_du_lieu: chiaDuLieu, bieu_do_hop: bieuDoHop, phan_tan_2d: phanTan2d, knn: knn, mat_phang: matPhang, nguong_nham_lan: nguongNhamLan, chia_nhanh: chiaNhanh, nhan_bayes: nhanBayes, kiem_dinh_cheo: kiemDinhCheo, can_tieu_chi: canTieuChi, kmeans_buoc: kmeansBuoc, me_cung: meCung, chuoi_du_bao: chuoiDuBao, app_thu: appThu, no_ron: noRon
  };
})();
