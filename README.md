# MEIOCG Price Guide

Daily Yu-Gi-Oh! OCG prices for meiocg.org.

- **Standard price:** Yuyu-tei sell price (JPY)
- **Fallback / secondary:** TCG Corner (USD). It's shown next to every card it matches, and it becomes the main price when Yuyu-tei doesn't list the card.
- **History:** every day's run saves a change-point whenever a price moves. Click a card to see its chart (1M / 3M / 6M / 1Y / All), high/low/change, and a log of every price change.
- Prices can be shown in ¥, ₱ or $. The exchange rate is refreshed daily.

## How it works

```
GitHub Action (daily 03:17 Manila)
  └─ scraper/scrape.py
       ├─ Yuyu-tei: reads the set list from /top/ygo, then each /sell/ygo/s/<set> page
       ├─ TCG Corner: Shopify /products.json; keeps only -JPxxx (Japanese) singles and
       │             matches them to Yuyu-tei by card code + rarity
       └─ writes to the `data` branch:
            index.json      every card + current prices + 7d/30d change
            movers.json     top risers / drops / most valuable (loads first)
            history/<set>.json   price history, loaded only when a card is clicked
meiocg.org/prices (DashNex page)
  └─ reads those JSON files from jsDelivr (with raw.githubusercontent.com as backup)
```

The `data` branch is force-pushed as one commit on every run. The history is stored inside the JSON files, so the repo doesn't keep growing.

## Setup (one time, about 10 minutes)

1. On GitHub, create a **public** repo named `castelnoleal/Meiocg_Price-Check`. It has to be public so the page can read the data. If you use another name, change `REPO` at the top of `web/prices.js` and the CDN URL in `tools/build_dashnex.py`, then run `python tools/build_dashnex.py`.
2. Upload everything in this folder, including the hidden `.github` folder.
3. Go to **Actions → Update card prices → Run workflow**. For a quick first test, enter `imph,dbgv` in "sets". When it goes green, run it again with the box empty to do the full crawl, which takes roughly 30–60 minutes.
4. In DashNex, create the page `/prices`:
   - Head Code ← `dashnex/prices/head.html`
   - Body Code ← `dashnex/prices/body.html`
   - Title and description ← `dashnex/prices/seo.txt`

   *Optional:* you can use `dashnex/prices-cdn/` instead. It's a 1-line head and body that load the app from the repo, so later design changes go live without pasting into DashNex again.
5. Optional: if TCG Corner has a collection with only Japanese singles, add its handle under **Settings → Secrets and variables → Actions → Variables** as `TC_COLLECTION`. The crawl will then skip the rest of the store.

## Things to know

- History starts on the first run. Charts and the "Top risers" tab fill in as days pass.
- If Yuyu-tei blocks the run, or returns fewer than half the cards it did yesterday, the run stops and **yesterday's data is kept**. Check the Action log.
- If Yuyu-tei changes its page layout, test the parser on a saved page: `python scraper/scrape.py --parse-file saved_page.html`
- The scraper waits 1.2 s between requests and identifies itself as MEIOCG.
- Deep links work: `meiocg.org/prices#card=imph-10004` opens that card's history directly.

## Local preview

Run `python tools/make_demo.py && python tools/build_dashnex.py`, then open `preview.html`. It uses made-up prices.
