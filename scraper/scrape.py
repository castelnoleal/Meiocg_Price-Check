#!/usr/bin/env python3
"""
MEIOCG Price Guide scraper
==========================
Standard price  : Yuyu-tei (https://yuyu-tei.jp/top/ygo)  — JPY, sell (販売) price
Fallback price  : TCG Corner (https://tcg-corner.com)     — USD, Japanese singles

Output (written into --out, normally the `data` branch checkout):
  index.json            every card + current prices + 7d/30d change  (loaded by the page)
  movers.json           top gainers / losers / most expensive         (small, loaded first)
  history/<set>.json    price history per card, change-points only    (loaded on click)
  history/_tc.json      history for cards that only exist on TCG Corner
  meta.json             run stats

History rows are stored only when a price changes, so files stay small:
  { "<cardId>": { "y": [["2026-11-01", 1980], ["2026-11-04", 2480]],
                  "t": [["2026-11-01", 12.5]] } }

Usage:
  python scraper/scrape.py --out data                 # full run
  python scraper/scrape.py --out data --sets imph,dbgv --skip-tc   # quick test
  python scraper/scrape.py --parse-file page.html     # debug the Yuyu-tei parser on a saved page
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

YYT = "https://yuyu-tei.jp"
YYT_TOP = f"{YYT}/top/ygo"
TC = "https://tcg-corner.com"
UA = ("Mozilla/5.0 (compatible; MEIOCG-PriceGuide/1.0; +https://meiocg.org; "
      "contact metainsiderocg@gmail.com)")
SKIP_SET_CODES = {"search", "damage", "sale", "ultra", "new", "bag", "set", "deck"}
CARD_HREF_RE = re.compile(r"/sell/ygo/card/([a-z0-9_\-]+)/(\d+)")
YEN_RE = re.compile(r"([\d,]{2,})\s*円")
STOCK_RE = re.compile(r"在庫\s*[:：]\s*([^\s<]+)")
CODE_RE = re.compile(r"\b([A-Z0-9]{2,6}-(?:JP|JA|KR|EN|AE)[A-Z]?\d{2,3})\b")

TODAY = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date().isoformat()  # Manila date


# --------------------------------------------------------------------------- http
DEBUG_DIR = os.getenv("SCRAPE_DEBUG_DIR")
_dbg_n = 0


def gh_note(level: str, msg: str):
    """Print a GitHub Actions annotation (visible on the run page) and a normal log line."""
    if os.getenv("GITHUB_ACTIONS"):
        print(f"::{level}::{msg}", flush=True)
    log(msg)


def save_debug(url: str, r):
    global _dbg_n
    if not DEBUG_DIR or _dbg_n >= 6:
        return
    _dbg_n += 1
    d = Path(DEBUG_DIR); d.mkdir(parents=True, exist_ok=True)
    name = re.sub(r"[^a-z0-9]+", "_", url.lower())[-60:]
    body = r.text if r is not None else ""
    st = r.status_code if r is not None else "ERR"
    (d / f"{_dbg_n:02d}_{st}_{name}.html").write_text(body[:400000], "utf-8")


CHROME = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
          "Chrome/141.0.0.0 Safari/537.36")
PROFILES = [
    {"User-Agent": CHROME,
     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
     "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7", "Accept-Encoding": "gzip, deflate",
     "Upgrade-Insecure-Requests": "1", "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
     "Sec-Fetch-Site": "none", "Sec-Fetch-User": "?1",
     "sec-ch-ua": '"Google Chrome";v="141", "Chromium";v="141", "Not=A?Brand";v="24"',
     "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"'},
    {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 "
                   "(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
     "Accept-Language": "ja-JP,ja;q=0.9"},
    {"User-Agent": UA, "Accept-Language": "ja,en;q=0.8"},
]


class Http:
    def __init__(self, delay: float):
        self.s = requests.Session()
        self.p = 0
        self.s.headers.update(PROFILES[0])
        self.delay = delay
        self._last = 0.0
        self.proxy = os.getenv("YYT_PROXY", "").rstrip("/")  # optional Cloudflare Worker relay

    def get(self, url: str, **kw) -> requests.Response | None:
        for attempt in range(4):
            wait = self.delay - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()
            try:
                target = url
                if self.proxy and "yuyu-tei.jp" in url:
                    target = self.proxy + "/?url=" + requests.utils.quote(url, safe="")
                r = self.s.get(target, timeout=30, **kw)
                save_debug(url, r)
                if r.status_code == 200:
                    return r
                if r.status_code in (404, 410):
                    return None
                gh_note("warning", f"HTTP {r.status_code} {url} (attempt {attempt + 1}, profile {self.p}) server={r.headers.get('server')}")
                if r.status_code in (403, 429, 503) and self.p < len(PROFILES) - 1:
                    self.p += 1
                    self.s.headers.clear()
                    self.s.headers.update(PROFILES[self.p])
                    self.s.cookies.clear()
                    continue
            except requests.RequestException as e:
                gh_note("warning", f"{type(e).__name__}: {e} — {url} (attempt {attempt + 1})")
            time.sleep(5 * (attempt + 1))
        return None


def log(*a):
    print(*a, file=sys.stderr, flush=True)


# --------------------------------------------------------------------------- yuyu-tei
def yyt_list_sets(http: Http) -> dict[str, str]:
    """Return {set_code: set_name} from the Yuyu-tei OCG top page (links + 収録弾 dropdown)."""
    r = http.get(YYT_TOP)
    if not r:
        gh_note("warning", "Could not load Yuyu-tei top page (blocked?) — keeping previous Yuyu-tei prices")
        return {}
    soup = BeautifulSoup(r.text, "lxml")
    sets: dict[str, str] = {}
    # 収録弾 search panel: <input name="vers[]" value="imph" id="imphVers..."><label for=...>[IMPH] IMMORTAL PHOENIX</label>
    for inp in soup.select('input[name="vers[]"]'):
        v = (inp.get("value") or "").strip().lower()
        if not v or v in SKIP_SET_CODES:
            continue
        lab = soup.find("label", attrs={"for": inp.get("id")}) if inp.get("id") else None
        name = lab.get_text(" ", strip=True) if lab else ""
        name = re.sub(r"^\[[^\]]+\]\s*", "", name).strip() or v.upper()
        sets.setdefault(v, name)
    if len(sets) > 20:
        return sets
    for a in soup.select('a[href*="/sell/ygo/s/"]'):
        m = re.search(r"/sell/ygo/s/([a-z0-9_\-]+)", a.get("href", ""))
        if m and m.group(1) not in SKIP_SET_CODES:
            name = a.get_text(" ", strip=True)
            if m.group(1) not in sets or (name and len(name) > len(sets[m.group(1)])):
                sets[m.group(1)] = name
    # The search panel's set dropdown lists every set; option values are set codes.
    for opt in soup.select("select option"):
        v = (opt.get("value") or "").strip().lower()
        if re.fullmatch(r"[a-z0-9_\-]{2,12}", v) and v not in SKIP_SET_CODES:
            label = opt.get_text(" ", strip=True)
            if label and not label.isdigit():
                sets.setdefault(v, label)
                if len(label) > len(sets[v]):
                    sets[v] = label
    for k, v in list(sets.items()):
        sets[k] = re.sub(r"\s+", " ", v).strip() or k.upper()
    return sets


def _stock(txt: str | None) -> int:
    """× → 0, number → n, ◯/○/有 → -1 (in stock, count unknown)."""
    if not txt:
        return -1
    t = txt.strip()
    if t in ("×", "✕", "x", "X", "-", "0"):
        return 0
    m = re.search(r"\d+", t)
    if m:
        return int(m.group())
    return -1


def code_guess(im) -> str:
    m = CODE_RE.search(im.get("alt") or "")
    return m.group(1) if m else "\x00"


def yyt_parse_set(html: str, set_code: str) -> list[dict]:
    """Parse a Yuyu-tei set (sell) page. Class-name independent: anchors on the card links,
    then reads the smallest enclosing block that holds exactly one card + a yen price."""
    soup = BeautifulSoup(html, "lxml")
    for s in soup.select("del, s, strike"):  # drop struck-through pre-sale prices
        s.decompose()
    cards: dict[str, dict] = {}
    for a in soup.select('a[href*="/sell/ygo/card/"]'):
        m = CARD_HREF_RE.search(a.get("href", ""))
        if not m:
            continue
        cset, cid = m.group(1), m.group(2)
        if set_code != "test" and cset != set_code:
            continue  # "pick up" / related cards from other sets shown on this page
        key = f"{cset}-{cid}"
        if key in cards:
            continue
        # climb to the card container
        box, node = None, a
        for _ in range(8):
            node = node.parent
            if node is None or node.name in ("body", "html"):
                break
            hrefs = {CARD_HREF_RE.search(x.get("href", "")).group(0)
                     for x in node.select('a[href*="/sell/ygo/card/"]')
                     if CARD_HREF_RE.search(x.get("href", ""))}
            if len(hrefs) > 1:
                break
            if YEN_RE.search(node.get_text(" ", strip=True)):
                box = node
                break
        if box is None:
            continue
        text = box.get_text(" ", strip=True)
        img = None
        for im in box.find_all("img"):
            src0 = im.get("data-src") or im.get("src") or ""
            if "card.yuyu-tei.jp" in src0 or (im.get("alt") or "").startswith(code_guess(im)):
                img = im
                break
        if img is None:
            img = next((im for im in box.find_all("img") if (im.get("alt") or "").lower() != "star"
                        and "btn-icon" not in (im.get("src") or "")), None)
        alt = (img.get("alt") if img else "") or ""
        label = alt or " ".join(x.get_text(" ", strip=True) for x in box.select('a[href*="/sell/ygo/card/"]'))
        code_m = CODE_RE.search(label) or CODE_RE.search(text)
        code = code_m.group(1) if code_m else ""
        rarity, name = "", ""
        if code and code in label:
            rest = label.split(code, 1)[1].strip().split()
            if rest:
                rarity = rest[0]
                name = " ".join(rest[1:]).strip()
        if not name:
            h = box.find(["h4", "h5", "h3"])
            name = h.get_text(" ", strip=True) if h else ""
        if not rarity:
            # section header such as "PSE Card List"
            hdr = box.find_previous(lambda t: t.name in ("h2", "h3") and "Card List" in t.get_text())
            if hdr:
                rarity = hdr.get_text(" ", strip=True).replace("Card List", "").strip()
        price_m = YEN_RE.findall(text)
        price = int(price_m[-1].replace(",", "")) if price_m else None
        stock_m = STOCK_RE.search(text)
        src = ""
        if img:
            src = img.get("data-src") or img.get("src") or ""
            if src.startswith("/"):
                src = YYT + src
        cards[key] = {
            "id": key, "set": cset, "yid": cid, "code": code, "rarity": rarity,
            "name": name or code, "img": src, "yyt": price,
            "stock": _stock(stock_m.group(1) if stock_m else None),
        }
    return list(cards.values())


def yyt_crawl(http: Http, only: list[str] | None, max_sets: int | None):
    sets = yyt_list_sets(http)
    if not sets:
        return {}, [], ["*"]
    if only:
        sets = {k: sets.get(k, k.upper()) for k in only}
    codes = sorted(sets)
    if max_sets:
        codes = codes[:max_sets]
    log(f"Yuyu-tei: {len(codes)} sets")
    all_cards, failed = [], []
    for i, code in enumerate(codes, 1):
        r = http.get(f"{YYT}/sell/ygo/s/{code}")
        if not r:
            failed.append(code)
            continue
        cards = yyt_parse_set(r.text, code)
        # set name from the page <title> if the top page gave us nothing useful
        if sets.get(code, "").upper() == code.upper():
            soup = BeautifulSoup(r.text, "lxml")
            h = soup.select_one("#power h3") or soup.title
            if h:
                sets[code] = re.sub(r"^\[[^\]]+\]\s*", "", re.split(r"[|｜]", h.get_text(" ", strip=True))[0]).strip()
        seen = {c["id"] for c in all_cards[-2000:]}
        all_cards.extend(c for c in cards if c["id"] not in seen)
        if i % 25 == 0 or i == len(codes):
            log(f"  {i}/{len(codes)} sets, {len(all_cards)} cards")
    return sets, all_cards, failed


# --------------------------------------------------------------------------- tcg corner
RARITY_ALIASES = [
    (r"quarter century|qcsr|qcse|qcscr|25th", "QCSE"),
    (r"prismatic", "PSE"),
    (r"20th", "20thSE"),
    (r"ultimate|\bul\b|\butr\b", "UL"),
    (r"collector", "CR"),
    (r"holographic|\bhr\b|\bhgr\b", "HR"),
    (r"extra secret|\besr\b|\bex[sc]e\b", "EXSE"),
    (r"starlight|ultra secret|\buse\b", "USE"),
    (r"millennium|\bm\b|\bmlr\b", "M"),
    (r"gold secret|\bgse\b", "GSE"),
    (r"gold rare|\bgr\b", "GR"),
    (r"normal parallel|\bnpr\b|\bnp\b", "NP"),
    (r"secret|\bse\b|\bscr\b|\bsec\b", "SE"),
    (r"ultra|\bur\b", "UR"),
    (r"super|\bsr\b", "SR"),
    (r"rare|\br\b", "R"),
    (r"common|normal|\bn\b|\bc\b", "N"),
]


SHORT_RARITY = {
    "N": "N", "C": "N", "R": "R", "SR": "SR", "UR": "UR", "SE": "SE", "SER": "SE", "SCR": "SE", "SEC": "SE",
    "PSE": "PSE", "PSER": "PSE", "PSCR": "PSE", "PSR": "PSE", "QCSE": "QCSE", "QCSER": "QCSE", "QCSCR": "QCSE",
    "QCSR": "QCSE", "UL": "UL", "UTR": "UL", "CR": "CR", "HR": "HR", "HGR": "HR", "NP": "NP", "NPR": "NP",
    "GR": "GR", "GSE": "GSE", "GSER": "GSE", "M": "M", "MLR": "M", "20THSE": "20thSE", "20SER": "20thSE",
    "20SE": "20thSE", "EXSE": "EXSE", "ESR": "EXSE", "USE": "USE", "KC": "KC", "KCR": "KC", "P": "P", "PR": "P",
}


def norm_rarity(r: str) -> str:
    t = (r or "").strip().lower()
    if not t:
        return ""
    k = re.sub(r"[\s*+.\-]", "", t).upper()
    if k in SHORT_RARITY:
        return SHORT_RARITY[k]
    if len(k) <= 6 and not re.search(r"rare|secret", t):
        return k
    for pat, out in RARITY_ALIASES:
        if re.search(pat, t):
            return out
    return t.upper()


def tc_crawl(http: Http, collection: str | None):
    base = f"{TC}/collections/{collection}/products.json" if collection else f"{TC}/products.json"
    out = []
    page = 1
    while page <= 400:
        r = http.get(base, params={"limit": 250, "page": page})
        if not r:
            break
        try:
            prods = r.json().get("products", [])
        except ValueError:
            break
        if not prods:
            break
        for p in prods:
            title = p.get("title", "")
            m = CODE_RE.search(title)
            if not m or "-JP" not in m.group(1):
                continue  # only Japanese (OCG) printings
            paren = re.findall(r"\(([^()]*)\)", title)
            status = next((x for x in paren if re.search(r"status|condition|played|damaged", x, re.I)), "")
            rar_raw = next((x for x in reversed(paren) if x is not status and x != status
                            and not re.search(r"art|alt|status|edition|ver", x, re.I)), "")
            rarity = norm_rarity(rar_raw)
            srank = 0 if (not status or re.search(r"\bA\b|mint|NM", status)) else 1
            name = re.sub(CODE_RE, "", title)
            name = re.sub(r"\([^()]*\)", "", name)
            name = re.sub(r"\s*[-–|]\s*$|^\s*[-–|]\s*", "", name).strip(" -–|")
            vs = p.get("variants") or []
            avail = [v for v in vs if v.get("available")]
            pool = avail or vs
            prices = [float(v["price"]) for v in pool if v.get("price")]
            if not prices or min(prices) >= 5000:
                continue  # empty, or a "not for sale" placeholder price (e.g. $10,000)
            img = ""
            if p.get("images"):
                img = p["images"][0].get("src", "")
            out.append({
                "code": m.group(1), "rarity": rarity, "name": name,
                "usd": min(prices), "avail": bool(avail), "srank": srank,
                "alt": bool(re.search(r"extended art|alternate|alt art|art ", title, re.I)),
                "handle": p.get("handle", ""), "img": img,
            })
        log(f"  TCG Corner page {page}: {len(out)} JP singles so far")
        page += 1
    return out


# --------------------------------------------------------------------------- rates
def fx_rates(http: Http, old: dict) -> dict:
    """JPY→PHP, USD→PHP, JPY→USD. Keeps yesterday's rates if the API is down."""
    r = http.get("https://open.er-api.com/v6/latest/USD")
    try:
        j = r.json()["rates"]
        return {"USD_PHP": round(j["PHP"], 4), "JPY_PHP": round(j["PHP"] / j["JPY"], 6),
                "USD_JPY": round(j["JPY"], 4), "date": TODAY}
    except Exception:
        return old or {"USD_PHP": 58.0, "JPY_PHP": 0.38, "USD_JPY": 152.0, "date": "fallback"}


