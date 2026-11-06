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
    goal: 'Goal', goal_test: 'Test score of at least {t}%', win: 'Goal reached. Nice work.', win_before: 'You reached this goal before.',
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
    goal: 'الهدف', goal_test: 'درجة اختبار لا تقل عن {t}%', win: 'تحقّق الهدف. أحسنت.', win_before: 'سبق أن حققت هذا الهدف.',
    copyright: '© 2026 محمد إسماعيل القطامين. جميع الحقوق محفوظة.',
  },
};

/** Text shared by every lesson page. Per-lesson copy lives in `src/content/lessons/`. */
export const lesson = {
  en: {
    crumb_part: 'Classification', kicker: 'Part 3 · Classification · lesson {n} of 7',
    fp_cap: 'Its line:',
    s1: 'Learn', s2: 'Play', s3: 'Check', s4: 'Code',
    idea_h: 'The idea', steps_h: 'How it decides', play_h: 'Try it', quiz_h: 'Quick check', code_h: 'The code',
    predict_h: 'Predict the line',
    predict_p: 'Here is the data. Which picture shows the line this model draws? Pick one to find out.',
    predict_right: 'Right.', predict_wrong: 'Not this one.',
    beat_h: 'Beat the score',
    beat_p: 'The data and the split are fixed. Move the slider until the test score reaches the goal.',
    code_p: 'This is the part of the notebook that trains the model. Open the full notebook to run it, change it, or download it. Nothing to install.',
    colab: 'Open in Colab', compare_cta: 'See {m} next to another algorithm',
    next: 'Next: {m}', prev: 'Previous: {m}', route: 'Back to the route',
    progress: 'Classification · {n} of 7 done',
  },
  ar: {
    crumb_part: 'التصنيف', kicker: 'الجزء 3 · التصنيف · الدرس {n} من 7',
    fp_cap: 'خطّه:',
    s1: 'تعلّم', s2: 'جرّب', s3: 'اختبر', s4: 'الكود',
    idea_h: 'الفكرة', steps_h: 'كيف يقرّر', play_h: 'جرّبها بنفسك', quiz_h: 'اختبار سريع', code_h: 'الكود',
    predict_h: 'توقّع الخط',
    predict_p: 'هذه هي البيانات. أي صورة تُظهر الخط الذي يرسمه هذا النموذج؟ اختر واحدة لتعرف.',
    predict_right: 'صحيح.', predict_wrong: 'ليست هذه.',
    beat_h: 'تجاوز الدرجة',
    beat_p: 'البيانات والتقسيم ثابتان. حرّك المنزلق حتى تصل درجة الاختبار إلى الهدف.',
    code_p: 'هذا هو الجزء من الدفتر الذي يدرّب النموذج. افتح الدفتر كاملًا لتشغيله أو تعديله أو تنزيله. لا حاجة لتثبيت أي شيء.',
    colab: 'افتح في Colab', compare_cta: 'شاهد {m} بجانب خوارزمية أخرى',
    next: 'التالي: {m}', prev: 'السابق: {m}', route: 'العودة إلى المسار',
    progress: 'التصنيف · أنهيت {n} من 7',
  },
};

/** Extra text for the Part 0 and Part 1 lesson template (it reuses `lesson` for the tabs and buttons). */
export const prep = {
  en: {
    part0: 'Start here', part1: 'Prepare the data',
    kicker0: 'Part 0 · Start here', kicker1: 'Part 1 · Prepare the data · lesson {n} of 4',
    progress0: 'Start here', progress1: 'Prepare the data · {n} of 4',
    n_start: 'Start here', n_missing: 'Missing values', n_categories: 'Text categories', n_split: 'Train/test split', n_scaling: 'Feature scaling',
    code_p: 'This is the core of the notebook. Open the full notebook to run it, change it, or download it. Nothing to install.',
  },
  ar: {
    part0: 'ابدأ من هنا', part1: 'جهّز البيانات',
    kicker0: 'الجزء 0 · ابدأ من هنا', kicker1: 'الجزء 1 · جهّز البيانات · الدرس {n} من 4',
    progress0: 'ابدأ من هنا', progress1: 'جهّز البيانات · أنهيت {n} من 4',
    n_start: 'ابدأ من هنا', n_missing: 'القيم المفقودة', n_categories: 'الفئات النصية', n_split: 'تقسيم التدريب والاختبار', n_scaling: 'توحيد المقياس',
    code_p: 'هذا هو جوهر الدفتر. افتح الدفتر كاملًا لتشغيله أو تعديله أو تنزيله. لا حاجة لتثبيت أي شيء.',
  },
};
