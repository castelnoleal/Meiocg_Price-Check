"""Builds web/demo-data.js with made-up prices (DEMO ONLY) so the page can be previewed before the first scrape."""
import json, random, datetime as dt
random.seed(7)
today = dt.date(2026, 11, 1)
sets = {"imph": "IMMORTAL PHOENIX", "dbgv": "デッキビルドパック グロリアス・ヴィクターズ", "lpst": "LIMITED PACK -STAMP EDITION-",
        "ut01": "UTILITY SELECTION", "yac1": "ORIGINAL ARTWORK COLLECTION"}
cards = [
 ("imph","IMPH-JP002","PSE","太陽神の処刑人-マキュラ","Sun God's Executioner Makyura",1980),
 ("imph","IMPH-JP008","PSE","ハーピィ・レディ-魅惑の舞い-","Harpie Lady - Enchanting Dance",3980),
 ("imph","IMPH-JP009","PSE","白鴉の森の炎魔","",4980),
 ("imph","IMPH-JP012","PSE","白鴉の森の罪宝","",2480),
 ("imph","IMPH-JP016","PSE","六花のくろひめ","",3980),
 ("imph","IMPH-JP002","SE","太陽神の処刑人-マキュラ","Sun God's Executioner Makyura",680),
 ("imph","IMPH-JP016","UR","六花のくろひめ","",880),
 ("imph","IMPH-JP012","SR","白鴉の森の罪宝","",280),
 ("dbgv","DBGV-JP018","SR","ライズ・ムーン・ウィングス・ラピ","Raise Moon Wings Rapi",380),
 ("dbgv","DBGV-JP001","QCSE","グロリアス・ヴィクター","",12800),
 ("dbgv","DBGV-JP001","UR","グロリアス・ヴィクター","",980),
 ("ut01","UT01-JP001","UR","灰流うらら","Ash Blossom & Joyous Spring",780),
 ("ut01","UT01-JP002","UR","増殖するG","Maxx \"C\"",1280),
 ("ut01","UT01-JP003","SR","墓穴の指名者","Called by the Grave",120),
 ("ut01","UT01-JP004","UR","無限泡影","Infinite Impermanence",680),
 ("ut01","UT01-JP001","QCSE","灰流うらら","Ash Blossom & Joyous Spring",14800),
 ("yac1","YAC1-JP001","UL","ブラック・マジシャン","Dark Magician",5980),
 ("yac1","YAC1-JP002","UL","青眼の白龍","Blue-Eyes White Dragon",7980),
 ("lpst","LPST-JP003","N","天使の施し","Graceful Charity",50),
 ("lpst","LPST-JP004","NP","強欲な壺","Pot of Greed",480),
]
cols = ["id","code","rarity","name","en","set","img","yyt","stock","tc","tch","c7","c30"]
rows, hist = [], {}
for i,(s,code,rar,name,en,base) in enumerate(cards):
    cid = f"{s}-{10000+i}"
    d = today - dt.timedelta(days=random.randint(120,240)); v = base*random.uniform(.6,1.2)
    ys, ts = [], []
    tc = random.random() < .6
    while d <= today:
        if not ys or random.random() < .08:
            v = max(30, v*random.uniform(.82,1.22)); p = int(round(v/10)*10) if v>100 else int(round(v))
            if not ys or ys[-1][1]!=p: ys.append([d.isoformat(), p])
        if tc and (not ts or random.random() < .05):
            u = round(ys[-1][1]/152*random.uniform(1.05,1.4), 2)
            if not ts or ts[-1][1]!=u: ts.append([d.isoformat(), u])
        d += dt.timedelta(days=1)
    def at(se, day):
        r=None
        for a,b in se:
            if a<=day: r=b
        return r
    now = ys[-1][1]
    p7 = at(ys,(today-dt.timedelta(days=7)).isoformat()); p30 = at(ys,(today-dt.timedelta(days=30)).isoformat())
    c7 = round((now-p7)/p7*100,1) if p7 and p7!=now else None
    c30 = round((now-p30)/p30*100,1) if p30 and p30!=now else None
    hist.setdefault(s,{})[cid] = {"y": ys, **({"t": ts} if ts else {})}
    rows.append([cid,code,rar,name,en,s,"",now,random.choice([0,1,2,5,-1]),ts[-1][1] if ts else None,"" ,c7,c30])
# one TCG-Corner-only card
ts=[["2026-07-01",4.5],["2026-08-15",5.25],["2026-10-10",6.0]]
rows.append(["tc-demo","SUDA-JP045","SR","Snake-Eyes Doomed Dragon","Snake-Eyes Doomed Dragon","_tc","",None,-1,6.0,"",None,14.3])
hist["_tc"]={"tc-demo":{"t":ts}}
# force a few movers
for r in rows[:6]:
    if r[11] is None: r[11]=round(random.uniform(-25,40),1)
rates={"USD_PHP":58.21,"JPY_PHP":0.3847,"USD_JPY":151.3,"date":today.isoformat()}
index={"updated":"2026-10-31T19:20:00+00:00","date":today.isoformat(),"rates":rates,"sets":sets,"cols":cols,"cards":rows}
jpy=lambda r: r[7] if r[7] else r[9]*151.3
mv={"cols":cols,"date":today.isoformat(),
    "gainers":sorted([r for r in rows if (r[11] or 0)>0],key=lambda r:-r[11]),
    "losers":sorted([r for r in rows if (r[11] or 0)<0],key=lambda r:r[11]),
    "top":sorted(rows,key=lambda r:-jpy(r))[:24],
    "recent":[[k,v] for k,v in sets.items()],
    "latest":{"code":"imph","name":sets["imph"],"count":8,"cards":sorted([r for r in rows if r[5]=="imph"],key=lambda r:-(r[7] or 0))}}
open("web/demo-data.js","w").write("window.MEIOCG_PRICES_DEMO="+json.dumps({"index":index,"movers":mv,"history":hist},ensure_ascii=False)+";")
print(len(rows),"demo cards")
