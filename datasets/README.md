# Datasets

Public data used by the notebooks in `notebooks/`. Notebooks load these files from
`https://raw.githubusercontent.com/Mohammad-QT/ML_DL_Vis/main/datasets/<file>`, so Colab needs no upload.

## `penguins.csv`

| | |
|---|---|
| Used by | `notebooks/3-classification/*.ipynb` |
| Rows | 219 penguins (151 Adelie, 68 Chinstrap) |
| Columns | `species`, `bill_length_mm`, `body_mass_g` |
| Source | Palmer Penguins data, from [`allisonhorst/palmerpenguins`](https://github.com/allisonhorst/palmerpenguins) (`inst/extdata/penguins.csv`) |
| Original authors | Kristen Gorman, Tony Williams, William Fraser (2014), data collected at Palmer Station, Antarctica LTER; packaged by Allison Horst, Alison Hill and Kristen Gorman (2020) |
| License | CC0 1.0 (public domain dedication) |
| Changes | Kept the Adelie and Chinstrap species, kept `species`, `bill_length_mm` and `body_mass_g`, and dropped rows with a missing value. Body mass converted to whole grams. |

Why these two features: body mass is in the thousands while bill length is under 60, so the data shows
why feature scaling matters for K-NN and SVM.

## `customers.csv`

| | |
|---|---|
| Used by | `notebooks/1-data/*.ipynb` and `notebooks/0-start/hello.ipynb` |
| Rows | 80 made-up shoppers |
| Columns | `country` (France, Germany, Spain), `age`, `salary`, `purchased` (0 or 1) |
| Source | Original to this project. Generated with NumPy (`numpy.random.default_rng(2026)`): ages 21-61, salary rising with age plus noise, `purchased` drawn from a logistic function of age and salary, then 6 ages and 6 salaries blanked at random |
| License | CC0 1.0 (public domain dedication), same as the rest of the data here |
| Changes | None. Blanks are left empty on purpose, so the missing-values lesson has something to fix |

No real person is in this file. Age is the stronger signal for `purchased`, and salary is about a thousand times larger
than age in raw units, so K-NN gets clearly better after scaling.

## `mpg.csv`

| | |
|---|---|
| Used by | `notebooks/2-regression/*.ipynb` |
| Rows | 398 cars (6 have no `horsepower`; the notebooks drop those rows) |
| Columns | `mpg`, `cylinders`, `displacement`, `horsepower`, `weight`, `acceleration`, `model_year`, `origin` (usa, japan, europe) |
| Source | Auto MPG data set, UCI Machine Learning Repository, [archive.ics.uci.edu/dataset/9/auto+mpg](https://archive.ics.uci.edu/dataset/9/auto+mpg) (DOI 10.24432/C5859H). Copied from the [`mwaskom/seaborn-data`](https://github.com/mwaskom/seaborn-data) mirror (`mpg.csv`) |
| Original authors | Donated by R. Quinlan (1993). Revised from the StatLib library at Carnegie Mellon University, used in the 1983 American Statistical Association Data Exposition |
| License | CC BY 4.0, as listed for UCI repository data sets. Attribution is given in the notebooks and here. Owner: please confirm on the UCI page before the site goes public |
| Changes | Dropped the car `name` column. Nothing else: the missing horsepower values are left blank on purpose |

Why this data: weight and horsepower both relate to fuel economy, but the horsepower curve bends, so the same
file shows a straight line, a bend, a staircase and a smooth curve. `origin` is a text category for the one-hot encoding
and dummy-variable trap in the multiple linear regression notebook.

