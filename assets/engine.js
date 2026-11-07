(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CosmicGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'think-grow.cosmos.v1';
  const empty = () => ({ version: 1, results: {}, drafts: {}, active: null });
  const phases = ['study', 'identify', 'verify'];
  function shuffle(items, random = Math.random) {
    const values = [...items];
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }
  class Expedition {
    constructor(content, storage, random = Math.random) {
      this.content = content;
      this.storage = storage;
      this.random = random;
      this.data = empty();
      this.persistent = false;
      try { this.data = this.normalize(JSON.parse(storage.getItem(KEY))); } catch {}
      try { storage.setItem(`${KEY}.check`, '1'); storage.removeItem(`${KEY}.check`); this.persistent = true; } catch {}
    }
    object(id) { return this.content.objects.find(item => item.id === id); }
    normalize(raw) {
      const normalized = empty();
      if (raw?.version !== 1) return normalized;
      for (const object of this.content.objects) {
        const result = raw.results?.[object.id];
        if (Number.isInteger(result?.mistakes) && result.mistakes >= 0 && result.mistakes <= 4) normalized.results[object.id] = { mistakes: result.mistakes };
        const draft = raw.drafts?.[object.id];
        if (!draft || !phases.includes(draft.phase) || !Number.isInteger(draft.mistakes) || draft.mistakes < 0 || draft.mistakes > 4) continue;
        const order = draft.order;
        if (!Array.isArray(order) || order.length !== 3 || order.some(value => ![0, 1, 2].includes(value)) || new Set(order).size !== 3) continue;
        const options = draft.phase === 'identify' ? this.content.objects.filter(item => item.sector === object.sector).map(item => item.id) : [0, 1, 2];
        if (!Array.isArray(draft.rejected) || draft.rejected.length > 2 || new Set(draft.rejected).size !== draft.rejected.length ||
            draft.rejected.some(value => !options.includes(value) || value === (draft.phase === 'identify' ? object.id : 0)) ||
            draft.mistakes < draft.rejected.length || (draft.phase === 'study' && (draft.mistakes || draft.rejected.length))) continue;
        normalized.drafts[object.id] = { phase: draft.phase, mistakes: draft.mistakes, rejected: [...draft.rejected], order: [...order] };
      }
      if (typeof raw.active === 'string' && normalized.drafts[raw.active]) normalized.active = raw.active;
      return normalized;
    }
    save() {
      try { this.storage.setItem(KEY, JSON.stringify(this.data)); this.persistent = true; }
      catch { this.persistent = false; }
    }
    start(id) {
      if (!this.object(id)) throw Error('Неизвестный объект');
      if (!this.data.drafts[id]) this.data.drafts[id] = { phase: 'study', mistakes: 0, rejected: [], order: shuffle([0, 1, 2], this.random) };
      this.data.active = id;
      this.save();
      return this.current();
    }
    current() { return this.data.drafts[this.data.active] ?? null; }
    advance() {
      const current = this.current();
      if (!current || current.phase !== 'study') return false;
      current.phase = 'identify';
      this.save();
      return true;
    }
    options() {
      const current = this.current();
      if (!current || current.phase === 'study') return [];
      const object = this.object(this.data.active);
      const options = current.phase === 'identify'
        ? this.content.objects.filter(item => item.sector === object.sector).map(item => ({ value: item.id, text: item.title }))
        : object.choices.map((text, value) => ({ value, text }));
      return current.order.map(index => options[index]);
    }
    answer(value) {
      const current = this.current();
      if (!current || current.phase === 'study' || !this.options().some(option => option.value === value) || current.rejected.includes(value)) return { accepted: false };
      const id = this.data.active;
      const correct = value === (current.phase === 'identify' ? id : 0);
      if (!correct) {
        current.mistakes++;
        current.rejected.push(value);
        this.save();
        return { accepted: true, correct: false };
      }
      if (current.phase === 'identify') {
        current.phase = 'verify';
        current.rejected = [];
        current.order = shuffle([0, 1, 2], this.random);
        this.save();
        return { accepted: true, correct: true, complete: false };
      }
      const before = this.unlocked();
      const old = this.data.results[id];
      const first = !old;
      const record = !old || current.mistakes < old.mistakes;
      if (record) this.data.results[id] = { mistakes: current.mistakes };
      const mistakes = current.mistakes;
      delete this.data.drafts[id];
      this.data.active = null;
      this.save();
      const after = this.unlocked();
      return { accepted: true, correct: true, complete: true, id, mistakes, first, record,
        achievements: Object.keys(after).filter(key => after[key] && !before[key]) };
    }
    total() { return Object.keys(this.data.results).length; }
    completed(sector) { return this.content.objects.filter(item => item.sector === sector && this.data.results[item.id]).length; }
    resume() { return this.data.active ?? Object.keys(this.data.drafts)[0] ?? null; }
    unlocked() {
      return { first: this.total() > 0, perfect: Object.values(this.data.results).some(result => result.mistakes === 0),
        sector: this.content.sectors.some(sector => this.completed(sector.id) === 3), atlas: this.total() === 12 };
    }
    reset() {
      const cleared = empty();
      if (this.storage) {
        try { this.storage.setItem(KEY, JSON.stringify(cleared)); this.persistent = true; }
        catch { return false; }
      }
      this.data = cleared;
      return true;
    }
  }
  return { Expedition, KEY, stars: mistakes => mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1 };
});
