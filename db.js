// db.js — SQLite persistence for SmartPOS.
//
// Schema (deliberately simple and robust, not a full star schema):
//   records(collection, id, data, updated_at)   — one row per entity for every
//     array-shaped part of the app's state: sales, specials, expenses, waste,
//     transfers, purchases, requests, payroll, supplierPayments,
//     reconciliations, deposits, audit. Real rows, real SQL: e.g.
//       SELECT json_extract(data,'$.total') FROM records WHERE collection='sales'
//   singletons(key, data, updated_at)            — one row per config/whole-object
//     part of the state that isn't naturally a list of records: settings,
//     meats, cons, sides, styles, instructions, users, kitchen, tabs,
//     counters, consDays.
//
// This keeps every business rule in logic.js completely unchanged (it already
// has ~50 passing tests) while giving the app a real, inspectable SQLite file
// on disk instead of the browser's localStorage.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const RECORD_COLLECTIONS = ['sales', 'specials', 'expenses', 'waste', 'transfers', 'purchases', 'requests', 'payroll', 'supplierPayments', 'reconciliations', 'deposits', 'audit', 'usage'];
const SINGLETON_KEYS = ['settings', 'meats', 'cons', 'sides', 'styles', 'instructions', 'users', 'kitchen', 'tabs', 'counters', 'consDays', 'readyDays', 'employees', 'suppliers'];

function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);
    CREATE TABLE IF NOT EXISTS singletons (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

/* ---------------- save version ---------------- */
// A single persisted counter, used to detect a stale save. It lives in the
// singletons table under a key that is deliberately NOT in SINGLETON_KEYS, so
// loadState and saveState never read or overwrite it.
const VERSION_KEY = '__version';
function getVersion(db) {
  const row = db.prepare('SELECT data FROM singletons WHERE key = ?').get(VERSION_KEY);
  if (!row) return 0;
  try { const v = JSON.parse(row.data); return Number(v.version) || 0; } catch (e) { return 0; }
}
function setVersion(db, v) {
  db.prepare('INSERT INTO singletons (key, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
    .run(VERSION_KEY, JSON.stringify({ version: v }), new Date().toISOString());
}

// Load the whole app state (same shape logic.js's seed() produces) out of SQLite.
function loadState(db, seedFn) {
  const seeded = seedFn();
  const state = Object.assign({}, seeded);
  for (const key of SINGLETON_KEYS) {
    const row = db.prepare('SELECT data FROM singletons WHERE key = ?').get(key);
    if (row) state[key] = JSON.parse(row.data);
  }
  let hasAnyRecords = false;
  for (const coll of RECORD_COLLECTIONS) {
    const rows = db.prepare('SELECT data FROM records WHERE collection = ? ORDER BY rowid').all(coll);
    if (rows.length) { hasAnyRecords = true; state[coll] = rows.map((r) => JSON.parse(r.data)); }
    else state[coll] = [];
  }
  const isFreshDb = !db.prepare('SELECT 1 FROM singletons LIMIT 1').get() && !hasAnyRecords;
  backfillPortionPrices(state);
  return { state, isFreshDb };
}

// A database saved before independently-editable portion prices existed won't have
// butcheryPortions/readyPortions/specialPortions on its meats yet. Fill them in once,
// computed from the old flat per-kg (or per-bird) rate, so nothing is undefined —
// after this, editing one portion never touches the others.
function backfillPortionPrices(state) {
  (state.meats || []).forEach((m) => {
    if (m.kind === 'bird') {
      if (!m.butcheryPortions) m.butcheryPortions = { full: m.butchery || 0, half: Math.round((m.butchery || 0) / 2) };
      if (m.special && !m.specialPortions) m.specialPortions = { full: m.special, half: Math.round(m.special / 2) };
      if (!m.readyPortions) m.readyPortions = {};
    } else {
      if (!m.butcheryPortions) m.butcheryPortions = { 0.25: Math.round((m.butchery || 0) * 0.25), 0.5: Math.round((m.butchery || 0) * 0.5), 0.75: Math.round((m.butchery || 0) * 0.75), 1: m.butchery || 0 };
      if (!m.readyPortions) m.readyPortions = m.ready ? { 0.25: Math.round(m.ready * 0.25), 0.5: Math.round(m.ready * 0.5), 0.75: Math.round(m.ready * 0.75), 1: m.ready } : {};
      if (m.readyLow === undefined) m.readyLow = 8;
      if (!m.specialPortions) m.specialPortions = { 0.25: Math.round((m.special || 0) * 0.25), 0.5: Math.round((m.special || 0) * 0.5), 0.75: Math.round((m.special || 0) * 0.75), 1: m.special || 0 };
    }
  });
  if (!state.settings) state.settings = {};
  if (!state.settings.portionGrams) state.settings.portionGrams = 250;
  if (!state.readyDays) state.readyDays = {};
  // Inventory reclassification (one time): gas and charcoal are running costs, so
  // they belong under Expenses rather than stock; cooking oil and maize flour are
  // kitchen ingredients (part of food cost), not general consumables.
  if (!state.settings.inventoryReclassified) {
    state.cons = (state.cons || []).filter((c) => c.id !== 'charcoal' && c.id !== 'gas');
    const oil = state.cons.find((c) => c.id === 'oil');
    if (oil) { oil.cat = 'ingredient'; if (!oil.cost) oil.cost = 320; }
    if (!state.cons.find((c) => c.id === 'maize')) state.cons.push({ id: 'maize', name: 'Maize flour (unga)', cat: 'ingredient', unit: 'kg', price: 0, cost: 130, qty: 0, low: 10, active: true });
    const ugali = (state.sides || []).find((x) => x.id === 'ugali');
    if (ugali && ugali.cost === 15) ugali.cost = 0;
    state.settings.inventoryReclassified = true;
  }
  if (!state.usage) state.usage = [];
  // Ready-made stock used to be kept in raw kg; it's now kept in whole portions
  // (a configurable weight each, 250g by default). Convert once, using the
  // portion size just established above, and never touch it again.
  if (!state._readyPortionsMigrated && !state.settings.readyPortionsMigrated) {
    const grams = state.settings.portionGrams;
    Object.keys(state.kitchen || {}).forEach((id) => {
      const kgValue = state.kitchen[id] || 0;
      state.kitchen[id] = Math.round((kgValue * 1000) / grams);
    });
    state.settings.readyPortionsMigrated = true;
  }
}




// Persist the whole app state back into SQLite. Replaces each table's content
// with what the client currently has (the client is the source of truth for
// a given save; this keeps the write path simple and avoids partial-update bugs).
function saveState(db, state) {
  const now = new Date().toISOString();
  const tx = db.exec.bind(db);
  tx('BEGIN');
  try {
    for (const key of SINGLETON_KEYS) {
      db.prepare('INSERT INTO singletons (key, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
        .run(key, JSON.stringify(state[key] !== undefined ? state[key] : null), now);
    }
    for (const coll of RECORD_COLLECTIONS) {
      db.prepare('DELETE FROM records WHERE collection = ?').run(coll);
      const arr = Array.isArray(state[coll]) ? state[coll] : [];
      const ins = db.prepare('INSERT INTO records (collection, id, data, updated_at) VALUES (?, ?, ?, ?)');
      for (const rec of arr) ins.run(coll, String(rec.id), JSON.stringify(rec), now);
    }
    tx('COMMIT');
  } catch (e) {
    tx('ROLLBACK');
    throw e;
  }
  return now;
}

module.exports = { openDb, loadState, saveState, backfillPortionPrices, getVersion, setVersion, RECORD_COLLECTIONS, SINGLETON_KEYS };
