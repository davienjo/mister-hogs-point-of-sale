// tests/operations.test.js — behaviour tests for the Operations workflow.
//
// Run from the server-project folder with:   node tests/operations.test.js
// Needs Node 22.5+ (same as the app). No npm install, no dependencies.
//
// These cover the restaurant flow: ready-made orders, special orders,
// deposits, balances, table settlement and daily order numbering.
'use strict';
const fs = require('fs');
const path = require('path');

// logic.js is browser code with no exports, so wrap it to expose what we test.
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'logic.js'), 'utf8');
const mod = path.join(__dirname, '.logic.tmp.js');
fs.writeFileSync(mod, src + `
module.exports = { seed, createSale, createSpecial, paySpecial, settleSaleBalance,
  settleTab, tabLinked, tabTotal, debtors, receiptNo, specialLine, r2 };`);
const L = require(mod);

const pass = [], fail = [];
const t = (n, c) => { (c ? pass : fail).push(n); console.log((c ? '  PASS  ' : '  FAIL  ') + n); };
const line = { key: 'k1', kind: 'meat', name: 'Beef ribs', label: '1 kg', qty: 1, unit: 'kg', total: 800, cost: 400, deduct: [{ loc: 'kitchen', id: 'beef', qty: 4 }] };
const openOrders = (s) => s.sales.filter((x) => x.source === 'ready' && !x.voided && x.status !== 'paid');

/* 1. Ready-made: order placed -> printable receipt, order stays open, unpaid */
let s = L.seed(); s.kitchen.beef = 20;
const sale = L.createSale(s, { source: 'ready', lines: [line], pay: null, cashier: 'Jane' });
t('order has a receipt number and day', !!sale.no && !!sale.day);
t('order total is 800', sale.total === 800);
t('order is created unpaid', sale.status === 'unpaid');
t('kitchen stock deducted 20 -> 16', s.kitchen.beef === 16);
t('order remains OPEN after placing', openOrders(s).length === 1);
t('receipt carries no payment method', sale.pay === null);

/* 2. Customer pays -> order closes */
const r = L.settleSaleBalance(s, sale.id, { method: 'cash', cash: 800 }, 'Jane');
t('payment accepted', !r.err && !!r.sale);
t('order is now paid', r.sale.status === 'paid');
t('order CLOSED after payment', openOrders(s).length === 0);

/* 3. Order numbers are sequential and reset each day */
let s2 = L.seed(); s2.meats[0].stock = 10;
const a = L.createSpecial(s2, { meatId: s2.meats[0].id, qty: 1, style: 'Chemsha', sides: [], instr: 'No pepper' }, 'Jane');
const b = L.createSpecial(s2, { meatId: s2.meats[0].id, qty: 1, style: 'Choma', sides: [], instr: '' }, 'Jane');
t('first special is #1', a.sp.no === 1);
t('second special is #2', b.sp.no === 2);
t('counter is keyed by day, so it resets daily',
  Object.keys(s2.counters.special).length === 1 && Object.keys(s2.counters.special)[0] === a.sp.day);

/* 4. Pay later: no sale record, so Debtors cannot double count */
t('pay-later special creates no sale record', s2.sales.length === 0);
t('pay-later special appears once in Debtors', L.debtors(s2).filter((x) => x.kind === 'special').length === 2);
t('no duplicate sale row in Debtors', L.debtors(s2).filter((x) => x.kind === 'sale').length === 0);

