// UI strings. English is a draft for the owner's review; Arabic is a first-pass translation.
export const LANGS = ['en', 'ar'] as const;
export type Lang = (typeof LANGS)[number];

type Dict = Record<string, string>;
export const pick = <D extends Dict>(d: { en: D; ar: D }, lang: Lang) => d[lang];

/** Site URL for a path written without base or language prefix, e.g. `learn/3-classification/knn/`. */
export function href(lang: Lang, path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return base + (lang === 'ar' ? 'ar/' : '') + path.replace(/^\//, '');
}

/** Split a pathname into its language and the path after base + language prefix. */
export function parsePath(pathname: string): { lang: Lang; path: string } {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  let rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
  if (rest === 'ar' || rest.startsWith('ar/')) return { lang: 'ar', path: rest.slice(3) };
  return { lang: 'en', path: rest };
}

export const common = {
  en: {
    brand: 'ML Visual', nav_course: 'Course', nav_pick: 'Pick an algorithm', nav_compare: 'Compare',
    m_knn: 'K-Nearest Neighbors', m_logistic: 'Logistic Regression', m_svm: 'Support Vector Machine', m_ksvm: 'Kernel SVM',
    m_nb: 'Naive Bayes', m_tree: 'Decision Tree', m_forest: 'Random Forest',
    s_knn: 'blobs that hug the data', s_logistic: 'one straight line', s_svm: 'the widest straight gap', s_ksvm: 'smooth curves and islands',
    s_nb: 'soft ovals around each class', s_tree: 'a staircase of boxes', s_forest: 'many staircases, averaged',
    p_C: 'C · how strict the margin is', p_gamma: 'Gamma · how wiggly', p_depth: 'Max depth', p_trees: 'Trees',
    p_none: 'No settings to tune. What you see is what it learns.',
    soon: 'Coming soon',
    theme_toggle: 'Switch between dark and light',
    lang_switch: 'Language',
    p_k: 'Neighbours (K)',
    d_blobs: 'Two groups', d_moons: 'Moons', d_circles: 'Circles', d_xor: 'XOR', clear: 'Clear', resplit: 'New test split',
    cls_a: "Didn't buy", cls_b: 'Bought', adding: 'Adding', data: 'Data',
    train: 'Train', test: 'Test', legend_test: 'Ringed points are test data. The model never trains on them.',
    hint_add: 'Click to add a point. Shift-click adds the other class.',
    hint_tap: 'Tap to add a point. Pick the class with the buttons. Touch and hold to see what the model predicts.',
    copyright: '© 2026 Mohammad Ismael Al-Qatameen. All rights reserved.',
  },
  ar: {
    brand: 'ML Visual', nav_course: 'الدورة', nav_pick: 'اختر خوارزمية', nav_compare: 'قارن',
    m_knn: 'أقرب الجيران (K-NN)', m_logistic: 'الانحدار اللوجستي', m_svm: 'آلة المتجهات الداعمة', m_ksvm: 'SVM بالنواة',
    m_nb: 'بايز الساذج', m_tree: 'شجرة القرار', m_forest: 'الغابة العشوائية',
    s_knn: 'مناطق تلتف حول البيانات', s_logistic: 'خط مستقيم واحد', s_svm: 'أعرض فجوة مستقيمة', s_ksvm: 'منحنيات ناعمة وجزر',
    s_nb: 'أشكال بيضاوية حول كل صنف', s_tree: 'درج من المستطيلات', s_forest: 'عدة سلالم بمتوسطها',
    p_C: 'C · مدى صرامة الهامش', p_gamma: 'Gamma · مدى التعرّج', p_depth: 'أقصى عمق', p_trees: 'عدد الأشجار',
    p_none: 'لا إعدادات لضبطها. ما تراه هو ما يتعلّمه.',
    soon: 'قريبًا',
    theme_toggle: 'التبديل بين الوضع الداكن والفاتح',
    lang_switch: 'اللغة',
    p_k: 'عدد الجيران (K)',
    d_blobs: 'مجموعتان', d_moons: 'هلالان', d_circles: 'دوائر', d_xor: 'XOR', clear: 'مسح', resplit: 'تقسيم اختبار جديد',
    cls_a: 'لم يشترِ', cls_b: 'اشترى', adding: 'إضافة', data: 'البيانات',
    train: 'تدريب', test: 'اختبار', legend_test: 'النقاط المحاطة بحلقة هي بيانات اختبار. النموذج لا يتدرّب عليها أبدًا.',
    hint_add: 'انقر لإضافة نقطة. Shift مع النقر يضيف الصنف الآخر.',
    hint_tap: 'المس لإضافة نقطة. اختر الصنف من الأزرار. المس مطوّلًا لترى ما يتوقّعه النموذج.',
    copyright: '© 2026 محمد إسماعيل القطامين. جميع الحقوق محفوظة.',
  },
};

export const knnLesson = {
  en: {
    page_title: 'K-NN',
    crumb_part: 'Classification', kicker: 'Part 3 · Classification · lesson 2 of 7',
    title: 'K-Nearest Neighbors',
    lede: 'To classify a new point, look at the points closest to it and go with the majority.',
    fp_cap: 'Its line:',
    s1: 'Learn', s2: 'Play', s3: 'Check', s4: 'Code',
    idea_h: 'The idea',
    idea_p: "K-NN doesn't learn a formula. It keeps every training point, and when a new one arrives it finds the <mark>K closest points</mark> and goes with the majority. If 4 of your 5 nearest neighbours bought the product, K-NN bets you will too.",
    steps_h: 'How it decides',
    step1: 'Pick a number <b>K</b>. The course uses 5.',
    step2: 'Measure the distance from the new point to every training point.',
    step3: 'Keep the K closest and count their classes.',
    step4: 'The majority wins.',
    scaling_h: 'Scale your features first',
    scaling_p: 'Distance mixes every feature. Salary runs into the tens of thousands while age stays under 100, so without <code>StandardScaler</code> salary would <mark>decide everything</mark>.',
    play_h: 'Try it',
    play_p: 'Move your mouse over the board to see which neighbours vote. Then drag K down to 1 and watch the line.',
    play_p_touch: 'Touch and hold the board to see which neighbours vote. Then drag K down to 1 and watch the line.',
    k_small: 'Small K: the line chases every point. Train score climbs, test score usually drops.',
    k_big: 'Big K: the line smooths out and can swallow small groups.',
    quiz_h: 'Quick check',
    q1: 'You set K = 1. What happens to the line?',
    a1: 'It gets jagged and wraps around every single point', a2: 'It becomes a straight line', a3: 'Nothing changes. K only affects speed',
    right: "Right. With K = 1 every point gets its own territory, noisy ones included. That's <mark>overfitting</mark>.",
    wrong: 'Not quite. Go back to Play, drag K to 1, and watch the line.',
    code_h: 'The code',
    code_p: 'This is the part of the notebook that trains the model. Open the full notebook to run it, change it, or download it. Nothing to install.',
    colab: 'Open in Colab',
    colab_toast: 'The Colab notebook for this lesson is coming soon.',
    compare_cta: 'See K-NN next to another algorithm',
    next: 'Next: Support Vector Machine',
    progress: 'Classification · 2 of 7 done',
  },
  ar: {
    page_title: 'K-NN',
    crumb_part: 'التصنيف', kicker: 'الجزء 3 · التصنيف · الدرس 2 من 7',
    title: 'أقرب الجيران <bdi style="white-space:nowrap">(K-NN)</bdi>',
    lede: 'لتصنيف نقطة جديدة، انظر إلى أقرب النقاط إليها وخذ برأي الأغلبية.',
    fp_cap: 'خطّه:',
    s1: 'تعلّم', s2: 'جرّب', s3: 'اختبر', s4: 'الكود',
    idea_h: 'الفكرة',
    idea_p: 'لا يتعلّم K-NN معادلة. بل يحتفظ بكل نقاط التدريب، وعندما تصل نقطة جديدة يجد <mark>أقرب K نقاط</mark> ويأخذ برأي الأغلبية. إذا اشترى 4 من أقرب 5 جيران المنتج، يراهن K-NN أنك ستشتريه أيضًا.',
    steps_h: 'كيف يقرّر',
    step1: 'اختر عددًا <b>K</b>. الدورة تستخدم 5.',
    step2: 'احسب المسافة من النقطة الجديدة إلى كل نقطة تدريب.',
    step3: 'احتفظ بأقرب K نقاط وعُدّ أصنافها.',
    step4: 'الأغلبية تفوز.',
    scaling_h: 'وحّد مقياس الخصائص أولًا',
    scaling_p: 'المسافة تجمع كل الخصائص. الراتب يصل إلى عشرات الآلاف والعمر أقل من 100، فبدون <code>StandardScaler</code> سيكون الراتب <mark>صاحب القرار كله</mark>.',
    play_h: 'جرّبها بنفسك',
    play_p: 'حرّك المؤشر فوق اللوحة لترى أي الجيران يصوّتون. ثم اسحب K إلى 1 وراقب الخط.',
    play_p_touch: 'المس اللوحة مطوّلًا لترى أي الجيران يصوّتون. ثم اسحب K إلى 1 وراقب الخط.',
    k_small: 'K صغير: الخط يلاحق كل نقطة. درجة التدريب ترتفع، ودرجة الاختبار تنخفض غالبًا.',
    k_big: 'K كبير: الخط يصبح ناعمًا وقد يبتلع المجموعات الصغيرة.',
    quiz_h: 'اختبار سريع',
    q1: 'جعلت K = 1. ماذا يحدث للخط؟',
    a1: 'يصبح متعرّجًا ويلتف حول كل نقطة', a2: 'يصبح خطًا مستقيمًا', a3: 'لا شيء يتغير. K يؤثر على السرعة فقط',
    right: 'صحيح. مع K = 1 تحصل كل نقطة على منطقتها الخاصة، حتى النقاط الشاذة. هذا هو <mark>فرط التخصيص</mark>.',
    wrong: 'ليس تمامًا. ارجع إلى «جرّب»، واسحب K إلى 1، وراقب الخط.',
    code_h: 'الكود',
    code_p: 'هذا هو الجزء من الدفتر الذي يدرّب النموذج. افتح الدفتر كاملًا لتشغيله أو تعديله أو تنزيله. لا حاجة لتثبيت أي شيء.',
    colab: 'افتح في Colab',
    colab_toast: 'دفتر Colab لهذا الدرس قادم قريبًا.',
    compare_cta: 'شاهد K-NN بجانب خوارزمية أخرى',
    next: 'التالي: آلة المتجهات الداعمة',
    progress: 'التصنيف · أنهيت 2 من 7',
  },
};
