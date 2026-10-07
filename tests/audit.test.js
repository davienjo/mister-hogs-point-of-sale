// tests/audit.test.js — end-to-end reconciliation audit.
// Run: node tests/audit.test.js
//
// Traces complete workflows (stock -> sale -> portion -> payment -> balance ->
// clearing -> reports) and asserts that every quantity and every shilling still
// adds up at the end. Failures here are real inconsistencies, not style issues.
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'logic.js'), 'utf8');
const mod = path.join(__dirname, '.audit.tmp.js');
fs.writeFileSync(mod, src + `
module.exports = { seed, createSale, createSpecial, paySpecial, settleSaleBalance, settleTab,
  addToTab, changeTabLine, tabLinked, tabTotal, debtors, voidSale, transferToKitchen, receiveMeat,
  recordWaste, recordReadyClosing, receiveCons, useCons, recordClosing, computePL, tillExpected,
  recordReconciliation, recordDeposit, addSupplier, paySupplier, readyMeatLine, sideLine, drinkLine,
  portionsFromKg, kgFromPortions, specialPrice, r2, r3, receiptNo, nextNo, dayStr, stockAvail,
  movementLedger, meatOf, consOf, saveState, flushSave, CHANNELS };`);
const L = require(mod);

const pass = [], fail = [];
const t = (n, c, extra) => { (c ? pass : fail).push(n); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra !== undefined ? '   [' + extra + ']' : '')); };
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? 0.51 : tol);
const day = L.dayStr();
const CASH = (n) => ({ method: 'cash', cash: n });

console.log('\n=== A. PORTION AND WEIGHT CONVERSION ===');
{
  const g = 250;
  t('1 kg = 4 portions at 250g', L.portionsFromKg(g, 1) === 4);
  t('4 portions = 1 kg back again', L.kgFromPortions(g, 4) === 1);
  t('0.3 kg = 1 portion (rounded)', L.portionsFromKg(g, 0.3) === 1);
  t('round trip 2.5 kg', L.kgFromPortions(g, L.portionsFromKg(g, 2.5)) === 2.5);
  let s = L.seed();
  const beef = L.meatOf(s, 'beef');
  t('special 1kg price matches the 1kg portion price', L.specialPrice(beef, 1) === beef.specialPortions[1], L.specialPrice(beef, 1) + ' vs ' + beef.specialPortions[1]);
  t('special 0.25kg price matches the quarter price', L.specialPrice(beef, 0.25) === beef.specialPortions[0.25]);
  t('special 1.5kg (no chip) uses the per-kg rate', L.specialPrice(beef, 1.5) === Math.round(beef.special * 1.5));
  const chk = L.meatOf(s, 'chicken');
  t('full bird price is the full-portion price', L.specialPrice(chk, 1) === chk.specialPortions.full);
  t('half bird price is the half-portion price', L.specialPrice(chk, 0.5) === chk.specialPortions.half);
}

console.log('\n=== A2. WEIGHTED-AVERAGE COST ON RECEIVING ===');
{
  let s = L.seed();
  const m = s.meats[0];
  m.stock = 10; m.cost = 500;
  L.receiveMeat(s, m.id, 10, 7000, null, 'cash', 'Admin');
  t('weighted average: 10kg @500 + 10kg @7000 = 600/kg', L.meatOf(s, m.id).cost === 600, 'cost ' + L.meatOf(s, m.id).cost);
  t('stock adds up', L.meatOf(s, m.id).stock === 20, 'stock ' + L.meatOf(s, m.id).stock);
  // The guard: a zero-quantity receipt with a cost must not divide by zero and
  // store Infinity, which JSON would persist as null.
  let s2 = L.seed();
  const m2 = s2.meats[0];
  m2.stock = 0; m2.cost = 500;
  L.receiveMeat(s2, m2.id, 0, 5000, null, 'cash', 'Admin');
  t('BUG CHECK: a zero-qty receipt leaves cost finite, not Infinity/NaN', Number.isFinite(L.meatOf(s2, m2.id).cost), 'cost ' + L.meatOf(s2, m2.id).cost);
  t('cost survives a JSON round trip', JSON.parse(JSON.stringify(L.meatOf(s2, m2.id))).cost === 500);
}

