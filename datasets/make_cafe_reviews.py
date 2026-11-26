"""Generate datasets/cafe_reviews.csv: short fictional reviews of an imaginary café.

Every review is built from original templates and word lists below, so the dataset is
original to AI Visual (CC0). Sentiment words repeat across many reviews, as they do in real
reviews, so a bag-of-words model has something to learn. About 6% of labels come from
mixed reviews ("great coffee but rude staff"), which keeps the task from being trivial.

Run: python datasets/make_cafe_reviews.py
"""
import csv
import random
from pathlib import Path

rng = random.Random(2026)

THINGS = ["coffee", "espresso", "latte", "cappuccino", "tea", "hot chocolate", "croissant",
          "cinnamon roll", "muffin", "sandwich", "cake", "bagel", "soup", "salad", "cookie"]
PLACE = ["staff", "service", "barista", "music", "seating", "wifi", "terrace", "room"]

POS_ADJ = ["great", "delicious", "fresh", "amazing", "lovely", "perfect", "tasty", "excellent",
           "wonderful", "good", "warm", "smooth", "rich", "soft"]
NEG_ADJ = ["bad", "cold", "stale", "awful", "terrible", "bland", "burnt", "dry", "soggy",
           "watery", "bitter", "disappointing", "greasy", "hard"]
POS_PLACE = ["friendly", "fast", "kind", "helpful", "cosy", "quiet", "relaxing", "welcoming", "clean"]
NEG_PLACE = ["rude", "slow", "noisy", "dirty", "crowded", "unfriendly", "careless", "messy"]

POS_VERB = ["I loved", "I really enjoyed", "We loved", "I would recommend", "Everyone enjoyed"]
NEG_VERB = ["I hated", "I did not enjoy", "We regretted", "I would avoid", "Nobody enjoyed"]
POS_END = ["I will come back.", "Highly recommended.", "Worth every penny.", "Best café in town.", ""]
NEG_END = ["I will not come back.", "Never again.", "A waste of money.", "Avoid this place.", ""]


def one(pos: bool) -> str:
    adj, padj = (POS_ADJ, POS_PLACE) if pos else (NEG_ADJ, NEG_PLACE)
    verb, end = (POS_VERB, POS_END) if pos else (NEG_VERB, NEG_END)
    t, p = rng.choice(THINGS), rng.choice(PLACE)
    form = rng.randrange(5)
    if form == 0:
        s = f"The {t} was {rng.choice(adj)}."
    elif form == 1:
        s = f"The {t} was {rng.choice(adj)} and the {p} was {rng.choice(padj)}."
    elif form == 2:
        s = f"{rng.choice(verb)} the {rng.choice(adj)} {t}."
    elif form == 3:
        s = f"{rng.choice(adj).capitalize()} {t}, {rng.choice(padj)} {p}."
    else:
        s = f"The {p} was {rng.choice(padj)} and my {t} was {rng.choice(adj)}."
    e = rng.choice(end)
    return f"{s} {e}".strip()


def mixed() -> tuple[str, int]:
    """A review with both kinds of words; the label follows the second half."""
    t, p = rng.choice(THINGS), rng.choice(PLACE)
    if rng.random() < 0.5:
        return f"The {t} was {rng.choice(POS_ADJ)} but the {p} was {rng.choice(NEG_PLACE)}.", 0
    return f"The {t} was {rng.choice(NEG_ADJ)} but the {p} was {rng.choice(POS_PLACE)}.", 1


rows: list[tuple[str, int]] = []
for i in range(800):
    if rng.random() < 0.06:
        rows.append(mixed())
    else:
        pos = i % 2 == 0
        rows.append((one(pos), int(pos)))
rng.shuffle(rows)

out = Path(__file__).with_name("cafe_reviews.csv")
with out.open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(["review", "liked"])
    w.writerows(rows)
print(f"wrote {len(rows)} reviews to {out}")