/* 5. Deposit, then balance */
let s3 = L.seed(); s3.meats[0].stock = 10;
const c = L.createSpecial(s3, { meatId: s3.meats[0].id, qty: 1, style: 'Chemsha', sides: [], instr: '' }, 'Jane');
const dep = L.paySpecial(s3, c.sp.id, { method: 'cash', cash: 500 }, 'Jane', 500);
t('deposit issues its own receipt', !!dep);
t('deposit recorded on the order', c.sp.paidAmount === 500);
t('order not yet fully paid', c.sp.paid === false);
t('order stays in Debtors with a balance', L.debtors(s3).some((x) => x.kind === 'special' && x.balance === c.sp.price - 500));
const fin = L.paySpecial(s3, c.sp.id, { method: 'mpesa', mpesa: c.sp.price - 500 }, 'Jane', null);
t('balance payment issues a second receipt', !!fin);
t('order is now fully paid', c.sp.paid === true);
t('order leaves Debtors once cleared', !L.debtors(s3).some((x) => x.kind === 'special'));
t('both payments are on record', s3.sales.length === 2);

/* 6. Table special: open until the table settles */
let s4 = L.seed(); s4.meats[0].stock = 10;
const d = L.createSpecial(s4, { meatId: s4.meats[0].id, qty: 1, style: 'Choma', sides: [], instr: 'Well done', tableNo: 3 }, 'Jane');
t('special is linked to its table', L.tabLinked(s4, 3).length === 1);
// A special belongs to a table now, but a special-only table never gets a tab, so
// there is no way to tell a live table order from one whose settlement was voided.
// Money owed is therefore always listed in Debtors — clearing it from there marks
// the order paid and settleTab then charges it as zero, so it is never counted twice.
t('a table special is listed in Debtors with its balance', L.debtors(s4).some((x) => x.kind === 'special' && x.id === d.sp.id && x.balance === d.sp.price));
t('and listed exactly once', L.debtors(s4).filter((x) => x.kind === 'special' && x.id === d.sp.id).length === 1);
t('a special-only table creates no tab of its own', !s4.tabs[3]);
t('table bill includes the special', L.tabTotal(s4, 3) === d.sp.price);
const ts = L.settleTab(s4, 3, { method: 'cash', cash: d.sp.price }, 'Jane');
t('settling the table pays the special', ts.status === 'paid');
t('table closes after settling', !s4.tabs[3]);

/* 7. A deposit on a TABLE special must never be charged twice */
let s5 = L.seed(); s5.meats[0].stock = 10;
const e = L.createSpecial(s5, { meatId: s5.meats[0].id, qty: 1, style: 'Tumbukiza', sides: [], instr: '', tableNo: 4 }, 'Jane');
const depT = L.paySpecial(s5, e.sp.id, { method: 'cash', cash: 500 }, 'Jane', 500);
t('deposit taken on a table special', !!depT && e.sp.paidAmount === 500);
t('table bill charges only the BALANCE, not the full price', L.tabTotal(s5, 4) === e.sp.price - 500);
const st = L.settleTab(s5, 4, { method: 'cash', cash: e.sp.price - 500 }, 'Jane');
t('settlement charges only the balance', st.total === e.sp.price - 500);
t('deposit + balance = the order price exactly', depT.total + st.total === e.sp.price);
t('special is fully paid after settling', e.sp.paid === true);
t('table closes after settling', !s5.tabs[4]);
t('the balance line is labelled as a balance', st.lines.some((l) => l.name.indexOf('Balance ·') === 0));

/* 8. A special paid in full at order time never reaches the table bill */
let s6 = L.seed(); s6.meats[0].stock = 10;
const f = L.createSpecial(s6, { meatId: s6.meats[0].id, qty: 1, style: 'Choma', sides: [], instr: '', tableNo: 6 }, 'Jane');
L.paySpecial(s6, f.sp.id, { method: 'mpesa', mpesa: f.sp.price }, 'Jane', null);
t('fully paid special is not linked to the table', L.tabLinked(s6, 6).length === 0);
t('table bill is therefore zero', L.tabTotal(s6, 6) === 0);

fs.unlinkSync(mod);
console.log('\n' + pass.length + ' passed, ' + fail.length + ' failed');
if (fail.length) { console.log('FAILED:'); fail.forEach((f) => console.log('  - ' + f)); process.exit(1); }
