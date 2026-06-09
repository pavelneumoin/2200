/* Store — local progress, history, mistakes, stats. Device-only (localStorage). */
(function () {
  const KEY = 't2200_v1';
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
  S.history = S.history || [];
  S.mistakes = S.mistakes || {};
  S.days = S.days || [];
  S.profile = S.profile || null;
  S.settings = S.settings || {};

  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function today() { return new Date().toISOString().slice(0, 10); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function addAttempt(rec) {
    rec.id = uid(); rec.ts = Date.now();
    S.history.push(rec);
    if (S.history.length > 800) S.history = S.history.slice(-800);
    const t = today(); if (!S.days.includes(t)) S.days.push(t);
    save(); return rec;
  }
  function recordMistakes(slug, grade, items) {
    if (!items.length) return;
    const k = slug + '-' + grade;
    const arr = (S.mistakes[k] || []).concat(items.map(q => ({ q: q, ts: Date.now() })));
    const seen = new Set(), out = [];
    for (let i = arr.length - 1; i >= 0; i--) { const key = arr[i].q.t; if (seen.has(key)) continue; seen.add(key); out.push(arr[i]); }
    S.mistakes[k] = out.slice(0, 80).reverse();
    save();
  }
  function clearMistakesByText(slug, grade, texts) {
    const k = slug + '-' + grade; if (!S.mistakes[k]) return;
    const set = new Set(texts);
    S.mistakes[k] = S.mistakes[k].filter(m => !set.has(m.q.t));
    if (!S.mistakes[k].length) delete S.mistakes[k];
    save();
  }
  function getMistakes(slug, grade) { return (S.mistakes[slug + '-' + grade] || []).map(m => m.q); }
  function mistakeTotal() { let n = 0; for (const k in S.mistakes) n += S.mistakes[k].length; return n; }
  function mistakeKeys() { return Object.keys(S.mistakes); }

  function streak() {
    if (!S.days.length) return 0;
    const set = new Set(S.days); const d = new Date();
    if (!set.has(today())) { d.setDate(d.getDate() - 1); if (!set.has(d.toISOString().slice(0, 10))) return 0; }
    let s = 0; while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); } return s;
  }

  function stats() {
    const bySubject = {}, byType = { single: [0, 0], text: [0, 0], match: [0, 0] };
    let correct = 0, total = 0;
    S.history.forEach(h => {
      correct += h.correct; total += h.total;
      const b = bySubject[h.slug] || (bySubject[h.slug] = { label: h.subject, slug: h.slug, attempts: 0, correct: 0, total: 0 });
      b.attempts++; b.correct += h.correct; b.total += h.total;
      if (h.types) for (const ty in h.types) { byType[ty][0] += h.types[ty][0]; byType[ty][1] += h.types[ty][1]; }
    });
    for (const k in bySubject) { const b = bySubject[k]; b.pct = b.total ? Math.round(b.correct / b.total * 100) : 0; }
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10); days.push({ key, attempts: 0, correct: 0, total: 0 }); }
    const dmap = {}; days.forEach(d => dmap[d.key] = d);
    S.history.forEach(h => { const key = new Date(h.ts).toISOString().slice(0, 10); if (dmap[key]) { dmap[key].attempts++; dmap[key].correct += h.correct; dmap[key].total += h.total; } });
    days.forEach(d => d.pct = d.total ? Math.round(d.correct / d.total * 100) : null);
    return { attempts: S.history.length, correct, total, avgPct: total ? Math.round(correct / total * 100) : 0, bySubject, byType, days, streak: streak() };
  }
  function weakSubjects(n) {
    const st = stats(); const arr = Object.values(st.bySubject).filter(s => s.attempts >= 1);
    arr.sort((a, b) => a.pct - b.pct); return arr.slice(0, n || 3);
  }
  function recent(n) { return S.history.slice(-(n || 8)).reverse(); }

  function saveActive(s) { try { localStorage.setItem('t2200_active', JSON.stringify(s)); } catch (e) {} }
  function getActive() { try { return JSON.parse(localStorage.getItem('t2200_active')); } catch (e) { return null; } }
  function clearActive() { try { localStorage.removeItem('t2200_active'); } catch (e) {} }

  const __api = {
    get profile() { return S.profile; }, setProfile(p) { S.profile = p; save(); },
    addAttempt, recordMistakes, clearMistakesByText, getMistakes, mistakeTotal, mistakeKeys,
    stats, weakSubjects, recent, streak, history() { return S.history; },
    setting(k) { return S.settings[k]; }, setSetting(k, v) { S.settings[k] = v; save(); },
    saveActive, getActive, clearActive,
    reset() { S.history = []; S.mistakes = {}; S.days = []; save(); clearActive(); }
  };
  if (typeof window !== 'undefined') window.Store = __api;
  if (typeof module !== 'undefined' && module.exports) module.exports = __api;
})();
