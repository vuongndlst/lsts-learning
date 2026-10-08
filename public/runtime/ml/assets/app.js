/* Bộ chạy bài học tự học theo chặng — dùng chung cho mọi môn.
 * Mỗi bài có file data.js đặt window.BAI = {...} (sinh bằng lib_web.py).
 *
 * Luồng: nhập tên/lớp -> từng chặng (qua checkpoint mới mở chặng sau) -> checkpoint cuối
 * (rút đề mới mỗi lần) -> đạt ngưỡng thì vẽ chứng chỉ PNG có mã xác nhận.
 *
 * Lưu trên trình duyệt (localStorage): tên, lớp, chặng đã qua, câu trả lời đang làm ở từng
 * checkpoint, vị trí cuộn của từng chặng, lịch sử các lần làm checkpoint cuối, điểm cao nhất.
 * Đáp án chỉ lưu dạng băm (cyrb53) — trang không chứa đáp án dạng chữ.
 */
(function () {
  "use strict";
  var B = window.BAI;
  var TG = (window.THE_GIOI || {})[B.ma] || {};
  if (TG.mau) document.documentElement.style.setProperty("--world-accent", TG.mau);
  var KHOA_CC = B.khoa_cc || "LSTS-ML1-CC";
  var app = document.getElementById("app");
  var LUU = (B.tien_to_luu || "ml1_") + B.ma;
  var SEP = "\u0001";
  // Chế độ nhúng (?nhung=1): trang chạy trong khung của game quest 3D (quest.html) — ẩn đầu/cuối trang, mở đúng
  // chặng (?chang=i) hoặc checkpoint cuối (?cuoi=1), báo tiến độ cho trang cha bằng postMessage.
  var Q = new URLSearchParams(location.search);
  var NHUNG = Q.get("nhung") === "1" && window.parent !== window;
  var DUNG_SAU_CHANG = NHUNG && Q.get("dung_sau_chang") === "1";
  function guiCha(m) {
    if (!NHUNG) return;
    m.ma = B.ma;
    try { window.parent.postMessage(m, location.origin === "null" ? "*" : location.origin); } catch (e) { /* bỏ qua */ }
  }

  // ------------------------------------------------------------ tiện ích
  function cyrb53(str, seed) {
    seed = seed || 0;
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function bam(s) { return cyrb53(String(s).normalize("NFC")).toString(16); }
  function khongDau(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();
  }
  function maXacNhan(bai, ten, lop) {
    var h = cyrb53([KHOA_CC, bai, khongDau(ten), khongDau(lop).replace(/ /g, "")].join("|"));
    return ("000000" + (h % 16777216).toString(16).toUpperCase()).slice(-6);
  }
  window.ML1_maXacNhan = maXacNhan;
  function tron(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function el(tag, attrs, con) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] === undefined || attrs[k] === null) continue;
      if (k === "html") e.innerHTML = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (con || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function docLuu() { try { return JSON.parse(localStorage.getItem(LUU)) || {}; } catch (e) { return {}; } }
  var TT = docLuu();
  TT.qua = TT.qua || 0;
  TT.passedStages = Array.isArray(TT.passedStages) ? TT.passedStages : Array.from({length:Math.min(TT.qua,B.chang.length)},function(_,i){return i;});
  TT.finalPassed = Boolean(TT.finalPassed || TT.dat);
  TT.tl = TT.tl || {};          // câu trả lời đang làm: {id câu: chuỗi trả lời}
  TT.cuon = TT.cuon || {};      // vị trí cuộn từng chặng
  TT.lich_su = TT.lich_su || []; // [{ngay, diem}]
  TT.lan_sai = TT.lan_sai || {}; // số lần kiểm tra chưa đạt của từng chặng
  var luuDuoc = true;
  function ghi() {
    try { localStorage.setItem(LUU, JSON.stringify(TT)); } catch (e) { luuDuoc = false; }
    guiCha({ loai: "tien_do", qua: TT.qua, dat: !!TT.dat, ten: TT.ten || "" });
  }
  function so(x, d) { return Number(x).toFixed(d === undefined ? 1 : d); }
  function ngayNay() {
    var d = new Date();
    return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear();
  }

  // ------------------------------------------------------------ khung trang
  var thanh, nguoiEl, main, changDang = null;
  function dungKhung() {
    document.title = B.nhan + " — " + B.tieu_de + " · " + B.khoa;
    if (NHUNG) {
      document.documentElement.classList.add("nhung");
      var st = document.createElement("style");
      st.textContent = ".nhung header.dau, .nhung footer, .nhung nav.cac-chang { display: none; }";
      document.head.appendChild(st);
    }
    thanh = el("div");
    nguoiEl = el("button", { class: "nguoi", title: "Đổi họ tên / lớp", onclick: function () { moDau(); } });
    var dau = el("header", { class: "dau" }, [
      el("div", { class: "dau-trong" }, [
        el("a", { href: "../", title: "Về trang chủ khoá học" }, [el("img", { src: "../assets/logo_lsts_trang.png", alt: "Logo trường" })]),
        el("div", {}, [el("div", { class: "ten-khoa", text: B.khoa + " · " + B.phan }),
                       el("div", { class: "ten-bai", text: B.nhan + " — " + B.tieu_de })]),
        nguoiEl]),
      el("div", { class: "thanh-tien-do" }, [thanh])]);
    main = el("main");
    var chan = el("footer", { html: B.chan_trang });
    app.appendChild(dau); app.appendChild(main); app.appendChild(chan);
    var hen = null;
    window.addEventListener("scroll", function () {
      if (changDang === null) return;
      clearTimeout(hen);
      hen = setTimeout(function () { TT.cuon[changDang] = window.scrollY; ghi(); }, 400);
    });
  }
  function capNhatDau() {
    var tong = B.chang.length + 1;
    thanh.style.width = Math.round(100 * Math.min(TT.passedStages.length+(TT.dat?1:0), tong) / tong) + "%";
    nguoiEl.textContent = TT.ten ? TT.ten + " · " + TT.lop : "";
  }
  function thanhChang(dang) {
    var wrap = el("nav", { class: "cac-chang", "aria-label": "Các chặng" });
    B.chang.forEach(function (c, i) {
      var b = el("button", { text: (TT.passedStages.includes(i) ? "✓ " : "") + (i + 1) + ". " + c.ten_ngan, onclick: function () { moChang(i); } });
      if (TT.passedStages.includes(i)) b.className = "xong";
      if (i === dang) b.className = "dang";
      if (i > TT.qua && !window.PORTAL_SELF_STUDY) b.disabled = true;
      wrap.appendChild(b);
    });
    var bc = el("button", { text: (TT.dat ? "✓ " : "") + "Checkpoint cuối", onclick: moCuoi });
    if (dang === "cuoi") bc.className = "dang";
    if (TT.qua < B.chang.length && !window.PORTAL_SELF_STUDY) bc.disabled = true;
    wrap.appendChild(bc);
    return wrap;
  }
  function len(y) { window.scrollTo({ top: y || 0, behavior: y ? "auto" : "smooth" }); }
  function canhBaoLuu() {
    return luuDuoc ? null : el("div", { class: "hop chu-y", html: "<b>Trình duyệt đang chặn lưu tiến độ</b> (chế độ ẩn danh?). Con vẫn học được, nhưng đóng trang là mất tiến độ." });
  }

  // Một câu dẫn vào việc học, trước khi học sinh cần đọc mục tiêu và lộ trình chi tiết.
  var LOI_DAN = {
    bai01: "Nhìn quanh con: ứng dụng nào thực sự dùng AI? Hãy thử phân biệt bằng ví dụ quen thuộc.",
    bai02: "Máy học từ ví dụ như thế nào? Con sẽ thử đóng vai người dạy máy.",
    bai03: "Con sẽ chạy vài dòng Python trên Colab và đọc kết quả, từng bước một.",
    bai04: "Một bảng dữ liệu có thể được đọc, tính toán và vẽ thành biểu đồ bằng Python.",
    bai05: "Hai lớp có điểm trung bình gần nhau. Còn điều gì cần xem trước khi kết luận?",
    bai06: "Nếu mỗi học sinh là một điểm trên biểu đồ, ta đo hai bạn giống nhau ra sao?",
    bai07: "Dữ liệu có ô trống hoặc viết không thống nhất. Con sẽ tìm và sửa chúng.",
    bai08: "Trước khi huấn luyện, ta cần chọn đặc điểm và tách dữ liệu đúng cách.",
    bai09: "Một biểu đồ tốt giúp con thấy điều khó nhận ra trong bảng số liệu.",
    bai10: "Hai đại lượng cùng thay đổi có chắc cái này gây ra cái kia không?",
    bai12: "Con sẽ xem máy học từ dữ liệu có đáp án và thử nhận ra khi mô hình học thuộc.",
    bai13: "KNN dự đoán bằng cách nhìn các ví dụ gần nhất. Con sẽ thử làm như máy.",
    bai15: "Có thể ước lượng giá điện thoại cũ từ vài thông tin của máy không?",
    bai16: "Mô hình có thể trả về xác suất đạt, rồi dùng ngưỡng để đưa ra quyết định.",
    bai18: "Cây quyết định đặt câu hỏi từng bước. Con sẽ theo nhánh để hiểu một dự đoán.",
    bai20: "Nhiều mô hình cùng dự đoán có thể cho kết quả khác một mô hình đơn lẻ.",
    bai21: "Con sẽ thử dùng tần suất và xác suất để phân loại một trường hợp mới.",
    bai22: "Hãy tìm một ranh giới chia hai nhóm và xem vì sao khoảng cách tới ranh giới quan trọng.",
    bai24: "Một lần chia dữ liệu có thể may hoặc rủi. Con sẽ xem cách kiểm tra nhiều lần.",
    bai25: "Không có một mô hình tốt nhất cho mọi bài toán. Con sẽ chọn theo dữ liệu và mục tiêu.",
    bai26: "Khi chưa có nhãn, máy vẫn có thể gom các điểm giống nhau thành nhóm.",
    bai28: "Một tác nhân học đường đi bằng cách thử, nhận phản hồi và điều chỉnh.",
    bai29: "Con sẽ nhìn cách nhiều nơ-ron nối với nhau để tạo ra dự đoán.",
    bai30: "Dữ liệu theo ngày có thứ tự thời gian. Con sẽ dùng quá khứ để dự đoán ngày sau.",
    bai31: "Một mô hình chỉ hữu ích khi người khác có thể nhập dữ liệu và xem dự đoán."
  };

  function theDuLieu(nho) {
    if (!B.du_lieu || !B.du_lieu.length) return null;
    var khung = el("section", { class: "the du-lieu-card" });
    khung.appendChild(el("span", { class: "nhan", text: "Dữ liệu của bài" }));
    khung.appendChild(el(nho ? "h3" : "h2", { text: "Xem CSV trước khi dùng trong Colab" }));
    khung.appendChild(el("p", { text: "CSV là bảng dữ liệu: dòng đầu ghi tên cột; các dòng sau là từng trường hợp." }));
    B.du_lieu.forEach(function (d) {
      var khoi = el("div", { class: "du-lieu-tep" });
      khoi.appendChild(el("div", { class: "du-lieu-dau" }, [
        el("div", {}, [el("b", { text: d.ten }), el("small", { text: d.so_dong + " dòng dữ liệu · " + d.cot.length + " cột · " + d.tep })]),
        el("a", { class: "nut du-lieu-tai", href: d.url, download: d.tep, text: "↓ Tải CSV" })]));
      var chiTiet = el("details", { class: "du-lieu-chi-tiet" });
      chiTiet.appendChild(el("summary", { text: "Xem tên cột và 3 dòng mẫu" }));
      chiTiet.appendChild(el("p", { text: d.mo_ta }));
      var bang = el("table", { class: "bang du-lieu-bang" });
      var head = el("thead");
      head.appendChild(el("tr", {}, d.cot.map(function (c) { return el("th", { text: c, scope: "col" }); })));
      bang.appendChild(head);
      var body = el("tbody");
      (d.mau || []).forEach(function (dong) { body.appendChild(el("tr", {}, d.cot.map(function (_, j) {
        return el("td", { text: dong[j] === "" ? "(trống)" : (dong[j] || "") });
      }))); });
      bang.appendChild(body);
      chiTiet.appendChild(el("div", { class: "du-lieu-cuon" }, [bang]));
      var giai = d.cot.map(function (c, j) { return d.giai_thich[j] ? c + ": " + d.giai_thich[j] : ""; }).filter(Boolean);
      if (giai.length) chiTiet.appendChild(el("p", { class: "du-lieu-chu-giai", text: giai.join(" · ") }));
      khoi.appendChild(chiTiet);
      khung.appendChild(khoi);
    });
    return khung;
  }

  // ------------------------------------------------------------ màn bắt đầu
  function moDau() {
    changDang = null;
    capNhatDau();
    main.innerHTML = "";
    var t = el("section", { class: "the mo-dau-hero" });
    t.appendChild(el("span", { class: "nhan", text: B.nhan + " · " + B.thoi_gian }));
    t.appendChild(el("h1", { text: B.tieu_de }));
    t.appendChild(el("div", { class: "cau-lon", text: B.cau_hoi }));
    t.appendChild(el("p", { class: "loi-dan-ngan", text: LOI_DAN[B.ma] || "Con sẽ khám phá câu hỏi này qua từng chặng ngắn." }));
    main.appendChild(t);

    var f = el("form", { class: "the mo-dau-form" });
    f.appendChild(el("span", { class: "nhan", text: "Bước 1 · Thông tin học sinh" }));
    f.appendChild(el("h2", { text: TT.ten ? "Kiểm tra thông tin rồi học tiếp" : "Nhập thông tin để bắt đầu" }));
    f.appendChild(el("p", { class: "goi-y-form", text: "Dùng họ tên có dấu và lớp của con. Thông tin này sẽ in trên chứng chỉ." }));
    var iTen = el("input", { class: "o", id: "ten", name: "ten", autocomplete: "name", placeholder: "Ví dụ: Nguyễn Minh Anh", required: "", "aria-describedby": "loi-ten" });
    var iLop = el("select", { class: "o", id: "lop", name: "lop", required: "", "aria-describedby": "loi-lop" });
    iLop.appendChild(el("option", { value: "", text: "Chọn lớp của con" }));
    var dsLop = B.ds_lop || [];
    dsLop.forEach(function (l) { iLop.appendChild(el("option", { value: l, text: l })); });
    iTen.value = TT.ten || ""; iLop.value = dsLop.indexOf(TT.lop) >= 0 ? TT.lop : "";
    var loiTen = el("small", { class: "loi-truong", id: "loi-ten", "aria-live": "polite" });
    var loiLop = el("small", { class: "loi-truong", id: "loi-lop", "aria-live": "polite" });
    iTen.addEventListener("input", function () { loiTen.textContent = ""; iTen.removeAttribute("aria-invalid"); });
    iLop.addEventListener("change", function () { loiLop.textContent = ""; iLop.removeAttribute("aria-invalid"); });
    var nut = el("button", { class: "nut", type: "submit", text: TT.qua >= B.chang.length ? "Vào checkpoint cuối →" :
      TT.qua ? "Học tiếp chặng " + (TT.qua + 1) + " →" : "Vào chặng 1 →" });
    var choi = TG.ten && !NHUNG ? el("button", { class: "nut phu", type: "button", text: "Khám phá 3D →" }) : null;
    function batDau(choi3D) {
      var ten = iTen.value.replace(/\s+/g, " ").trim(), lop = iLop.value;
      if (ten.split(" ").length < 2) { loiTen.textContent = "Nhập cả họ và tên của con."; iTen.setAttribute("aria-invalid", "true"); iTen.focus(); return; }
      if (dsLop.indexOf(lop) < 0) { loiLop.textContent = "Chọn một lớp trong danh sách."; iLop.setAttribute("aria-invalid", "true"); iLop.focus(); return; }
      if (TT.dat && TT.ten && khongDau(TT.ten) !== khongDau(ten) &&
          !confirm("Đổi tên sẽ làm chứng chỉ cũ không còn khớp mã. Vẫn đổi?")) return;
      TT.ten = ten; TT.lop = lop; ghi();
      if (choi3D) { location.href = "quest.html"; return; }
      if (NHUNG) {
        var cq0 = Q.get("chang");
        if (cq0 !== null) moChang(Math.min(+cq0 || 0, TT.qua));
        else if (Q.get("cuoi") && TT.qua >= B.chang.length) moCuoi();
        else guiCha({ loai: "dong" });
        return;
      }
      if (TT.qua >= B.chang.length) moCuoi(); else moChang(TT.qua);
    }
    f.addEventListener("submit", function (ev) { ev.preventDefault(); batDau(false); });
    if (choi) choi.addEventListener("click", function () { batDau(true); });
    f.appendChild(el("label", { class: "o", for: "ten", text: "Họ và tên" })); f.appendChild(iTen); f.appendChild(loiTen);
    f.appendChild(el("label", { class: "o", for: "lop", text: "Lớp" })); f.appendChild(iLop); f.appendChild(loiLop);
    f.appendChild(el("div", { class: "hang-nut" }, [nut, choi]));
    if (TG.ten && !NHUNG) f.appendChild(el("p", { class: "goi-y-form", text: "Hai cách học dùng chung tiến độ. Hành trình 3D có tên: " + TG.ten + "." }));
    main.appendChild(f);
    if (!NHUNG) {
      var csv = theDuLieu(false); if (csv) main.appendChild(csv);
      var them = el("details", { class: "the mo-dau-them" });
      them.appendChild(el("summary", { text: "Xem mục tiêu và lộ trình bài học" }));
      (B.gioi_thieu || []).forEach(function (p) { them.appendChild(el("p", { html: p })); });
      if (B.muc_tieu && B.muc_tieu.length) {
        them.appendChild(el("h3", { text: "Sau bài học, con có thể" }));
        them.appendChild(el("ul", { class: "ds" }, B.muc_tieu.map(function (m) { return el("li", { html: m }); })));
      }
      var bd = el("div", { class: "ban-do" });
      B.chang.forEach(function (c, i) {
        bd.appendChild(el("div", { class: TT.passedStages.includes(i) ? "xong" : "" }, [el("b", { text: (TT.passedStages.includes(i) ? "✓ " : "") + "Chặng " + (i + 1) + " · " + c.phut + " phút" }), c.ten]));
      });
      bd.appendChild(el("div", {}, [el("b", { text: "Checkpoint cuối" }), B.cuoi.so_cau + " câu · đạt " + B.cuoi.dat + "/" + B.cuoi.so_cau + " nhận chứng chỉ"]));
      them.appendChild(bd);
      main.appendChild(them);
    }
    var cb = canhBaoLuu(); if (cb) main.appendChild(cb);
  }

  // ------------------------------------------------------------ khối nội dung
  function anhCoDuPhong(src, du_phong, attrs) {
    var img = el("img", Object.assign({ src: src, loading: "lazy" }, attrs || {}));
    if (du_phong) img.addEventListener("error", function () { if (img.src.indexOf(du_phong) < 0) img.src = du_phong; });
    return img;
  }
  function veKhoi(k) {
    switch (k.t) {
      case "p": return el("p", { html: k.html });
      case "h": return el("h3", { text: k.text });
      case "ds": return el("ul", { class: "ds" }, k.muc.map(function (m) { return el("li", { html: m }); }));
      case "cong_thuc": return el("div", { class: "cong-thuc", html: k.html });
      case "hop": return el("div", { class: "hop " + k.kieu }, [
        k.tieu_de ? el("div", { class: "tieu-de-hop", text: k.tieu_de }) : null,
        el("div", { html: k.html })]);
      case "dinh_nghia": return el("div", { class: "dinh-nghia" }, [
        el("div", { class: "ten-kn", html: k.ten }), el("div", { html: k.html }),
        k.ky_hieu ? el("div", { class: "ky-hieu", html: k.ky_hieu }) : null]);
      case "anh": {
        var fig = el("figure", { class: "hinh" }, [anhCoDuPhong(k.src, k.du_phong, { alt: k.alt || "" }),
          el("figcaption", { html: (k.cap || "") + (k.nguon ? ' <span>· Nguồn: <a href="' + k.nguon.url +
            '" target="_blank" rel="noopener">' + k.nguon.ten + "</a></span>" : "") })]);
        if (k.chu_giai && k.chu_giai.length) {
          var tb = el("table", { class: "chu-giai" }, [el("caption", { text: "Chú giải thuật ngữ trong hình" })]);
          k.chu_giai.forEach(function (c) { tb.appendChild(el("tr", {}, [el("td", { class: "en", html: c[0] }), el("td", { html: c[1] })])); });
          fig.appendChild(tb);
        }
        return fig;
      }
      case "video": {
        var src = "https://www.youtube-nocookie.com/embed/" + k.yt + "?rel=0" + (k.bat_dau ? "&start=" + k.bat_dau : "") + (k.ket_thuc ? "&end=" + k.ket_thuc : "");
        return el("div", { class: "video" }, [
          el("div", { class: "khung" }, [el("iframe", { src: src, title: k.ten, loading: "lazy",
            allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture", allowfullscreen: "" })]),
          el("div", { class: "chu-thich", html: "▶ " + k.ten + (k.ghi_chu ? " — " + k.ghi_chu : "") +
            ' · <a href="https://www.youtube.com/watch?v=' + k.yt + '" target="_blank" rel="noopener">mở trên YouTube</a>' })]);
      }
      case "bang": return veBang(k.cot, k.dong, k.nhan_manh);
      case "vi_du": {
        var o = el("div", { class: "vi-du-bang" }, [el("div", { class: "tieu-de-hop", text: "Ví dụ — " + k.tieu_de })]);
        if (k.de) o.appendChild(el("p", { html: k.de }));
        o.appendChild(veBang(k.cot, k.dong, k.nhan_manh));
        if (k.ket_luan) o.appendChild(el("p", { class: "ket-luan", html: k.ket_luan }));
        return o;
      }
      case "loi_hay_gap": return el("div", { class: "hop chu-y" }, [el("div", { class: "tieu-de-hop", text: "Lỗi hay gặp" }),
        el("ul", { class: "ds" }, k.muc.map(function (m) { return el("li", { html: m }); }))]);
      case "tom_tat": return el("div", { class: "tom-tat", html: "<b>Tóm tắt:</b> " + k.html });
      case "doc_them": return el("div", { class: "hop doc-them" }, [
        el("div", { class: "tieu-de-hop", text: "Đọc thêm" }),
        el("ul", { class: "ds" }, k.link.map(function (l) {
          var ten = l.url ? '<a href="' + l.url + '" target="_blank" rel="noopener">' + l.ten + "</a>" : "<b>" + l.ten + "</b>";
          return el("li", { html: ten + (l.ghi_chu ? " — " + l.ghi_chu : "") });
        }))]);
      case "demo_tb_tv": return demoTbTv(k);
      case "demo_truot": return demoTruot(k);
      case "demo_khoang_cach": return demoKhoangCach(k);
      case "demo_tung_buoc": return demoTungBuoc(k);
      case "demo_truc": return demoTruc(k);
      case "demo_phan_tan": return demoPhanTan(k);
      case "demo_ke_duong": return demoKeDuong(k);
    }
    if (window.ML1_TT && window.ML1_TT[k.t]) { window.ML1_TT.init(el); return window.ML1_TT[k.t](k); }
    return el("p", { text: "[khối chưa hỗ trợ: " + k.t + "]" });
  }
  function veBang(cot, dong, nhan_manh) {
    var tb = el("table", { class: "bang" });
    tb.appendChild(el("tr", {}, cot.map(function (c) { return el("th", { html: c }); })));
    dong.forEach(function (d, i) {
      var tr = el("tr", { class: (nhan_manh || []).indexOf(i) >= 0 ? "nhan-manh" : "" }, d.map(function (c) { return el("td", { html: String(c) }); }));
      tb.appendChild(tr);
    });
    return el("div", { class: "bang-wrap" }, [tb]);
  }
  function trungVi(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }
  function demoTbTv(k) {
    var vals = k.gia_tri.slice();
    var o = el("div", { class: "demo" }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    o.appendChild(el("p", { html: k.huong_dan }));
    var hang = el("div", { class: "so" }), kq = el("div", { class: "ket-qua" });
    var bTb = el("b"), bTv = el("b");
    kq.appendChild(el("div", {}, [el("span", { text: "Trung bình" }), bTb]));
    kq.appendChild(el("div", {}, [el("span", { text: "Trung vị" }), bTv]));
    function tinh() {
      var tb = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      bTb.textContent = so(tb, 1); bTv.textContent = so(trungVi(vals), 1);
    }
    vals.forEach(function (v, i) {
      if (i === k.sua) {
        var ip = el("input", { type: "number", value: v, min: 0, max: 5000, "aria-label": "giá trị có thể sửa" });
        ip.addEventListener("input", function () { var x = parseFloat(ip.value); if (!isNaN(x)) { vals[i] = x; tinh(); } });
        hang.appendChild(ip);
      } else hang.appendChild(el("span", { text: String(v) }));
    });
    o.appendChild(hang); o.appendChild(kq); tinh();
    return o;
  }
  function demoTruot(k) {
    var o = el("div", { class: "demo" }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    o.appendChild(el("p", { html: k.huong_dan }));
    var nhan = el("div", { class: "thong-bao" });
    var r = el("input", { type: "range", min: 0, max: k.moc.length - 1, step: 1, value: k.bat_dau || 0, "aria-label": k.tieu_de });
    var kq = el("div", { class: "ket-qua" });
    var b1 = el("b"), b2 = el("b");
    kq.appendChild(el("div", {}, [el("span", { text: k.nhan_n }), b1]));
    kq.appendChild(el("div", {}, [el("span", { text: k.nhan_p }), b2]));
    function ve() {
      var m = k.moc[+r.value];
      nhan.innerHTML = k.dieu_kien.replace("{x}", "<b>" + so(m.x, k.so_le_x) + "</b>");
      b1.textContent = m.n; b2.textContent = m.n ? so(m.p, 1) + "%" : "—";
    }
    r.addEventListener("input", ve);
    o.appendChild(nhan); o.appendChild(r); o.appendChild(kq); ve();
    return o;
  }
  // Khoảng cách Euclid giữa hai điểm, hiện từng bước; tuỳ chọn đưa từng cột về 0 – 1 trước khi đo.
  function demoKhoangCach(k) {
    var o = el("div", { class: "demo" }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    o.appendChild(el("p", { html: k.huong_dan }));
    var ten = Object.keys(k.diem), P = {};
    ten.forEach(function (t) { P[t] = k.diem[t].slice(); });
    var tbN = el("table", { class: "bang nhap-diem" });
    tbN.appendChild(el("tr", {}, [el("th", { text: "Điểm" })].concat(k.cot.map(function (c) { return el("th", { html: c }); }))));
    ten.forEach(function (t) {
      tbN.appendChild(el("tr", {}, [el("td", { html: "<b>" + t + "</b>" })].concat(k.cot.map(function (_, j) {
        var ip = el("input", { type: "number", step: "any", value: P[t][j], "aria-label": t + " — " + k.cot[j] });
        ip.addEventListener("input", function () { var x = parseFloat(ip.value); if (!isNaN(x)) { P[t][j] = x; tinh(); } });
        return el("td", {}, [ip]);
      }))));
    });
    o.appendChild(el("div", { class: "bang-wrap" }, [tbN]));
    var hop = null;
    if (k.mien) {
      hop = el("input", { type: "checkbox", id: "cb-" + Math.random().toString(36).slice(2) });
      hop.addEventListener("change", tinh);
      o.appendChild(el("label", { class: "chon-thang-do", for: hop.id }, [hop,
        el("span", { html: " " + (k.nhan_thang_do || "Đưa từng cột về 0 – 1 trước khi đo") })]));
    }
    var buoc = el("div", { class: "bang-wrap" }), kq = el("div", { class: "ket-qua" }), bKc = el("b");
    kq.appendChild(el("div", {}, [el("span", { text: "Khoảng cách " + ten[0] + " → " + ten[1] }), bKc]));
    o.appendChild(buoc); o.appendChild(kq);
    // Sau khi đổi về 0 – 1, làm tròn 3 chữ số rồi mới trừ — khớp với cách học sinh tính tay.
    function doi(v, j) {
      return hop && hop.checked ? Math.round((v - k.mien[j][0]) / (k.mien[j][1] - k.mien[j][0]) * 1000) / 1000 : v;
    }
    function f(x, d) { var r = Math.round(x * 1e6) / 1e6; return (r === Math.round(r) ? so(r, 0) : so(r, d)).replace("-", "−"); }
    function tinh() {
      var d = hop && hop.checked ? 3 : 1, tong = 0;
      var cot = ["Cột", ten[0], ten[1], "Hiệu " + ten[0] + " − " + ten[1], "Bình phương hiệu"], dong = [];
      k.cot.forEach(function (c, j) {
        var a = doi(P[ten[0]][j], j), b = doi(P[ten[1]][j], j), h = a - b;
        tong += h * h;
        dong.push([c, f(a, d), f(b, d), f(h, d), f(h * h, 2 * d)]);
      });
      dong.push(["Tổng các bình phương", "", "", "", "<b>" + f(tong, 2 * d) + "</b>"]);
      buoc.innerHTML = ""; buoc.appendChild(veBang(cot, dong, [dong.length - 1]));
      bKc.textContent = "√" + f(tong, 2 * d) + " ≈ " + so(Math.sqrt(tong), d + 1);
    }
    tinh();
    return o;
  }
  // Biểu đồ cột có thanh trượt đổi điểm bắt đầu của trục đứng — thấy trục bị cắt làm chênh lệch trông lớn thế nào.
  function demoTruc(k) {
    var o = el("div", { class: "demo" }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    o.appendChild(el("p", { html: k.huong_dan }));
    var vmax = Math.max.apply(null, k.gia_tri), vmin = Math.min.apply(null, k.gia_tri);
    var tren = k.tran || Math.ceil(vmax * 1.05 * 10) / 10;
    var r = el("input", { type: "range", min: 0, max: Math.floor(vmin * 100) - 1, step: 1, value: 0, "aria-label": "điểm bắt đầu của trục đứng" });
    var nhan = el("div", { class: "thong-bao" });
    var khung = el("div", { class: "cot-demo" });
    var cot = k.nhan.map(function (t, i) {
      var h = el("div", { class: "cot" }), so_ = el("b", { text: so(k.gia_tri[i], k.so_le || 2) });
      khung.appendChild(el("div", { class: "o-cot" }, [so_, h, el("span", { text: t })]));
      return h;
    });
    var kq = el("div", { class: "ket-qua" }), bTi = el("b");
    kq.appendChild(el("div", {}, [el("span", { text: "Cột cao nhất trông gấp cột thấp nhất" }), bTi]));
    function ve() {
      var y0 = +r.value / 100;
      nhan.innerHTML = "Trục đứng bắt đầu từ <b>" + so(y0, 2) + "</b>";
      k.gia_tri.forEach(function (x, i) { cot[i].style.height = Math.max(2, (x - y0) / (tren - y0) * 180) + "px"; });
      bTi.textContent = so((vmax - y0) / (vmin - y0), 1) + " lần";
    }
    r.addEventListener("input", ve);
    o.appendChild(nhan); o.appendChild(r); o.appendChild(khung); o.appendChild(kq); ve();
    return o;
  }
  // Biểu đồ phân tán đổi theo thanh trượt: mỗi nấc là một bộ điểm có hệ số tương quan r khác nhau.
  function demoPhanTan(k) {
    var NS = "http://www.w3.org/2000/svg";
    var o = el("div", { class: "demo" }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    o.appendChild(el("p", { html: k.huong_dan }));
    var r = el("input", { type: "range", min: 0, max: k.bo.length - 1, step: 1, value: k.bat_dau || 0, "aria-label": "hệ số tương quan" });
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 320 220"); svg.setAttribute("class", "phan-tan");
    var kq = el("div", { class: "ket-qua" }), bR = el("b"), bY = el("b");
    kq.appendChild(el("div", {}, [el("span", { text: "Hệ số tương quan r" }), bR]));
    kq.appendChild(el("div", {}, [el("span", { text: "Cách đọc" }), bY]));
    function ve() {
      var b = k.bo[+r.value];
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var tr = document.createElementNS(NS, "path");
      tr.setAttribute("d", "M20 10 V200 H310"); tr.setAttribute("stroke", "#475569"); tr.setAttribute("fill", "none");
      svg.appendChild(tr);
      b.x.forEach(function (x, i) {
        var c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", 20 + x * 285); c.setAttribute("cy", 200 - b.y[i] * 185); c.setAttribute("r", 4);
        c.setAttribute("fill", "#1D4ED8"); c.setAttribute("fill-opacity", "0.75");
        svg.appendChild(c);
      });
      bR.textContent = b.r; bY.textContent = b.doc;
    }
    r.addEventListener("input", ve);
    o.appendChild(r); o.appendChild(svg); o.appendChild(kq); ve();
    return o;
  }
  // Tự kẻ đường thẳng y = a·x + b qua đám điểm: kéo a, b; hiện sai số dọc và tổng bình phương sai số.
  function demoKeDuong(k) {
    var NS = "http://www.w3.org/2000/svg";
    var o = el("div", { class: "demo" }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    o.appendChild(el("p", { html: k.huong_dan }));
    function thanh(t, c) {
      var i = el("input", { type: "range", min: c.min, max: c.max, step: c.buoc, value: c.dau, "aria-label": t });
      var nh = el("b");
      o.appendChild(el("div", { class: "hang-truot" }, [el("span", { html: t }), i, nh]));
      return { i: i, nh: nh, d: c.so_le === undefined ? 2 : c.so_le };
    }
    var A = thanh(k.nhan_a || "Hệ số góc a", k.a), B = thanh(k.nhan_b || "Hệ số chặn b", k.b);
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 340 240"); svg.setAttribute("class", "phan-tan");
    var LE = !!k.nhan;   // che do phan loai: dem diem sai phia, do le
    var kq = el("div", { class: "ket-qua" }), bS = el("b"), bT = el("b"), bL = el("b");
    if (LE) kq.appendChild(el("div", {}, [el("span", { text: "Điểm nằm sai phía" }), bL]));
    kq.appendChild(el("div", {}, [el("span", { text: LE ? "Lề của con (tới điểm gần nhất)" : "Tổng bình phương sai số của con" }), bS]));
    kq.appendChild(el("div", {}, [el("span", { text: k.nhan_tot || "Đường tốt nhất của máy" }), bT]));
    var hienMay = false;
    var nut = el("button", { class: "nut phu", type: "button", text: "Hiện / ẩn đường của máy", onclick: function () { hienMay = !hienMay; ve(); } });
    var X0 = k.mien.x[0], X1 = k.mien.x[1], Y0 = k.mien.y[0], Y1 = k.mien.y[1];
    function px(x) { return 36 + (x - X0) / (X1 - X0) * 294; }
    function py(y) { return 210 - (y - Y0) / (Y1 - Y0) * 200; }
    function net(x1, y1, x2, y2, mau, w, dash) {
      var l = document.createElementNS(NS, "line");
      l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
      l.setAttribute("stroke", mau); l.setAttribute("stroke-width", w); if (dash) l.setAttribute("stroke-dasharray", dash);
      svg.appendChild(l);
    }
    function chu(x, y, t, anchor) {
      var e = document.createElementNS(NS, "text");
      e.setAttribute("x", x); e.setAttribute("y", y); e.setAttribute("font-size", "10"); e.setAttribute("fill", "#475569");
      e.setAttribute("text-anchor", anchor || "middle"); e.textContent = t; svg.appendChild(e);
    }
    function duong(a, b, mau, w, dash) {
      // cắt đoạn thẳng trong khung [X0, X1] × [Y0, Y1]
      var xa = X0, xb = X1;
      if (a !== 0) {
        var xy0 = (Y0 - b) / a, xy1 = (Y1 - b) / a;
        xa = Math.max(xa, Math.min(xy0, xy1)); xb = Math.min(xb, Math.max(xy0, xy1));
      } else if (b < Y0 || b > Y1) return;
      if (xa >= xb) return;
      net(px(xa), py(a * xa + b), px(xb), py(a * xb + b), mau, w, dash);
    }
    function sv(x, d) { return so(x, d).replace("-", "−"); }
    function ve() {
      var a = +A.i.value, b = +B.i.value;
      A.nh.textContent = sv(a, A.d); B.nh.textContent = sv(b, B.d);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      net(36, 10, 36, 210, "#475569", 1); net(36, 210, 330, 210, "#475569", 1);
      chu(183, 236, k.nhan_x); chu(4, 12, k.nhan_y, "start");
      (k.vach_x || []).forEach(function (v) { chu(px(v), 222, so(v, 0)); });
      (k.vach_y || []).forEach(function (v) { chu(32, py(v) + 3, so(v, 0), "end"); });
      var sse = 0, sai = 0, le = Infinity, tren = [0, 0];
      if (LE) {
        k.diem.forEach(function (d, i) { if (d[1] > a * d[0] + b) tren[k.nhan[i]]++; });
        var nhomTren = tren[1] >= tren[0] ? 1 : 0;   // nhom nam phia tren duong la nhom co nhieu diem o tren hon
        k.diem.forEach(function (d, i) {
          var t = d[1] > a * d[0] + b;
          if ((k.nhan[i] === nhomTren) !== t) sai++;
          le = Math.min(le, Math.abs(d[1] - a * d[0] - b) / Math.sqrt(a * a + 1));
        });
        if (hienMay) {
          var h = k.tot.le * Math.sqrt(k.tot.a * k.tot.a + 1);
          duong(k.tot.a, k.tot.b + h, "#D97706", 1, "3 3"); duong(k.tot.a, k.tot.b - h, "#D97706", 1, "3 3");
        }
      } else {
        k.diem.forEach(function (d) {
          var yh = a * d[0] + b; sse += (d[1] - yh) * (d[1] - yh);
          net(px(d[0]), py(d[1]), px(d[0]), py(Math.max(Y0, Math.min(Y1, yh))), "#DC2626", 0.8);
        });
      }
      k.diem.forEach(function (d, i) {
        var c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", px(d[0])); c.setAttribute("cy", py(d[1])); c.setAttribute("r", LE ? 4 : 3.2);
        c.setAttribute("fill", LE ? (k.nhan[i] ? "#D97706" : "#DC2626") : "#1D4ED8");
        c.setAttribute("fill-opacity", "0.85"); svg.appendChild(c);
      });
      if (hienMay) duong(k.tot.a, k.tot.b, "#D97706", 2.2, "5 3");
      duong(a, b, "#0F172A", 2.4);
      if (LE) {
        bL.textContent = String(sai);
        bS.textContent = sai ? "—" : so(le, 2);
        bT.textContent = hienMay ? "lề " + so(k.tot.le, 2) : "bấm nút để xem";
      } else {
        bS.textContent = so(sse, 0);
        bT.textContent = hienMay ? "a = " + sv(k.tot.a, 2) + " · b = " + sv(k.tot.b, 2) + " · " + so(k.tot.sse, 0) : "bấm nút để xem";
      }
    }
    A.i.addEventListener("input", ve); B.i.addEventListener("input", ve);
    o.appendChild(svg); o.appendChild(kq); o.appendChild(el("div", { class: "hang-nut" }, [nut])); ve();
    return o;
  }
  // Chạy một thuật toán lặp từng bước: chọn một phương án, bấm "Bước tiếp" để hiện thêm một dòng.
  function demoTungBuoc(k) {
    var o = el("div", { class: "demo" }, [el("div", { class: "tieu-de-hop", text: "Tự thử: " + k.tieu_de })]);
    o.appendChild(el("p", { html: k.huong_dan }));
    var chon = k.mac_dinh || 0, hien = 1;
    var hangChon = el("div", { class: "hang-nut chon-pa" }, [el("span", { html: k.nhan_chon + ":" })]);
    var nutPa = k.lua_chon.map(function (pa, i) {
      var b = el("button", { type: "button", text: pa.nhan, onclick: function () { chon = i; hien = 1; ve(); } });
      hangChon.appendChild(b); return b;
    });
    var bang = el("div", {}), tb2 = el("span", { class: "thong-bao" });
    var nutTiep = el("button", { class: "nut", type: "button", text: "Bước tiếp ▶", onclick: function () {
      if (hien < k.lua_chon[chon].dong.length) { hien++; ve(); } } });
    var nutLai = el("button", { class: "nut phu", type: "button", text: "Làm lại", onclick: function () { hien = 1; ve(); } });
    if (k.lua_chon.length > 1) o.appendChild(hangChon);
    o.appendChild(bang); o.appendChild(el("div", { class: "hang-nut" }, [nutTiep, nutLai, tb2]));
    function ve() {
      nutPa.forEach(function (b, i) { b.className = i === chon ? "dang-chon" : ""; b.setAttribute("aria-pressed", i === chon ? "true" : "false"); });
      var pa = k.lua_chon[chon];
      bang.innerHTML = "";
      bang.appendChild(veBang(k.cot, pa.dong.slice(0, hien), [hien - 1]));
      nutTiep.disabled = hien >= pa.dong.length;
      tb2.textContent = hien >= pa.dong.length ? "Đã chạy hết " + (pa.dong.length - 1) + " bước." : "";
    }
    ve();
    return o;
  }

  // ------------------------------------------------------------ câu hỏi
  var TEN_LOAI = { mc: "Một đáp án", ma: "Nhiều đáp án", sx: "Sắp xếp", dd: "Điền khuyết", ds: "Đúng / Sai" };
  // luuTL: nếu có, câu trả lời được lưu vào TT.tl và khôi phục khi mở lại
  function veCau(q, stt, luuTL) {
    var o = el("div", { class: "cau", "data-id": q.id });
    o.appendChild(el("div", { class: "de" }, [el("span", { class: "so-cau", text: "Câu " + stt + "." }),
      el("span", { html: q.q }), el("span", { class: "loai", text: TEN_LOAI[q.k] })]));
    if (q.img) o.appendChild(anhCoDuPhong(q.img.src, q.img.du_phong, { class: "hinh-cau", alt: "Hình của câu hỏi" }));
    var cu = luuTL ? TT.tl[q.id] : null;
    var ten = "c" + Math.random().toString(36).slice(2);
    var layTL;
    function doi() { if (luuTL) { var v = layTL(); if (v === null) delete TT.tl[q.id]; else TT.tl[q.id] = v; ghi(); } }
    if (q.k === "mc" || q.k === "ds") {
      (q.k === "ds" ? ["Đúng", "Sai"] : tron(q.a)).forEach(function (a) {
        var ip = el("input", { type: "radio", name: ten, value: a, onchange: doi });
        if (cu === a) ip.checked = true;
        o.appendChild(el("label", { class: "pa" }, [ip, el("span", { html: a })]));
      });
      layTL = function () { var c = o.querySelector("input:checked"); return c ? c.value : null; };
    } else if (q.k === "ma") {
      var da = cu ? cu.split(SEP) : [];
      tron(q.a).forEach(function (a) {
        var ip = el("input", { type: "checkbox", value: a, onchange: doi });
        if (da.indexOf(a) >= 0) ip.checked = true;
        o.appendChild(el("label", { class: "pa" }, [ip, el("span", { html: a })]));
      });
      layTL = function () {
        var c = [].map.call(o.querySelectorAll("input:checked"), function (x) { return x.value; });
        return c.length ? c.sort().join(SEP) : null;
      };
    } else if (q.k === "sx") {
      var thu = cu ? cu.split(SEP) : tron(q.a);
      if (thu.length !== q.a.length) thu = tron(q.a);
      var ul = el("ul", { class: "sx" });
      o.appendChild(el("div", { class: "goi-y-sx", text: "Kéo các thẻ (giữ biểu tượng ⠿) hoặc dùng nút ↑ ↓ để sắp xếp." }));
      var veSx = function () {
        ul.innerHTML = "";
        thu.forEach(function (a, i) {
          var li = el("li", { "data-i": i }, [el("span", { class: "tay", text: "⠿", "aria-hidden": "true" }),
            el("span", { class: "stt", text: (i + 1) + "." }), el("span", { class: "nd", html: a }),
            el("button", { type: "button", text: "↑", "aria-label": "Chuyển lên", disabled: i === 0 ? "" : null,
              onclick: function () { doiCho(i, i - 1); } }),
            el("button", { type: "button", text: "↓", "aria-label": "Chuyển xuống", disabled: i === thu.length - 1 ? "" : null,
              onclick: function () { doiCho(i, i + 1); } })]);
          keoTha(li, i);
          ul.appendChild(li);
        });
      };
      var doiCho = function (i, j) { var t = thu.splice(i, 1)[0]; thu.splice(j, 0, t); veSx(); doi(); };
      var keoTha = function (li, i) {
        var tay = li.querySelector(".tay");
        tay.addEventListener("pointerdown", function (ev) {
          ev.preventDefault();
          var cac = [].slice.call(ul.children), dich = i;
          li.classList.add("dang-keo");
          tay.setPointerCapture(ev.pointerId);
          var y0 = ev.clientY;
          function di(e) {
            li.style.transform = "translateY(" + (e.clientY - y0) + "px)";
            dich = i;
            cac.forEach(function (c, k) {
              var r = c.getBoundingClientRect(), giua = r.top + r.height / 2;
              if (k < i && e.clientY < giua) dich = Math.min(dich, k);
              if (k > i && e.clientY > giua) dich = Math.max(dich, k);
            });
            cac.forEach(function (c, k) { c.classList.toggle("cho-tha", k === dich && k !== i); });
          }
          function tha() {
            tay.removeEventListener("pointermove", di); tay.removeEventListener("pointerup", tha); tay.removeEventListener("pointercancel", tha);
            li.style.transform = ""; li.classList.remove("dang-keo");
            if (dich !== i) doiCho(i, dich); else veSx();
          }
          tay.addEventListener("pointermove", di); tay.addEventListener("pointerup", tha); tay.addEventListener("pointercancel", tha);
        });
      };
      veSx(); o.appendChild(ul);
      layTL = function () { return thu.join(SEP); };
    } else if (q.k === "dd") {
      var p = el("div", { class: "cau-dd dd" }), phan = q.mau.split(/\{(\d+)\}/), sels = [];
      var cuDd = cu ? cu.split(SEP) : [];
      phan.forEach(function (x, i) {
        if (i % 2 === 0) { p.appendChild(el("span", { html: x })); return; }
        var s = el("select", { "aria-label": "chỗ trống " + (+x + 1), onchange: doi }, [el("option", { value: "", text: "— chọn —" })]);
        tron(q.o[+x]).forEach(function (a) { s.appendChild(el("option", { value: a, text: a })); });
        if (cuDd[+x]) s.value = cuDd[+x];
        sels[+x] = s; p.appendChild(s);
      });
      o.appendChild(p);
      layTL = function () {
        var v = sels.map(function (s) { return s.value; });
        return v.indexOf("") >= 0 ? null : v.join(SEP);
      };
    }
    var ph = el("div", { class: "phan-hoi" }); ph.style.display = "none";
    o.appendChild(ph);
    return {
      node: o,
      tra_loi: function () { return layTL(); },
      // muc: "goi_y" (lần sai đầu — gợi hướng, không lộ đáp án) | "giai" (lời giải đầy đủ)
      cham: function (muc) {
        var tl = layTL();
        var ok = tl !== null && bam(B.muoi + "|" + q.id + "|" + tl) === q.h;
        o.className = "cau " + (ok ? "dung" : "sai");
        ph.style.display = "block";
        var loi = ok ? (q.giai || "") : (muc === "goi_y" && q.goi_y ? "Gợi ý: " + q.goi_y : (q.giai || ""));
        ph.innerHTML = (ok ? "✔ Đúng. " : (tl === null ? "✘ Con chưa trả lời câu này. " : "✘ Chưa đúng. ")) + loi;
        return ok;
      }
    };
  }

  // ------------------------------------------------------------ một chặng
  function moChang(i) {
    if (!TT.ten) { moDau(); return; }
    changDang = i;
    capNhatDau();
    main.innerHTML = "";
    main.appendChild(thanhChang(i));
    if (B.du_lieu && B.du_lieu.length) {
      var tai = el("details", { class: "du-lieu-truy-cap" });
      tai.appendChild(el("summary", { text: "Dữ liệu của bài · Tải CSV và xem bảng mẫu" }));
      tai.appendChild(theDuLieu(true));
      main.appendChild(tai);
    }
    var c = B.chang[i];
    var t = el("section", { class: "the" });
    t.appendChild(el("span", { class: "nhan", text: "Chặng " + (i + 1) + " / " + B.chang.length + " · khoảng " + c.phut + " phút" }));
    t.appendChild(el("h2", { text: c.ten }));
    if (i === B.chang.length - 1 && TT.dat && TT.diem) {
      t.appendChild(el("p", { text: "Em đã đạt checkpoint cuối. Có thể tải lại chứng chỉ tại đây." }));
      var chungChiChang = el("div", { class: "chung-chi" });
      t.appendChild(chungChiChang);
      veChungChi(TT.diem, TT.ngay_dat || ngayNay(), chungChiChang, true);
    }
    t.appendChild(el("div", { class: "muc-tieu", html: "<b>Mục tiêu:</b> " + c.muc_tieu }));
    if (c.khoi_dong) t.appendChild(el("div", { class: "khoi-dong", html: "<b>Câu hỏi mở đầu:</b> " + c.khoi_dong }));
    c.khoi.forEach(function (k) { t.appendChild(veKhoi(k)); });
    main.appendChild(t);

    var ck = el("section", { class: "the" });
    ck.appendChild(el("span", { class: "nhan", text: "Checkpoint chặng " + (i + 1) }));
    ck.appendChild(el("h2", { text: "Kiểm tra nhanh" }));
    ck.appendChild(el("p", { text: TT.passedStages.includes(i) ? "Con đã qua chặng này. Có thể làm lại để ôn." :
      "Trả lời đúng tất cả để mở chặng sau. Sai lần đầu: đọc gợi ý. Sai từ lần hai: xem lời giải chi tiết." }));
    var cau = c.checkpoint.map(function (q, j) { var v = veCau(q, j + 1, true); ck.appendChild(v.node); return v; });
    var tb = el("span", { class: "thong-bao" });
    var tiep = el("button", { class: "nut", text: NHUNG ? (DUNG_SAU_CHANG ? "Về thế giới 3D — dừng trao đổi" : "Về thế giới 3D — sang trạm tiếp →") :
      i + 1 < B.chang.length ? "Sang chặng " + (i + 2) + " →" : "Vào checkpoint cuối →",
      onclick: function () {
        if (NHUNG) guiCha({ loai: "dong", tiep: !DUNG_SAU_CHANG, vua_xong: i + 1 });
        else if (i + 1 < B.chang.length) moChang(i + 1); else moCuoi();
      } });
    tiep.disabled = i >= TT.qua && !window.PORTAL_SELF_STUDY;
    var kt = el("button", { class: "nut phu", text: "Kiểm tra", onclick: function () {
      var lan = TT.lan_sai[i] || 0;
      var dung = cau.filter(function (v) { return v.cham(lan >= 1 ? "giai" : "goi_y"); }).length;
      if (dung === cau.length) {
        tb.className = "thong-bao tot"; tb.textContent = "Tuyệt — con đã qua chặng " + (i + 1) + ".";
        if (!TT.passedStages.includes(i)) TT.passedStages.push(i);
        TT.qua = 0; while(TT.passedStages.includes(TT.qua)&&TT.qua<B.chang.length) TT.qua++;
        TT.dat = TT.finalPassed && TT.passedStages.length === B.chang.length;
        ghi(); capNhatDau(); tiep.disabled = false;
      } else {
        TT.lan_sai[i] = lan + 1; ghi();
        tb.className = "thong-bao xau";
        tb.textContent = "Đúng " + dung + "/" + cau.length + (lan >= 1 ? ". Đọc lời giải từng câu, sửa rồi kiểm tra lại." : ". Đọc gợi ý, sửa rồi kiểm tra lại.");
      }
    } });
    ck.appendChild(el("div", { class: "hang-nut" }, [kt, tiep, tb]));
    main.appendChild(ck);
    var cb = canhBaoLuu(); if (cb) main.appendChild(cb);
    if (TT.cuon[i]) setTimeout(function () { len(TT.cuon[i]); }, 60); else len();
  }

  // ------------------------------------------------------------ checkpoint cuối
  function rutDe() {
    var de = [];
    Object.keys(B.cuoi.co_cau).forEach(function (k) {
      var nhom = B.cuoi.ngan_hang.filter(function (q) { return q.k === k; });
      de = de.concat(tron(nhom).slice(0, B.cuoi.co_cau[k]));
    });
    return tron(de);
  }
  function moCuoi() {
    if (!TT.ten) { moDau(); return; }
    if (TT.qua < B.chang.length && !window.PORTAL_SELF_STUDY) { moChang(TT.qua); return; }
    changDang = null;
    capNhatDau();
    main.innerHTML = "";
    main.appendChild(thanhChang("cuoi"));
    var t = el("section", { class: "the" });
    t.appendChild(el("span", { class: "nhan", text: "Checkpoint cuối bài" }));
    t.appendChild(el("h2", { text: B.cuoi.so_cau + " câu — đạt " + B.cuoi.dat + " câu và hoàn thành các chặng để nhận chứng chỉ" }));
    t.appendChild(el("ul", { class: "ds" }, [
      el("li", { html: "Đề gồm nhiều dạng: một đáp án, <b>nhiều đáp án</b> (đề ghi rõ chọn mấy), sắp xếp, điền khuyết, đúng/sai." }),
      el("li", { html: "Mỗi câu phải đúng trọn vẹn mới được tính — câu nhiều đáp án phải chọn đủ và không chọn thừa." }),
      el("li", { html: "Làm lại <b>không giới hạn</b>. Mỗi lần làm lại là một đề mới." })]));
    if (TT.lich_su.length) {
      t.appendChild(el("p", { html: "<b>Các lần đã làm:</b> " + TT.lich_su.map(function (l) { return l.diem + "/" + B.cuoi.so_cau + " (" + l.ngay + ")"; }).join(" · ") }));
    }
    var bd = el("button", { class: "nut", text: TT.dat ? "Làm lại (không bắt buộc)" : "Bắt đầu làm bài", onclick: function () { lamBai(); } });
    t.appendChild(el("div", { class: "hang-nut" }, [bd]));
    if (TT.dat && TT.diem) {
      t.appendChild(el("p", { html: "Con đã đạt <b>" + TT.diem + "/" + B.cuoi.so_cau + "</b> ngày " + (TT.ngay_dat || "") + ". Chứng chỉ ở dưới — tải lại bất cứ lúc nào." }));
      var cc = el("div", { class: "chung-chi" }); t.appendChild(cc); veChungChi(TT.diem, TT.ngay_dat || ngayNay(), cc);
    }
    main.appendChild(t);
    len();
  }
  function lamBai() {
    main.innerHTML = "";
    main.appendChild(thanhChang("cuoi"));
    var s = el("section", { class: "the" });
    s.appendChild(el("span", { class: "nhan", text: "Checkpoint cuối bài · " + TT.ten + " · " + TT.lop }));
    s.appendChild(el("h2", { text: "Làm bài" }));
    var cau = rutDe().map(function (q, j) { var v = veCau(q, j + 1, false); s.appendChild(v.node); return v; });
    var tb = el("span", { class: "thong-bao xau" });
    var nop = el("button", { class: "nut", text: "Nộp bài", onclick: function () {
      var thieu = cau.map(function (v, j) { return v.tra_loi() === null ? j + 1 : 0; }).filter(Boolean);
      if (thieu.length) { tb.textContent = "Con chưa trả lời câu " + thieu.join(", ") + "."; return; }
      var diem = cau.filter(function (v) { return v.cham("giai"); }).length;
      nop.disabled = true; tb.textContent = "";
      TT.lich_su.push({ ngay: ngayNay(), diem: diem }); ghi();
      ketQua(diem);
    } });
    s.appendChild(el("div", { class: "hang-nut" }, [nop, tb]));
    main.appendChild(s);
    len();
  }
  function ketQua(diem) {
    var r = el("section", { class: "the" });
    r.appendChild(el("span", { class: "nhan", text: "Kết quả" }));
    r.appendChild(el("div", { class: "diem-lon", text: diem + "/" + B.cuoi.so_cau }));
    var lai = el("button", { class: "nut phu", text: "Làm lại với đề mới", onclick: lamBai });
    if (diem >= B.cuoi.dat) {
      if (!TT.dat || diem > (TT.diem || 0)) { TT.diem = diem; TT.ngay_dat = ngayNay(); }
      TT.finalPassed = true; TT.dat = TT.passedStages.length === B.chang.length; ghi(); capNhatDau();
      r.appendChild(el("p", { html: TT.dat ? "Con đã hoàn thành bài. Tải chứng chỉ bên dưới." : "Con đã đạt checkpoint cuối. Hoàn thành các checkpoint chặng còn lại để nhận chứng chỉ bài." }));
      var cc = el("div", { class: "chung-chi" });
      r.appendChild(cc);
      if(TT.dat) veChungChi(TT.diem, TT.ngay_dat, cc);
    } else {
      r.appendChild(el("p", { html: "Cần ít nhất " + B.cuoi.dat + " câu đúng. Xem lời giải ở từng câu phía trên, " +
        "mở lại chặng nào còn chưa chắc, rồi làm đề mới." }));
    }
    r.appendChild(el("div", { class: "hang-nut" }, [lai]));
    main.appendChild(r);
    r.scrollIntoView({ behavior: "smooth" });
  }

  // ------------------------------------------------------------ chứng chỉ
  function veChungChi(diem, ngay, noi, chiNut) {
    var W = 1600, H = 1100, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var g = cv.getContext("2d");
    var ma = maXacNhan(B.bai, TT.ten, TT.lop);
    var F = "Be Vietnam Pro, 'Segoe UI', sans-serif";
    function ve(logo) {
      var cs = getComputedStyle(document.documentElement), mauCss = function (k, d) { return (cs.getPropertyValue(k) || "").trim() || d; };
    var M_DAM = mauCss("--xanh", "#0F172A"), M_PHU = mauCss("--chu-phu", "#475569"), M_VANG = mauCss("--vang", "#D97706"),
      M_NHAT = mauCss("--xanh-nhat", "#DBEAFE"), M_TEAL = mauCss("--teal", "#0D9488");
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, W, H);
      g.fillStyle = M_DAM; g.fillRect(0, 0, W, 150);
      g.strokeStyle = M_VANG; g.lineWidth = 6; g.strokeRect(40, 190, W - 80, H - 230);
      g.strokeStyle = M_NHAT; g.lineWidth = 2; g.strokeRect(56, 206, W - 112, H - 262);
      if (logo) { var lh = 104, lw = logo.width * lh / logo.height; g.drawImage(logo, 50, 23, lw, lh); }
      g.fillStyle = "#FFFFFF"; g.textAlign = "left";
      g.font = "700 30px " + F; g.fillText(B.truong.toUpperCase(), 230, 70);
      g.font = "500 24px " + F; g.fillText(B.khoa + " · " + B.khoi, 230, 110);
      g.textAlign = "center";
      g.fillStyle = M_TEAL; g.font = "700 30px " + F; g.fillText("CHỨNG NHẬN HOÀN THÀNH", W / 2, 290);
      g.fillStyle = M_DAM; g.font = "700 50px " + F; g.fillText(B.nhan + " — " + B.tieu_de, W / 2, 370);
      g.fillStyle = M_PHU; g.font = "500 28px " + F; g.fillText("Chứng nhận học sinh", W / 2, 470);
      g.fillStyle = M_DAM; g.font = "700 76px " + F; g.fillText(TT.ten.toUpperCase(), W / 2, 565);
      g.fillStyle = M_PHU; g.font = "600 32px " + F; g.fillText("Lớp " + TT.lop, W / 2, 625);
      g.fillStyle = M_DAM; g.font = "500 30px " + F;
      g.fillText("đã học hết " + B.chang.length + " chặng và trả lời đúng " + diem + "/" + B.cuoi.so_cau + " câu checkpoint cuối bài", W / 2, 710);
      g.fillStyle = M_NHAT; g.fillRect(W / 2 - 250, 780, 500, 120);
      g.fillStyle = M_PHU; g.font = "600 24px " + F; g.fillText("MÃ XÁC NHẬN", W / 2, 820);
      g.fillStyle = M_DAM; g.font = "700 52px Consolas, monospace"; g.fillText(ma, W / 2, 880);
      g.fillStyle = M_PHU; g.font = "500 26px " + F; g.fillText("Ngày " + ngay, W / 2, 985);
      var ten = "ChungChi_" + B.ma + "_" + khongDau(TT.ten).split(" ").map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1); }).join("") + "_" + TT.lop + ".png";
      var url;
      try { url = cv.toDataURL("image/png"); } catch (e) { url = null; }
      noi.innerHTML = "";
      if (url) {
        if (!chiNut) noi.appendChild(el("img", { src: url, alt: "Chứng chỉ " + B.nhan }));
        noi.appendChild(el("div", { class: "hang-nut" }, [el("a", { class: "nut", href: url, download: ten, text: "⬇ Tải chứng chỉ (PNG)" }),
          el("span", { text: "Mã xác nhận: " + ma })]));
      } else {
        noi.appendChild(cv); cv.style.width = "100%";
        noi.appendChild(el("p", { text: "Máy không cho tải trực tiếp — chụp màn hình chứng chỉ này. Mã xác nhận: " + ma }));
      }
    }
    var logo = new Image(), xong = false;
    function chay(l) { if (xong) return; xong = true; ve(l); }
    logo.onload = function () { chay(logo); };
    logo.onerror = function () { chay(null); };
    var fonts = (document.fonts && document.fonts.load) ? document.fonts.load("700 50px Be Vietnam Pro") : Promise.resolve();
    fonts.then(function () { logo.src = "../assets/logo_lsts_trang.png"; }, function () { logo.src = "../assets/logo_lsts_trang.png"; });
    setTimeout(function () { chay(logo.complete && logo.naturalWidth ? logo : null); }, 2500);
  }

  // ------------------------------------------------------------ chạy
  dungKhung();
  if (!TT.ten) moDau();
  else if (NHUNG && Q.get("cuoi")) moCuoi();
  else if (NHUNG && Q.get("chang") !== null) moChang(Math.min(+Q.get("chang") || 0, window.PORTAL_SELF_STUDY ? B.chang.length - 1 : TT.qua));
  else if (TT.qua >= B.chang.length) moCuoi();
  else moChang(TT.qua);
})();
