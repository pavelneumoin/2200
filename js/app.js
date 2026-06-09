/* App — router + screens for «Тренажёр 2200». Vanilla JS, no build step. */
(function () {
  const app = document.getElementById('app');
  const appnav = document.getElementById('appnav');
  const ICONS = window.ICONS || {};
  const K = window.katex;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function ic(name, size, cls) { const p = ICONS[name] || ''; return '<svg class="ic ' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function math(s) {
    s = String(s == null ? '' : s); const parts = s.split('$'); let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1 && K) { try { out += K.renderToString(parts[i], { throwOnError: false, displayMode: false }); } catch (e) { out += esc(parts[i]); } }
      else out += esc(parts[i]);
    }
    return out;
  }
  function fmtNum(n) { return Number(n).toLocaleString('ru-RU'); }
  function fmtTime(s) { s = Math.max(0, s | 0); const m = Math.floor(s / 60), ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }
  function plural(n, a, b, c) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }
  const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];
  const GRADE = {
    5: { c: 'var(--green-600)', soft: 'var(--green-50)', bd: 'var(--green-200)', ic: 'award', t: 'Отличный результат!', m: 'Ты прекрасно подготовился. Так держать — на ликвидации всё получится.' },
    4: { c: 'var(--blue-600)', soft: 'var(--blue-50)', bd: 'var(--blue-200)', ic: 'thumbs-up', t: 'Хороший результат!', m: 'Совсем немного до пятёрки. Загляни в разбор — и можно пробовать снова.' },
    3: { c: 'var(--amber-600)', soft: 'var(--amber-50)', bd: 'var(--amber-200)', ic: 'trending-up', t: 'Уже неплохо!', m: 'Основное ты знаешь. Давай повторим то, что не получилось, и попробуем ещё раз.' },
    2: { c: 'var(--coral-600)', soft: 'var(--coral-50)', bd: 'var(--coral-200)', ic: 'heart', t: 'Не переживай!', m: 'Это всего лишь тренировка — здесь можно ошибаться. Потренируйся ещё, у тебя обязательно получится.' },
  };
  function gColor(g) { return (GRADE[g] || GRADE[2]).c; }

  /* ---------- state ---------- */
  const App = { catalog: null, route: null, session: null, result: null, pre: null, trainSlug: '', trainGrade: '', trainMode: 'train', cabRole: 'student', _timer: null, _scroll: 0 };
  window.App = App;

  /* ---------- nav ---------- */
  function renderNav(active) {
    const items = [['', 'Главная', 'house'], ['scope', 'Объём', 'library'], ['cabinet', 'Кабинет', 'layout-dashboard']];
    appnav.innerHTML = items.map(([key, label, icon]) =>
      '<a class="navlink" href="#/' + key + '" ' + (active === (key || 'home') ? 'aria-current="page"' : '') + '>' + ic(icon, 18) + '<span class="navlink__txt">' + label + '</span></a>'
    ).join('');
  }

  /* ---------- router ---------- */
  function parseHash() { const h = location.hash.replace(/^#\/?/, ''); const parts = h.split('/'); return { name: parts[0] || 'home', parts: parts.slice(1) }; }
  function go(hash) { location.hash = hash; }
  window.__go = go;

  function render() {
    const r = parseHash(); App.route = r;
    const appbar = document.getElementById('appbar'), foot = document.getElementById('appfoot');
    let v;
    if (r.name === 'home') v = viewHome();
    else if (r.name === 'scope') v = viewScope();
    else if (r.name === 'train') v = viewTrain();
    else if (r.name === 'test') { if (!App.session) { go('#/train'); return; } enterTest(); return; }
    else if (r.name === 'results') { if (!App.result) { go('#/'); return; } v = viewResults(); }
    else if (r.name === 'review') { if (!App.result) { go('#/'); return; } v = viewReview(); }
    else if (r.name === 'cabinet') v = viewCabinet(r.parts[0] || App.cabRole);
    else v = viewHome();
    stopTimer();
    appbar.style.display = ''; foot.style.display = '';
    app.innerHTML = v.html;
    renderNav(r.name);
    if (v.mount) v.mount();
    window.scrollTo(0, 0);
  }

  /* ---------- small builders ---------- */
  function bullet(icon, t, d) { return '<div class="bullet"><span class="bullet__ic">' + ic(icon, 19) + '</span><div><div class="bullet__t">' + esc(t) + '</div><div class="bullet__d">' + esc(d) + '</div></div></div>'; }
  function stat(v, l) { return '<div class="stat"><div class="stat__v">' + v + '</div><div class="stat__l">' + esc(l) + '</div></div>'; }

  /* ---------- HOME ---------- */
  function viewHome() {
    const t = App.catalog.totals;
    const hist = window.Store.history();
    const back = hist.length ? welcomeBack() : '';
    const html = '<div class="wrap view-enter stack" style="gap:28px">' + back +
      '<div class="ds-card ds-card--soft welcome">' +
        '<h1>Дорогие ребята<br>и родители!</h1>' +
        '<p class="lead" style="max-width:640px">Это спокойное место, где можно потренироваться и проверить себя. Здесь не ставят оценок в журнал — можно ошибаться сколько угодно.</p>' +
        '<div class="bullets">' +
          bullet('library', '24 700 заданий, 31 предмет', 'По всем предметам и классам со 2 по 11 — выбирайте, что нужно повторить.') +
          bullet('shield-check', 'Тренируйтесь сколько нужно', 'Результаты хранятся только на этом устройстве и никуда не отправляются.') +
          bullet('calendar-days', 'Очная ликвидация в августе', 'Пройдёт по этим же вопросам — поэтому тренировка действительно поможет.') +
          bullet('heart-handshake', 'Мы на вашей стороне', 'Спокойно, по-доброму и без стресса. У тебя всё получится.') +
        '</div>' +
      '</div>' +
      '<div><h2 class="sec-title">Выберите режим работы</h2><div class="modes">' +
        '<div class="ds-card ds-card--sm ds-card--interactive mode-card" data-go="#/train" tabindex="0" role="button">' +
          '<div class="mode-card__head"><span class="mode-ic">' + ic('graduation-cap', 24) + '</span><span class="ds-badge ds-badge--success">' + ic('check', 13) + 'Доступно</span></div>' +
          '<div><div class="mode-card__title">Тренировка</div><div class="mode-card__desc">Тренировка и самопроверка знаний по любому предмету и классу.</div></div>' +
          '<span class="ds-btn ds-btn--primary ds-btn--md ds-btn--block">Начать тренировку ' + ic('arrow-right', 18) + '</span>' +
        '</div>' +
        '<div class="ds-card mode-card mode-card--locked">' +
          '<div class="mode-card__head"><span class="mode-ic">' + ic('clipboard-list', 24) + '</span><span class="ds-badge ds-badge--locked">' + ic('lock', 13) + 'Скоро будет доступно</span></div>' +
          '<div><div class="mode-card__title">Контрольный тест</div><div class="mode-card__desc">Итоговый контрольный вариант. Откроется ближе к августу.</div></div>' +
          '<span class="ds-btn ds-btn--secondary ds-btn--md ds-btn--block" aria-disabled="true">Скоро</span>' +
        '</div>' +
      '</div></div>' +
      '<a class="ds-btn ds-btn--secondary ds-btn--md" href="#/scope" style="align-self:flex-start">' + ic('bar-chart-3', 18) + ' Объём подготовки по предметам и классам</a>' +
      '<div class="ds-card statstrip"><div class="stats-row">' + stat('31', 'предмет') + stat('2–11', 'классы') + stat(fmtNum(t.questions), 'задания') + '</div>' +
        '<div class="statstrip__chips"><span class="ds-chip">' + ic('clock', 16) + ' 45 минут</span><span class="ds-chip">' + ic('file-text', 16) + ' 17 вопросов</span><span class="ds-chip">' + ic('graduation-cap', 16) + ' Оценка от «2» до «5»</span></div>' +
      '</div></div>';
    return { html: html, mount: wireGo };
  }
  function welcomeBack() {
    const st = window.Store.stats();
    return '<div class="ds-card ds-card--sm" data-go="#/cabinet" role="button" tabindex="0" style="display:flex;align-items:center;gap:16px;cursor:pointer">' +
      '<span class="mode-ic" style="background:var(--brand);color:#fff">' + ic('flame', 22) + '</span>' +
      '<div class="grow"><div style="font-weight:700;color:var(--text-strong)">С возвращением!</div>' +
      '<div class="muted" style="font-size:var(--text-sm)">' + (st.streak ? ('Серия ' + st.streak + ' ' + plural(st.streak, 'день', 'дня', 'дней') + ' · ') : '') + st.attempts + ' ' + plural(st.attempts, 'тренировка', 'тренировки', 'тренировок') + ' · средний балл ' + st.avgPct + '%</div></div>' +
      '<span class="ds-btn ds-btn--secondary ds-btn--sm">Кабинет ' + ic('arrow-right', 16) + '</span></div>';
  }
  function wireGo() {
    document.querySelectorAll('[data-go]').forEach(el => {
      el.addEventListener('click', () => go(el.getAttribute('data-go')));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(el.getAttribute('data-go')); } });
    });
  }

  /* ---------- SCOPE ---------- */
  function viewScope() {
    const subs = App.catalog.subjects, t = App.catalog.totals;
    const cards = subs.map(s =>
      '<div class="ds-card ds-card--sm scope-card"><div class="scope-card__head"><span class="scope-ic">' + ic(s.icon, 22) + '</span>' +
      '<div class="grow"><div class="scope-card__name">' + esc(s.label) + '</div><div class="scope-card__total">' + fmtNum(s.total) + ' ' + plural(s.total, 'задание', 'задания', 'заданий') + ' · ' + s.grades.length + ' ' + plural(s.grades.length, 'класс', 'класса', 'классов') + '</div></div></div>' +
      '<div class="gpills">' + s.grades.map(g => '<button class="gpill" data-pre data-slug="' + s.slug + '" data-grade="' + g.g + '"><b>' + g.g + '</b> кл · ' + fmtNum(g.n) + '</button>').join('') + '</div></div>'
    ).join('');
    const html = '<div class="wrap view-enter stack" style="gap:22px">' +
      '<a class="ds-btn ds-btn--ghost ds-btn--sm" href="#/" style="align-self:flex-start">' + ic('arrow-left', 17) + ' На главную</a>' +
      '<div><h1 style="font-size:var(--text-2xl)">Объём подготовки</h1><p class="muted" style="margin-top:6px">Сколько уникальных заданий доступно по каждому предмету и классу. Нажмите на класс, чтобы начать тренировку.</p></div>' +
      '<div class="stats-row" style="justify-content:flex-start;gap:30px">' + stat(String(t.subjects), 'предметов') + stat('2–11', 'классы') + stat(fmtNum(t.questions), 'заданий') + '</div>' +
      '<div class="scope-grid">' + cards + '</div></div>';
    return { html: html, mount: function () { document.querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => { App.pre = { slug: b.getAttribute('data-slug'), grade: +b.getAttribute('data-grade') }; go('#/train'); })); } };
  }

  /* ---------- TRAIN (subject + grade + mode) ---------- */
  function viewTrain() {
    if (App.pre) { App.trainSlug = App.pre.slug; App.trainGrade = String(App.pre.grade); App.pre = null; }
    const subs = App.catalog.subjects;
    const slug = App.trainSlug, grade = App.trainGrade;
    const subj = slug && App.catalog.subjects.find(s => s.slug === slug);
    const grades = subj ? subj.grades : [];
    const mistakeCount = (slug && grade) ? window.Store.getMistakes(slug, grade).length : 0;
    if (App.trainMode === 'mistakes' && !mistakeCount) App.trainMode = 'train';
    const canStart = slug && grade && (App.trainMode !== 'mistakes' || mistakeCount > 0);

    const subjOpts = '<option value="">Выберите предмет</option>' + subs.map(s => '<option value="' + s.slug + '"' + (s.slug === slug ? ' selected' : '') + '>' + esc(s.label) + '</option>').join('');
    const gradeOpts = '<option value="">' + (slug ? 'Выберите класс' : 'Сначала выберите предмет') + '</option>' + grades.map(g => '<option value="' + g.g + '"' + (String(g.g) === grade ? ' selected' : '') + '>' + g.g + ' класс</option>').join('');

    const modeTile = (key, icon, title, desc, disabled, badge) =>
      '<button class="mode-tile" data-mode="' + key + '" aria-pressed="' + (App.trainMode === key) + '"' + (disabled ? ' disabled' : '') + '>' +
      '<span class="mode-tile__ic">' + ic(icon, 20) + '</span><div><div class="mode-tile__t">' + esc(title) + (badge ? ' <span class="ds-badge ds-badge--brand" style="font-size:11px">' + badge + '</span>' : '') + '</div><div class="mode-tile__d">' + esc(desc) + '</div></div></button>';

    const scaleColors = { 2: 'var(--coral-600)', 3: 'var(--amber-600)', 4: 'var(--blue-600)', 5: 'var(--green-600)' };
    const scale = [[2, '0–44%'], [3, '45–69%'], [4, '70–84%'], [5, '85–100%']];

    const html = '<div class="wrap narrow view-enter stack" style="gap:22px">' +
      '<a class="ds-btn ds-btn--ghost ds-btn--sm" href="#/" style="align-self:flex-start">' + ic('arrow-left', 17) + ' На главную</a>' +
      '<div><h1 style="font-size:var(--text-2xl)">Тренировка</h1><p class="muted" style="margin-top:6px">Тренировка и самопроверка знаний</p></div>' +
      '<div class="ds-card ds-card--lg stack" style="gap:22px">' +
        '<div class="ds-select-field"><label class="ds-select-field__label">Предмет</label><div class="ds-select-wrap"><select class="ds-select" id="sel-subj">' + subjOpts + '</select></div></div>' +
        '<div class="ds-select-field"><label class="ds-select-field__label">Класс</label><div class="ds-select-wrap" data-disabled="' + (!slug) + '"><select class="ds-select" id="sel-grade"' + (slug ? '' : ' disabled') + '>' + gradeOpts + '</select></div></div>' +
        '<div><label class="ds-select-field__label" style="display:block;margin-bottom:10px">Режим</label><div class="mode-pick">' +
          modeTile('train', 'graduation-cap', 'Тренировка', '17 вопросов, 45 минут. Случайный вариант.', false, '') +
          modeTile('blitz', 'zap', 'Блиц', '12 быстрых вопросов с выбором ответа.', false, '') +
          modeTile('mistakes', 'rotate-ccw', 'Работа над ошибками', mistakeCount ? ('Повторите ' + mistakeCount + ' ' + plural(mistakeCount, 'задание', 'задания', 'заданий') + ', где была ошибка.') : 'Появится после первой тренировки с ошибками.', !mistakeCount, mistakeCount ? String(mistakeCount) : '') +
        '</div></div>' +
        '<button class="ds-btn ds-btn--primary ds-btn--lg ds-btn--block" id="btn-start"' + (canStart ? '' : ' disabled') + '>Начать ' + ic('arrow-right', 19) + '</button>' +
        '<div class="ds-callout ds-callout--support">' + ic('info', 20, 'ds-callout__icon') + '<div class="ds-callout__body"><div class="ds-callout__text">Самопроверка: имя вводить не нужно, результат хранится только на этом устройстве и никуда не отправляется.</div></div></div>' +
      '</div>' +
      '<div class="wrapline"><span class="ds-chip">' + ic('clock', 16) + ' 45 минут</span><span class="ds-chip">' + ic('file-text', 16) + ' 17 вопросов</span><span class="ds-chip">' + ic('shuffle', 16) + ' Случайный вариант</span></div>' +
      '<div><div style="font-size:var(--text-sm);font-weight:700;color:var(--text-strong);margin-bottom:12px">Как оценивается результат</div><div class="scale-row">' +
        scale.map(([g, l]) => '<div class="scale-pill"><span class="scale-pill__g" style="background:' + scaleColors[g] + '">' + g + '</span><span class="scale-pill__l">' + l + '</span></div>').join('') +
      '</div></div></div>';

    return {
      html: html, mount: function () {
        document.getElementById('sel-subj').addEventListener('change', e => { App.trainSlug = e.target.value; App.trainGrade = ''; render(); });
        document.getElementById('sel-grade').addEventListener('change', e => { App.trainGrade = e.target.value; render(); });
        document.querySelectorAll('.mode-tile').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; App.trainMode = b.getAttribute('data-mode'); render(); }));
        const sb = document.getElementById('btn-start');
        if (sb) sb.addEventListener('click', () => { if (canStart) startTest(slug, +grade, App.trainMode); });
      }
    };
  }

  /* ---------- TEST ---------- */
  async function startTest(slug, grade, mode) {
    app.innerHTML = '<div class="wrap"><div class="empty"><span class="empty__ic">' + ic('shuffle', 26) + '</span><div>Готовим вариант…</div></div></div>';
    try {
      App.session = await window.Engine.buildSession(slug, grade, mode);
      if (!App.session.questions.length) { app.innerHTML = '<div class="wrap"><div class="empty">Не удалось собрать вопросы. Попробуйте другой режим.</div></div>'; return; }
      App.session._confirm = false;
      if (parseHash().name === 'test') enterTest(); else go('#/test');
    } catch (e) { app.innerHTML = '<div class="wrap"><div class="empty">Ошибка загрузки заданий. <a href="#/train">Назад</a></div></div>'; }
  }
  function stopTimer() { if (App._timer) { clearInterval(App._timer); App._timer = null; } }
  function enterTest() {
    stopTimer();
    App._timer = setInterval(function () {
      const s = App.session; if (!s) return; s.remaining--;
      const el = document.getElementById('js-timer'); if (el) el.textContent = fmtTime(s.remaining);
      const box = document.getElementById('timerbox'); if (box) box.classList.toggle('ds-timer--low', s.remaining <= 300);
      if (s.remaining <= 0) submitTest();
    }, 1000);
    document.getElementById('appbar').style.display = 'none';
    document.getElementById('appfoot').style.display = 'none';
    renderTest();
  }
  function answeredCount() { return App.session.answers.filter(window.Engine.answered).length; }

  function optionBtn(html, i, state, mark) {
    const cls = 'ds-answer ds-answer--' + state + (state === 'correct' || state === 'incorrect' || state === 'disabled' ? ' ds-answer--disabled' : '');
    let m = mark;
    if (state === 'selected' || state === 'correct') m = ic('check', 16);
    else if (state === 'incorrect') m = ic('x', 16);
    return '<button class="' + cls + '" data-i="' + i + '"><span class="ds-answer__letter">' + m + '</span><span class="ds-answer__text">' + html + '</span></button>';
  }
  function buildQuestion() {
    const s = App.session, i = s.current, q = s.questions[i], a = s.answers[i];
    let body = '';
    if (q.ty === 'text') {
      body = '<div style="max-width:380px"><input class="ds-input" id="text-ans" inputmode="text" placeholder="Введите ответ" value="' + esc(a || '') + '"></div>';
    } else if (q.ty === 'match') {
      const ans = Array.isArray(a) ? a : q.L.map(() => null);
      body = '<div class="match-list">' + q.L.map((left, li) =>
        '<div class="match-row"><div class="match-left">' + math(left) + '</div>' +
        '<div class="ds-select-wrap"><select class="ds-select" data-li="' + li + '"><option value="">— выберите —</option>' +
        q.R.map((r, ri) => '<option value="' + ri + '"' + (ans[li] === ri ? ' selected' : '') + '>' + esc(r.replace(/\$/g, '')) + '</option>').join('') +
        '</select></div></div>').join('') + '</div>';
    } else {
      const sel = a;
      body = '<div class="answers">' + q.o.map((opt, oi) => optionBtn(math(opt), oi, sel === oi ? 'selected' : 'default', LETTERS[oi])).join('') + '</div>';
    }
    const badge = q.ty === 'text' ? '<span class="ds-badge ds-badge--brand">Свой ответ</span>' : q.ty === 'match' ? '<span class="ds-badge ds-badge--brand">Сопоставление</span>' : '';
    return '<div class="ds-card ds-card--lg q-card"><div class="q-head"><span class="q-num">' + (i + 1) + '</span>' + badge + '</div>' +
      '<div class="q-text">' + math(q.t) + '</div>' + body + '</div>';
  }
  function navButtons() {
    const s = App.session, last = s.current === s.questions.length - 1;
    return '<button class="ds-btn ds-btn--secondary ds-btn--md" id="nav-prev"' + (s.current === 0 ? ' disabled' : '') + '>' + ic('arrow-left', 18) + ' Назад</button>' +
      (last
        ? '<button class="ds-btn ds-btn--success ds-btn--md grow" id="nav-submit">Сдать тест ' + ic('check', 18) + '</button>'
        : '<button class="ds-btn ds-btn--primary ds-btn--md grow" id="nav-next">Далее ' + ic('arrow-right', 18) + '</button>');
  }
  function navigator() {
    const s = App.session;
    return s.questions.map((q, i) => '<button class="navbtn" data-nav="' + i + '" data-cur="' + (i === s.current) + '" data-on="' + window.Engine.answered(s.answers[i]) + '">' + (i + 1) + '</button>').join('');
  }
  function confirmCard() {
    if (!App.session._confirm) return '';
    const s = App.session, ac = answeredCount();
    return '<div class="ds-card ds-card--md" style="border:1.5px solid var(--warning-border);background:var(--warning-subtle)">' +
      '<div class="row" style="gap:9px;margin-bottom:6px">' + ic('triangle-alert', 20, '') + '<div style="font-weight:700;color:var(--warning-text)">Отвечено не на все вопросы</div></div>' +
      '<p style="font-size:var(--text-sm);color:var(--amber-700);margin-bottom:16px;line-height:1.5">Вы ответили на ' + ac + ' из ' + s.questions.length + '. Ничего страшного — можно сдать как есть или вернуться и дописать.</p>' +
      '<div class="wrapline"><button class="ds-btn ds-btn--success ds-btn--md" id="cf-yes">Всё равно сдать ' + ic('check', 18) + '</button><button class="ds-btn ds-btn--secondary ds-btn--md" id="cf-no">Вернуться к вопросам</button></div></div>';
  }
  function renderTest(keepScroll) {
    const sc = keepScroll ? window.scrollY : 0;
    const s = App.session;
    const top = '<div class="test-top"><div class="test-top__row">' +
      '<div class="row" style="gap:10px;min-width:0"><button class="ds-btn ds-btn--ghost ds-btn--sm" id="t-exit" style="padding-left:8px">' + ic('arrow-left', 17) + '<span class="hide-mobile">Выйти</span></button>' +
      '<div class="test-id"><div class="test-id__s">' + esc(s.subject) + '</div><div class="test-id__g">' + s.grade + ' класс' + (s.mode === 'blitz' ? ' · блиц' : s.mode === 'mistakes' ? ' · работа над ошибками' : '') + '</div></div></div>' +
      '<div class="ds-timer" id="timerbox"><span class="ds-timer__icon">' + ic('clock', 17) + '</span><span class="ds-timer__time" id="js-timer">' + fmtTime(s.remaining) + '</span></div></div>' +
      '<div class="ds-progress"><div class="ds-progress__head"><span class="ds-progress__label">Вопрос ' + (s.current + 1) + ' из ' + s.questions.length + '</span><span class="ds-progress__count">' + answeredCount() + ' отвечено</span></div>' +
      '<div class="ds-progress__track"><div class="ds-progress__fill" style="width:' + Math.round((s.current + 1) / s.questions.length * 100) + '%"></div></div></div></div>';
    const html = '<div class="sticky-top">' + top + '</div>' +
      '<div class="wrap"><div class="test-body"><div id="test-col" class="stack" style="gap:18px">' +
      confirmCard() + '<div id="qregion">' + buildQuestion() + '</div>' +
      '<div class="test-nav" id="navbtns">' + navButtons() + '</div></div>' +
      '<div class="ds-card ds-card--sm q-nav-rail"><div class="muted" style="font-weight:700;font-size:13px;margin-bottom:12px">Вопросы</div>' +
      '<div class="navigator" id="navgrid">' + navigator() + '</div>' +
      '<div class="muted" style="margin-top:16px;font-size:13px"><b style="color:var(--success-text)">' + answeredCount() + '</b> из ' + s.questions.length + ' отвечено</div></div>' +
      '</div></div>';
    app.innerHTML = html;
    wireTest();
    window.scrollTo(0, sc);
  }
  function wireTest() {
    const s = App.session;
    document.getElementById('t-exit').addEventListener('click', exitTest);
    const prev = document.getElementById('nav-prev'); if (prev) prev.addEventListener('click', () => { s.current = Math.max(0, s.current - 1); renderTest(); });
    const next = document.getElementById('nav-next'); if (next) next.addEventListener('click', () => { s.current = Math.min(s.questions.length - 1, s.current + 1); renderTest(); });
    const sub = document.getElementById('nav-submit'); if (sub) sub.addEventListener('click', trySubmit);
    document.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => { s.current = +b.getAttribute('data-nav'); renderTest(); }));
    const cy = document.getElementById('cf-yes'); if (cy) cy.addEventListener('click', submitTest);
    const cn = document.getElementById('cf-no'); if (cn) cn.addEventListener('click', () => { s._confirm = false; renderTest(); });
    // answers
    const q = s.questions[s.current];
    if (q.ty === 'text') {
      const inp = document.getElementById('text-ans');
      inp.addEventListener('input', () => { s.answers[s.current] = inp.value; updateAux(); });
    } else if (q.ty === 'match') {
      if (!Array.isArray(s.answers[s.current])) s.answers[s.current] = q.L.map(() => null);
      document.querySelectorAll('#qregion select[data-li]').forEach(sel => sel.addEventListener('change', () => {
        const li = +sel.getAttribute('data-li'); s.answers[s.current][li] = sel.value === '' ? null : +sel.value; updateAux();
      }));
    } else {
      document.querySelectorAll('#qregion .ds-answer').forEach(b => b.addEventListener('click', () => { s.answers[s.current] = +b.getAttribute('data-i'); renderTest(true); }));
    }
  }
  function updateAux() {
    const s = App.session;
    document.querySelectorAll('[data-nav]').forEach(b => { const i = +b.getAttribute('data-nav'); b.setAttribute('data-on', window.Engine.answered(s.answers[i])); });
    const c = answeredCount();
    document.querySelectorAll('.ds-progress__count').forEach(e => e.textContent = c + ' отвечено');
  }
  function trySubmit() { if (answeredCount() < App.session.questions.length) { App.session._confirm = true; renderTest(); window.scrollTo(0, 0); } else submitTest(); }
  function exitTest() { stopTimer(); App.session = null; go('#/'); }
  function submitTest() {
    stopTimer();
    const s = App.session; const sc = window.Engine.score(s);
    const dur = Math.round((Date.now() - s.startTs) / 1000);
    window.Store.addAttempt({ subject: s.subject, slug: s.slug, grade: s.grade, mode: s.mode, correct: sc.correct, total: sc.total, pct: sc.pct, g5: sc.grade, dur: dur, types: sc.types });
    // mistakes: record wrong, clear corrected (if mistakes mode)
    const wrong = [], rightTexts = [];
    s.questions.forEach((q, i) => { if (window.Engine.isCorrect(q, s.answers[i])) rightTexts.push(q.t); else wrong.push(q); });
    if (s.mode === 'mistakes') window.Store.clearMistakesByText(s.slug, s.grade, rightTexts);
    window.Store.recordMistakes(s.slug, s.grade, wrong);
    App.result = { score: sc, session: s };
    go('#/results');
  }

  /* ---------- RESULTS ---------- */
  function viewResults() {
    const { score: sc, session: s } = App.result; const g = GRADE[sc.grade];
    const html = '<div class="wrap narrow view-enter stack" style="gap:22px">' +
      '<div class="center"><h1 style="font-size:var(--text-2xl)">Результаты теста</h1><p class="muted" style="margin-top:6px;font-size:var(--text-sm)">' + esc(s.subject) + ' · ' + s.grade + ' класс</p></div>' +
      '<div class="ds-card ds-card--md grade-card pop" style="background:' + g.soft + ';border:1px solid ' + g.bd + '">' +
        '<span class="grade-ic" style="color:' + g.c + '">' + ic(g.ic, 24) + '</span>' +
        '<div class="grade-num" style="color:' + g.c + '">' + sc.grade + '</div>' +
        '<div class="grade-title">' + g.t + '</div>' +
        '<p style="font-size:var(--text-base);color:var(--text-body);line-height:1.55;margin-top:8px;max-width:440px;margin-inline:auto">' + g.m + '</p></div>' +
      '<div class="ds-card ds-card--sm"><div class="metrics">' +
        '<div class="metric"><div class="metric__v" style="color:var(--success)">' + sc.correct + '</div><div class="metric__l">Верно</div></div><div class="metric-div"></div>' +
        '<div class="metric"><div class="metric__v">' + sc.total + '</div><div class="metric__l">Всего</div></div><div class="metric-div"></div>' +
        '<div class="metric"><div class="metric__v" style="color:' + g.c + '">' + sc.pct + '%</div><div class="metric__l">Процент</div></div>' +
      '</div></div>' +
      '<div class="res-actions"><button class="ds-btn ds-btn--primary ds-btn--md" id="r-new">' + ic('rotate-ccw', 18) + ' Новый вариант</button>' +
      '<button class="ds-btn ds-btn--secondary ds-btn--md" id="r-change">Сменить класс</button>' +
      '<button class="ds-btn ds-btn--secondary ds-btn--md" id="r-review">' + ic('list-checks', 18) + ' Разбор ответов</button></div>' +
      '<div class="ds-callout ds-callout--info">' + ic('info', 20, 'ds-callout__icon') + '<div class="ds-callout__body"><div class="ds-callout__text">Результат сохранён только на этом устройстве. Можно перепройти с новым случайным вариантом сколько угодно раз — а ещё посмотреть прогресс в кабинете.</div></div></div>' +
      '</div>';
    return {
      html: html, mount: function () {
        document.getElementById('r-new').addEventListener('click', () => startTest(s.slug, s.grade, s.mode));
        document.getElementById('r-change').addEventListener('click', () => { App.trainSlug = s.slug; App.trainGrade = ''; go('#/train'); });
        document.getElementById('r-review').addEventListener('click', () => go('#/review'));
      }
    };
  }

  /* ---------- REVIEW ---------- */
  let reviewOnlyErrors = false;
  function viewReview() {
    const { session: s } = App.result;
    const items = s.questions.map((q, i) => ({ q, i, ok: window.Engine.isCorrect(q, s.answers[i]) })).filter(it => !reviewOnlyErrors || !it.ok);
    const errCount = s.questions.filter((q, i) => !window.Engine.isCorrect(q, s.answers[i])).length;
    const list = items.length === 0
      ? '<div class="ds-callout ds-callout--success">' + ic('party-popper', 20, 'ds-callout__icon') + '<div class="ds-callout__body"><div class="ds-callout__title">Ошибок нет!</div><div class="ds-callout__text">Все ответы верные. Отличная работа!</div></div></div>'
      : items.map(({ q, i, ok }) => reviewQuestion(q, i, ok, s.answers[i])).join('');
    const html = '<div class="wrap narrow view-enter stack" style="gap:16px">' +
      '<button class="ds-btn ds-btn--ghost ds-btn--sm" id="rv-back" style="align-self:flex-start;padding-left:10px">' + ic('arrow-left', 17) + ' К результатам</button>' +
      '<div class="row" style="justify-content:space-between;gap:12px;flex-wrap:wrap"><h1 style="font-size:var(--text-2xl)">Разбор ответов</h1>' +
      '<button class="toggle-pill" id="rv-toggle" aria-pressed="' + reviewOnlyErrors + '">' + (reviewOnlyErrors ? ic('check', 15) : '') + ' Только ошибки (' + errCount + ')</button></div>' +
      list + '</div>';
    return {
      html: html, mount: function () {
        document.getElementById('rv-back').addEventListener('click', () => go('#/results'));
        document.getElementById('rv-toggle').addEventListener('click', () => { reviewOnlyErrors = !reviewOnlyErrors; render(); });
      }
    };
  }
  function reviewQuestion(q, idx, ok, a) {
    let body = '';
    if (q.ty === 'text') {
      const given = (a && String(a).trim()) ? esc(a) : '— нет ответа —';
      body = '<div class="answers">' + optionBtn('Ваш ответ: ' + given, 0, ok ? 'correct' : 'incorrect', '') +
        (ok ? '' : optionBtn('Правильный ответ: ' + esc(q.ans[0]), 1, 'correct', '')) + '</div>';
    } else if (q.ty === 'match') {
      const ans = Array.isArray(a) ? a : [];
      body = '<div class="match-list">' + q.L.map((left, li) => {
        const okRow = ans[li] === q.p[li];
        const yours = ans[li] != null ? q.R[ans[li]].replace(/\$/g, '') : '—';
        const right = q.R[q.p[li]].replace(/\$/g, '');
        return '<div class="match-row" style="grid-template-columns:1fr"><div class="match-left" style="border-color:' + (okRow ? 'var(--success-border)' : 'var(--danger-border)') + ';background:' + (okRow ? 'var(--success-subtle)' : 'var(--danger-subtle)') + '">' +
          '<div style="font-weight:700">' + math(left) + '</div><div style="font-size:13px;margin-top:4px;color:var(--text-muted)">' + (okRow ? ic('check', 14) + ' ' + esc(yours) : ic('x', 14) + ' вы: ' + esc(yours) + ' · верно: ' + esc(right)) + '</div></div></div>';
      }).join('') + '</div>';
    } else {
      body = '<div class="answers">' + q.o.map((opt, i) => {
        const isCor = i === q.a, picked = a === i;
        const st = isCor ? 'correct' : picked ? 'incorrect' : 'disabled';
        return optionBtn(math(opt), i, st, LETTERS[i]);
      }).join('') + '</div>';
    }
    return '<div class="ds-card ds-card--sm rev-q"><div class="rev-q__head"><span class="rev-num">' + (idx + 1) + '</span>' +
      '<span class="verdict ' + (ok ? 'verdict--ok' : 'verdict--no') + '">' + ic(ok ? 'check' : 'x', 17) + (ok ? 'Верно' : 'Не верно') + '</span></div>' +
      '<div class="q-text" style="font-size:var(--text-base)">' + math(q.t) + '</div>' + body + '</div>';
  }

  /* ---------- CABINET ---------- */
  function viewCabinet(role) {
    role = (role === 'parent' || role === 'teacher') ? role : 'student'; App.cabRole = role;
    const seg = '<div class="seg">' +
      ['student,user,Ученик', 'parent,users,Родитель', 'teacher,layout-dashboard,Учитель'].map(x => { const [k, i, l] = x.split(','); return '<button data-role="' + k + '" aria-pressed="' + (role === k) + '">' + ic(i, 17) + l + '</button>'; }).join('') + '</div>';
    let body;
    if (role === 'teacher') body = teacherDash();
    else body = studentDash(role);
    const html = '<div class="wrap view-enter stack" style="gap:20px">' +
      '<div class="row" style="justify-content:space-between;gap:14px;flex-wrap:wrap"><h1 style="font-size:var(--text-2xl)">Личный кабинет</h1>' + seg + '</div>' + body + '</div>';
    return {
      html: html, mount: function () {
        document.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => go('#/cabinet/' + b.getAttribute('data-role'))));
        if (body._mount) body._mount();
        wireGo();
      }
    };
  }

  function studentDash(role) {
    const st = window.Store.stats();
    const isParent = role === 'parent';
    const who = isParent ? 'вашего ребёнка' : 'тебя';
    if (st.attempts === 0) {
      return wrapMount('<div class="ds-card ds-card--md"><div class="empty"><span class="empty__ic">' + ic('sparkles', 26) + '</span>' +
        '<div style="font-weight:700;color:var(--text-strong);font-size:var(--text-md)">Здесь появится прогресс</div>' +
        '<p class="muted" style="max-width:420px;margin:8px auto 18px">' + (isParent ? 'Как только ребёнок начнёт тренироваться на этом устройстве, тут будут видны успехи, слабые места и рекомендации.' : 'Пройди первую тренировку — и здесь появятся твоя статистика, достижения и умные рекомендации.') + '</p>' +
        '<a class="ds-btn ds-btn--primary ds-btn--md" href="#/train">' + ic('graduation-cap', 18) + ' Начать тренировку</a></div></div>' +
        (isParent ? parentNote() : ''));
    }
    const kpis = '<div class="kpis">' +
      kpi('history', st.attempts, plural(st.attempts, 'тренировка', 'тренировки', 'тренировок')) +
      kpi('target', st.avgPct + '%', 'средний балл', gColor(window.Engine.gradeFor(st.avgPct))) +
      kpi('file-text', fmtNum(st.total), 'вопросов пройдено') +
      kpi('flame', st.streak, plural(st.streak, 'день подряд', 'дня подряд', 'дней подряд'), st.streak ? 'var(--amber-600)' : null) +
      '</div>';
    const subjArr = Object.values(st.bySubject).sort((a, b) => b.attempts - a.attempts);
    const bars = subjArr.slice(0, 8).map(b => barRow(b.label, b.pct, gColor(window.Engine.gradeFor(b.pct)))).join('');
    const dash = '<div class="dash-grid">' +
      '<div class="ds-card ds-card--sm stack" style="gap:16px"><div class="row" style="justify-content:space-between"><div style="font-weight:700;color:var(--text-strong)">Успеваемость по предметам</div></div>' + (bars || '<div class="muted">Пока нет данных</div>') + '</div>' +
      '<div class="ds-card ds-card--sm stack" style="gap:10px"><div style="font-weight:700;color:var(--text-strong)">Активность за 2 недели</div>' + sparkline(st.days) +
      '<div class="muted" style="font-size:13px">' + ic('trending-up', 15) + ' Тренируйся понемногу каждый день — так знания закрепляются лучше.</div></div>' +
      '</div>';
    const reco = recommendations(isParent);
    const ach = isParent ? '' : achievements(st);
    const recent = recentList();
    return wrapMount(kpis + (isParent ? parentNote() : '') + reco + dash + (ach ? '<div class="ds-card ds-card--sm stack" style="gap:14px"><div style="font-weight:700;color:var(--text-strong)">Достижения</div>' + ach + '</div>' : '') + recent);
  }
  function wrapMount(html) { const o = new String(html); return o; }

  function kpi(icon, v, l, color) {
    return '<div class="ds-card ds-card--sm kpi"><div class="kpi__top"><span class="kpi__ic"' + (color ? ' style="background:var(--brand-subtle)"' : '') + '>' + ic(icon, 18) + '</span></div>' +
      '<div class="kpi__v"' + (color ? ' style="color:' + color + '"' : '') + '>' + v + '</div><div class="kpi__l">' + esc(l) + '</div></div>';
  }
  function barRow(label, pct, color) {
    return '<div class="bar-row"><div class="bar-row__l" title="' + esc(label) + '">' + esc(label) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<div class="bar-row__v">' + pct + '%</div></div>';
  }
  function sparkline(days) {
    const pts = days.map((d, i) => ({ x: i, y: d.pct }));
    const W = 320, H = 56, n = days.length;
    const xs = i => (i / (n - 1)) * (W - 8) + 4;
    const ys = y => H - 6 - (y / 100) * (H - 12);
    let path = '', started = false, dots = '';
    pts.forEach(p => { if (p.y == null) return; const x = xs(p.x), y = ys(p.y); path += (started ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; started = true; dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.5" fill="var(--brand)"/>'; });
    if (!started) return '<div class="muted" style="font-size:13px">Нет активности за период</div>';
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><line x1="4" y1="' + ys(0) + '" x2="' + (W - 4) + '" y2="' + ys(0) + '" stroke="var(--border-subtle)"/><path d="' + path + '" fill="none" stroke="var(--brand)" stroke-width="2.5"/>' + dots + '</svg>';
  }
  function recommendations(isParent) {
    const items = [];
    const weak = window.Store.weakSubjects(2);
    weak.forEach(w => { if (w.pct < 70) items.push({ ic: 'target', t: (isParent ? 'Стоит повторить: ' : 'Повтори: ') + w.label, d: 'Средний результат ' + w.pct + '%. ' + (isParent ? 'Хорошая тема для дополнительной тренировки.' : 'Потренируйся ещё — и процент вырастет.'), go: '#/train', slug: w.slug }); });
    const mk = window.Store.mistakeKeys();
    if (mk.length) {
      let bk = null, bn = 0; mk.forEach(k => { const parts = k.split('-'); const g = +parts.pop(); const sl = parts.join('-'); const n = window.Store.getMistakes(sl, g).length; if (n > bn) { bn = n; bk = { sl, g }; } });
      if (bk) items.push({ ic: 'rotate-ccw', t: 'Работа над ошибками', d: 'Накопилось ' + bn + ' ' + plural(bn, 'задание', 'задания', 'заданий') + ', где была ошибка. Повторите их — это самый быстрый способ подтянуть результат.', go: '#/train', slug: bk.sl, grade: bk.g, mode: 'mistakes' });
    }
    const st = window.Store.stats();
    if (st.streak === 0) items.push({ ic: 'flame', t: 'Вернись к тренировкам', d: 'Несколько минут в день — и материал закрепится. Начни прямо сейчас.', go: '#/train' });
    else if (st.streak >= 3) items.push({ ic: 'flame', t: 'Серия ' + st.streak + ' ' + plural(st.streak, 'день', 'дня', 'дней') + '!', d: 'Отличная привычка. Не прерывай — позанимайся и сегодня.', go: '#/train' });
    if (!items.length) items.push({ ic: 'sparkles', t: 'Так держать!', d: 'Результаты хорошие. Можно попробовать новый предмет или режим «Блиц».', go: '#/train' });
    const list = items.slice(0, 3).map((it, i) => '<div class="reco" data-reco="' + i + '" style="cursor:pointer"><span class="reco__ic">' + ic(it.ic, 18) + '</span><div class="grow"><div class="reco__t">' + esc(it.t) + '</div><div class="reco__d">' + esc(it.d) + '</div></div><span style="color:var(--brand);align-self:center">' + ic('arrow-right', 18) + '</span></div>').join('');
    App._recoCache = items.slice(0, 3);
    return '<div class="ds-card ds-card--md stack" style="gap:12px"><div class="row" style="gap:9px"><span style="color:var(--brand)">' + ic('brain', 20) + '</span><div style="font-weight:700;color:var(--text-strong)">Умные рекомендации</div></div>' +
      '<div class="muted" style="font-size:13px;margin-top:-4px">Подобраны по твоим результатам — что повторить в первую очередь.</div>' + list + '</div>';
  }
  function achievements(st) {
    const hist = window.Store.history();
    const has5 = hist.some(h => h.g5 === 5);
    const subjN = Object.keys(st.bySubject).length;
    const didMistakes = hist.some(h => h.mode === 'mistakes');
    const defs = [
      ['play', 'Первый шаг', 'Первая тренировка', st.attempts >= 1],
      ['flame', 'Серия', '3 дня подряд', st.streak >= 3],
      ['award', 'Пятёрка', 'Получить «5»', has5],
      ['repeat', 'Настойчивость', '10 тренировок', st.attempts >= 10],
      ['rotate-ccw', 'Над ошибками', 'Режим повторения', didMistakes],
      ['library', 'Эрудит', '3 предмета', subjN >= 3],
    ];
    return '<div class="ach-grid">' + defs.map(([icn, t, d, on]) =>
      '<div class="ach ' + (on ? 'ach--on' : 'ach--off') + '"><span class="ach__ic">' + ic(on ? icn : 'lock', 20) + '</span><div class="ach__t">' + t + '</div><div class="ach__d">' + d + '</div></div>'
    ).join('') + '</div>';
  }
  function recentList() {
    const rec = window.Store.recent(8);
    if (!rec.length) return '';
    const rows = rec.map(h => {
      const g = GRADE[h.g5];
      const when = timeAgo(h.ts);
      return '<div class="recent-row"><span class="recent-g" style="background:' + g.c + '">' + h.g5 + '</span>' +
        '<div class="grow"><div style="font-weight:600;color:var(--text-strong);font-size:var(--text-sm)">' + esc(h.subject) + ' · ' + h.grade + ' класс</div>' +
        '<div class="recent-meta">' + h.correct + '/' + h.total + ' верно · ' + h.pct + '% · ' + (h.mode === 'blitz' ? 'блиц · ' : h.mode === 'mistakes' ? 'над ошибками · ' : '') + when + '</div></div>' +
        '<button class="ds-btn ds-btn--ghost ds-btn--sm" data-again="' + h.slug + '|' + h.grade + '">' + ic('rotate-ccw', 16) + '</button></div>';
    }).join('');
    return '<div class="ds-card ds-card--sm stack" style="gap:4px"><div style="font-weight:700;color:var(--text-strong);margin-bottom:8px">Недавние тренировки</div><div class="recent">' + rows + '</div></div>';
  }
  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'только что'; const m = Math.round(s / 60); if (m < 60) return m + ' ' + plural(m, 'минуту', 'минуты', 'минут') + ' назад';
    const h = Math.round(m / 60); if (h < 24) return h + ' ' + plural(h, 'час', 'часа', 'часов') + ' назад';
    const d = Math.round(h / 24); return d + ' ' + plural(d, 'день', 'дня', 'дней') + ' назад';
  }
  function parentNote() {
    return '<div class="ds-callout ds-callout--info">' + ic('info', 20, 'ds-callout__icon') + '<div class="ds-callout__body"><div class="ds-callout__title">Профиль ребёнка</div><div class="ds-callout__text">Сейчас показаны тренировки с этого устройства. Персональные профили учеников и привязку к родителю подключим, когда школа предоставит данные учеников.</div></div></div>';
  }

  /* ---------- TEACHER (demo data) ---------- */
  function teacherDash() {
    const roster = demoRoster();
    const avg = Math.round(roster.reduce((s, r) => s + r.pct, 0) / roster.length);
    const atRisk = roster.filter(r => r.pct < 50).length;
    const active = roster.filter(r => r.days <= 3).length;
    const kpis = '<div class="kpis">' +
      kpi('users', roster.length, 'учеников') +
      kpi('target', avg + '%', 'средний балл класса', gColor(window.Engine.gradeFor(avg))) +
      kpi('shield-alert', atRisk, 'нужна помощь', atRisk ? 'var(--coral-600)' : 'var(--green-600)') +
      kpi('activity', active, 'активны за 3 дня') + '</div>';
    // subject averages (demo)
    const subjs = ['Алгебра', 'Геометрия', 'Русский язык', 'Физика', 'Информатика'];
    const bars = subjs.map((s, i) => barRow(s, [62, 54, 71, 48, 66][i], gColor(window.Engine.gradeFor([62, 54, 71, 48, 66][i])))).join('');
    const rows = roster.slice().sort((a, b) => a.pct - b.pct).map(r =>
      '<tr><td style="font-weight:600;color:var(--text-strong)">' + esc(r.name) + '</td><td><span class="dot" style="background:' + gColor(window.Engine.gradeFor(r.pct)) + '"></span> ' + r.pct + '%</td><td>' + r.attempts + '</td><td class="muted">' + esc(r.weak) + '</td><td class="muted">' + (r.days === 0 ? 'сегодня' : r.days + ' дн. назад') + '</td></tr>'
    ).join('');
    const dash = '<div class="dash-grid">' +
      '<div class="ds-card ds-card--sm" style="overflow:auto"><div style="font-weight:700;color:var(--text-strong);margin-bottom:12px">Класс 8 «А» · по возрастанию результата</div>' +
      '<table class="roster"><thead><tr><th>Ученик</th><th>Балл</th><th>Тестов</th><th>Слабая тема</th><th>Активность</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="ds-card ds-card--sm stack" style="gap:14px"><div style="font-weight:700;color:var(--text-strong)">Средний балл по предметам</div>' + bars + '</div></div>';
    const note = '<div class="ds-callout ds-callout--warning">' + ic('triangle-alert', 20, 'ds-callout__icon') + '<div class="ds-callout__body"><div class="ds-callout__title">Демонстрационные данные</div><div class="ds-callout__text">Это пример того, как будет выглядеть кабинет учителя: список класса, средние баллы, кто отстаёт и какие темы западают. Подключим реальные данные классов, когда вы их предоставите.</div></div></div>';
    return new String(kpis + note + dash);
  }
  function demoRoster() {
    if (App._roster) return App._roster;
    const names = ['Артём В.', 'Мария К.', 'Иван С.', 'Полина Р.', 'Дмитрий Л.', 'София М.', 'Егор Н.', 'Анна Б.', 'Кирилл Ж.', 'Виктория Т.', 'Максим П.', 'Алиса Г.', 'Никита Ф.', 'Дарья О.', 'Тимур Х.', 'Ева Ш.', 'Роман Д.', 'Ксения А.', 'Глеб У.', 'Милана З.', 'Лев И.', 'Варвара Е.'];
    const weak = ['Дроби', 'Уравнения', 'Площади', 'Степени', 'Проценты', 'Углы', 'Орфография', 'Силы', 'Алгоритмы'];
    App._roster = names.map(n => { const pct = Math.round(28 + Math.random() * 66); return { name: n, pct, attempts: 1 + Math.floor(Math.random() * 14), weak: weak[Math.floor(Math.random() * weak.length)], days: Math.floor(Math.random() * 9) }; });
    return App._roster;
  }

  /* ---------- mount helpers for cabinet dynamic bits ---------- */
  function cabinetMount() { }

  /* ---------- init ---------- */
  async function init() {
    try {
      const r = await fetch('data/index.json'); App.catalog = await r.json();
    } catch (e) { app.innerHTML = '<div class="wrap"><div class="empty">Не удалось загрузить каталог заданий.</div></div>'; return; }
    window.Engine.setCatalog(App.catalog);
    window.addEventListener('hashchange', render);
    render();
  }

  // patch: studentDash/teacher return String objects; render() reads .toString via innerHTML concat.
  // wire reco + recent + again after mount via global delegation:
  document.addEventListener('click', function (e) {
    const reco = e.target.closest && e.target.closest('[data-reco]');
    if (reco && App.route && App.route.name === 'cabinet') {
      const items = (App._recoCache || []);
      const it = items[+reco.getAttribute('data-reco')];
      if (it) { if (it.slug) { App.trainSlug = it.slug; App.trainGrade = it.grade ? String(it.grade) : ''; App.trainMode = it.mode || 'train'; } go('#/train'); }
    }
    const again = e.target.closest && e.target.closest('[data-again]');
    if (again) { const [sl, g] = again.getAttribute('data-again').split('|'); startTest(sl, +g, 'train'); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
