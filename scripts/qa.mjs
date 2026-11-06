import fs from 'node:fs';
import path from 'node:path';
const dist = 'dist', base = '/ML_DL_Vis/';
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } })(dist);
const issues = [];
const exists = u => { let p = u.replace(base, '').split(/[?#]/)[0]; if (!p || p.endsWith('/')) p += 'index.html'; return fs.existsSync(path.join(dist, p)); };
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8'), rel = f.split(path.sep).join('/').replace('dist/', '');
  const ar = rel.startsWith('ar/');
  if (!rel.startsWith('404') ) {
    if (!new RegExp(`<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"`).test(h)) issues.push(`${rel}: wrong lang/dir`);
  }
  if (!/<title>[^<]{3,}<\/title>/.test(h)) issues.push(`${rel}: no title`);
  if (!/name="description" content="[^"]{20,}/.test(h)) issues.push(`${rel}: no description`);
  if (!h.includes('hreflang="en"')) issues.push(`${rel}: no hreflang`);
  if (!h.includes(ar ? 'محمد إسماعيل القطامين. جميع الحقوق محفوظة' : 'Mohammad Ismael Al-Qatameen. All rights reserved.')) issues.push(`${rel}: footer`);
  if (/coming soon|قريبًا|قريبا/i.test(h.replace(/<script[\s\S]*?<\/script>/g, '')) ) issues.push(`${rel}: has "soon" text`);
  for (const m of h.matchAll(/href="([^"]+)"/g)) {
    const u = m[1];
    if (u.startsWith(base)) { if (!exists(u)) issues.push(`${rel}: dead link ${u}`); }
    else if (u.includes('colab.research.google.com')) {
      const n = u.match(/blob\/main\/(.+\.ipynb)/); if (!n || !fs.existsSync(n[1])) issues.push(`${rel}: Colab target missing ${u}`);
    } else if (u.startsWith('/') ) issues.push(`${rel}: absolute link outside base ${u}`);
  }
  if (ar) {
    // Latin words in Arabic headings should sit in <bdi>
    for (const m of h.matchAll(/<h([123])[^>]*>([\s\S]*?)<\/h\1>/g)) {
      const t = m[2].replace(/<bdi[\s\S]*?<\/bdi>/g, '').replace(/<[^>]+>/g, '');
      if (/[A-Za-z]{2,}/.test(t)) issues.push(`${rel}: Latin in <h${m[1]}> without bdi: ${t.trim().slice(0, 60)}`);
    }
  }
}
// prev/next buttons must follow the course order, in both languages
const order = ['learn/0-start/', 'learn/1-data/missing/', 'learn/1-data/categories/', 'learn/1-data/split/', 'learn/1-data/scaling/',
  ...['linear', 'multiple', 'polynomial', 'svr', 'tree', 'forest'].map(i => 'learn/2-regression/' + i + '/'),
  ...['logistic', 'knn', 'svm', 'ksvm', 'nb', 'tree', 'forest'].map(i => 'learn/3-classification/' + i + '/'),
  ...['cv', 'grid', 'boost'].map(i => 'learn/10-selection/' + i + '/')];
for (const lang of ['', 'ar/']) order.forEach((pg, i) => {
  const h = fs.readFileSync(dist + '/' + lang + pg + 'index.html', 'utf8');
  const btns = [...h.matchAll(/<a[^>]*class="btn( ghost)?"[^>]*href="([^"]+)"|<a[^>]*href="([^"]+)"[^>]*class="btn( ghost)?"/g)].map(m => ({ ghost: !!(m[1] || m[4]), url: (m[2] || m[3]).replace(base, '').replace('ar/learn/', 'learn/') }));
  const prev = btns.find(b => b.ghost && b.url.startsWith('learn/')), next = btns.find(b => !b.ghost && b.url.startsWith('learn/'));
  if (i > 0 && prev?.url !== order[i - 1]) issues.push(lang + pg + ': prev is ' + prev?.url + ', expected ' + order[i - 1]);
  if (i < order.length - 1 && next?.url !== order[i + 1]) issues.push(lang + pg + ': next is ' + next?.url + ', expected ' + order[i + 1]);
});
// notebook files in lessons code must exist: check all notebook urls anywhere in src/lessons.ts
console.log(files.length + ' pages checked');
console.log(issues.length ? issues.join('\n') : 'no issues');
