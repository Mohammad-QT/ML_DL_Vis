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