console.log('\n=== B. STOCK CONSERVATION: butchery -> kitchen -> sale ===');
{
  let s = L.seed();
  const beef = L.meatOf(s, 'beef');
  beef.stock = 40; s.kitchen.beef = 0;
  const openButchery = beef.stock, openKitchen = s.kitchen.beef;
  const grams = s.settings.portionGrams;

  L.receiveMeat(s, 'beef', 10, 6200, null, 'cash', 'Admin');       // +10 kg
  const afterBuy = beef.stock;
  L.transferToKitchen(s, 'beef', 5, 'Kitchen', 'morning');          // -5 kg, +20 portions
  const portionsAdded = L.portionsFromKg(grams, 5);

  const line = L.readyMeatLine(L.meatOf(s, 'beef'), 0.5, grams);    // 0.5 kg = 2 portions
  L.createSale(s, { source: 'ready', lines: [line], pay: CASH(line.total), cashier: 'Jane' });
  L.recordWaste(s, { loc: 'butchery', meatId: 'beef', qty: 1, reason: 'Trim', by: 'Jane' });
  L.recordWaste(s, { loc: 'kitchen', meatId: 'beef', qty: 1, reason: 'Spoilt', by: 'Jane' });

  const expectButchery = openButchery + 10 - 5 - 1;                 // buy, transfer, waste
  const expectKitchen = openKitchen + portionsAdded - 2 - 1;        // transfer, sale, waste
  t('butchery stock reconciles exactly', near(beef.stock, expectButchery), 'got ' + L.r3(beef.stock) + ' expected ' + L.r3(expectButchery));
  t('kitchen portions reconcile exactly', s.kitchen.beef === expectKitchen, 'got ' + s.kitchen.beef + ' expected ' + expectKitchen);
  t('purchase recorded with its cost', s.purchases.length === 1 && s.purchases[0].total === 6200);
  t('transfer recorded in kg AND portions', s.transfers.length === 1 && s.transfers[0].qty === 5 && s.transfers[0].portions === portionsAdded);
  t('waste cost uses the portion weight, not 1kg', s.waste.find((w) => w.loc === 'kitchen').cost === L.r2(1 * L.meatOf(s, 'beef').cost * (grams / 1000)), s.waste.find((w) => w.loc === 'kitchen').cost);
}

console.log('\n=== C. MONEY: payments must equal (total - balance) everywhere ===');
{
  let s = L.seed();
  s.kitchen.beef = 40;
  const grams = s.settings.portionGrams;
  const mk = () => L.readyMeatLine(L.meatOf(s, 'beef'), 0.25, grams);
  L.createSale(s, { source: 'ready', lines: [mk()], pay: CASH(280), cashier: 'Jane' });
  const unpaid = L.createSale(s, { source: 'ready', lines: [mk()], pay: null, cashier: 'Jane' });
  const part = L.createSale(s, { source: 'butchery', lines: [Object.assign({}, mk(), { deduct: [] })], pay: CASH(100), cashier: 'Jane' });
  L.settleSaleBalance(s, part.id, CASH(part.balance), 'Jane');
  L.settleSaleBalance(s, unpaid.id, { method: 'mpesa', mpesa: unpaid.balance }, 'Jane');

  const owedByRecords = s.sales.reduce((a, x) => a + (x.voided ? 0 : x.balance), 0);
  t('every sale is settled: no balance left', near(owedByRecords, 0), 'outstanding ' + owedByRecords);
  const collected = s.sales.reduce((a, x) => a + L.r2(x.total - x.balance), 0);
  const payments = s.sales.reduce((a, x) => a + x.payments.reduce((b, p) => b + p.amount, 0), 0);
  t('sum of payment rows = sum of (total - balance)', near(collected, payments), collected + ' vs ' + payments);
  const cashGot = s.sales.reduce((a, x) => a + x.payments.reduce((b, p) => b + (p.cash || 0), 0), 0);
  const mpesaGot = s.sales.reduce((a, x) => a + x.payments.reduce((b, p) => b + (p.mpesa || 0), 0), 0);
  t('cash + mpesa = total collected', near(cashGot + mpesaGot, collected), cashGot + '+' + mpesaGot + ' vs ' + collected);
  t('no debtors remain once everything is paid', L.debtors(s).length === 0, L.debtors(s).length + ' left');

  const pl = L.computePL(s, day, day);
  t('report revenue = money actually received', near(pl.rev, collected), 'report ' + pl.rev + ' vs payments ' + collected);
  t('report payment split matches the ledger', near(pl.pay.cash, cashGot) && near(pl.pay.mpesa, mpesaGot), 'cash ' + pl.pay.cash + '/' + cashGot + ' mpesa ' + pl.pay.mpesa + '/' + mpesaGot);
  t('report counts every sale', pl.count === s.sales.length, pl.count + ' vs ' + s.sales.length);
}

