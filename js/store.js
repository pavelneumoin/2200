/* Store — local progress, history, mistakes, stats. Device-only (localStorage).
   Профили: каждая запись помечена кодом активного профиля (p), анонимные — ''.
   У каждого профиля свои история/ошибки/серия дней; старые данные мигрируют в ''. */
(function () {
  const KEY = 't2200_v1';
  let S;
  try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
  S.history = S.history || [];
  S.profile = S.profile || null;
  S.profiles = S.profiles || {};
  S.settings = S.settings || {};
  if (!S.mistakes2) S.mistakes2 = { '': S.mistakes || {} };
  if (!S.days2) S.days2 = { '': S.days || [] };

  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function today() { return new Date().toISOString().slice(0, 10); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pid() { return S.profile && S.profile.code ? S.profile.code : ''; }
  function mineH() { const p = pid(); return S.history.filter(h => (h.p || '') === p); }
  function mset() { return S.mistakes2[pid()] || (S.mistakes2[pid()] = {}); }
  function mdays() { return S.days2[pid()] || (S.days2[pid()] = []); }

  function addAttempt(rec) {
    rec.id = uid(); rec.ts = Date.now(); rec.p = pid();
    S.history.push(rec);
    if (S.history.length > 1500) S.history = S.history.slice(-1500);
    const t = today(); const d = mdays(); if (!d.includes(t)) d.push(t);
    save(); return rec;
  }
  function recordMistakes(slug, grade, items) {
    if (!items.length) return;
    const ms = mset(); const k = slug + '-' + grade;
    const arr = (ms[k] || []).concat(items.map(q => ({ q: q, ts: Date.now() })));
    const seen = new Set(), out = [];
    for (let i = arr.length - 1; i >= 0; i--) { const key = arr[i].q.t; if (seen.has(key)) continue; seen.add(key); out.push(arr[i]); }
    ms[k] = out.slice(0, 80).reverse();
    save();
  }
  function clearMistakesByText(slug, grade, texts) {
    const ms = mset(); const k = slug + '-' + grade; if (!ms[k]) return;
    const set = new Set(texts);
    ms[k] = ms[k].filter(m => !set.has(m.q.t));
    if (!ms[k].length) delete ms[k];
    save();
  }
  function getMistakes(slug, grade) { return (mset()[slug + '-' + grade] || []).map(m => m.q); }
  function mistakeTotal() { const ms = mset(); let n = 0; for (const k in ms) n += ms[k].length; return n; }
  function mistakeKeys() { return Object.keys(mset()); }

  function streak() {
    const days = mdays();
    if (!days.length) return 0;
    const set = new Set(days); const d = new Date();
    if (!set.has(today())) { d.setDate(d.getDate() - 1); if (!set.has(d.toISOString().slice(0, 10))) return 0; }
    let s = 0; while (set.has(d.toISOString().slice(0, 10))) { s++; d.setDate(d.getDate() - 1); } return s;
  }

  function stats() {
    const hist = mineH();
    const bySubject = {}, byType = { single: [0, 0], text: [0, 0], match: [0, 0] };
    let correct = 0, total = 0;
    hist.forEach(h => {
      correct += h.correct; total += h.total;
      const b = bySubject[h.slug] || (bySubject[h.slug] = { label: h.subject, slug: h.slug, attempts: 0, correct: 0, total: 0 });
      b.attempts++; b.correct += h.correct; b.total += h.total;
      if (h.types) for (const ty in h.types) { byType[ty][0] += h.types[ty][0]; byType[ty][1] += h.types[ty][1]; }
    });
    for (const k in bySubject) { const b = bySubject[k]; b.pct = b.total ? Math.round(b.correct / b.total * 100) : 0; }
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10); days.push({ key, attempts: 0, correct: 0, total: 0 }); }
    const dmap = {}; days.forEach(d => dmap[d.key] = d);
    hist.forEach(h => { const key = new Date(h.ts).toISOString().slice(0, 10); if (dmap[key]) { dmap[key].attempts++; dmap[key].correct += h.correct; dmap[key].total += h.total; } });
    days.forEach(d => d.pct = d.total ? Math.round(d.correct / d.total * 100) : null);
    return { attempts: hist.length, correct, total, avgPct: total ? Math.round(correct / total * 100) : 0, bySubject, byType, days, streak: streak() };
  }
  function weakSubjects(n) {
    const st = stats(); const arr = Object.values(st.bySubject).filter(s => s.attempts >= 1);
    arr.sort((a, b) => a.pct - b.pct); return arr.slice(0, n || 3);
  }
  function recent(n) { return mineH().slice(-(n || 8)).reverse(); }
  function todaySolved() { const t = today(); let n = 0; mineH().forEach(h => { if (new Date(h.ts).toISOString().slice(0, 10) === t) n += h.total; }); return n; }

  function saveActive(s) { try { localStorage.setItem('t2200_active', JSON.stringify(s)); } catch (e) {} }
  function getActive() { try { return JSON.parse(localStorage.getItem('t2200_active')); } catch (e) { return null; } }
  function clearActive() { try { localStorage.removeItem('t2200_active'); } catch (e) {} }
  function getRoster() { try { return JSON.parse(localStorage.getItem('t2200_roster')); } catch (e) { return null; } }
  function setRoster(r) { try { localStorage.setItem('t2200_roster', JSON.stringify(r)); } catch (e) {} }
  function clearRoster() { try { localStorage.removeItem('t2200_roster'); } catch (e) {} }

  const __api = {
    get profile() { return S.profile; },
    setProfile(p) { S.profile = p || null; if (p && p.code) S.profiles[p.code] = { name: p.name, cls: p.cls, ts: Date.now() }; save(); },
    logout() { S.profile = null; save(); },
    knownProfiles() { return Object.keys(S.profiles).map(c => Object.assign({ code: c }, S.profiles[c])).sort((a, b) => b.ts - a.ts).slice(0, 8); },
    forgetProfile(code) { delete S.profiles[code]; save(); },
    addAttempt, recordMistakes, clearMistakesByText, getMistakes, mistakeTotal, mistakeKeys,
    stats, weakSubjects, recent, streak, todaySolved,
    history() { return S.history; }, myHistory() { return mineH(); },
    setting(k) { return S.settings[k]; }, setSetting(k, v) { S.settings[k] = v; save(); },
    saveActive, getActive, clearActive,
    getRoster, setRoster, clearRoster,
    reset() { const p = pid(); S.history = S.history.filter(h => (h.p || '') !== p); S.mistakes2[p] = {}; S.days2[p] = []; save(); clearActive(); }
  };
  if (typeof window !== 'undefined') window.Store = __api;
  if (typeof module !== 'undefined' && module.exports) module.exports = __api;
})();
