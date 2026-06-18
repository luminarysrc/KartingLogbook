/* ============================================================
   Karting Logbook — Application Logic
   Vanilla JS · Telegram CloudStorage · No frameworks
   ============================================================ */

'use strict';

// ——— Глобальные ссылки ———
const tg   = window.Telegram && window.Telegram.WebApp;
const CS   = tg && tg.CloudStorage;

// Ключ, под которым хранится массив заездов в CloudStorage
const STORAGE_KEY = 'kl_races';

// ——————————————————————————————————————————————
// 1. Инициализация Telegram WebApp
// ——————————————————————————————————————————————

/**
 * Запускает приложение: расширяет окно WebApp, проверяет
 * доступность CloudStorage и убирает splash-экран.
 */
function initApp() {
  if (!tg) {
    // Если открыто вне Telegram — всё равно покажем UI (для отладки)
    console.warn('Telegram WebApp API недоступен. Работаем в режиме отладки.');
    showApp();
    return;
  }

  // Сообщаем Telegram, что приложение готово
  tg.ready();
  tg.expand();

  // Устанавливаем цвет хедера и фона
  if (tg.setHeaderColor)     tg.setHeaderColor('secondary_bg_color');
  if (tg.setBackgroundColor) tg.setBackgroundColor('bg_color');

  if (!CS) {
    console.warn('CloudStorage недоступен. Данные не будут сохраняться.');
  }

  showApp();
}

/**
 * Убирает splash-экран и показывает основное приложение.
 */
function showApp() {
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');

  splash.classList.add('fade-out');
  app.classList.remove('hidden');

  // Полностью убираем splash после завершения анимации
  setTimeout(() => splash.classList.add('hidden'), 450);

  // Загружаем историю, если открыта вкладка
  loadRaces();
}

// ——————————————————————————————————————————————
// 2. Навигация по вкладкам
// ——————————————————————————————————————————————

/**
 * Переключает видимую вкладку.
 * @param {string} tabId — id секции (tab-race | tab-history | tab-setups)
 */
function switchTab(tabId) {
  // Скрываем все вкладки
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

  // Снимаем active со всех кнопок
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Активируем нужную
  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  // Подсвечиваем кнопку
  const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');

  // При переходе на «Историю» или «Сетапы» — обновляем данные
  if (tabId === 'tab-history' || tabId === 'tab-setups') {
    loadRaces();
  }
}

// ——————————————————————————————————————————————
// 3. Stepper / Slider синхронизация
// ——————————————————————————————————————————————

/**
 * Обновляет отображаемое значение рядом с ползунком.
 * @param {HTMLInputElement} slider
 */
function syncSliderValue(slider) {
  const valEl = document.getElementById('val-' + slider.id.split('-')[1]);
  if (!valEl) return;
  const step = parseFloat(slider.step);
  valEl.textContent = step < 1 ? parseFloat(slider.value).toFixed(2) : slider.value;
}

/**
 * Обработчик кнопок +/− у ползунка.
 * @param {HTMLButtonElement} btn
 */
function handleStepperClick(btn) {
  const slider = document.getElementById(btn.dataset.target);
  if (!slider) return;

  const dir  = parseInt(btn.dataset.dir, 10);
  const step = parseFloat(slider.step);
  let val    = parseFloat(slider.value) + dir * step;

  // Ограничиваем границами
  val = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), val));
  slider.value = val;

  syncSliderValue(slider);
}

// ——————————————————————————————————————————————
// 4. CloudStorage: чтение / запись
// ——————————————————————————————————————————————

/**
 * Возвращает Promise с массивом сохранённых заездов.
 * @returns {Promise<Array>}
 */
function getRaces() {
  return new Promise((resolve) => {
    if (!CS) {
      // Fallback на localStorage для отладки вне Telegram
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        resolve(data ? JSON.parse(data) : []);
      } catch { resolve([]); }
      return;
    }

    CS.getItem(STORAGE_KEY, (err, value) => {
      if (err || !value) {
        resolve([]);
        return;
      }
      try {
        resolve(JSON.parse(value));
      } catch {
        resolve([]);
      }
    });
  });
}