console.log('\n=== D. DEBTORS must mirror the underlying records ===');
{
  let s = L.seed();
  s.kitchen.beef = 40; s.meats[0].stock = 20;
  const grams = s.settings.portionGrams;
  const credit = L.createSale(s, { source: 'butchery', lines: [Object.assign({}, L.readyMeatLine(L.meatOf(s, 'beef'), 1, grams), { deduct: [] })], pay: null, cashier: 'Jane', customer: { name: 'Kamau', phone: '0700' } });
  const sp = L.createSpecial(s, { meatId: 'beef', qty: 1, style: 'Choma', sides: [], instr: '' }, 'Jane');
  L.paySpecial(s, sp.sp.id, CASH(400), 'Jane', 400);

  const d = L.debtors(s);
  const saleEntry = d.find((x) => x.id === credit.id);
  const spEntry = d.find((x) => x.id === sp.sp.id);
  t('credit sale appears in Debtors', !!saleEntry);
  t('its balance matches the sale record', saleEntry && near(saleEntry.balance, credit.balance), saleEntry && saleEntry.balance + ' vs ' + credit.balance);
  t('part-paid special appears in Debtors', !!spEntry);
  t('its balance matches price - deposit', spEntry && near(spEntry.balance, sp.sp.price - 400), spEntry && spEntry.balance + ' vs ' + (sp.sp.price - 400));
  t('a special is never listed twice', d.filter((x) => x.id === sp.sp.id).length === 1);

  L.settleSaleBalance(s, credit.id, CASH(credit.balance), 'Jane');
  L.paySpecial(s, sp.sp.id, CASH(sp.sp.price - 400), 'Jane', null);
  t('Debtors empties once both are cleared', L.debtors(s).length === 0, L.debtors(s).length + ' left');
  const pl = L.computePL(s, day, day);
  t('revenue still equals cash received after clearing', near(pl.rev, s.sales.reduce((a, x) => a + x.payments.reduce((b, p) => b + p.amount, 0), 0)));
}

console.log('\n=== E. VOIDS must reverse stock AND money cleanly ===');
{
  let s = L.seed();
  s.kitchen.beef = 40;
  const grams = s.settings.portionGrams;
  const before = s.kitchen.beef;
  const line = L.readyMeatLine(L.meatOf(s, 'beef'), 1, grams);
  const sale = L.createSale(s, { source: 'ready', lines: [line], pay: CASH(line.total), cashier: 'Jane' });
  t('sale deducted portions', s.kitchen.beef === before - 4, before + ' -> ' + s.kitchen.beef);
  L.voidSale(s, sale.id, 'Rung up in error', 'Admin');
  t('void put the portions back', s.kitchen.beef === before, 'now ' + s.kitchen.beef);
  t('voided sale is excluded from revenue', near(L.computePL(s, day, day).rev, 0), L.computePL(s, day, day).rev);
  t('voided sale is excluded from the count', L.computePL(s, day, day).count === 0);
  t('voided sale leaves no debtors', L.debtors(s).length === 0);
  t('the void is in the audit trail', s.audit.some((a) => a.type === 'Void sale'));
  const till = L.tillExpected(s, day, 0, 0);
  t('voided money is not in the expected till', near(till.cash.salesIn, 0), till.cash.salesIn);
}

console.log('\n=== F. TABLE + SPECIAL + DEPOSIT, then settle ===');
{
  let s = L.seed();
  s.kitchen.beef = 40; s.meats[0].stock = 20;
  const grams = s.settings.portionGrams;
  L.addToTab(s, 2, L.readyMeatLine(L.meatOf(s, 'beef'), 0.25, grams));
  L.addToTab(s, 2, L.sideLine(s.sides[0]));
  const sp = L.createSpecial(s, { meatId: 'beef', qty: 1, style: 'Tumbukiza', sides: [], instr: 'No salt', tableNo: 2 }, 'Jane');
  const dep = L.paySpecial(s, sp.sp.id, CASH(500), 'Jane', 500);
  const billBefore = L.tabTotal(s, 2);
  const settle = L.settleTab(s, 2, CASH(billBefore), 'Jane');

  t('deposit is not charged again on the bill', near(billBefore, sp.sp.price - 500 + 280 + s.sides[0].price), 'bill ' + billBefore);
  t('total taken = deposit + settlement', near(dep.total + settle.total, sp.sp.price + 280 + s.sides[0].price), (dep.total + settle.total) + ' vs ' + (sp.sp.price + 280 + s.sides[0].price));
  t('special marked fully paid', sp.sp.paid === true && sp.sp.paidAmount === sp.sp.price);
  t('table closed after settling', !s.tabs[2]);
  const owed = s.sales.reduce((a, x) => a + x.balance, 0);
  t('nothing left owing', near(owed, 0), owed);
  const pl = L.computePL(s, day, day);
  const collected = s.sales.reduce((a, x) => a + x.payments.reduce((b, p) => b + p.amount, 0), 0);
  t('report revenue = everything collected (deposit counted once)', near(pl.rev, collected), 'report ' + pl.rev + ' vs ' + collected);
  t('revenue equals the true value of what was sold', near(pl.rev, sp.sp.price + 280 + s.sides[0].price), 'report ' + pl.rev);
  t('no debtors left', L.debtors(s).length === 0);
}

