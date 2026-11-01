import sys, json, re, types, shutil
from pathlib import Path
sys.path.insert(0, "scraper"); import scrape
fx = Path("tests/yyt_set_fixture.html").read_text()
top = '<a href="/sell/ygo/s/imph">IMMORTAL PHOENIX</a><select><option value="imph">IMPH</option><option value="dbgv">グロリアス・ヴィクターズ</option></select>'
day = {"price": 1980}
class R:
    def __init__(s, t=None, j=None): s.text, s._j, s.status_code = t, j, 200
    def json(s): return s._j
def get(self, url, **kw):
    if url.endswith("/top/ygo"): return R(top)
    if "/s/imph" in url: return R(fx.replace("1,980", f"{day['price']:,}"))
    if "/s/dbgv" in url: return None
    if "products.json" in url:
        if kw["params"]["page"] > 1: return R(j={"products": []})
        return R(j={"products": [
          {"title": "IMPH-JP002 Sun God's Executioner Makyura (Prismatic Secret Rare)", "handle": "imph-jp002-pse",
           "variants": [{"price": "15.00", "available": True}], "images": []},
          {"title": "DBGV-JP018 Raise Moon Wings Rapi (SR)", "handle": "dbgv-jp018", "variants": [{"price": "3.50", "available": True}], "images": [{"src": "https://x/y.jpg"}]},
          {"title": "LEDE-AE001 Something (UR)", "handle": "ae", "variants": [{"price": "1"}], "images": []}]})
    if "er-api" in url: return R(j={"rates": {"PHP": 58.2, "JPY": 151.3}})
scrape.Http.get = get
out = Path("tests/out"); shutil.rmtree(out, ignore_errors=True)
for d, p in [("2026-10-01", 1980), ("2026-10-20", 1980), ("2026-10-26", 2480), ("2026-11-01", 3980)]:
    scrape.TODAY = d; day["price"] = p
    sys.argv = ["x", "--out", str(out), "--delay", "0"]; scrape.main()
print(json.dumps(json.loads((out/"history/imph.json").read_text())["imph-10004"]))
idx = json.loads((out/"index.json").read_text())
for r in idx["cards"]: print(dict(zip(idx["cols"], r)))
print(json.loads((out/"movers.json").read_text())["gainers"][:1])