/**
 * Сохраняет массив заездов в CloudStorage.
 * @param {Array} races
 * @returns {Promise<void>}
 */
function saveRaces(races) {
  const json = JSON.stringify(races);

  return new Promise((resolve, reject) => {
    if (!CS) {
      localStorage.setItem(STORAGE_KEY, json);
      resolve();
      return;
    }

    CS.setItem(STORAGE_KEY, json, (err) => {
      if (err) {
        console.error('Ошибка сохранения:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// ——————————————————————————————————————————————
// 5. Форма: сбор данных и сохранение заезда
// ——————————————————————————————————————————————

/**
 * Обработчик сабмита формы «Новый заезд».
 * @param {Event} e
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const sessionName = document.getElementById('input-session-name').value.trim();
  const laptime = document.getElementById('input-laptime').value.trim();

  if (!sessionName || !laptime) {
    showToast('Заполните название и время');
    return;
  }

  const race = {
    id:            Date.now(),
    date:          new Date().toISOString(),
    sessionName:   sessionName,
    laptime:       laptime,
    notes:         document.getElementById('input-notes').value.trim(),
    
    // Давление
    flCold:        document.getElementById('input-fl-cold').value,
    flHot:         document.getElementById('input-fl-hot').value,
    frCold:        document.getElementById('input-fr-cold').value,
    frHot:         document.getElementById('input-fr-hot').value,
    rlCold:        document.getElementById('input-rl-cold').value,
    rlHot:         document.getElementById('input-rl-hot').value,
    rrCold:        document.getElementById('input-rr-cold').value,
    rrHot:         document.getElementById('input-rr-hot').value,
    
    // Передняя ось
    fTrack:        document.getElementById('input-f-track').value.trim(),
    caster:        document.getElementById('input-caster').value.trim(),
    camber:        document.getElementById('input-camber').value.trim(),
    toe:           document.getElementById('input-toe').value.trim(),
    ackermann:     document.getElementById('select-ackermann').value,
    fRideHeight:   document.getElementById('select-f-rideheight').value,
    fTorsion:      document.getElementById('select-f-torsion').value,
    fHubs:         document.getElementById('input-f-hubs').value.trim(),
    floorpan:      document.getElementById('select-floorpan').value,
    
    // Задняя ось
    rTrack:        document.getElementById('input-r-track').value.trim(),
    rAxle:         document.getElementById('select-r-axle').value,
    rRideHeight:   document.getElementById('select-r-rideheight').value,
    rHubs:         document.getElementById('input-r-hubs').value.trim(),
    seatStays:     document.getElementById('input-seat-stays').value,
    seatPos:       document.getElementById('input-seat-pos').value.trim(),
    thirdBearing:  document.getElementById('select-third-bearing').value,
    bumper:        document.getElementById('select-bumper').value,
    rTorsion:      document.getElementById('select-r-torsion').value
  };

  try {
    const races = await getRaces();
    races.unshift(race); // новый — в начало
    await saveRaces(races);

    // Тактильный фидбэк (если доступен)
    if (tg && tg.HapticFeedback) {
      tg.HapticFeedback.notificationOccurred('success');
    }

    showToast('Заезд сохранён ✓');
    resetForm();
  } catch (err) {
    showToast('Ошибка сохранения');
    console.error(err);
  }
}

/**
 * Сбрасывает форму к значениям по умолчанию.
 */
function resetForm() {
  document.getElementById('race-form').reset();
  setSessionDate();

  // Возвращаем ползунки к дефолтам
  const sliders = document.querySelectorAll('#race-form input[type="range"]');
  sliders.forEach((s) => {
    // reset() не сбрасывает range — делаем вручную
    s.value = s.defaultValue;
    syncSliderValue(s);
  });
}

/**
 * Устанавливает текущую дату как название выезда по умолчанию
 */
function setSessionDate() {
  const input = document.getElementById('input-session-name');
  if (!input) return;
  const d = new Date();
  const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  input.value = `Выезд ${dateStr}`;
}

// ——————————————————————————————————————————————
// 6. Рендер: История и Сетапы
// ——————————————————————————————————————————————

/**
 * Загружает данные и рендерит списки «Истории» и «Сетапов».
 */
async function loadRaces() {
  const races = await getRaces();
  renderHistory(races);
  renderSetups(races);
}

/**
 * Отрисовывает карточки заездов во вкладке «История».
 * @param {Array} races
 */
function renderHistory(races) {
  const container = document.getElementById('history-list');

  if (!races.length) {
    container.innerHTML = '<p class="empty-state">Пока нет записей</p>';
    return;
  }

  container.innerHTML = races.map((r, i) => {
    const dateStr = formatDate(r.date);
    return `
      <div class="race-card" style="animation-delay:${i * .06}s">
        <div class="race-card__header">
          <span class="race-card__track">${esc(r.sessionName || r.track || 'Заезд')}</span>
          <span class="race-card__time">${esc(r.laptime)}</span>
        </div>
        <div class="race-card__date">${dateStr}</div>
        <div class="race-card__setup">
          <div class="race-card__param">FL: <span>${r.flCold || '-'} / ${r.flHot || '-'}</span></div>
          <div class="race-card__param">FR: <span>${r.frCold || '-'} / ${r.frHot || '-'}</span></div>
          <div class="race-card__param">RL: <span>${r.rlCold || '-'} / ${r.rlHot || '-'}</span></div>
          <div class="race-card__param">RR: <span>${r.rrCold || '-'} / ${r.rrHot || '-'}</span></div>
        </div>
        <details class="race-card__extended-setup">
          <summary>Полный сетап</summary>
          <div class="extended-setup-grid">
            <div class="grid-header">Перед:</div><div></div>
            <div>Колея:</div><div>${esc(r.fTrack)}</div>
            <div>Кастор:</div><div>${esc(r.caster)}</div>
            <div>Развал/Схожд:</div><div>${esc(r.camber)} / ${esc(r.toe)}</div>
            <div>Аккерман:</div><div>${esc(r.ackermann)}</div>
            <div>Клиренс/Полик:</div><div>${esc(r.fRideHeight)} / ${esc(r.floorpan)}</div>
            <div>Торсион:</div><div>${esc(r.fTorsion)}</div>
            <div>Ступицы:</div><div>${esc(r.fHubs)}</div>
            
            <div class="grid-header" style="margin-top: 8px;">Зад:</div><div></div>
            <div>Колея:</div><div>${esc(r.rTrack)}</div>
            <div>Ось:</div><div>${esc(r.rAxle)}</div>
            <div>Клиренс:</div><div>${esc(r.rRideHeight)}</div>
            <div>Торсион:</div><div>${esc(r.rTorsion)}</div>
            <div>Ступицы:</div><div>${esc(r.rHubs)}</div>
            <div>Сиденье (тяги):</div><div>${esc(r.seatPos)} (${esc(r.seatStays)})</div>
            <div>3-й подшипник:</div><div>${esc(r.thirdBearing)}</div>
            <div>Отбойник:</div><div>${esc(r.bumper)}</div>
          </div>
        </details>
        ${r.notes ? `<div class="race-card__notes">${esc(r.notes)}</div>` : ''}
        <button class="race-card__delete" data-id="${r.id}">Удалить</button>
      </div>`;
  }).join('');
}

/**
 * Отрисовывает уникальные сетапы (по трассе) во вкладке «Сетапы».
 * Показывает последний использованный сетап для каждой трассы.
 * @param {Array} races
 */
function renderSetups(races) {
  const container = document.getElementById('setups-list');

  if (!races.length) {
    container.innerHTML = '<p class="empty-state">Сетапы появятся после сохранения заездов</p>';
    return;
  }

  // Без трассы просто выводим последние 10 сетапов
  const setups = races.slice(0, 10);

  container.innerHTML = setups.map((r, i) => `
    <div class="setup-card" style="animation-delay:${i * .06}s">
      <div class="setup-card__track">🏎 ${esc(r.sessionName || r.track || 'Заезд')}</div>
      <div class="setup-card__params">
        <div>FL: <span>${r.flCold || '-'} / ${r.flHot || '-'}</span></div>
        <div>FR: <span>${r.frCold || '-'} / ${r.frHot || '-'}</span></div>
        <div>RL: <span>${r.rlCold || '-'} / ${r.rlHot || '-'}</span></div>
        <div>RR: <span>${r.rrCold || '-'} / ${r.rrHot || '-'}</span></div>
        <div>Время: <span>${esc(r.laptime)}</span></div>
      </div>
      <details class="race-card__extended-setup" style="margin-top: 10px;">
        <summary>Полный сетап</summary>
        <div class="extended-setup-grid">
          <div class="grid-header">Перед:</div><div></div>
          <div>Колея:</div><div>${esc(r.fTrack)}</div>
          <div>Кастор:</div><div>${esc(r.caster)}</div>
          <div>Развал/Схожд:</div><div>${esc(r.camber)} / ${esc(r.toe)}</div>
          <div>Аккерман:</div><div>${esc(r.ackermann)}</div>
          <div>Клиренс/Полик:</div><div>${esc(r.fRideHeight)} / ${esc(r.floorpan)}</div>
          <div>Торсион:</div><div>${esc(r.fTorsion)}</div>
          <div>Ступицы:</div><div>${esc(r.fHubs)}</div>
          
          <div class="grid-header" style="margin-top: 8px;">Зад:</div><div></div>
          <div>Колея:</div><div>${esc(r.rTrack)}</div>
          <div>Ось:</div><div>${esc(r.rAxle)}</div>
          <div>Клиренс:</div><div>${esc(r.rRideHeight)}</div>
          <div>Торсион:</div><div>${esc(r.rTorsion)}</div>
          <div>Ступицы:</div><div>${esc(r.rHubs)}</div>
          <div>Сиденье (тяги):</div><div>${esc(r.seatPos)} (${esc(r.seatStays)})</div>
          <div>3-й подшипник:</div><div>${esc(r.thirdBearing)}</div>
          <div>Отбойник:</div><div>${esc(r.bumper)}</div>
        </div>
      </details>
    </div>`).join('');
}

/**
 * Удаляет заезд по id.
 * @param {number} raceId
 */
async function deleteRace(raceId) {
  let races = await getRaces();
  races = races.filter(r => r.id !== raceId);
  await saveRaces(races);

  if (tg && tg.HapticFeedback) {
    tg.HapticFeedback.notificationOccurred('warning');
  }

  showToast('Заезд удалён');
  loadRaces();
}

// ——————————————————————————————————————————————
// 7. Утилиты
// ——————————————————————————————————————————————

/**
 * Форматирует ISO-дату в человекочитаемый вид.
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

/**
 * Экранирует HTML-символы для безопасной вставки в innerHTML.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

/**
 * Показывает всплывающее уведомление (toast).
 * @param {string} message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('show');

  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 350);
  }, 2000);
}

// ——————————————————————————————————————————————
// 8. Подключение обработчиков событий
// ——————————————————————————————————————————————

document.addEventListener('DOMContentLoaded', () => {
  // Инициализация
  initApp();
  setSessionDate();

  // Навигация
  document.getElementById('bottom-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn) switchTab(btn.dataset.tab);
  });

  // Форма
  document.getElementById('race-form').addEventListener('submit', handleFormSubmit);

  // Stepper-кнопки (+/−)
  document.querySelectorAll('.stepper__btn').forEach(btn => {
    btn.addEventListener('click', () => handleStepperClick(btn));
  });

  // Ползунки — обновление значения при перетягивании
  document.querySelectorAll('input[type="range"]').forEach(slider => {
    slider.addEventListener('input', () => syncSliderValue(slider));
    // Инициализируем начальные значения
    syncSliderValue(slider);
  });

  // Удаление заезда (делегирование событий)
  document.getElementById('history-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.race-card__delete');
    if (btn) {
      const id = parseInt(btn.dataset.id, 10);
      deleteRace(id);
    }
  });
});
