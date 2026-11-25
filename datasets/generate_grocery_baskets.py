import csv
from pathlib import Path

import numpy as np


def make_baskets():
    random = np.random.RandomState(0)
    items = ('bread', 'milk', 'eggs', 'coffee', 'tea', 'cereal', 'pasta', 'sauce', 'cheese')
    draws = random.random_sample((500, 16))
    for row in draws:
        basket = {item for item, chance in zip(items, row[:9]) if chance < 0.08}
        if row[9] < 0.35:
            basket.add('cereal')
            if row[10] < 0.85:
                basket.add('milk')
        if row[11] < 0.30:
            basket.add('bread')
            if row[12] < 0.72:
                basket.add('eggs')
        if row[13] < 0.32:
            basket.add('pasta')
            if row[14] < 0.88:
                basket.add('sauce')
            if row[15] < 0.68:
                basket.add('cheese')
        yield sorted(basket or {items[int(row[15] * len(items))]})


if __name__ == '__main__':
    with Path(__file__).with_name('grocery_baskets.csv').open('w', encoding='utf-8', newline='') as output:
        csv.writer(output, lineterminator='\n').writerows(make_baskets())
