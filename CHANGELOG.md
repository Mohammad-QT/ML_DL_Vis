# What's new in ML Visual

Every change that learners can see, newest first. Each entry links to the pull request with the full details.

## 26 November 2026

**A new Learn step: less reading, more watching.** ([#24](https://github.com/Mohammad-QT/ML_DL_Vis/pull/24) and the scenes PR)

- **Short steps next to an animation.** The Learn step now opens in a Simple view: 3–4 short steps beside an animation
  that plays them one by one. Use ← → (or swipe) to move between steps; the animation replays each step you choose. The full text is one
  click away under **Detailed**, and the site remembers your choice.
- **35 lessons have animations:** every lesson except simple and multiple linear regression, Start here and the
  sentiment classifier, whose boards already show the whole idea. The animation fills the card; the step's text sits
  under it with ← → buttons (or swipe on a phone), and each step plays as a short staged story.
- **More room for the board.** After the Learn step, the big header shrinks to the title, which helps most on phones.
- **Easier-to-spot buttons.** Next-step buttons are larger and highlighted, buttons that *do* something look different
  from buttons that *choose* something, and each demo's main action pulses once when you first see it.

**Part 8: Deep learning.** The course now covers every part, 0 to 10. ([#22](https://github.com/Mohammad-QT/ML_DL_Vis/pull/22))

- **Neural networks (MLP).** Train a network on the board and watch the boundary bend while the epochs tick. Choose
  1–3 hidden layers, 1–8 units, the learning rate and one of four activation functions: ReLU, tanh, sigmoid or
  Leaky ReLU. A small chart draws the chosen function. The network diagram colours and thickens each connection by its
  weight, and a loss chart shows the error falling. Try the spiral: one unit can only draw a straight line, and more
  layers wrap around it.
- **Convolutional networks (draw a digit).** Draw a digit from 0 to 9 with a mouse, finger or pen. A small CNN trained
  on the MNIST digits reads it in your browser. See the 28 × 28 image it sees, the probability of each digit, its
  eight first-layer feature maps, and the 3 × 3 weights of any filter.
- Two new notebooks: an MLP in scikit-learn and a CNN in Keras.

**Fixed:** the moving board at the top of the home page stopped redrawing (and filled the browser console with errors)
after you resized the window while scrolled down the page.

## 25 November 2026

- **Five new lessons:** gradient descent and Ridge and Lasso (Part 2), DBSCAN (Part 4), Q-learning (Part 6), and
  precision, recall and the ROC curve (Part 10). ([#21](https://github.com/Mohammad-QT/ML_DL_Vis/pull/21))
- **Parts 5, 6 and 7:** association rules (Apriori, Eclat), reinforcement learning (upper confidence bound,
  Thompson sampling) and natural language processing (bag of words, a sentiment classifier).
  ([#20](https://github.com/Mohammad-QT/ML_DL_Vis/pull/20))
- **Part 9: Dimensionality reduction:** PCA, LDA and Kernel PCA. ([#19](https://github.com/Mohammad-QT/ML_DL_Vis/pull/19))
- **Part 4: Clustering:** K-Means and hierarchical clustering. ([#18](https://github.com/Mohammad-QT/ML_DL_Vis/pull/18))

## 6 November 2026

- **Phones:** a phone layout for Play and Compare, a Check step that shows one card at a time, and a scrollable course
  menu. ([#15](https://github.com/Mohammad-QT/ML_DL_Vis/pull/15), [#16](https://github.com/Mohammad-QT/ML_DL_Vis/pull/16),
  [#17](https://github.com/Mohammad-QT/ML_DL_Vis/pull/17))
- **Course menu and progress:** a sidebar with every part, progress saved in your browser, "continue where you left
  off", Colab, download and run-it-locally options, and an installable app that works offline.
  ([#12](https://github.com/Mohammad-QT/ML_DL_Vis/pull/12), [#14](https://github.com/Mohammad-QT/ML_DL_Vis/pull/14))
- **Notebooks:** every notebook ends with a "See it" section that plots the result.
  ([#13](https://github.com/Mohammad-QT/ML_DL_Vis/pull/13))
- **Compare:** clearer controls, grouped by task, data and editing points. ([#11](https://github.com/Mohammad-QT/ML_DL_Vis/pull/11))
- **First release:** Part 0 (start here), Part 1 (prepare the data), Part 2 (regression), Part 3 (classification),
  Part 10 (model selection), the Compare page, CSV upload, and the full site in Arabic.
  ([#1](https://github.com/Mohammad-QT/ML_DL_Vis/pull/1)–[#8](https://github.com/Mohammad-QT/ML_DL_Vis/pull/8))
