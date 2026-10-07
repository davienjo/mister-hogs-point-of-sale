'use strict';
/* =====================================================================
   MISTER HOGS · SMARTPOS v2  — business logic (no DOM, no React)
   ===================================================================== */
const STORE_KEY = 'mh_smartpos_v2';
const pad = (n, l = 2) => String(n).padStart(l, '0');
const dayStr = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const timeStr = (iso) => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const dateNice = (day) => {
  const p = day.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const clone = (o) => JSON.parse(JSON.stringify(o));
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
let CUR = 'KSh';
const money = (n) => {
  n = Math.round(n || 0);
  return (n < 0 ? '-' : '') + CUR + ' ' + Math.abs(n).toLocaleString('en-US');
};
const pct = (x) => (isFinite(x) ? (x * 100).toFixed(1) : '0.0') + '%';

const FRACS = [0.25, 0.5, 0.75, 1];
const FRAC_LABEL = { 0.25: '¼ kg', 0.5: '½ kg', 0.75: '¾ kg', 1: '1 kg' };
const qtyLabel = (qty, unit) => {
  if (unit === 'bird') return qty === 1 ? 'Full bird' : qty === 0.5 ? 'Half bird' : qty + ' birds';
  return FRAC_LABEL[qty] || (r3(qty) + ' kg');
};
const CHANNELS = [
  { id: 'butchery', label: 'Butchery (raw meat)' },
  { id: 'ready', label: 'Kitchen · Ready-made' },
  { id: 'special', label: 'Kitchen · Specials (incl. sides)' },
  { id: 'side', label: 'Sides' },
  { id: 'drink', label: 'Drinks' },
];
const EXPENSE_CATS = ['Charcoal', 'Gas & fuel', 'Electricity', 'Water', 'Cleaning', 'Transport', 'Maintenance', 'Rent', 'Licences & fees', 'Other'];
const WASTE_REASONS = ['Spoilage', 'Trimming loss', 'Damaged meat', 'Preparation waste', 'Other'];
const PAY_TYPES = { daily: 'Paid daily', weekly: 'Paid weekly', monthly: 'Paid monthly' };
const OUT_METHODS = ['Cash', 'M-Pesa', 'Bank'];

/* ---------------- seed data (sample values — all editable in Settings) ---------------- */
function seed() {
  return {
    v: 2,
    settings: { business: 'Mister Hogs', address: '', phone: '', footer: 'Karibu tena! Thank you for your business.', currency: 'KSh', tables: 10, theme: 'dark', sounds: true, printerWidth: '80', setupDone: false, portionGrams: 250 },
    users: [
      { id: 'u1', username: 'admin', name: 'Administrator', role: 'admin', pass: 'admin' },
      { id: 'u2', username: 'cashier', name: 'Cashier', role: 'cashier', pass: '1234' },
    ],
    meats: [
      { id: 'beef', name: 'Beef', emoji: '🐄', kind: 'kg', butchery: 800, butcheryPortions: { 0.25: 200, 0.5: 400, 0.75: 600, 1: 800 }, ready: 1100, readyPortions: { 0.25: 280, 0.5: 550, 0.75: 830, 1: 1100 }, readyLow: 8, special: 1200, specialPortions: { 0.25: 310, 0.5: 610, 0.75: 910, 1: 1200 }, cost: 620, stock: 40, low: 8, active: true },
      { id: 'goat', name: 'Goat', emoji: '🐐', kind: 'kg', butchery: 1000, butcheryPortions: { 0.25: 250, 0.5: 500, 0.75: 750, 1: 1000 }, ready: 1300, readyPortions: { 0.25: 330, 0.5: 650, 0.75: 980, 1: 1300 }, readyLow: 8, special: 1400, specialPortions: { 0.25: 360, 0.5: 710, 0.75: 1060, 1: 1400 }, cost: 780, stock: 30, low: 6, active: true },
      { id: 'pork', name: 'Pork', emoji: '🐖', kind: 'kg', butchery: 750, butcheryPortions: { 0.25: 190, 0.5: 375, 0.75: 560, 1: 750 }, ready: 1000, readyPortions: { 0.25: 250, 0.5: 500, 0.75: 750, 1: 1000 }, readyLow: 8, special: 1100, specialPortions: { 0.25: 290, 0.5: 570, 0.75: 850, 1: 1100 }, cost: 560, stock: 25, low: 6, active: true },
      { id: 'chicken', name: 'Chicken', emoji: '🐔', kind: 'bird', butchery: 850, butcheryPortions: { full: 850, half: 450 }, ready: 0, readyPortions: {}, special: 1300, specialPortions: { full: 1300, half: 700 }, cost: 600, stock: 20, low: 5, active: true },
    ],
    sides: [
      { id: 'ugali', name: 'Ugali', price: 50, cost: 0, active: true },
      { id: 'chapati', name: 'Chapati', price: 30, cost: 10, active: true },
      { id: 'rice', name: 'Rice', price: 100, cost: 35, active: true },
      { id: 'sukuma', name: 'Sukuma / Spinach', price: 50, cost: 15, active: true },
      { id: 'cabbage', name: 'Cabbage', price: 50, cost: 15, active: true },
      { id: 'potatoes', name: 'Potatoes', price: 100, cost: 35, active: true },
      { id: 'soup', name: 'Soup', price: 80, cost: 25, active: true },
      { id: 'kachumbari', name: 'Kachumbari', price: 40, cost: 12, active: true },
    ],
    styles: ['Choma', 'Chemsha', 'Tumbukiza', 'Fry', 'Stew'],
    instructions: ['No salt', 'Less spice', 'Extra spicy', 'Well done', 'Extra soup', 'No onions', 'Boneless', 'Extra chili', 'Serve hot'],
    cons: [
      { id: 'soda', name: 'Soda 300ml', cat: 'drink', unit: 'bottle', price: 60, cost: 42, qty: 48, low: 12, active: true },
      { id: 'water', name: 'Water 500ml', cat: 'drink', unit: 'bottle', price: 50, cost: 30, qty: 48, low: 12, active: true },
      { id: 'juice', name: 'Juice', cat: 'drink', unit: 'pack', price: 100, cost: 65, qty: 24, low: 6, active: true },
      { id: 'beer', name: 'Beer', cat: 'drink', unit: 'bottle', price: 250, cost: 190, qty: 24, low: 6, active: true },
      { id: 'maize', name: 'Maize flour (unga)', cat: 'ingredient', unit: 'kg', price: 0, cost: 130, qty: 50, low: 10, active: true },
      { id: 'oil', name: 'Cooking oil', cat: 'ingredient', unit: 'litre', price: 0, cost: 320, qty: 20, low: 5, active: true },
      { id: 'napkins', name: 'Serviettes', cat: 'supply', unit: 'pack', price: 0, cost: 0, qty: 10, low: 3, active: true },
      { id: 'straws', name: 'Drinking straws', cat: 'supply', unit: 'pack', price: 0, cost: 0, qty: 10, low: 3, active: true },
      { id: 'takeaway', name: 'Takeaway containers', cat: 'supply', unit: 'pack', price: 0, cost: 0, qty: 10, low: 3, active: true },
      { id: 'paper', name: 'Receipt paper', cat: 'supply', unit: 'roll', price: 0, cost: 0, qty: 6, low: 2, active: true },
    ],
    kitchen: { beef: 0, goat: 0, pork: 0 },
    requests: [], sales: [], specials: [], expenses: [], waste: [], transfers: [], purchases: [], usage: [],
    tabs: {}, counters: {}, consDays: {}, readyDays: {},
    employees: [], payroll: [],
    suppliers: [], supplierPayments: [],
    reconciliations: [], deposits: [],
    audit: [],
  };
}

/* ---------------- lookups ---------------- */
const meatOf = (s, id) => s.meats.find((m) => m.id === id);
const consOf = (s, id) => s.cons.find((c) => c.id === id);
const activeMeats = (s) => s.meats.filter((m) => m.active !== false);
const readyMeats = (s) => s.meats.filter((m) => m.active !== false && m.kind === 'kg' && m.readyPortions && m.readyPortions[1] > 0);
const receiptNo = (sale) => sale.day.slice(2).replace(/-/g, '') + '-' + pad(sale.no, 3);

function nextNo(s, key, day) {
  s.counters[key] = s.counters[key] || {};
  s.counters[key][day] = (s.counters[key][day] || 0) + 1;
  return s.counters[key][day];
}

/* ---------------- consumables: daily opening / closing ---------------- */
function ensureDay(s, day) {
  s.consDays[day] = s.consDays[day] || {};
  s.cons.forEach((c) => {
    if (!s.consDays[day][c.id]) s.consDays[day][c.id] = { opening: c.qty, received: 0, used: 0, closing: null, variance: 0 };
  });
}
function consDay(s, day, id) {
  ensureDay(s, day);
  return s.consDays[day][id];
}

/* ---------------- stock movement ---------------- */
function stockAvail(s, loc, id) {
  if (loc === 'butchery') { const m = meatOf(s, id); return m ? m.stock : 0; }
  if (loc === 'kitchen') return s.kitchen[id] || 0;
  if (loc === 'cons') { const c = consOf(s, id); return c ? c.qty : 0; }
  return Infinity;
}
function stockName(s, loc, id) {
  if (loc === 'cons') { const c = consOf(s, id); return c ? c.name : id; }
  const m = meatOf(s, id);
  const n = m ? m.name : id;
  return loc === 'kitchen' ? n + ' (kitchen)' : n;
}
function checkStock(s, list) {
  // Kitchen ready-made stock is a running balance, not a hard limit: a cashier can sell
  // before the morning transfer is logged. It's allowed to go negative and is reconciled
  // automatically the moment butchery sends meat through — no double deduction either way.
  const need = {};
  list.forEach((d) => { if (d.loc === 'kitchen') return; const k = d.loc + '|' + d.id; need[k] = r3((need[k] || 0) + d.qty); });
  const keys = Object.keys(need);
  for (let i = 0; i < keys.length; i++) {
    const p = keys[i].split('|');
    const have = stockAvail(s, p[0], p[1]);
    if (need[keys[i]] > have + 1e-9) return 'Not enough ' + stockName(s, p[0], p[1]) + ' — only ' + r3(have) + ' left';
  }
  return null;
}
function logAudit(s, type, detail, by) {
  s.audit.push({ id: uid(), at: new Date().toISOString(), day: dayStr(), type, detail, by });
}
function applyDeducts(s, list, dir, day) {
  list.forEach((d) => {
    const q = d.qty * dir;
    if (d.loc === 'butchery') { const m = meatOf(s, d.id); if (m) m.stock = r3(m.stock - q); }
    else if (d.loc === 'kitchen') {
      s.kitchen[d.id] = (s.kitchen[d.id] || 0) - q;
      const rd = readyDayOf(s, day, d.id);
      if (rd) rd.used = Math.max(0, rd.used + q);
    }
    else if (d.loc === 'cons') {
      const c = consOf(s, d.id);
      if (c) {
        ensureDay(s, day);
        c.qty = r3(c.qty - q);
        const cd = consDay(s, day, c.id);
        cd.used = Math.max(0, r3(cd.used + q));
      }
    }
  });
}

/* ---------------- line helpers (cart / tab / sale lines) ---------------- */
/* ---------------- ready-made portions ---------------- */
// Ready-made stock is kept in whole portions, not raw kg — a portion is a
// configurable weight (default 250g). Converting kg to portions happens once,
// at the moment meat is transferred from the butchery into the kitchen.
const portionsFromKg = (grams, kg) => Math.round((kg * 1000) / grams);
const kgFromPortions = (grams, portions) => r3((portions * grams) / 1000);
const portionsLabel = (grams, portions) => portions + (portions === 1 ? ' portion' : ' portions') + ' (' + kgFromPortions(grams, portions) + ' kg)';
function ensureReadyDay(s, day) {
  s.readyDays[day] = s.readyDays[day] || {};
  readyMeats(s).forEach((m) => {
    if (!s.readyDays[day][m.id]) s.readyDays[day][m.id] = { opening: s.kitchen[m.id] || 0, received: 0, used: 0, closing: null, variance: 0 };
  });
}
function readyDayOf(s, day, id) { ensureReadyDay(s, day); return s.readyDays[day][id]; }
const readyLowMeats = (s) => readyMeats(s).filter((m) => (s.kitchen[m.id] || 0) <= (m.readyLow || 0));

const readyMeatLine = (m, kg, grams) => {
  const portions = portionsFromKg(grams, kg);
  return {
    key: 'rm-' + uid(), kind: 'meat', ch: 'ready', mid: m.id, name: m.name, label: qtyLabel(kg, 'kg'),
    qty: kg, unit: 'kg', total: (m.readyPortions && m.readyPortions[kg]) || 0, cost: r2(m.cost * kg), deduct: [{ loc: 'kitchen', id: m.id, qty: portions }],
  };
};
const sideLine = (x) => ({ key: 'side-' + x.id, kind: 'side', ch: 'side', name: x.name, label: '', qty: 1, unit: 'pc', total: x.price, cost: x.cost || 0, deduct: [] });
const drinkLine = (c) => ({ key: 'drk-' + c.id, kind: 'drink', ch: 'drink', name: c.name, label: '', qty: 1, unit: c.unit || 'pc', total: c.price, cost: c.cost || 0, deduct: [{ loc: 'cons', id: c.id, qty: 1 }] });
const specialLine = (sp) => ({
  key: 'sp-' + sp.id, kind: 'special', ch: 'special', name: 'Special #' + sp.no + ' · ' + sp.meat,
  label: qtyLabel(sp.qty, sp.unit) + (sp.style ? ' · ' + sp.style : ''), qty: sp.qty, unit: sp.unit, total: sp.price, cost: sp.cost, deduct: [],
});
function scaleLine(line, newQty) {
  const ratio = newQty / line.qty;
  return Object.assign({}, line, {
    qty: newQty,
    total: Math.round(line.total * ratio),
    cost: r2(line.cost * ratio),
    deduct: (line.deduct || []).map((d) => Object.assign({}, d, { qty: r3(d.qty * ratio) })),
  });
}
function addLineTo(lines, line) {
  const i = line.kind === 'meat' ? -1 : lines.findIndex((l) => l.key === line.key);
  if (i < 0) return lines.concat([line]);
  const merged = scaleLine(lines[i], lines[i].qty + line.qty);
  return lines.map((l, j) => (j === i ? merged : l));
}
function reservedOf(lines) {
  const meat = {}, cons = {};
  lines.forEach((l) => (l.deduct || []).forEach((d) => {
    const t = d.loc === 'kitchen' ? meat : d.loc === 'cons' ? cons : null;
    if (t) t[d.id] = r3((t[d.id] || 0) + d.qty);
  }));
  return { meat, cons };
}

/* ---------------- sales ---------------- */
// Money actually received against a sale, with the day each part arrived. A credit
// sale paid next week is therefore counted (till, profit) on the day the money came in.
function payAmount(p) { return p ? (p.cash || 0) + (p.mpesa || 0) + (p.card || 0) : 0; }
function salePayments(x) {
  if (x.payments) return x.payments;
  const paid = r2(x.total - (x.balance || 0));
  if (!x.pay || paid <= 0) return [];
  return [{ at: x.at, day: x.day, cash: x.pay.cash || 0, mpesa: x.pay.mpesa || 0, card: x.pay.card || 0, amount: paid, ref: x.pay.ref || '' }];
}
const mkPayment = (pay, by) => ({ at: new Date().toISOString(), day: dayStr(), cash: pay.cash || 0, mpesa: pay.mpesa || 0, card: pay.card || 0, amount: r2(payAmount(pay)), ref: pay.ref || '', by: by || '' });
function createSale(s, o) {
  const day = dayStr();
  const lines = o.lines;
  if (o.deduct !== false) applyDeducts(s, lines.flatMap((l) => l.deduct || []), 1, day);
  const no = nextNo(s, 'sale', day);
  const total = r2(sum(lines, (l) => l.total));
  const paidNow = o.pay ? r2(payAmount(o.pay)) : 0;
  const cust = o.customer && (o.customer.name || o.customer.phone) ? { name: (o.customer.name || '').trim(), phone: (o.customer.phone || '').trim() } : null;
  const sale = {
    id: uid(), no, day, at: new Date().toISOString(), source: o.source,
    lines: lines.map((l) => ({ name: l.name, label: l.label, qty: l.qty, unit: l.unit, kind: l.kind, ch: l.ch, total: l.total, cost: l.cost || 0, deduct: l.deduct || [] })),
    total, cogs: r2(sum(lines, (l) => l.cost || 0)),
    pay: o.pay || null, payments: o.pay && paidNow > 0 ? [mkPayment(o.pay, o.cashier)] : [],
    status: o.pay ? (paidNow >= total - 0.5 ? 'paid' : 'partial') : 'unpaid', balance: r2(Math.max(0, total - paidNow)),
    cashier: o.cashier, tableNo: o.tableNo || null, deducted: o.deduct !== false, voided: false,
    special: o.special || null, customer: cust,
  };
  s.sales.push(sale);
  return sale;
}
// Receive money against a sale that still has a balance (credit sale, unpaid ready-made,
// part-paid). The payment is dated today, whatever day the sale itself was made.
function settleSaleBalance(s, saleId, pay, by) {
  const sale = s.sales.find((x) => x.id === saleId);
  if (!sale || sale.voided || sale.status === 'paid') return { err: 'Nothing owing on this sale' };
  const got = r2(payAmount(pay));
  if (!(got > 0)) return { err: 'Enter an amount above zero' };
  if (got > sale.balance + 0.5) return { err: 'That is more than the balance of ' + money(sale.balance) };
  sale.payments = salePayments(sale).slice();
  sale.payments.push(mkPayment(pay, by));
  sale.pay = sale.pay ? { method: 'split', cash: (sale.pay.cash || 0) + (pay.cash || 0), mpesa: (sale.pay.mpesa || 0) + (pay.mpesa || 0), card: (sale.pay.card || 0) + (pay.card || 0), ref: pay.ref || sale.pay.ref } : Object.assign({}, pay);
  sale.balance = r2(Math.max(0, sale.balance - got));
  sale.status = sale.balance <= 0.5 ? 'paid' : 'partial';
  if (sale.status === 'paid') sale.balance = 0;
  sale.settledBy = by;
  if (sale.special) { const sp = s.specials.find((x) => x.id === sale.special); if (sp) { sp.paidAmount = r2((sp.paidAmount || 0) + got); sp.paid = sp.paidAmount >= sp.price - 0.5; } }
  logAudit(s, 'Debt payment', receiptNo(sale) + (sale.customer && sale.customer.name ? ' · ' + sale.customer.name : '') + ' · ' + money(got), by);
  return { sale };
}
// Everyone who currently owes the business money, from every source, in one list —
// so the Debtors screen and the outstanding figure in Reports can never disagree.
function debtors(s) {
  const list = [];
  s.sales.filter((x) => !x.voided && x.status !== 'paid' && x.balance > 0.5 && !x.special && !x.tableNo).forEach((x) => {
    list.push({ kind: 'sale', id: x.id, name: (x.customer && x.customer.name) || 'Walk-in customer', phone: (x.customer && x.customer.phone) || '', ref: receiptNo(x), source: x.source === 'butchery' ? 'Butchery credit' : x.source === 'ready' ? 'Kitchen · ready-made' : 'Sale', at: x.at, day: x.day, total: x.total, paid: r2(x.total - x.balance), balance: x.balance });
  });
  s.specials.filter((x) => !x.paid && !x.cleared && !x.tableNo && x.price - (x.paidAmount || 0) > 0.5).forEach((x) => {
    list.push({ kind: 'special', id: x.id, name: x.customer || 'Walk-in customer', phone: x.phone || '', ref: 'Special #' + x.no, source: 'Special order', at: x.at, day: x.day, total: x.price, paid: x.paidAmount || 0, balance: r2(x.price - (x.paidAmount || 0)) });
  });
  return list.sort((a, b) => a.at.localeCompare(b.at));
}
function voidSale(s, saleId, reason, by) {
  const sale = s.sales.find((x) => x.id === saleId);
  if (!sale) return 'Sale not found';
  if (sale.voided) return 'Already voided';
  if (!reason || !reason.trim()) return 'Give a reason for the void';
  if (sale.deducted) applyDeducts(s, sale.lines.flatMap((l) => l.deduct || []), -1, sale.day);
  sale.voided = true; sale.voidReason = reason.trim(); sale.voidBy = by; sale.voidAt = new Date().toISOString();
  if (sale.tableNo) { s.specials.filter((x) => x.saleId === sale.id).forEach((sp) => { sp.paid = false; sp.paidAmount = 0; sp.saleId = null; }); }
  if (sale.special) { const sp = s.specials.find((x) => x.id === sale.special); if (sp) { sp.paidAmount = Math.max(0, r2((sp.paidAmount || 0) - (sale.total - sale.balance))); sp.paid = sp.paidAmount >= sp.price - 0.5; if (!sp.paid) sp.saleId = null; } }
  logAudit(s, 'Void sale', 'Receipt ' + receiptNo(sale) + ' · ' + money(sale.total) + ' · ' + reason.trim(), by);
  return null;
}

/* ---------------- butchery ↔ kitchen ---------------- */
function transferToKitchen(s, meatId, qty, by, type) {
  const m = meatOf(s, meatId);
  if (!m) return 'Unknown meat';
  if (qty <= 0) return 'Enter a quantity above zero';
  if (qty > m.stock + 1e-9) return 'Butchery only has ' + r3(m.stock) + ' kg of ' + m.name;
  const day = dayStr();
  const grams = s.settings.portionGrams || 250;
  const portions = portionsFromKg(grams, qty);
  if (m.kind === 'kg') ensureReadyDay(s, day);
  m.stock = r3(m.stock - qty);
  s.kitchen[meatId] = (s.kitchen[meatId] || 0) + portions;
  if (m.kind === 'kg') { const rd = readyDayOf(s, day, meatId); rd.received += portions; }
  s.transfers.push({ id: uid(), day, at: new Date().toISOString(), type: type || 'morning', meatId, name: m.name, qty, portions, by });
  return null;
}
function receiveMeat(s, meatId, qty, totalCost, supplierId, method, by) {
  const m = meatOf(s, meatId);
  if (totalCost > 0) m.cost = r2((m.stock * m.cost + totalCost) / (m.stock + qty));
  m.stock = r3(m.stock + qty);
  const day = dayStr();
  s.purchases.push({ id: uid(), day, at: new Date().toISOString(), kind: 'meat', itemId: m.id, name: m.name, qty, total: totalCost, supplierId: supplierId || null, method: method || 'cash', by });
  if (supplierId && method === 'credit' && totalCost > 0) { const sup = s.suppliers.find((x) => x.id === supplierId); if (sup) sup.balance = r2(sup.balance + totalCost); }
}
function recordWaste(s, o) {
  const m = meatOf(s, o.meatId);
  const have = stockAvail(s, o.loc, o.meatId);
  if (!(o.qty > 0)) return 'Enter a quantity above zero';
  if (o.qty > have + 1e-9) return 'Only ' + r3(have) + ' available to write off';
  applyDeducts(s, [{ loc: o.loc, id: o.meatId, qty: o.qty }], 1, dayStr());
  const grams = s.settings.portionGrams || 250;
  const cost = o.loc === 'kitchen' ? r2(o.qty * m.cost * (grams / 1000)) : r2(o.qty * m.cost);
  s.waste.push({ id: uid(), day: dayStr(), at: new Date().toISOString(), loc: o.loc, itemId: m.id, name: m.name, qty: o.qty, unit: o.loc === 'kitchen' ? 'portion' : m.kind, reason: o.reason, cost, by: o.by });
  return null;
}
// A physical count of ready-made portions differs from the running balance sometimes
// (prep loss, an uncounted sale, a mistake). Recording the count logs the difference
// and, if stock is short, writes it off as waste so it still hits the accounts.
function recordReadyClosing(s, meatId, counted, by) {
  const m = meatOf(s, meatId);
  const day = dayStr();
  const rd = readyDayOf(s, day, meatId);
  const have = s.kitchen[meatId] || 0;
  const variance = counted - have;
  const grams = s.settings.portionGrams || 250;
  if (variance < 0) {
    s.waste.push({ id: uid(), day, at: new Date().toISOString(), loc: 'kitchen', itemId: meatId, name: m.name, qty: -variance, unit: 'portion', reason: 'Stock count shortfall', cost: r2(-variance * m.cost * (grams / 1000)), by });
  }
  if (rd) { rd.variance += variance; rd.closing = counted; }
  s.kitchen[meatId] = counted;
}

/* ---------------- specials ---------------- */
function specialPrice(m, qty) {
  if (m.kind === 'bird') return (m.specialPortions && (qty === 1 ? m.specialPortions.full : qty === 0.5 ? m.specialPortions.half : Math.round(m.special * qty))) || 0;
  if (m.specialPortions && m.specialPortions[qty] !== undefined) return m.specialPortions[qty];
  return Math.round(m.special * qty);
}
function createSpecial(s, f, by) {
  const m = meatOf(s, f.meatId);
  if (!m) return { err: 'Pick a meat' };
  if (!(f.qty > 0)) return { err: 'Enter the quantity' };
  const dd = [{ loc: 'butchery', id: m.id, qty: f.qty }];
  const err = checkStock(s, dd);
  if (err) return { err };
  const day = dayStr();
  applyDeducts(s, dd, 1, day);
  const sides = f.sides.map((x) => { const sd = s.sides.find((y) => y.id === x.id); return { id: sd.id, name: sd.name, qty: x.qty, price: sd.price * x.qty, cost: (sd.cost || 0) * x.qty }; });
  const no = nextNo(s, 'special', day);
  const now = Date.now();
  const sp = {
    id: uid(), day, no, at: new Date(now).toISOString(), due: new Date(now + 60 * 60000).toISOString(),
    customer: (f.customer || '').trim(), phone: (f.phone || '').trim(),
    meatId: m.id, meat: m.name, unit: m.kind === 'bird' ? 'bird' : 'kg', qty: f.qty,
    style: (f.style || '').trim(), sides, instr: (f.instr || '').trim(), tableNo: f.tableNo || null,
    price: specialPrice(m, f.qty) + sum(sides, (x) => x.price),
    cost: r2(m.cost * f.qty + sum(sides, (x) => x.cost)),
    status: 'pending', paid: false, paidAmount: 0, cleared: false, by,
  };
  s.specials.push(sp);
  s.transfers.push({ id: uid(), day, at: sp.at, type: 'special', meatId: m.id, name: m.name, qty: f.qty, ref: sp.no, by });
  return { sp };
}
// Pay some or all of a special's price. amount === null pays in full. Each call issues its own
// sale/receipt (deposit, then balance later), so both the deposit and the final payment are on record.
function paySpecial(s, spId, pay, by, amount) {
  const sp = s.specials.find((x) => x.id === spId);
  if (!sp || sp.paid) return null;
  const due = r2(sp.price - (sp.paidAmount || 0));
  const amt = amount == null ? due : Math.min(r2(amount), due);
  if (!(amt > 0)) return null;
  const isFull = amt >= due - 0.5;
  const line = Object.assign({}, specialLine(sp), {
    name: (isFull && !sp.paidAmount ? '' : (sp.paidAmount ? 'Balance · ' : 'Deposit · ')) + specialLine(sp).name,
    total: amt, cost: r2(sp.cost * (amt / sp.price)),
  });
  const sale = createSale(s, { source: 'special', lines: [line], pay, cashier: by, tableNo: sp.tableNo, deduct: false, special: sp.id });
  sp.paidAmount = r2((sp.paidAmount || 0) + amt);
  sp.paid = sp.paidAmount >= sp.price - 0.5;
  sp.saleId = sale.id;
  return sale;
}

/* ---------------- table tabs (running bills) ---------------- */
function addToTab(s, no, line) {
  const err = checkStock(s, line.deduct || []);
  if (err) return { err };
  applyDeducts(s, line.deduct || [], 1, dayStr());
  const tab = s.tabs[no] || (s.tabs[no] = { lines: [], openedAt: new Date().toISOString() });
  tab.lines = addLineTo(tab.lines, line);
  return {};
}
function changeTabLine(s, no, key, delta) {
  const tab = s.tabs[no];
  if (!tab) return { err: 'Table is not open' };
  const l = tab.lines.find((x) => x.key === key);
  if (!l) return {};
  const newQty = l.kind === 'meat' ? 0 : r3(l.qty + delta);
  if (newQty <= 0) {
    applyDeducts(s, l.deduct || [], -1, dayStr());
    tab.lines = tab.lines.filter((x) => x.key !== key);
    return {};
  }
  if (delta > 0) {
    const unit = scaleLine(l, 1);
    const err = checkStock(s, (unit.deduct || []).map((d) => Object.assign({}, d, { qty: d.qty * delta })));
    if (err) return { err };
  }
  const nl = scaleLine(l, newQty);
  const diff = (l.deduct || []).map((d, i) => ({ loc: d.loc, id: d.id, qty: r3(nl.deduct[i].qty - d.qty) }));
  applyDeducts(s, diff, 1, dayStr());
  tab.lines = tab.lines.map((x) => (x.key === key ? nl : x));
  return {};
}
function tabLinked(s, no) { return s.specials.filter((x) => x.tableNo === no && !x.paid && !x.cleared); }
function tabTotal(s, no) {
  const tab = s.tabs[no];
  return sum(tab ? tab.lines : [], (l) => l.total) + sum(tabLinked(s, no), (x) => x.price);
}
function settleTab(s, no, pay, by) {
  const tab = s.tabs[no] || { lines: [] };
  const linked = tabLinked(s, no);
  const lines = tab.lines.concat(linked.map(specialLine));
  const sale = createSale(s, { source: 'table', lines, pay, cashier: by, tableNo: no, deduct: false });
  linked.forEach((sp) => { sp.paid = true; sp.paidAmount = sp.price; sp.saleId = sale.id; });
  delete s.tabs[no];
  return sale;
}

/* ---------------- consumables ---------------- */
function receiveCons(s, id, qty, totalCost, supplierId, method, by) {
  const c = consOf(s, id);
  const day = dayStr();
  ensureDay(s, day);
  if ((c.cat === 'drink' || c.cat === 'ingredient') && totalCost > 0) c.cost = r2((c.qty * c.cost + totalCost) / (c.qty + qty));
  c.qty = r3(c.qty + qty);
  consDay(s, day, id).received = r3(consDay(s, day, id).received + qty);
  s.purchases.push({ id: uid(), day, at: new Date().toISOString(), kind: 'cons', itemId: id, name: c.name, qty, total: totalCost, supplierId: supplierId || null, method: method || 'cash', by });
  if (supplierId && method === 'credit' && totalCost > 0) { const sup = s.suppliers.find((x) => x.id === supplierId); if (sup) sup.balance = r2(sup.balance + totalCost); }
}
function useCons(s, id, qty, by) {
  const c = consOf(s, id);
  if (qty > c.qty + 1e-9) return 'Only ' + r3(c.qty) + ' ' + c.unit + ' left';
  applyDeducts(s, [{ loc: 'cons', id, qty }], 1, dayStr());
  // Every manual issue is logged so it shows in the movement ledger. Only kitchen
  // ingredients carry a cost here: what the kitchen uses is part of the cost of the food.
  s.usage.push({ id: uid(), day: dayStr(), at: new Date().toISOString(), itemId: id, name: c.name, cat: c.cat, qty, unit: c.unit, cost: c.cat === 'ingredient' ? r2(qty * c.cost) : 0, by: by || '' });
  return null;
}
function recordClosing(s, id, counted, by) {
  const c = consOf(s, id);
  const day = dayStr();
  const cd = consDay(s, day, id);
  const variance = r3(counted - c.qty);
  if (variance < 0 && (c.cat === 'drink' || c.cat === 'ingredient') && c.cost > 0) {
    s.waste.push({ id: uid(), day, at: new Date().toISOString(), loc: 'cons', itemId: id, name: c.name, qty: -variance, unit: c.unit, reason: 'Stock count shortfall', cost: r2(-variance * c.cost), by });
  }
  cd.variance = r3(cd.variance + variance);
  cd.closing = counted;
  c.qty = counted;
}
const consLow = (s) => s.cons.filter((c) => c.active !== false && c.qty <= c.low);
const meatLow = (s) => s.meats.filter((m) => m.active !== false && m.stock <= m.low);

/* ---------------- suppliers ---------------- */
function addSupplier(s, name, phone) {
  const sup = { id: uid(), name: name.trim(), phone: (phone || '').trim(), balance: 0 };
  s.suppliers.push(sup);
  return sup;
}
function paySupplier(s, supplierId, amount, method, by) {
  const sup = s.suppliers.find((x) => x.id === supplierId);
  if (!sup) return 'Supplier not found';
  if (!(amount > 0)) return 'Enter an amount above zero';
  sup.balance = r2(sup.balance - amount);
  s.supplierPayments.push({ id: uid(), day: dayStr(), at: new Date().toISOString(), supplierId, name: sup.name, amount: r2(amount), method: method || 'Cash', by });
  logAudit(s, 'Supplier payment', sup.name + ' · ' + money(amount) + ' · ' + method, by);
  return null;
}

/* ---------------- employees, salaries & advances ---------------- */
function addEmployee(s, f) {
  const e = { id: uid(), name: f.name.trim(), role: (f.role || '').trim(), payType: f.payType, rate: num0(f.rate), active: true };
  s.employees.push(e);
  return e;
}
const num0 = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
function recordPayroll(s, f, by) {
  const e = s.employees.find((x) => x.id === f.employeeId);
  if (!e) return 'Pick an employee';
  if (!(f.amount > 0)) return 'Enter an amount above zero';
  s.payroll.push({ id: uid(), day: dayStr(), at: new Date().toISOString(), employeeId: e.id, name: e.name, type: f.type, amount: r2(f.amount), method: f.method || 'Cash', note: (f.note || '').trim(), by });
  logAudit(s, f.type === 'advance' ? 'Staff advance' : 'Salary payment', e.name + ' · ' + money(f.amount) + ' · ' + method_label(f.method), by);
  return null;
}
function method_label(m) { return m || 'Cash'; }

/* ---------------- cash reconciliation & bank deposits ---------------- */
function tillExpected(s, day, openingCash, openingMpesa) {
  // Sales money is counted on the day it was actually received (a credit sale paid
  // later lands on the day of payment), and voided sales never count.
  const received = [];
  s.sales.filter((x) => !x.voided).forEach((x) => salePayments(x).forEach((p) => { if (p.day === day) received.push(p); }));
  const cashIn = sum(received, (p) => p.cash || 0);
  const mpesaIn = sum(received, (p) => p.mpesa || 0);
  const out = (method) => ({
    purchases: sum(s.purchases.filter((x) => x.day === day && x.method === method), (x) => x.total || 0),
    expenses: sum(s.expenses.filter((x) => x.day === day && x.via === (method === 'cash' ? 'Cash' : 'M-Pesa')), (x) => x.amount || 0),
    supplier: sum(s.supplierPayments.filter((x) => x.day === day && x.method === (method === 'cash' ? 'Cash' : 'M-Pesa')), (x) => x.amount || 0),
    payroll: sum(s.payroll.filter((x) => x.day === day && x.method === (method === 'cash' ? 'Cash' : 'M-Pesa')), (x) => x.amount || 0),
  });
  const cOut = out('cash'), mOut = out('mpesa');
  const cashDeposits = sum(s.deposits.filter((x) => x.day === day && (x.method || 'cash') === 'cash'), (x) => x.amount || 0);
  const mpesaDeposits = sum(s.deposits.filter((x) => x.day === day && x.method === 'mpesa'), (x) => x.amount || 0);
  const cash = { salesIn: cashIn, purchasesOut: cOut.purchases, expensesOut: cOut.expenses, supplierOut: cOut.supplier, payrollOut: cOut.payroll, depositsOut: cashDeposits, expected: r2(openingCash + cashIn - cOut.purchases - cOut.expenses - cOut.supplier - cOut.payroll - cashDeposits) };
  const mpesa = { salesIn: mpesaIn, purchasesOut: mOut.purchases, expensesOut: mOut.expenses, supplierOut: mOut.supplier, payrollOut: mOut.payroll, depositsOut: mpesaDeposits, expected: r2((openingMpesa || 0) + mpesaIn - mOut.purchases - mOut.expenses - mOut.supplier - mOut.payroll - mpesaDeposits) };
  return { cash, mpesa };
}
function recordReconciliation(s, day, openingCash, countedCash, openingMpesa, countedMpesa, by) {
  const t = tillExpected(s, day, openingCash, openingMpesa);
  const r = {
    id: uid(), day, at: new Date().toISOString(), by,
    openingFloat: openingCash, expected: t.cash.expected, counted: countedCash, variance: r2(countedCash - t.cash.expected),
    openingMpesa: openingMpesa || 0, expectedMpesa: t.mpesa.expected, countedMpesa: countedMpesa === null || countedMpesa === undefined ? null : countedMpesa, varianceMpesa: countedMpesa === null || countedMpesa === undefined ? null : r2(countedMpesa - t.mpesa.expected),
  };
  s.reconciliations = s.reconciliations.filter((x) => x.day !== day);
  s.reconciliations.push(r);
  if (Math.abs(r.variance) > 0.5) logAudit(s, 'Cash count', dateNice(day) + ' · cash variance ' + money(r.variance), by);
  if (r.varianceMpesa !== null && Math.abs(r.varianceMpesa) > 0.5) logAudit(s, 'M-Pesa count', dateNice(day) + ' · M-Pesa variance ' + money(r.varianceMpesa), by);
  return r;
}
function recordDeposit(s, amount, ref, method, by) {
  if (!(amount > 0)) return 'Enter an amount above zero';
  s.deposits.push({ id: uid(), day: dayStr(), at: new Date().toISOString(), amount: r2(amount), method: method || 'cash', ref: (ref || '').trim(), by });
  logAudit(s, 'Bank deposit', money(amount) + ' · ' + (method === 'mpesa' ? 'M-Pesa' : 'Cash') + (ref ? ' · ' + ref : ''), by);
  return null;
}

/* ---------------- profit & loss (approximate) ---------------- */
function periodRange(p) {
  const t = new Date();
  const today = dayStr(t);
  const back = (n) => { const d = new Date(t); d.setDate(d.getDate() - n); return dayStr(d); };
  if (p === 'today') return [today, today];
  if (p === 'yesterday') return [back(1), back(1)];
  if (p === '7d') return [back(6), today];
  if (p === '30d') return [back(29), today];
  if (p === 'month') return [today.slice(0, 8) + '01', today];
  return [null, null];
}
const inRange = (day, from, to) => (!from || day >= from) && (!to || day <= to);
/* ---------------- central stock movement ledger ---------------- */
// Pulls together every stock-affecting event already recorded elsewhere —
// purchases, transfers, actual sale-line deductions, waste, and physical-count
// adjustments — into one chronological, filterable feed. Nothing here is
// re-derived or guessed: each row points back at the real record (a purchase,
// a transfer, a receipt, a waste entry) that caused it, so this can never
// drift out of sync with what Butchery/Kitchen/Consumables/Sales actually did.
const CAT_BUTCHERY = 'Meat · Butchery', CAT_READY = 'Meat · Ready-made', CAT_DRINKS = 'Drinks', CAT_INGREDIENT = 'Kitchen ingredients', CAT_SUPPLY = 'Consumables';
const consCat = (c) => (c && c.cat === 'drink' ? CAT_DRINKS : c && c.cat === 'ingredient' ? CAT_INGREDIENT : CAT_SUPPLY);
function movementLedger(s, from, to) {
  const rows = [];
  const push = (at, day, cat, item, dir, qty, unit, type, ref, by) => { if (inRange(day, from, to)) rows.push({ at, day, cat, item, dir, qty, unit, type, ref: ref || '', by: by || '' }); };

  s.purchases.forEach((p) => {
    if (p.kind === 'meat') push(p.at, p.day, CAT_BUTCHERY, p.name, 'in', p.qty, meatOf(s, p.itemId) && meatOf(s, p.itemId).kind === 'bird' ? 'bird' : 'kg', 'Purchase', p.supplierId ? (s.suppliers.find((x) => x.id === p.supplierId) || {}).name : '', p.by);
    else { const c = consOf(s, p.itemId); push(p.at, p.day, consCat(c), p.name, 'in', p.qty, c ? c.unit : 'pc', 'Purchase', p.supplierId ? (s.suppliers.find((x) => x.id === p.supplierId) || {}).name : '', p.by); }
  });
  s.transfers.forEach((t) => {
    const m = meatOf(s, t.meatId);
    if (t.type === 'special') push(t.at, t.day, CAT_BUTCHERY, t.name, 'out', t.qty, 'kg', 'Special order', t.ref ? '#' + t.ref : '', t.by);
    else {
      push(t.at, t.day, CAT_BUTCHERY, t.name, 'out', t.qty, 'kg', 'Transfer to kitchen', '', t.by);
      push(t.at, t.day, CAT_READY, t.name, 'in', t.portions || 0, 'portion', 'Transfer from butchery', '', t.by);
    }
  });
  s.sales.filter((x) => !x.voided).forEach((x) => {
    x.lines.forEach((l) => (l.deduct || []).forEach((d) => {
      if (d.loc === 'butchery') { const m = meatOf(s, d.id); if (m) push(x.at, x.day, CAT_BUTCHERY, m.name, 'out', d.qty, m.kind === 'bird' ? 'bird' : 'kg', 'Sale', receiptNo(x), x.cashier); }
      else if (d.loc === 'kitchen') { const m = meatOf(s, d.id); if (m) push(x.at, x.day, CAT_READY, m.name, 'out', d.qty, 'portion', 'Sale', receiptNo(x), x.cashier); }
      else if (d.loc === 'cons') { const c = consOf(s, d.id); if (c) push(x.at, x.day, consCat(c), c.name, 'out', d.qty, c.unit, 'Sale', receiptNo(x), x.cashier); }
    }));
  });
  (s.usage || []).forEach((u) => push(u.at, u.day, u.cat === 'drink' ? CAT_DRINKS : u.cat === 'ingredient' ? CAT_INGREDIENT : CAT_SUPPLY, u.name, 'out', u.qty, u.unit, u.cat === 'ingredient' ? 'Used in kitchen' : 'Issued for use', '', u.by));
  s.waste.forEach((w) => {
    const cat = w.loc === 'kitchen' ? CAT_READY : w.loc === 'cons' ? consCat(consOf(s, w.itemId)) : CAT_BUTCHERY;
    push(w.at, w.day, cat, w.name, 'out', w.qty, w.unit, w.reason === 'Stock count shortfall' ? 'Stock count' : 'Waste', w.reason, w.by);
  });
  Object.keys(s.consDays || {}).forEach((day) => {
    if (!inRange(day, from, to)) return;
    Object.keys(s.consDays[day]).forEach((id) => {
      const r = s.consDays[day][id]; const c = consOf(s, id);
      if (c && r.closing !== null && r.variance > 0) push(day + 'T12:00:00.000Z', day, consCat(c), c.name, 'in', r.variance, c.unit, 'Stock count', 'Physical count found extra', '');
    });
  });
  Object.keys(s.readyDays || {}).forEach((day) => {
    if (!inRange(day, from, to)) return;
    Object.keys(s.readyDays[day]).forEach((id) => {
      const r = s.readyDays[day][id]; const m = meatOf(s, id);
      if (m && r.closing !== null && r.variance > 0) push(day + 'T12:00:00.000Z', day, CAT_READY, m.name, 'in', r.variance, 'portion', 'Stock count', 'Physical count found extra', '');
    });
  });
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows;
}

function computePL(s, from, to) {
  const ch = {};
  CHANNELS.forEach((c) => { ch[c.id] = { rev: 0, cogs: 0 }; });
  const pay = { cash: 0, mpesa: 0, card: 0 };
  const items = {};
  let count = 0, unpaidOutstanding = 0;
  // Revenue is recognised on a cash basis, on the day money is received: a part-paid
  // or credit sale contributes only what has been collected so far, dated when it arrived.
  s.sales.filter((x) => !x.voided).forEach((x) => {
    if (inRange(x.day, from, to)) { count++; unpaidOutstanding += x.balance || 0; }
    salePayments(x).forEach((p) => {
      if (!inRange(p.day, from, to)) return;
      const ratio = x.total > 0 ? Math.min(1, p.amount / x.total) : 1;
      x.lines.forEach((l) => {
        const c = ch[l.ch] || ch.side;
        c.rev += l.total * ratio; c.cogs += (l.cost || 0) * ratio;
        items[l.name] = (items[l.name] || 0) + l.total * ratio;
      });
      pay.cash += p.cash || 0; pay.mpesa += p.mpesa || 0; pay.card += p.card || 0;
    });
  });
  const rev = sum(CHANNELS, (c) => ch[c.id].rev);
  const cogsSold = sum(CHANNELS, (c) => ch[c.id].cogs);
  const shrink = sum(s.waste.filter((w) => inRange(w.day, from, to)), (w) => w.cost || 0);
  const ingredients = sum((s.usage || []).filter((u) => u.cat === 'ingredient' && inRange(u.day, from, to)), (u) => u.cost || 0);
  const cogs = cogsSold + shrink + ingredients;
  const gross = rev - cogs;
  const byCat = {};
  s.expenses.filter((e) => inRange(e.day, from, to)).forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
  const staffCost = sum(s.payroll.filter((p) => inRange(p.day, from, to)), (p) => p.amount);
  if (staffCost) byCat['Salaries & advances'] = r2((byCat['Salaries & advances'] || 0) + staffCost);
  const opex = sum(Object.keys(byCat), (k) => byCat[k]);
  const net = gross - opex;
  return { ch, count, pay, items, rev: r2(rev), cogsSold: r2(cogsSold), shrink: r2(shrink), ingredients: r2(ingredients), cogs: r2(cogs), gross: r2(gross), gm: rev ? gross / rev : 0, byCat, opex, net, nm: rev ? net / rev : 0, unpaidOutstanding: r2(unpaidOutstanding) };
}


module.exports = { seed };