# --------------------------------------------------------------------------- history
def load_json(p: Path, default):
    try:
        return json.loads(p.read_text("utf-8"))
    except Exception:
        return default


def push_point(series: list, value):
    """Append [TODAY, value] only if it differs from the last recorded value."""
    if value is None:
        return
    if series and series[-1][0] == TODAY:
        series[-1][1] = value
        if len(series) > 1 and series[-2][1] == value:
            series.pop()
        return
    if not series or series[-1][1] != value:
        series.append([TODAY, value])


def value_at(series: list, date: str):
    """Price in effect on `date` (last change-point on/before date)."""
    v = None
    for d, p in series:
        if d <= date:
            v = p
        else:
            break
    return v


def pct(now, then):
    if now is None or then in (None, 0):
        return None
    return round((now - then) / then * 100, 1)


# --------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    ap.add_argument("--sets", help="comma list of Yuyu-tei set codes (testing)")
    ap.add_argument("--max-sets", type=int)
    ap.add_argument("--delay", type=float, default=float(os.getenv("SCRAPE_DELAY", "1.2")))
    ap.add_argument("--skip-tc", action="store_true")
    ap.add_argument("--tc-collection", default=os.getenv("TC_COLLECTION") or None,
                    help="TCG Corner collection handle with JP singles (default: whole store)")
    ap.add_argument("--parse-file", help="debug: parse a saved Yuyu-tei set page and print JSON")
    a = ap.parse_args()

    if a.parse_file:
        cards = yyt_parse_set(Path(a.parse_file).read_text("utf-8", "ignore"), "test")
        print(json.dumps(cards[:10], ensure_ascii=False, indent=1))
        log(f"{len(cards)} cards parsed")
        return

    out = Path(a.out)
    (out / "history").mkdir(parents=True, exist_ok=True)
    http = Http(a.delay)
    old_index = load_json(out / "index.json", {})
    old_sets = old_index.get("sets", {})

    only = [s.strip().lower() for s in a.sets.split(",")] if a.sets else None
    sets, yyt_cards, failed = yyt_crawl(http, only, a.max_sets)
    for k, v in old_sets.items():  # keep names of sets we couldn't reload
        sets.setdefault(k, v)
    old_n = sum(1 for r in old_index.get("cards", []) if not str(r[0]).startswith("tc-"))
    yyt_down = failed == ["*"]
    if yyt_down:
        failed = sorted(old_sets) or []
    elif not yyt_cards or (not only and old_n and len(yyt_cards) < old_n * 0.5):
        raise SystemExit(f"Yuyu-tei returned {len(yyt_cards)} cards (last run {old_n}). "
                         "Site blocked or markup changed — keeping yesterday's data.")

    tc_items = [] if a.skip_tc else tc_crawl(http, a.tc_collection)
    log(f"TCG Corner: {len(tc_items)} JP singles")

    # --- match TCG Corner → Yuyu-tei by card code + rarity (code-only if unambiguous)
    by_code: dict[str, list[dict]] = {}
    for c in yyt_cards:
        by_code.setdefault(c["code"], []).append(c)
    tc_only = []
    for t in tc_items:
        cands = by_code.get(t["code"], [])
        hit = [c for c in cands if norm_rarity(c["rarity"]) == t["rarity"]] if t["rarity"] else []
        if not hit and len(cands) == 1:
            hit = cands
        if hit:
            c = hit[0]
            if t.get("alt"):
                tc_only.append(t)
                continue
            better = (c.get("tc") is None or (t["srank"], t["usd"]) < (c.get("_tcr", 9), c["tc"]))
            if better:
                c["_tcr"] = t["srank"]
                c["tc"], c["tch"], c["tca"] = t["usd"], t["handle"], t["avail"]
                c["en"] = t["name"]
        else:
            tc_only.append(t)

    if only:  # partial run: keep every other set's cards from the last full run
        failed = sorted(set(failed) | (set(old_sets) - set(only)))

    # --- carry over cards from sets that failed this run, so they don't vanish
    if failed and old_index.get("cards"):
        cols = old_index["cols"]
        for row in old_index["cards"]:
            r = dict(zip(cols, row))
            if r.get("set") in failed and r.get("set") != "_tc":
                yyt_cards.append({"id": r["id"], "set": r["set"], "yid": r["id"].split("-")[-1],
                                  "code": r["code"], "rarity": r["rarity"], "name": r["name"],
                                  "en": r.get("en", ""), "img": r.get("img", ""), "yyt": r.get("yyt"),
                                  "stock": r.get("stock", -1), "tc": r.get("tc"), "tch": r.get("tch", ""),
                                  "tca": r.get("tca"), "_stale": 1})

    for t in tc_only:
        h = re.sub(r"[^a-z0-9\-]", "", t["handle"].lower())[:60]
        yyt_cards.append({"id": f"tc-{h}", "set": "_tc", "yid": "", "code": t["code"],
                          "rarity": t["rarity"], "name": t["name"], "en": t["name"], "img": t["img"],
                          "yyt": None, "stock": -1, "tc": t["usd"], "tch": t["handle"], "tca": t["avail"]})

    # --- history (per set file)
    d7 = (dt.date.fromisoformat(TODAY) - dt.timedelta(days=7)).isoformat()
    d30 = (dt.date.fromisoformat(TODAY) - dt.timedelta(days=30)).isoformat()
    by_set: dict[str, list[dict]] = {}
    for c in yyt_cards:
        by_set.setdefault(c["set"], []).append(c)
    for s, cards in by_set.items():
        hp = out / "history" / f"{s}.json"
        hist = load_json(hp, {})
        changed = False
        for c in cards:
            h = hist.setdefault(c["id"], {})
            if not c.get("_stale"):
                before = json.dumps(h)
                if c.get("yyt") is not None:
                    push_point(h.setdefault("y", []), c["yyt"])
                if c.get("tc") is not None:
                    push_point(h.setdefault("t", []), c["tc"])
                changed |= json.dumps(h) != before
            ys, ts = h.get("y", []), h.get("t", [])
            c["c7"] = pct(c.get("yyt"), value_at(ys, d7)) if ys else pct(c.get("tc"), value_at(ts, d7))
            c["c30"] = pct(c.get("yyt"), value_at(ys, d30)) if ys else pct(c.get("tc"), value_at(ts, d30))
            if c["c7"] == 0:
                c["c7"] = None
            if c["c30"] == 0:
                c["c30"] = None
        if changed or not hp.exists():
            hp.write_text(json.dumps(hist, ensure_ascii=False, separators=(",", ":")), "utf-8")

    if not yyt_cards:
        raise SystemExit("No cards from Yuyu-tei or TCG Corner — refusing to publish an empty index")

    # --- index.json (compact rows)
    rates = fx_rates(http, old_index.get("rates"))
    cols = ["id", "code", "rarity", "name", "en", "set", "img", "yyt", "stock", "tc", "tch", "c7", "c30"]
    yyt_cards.sort(key=lambda c: (c["set"], c["code"], c["rarity"]))
    for c in yyt_cards:
        if c.get("img") == f"https://card.yuyu-tei.jp/ygo/100_140/{c['set']}/{c.get('yid')}.jpg":
            c["img"] = "@"  # page rebuilds the standard Yuyu-tei image URL
        elif "btn-icon" in (c.get("img") or ""):
            c["img"] = ""
    rows = [[c.get(k) if c.get(k) is not None else ("" if k in ("en", "img", "tch") else None) for k in cols]
            for c in yyt_cards]
    index = {"updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
             "date": TODAY, "rates": rates, "sets": dict(sorted(sets.items())),
             "cols": cols, "cards": rows}
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), "utf-8")

    # --- movers.json
    def slim(c):
        return [c.get(k) if c.get(k) is not None else ("" if k in ("en", "img", "tch") else None) for k in cols]
    priced = [c for c in yyt_cards if (c.get("yyt") or c.get("tc"))]
    jpy = lambda c: c["yyt"] if c.get("yyt") else (c["tc"] * rates["USD_JPY"])
    movers = {
        "cols": cols, "date": TODAY,
        "gainers": [slim(c) for c in sorted([c for c in priced if (c.get("c7") or 0) > 0 and jpy(c) >= 300],
                                            key=lambda c: -c["c7"])[:24]],
        "losers": [slim(c) for c in sorted([c for c in priced if (c.get("c7") or 0) < 0 and jpy(c) >= 300],
                                           key=lambda c: c["c7"])[:24]],
        "top": [slim(c) for c in sorted([c for c in priced if c.get("yyt")], key=lambda c: -c["yyt"])[:24]],
    }
    (out / "movers.json").write_text(json.dumps(movers, ensure_ascii=False, separators=(",", ":")), "utf-8")
    meta = {"updated": index["updated"], "sets": len(sets), "cards": len(rows),
            "yyt_cards": sum(1 for c in yyt_cards if c["set"] != "_tc"),
            "tc_matched": sum(1 for c in yyt_cards if c.get("tc") is not None and c["set"] != "_tc"),
            "tc_only": len(tc_only), "failed_sets": failed}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), "utf-8")
    log(json.dumps(meta, ensure_ascii=False))
    gh_note("notice", "Result: " + json.dumps(meta, ensure_ascii=False)[:500])
    if yyt_down:
        gh_note("warning", "Yuyu-tei unreachable this run; published TCG Corner prices + carried-over Yuyu-tei data")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as e:
        if e.code not in (None, 0):
            gh_note("error", str(e.code))
        raise
    except Exception as e:
        import traceback
        gh_note("error", f"{type(e).__name__}: {e} | " + traceback.format_exc().replace(chr(10), " / ")[-900:])
        raise
