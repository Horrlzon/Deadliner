(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('dl_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dl_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  function toast(text) {
    var t = $('toast'); if (!t) return;
    t.textContent = text; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }
  function plural(n, a, b, c) { // 1 задание, 2 задания, 5 заданий
    var m = n % 100, d = n % 10;
    return (m > 10 && m < 20) ? c : d === 1 ? a : (d > 1 && d < 5) ? b : c;
  }

  /* Тема */
  var theme = store.get('theme', 'dark');
  document.documentElement.setAttribute('data-theme', theme);

  /* Имя и аватар */
  var name = store.get('name', 'Даниил');
  document.querySelectorAll('[data-name]').forEach(function (e) { e.textContent = name; });
  document.querySelectorAll('[data-initial]').forEach(function (e) { e.textContent = (name[0] || 'D').toUpperCase(); });

  /* ---- Аккаунты (учебная версия: данные хранятся в браузере) ---- */
  function hash(s) {
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
        return Array.from(new Uint8Array(buf)).map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      });
    }
    return Promise.resolve('p:' + btoa(unescape(encodeURIComponent(s))));
  }
  var isMail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };
  function startSession(acc) {
    store.set('name', acc.name); store.set('email', acc.email);
    location.href = 'home.html';
  }

  /* ---- Вход ---- */
  var login = $('login');
  if (login) {
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = $('email'), pw = $('password'), err = $('error');
      var mail = em.value.trim().toLowerCase();
      em.classList.toggle('invalid', !isMail(mail));
      pw.classList.toggle('invalid', pw.value.length < 6);
      if (!isMail(mail)) { err.textContent = 'Введите корректный email.'; em.focus(); return; }
      if (pw.value.length < 6) { err.textContent = 'Пароль должен быть не короче 6 символов.'; pw.focus(); return; }
      var acc = store.get('accounts', []).filter(function (a) { return a.email === mail; })[0];
      if (!acc) { err.textContent = 'Аккаунт не найден. Нажмите «Создать аккаунт».'; em.classList.add('invalid'); return; }
      hash(mail + ':' + pw.value).then(function (h) {
        if (h !== acc.hash) { err.textContent = 'Неверный пароль.'; pw.classList.add('invalid'); pw.focus(); return; }
        startSession(acc);
      });
    });
  }

  /* ---- Регистрация ---- */
  var reg = $('register');
  if (reg) {
    reg.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = $('r-name'), em = $('r-email'), p1 = $('r-pw'), p2 = $('r-pw2'), err = $('r-error');
      var mail = em.value.trim().toLowerCase(), nm = n.value.trim();
      var accounts = store.get('accounts', []);
      var checks = [
        [n, !nm, 'Введите имя.'],
        [em, !isMail(mail), 'Введите корректный email.'],
        [em, accounts.some(function (a) { return a.email === mail; }), 'Аккаунт с таким email уже есть. Нажмите «Войти».'],
        [p1, p1.value.length < 6, 'Пароль должен быть не короче 6 символов.'],
        [p2, p1.value !== p2.value, 'Пароли не совпадают.']
      ];
      [n, em, p1, p2].forEach(function (f) { f.classList.remove('invalid'); });
      for (var i = 0; i < checks.length; i++) {
        if (checks[i][1]) { checks[i][0].classList.add('invalid'); err.textContent = checks[i][2]; checks[i][0].focus(); return; }
      }
      hash(mail + ':' + p1.value).then(function (h) {
        var acc = { name: nm, email: mail, hash: h };
        accounts.push(acc); store.set('accounts', accounts);
        startSession(acc);
      });
    });
  }

  /* ---- Главная ---- */
  var list = $('task-list');
  if (list) {
    var tasks = store.get('tasks', []); // { id, title, subject, due: 'ГГГГ-ММ-ДД', done }
    var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var midnight = function () { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
    var parse = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
    var daysLeft = function (t) { return Math.round((parse(t.due) - midnight()) / 864e5); };
    var badgeText = function (n, t) {
      if (n < 0) return 'Просрочено';
      if (n === 0) return 'Сегодня';
      if (n === 1) return 'Завтра';
      if (n <= 7) return 'Через ' + n + ' дн.';
      var d = parse(t.due); return d.getDate() + ' ' + MONTHS[d.getMonth()];
    };
    var save = function () { store.set('tasks', tasks); render(); };

    var render = function () {
      list.innerHTML = '';
      var sorted = tasks.slice().sort(function (x, y) {
        if (x.done !== y.done) return x.done ? 1 : -1;
        return x.due < y.due ? -1 : x.due > y.due ? 1 : x.id - y.id;
      });
      var limit = +list.getAttribute('data-limit') || 0; // на главной: 3 ближайших невыполненных
      var visible = limit ? sorted.filter(function (t) { return !t.done; }).slice(0, limit) : sorted;
      if (!visible.length) {
        var empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = tasks.length ? 'Ближайших дедлайнов нет' : 'Заданий пока нет';
        list.appendChild(empty);
      }
      visible.forEach(function (t) {
        var n = daysLeft(t);
        var li = document.createElement('li'); li.className = 'item';
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'task' + (t.done ? ' done' : '');
        b.setAttribute('aria-pressed', !!t.done);
        b.title = t.done ? 'Вернуть в работу' : 'Отметить выполненным';
        b.innerHTML = '<span><strong></strong><small></small></span><span class="badge' + (n > 0 ? ' soft' : '') + '"></span>';
        b.querySelector('strong').textContent = t.title;
        b.querySelector('small').textContent = t.subject;
        b.querySelector('.badge').textContent = badgeText(n, t);
        b.addEventListener('click', function () {
          t.done = !t.done; save();
          toast(t.done ? 'Задание выполнено' : 'Задание возвращено в работу');
        });
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'del'; del.textContent = '×';
        del.setAttribute('aria-label', 'Удалить задание «' + t.title + '»'); del.title = 'Удалить';
        del.addEventListener('click', function () {
          tasks = tasks.filter(function (x) { return x.id !== t.id; }); save(); toast('Задание удалено');
        });
        li.appendChild(b); if (!limit) li.appendChild(del); list.appendChild(li);
      });

      var left = tasks.filter(function (t) { return !t.done; });
      if (!$('s-total')) return; // счётчики есть только на главной
      var soon = left.filter(function (t) { return daysLeft(t) <= 7; }).length; // просроченные и со сроком в течение недели
      var doneN = tasks.length - left.length;
      var pct = tasks.length ? Math.round(doneN / tasks.length * 100) : 100; // нет заданий = 100%

      $('s-total').textContent = tasks.length;
      $('s-soon').textContent = soon;   $('l-soon').textContent = plural(soon, 'задание', 'задания', 'заданий');
      $('s-done').textContent = doneN;  $('l-done').textContent = plural(doneN, 'Задание', 'Задания', 'Заданий');
      $('p-count').textContent = doneN + ' из ' + tasks.length;
      $('p-note').textContent = 'Выполнено ' + pct + '% заданий';
      $('bar-fill').style.width = pct + '%';
      $('bar').setAttribute('aria-valuenow', pct);
    };
    render();

    // синхронизация: другая вкладка или возврат кнопкой «Назад»
    var reload = function () { tasks = store.get('tasks', []); render(); };
    window.addEventListener('storage', function (e) { if (e.key === 'dl_tasks') reload(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) reload(); });

    /* Окно «Новое задание» (страница «Задания») */
    if ($('add-btn')) {
    var dlg = $('task-dialog'), form = $('task-form');
    var open = function () {
      form.reset();
      [$('t-title'), $('t-subject'), $('t-due')].forEach(function (f) { f.classList.remove('invalid'); });
      $('t-error').textContent = '';
      var d = midnight();
      $('t-due').min = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      $('t-title').focus();
    };
    var close = function () { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
    $('add-btn').addEventListener('click', open);
    $('t-cancel').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ti = $('t-title'), su = $('t-subject'), du = $('t-due'), err = $('t-error');
      var title = ti.value.trim(), subject = su.value.trim();
      [ti, su, du].forEach(function (f) { f.classList.remove('invalid'); });
      var problem = null;
      if (!title) problem = [ti, 'Введите название задания.'];
      else if (!subject) problem = [su, 'Введите название предмета.'];
      else if (!du.value) problem = [du, 'Выберите срок выполнения.'];
      else if (du.value < du.min) problem = [du, 'Срок не может быть в прошлом.'];
      if (problem) { problem[0].classList.add('invalid'); err.textContent = problem[1]; problem[0].focus(); return; }
      tasks.push({ id: Date.now(), title: title, subject: subject, due: du.value, done: false });
      save(); close(); toast('Задание добавлено');
    });
    }
  }

  /* ---- Настройки ---- */
  if ($('edit-btn')) {
    $('p-email').textContent = store.get('email', 'student@example.com');

    var editing = false, nameEl = $('p-name'), input = $('name-input'), btn = $('edit-btn');
    btn.addEventListener('click', function () {
      if (!editing) {
        editing = true; input.value = name; input.hidden = false; nameEl.hidden = true;
        btn.textContent = 'Сохранить'; input.focus();
      } else {
        var v = input.value.trim();
        if (!v) { input.classList.add('invalid'); return; }
        name = v; store.set('name', v); editing = false;
        input.classList.remove('invalid');
        nameEl.textContent = v; nameEl.hidden = false; input.hidden = true;
        document.querySelectorAll('[data-initial]').forEach(function (e) { e.textContent = v[0].toUpperCase(); });
        btn.textContent = 'Изменить'; toast('Профиль сохранён');
      }
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });

    var remind = $('remind');
    remind.setAttribute('aria-checked', store.get('remind', true));
    remind.addEventListener('click', function () {
      var on = remind.getAttribute('aria-checked') !== 'true';
      remind.setAttribute('aria-checked', on); store.set('remind', on);
      toast(on ? 'Напоминания включены' : 'Напоминания выключены');
    });

    var tb = $('theme-btn'), td = $('theme-desc');
    var paint = function () {
      tb.textContent = theme === 'dark' ? 'Тёмная' : 'Светлая';
      td.textContent = theme === 'dark' ? 'Тёмный интерфейс' : 'Светлый интерфейс';
    };
    paint();
    var applyTheme = function (t) {
      theme = t;
      document.documentElement.setAttribute('data-theme', t);
      store.set('theme', t); paint();
    };
    tb.addEventListener('click', function () {
      var next = theme === 'dark' ? 'light' : 'dark';
      var r = tb.getBoundingClientRect();
      var x = r.left + r.width / 2, y = r.top + r.height / 2;
      var radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var circle = function (rad) { return 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'; };
      var opts = { duration: 700, easing: 'ease-in-out' };

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { applyTheme(next); return; }

      if (document.startViewTransition) {
        // новая тема «вытекает» кругом из кнопки к краям экрана
        var vt = document.startViewTransition(function () { applyTheme(next); });
        vt.ready.then(function () {
          document.documentElement.animate(
            { clipPath: [circle(0), circle(radius)] },
            { duration: opts.duration, easing: opts.easing, pseudoElement: '::view-transition-new(root)' }
          );
        }).catch(function () {});
      } else {
        // запасной вариант для старых браузеров: круг цвета новой темы
        var o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;background:' + (next === 'light' ? '#FFFFFF' : '#0D0D0F');
        document.body.appendChild(o);
        var a = o.animate({ clipPath: [circle(0), circle(radius)] }, opts);
        a.onfinish = function () { applyTheme(next); o.remove(); };
      }
    });

    var pwForm = $('pw-form');
    $('pw-toggle').addEventListener('click', function () { pwForm.classList.toggle('open'); });
    pwForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = $('pw1'), b = $('pw2');
      if (a.value.length < 6) { a.classList.add('invalid'); toast('Пароль не короче 6 символов'); return; }
      if (a.value !== b.value) { b.classList.add('invalid'); toast('Пароли не совпадают'); return; }
      a.value = b.value = ''; a.classList.remove('invalid'); b.classList.remove('invalid');
      pwForm.classList.remove('open'); toast('Пароль изменён');
    });
  }
})();
