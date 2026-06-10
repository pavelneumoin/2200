/* Engine — load bank slices, build sessions, score, adaptive. */
(function () {
  let catalog = null; const cache = {};
  function setCatalog(c) { catalog = c; }
  function subjBySlug(slug) { return catalog && catalog.subjects.find(s => s.slug === slug); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  async function loadGrade(slug, g) {
    const key = slug + '-' + g; if (cache[key]) return cache[key];
    const r = await fetch('data/q/' + key + '.json'); if (!r.ok) throw new Error('no data ' + key);
    const d = await r.json(); cache[key] = d; return d;
  }

  function normalize(raw, ty) {
    if (ty === 'choice') {
      const pairs = raw.o.map((o, i) => ({ o: o, c: i === raw.a }));
      const sh = shuffle(pairs);
      return { ty: 'single', t: raw.t, o: sh.map(p => p.o), a: sh.findIndex(p => p.c) };
    }
    if (ty === 'short') return { ty: 'text', t: raw.t, ans: Array.isArray(raw.a) ? raw.a.map(String) : [String(raw.a)] };
    if (ty === 'match') {
      const sh = shuffle(raw.R.map((_, i) => i));
      const newR = sh.map(i => raw.R[i]); const pos = {}; sh.forEach((old, ni) => pos[old] = ni);
      return { ty: 'match', t: raw.t, L: raw.L.slice(), R: newR, p: raw.p.map(old => pos[old]) };
    }
  }
  function flatten(gd) { const out = []; ['choice', 'short', 'match'].forEach(ty => (gd[ty] || []).forEach(q => out.push({ raw: q, ty }))); return out; }

  async function buildSession(slug, grade, mode) {
    const subj = subjBySlug(slug); let questions = [];
    if (mode === 'mistakes') {
      questions = shuffle(window.Store.getMistakes(slug, grade)).slice(0, 17);
    } else {
      const gd = await loadGrade(slug, grade);
      let pool = flatten(gd);
      if (mode === 'blitz') { const only = pool.filter(p => p.ty === 'choice'); if (only.length >= 8) pool = only; }
      const n = mode === 'blitz' ? 12 : mode === 'cards' ? 20 : 17;
      questions = shuffle(pool).slice(0, n).map(p => normalize(p.raw, p.ty));
    }
    questions.forEach((q, i) => q.id = i);
    const limitSec = mode === 'blitz' ? 8 * 60 : 45 * 60;
    return { slug, subject: subj ? subj.label : slug, grade, mode, questions, answers: questions.map(() => null), current: 0, limitSec, remaining: limitSec, startTs: Date.now() };
  }

  function checkText(u, arr) {
    if (u == null) return false;
    u = String(u).trim().toLowerCase().replace(',', '.'); if (!u) return false;
    for (const c of arr) {
      const cv = String(c).trim().toLowerCase().replace(',', '.');
      if (u === cv) return true;
      const un = parseFloat(u), cn = parseFloat(cv);
      if (!isNaN(un) && !isNaN(cn)) { if (Number.isInteger(cn)) { if (Math.round(un) === cn) return true; } else if (Math.abs(un - cn) / (Math.abs(cn) + 1e-9) < 0.06) return true; continue; }
      if (cv.length >= 4 && (u.includes(cv) || cv.includes(u))) return true;
    }
    return false;
  }
  function earned(q, ans) {
    if (q.ty === 'single') return ans === q.a ? 1 : 0;
    if (q.ty === 'text') return checkText(ans, q.ans) ? 1 : 0;
    if (q.ty === 'match') { if (!Array.isArray(ans)) return 0; let c = 0; for (let i = 0; i < q.p.length; i++) if (ans[i] === q.p[i]) c++; return c / q.p.length; }
    return 0;
  }
  function isCorrect(q, ans) { return earned(q, ans) >= 0.9999; }
  function gradeFor(pct) { return pct >= 85 ? 5 : pct >= 70 ? 4 : pct >= 45 ? 3 : 2; }
  function answered(a) { if (a == null) return false; if (Array.isArray(a)) return a.some(x => x != null); return String(a).trim() !== ''; }

  function score(session) {
    let e = 0; const types = { single: [0, 0], text: [0, 0], match: [0, 0] };
    session.questions.forEach((q, i) => { const got = earned(q, session.answers[i]); e += got; types[q.ty][1]++; if (got >= 0.9999) types[q.ty][0]++; });
    const total = session.questions.length;
    const exact = session.questions.filter((q, i) => isCorrect(q, session.answers[i])).length;
    const pct = Math.round(e / total * 100);
    return { correct: exact, total, earned: e, pct, grade: gradeFor(pct), types };
  }

  // Parse a pasted class list. Flexible delimiters (tab / ; / , / |).
  // Columns: Класс; Ученик; Учитель(опц); Балл%(опц); Тестов(опц). Header row optional.
  function parseRoster(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let start = 0;
    if (lines.length && /класс/i.test(lines[0]) && /ученик|фамил|имя/i.test(lines[0])) start = 1;
    const num = x => (x !== undefined && x !== '' && !isNaN(parseFloat(x))) ? parseFloat(x) : null;
    const classes = {};
    for (let i = start; i < lines.length; i++) {
      const p = lines[i].split(/\t|;|,|\|/).map(c => c.trim());
      const cls = p[0] || '', name = p[1] || '';
      if (!cls || !name) continue;
      const c = classes[cls] || (classes[cls] = { name: cls, teacher: '', students: [] });
      if (p[2] && !c.teacher) c.teacher = p[2];
      const pct = num(p[3]); const att = num(p[4]);
      c.students.push({ name: name, pct: pct === null ? null : Math.round(pct), attempts: att === null ? null : Math.round(att) });
    }
    return { classes: Object.keys(classes).map(k => classes[k]) };
  }

  // --- Коды входа для учеников (выдаёт учитель). Без сервера: имя+класс
  // зашиты в самом коде + контрольная сумма от опечаток. ---
  function _djb2(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; }
  function _b64encode(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, 'utf8').toString('base64');
  }
  function _b64decode(b) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b)));
    return Buffer.from(b, 'base64').toString('utf8');
  }
  function makeStudentCode(name, cls) {
    const payload = String(name).trim().replace(/\s+/g, ' ') + '|' + String(cls).trim();
    const b = _b64encode(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const chk = (_djb2(payload) % 1296).toString(36).padStart(2, '0').toUpperCase();
    return 'T22-' + b + '-' + chk;
  }
  function parseStudentCode(code) {
    try {
      code = String(code || '').trim();
      const m = code.match(/^T22-(.+)-([0-9A-Za-z]{2})$/);
      if (!m) return null;
      let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      const payload = _b64decode(b);
      const chk = (_djb2(payload) % 1296).toString(36).padStart(2, '0').toUpperCase();
      if (chk !== m[2].toUpperCase()) return null;
      const i = payload.lastIndexOf('|');
      if (i < 1) return null;
      const name = payload.slice(0, i).trim(), cls = payload.slice(i + 1).trim();
      if (!name || !cls) return null;
      return { name: name, cls: cls };
    } catch (e) { return null; }
  }

  const __api = { setCatalog, subjBySlug, buildSession, isCorrect, earned, checkText, score, gradeFor, answered, loadGrade, normalize, parseRoster, makeStudentCode, parseStudentCode };
  if (typeof window !== 'undefined') window.Engine = __api;
  if (typeof module !== 'undefined' && module.exports) module.exports = __api;
})();
