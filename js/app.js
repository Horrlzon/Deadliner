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

  /* ---- Вход ---- */
  var login = $('login');
  if (login) {
    login.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = $('email'), pw = $('password'), err = $('error');
      var okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em.value.trim());
      var okPw = pw.value.length >= 6;
      em.classList.toggle('invalid', !okMail);
      pw.classList.toggle('invalid', !okPw);
      if (!okMail) { err.textContent = 'Введите корректный email.'; em.focus(); return; }
      if (!okPw) { err.textContent = 'Пароль должен быть не короче 6 символов.'; pw.focus(); return; }
      store.set('email', em.value.trim());
      location.href = 'home.html';
    });
  }

  /* ---- Главная ---- */
  var list = $('task-list');
  if (list) {
    var TASKS = [
      { id: 1, title: 'Практическая работа № 4', sub: 'Frontend · Практика', badge: 'Сегодня', today: true },
      { id: 2, title: 'Домашнее задание № 8', sub: 'Алгоритмы', badge: 'Завтра' },
      { id: 3, title: 'Учебный проект', sub: 'Проектная работа', badge: 'Через 3 дня' }
    ];
    var BASE = { today: 2, done: 10, total: 20, doneAll: 12 }; // задания вне списка
    var done = store.get('done', []);

    var render = function () {
      list.innerHTML = '';
      TASKS.forEach(function (t, i) {
        var isDone = done.indexOf(t.id) > -1;
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'task' + (isDone ? ' done' : '');
        b.setAttribute('aria-pressed', isDone);
        b.title = isDone ? 'Вернуть в работу' : 'Отметить выполненным';
        b.innerHTML = '<span><strong></strong><small></small></span><span class="badge' + (i ? ' soft' : '') + '"></span>';
        b.querySelector('strong').textContent = t.title;
        b.querySelector('small').textContent = t.sub;
        b.querySelector('.badge').textContent = t.badge;
        b.addEventListener('click', function () {
          var k = done.indexOf(t.id);
          if (k > -1) done.splice(k, 1); else done.push(t.id);
          store.set('done', done); render();
          toast(k > -1 ? 'Задание возвращено в работу' : 'Задание выполнено');
        });
        li.appendChild(b); list.appendChild(li);
      });

      var left = TASKS.filter(function (t) { return done.indexOf(t.id) < 0; });
      var today = BASE.today + left.filter(function (t) { return t.today; }).length;
      var soon = left.length;
      var doneN = BASE.done + done.length;
      var all = BASE.doneAll + done.length;
      var pct = Math.round(all / BASE.total * 100);

      $('s-today').textContent = today; $('l-today').textContent = plural(today, 'Задание', 'Задания', 'Заданий');
      $('s-soon').textContent = soon;   $('l-soon').textContent = plural(soon, 'задание', 'задания', 'заданий');
      $('s-done').textContent = doneN;  $('l-done').textContent = plural(doneN, 'Задание', 'Задания', 'Заданий');
      $('p-count').textContent = all + ' из ' + BASE.total;
      $('p-note').textContent = 'Выполнено ' + pct + '% заданий';
      $('bar-fill').style.width = pct + '%';
      $('bar').setAttribute('aria-valuenow', pct);
    };
    render();
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
    tb.addEventListener('click', function () {
      theme = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      store.set('theme', theme); paint();
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
