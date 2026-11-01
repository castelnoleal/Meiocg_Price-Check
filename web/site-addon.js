/* MEIOCG site add-on for the Price Guide
   1. Adds "Prices" to the main menu on every page that has the site header.
   2. On the home page, adds a "Latest set" price preview that links to /prices/.
   Safe to include on every page: it does nothing twice and nothing on pages without the site header. */
(function () {
  "use strict";
  if (window.__mpgAddon) return; window.__mpgAddon = 1;
  var DATA = window.MEIOCG_PRICES_BASE ? [window.MEIOCG_PRICES_BASE] : [
    "https://raw.githubusercontent.com/castelnoleal/Meiocg_Price-Check/data/",
    "https://cdn.jsdelivr.net/gh/castelnoleal/Meiocg_Price-Check@data/"
  ];
  var PRICES = "/prices/";
  var path = location.pathname.replace(/\/+$/, "/");
  var isHome = path === "/" || path === "/ygo/" || path === "/index.html";

  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---- 1. menu link ---- */
  function navLink() {
    var nav = document.querySelector("header.top .nav") || document.getElementById("site-nav");
    if (!nav) return false;
    var links = [].slice.call(nav.querySelectorAll("a"));
    var mine = links.filter(function (a) { return /\/prices\/?$/.test(a.getAttribute("href") || ""); })[0];
    if (!mine) {
      mine = document.createElement("a"); mine.href = PRICES; mine.textContent = "Prices"; mine.className = "mpg-navlink";
      var about = links.filter(function (a) { return /about/i.test(a.getAttribute("href") || ""); })[0];
      nav.insertBefore(mine, about || null);
    }
    if (/^\/prices\/?$/.test(path)) {
      links.forEach(function (a) { if (a !== mine) a.removeAttribute("aria-current"); });
      mine.setAttribute("aria-current", "page");
    }
    if (!document.getElementById("mpg-addon-nav-css")) {
      var st = el("style"); st.id = "mpg-addon-nav-css";
      st.textContent = "header.top .nav a.mpg-navlink{white-space:nowrap}header.top .tools a,header.top .tools button{white-space:nowrap}" +
        "@media (max-width:1440px){header.top .nav:has(.mpg-navlink) a{padding-left:11px;padding-right:11px}}";
      document.head.appendChild(st);
    }
    return true;
  }

  /* ---- 2. home page preview ---- */
  var CSS = [
    ".mpgp{max-width:1140px;margin:0 auto;padding:56px 20px}",
    ".mpgp-k{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:14.4px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#9aa2bb)}",
    ".mpgp-h{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:22px}",
    ".mpgp-h h2{font-family:'Chakra Petch',system-ui,sans-serif;font-size:clamp(28px,4vw,40px);line-height:1.1;margin:0;font-weight:700;letter-spacing:-.01em;color:var(--ink,#eef0f8)}",
    ".mpgp-h h2 span{background:linear-gradient(100deg,var(--brand,#7088ff) 10%,var(--fusion,#a988ef) 55%,var(--effect,#f39350) 95%);-webkit-background-clip:text;background-clip:text;color:transparent}",
    ".mpgp-all{display:inline-flex;align-items:center;gap:8px;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:16px;padding:12px 22px;border-radius:999px;border:1px solid color-mix(in srgb,var(--ink,#eef0f8) 18%,transparent);background:var(--surface,#11141f);color:var(--ink,#eef0f8)!important;text-decoration:none!important;transition:border-color .15s,color .15s}",
    ".mpgp-all:hover{border-color:var(--brand,#7088ff);color:var(--brand,#7088ff)!important}",
    ".mpgp-box{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.25fr);gap:0;border-radius:22px;border:1px solid var(--line,#262b3d);background:var(--surface,#11141f);overflow:hidden;box-shadow:0 30px 60px -40px var(--shadow,rgba(0,0,0,.7))}",
    ".mpgp-feat{position:relative;padding:24px;background:radial-gradient(420px 260px at 50% 0%,var(--brand-soft,rgba(112,136,255,.15)),transparent 75%),radial-gradient(360px 220px at 100% 100%,color-mix(in srgb,var(--effect,#f39350) 12%,transparent),transparent 70%);border-right:1px solid var(--line,#262b3d);text-decoration:none!important;color:inherit!important;display:block}",
    ".mpgp-badge{display:inline-block;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:13px;padding:4px 12px;border-radius:999px;background:var(--brand,#7088ff);color:var(--brand-ink,#0b0e1c)}",
    ".mpgp-fan{position:relative;height:200px;margin:18px 0 10px}",
    ".mpgp-fan img{position:absolute;top:0;left:50%;width:124px;aspect-ratio:59/86;object-fit:cover;border-radius:7px;box-shadow:0 14px 26px -10px rgba(0,0,0,.6);transition:transform .25s;background:var(--surface-2,#181c2b)}",
    ".mpgp-fan .f0{z-index:3;transform:translateX(-50%)}.mpgp-fan .f1{z-index:2;transform:translateX(-118%) rotate(-9deg) translateY(14px)}.mpgp-fan .f2{z-index:1;transform:translateX(18%) rotate(9deg) translateY(14px)}",
    ".mpgp-feat:hover .f1{transform:translateX(-128%) rotate(-12deg) translateY(10px)}.mpgp-feat:hover .f2{transform:translateX(28%) rotate(12deg) translateY(10px)}",
    ".mpgp-code{font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;color:var(--effect,#f39350)}",
    ".mpgp-name{font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:26px;line-height:1.15;margin:3px 0 12px;color:var(--ink,#eef0f8)}",
    ".mpgp-stats{display:flex;gap:10px;flex-wrap:wrap}",
    ".mpgp-stats div{padding:8px 13px;border-radius:14px;background:var(--bg,#090b14);border:1px solid var(--line,#262b3d)}",
    ".mpgp-stats small,.mpgp-list small{display:block;font-family:'Chakra Petch',system-ui,sans-serif;font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted,#9aa2bb)}",
    ".mpgp-stats b{font-family:'Chakra Petch',system-ui,sans-serif;font-size:18px;color:var(--ink,#eef0f8)}",
    ".mpgp-list{padding:20px 22px;display:flex;flex-direction:column;min-width:0}",
    ".mpgp-list ol{list-style:none;margin:8px 0 0;padding:0;counter-reset:r}",
    ".mpgp-row{display:grid;grid-template-columns:22px 40px minmax(0,1fr) auto;align-items:center;gap:12px;padding:8px 6px;border-radius:12px;text-decoration:none!important;color:inherit!important;transition:background .15s}",
    ".mpgp-row:hover{background:var(--brand-soft,rgba(112,136,255,.15))}",
    ".mpgp-row i{font-style:normal;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;color:var(--muted,#9aa2bb);text-align:center}",
    ".mpgp-row img{width:40px;aspect-ratio:59/86;object-fit:cover;border-radius:4px;background:var(--surface-2,#181c2b)}",
    ".mpgp-row span{min-width:0}",
    ".mpgp-row span b{display:block;font-family:'Chakra Petch',system-ui,sans-serif;font-weight:700;font-size:15px;color:var(--ink,#eef0f8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".mpgp-row span em{display:block;font-style:normal;font-size:12.5px;color:var(--muted,#9aa2bb);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".mpgp-row strong{font-family:'Chakra Petch',system-ui,sans-serif;font-size:17px;color:var(--ink,#eef0f8);text-align:right}",
    ".mpgp-row strong small{display:block;font-size:11.5px;letter-spacing:0;text-transform:none;font-weight:600;color:var(--muted,#9aa2bb)}",
    ".mpgp-foot{margin-top:auto;padding-top:12px;font-size:12.5px;color:var(--muted,#9aa2bb)}",
    "@media (max-width:820px){.mpgp-box{grid-template-columns:1fr}.mpgp-feat{border-right:0;border-bottom:1px solid var(--line,#262b3d)}.mpgp{padding:40px 16px}.mpgp-fan{height:170px}.mpgp-fan img{width:104px}}"
  ].join("");

  function getJSON(file) {
    var i = 0;
    function go() {
      return fetch(DATA[i] + file, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .catch(function (e) { if (++i < DATA.length) return go(); throw e; });
    }
    return go();
  }
  function img(c) {
    if (!c.img) return "";
    return c.img === "@" ? "https://card.yuyu-tei.jp/ygo/100_140/" + c.set + "/" + String(c.id).split("-").pop() + ".jpg" : c.img;
  }
  function yen(v) { return v == null ? "—" : "¥" + Math.round(v).toLocaleString("en-US"); }
  function php(v, r) { return v == null || !r ? "" : "≈ ₱" + Math.round(v * r).toLocaleString("en-US"); }

  function preview() {
    if (!isHome || document.getElementById("mpg-preview")) return;
    var main = document.querySelector("main") || document.getElementById("main");
    if (!main) return;
    getJSON("movers.json").then(function (m) {
      var L = m.latest; if (!L || !L.cards || !L.cards.length) return;
      var cards = L.cards.map(function (r) { var o = {}; m.cols.forEach(function (k, i) { o[k] = r[i]; }); return o; });
      build(main, L, cards, m.rates && m.rates.JPY_PHP);
    }).catch(function () {});
  }
  function build(main, L, cards, rate) {
    if (document.getElementById("mpg-preview")) return;
    if (!document.getElementById("mpg-preview-css")) { var st = el("style"); st.id = "mpg-preview-css"; st.textContent = CSS; document.head.appendChild(st); }
    var total = cards.reduce(function (a, c) { return a + (c.yyt || 0); }, 0);
    var top3 = cards.slice(0, 3), top5 = cards.slice(0, 5);
    var link = PRICES;
    var fan = top3.map(function (c, i) { var u = img(c); return u ? '<img class="f' + i + '" src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">' : ""; }).join("");
    var rows = top5.map(function (c, i) {
      var u = img(c);
      return '<li><a class="mpgp-row" href="' + link + "#card=" + encodeURIComponent(c.id) + '"><i>' + (i + 1) + "</i>" +
        (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">' : "<span></span>") +
        "<span><b>" + esc(c.name) + "</b><em>" + esc(c.code + " · " + c.rarity + (c.en ? " · " + c.en : "")) + "</em></span>" +
        "<strong>" + yen(c.yyt) + "<small>" + php(c.yyt, rate) + "</small></strong></a></li>";
    }).join("");
    var sec = el("section", "mpgp");
    sec.id = "mpg-preview";
    sec.setAttribute("aria-label", "Latest set prices");
    sec.innerHTML =
      '<div class="mpgp-h"><div><p class="mpgp-k">◆ MEIOCG Price Guide</p><h2>Latest set <span>prices</span></h2></div>' +
      '<a class="mpgp-all" href="' + link + '">Open the Price Guide →</a></div>' +
      '<div class="mpgp-box">' +
      '<a class="mpgp-feat" href="' + link + '"><span class="mpgp-badge">Latest set</span><div class="mpgp-fan">' + fan + "</div>" +
      '<div class="mpgp-code">' + esc(L.code.toUpperCase()) + " · " + L.count + ' cards</div><div class="mpgp-name">' + esc(L.name) + "</div>" +
      '<div class="mpgp-stats"><div><small>Top card</small><b>' + yen(top3[0] && top3[0].yyt) + "</b></div><div><small>Full set (1 of each)</small><b>" + yen(total) + "</b></div></div></a>" +
      '<div class="mpgp-list"><small>Most valuable in this set</small><ol>' + rows + "</ol>" +
      '<div class="mpgp-foot">Yuyu-tei prices, updated daily. Tap a card for its price history.</div></div></div>';
    var sections = [].slice.call(main.children).filter(function (n) { return n.tagName === "SECTION" || n.tagName === "DIV"; });
    var after = sections[0];
    if (after && after.nextSibling) main.insertBefore(sec, after.nextSibling); else main.appendChild(sec);
  }

  function start() {
    var tries = 0;
    (function wait() {   // the site header can be inserted by script after load
      if (navLink() || ++tries > 40) { preview(); return; }
      setTimeout(wait, 150);
    })();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
