/* MEIOCG Price Guide — Yuyu-tei standard pricing, TCG Corner fallback, click-to-view history.
   Mount: <div id="mpg"></div>. Data base URL can be overridden with window.MEIOCG_PRICES_BASE. */
(function () {
  "use strict";
  var REPO = "castelnoleal/Meiocg_Price-Check";
  var BASES = window.MEIOCG_PRICES_BASE ? [window.MEIOCG_PRICES_BASE] : [
    "https://cdn.jsdelivr.net/gh/" + REPO + "@data/",
    "https://raw.githubusercontent.com/" + REPO + "/data/"
  ];
  var DEMO = window.MEIOCG_PRICES_DEMO || null;
  var PAGE = 60;
  var RAR_COL = {
    N: "#5b6275", NP: "#6b7a8f", R: "#3f7bd9", SR: "#9a59e0", UR: "#d4a017", SE: "#e04f8a",
    PSE: "#ff5ec4", UL: "#b48a3c", CR: "#5ad1c8", HR: "#7b61ff", QCSE: "#ff7a3d", "20thSE": "#e53935",
    EXSE: "#00b8a9", USE: "#ffd34d", GR: "#c9a227", GSE: "#c9a227", M: "#b0874f", KC: "#8a6d3b", P: "#8a8f9c"
  };

  var root, S = {
    idx: null, movers: null, cols: null, rows: [], sets: {}, rates: { JPY_PHP: 0.38, USD_PHP: 58, USD_JPY: 152 },
    cur: store("mpg_cur") || "JPY", q: "", set: "", rar: "", sort: "price", stock: false, tab: "gainers",
    shown: PAGE, list: [], hist: {}, loadingIdx: false
  };

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- data ---------- */
  function getJSON(path) {
    if (DEMO) {
      var d = path === "index.json" ? DEMO.index : path === "movers.json" ? DEMO.movers : DEMO.history[path.replace("history/", "").replace(".json", "")] || {};
      return new Promise(function (r) { setTimeout(function () { r(d); }, 250); });
    }
    var i = 0;
    function attempt() {
      var url = BASES[i] + path;
      return fetch(url, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).catch(function (e) {
        if (++i < BASES.length) return attempt();
        throw e;
      });
    }
    return attempt();
  }
  function toObj(cols, row) { var o = {}; for (var i = 0; i < cols.length; i++) o[cols[i]] = row[i]; return o; }
  function prep(c) {
    c.setName = S.sets[c.set] || (c.set === "_tc" ? "TCG Corner only" : String(c.set || "").toUpperCase());
    c.key = norm([c.name, c.en, c.code, c.setName, c.set].join(" "));
    c.jpy = c.yyt != null ? c.yyt : c.tc != null ? c.tc * S.rates.USD_JPY : null;
    return c;
  }
  function norm(s) {
    s = String(s || "");
    try { s = s.normalize("NFKC"); } catch (e) {}
    s = s.toLowerCase().replace(/[ァ-ヶ]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0x60); });
    return s.replace(/[\s\-・･'"’.,:!！?？]/g, "");
  }

  /* ---------- money ---------- */
  var SYM = { JPY: "¥", PHP: "₱", USD: "$" };
  function conv(v, from, to) {
    if (v == null) return null;
    if (from === to) return v;
    var jpy = from === "JPY" ? v : from === "USD" ? v * S.rates.USD_JPY : v / S.rates.JPY_PHP;
    if (to === "JPY") return jpy;
    if (to === "PHP") return jpy * S.rates.JPY_PHP;
    return jpy / S.rates.USD_JPY;
  }
  function fmt(v, cur) {
    if (v == null || isNaN(v)) return "—";
    var d = cur === "USD" || (cur === "PHP" && v < 100) ? 2 : 0;
    return SYM[cur] + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function mainPrice(c) {
    if (c.yyt != null) return { v: conv(c.yyt, "JPY", S.cur), src: "y" };
    if (c.tc != null) return { v: conv(c.tc, "USD", S.cur), src: "t" };
    return { v: null, src: "" };
  }

  /* ---------- shell ---------- */
  function build() {
    root.innerHTML = "";
    var hero = el("div", { class: "mpg-hero" }, [el("div", { class: "mpg-wrap" }, [
      el("div", { class: "mpg-kicker", html: "<i></i>Meta Insider OCG · Price Guide" }),
      el("h1", { class: "mpg-title", html: "OCG card prices, <span>tracked daily</span>" }),
      el("p", { class: "mpg-sub", text: "Standard prices come from Yuyu-tei (Japan). When a card isn't listed there, we fall back to TCG Corner. Tap any card to see how its price has moved." }),
      el("div", { class: "mpg-chips", id: "mpg-chips" })
    ])]);
    var search = el("div", { class: "mpg-search", html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' });
    var inp = el("input", { type: "search", placeholder: "Search card name (JP/EN), code e.g. IMPH-JP002, or set…", "aria-label": "Search cards", autocomplete: "off" });
    var t; inp.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { S.q = inp.value; S.shown = PAGE; ensureIndex(); render(); }, 160); });
    search.appendChild(inp);
    var setSel = el("select", { class: "mpg-sel", id: "mpg-set", "aria-label": "Set", onchange: function () { S.set = this.value; S.shown = PAGE; ensureIndex(); render(); } });
    var rarSel = el("select", { class: "mpg-sel", id: "mpg-rar", "aria-label": "Rarity", onchange: function () { S.rar = this.value; S.shown = PAGE; ensureIndex(); render(); } });
    var sortSel = el("select", { class: "mpg-sel", "aria-label": "Sort", onchange: function () { S.sort = this.value; S.shown = PAGE; render(); } });
    [["price", "Price: high → low"], ["price_asc", "Price: low → high"], ["c7", "Biggest rise (7d)"], ["c7_asc", "Biggest drop (7d)"], ["c30", "Biggest rise (30d)"], ["code", "Card code"]].forEach(function (o) { sortSel.appendChild(el("option", { value: o[0], text: o[1] })); });
    var seg = el("div", { class: "mpg-seg", role: "group", "aria-label": "Currency" });
    ["JPY", "PHP", "USD"].forEach(function (c) {
      seg.appendChild(el("button", { type: "button", "data-c": c, class: S.cur === c ? "on" : "", text: SYM[c] + " " + c, onclick: function () {
        S.cur = c; store("mpg_cur", c);
        [].forEach.call(seg.children, function (b) { b.className = b.getAttribute("data-c") === c ? "on" : ""; });
        render(); if (S.open) openCard(S.open, true);
      } }));
    });
    var tog = el("label", { class: "mpg-toggle" }, [el("input", { type: "checkbox", onchange: function () { S.stock = this.checked; S.shown = PAGE; ensureIndex(); render(); } }), "In stock at Yuyu-tei"]);
    var bar = el("div", { class: "mpg-bar" }, [el("div", { class: "mpg-wrap" }, [el("div", { class: "mpg-row" }, [search, setSel, rarSel, sortSel, seg, tog])])]);
    var main = el("div", { class: "mpg-wrap" }, [
      el("div", { class: "mpg-tabs", id: "mpg-tabs" }),
      el("p", { class: "mpg-meta", id: "mpg-meta" }),
      el("div", { class: "mpg-grid", id: "mpg-grid" }),
      el("div", { id: "mpg-morewrap" }),
      el("div", { class: "mpg-note", html: "Prices are Yuyu-tei sell prices (JPY) checked once a day; TCG Corner prices (USD) are shown as a secondary reference and used when Yuyu-tei has no listing. ₱ and $ figures are converted at the day's exchange rate and are estimates. Prices belong to their respective stores — always check the store before buying." })
    ]);
    root.appendChild(hero); root.appendChild(bar); root.appendChild(main);
    var tabs = document.getElementById("mpg-tabs");
    [["gainers", "📈 Top risers · 7d"], ["losers", "📉 Biggest drops · 7d"], ["top", "💎 Most valuable"], ["all", "All cards"]].forEach(function (t) {
      tabs.appendChild(el("button", { type: "button", class: "mpg-tab" + (S.tab === t[0] ? " on" : ""), "data-t": t[0], text: t[1], onclick: function () {
        S.tab = t[0]; S.shown = PAGE;
        [].forEach.call(tabs.children, function (b) { b.className = "mpg-tab" + (b.getAttribute("data-t") === S.tab ? " on" : ""); });
        if (t[0] === "all") ensureIndex();
        render();
      } }));
    });
    skeleton();
  }
  function skeleton() {
    var g = document.getElementById("mpg-grid"); g.innerHTML = "";
    for (var i = 0; i < 12; i++) g.appendChild(el("div", { class: "mpg-skel" }));
  }
  function chips() {
    var c = document.getElementById("mpg-chips"); if (!c) return;
    var d = S.idx || S.movers || {};
    var up = d.updated ? new Date(d.updated) : null;
    var parts = [];
    if (up) parts.push("Updated <b>" + up.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) + "</b>");
    if (S.idx) parts.push("<b>" + S.rows.length.toLocaleString() + "</b> cards");
    parts.push("¥100 = <b>₱" + (100 * S.rates.JPY_PHP).toFixed(2) + "</b>");
    parts.push("$1 = <b>₱" + S.rates.USD_PHP.toFixed(2) + "</b>");
    parts.push('<span class="mpg-dot" style="background:#f2c14e"></span>Yuyu-tei = standard');
    parts.push('<span class="mpg-dot" style="background:#4cc9f0"></span>TCG Corner = fallback');
    c.innerHTML = parts.map(function (p) { return '<span class="mpg-chip">' + p + "</span>"; }).join("");
  }
  function fillFilters() {
    var setSel = document.getElementById("mpg-set"), rarSel = document.getElementById("mpg-rar");
    setSel.innerHTML = ""; rarSel.innerHTML = "";
    setSel.appendChild(el("option", { value: "", text: "All sets" }));
    Object.keys(S.sets).map(function (k) { return [k, S.sets[k]]; })
      .sort(function (a, b) { return a[1].localeCompare(b[1], "ja"); })
      .forEach(function (s) { setSel.appendChild(el("option", { value: s[0], text: s[0].toUpperCase() + " · " + s[1] })); });
    if (S.rows.some(function (c) { return c.set === "_tc"; })) setSel.appendChild(el("option", { value: "_tc", text: "TCG Corner only (not on Yuyu-tei)" }));
    var rs = {}; S.rows.forEach(function (c) { if (c.rarity) rs[c.rarity] = (rs[c.rarity] || 0) + 1; });
    rarSel.appendChild(el("option", { value: "", text: "All rarities" }));
    Object.keys(rs).sort(function (a, b) { return rs[b] - rs[a]; }).forEach(function (r) { rarSel.appendChild(el("option", { value: r, text: r + " (" + rs[r] + ")" })); });
    setSel.value = S.set; rarSel.value = S.rar;
  }

  /* ---------- list ---------- */
  function filtering() { return !!(S.q || S.set || S.rar || S.stock); }
  function ensureIndex() {
    if (S.idx || S.loadingIdx) return;
    S.loadingIdx = true;
    getJSON("index.json").then(function (d) {
      S.idx = d; S.cols = d.cols; S.sets = d.sets || {}; S.rates = d.rates || S.rates;
      S.rows = d.cards.map(function (r) { return prep(toObj(d.cols, r)); });
      S.byId = {}; S.rows.forEach(function (c) { S.byId[c.id] = c; });
      fillFilters(); chips(); render(); deepLink();
    }).catch(function () {
      document.getElementById("mpg-meta").textContent = "Couldn't load the full price list. Please refresh in a moment.";
    });
  }
  function compute() {
    var list;
    if (!filtering() && S.tab !== "all") {
      var src = S.movers ? S.movers[S.tab] || [] : [];
      list = src.map(function (r) { var o = toObj(S.movers.cols, r); return S.byId && S.byId[o.id] ? S.byId[o.id] : prep(o); });
      return list;
    }
    if (!S.idx) return null;
    var q = norm(S.q), qs = q ? q.split(/\s+/) : [];
    list = S.rows.filter(function (c) {
      if (S.set && c.set !== S.set) return false;
      if (S.rar && c.rarity !== S.rar) return false;
      if (S.stock && !(c.stock !== 0 && c.yyt != null)) return false;
      if (q && c.key.indexOf(q) < 0) return false;
      return true;
    });
    var s = S.sort, nz = function (v, d) { return v == null ? d : v; };
    list.sort(function (a, b) {
      if (s === "price") return nz(b.jpy, -1) - nz(a.jpy, -1);
      if (s === "price_asc") return nz(a.jpy, 1e12) - nz(b.jpy, 1e12);
      if (s === "c7") return nz(b.c7, -1e9) - nz(a.c7, -1e9);
      if (s === "c7_asc") return nz(a.c7, 1e9) - nz(b.c7, 1e9);
      if (s === "c30") return nz(b.c30, -1e9) - nz(a.c30, -1e9);
      return String(a.code).localeCompare(String(b.code));
    });
    return list;
  }
  function render() {
    var g = document.getElementById("mpg-grid"), meta = document.getElementById("mpg-meta"), mw = document.getElementById("mpg-morewrap");
    document.getElementById("mpg-tabs").style.display = filtering() ? "none" : "flex";
    var list = compute();
    if (list === null) { skeleton(); meta.textContent = "Loading the full price list…"; mw.innerHTML = ""; return; }
    S.list = list;
    if (filtering()) meta.textContent = list.length.toLocaleString() + " card" + (list.length === 1 ? "" : "s") + " found";
    else if (S.tab === "all") meta.textContent = "All " + list.length.toLocaleString() + " cards";
    else meta.textContent = { gainers: "Cards worth ¥300+ that rose the most over the last 7 days", losers: "Cards worth ¥300+ that dropped the most over the last 7 days", top: "The most expensive OCG singles right now" }[S.tab];
    g.innerHTML = "";
    if (!list.length) { g.appendChild(el("div", { class: "mpg-empty", style: "grid-column:1/-1", text: filtering() ? "No cards match. Try the Japanese name, the English name or the card code." : "Price changes appear once a few days of history have been collected." })); mw.innerHTML = ""; return; }
    var frag = document.createDocumentFragment();
    list.slice(0, S.shown).forEach(function (c) { frag.appendChild(tile(c)); });
    g.appendChild(frag);
    mw.innerHTML = "";
    if (list.length > S.shown) mw.appendChild(el("button", { type: "button", class: "mpg-more", text: "Show more (" + (list.length - S.shown).toLocaleString() + " left)", onclick: function () { S.shown += PAGE; render(); } }));
  }
  function chgBadge(v) {
    if (v == null || v === 0) return null;
    return el("span", { class: "mpg-chg " + (v > 0 ? "up" : "down"), text: (v > 0 ? "▲" : "▼") + Math.abs(v).toFixed(v >= 100 || v <= -100 ? 0 : 1) + "%" });
  }
  function rarBadge(r) { return el("span", { class: "mpg-rar", style: "background:" + (RAR_COL[r] || "#3a4058"), text: r || "?" }); }
  function imgNode(src, alt) {
    var ph = function () { return el("div", { class: "mpg-noimg", html: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4b5170" stroke-width="1.6"><rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="10" r="3.2"/><path d="M8 17h8"/></svg>' + esc(alt || "") }); };
    if (!src) return ph();
    var i = el("img", { src: src, alt: alt || "", loading: "lazy", referrerpolicy: "no-referrer", decoding: "async" });
    i.onerror = function () { i.replaceWith(ph()); };
    return i;
  }
  function tile(c) {
    var p = mainPrice(c);
    var alt = null;
    if (p.src === "y" && c.tc != null) alt = "TCG Corner " + fmt(conv(c.tc, "USD", S.cur), S.cur);
    else if (S.cur !== "JPY" && p.src === "y") alt = fmt(c.yyt, "JPY") + " at Yuyu-tei";
    var b = el("button", { type: "button", class: "mpg-card", "aria-label": (c.en || c.name) + " " + c.code + " " + c.rarity, onclick: function () { openCard(c); } }, [
      el("div", { class: "mpg-img" }, [imgNode(c.img, c.code), rarBadge(c.rarity), chgBadge(c.c7)]),
      el("div", { class: "mpg-body" }, [
        el("div", { class: "mpg-code", text: c.code }),
        el("div", { class: "mpg-name", text: c.name }),
        c.en && c.en !== c.name ? el("div", { class: "mpg-en", text: c.en }) : null,
        el("div", { class: "mpg-price" }, [el("b", { text: fmt(p.v, S.cur) }), p.src ? el("span", { class: "mpg-src " + p.src, text: p.src === "y" ? "Yuyu-tei" : "TCG Corner" }) : null]),
        alt ? el("div", { class: "mpg-alt", text: alt }) : null,
        c.yyt != null && c.stock === 0 ? el("div", { class: "mpg-oos", text: "Sold out at Yuyu-tei" }) : null
      ])
    ]);
    return b;
  }

  /* ---------- modal + history ---------- */
  var modal;
  function ensureModal() {
    if (modal) return modal;
    modal = el("div", { id: "mpg-modal", role: "dialog", "aria-modal": "true", onclick: function (e) { if (e.target === modal) closeCard(); } });
    document.body.appendChild(modal);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("open")) closeCard(); });
    return modal;
  }
  function closeCard() {
    modal.classList.remove("open"); document.documentElement.style.overflow = ""; S.open = null;
    if (location.hash.indexOf("card=") >= 0) history.replaceState(null, "", location.pathname + location.search);
  }
  function deepLink() {
    var m = location.hash.match(/card=([^&]+)/);
    if (m && S.byId && S.byId[decodeURIComponent(m[1])] && !S.open) openCard(S.byId[decodeURIComponent(m[1])]);
  }
  function srcLinks(c) {
    return {
      y: c.set !== "_tc" ? "https://yuyu-tei.jp/sell/ygo/card/" + c.set + "/" + String(c.id).split("-").pop() : null,
      t: c.tch ? "https://tcg-corner.com/products/" + c.tch : null
    };
  }
  function openCard(c, keepRange) {
    ensureModal(); S.open = c;
    if (!keepRange) S.range = "all";
    if (location.hash !== "#card=" + c.id) history.replaceState(null, "", "#card=" + encodeURIComponent(c.id));
    var L = srcLinks(c);
    var big = c.img ? c.img.replace("/100_140/", "/front/") : "";
    var imgEl = c.img ? el("img", { src: big, alt: c.name, referrerpolicy: "no-referrer" }) : imgNode("", c.code);
    if (c.img) imgEl.onerror = function () { if (imgEl.src !== c.img) imgEl.src = c.img; };
    var yBox = c.yyt != null
      ? el(L.y ? "a" : "div", { class: "mpg-pbox main", href: L.y || "", target: "_blank", rel: "noopener" }, [el("small", { text: "Yuyu-tei · standard" }), el("strong", { text: fmt(conv(c.yyt, "JPY", S.cur), S.cur) }), el("span", { text: (S.cur !== "JPY" ? fmt(c.yyt, "JPY") + " · " : "") + (c.stock === 0 ? "Sold out" : c.stock > 0 ? c.stock + " in stock" : "In stock") + " ↗" })])
      : el("div", { class: "mpg-pbox na" }, [el("small", { text: "Yuyu-tei · standard" }), el("strong", { text: "Not listed" }), el("span", { text: "Using TCG Corner as fallback" })]);
    var tBox = c.tc != null
      ? el(L.t ? "a" : "div", { class: "mpg-pbox" + (c.yyt == null ? " main" : ""), href: L.t || "", target: "_blank", rel: "noopener" }, [el("small", { text: "TCG Corner · " + (c.yyt == null ? "fallback" : "reference") }), el("strong", { text: fmt(conv(c.tc, "USD", S.cur), S.cur) }), el("span", { text: (S.cur !== "USD" ? fmt(c.tc, "USD") + " · " : "") + "view store ↗" })])
      : el("div", { class: "mpg-pbox na" }, [el("small", { text: "TCG Corner · reference" }), el("strong", { text: "Not listed" }), el("span", { text: "No matching listing found" })]);
    var tags = [c.code, c.rarity, c.setName].filter(Boolean).map(function (t) { return el("span", { class: "mpg-tag", text: t }); });
    var histWrap = el("div", { class: "mpg-sec" }, [el("div", { class: "mpg-loading", text: "Loading price history…" })]);
    var dlg = el("div", { class: "mpg-dlg" }, [
      el("div", { class: "mpg-top" }, [
        el("button", { type: "button", class: "mpg-x", "aria-label": "Close", text: "×", onclick: closeCard }),
        el("div", { class: "mpg-bigimg" }, [imgEl]),
        el("div", {}, [el("h2", { text: c.name }), c.en && c.en !== c.name ? el("div", { class: "mpg-en2", text: c.en }) : null, el("div", { class: "mpg-tags" }, tags)]),
        el("div", { class: "mpg-prices" }, [yBox, tBox])
      ]),
      histWrap
    ]);
    modal.innerHTML = ""; modal.appendChild(dlg); modal.classList.add("open"); modal.scrollTop = 0;
    document.documentElement.style.overflow = "hidden";
    var hf = c.set || "_tc";
    (S.hist[hf] ? Promise.resolve(S.hist[hf]) : getJSON("history/" + hf + ".json").then(function (h) { S.hist[hf] = h; return h; }))
      .then(function (h) { if (S.open === c) drawHistory(histWrap, c, (h && h[c.id]) || {}); })
      .catch(function () { if (S.open === c) histWrap.innerHTML = '<div class="mpg-loading">Price history isn\'t available for this card yet.</div>'; });
  }

  function addDays(iso, n) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dnum(iso) { return Date.parse(iso + "T00:00:00Z") / 864e5; }
  function fdate(iso, long) { var d = new Date(iso + "T00:00:00Z"); return d.toLocaleDateString("en-PH", long ? { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" }); }

  function drawHistory(wrap, c, h) {
    var today = (S.idx && S.idx.date) || (S.movers && S.movers.date) || new Date().toISOString().slice(0, 10);
    var series = [];
    if (h.y && h.y.length) series.push({ k: "y", name: "Yuyu-tei", col: "#f2c14e", from: "JPY", pts: h.y });
    if (h.t && h.t.length) series.push({ k: "t", name: "TCG Corner", col: "#4cc9f0", from: "USD", pts: h.t });
    wrap.innerHTML = "";
    if (!series.length) { wrap.appendChild(el("div", { class: "mpg-loading", text: "No price history recorded for this card yet." })); return; }
    var first = series.reduce(function (m, s) { return s.pts[0][0] < m ? s.pts[0][0] : m; }, today);
    var ranges = [["1m", "1M", 30], ["3m", "3M", 91], ["6m", "6M", 182], ["1y", "1Y", 365], ["all", "All", 0]];
    var rng = el("div", { class: "mpg-rng" });
    ranges.forEach(function (r) {
      rng.appendChild(el("button", { type: "button", class: S.range === r[0] ? "on" : "", text: r[1], onclick: function () { S.range = r[0]; drawHistory(wrap, c, h); } }));
    });
    wrap.appendChild(el("div", { class: "mpg-sech" }, [el("h3", { text: "Price history" }), rng]));
    var R = ranges.filter(function (r) { return r[0] === S.range; })[0];
    var start = R[2] ? addDays(today, -R[2]) : first;
    if (start === today) start = addDays(today, -1);

    // value in effect at a date (step function) + points inside window
    function at(pts, d) { var v = null; for (var i = 0; i < pts.length; i++) { if (pts[i][0] <= d) v = pts[i][1]; else break; } return v; }
    series.forEach(function (s) {
      var v0 = at(s.pts, start), w = [];
      if (v0 != null) w.push([start, v0]);
      s.pts.forEach(function (p) { if (p[0] > start && p[0] <= today) w.push(p); });
      if (w.length) w.push([today, w[w.length - 1][1]]);
      s.win = w.map(function (p) { return [p[0], conv(p[1], s.from, S.cur), p[1]]; });
    });
    var prim = series[0];
    var vals = prim.win.map(function (p) { return p[1]; });
    var now = vals[vals.length - 1], then = vals[0];
    var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    var ch = then ? (now - then) / then * 100 : null;
    wrap.appendChild(el("div", { class: "mpg-stats" }, [
      stat("Now (" + prim.name + ")", fmt(now, S.cur)),
      stat("Change", ch == null ? "—" : (ch > 0 ? "+" : "") + ch.toFixed(1) + "%", ch > 0 ? "up" : ch < 0 ? "down" : ""),
      stat("High", fmt(hi, S.cur)), stat("Low", fmt(lo, S.cur))
    ]));

    // chart
    var W = Math.max(300, Math.min(860, Math.round((wrap.clientWidth || 860) - 18))), H = W < 520 ? 210 : 280, pl = W < 520 ? 54 : 64, pr = 12, pt = 14, pb = 30;
    var all = []; series.forEach(function (s) { s.win.forEach(function (p) { all.push(p[1]); }); });
    var ymin = Math.min.apply(null, all), ymax = Math.max.apply(null, all);
    if (ymin === ymax) { ymin *= 0.9; ymax *= 1.1; if (!ymax) ymax = 1; }
    var pad = (ymax - ymin) * 0.12; ymin = Math.max(0, ymin - pad); ymax += pad;
    var raw = (ymax - ymin) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), stp = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).filter(function (m) { return m >= raw; })[0] || raw;
    ymin = Math.floor(ymin / stp) * stp; ymax = Math.ceil(ymax / stp) * stp;
    var nT = Math.round((ymax - ymin) / stp);
    var x0 = dnum(start), x1 = dnum(today); if (x1 === x0) x0 -= 1;
    var X = function (d) { return pl + (dnum(d) - x0) / (x1 - x0) * (W - pl - pr); };
    var Y = function (v) { return pt + (1 - (v - ymin) / (ymax - ymin)) * (H - pt - pb); };
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Price history chart">';
    svg += '<defs><linearGradient id="mpgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + prim.col + '" stop-opacity=".28"/><stop offset="1" stop-color="' + prim.col + '" stop-opacity="0"/></linearGradient></defs>';
    for (var i = 0; i <= nT; i++) {
      var v = ymin + stp * i, y = Y(v);
      svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" stroke="#1d2233" stroke-width="1"/>';
      svg += '<text x="' + (pl - 8) + '" y="' + (y + 4) + '" fill="#6b7089" font-size="11" text-anchor="end">' + esc(fmt(v, S.cur)) + "</text>";
    }
    var span = x1 - x0, ticks = W < 520 ? 3 : 5;
    for (var j = 0; j <= ticks; j++) {
      var dd = addDays(start, Math.round(span * j / ticks));
      svg += '<text x="' + X(dd) + '" y="' + (H - 8) + '" fill="#6b7089" font-size="11" text-anchor="' + (j === 0 ? "start" : j === ticks ? "end" : "middle") + '">' + esc(fdate(dd, span > 300)) + "</text>";
    }
    series.slice().reverse().forEach(function (s) {
      var d = "", p = s.win;
      for (var k = 0; k < p.length; k++) {
        d += (k ? "H" + X(p[k][0]).toFixed(1) + "V" + Y(p[k][1]).toFixed(1) : "M" + X(p[k][0]).toFixed(1) + " " + Y(p[k][1]).toFixed(1));
      }
      if (s === prim) svg += '<path d="' + d + "V" + (H - pb) + "H" + X(p[0][0]).toFixed(1) + 'Z" fill="url(#mpgG)"/>';
      svg += '<path d="' + d + '" fill="none" stroke="' + s.col + '" stroke-width="' + (s === prim ? 2.5 : 2) + '" stroke-linejoin="round"' + (s === prim ? "" : ' stroke-dasharray="5 4"') + "/>";
      p.forEach(function (q, k) { if (k > 0 && k < p.length - 1) svg += '<circle cx="' + X(q[0]).toFixed(1) + '" cy="' + Y(q[1]).toFixed(1) + '" r="3" fill="#0c0f18" stroke="' + s.col + '" stroke-width="2"/>'; });
    });
    svg += '<line id="mpg-cx" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#8b90a8" stroke-dasharray="3 3" visibility="hidden"/>';
    svg += '<rect id="mpg-hit" x="' + pl + '" y="0" width="' + (W - pl - pr) + '" height="' + H + '" fill="transparent"/></svg>';
    var tip = el("div", { class: "mpg-tip" });
    var chart = el("div", { class: "mpg-chart", html: svg }); chart.appendChild(tip);
    wrap.appendChild(chart);
    var svgEl = chart.querySelector("svg"), cx = chart.querySelector("#mpg-cx");
    function move(ev) {
      var r = svgEl.getBoundingClientRect(), pX = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      var vx = pX / r.width * W; if (vx < pl) vx = pl; if (vx > W - pr) vx = W - pr;
      var day = addDays(start, Math.round((vx - pl) / (W - pl - pr) * span));
      if (day > today) day = today;
      cx.setAttribute("x1", X(day)); cx.setAttribute("x2", X(day)); cx.setAttribute("visibility", "visible");
      var html = "<b>" + esc(fdate(day, true)) + "</b>";
      series.forEach(function (s) {
        var raw = at(s.pts, day);
        if (raw != null) html += '<br><span class="mpg-dot" style="background:' + s.col + '"></span>' + s.name + ": <b>" + esc(fmt(conv(raw, s.from, S.cur), S.cur)) + "</b>" + (S.cur !== s.from ? ' <span style="color:#7d839b">(' + esc(fmt(raw, s.from)) + ")</span>" : "");
      });
      tip.innerHTML = html; tip.style.display = "block";
      var tx = X(day) / W * r.width + 12; if (tx + tip.offsetWidth > r.width) tx = X(day) / W * r.width - tip.offsetWidth - 12;
      tip.style.left = Math.max(4, tx) + "px"; tip.style.top = "12px";
    }
    function leave() { tip.style.display = "none"; cx.setAttribute("visibility", "hidden"); }
    svgEl.addEventListener("mousemove", move); svgEl.addEventListener("mouseleave", leave);
    svgEl.addEventListener("touchstart", move, { passive: true }); svgEl.addEventListener("touchmove", move, { passive: true }); svgEl.addEventListener("touchend", leave);

    wrap.appendChild(el("div", { class: "mpg-legend", html: series.map(function (s) { return '<span><span class="mpg-dot" style="background:' + s.col + '"></span>' + s.name + (s.k === "y" ? " (standard)" : c.yyt == null ? " (fallback)" : " (reference)") + "</span>"; }).join("") }));

    // change log
    var rows = [];
    series.forEach(function (s) {
      for (var k = s.pts.length - 1; k >= 0; k--) {
        var p = s.pts[k], prev = k ? s.pts[k - 1][1] : null;
        rows.push({ d: p[0], s: s, v: p[1], prev: prev });
      }
    });
    rows.sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; });
    var tb = rows.slice(0, 120).map(function (r) {
      var delta = r.prev == null ? '<span style="color:#7d839b">First seen</span>' : (function () { var p = (r.v - r.prev) / r.prev * 100; return '<span class="' + (p > 0 ? "up" : "down") + '">' + (p > 0 ? "▲ +" : "▼ ") + p.toFixed(1) + "%</span>"; })();
      return "<tr><td>" + esc(fdate(r.d, true)) + '</td><td><span class="mpg-dot" style="background:' + r.s.col + '"></span>' + r.s.name + '</td><td class="r"><b>' + esc(fmt(conv(r.v, r.s.from, S.cur), S.cur)) + "</b>" + (S.cur !== r.s.from ? '<br><span style="color:#7d839b;font-size:11.5px">' + esc(fmt(r.v, r.s.from)) + "</span>" : "") + '</td><td class="r">' + delta + "</td></tr>";
    }).join("");
    wrap.appendChild(el("div", { class: "mpg-log", html: '<table><thead><tr><th>Date</th><th>Source</th><th class="r">Price</th><th class="r">Change</th></tr></thead><tbody>' + tb + "</tbody></table>" }));
    wrap.appendChild(el("div", { class: "mpg-hnote", text: "Tracking since " + fdate(first, true) + ". A new row is added only when a store changes its price." + (S.cur !== "JPY" || series.length > 1 ? " Converted prices use today's exchange rate." : "") }));
    function stat(l, v, cls) { return el("div", { class: "mpg-stat" }, [el("small", { text: l }), el("b", { class: cls || "", text: v })]); }
  }

  /* ---------- boot ---------- */
  function boot() {
    root = document.getElementById("mpg");
    if (!root) { root = el("div", { id: "mpg" }); (document.currentScript && document.currentScript.parentNode || document.body).appendChild(root); }
    build();
    getJSON("movers.json").then(function (m) {
      S.movers = m; chips(); render();
      if (!(m.gainers || []).length && S.tab === "gainers") { var tb = document.querySelector('#mpg-tabs [data-t="top"]'); if (tb) tb.click(); }
    }).catch(function () { S.tab = "all"; });
    ensureIndex();
    window.addEventListener("hashchange", deepLink);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
