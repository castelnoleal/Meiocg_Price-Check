"""Packs web/prices.css + web/prices.js into DashNex-safe head/body code (base64 loaders: DashNex
strips CSS variables, collapses whitespace and mangles large inline scripts) + a local preview page."""
import base64, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
css = (R/"web/prices.css").read_text("utf-8"); js = (R/"web/prices.js").read_text("utf-8")
b = lambda s: base64.b64encode(s.encode("utf-8")).decode()
DEC = "function(b){return new TextDecoder().decode(Uint8Array.from(atob(b),function(c){return c.charCodeAt(0)}))}"
head = ('<meta name="description" content="Daily Yu-Gi-Oh! OCG card prices from Yuyu-tei with TCG Corner as fallback, with price history for every card. By Meta Insider OCG.">'
        f'<script>(function(){{var d={DEC};if(document.getElementById("mpg-css"))return;var s=document.createElement("style");s.id="mpg-css";s.textContent=d("{b(css)}");document.head.appendChild(s)}})();</script>')
body = ('<div id="mpg"></div>'
        f'<script>(function(){{var d={DEC};var s=document.createElement("script");s.textContent=d("{b(js)}");document.body.appendChild(s)}})();</script>')
out = R/"dashnex/prices"; out.mkdir(parents=True, exist_ok=True)
(out/"head.html").write_text(head, "utf-8"); (out/"body.html").write_text(body, "utf-8")
cdn = "https://cdn.jsdelivr.net/gh/castelnoleal/Meiocg_Price-Check@data/"
alt = R/"dashnex/prices-cdn"; alt.mkdir(parents=True, exist_ok=True)
(alt/"head.html").write_text(f'<link rel="stylesheet" href="{cdn}prices.css">', "utf-8")
(alt/"body.html").write_text(f'<div id="mpg"></div><script src="{cdn}prices.js" defer></script>', "utf-8")
(out/"seo.txt").write_text("Page URL: meiocg.org/prices\nTitle: OCG Card Price Guide – Yuyu-tei Prices & History | Meta Insider OCG\n"
  "Description: Daily Yu-Gi-Oh! OCG card prices from Yuyu-tei with TCG Corner as fallback, in ¥, ₱ and $. Tap any card for its price history.\n", "utf-8")
demo = (R/"web/demo-data.js").read_text("utf-8")
prev = ('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>MEIOCG Price Guide — preview (demo data)</title>' + head + '<style>body{margin:0;background:#0b0d14}.demo{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:9;background:#ff6b6b;color:#fff;font:700 12px system-ui;padding:6px 12px;border-radius:999px}</style></head><body>'
        '<div class="demo">PREVIEW · made-up demo prices</div><script>' + demo + '</script>' + body + '</body></html>')
(R/"preview.html").write_text(prev, "utf-8")
print("built", len(head), len(body))
