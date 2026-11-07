'use strict';
const $ = id => document.getElementById(id);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const expedition = new CosmicGame.Expedition(COSMOS, storage);
const view = { screen: 'home', sector: 'planets', atlas: 'planets', object: null, reading: false, reviewing: false };
const badgeNames = { first: 'Первый контакт', perfect: 'Точный сканер', sector: 'Знаток сектора', atlas: 'Вся экспедиция' };
function element(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, action, cls, data = {}) {
  const node = element('button', cls, text);
  node.type = 'button'; node.dataset.action = action; Object.assign(node.dataset, data);
  return node;
}
function sector(id = view.sector) { return COSMOS.sectors.find(item => item.id === id); }
function objects(id = view.sector) { return COSMOS.objects.filter(item => item.sector === id); }
function object(id = view.object) { return expedition.object(id); }
function stars(mistakes) { const count = CosmicGame.stars(mistakes); return '★'.repeat(count) + '☆'.repeat(3 - count); }
const icons = {
  planet: '<circle cx="64" cy="64" r="26"/><ellipse cx="64" cy="64" rx="53" ry="15" transform="rotate(-27 64 64)"/><circle cx="100" cy="24" r="4"/>',
  star: '<path d="M64 17L76 48L109 51L83 73L91 106L64 88L37 106L45 73L19 51L52 48Z"/><path d="M103 14V29M96 21H110"/>',
  galaxy: '<ellipse cx="64" cy="64" rx="49" ry="23" transform="rotate(-30 64 64)"/><ellipse cx="64" cy="64" rx="33" ry="14" transform="rotate(-30 64 64)"/><circle cx="64" cy="64" r="7"/><path d="M17 101L30 95M103 27L115 22"/>',
  hole: '<circle cx="64" cy="64" r="25"/><ellipse cx="64" cy="64" rx="53" ry="13" transform="rotate(22 64 64)"/><path d="M31 34A45 45 0 0 1 106 56M97 98A45 45 0 0 1 22 72"/>'
};
function icon(id) {
  const node = element('span', 'sector-icon');
  node.innerHTML = `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[sector(id).icon]}</svg>`;
  return node;
}
function portrait(item) {
  const node = element('div', 'object-art');
  const image = element('img'); image.src = `assets/objects/${item.image}.png`; image.alt = `Иллюстрация: ${item.title}`;
  node.append(image); return node;
}
function status() {
  $('total').textContent = `${expedition.total()} / 12`;
  $('saveStatus').textContent = expedition.persistent ? 'Прогресс сохраняется в этом браузере' : 'Сохранение недоступно — прогресс до обновления страницы';
  $('reset').disabled = !expedition.total() && !expedition.resume();
}
function show(name) {
  view.screen = name;
  document.querySelectorAll('.screen').forEach(node => { node.hidden = node.id !== `${name}Screen`; });
  $('reset').hidden = name !== 'home';
  document.documentElement.style.setProperty('--accent', name === 'home' ? '#82d6e9' : sector(name === 'atlas' ? view.atlas : view.sector).color);
  status(); $(`${name}Title`)?.focus({ preventScroll: true });
}
function home() {
  const grid = $('sectorGrid'); grid.replaceChildren();
  COSMOS.sectors.forEach((item, index) => {
    const done = expedition.completed(item.id);
    const card = button('', 'chooseSector', 'sector-card', { sector: item.id });
    card.style.setProperty('--sector-color', item.color);
    const top = element('div', 'sector-card-top'); top.append(element('span', '', `СЕКТОР 0${index + 1}`), element('span', '', `${done} / 3`));
    card.append(top, icon(item.id), element('strong', '', item.title), element('span', 'sector-subtitle', item.subtitle));
    const track = element('span', 'sector-track'); for (let i = 0; i < 3; i++) track.append(element('i', i < done ? 'done' : ''));
    card.append(track); grid.append(card);
  });
  $('resume').hidden = !expedition.resume();
  const unlocked = expedition.unlocked();
  $('badges').replaceChildren();
  for (const [id, name] of Object.entries(badgeNames)) {
    const badge = element('span', unlocked[id] ? 'badge unlocked' : 'badge', unlocked[id] ? `✦ ${name}` : `◇ ${name}`);
    badge.title = ({ first: 'Заверши первую миссию', perfect: 'Заверши миссию без ошибок', sector: 'Открой три объекта одного сектора', atlas: 'Открой все 12 объектов' })[id];
    $('badges').append(badge);
  }
  show('home');
}
function openSector(id = view.sector) {
  view.sector = id;
  const item = sector();
  $('sectorTitle').textContent = item.title; $('sectorIntro').textContent = item.intro;
  $('sectorCount').textContent = `${expedition.completed(id)} из 3 открытий`;
  $('sectorArt').replaceChildren(icon(id));
  const grid = $('missionGrid'); grid.replaceChildren();
  objects().forEach((item, index) => {
    const result = expedition.data.results[item.id]; const draft = expedition.data.drafts[item.id];
    const card = button('', 'start', `mission-card${result ? ' completed' : ''}`, { id: item.id });
    card.append(element('span', 'mission-index', result ? '✦' : `0${index + 1}`), element('strong', '', result ? item.title : `Секретный объект ${index + 1}`),
      element('span', 'mission-state', draft ? 'Продолжить исследование →' : result ? `${stars(result.mistakes)} · Пройти ещё раз` : 'Начать исследование →'));
    grid.append(card);
  });
  show('sector');
}
function start(id) {
  const item = object(id); view.object = id; view.sector = item.sector; view.reviewing = false;
  expedition.start(id); setFeedback(''); renderMission(); show('mission');
}
function setFeedback(text, state = '') { $('feedback').textContent = text; $('feedback').className = `feedback ${state}`; }
function renderMission() {
  const item = object(); const current = expedition.current();
  const study = current.phase === 'study' || view.reviewing;
  $('missionScreen').dataset.phase = study ? 'study' : current.phase;
  $('missionTitle').textContent = study ? 'Знакомство с объектом' : current.phase === 'identify' ? 'Узнай по описанию' : 'Проверь открытие';
  $('missionSector').textContent = sector().title.toLocaleUpperCase('ru');
  $('missionNumber').textContent = `Миссия ${objects().findIndex(value => value.id === item.id) + 1} / 3`;
  const phase = study ? 0 : current.phase === 'identify' ? 1 : 2;
  Array.from($('steps').children).forEach((node, index) => { node.className = index === phase ? 'active' : index < phase ? 'finished' : ''; if (index === phase) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current'); });
  $('astroImage').src = study ? 'assets/robots/welcome.png' : 'assets/robots/thinking.png';
  $('astroHeading').textContent = study ? 'Приготовься к открытию!' : 'Астро рядом';
  $('astroText').textContent = study ? 'Сначала прочитай знакомство. Название может быть сложным — его не нужно знать заранее.' : 'Подумай о главном признаке. Если забыл, можно перечитать знакомство.';
  $('review').hidden = study; $('studyNext').hidden = !study || view.reviewing; $('reviewBack').hidden = !view.reviewing;
  $('taskLabel').textContent = study ? 'БОРТОВОЙ ЖУРНАЛ' : current.phase === 'identify' ? 'СИГНАЛ СО СКАНЕРА' : 'ПРОВЕРКА ИССЛЕДОВАТЕЛЯ';
  $('taskTitle').textContent = study ? item.title : current.phase === 'identify' ? 'Какой объект мы ищем?' : item.question;
  $('taskText').textContent = study ? item.study : current.phase === 'identify' ? item.clue : '';
  $('choices').replaceChildren();
  if (!study) expedition.options().forEach((option, index) => {
    const rejected = current.rejected.includes(option.value);
    const choice = button('', 'answer', `choice${rejected ? ' rejected' : ''}`, { value: option.value }); choice.disabled = rejected;
    choice.append(element('span', 'choice-marker', rejected ? '×' : String(index + 1)), element('span', '', option.text));
    $('choices').append(choice);
  });
  $('mistakes').textContent = study ? 'Прочитай в своём темпе. Время не ограничено.' : `Ошибок в миссии: ${current.mistakes} · 3★ — без ошибок`;
  status();
}
function answer(value) {
  const current = expedition.current(); if (!current || view.reviewing) return;
  const outcome = expedition.answer(current.phase === 'verify' ? Number(value) : value);
  if (!outcome.accepted) return;
  if (outcome.complete) { reward(outcome.id, false, outcome); return; }
  if (outcome.correct) setFeedback('Объект найден! Осталось проверить главный признак.', 'success');
  else setFeedback('Этот вариант не подходит. Подумай ещё или перечитай знакомство.', 'retry');
  renderMission(); $('choices').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}
function reward(id, fromAtlas = false, outcome = null) {
  if (!expedition.data.results[id]) return;
  view.object = id; view.sector = object(id).sector; view.reading = fromAtlas;
  const item = object(); const result = expedition.data.results[id];
  $('rewardTitle').textContent = item.title; $('rewardTagline').textContent = item.tagline; $('rewardFact').textContent = item.fact;
  $('rewardArt').replaceChildren(...portrait(item).children);
  $('imageNote').textContent = item.imageNote || 'Изображение из печатного набора. Для ряда объектов использованы художественные иллюстрации.';
  $('rewardContext').textContent = `${sector().title} · ${expedition.completed(view.sector)} / 3`;
  const mistakes = outcome ? outcome.mistakes : result.mistakes;
  $('rewardStars').textContent = stars(mistakes); $('rewardStars').setAttribute('aria-label', `${CosmicGame.stars(mistakes)} из 3 звёзд`);
  $('rewardEyebrow').textContent = fromAtlas ? 'СТРАНИЦА КОСМИЧЕСКОГО АТЛАСА' : outcome?.first ? 'НОВОЕ ОТКРЫТИЕ В АТЛАСЕ!' : 'ОТЛИЧНАЯ ТРЕНИРОВКА!';
  $('source').href = item.source[1]; $('source').textContent = `Источник: ${item.source[0]} ↗`;
  $('newBadges').textContent = outcome?.achievements.length ? `✦ ${outcome.achievements.map(id => badgeNames[id]).join(' · ')}` : fromAtlas ? `Лучший результат: ошибок — ${result.mistakes}.` : `Миссия завершена! Ошибок: ${mistakes}.`;
  $('rewardBack').dataset.action = fromAtlas ? 'atlas' : 'sector'; $('rewardBack').textContent = fromAtlas ? '← Атлас' : '← Миссии';
  const remaining = objects().some(item => !expedition.data.results[item.id]);
  $('nextMission').textContent = fromAtlas ? 'Вернуться в атлас →' : remaining ? 'Следующая миссия →' : 'Сектор изучен! На базу →';
  show('reward');
}
function atlas(id = view.atlas) {
  view.atlas = id; $('atlasSelect').value = id; $('atlasCount').textContent = `${expedition.completed(id)} / 3`;
  $('atlasGrid').replaceChildren();
  objects(id).forEach((item, index) => {
    const result = expedition.data.results[item.id];
    const card = button('', 'read', `atlas-card${result ? ' open' : ''}`, { id: item.id }); card.disabled = !result;
    const art = result ? portrait(item) : element('div', 'atlas-locked', '✧');
    const copy = element('div', 'atlas-card-copy'); copy.append(element('small', '', `ОБЪЕКТ 0${index + 1}`), element('strong', '', result ? item.title : 'Пока не исследован'), element('span', '', result ? stars(result.mistakes) : 'Пройди миссию в этом секторе'));
    card.append(art, copy); $('atlasGrid').append(card);
  });
  show('atlas');
}
function reset() {
  if (!expedition.total() && !expedition.resume()) return;
  if (!window.confirm('Начать экспедицию сначала? Все открытия, звёзды и незавершённые миссии этой игры в этом браузере будут удалены. Отменить сброс нельзя.')) return;
  if (!expedition.reset()) { window.alert('Браузер не разрешил изменить сохранение. Прогресс оставлен без изменений.'); return; }
  Object.assign(view, { sector: 'planets', atlas: 'planets', object: null, reading: false, reviewing: false });
  home(); $('saveStatus').textContent = 'Прогресс сброшен. Новая экспедиция ждёт!';
}
document.addEventListener('click', event => {
  const target = event.target.closest('button[data-action]'); if (!target || target.disabled) return;
  const data = target.dataset;
  switch (data.action) {
    case 'home': home(); break;
    case 'chooseSector': openSector(data.sector); break;
    case 'sector': openSector(); break;
    case 'start': start(data.id); break;
    case 'resume': if (expedition.resume()) start(expedition.resume()); break;
    case 'studyNext': if (expedition.advance()) { setFeedback(''); renderMission(); $('choices').querySelector('button')?.focus({ preventScroll: true }); } break;
    case 'answer': answer(data.value); break;
    case 'review': view.reviewing = true; setFeedback(''); renderMission(); break;
    case 'reviewBack': view.reviewing = false; renderMission(); break;
    case 'atlas': atlas(view.screen === 'home' || view.screen === 'atlas' ? view.atlas : view.sector); break;
    case 'read': reward(data.id, true); break;
    case 'nextMission':
      if (view.reading) atlas();
      else { const next = objects().find(item => !expedition.data.results[item.id]); if (next) start(next.id); else home(); }
      break;
    case 'reset': reset(); break;
  }
});
COSMOS.sectors.forEach(item => { const option = element('option', '', item.title); option.value = item.id; $('atlasSelect').append(option); });
$('atlasSelect').addEventListener('change', event => atlas(event.target.value));
home();