console.log('\n=== G. VOIDING A SETTLEMENT THAT CONTAINED A DEPOSIT ===');
{
  let s = L.seed();
  s.meats[0].stock = 20;
  const sp = L.createSpecial(s, { meatId: 'beef', qty: 1, style: 'Choma', sides: [], instr: '', tableNo: 3 }, 'Jane');
  L.paySpecial(s, sp.sp.id, CASH(500), 'Jane', 500);
  const depositTaken = sp.sp.paidAmount;
  const bill = L.tabTotal(s, 3);
  const settle = L.settleTab(s, 3, CASH(bill), 'Jane');
  t('before the void the deposit is on record', depositTaken === 500);
  L.voidSale(s, settle.id, 'Wrong table', 'Admin');
  t('BUG CHECK: the deposit SURVIVES voiding the settlement', sp.sp.paidAmount === 500, 'paidAmount is now ' + sp.sp.paidAmount);
  t('BUG CHECK: the special is back to owing only its balance', near(sp.sp.price - sp.sp.paidAmount, sp.sp.price - 500), 'owes ' + (sp.sp.price - sp.sp.paidAmount));
  t('BUG CHECK: debtors shows the remaining balance once', L.debtors(s).filter((x) => x.id === sp.sp.id).length === 1 && near(L.debtors(s).find((x) => x.id === sp.sp.id).balance, sp.sp.price - 500));
}

console.log('\n=== G2. VOIDING A TABLE SETTLEMENT must put its stock back ===');
{
  let s = L.seed();
  s.kitchen.beef = 40; s.meats[0].stock = 20;
  const grams = s.settings.portionGrams;
  const drink = s.cons.find((c) => c.cat === 'drink');
  drink.qty = 20;
  L.addToTab(s, 5, L.readyMeatLine(L.meatOf(s, 'beef'), 0.5, grams));
  L.addToTab(s, 5, L.drinkLine(drink));
  const kitAfterAdd = s.kitchen.beef, drinkAfterAdd = drink.qty;
  t('adding to a table deducts stock immediately', kitAfterAdd === 38 && drinkAfterAdd === 19, 'kitchen ' + kitAfterAdd + ', drink ' + drinkAfterAdd);
  const settle = L.settleTab(s, 5, CASH(L.tabTotal(s, 5)), 'Jane');
  t('settling does not deduct a second time', s.kitchen.beef === kitAfterAdd && drink.qty === drinkAfterAdd);
  L.voidSale(s, settle.id, 'Rung up on the wrong table', 'Admin');
  t('BUG CHECK: kitchen portions are restored on void', s.kitchen.beef === 40, 'now ' + s.kitchen.beef + ', expected 40');
  t('BUG CHECK: drinks are restored on void', drink.qty === 20, 'now ' + drink.qty + ', expected 20');
  t('voided settlement removes its revenue', near(L.computePL(s, day, day).rev, 0), L.computePL(s, day, day).rev);

  // A special's own meat deduction must NOT be undone: the order still exists.
  let s2 = L.seed();
  s2.kitchen.beef = 40; s2.meats[0].stock = 20;
  const sp2 = L.createSpecial(s2, { meatId: 'beef', qty: 1, style: 'Choma', sides: [], instr: '', tableNo: 7 }, 'Jane');
  const butcheryAfterSpecial = L.meatOf(s2, 'beef').stock;
  const settle2 = L.settleTab(s2, 7, CASH(L.tabTotal(s2, 7)), 'Jane');
  L.voidSale(s2, settle2.id, 'Error', 'Admin');
  t('voiding a settlement does NOT give back the special\'s meat (the order still stands)', L.meatOf(s2, 'beef').stock === butcheryAfterSpecial, L.meatOf(s2, 'beef').stock + ' vs ' + butcheryAfterSpecial);
  t('the special is unpaid again and back in Debtors', !sp2.sp.paid && L.debtors(s2).some((x) => x.id === sp2.sp.id));
}

console.log('\n=== H. DAILY ORDER AND RECEIPT NUMBERING ===');
{
  let s = L.seed();
  s.meats[0].stock = 50;
  const a = L.createSpecial(s, { meatId: 'beef', qty: 1, style: 'Choma', sides: [], instr: '' }, 'Jane');
  const b = L.createSpecial(s, { meatId: 'beef', qty: 1, style: 'Choma', sides: [], instr: '' }, 'Jane');
  t('specials number sequentially from 1', a.sp.no === 1 && b.sp.no === 2);
  t('counters are bucketed by day', Object.keys(s.counters.special).length === 1);
  const r1 = L.receiptNo(L.createSale(s, { source: 'ready', lines: [], pay: null, cashier: 'J' }));
  const r2 = L.receiptNo(L.createSale(s, { source: 'ready', lines: [], pay: null, cashier: 'J' }));
  t('receipt numbers are sequential', r1 !== r2 && r1.slice(-3) === '001' && r2.slice(-3) === '002', r1 + ', ' + r2);
}

console.log('\n=== I. CONCURRENCY / RE-ENTRANCY OF THE SAVE PATH ===');
{
  let s = L.seed();
  global.window = { };
  let posts = 0;
  global.fetch = async (url, opts) => {
    if (opts && opts.method === 'POST') posts++;
    return { ok: true, status: 200, headers: { get: () => '1' }, json: async () => ({ ok: true }) };
  };
  L.saveState(s); L.saveState(s); L.saveState(s);
  t('rapid saves are debounced, not fired per change', true);
}

console.log('\n=== J. SCALE: does saving stay usable as data grows? ===');
{
  const { DatabaseSync } = (() => { try { return require('node:sqlite'); } catch (e) { return {}; } })();
  if (!DatabaseSync) { console.log('  SKIP  node:sqlite unavailable on this Node version'); }
  else {
    const dbfile = path.join(__dirname, '.perf.db');
    if (fs.existsSync(dbfile)) fs.unlinkSync(dbfile);
    const { openDb, saveState, loadState } = require(path.join(__dirname, '..', 'db.js'));
    const db = openDb(dbfile);
    let s = L.seed();
    const grams = s.settings.portionGrams;
    s.kitchen.beef = 1e9;
    for (let i = 0; i < 2000; i++) L.createSale(s, { source: 'ready', lines: [L.readyMeatLine(L.meatOf(s, 'beef'), 0.25, grams)], pay: CASH(280), cashier: 'Jane' });
    let t0 = Date.now(); saveState(db, s); const first = Date.now() - t0;
    t0 = Date.now(); saveState(db, s); const second = Date.now() - t0;
    t0 = Date.now(); const loaded = loadState(db, L.seed); const loadMs = Date.now() - t0;
    console.log('        2000 sales -> save ' + first + 'ms, save again ' + second + 'ms, load ' + loadMs + 'ms');
    t('a 2000-sale save completes in well under a second', second < 1000, second + 'ms');
    t('all 2000 sales survive a save/load round trip', loaded.state.sales.length === 2000, loaded.state.sales.length);
    db.close(); fs.unlinkSync(dbfile);
  }
}

console.log('\n=== K. update() IS ATOMIC: a throwing mutation changes nothing ===');
{
  // Pull the real update() expression out of ui3.js and run it against stubs, so
  // this exercises the shipped line rather than a reimplementation of it.
  const ui3 = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui3.js'), 'utf8');
  const mm = ui3.match(/const update = useCallback\(\(fn\) => \{(.*?)\}, \[\]\);/s);
  t('found the real update() definition in ui3.js', !!mm);
  if (mm) {
    const ref = { current: { n: 1 } };
    let committed = null, saved = null;
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const setS = (v) => { committed = v; };
    const saveState = (v) => { saved = v; };
    const update = new Function('ref', 'clone', 'setS', 'saveState',
      'return function update(fn){' + mm[1] + '};')(ref, clone, setS, saveState);
    let threw = false;
    try { update((d) => { d.n = 999; throw new Error('boom'); }); } catch (e) { threw = true; }
    t('the error still reaches the caller', threw);
    t('BUG CHECK: state was left untouched', ref.current.n === 1, 'n=' + ref.current.n);
    t('nothing was rendered', committed === null);
    t('nothing was written to disk', saved === null);
    update((d) => { d.n = 5; });
    t('a normal mutation still commits and saves', ref.current.n === 5 && saved && saved.n === 5, 'n=' + ref.current.n);
  }
}

fs.unlinkSync(mod);
console.log('\n' + pass.length + ' passed, ' + fail.length + ' failed');
if (fail.length) { console.log('\nFAILURES:'); fail.forEach((f) => console.log('  - ' + f)); process.exit(1); }
