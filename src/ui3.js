/* =====================================================================
   UI — Part 3: Consumables · Sales · Expenses · Dashboard · Settings · App
   ===================================================================== */
const ymOf = (day) => day.slice(0, 7);
const monthRange = (ym) => { const p = ym.split('-').map(Number); return [ym + '-01', ym + '-' + pad(new Date(p[0], p[1], 0).getDate())]; };
const shiftMonth = (ym, d) => { const p = ym.split('-').map(Number); const t = new Date(p[0], p[1] - 1 + d, 1); return t.getFullYear() + '-' + pad(t.getMonth() + 1); };
const monthLabel = (ym) => { const p = ym.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); };
const monthShort = (ym) => { const p = ym.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'short' }); };

function MonthPicker({ value, onChange }) {
  const cur = ymOf(dayStr());
  return html`<div className="row">
    <button className="btn ghost sm" onClick=${() => onChange(shiftMonth(value, -1))} aria-label="Previous month">‹</button>
    <b style=${{ minWidth: '150px', textAlign: 'center' }}>${monthLabel(value)}</b>
    <button className="btn ghost sm" disabled=${value >= cur} onClick=${() => onChange(shiftMonth(value, 1))} aria-label="Next month">›</button>
    ${value !== cur ? html`<button className="btn soft sm" onClick=${() => onChange(cur)}>This month</button>` : null}
  </div>`;
}

/* ---------------- CONSUMABLES ---------------- */
function ConsItemModal({ item, fixedCat, onClose }) {
  const { update, notify } = useApp();
  const [name, setName] = useState(item ? item.name : '');
  const [cat, setCat] = useState(item ? item.cat : fixedCat || 'supply');
  const [unit, setUnit] = useState(item ? item.unit : 'pc');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [cost, setCost] = useState(item ? String(item.cost) : '');
  const [low, setLow] = useState(item ? String(item.low) : '3');
  const [qty, setQty] = useState('0');
  const go = () => {
    if (!name.trim()) { notify('Enter a name', 'err'); return; }
    update((d) => {
      if (item) {
        const c = consOf(d, item.id);
        c.name = name.trim(); c.cat = cat; c.unit = unit.trim() || 'pc'; c.price = num(price); c.cost = num(cost); c.low = num(low);
      } else {
        const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 14) + '-' + uid().slice(0, 3);
        d.cons.push({ id, name: name.trim(), cat, unit: unit.trim() || 'pc', price: cat === 'drink' ? num(price) : 0, cost: cat === 'drink' || cat === 'ingredient' ? num(cost) : 0, qty: num(qty), low: num(low), active: true });
        ensureDay(d, dayStr());
        d.consDays[dayStr()][id] = { opening: num(qty), received: 0, used: 0, closing: null, variance: 0 };
      }
    });
    notify(item ? 'Item updated' : 'Item added');
    onClose();
  };
  return html`<${Modal} title=${item ? 'Edit ' + item.name : fixedCat === 'drink' ? 'Add a drink' : fixedCat === 'ingredient' ? 'Add a kitchen ingredient' : 'Add a consumable'} onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn" onClick=${go}>${item ? 'Save changes' : 'Add item'}</button>`}>
    <div className="col">
      <${Field} label="Name"><input className="inp" value=${name} onChange=${(e) => setName(e.target.value)} autoFocus /><//>
      <div className="fgrid">
        ${fixedCat ? null : html`<${Field} label="Type"><select className="inp" value=${cat} onChange=${(e) => setCat(e.target.value)}><option value="supply">Consumable (serviettes, straws, takeaway…)</option><option value="ingredient">Kitchen ingredient (maize flour, oil…)</option><option value="drink">Drink (sold to customers)</option></select><//>`}
        <${Field} label="Unit"><input className="inp" value=${unit} onChange=${(e) => setUnit(e.target.value)} placeholder="bottle, bag, litre" /><//>
        <${Field} label="Low-stock alert at" sub="Alert when the amount left is at or below this"><input className="inp num" type="number" value=${low} onChange=${(e) => setLow(e.target.value)} /><//>
        ${item ? null : html`<${Field} label="Amount in stock now"><input className="inp num" type="number" value=${qty} onChange=${(e) => setQty(e.target.value)} /><//>`}
      </div>
      ${cat === 'drink' || cat === 'ingredient' ? html`<div className="fgrid">
        ${cat === 'drink' ? html`<${Field} label=${'Selling price (' + CUR + ')'}><input className="inp num" type="number" value=${price} onChange=${(e) => setPrice(e.target.value)} /><//>` : null}
        <${Field} label=${'Buying cost per ' + (unit || 'unit') + ' (' + CUR + ')'} sub="Used for profit figures"><input className="inp num" type="number" value=${cost} onChange=${(e) => setCost(e.target.value)} /><//>
      </div>` : null}
    </div>
  <//>`;
}

function ConsMoveModal({ type, item, onClose }) {
  const { s, update, notify, user } = useApp();
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [method, setMethod] = useState('cash');
  const go = () => {
    const q = num(qty);
    if (!(q > 0)) { notify('Enter a quantity above zero', 'err'); return; }
    let err = null;
    update((d) => { if (type === 'receive') receiveCons(d, item.id, q, num(cost), supplierId || null, supplierId ? method : 'cash', user.name); else err = useCons(d, item.id, q, user.name); });
    if (err) { notify(err, 'err'); return; }
    notify(type === 'receive' ? 'Stock added' : 'Usage recorded');
    onClose();
  };
  return html`<${Modal} title=${(type === 'receive' ? 'Receive · ' : 'Use / issue · ') + item.name} onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn" onClick=${go}>${type === 'receive' ? 'Add to stock' : 'Record usage'}</button>`}>
    <div className="col">
      <${Field} label=${'Quantity (' + item.unit + ')'} sub=${'Now in stock: ' + r3(item.qty)}><input className="inp num" type="number" inputMode="decimal" step="any" value=${qty} onChange=${(e) => setQty(e.target.value)} autoFocus /><//>
      ${type === 'receive' && (item.cat === 'drink' || item.cat === 'ingredient') ? html`
        <${Field} label=${'Total amount paid (' + CUR + ')'} sub="Updates the average buying cost used in profit figures"><input className="inp num" type="number" value=${cost} onChange=${(e) => setCost(e.target.value)} /><//>
        <${Field} label="Supplier (optional)"><select className="inp" value=${supplierId} onChange=${(e) => setSupplierId(e.target.value)}><option value="">No supplier on file</option>${s.suppliers.map((x) => html`<option key=${x.id} value=${x.id}>${x.name}</option>`)}</select><//>
        ${supplierId ? html`<${Field} label="How is this being paid?"><select className="inp" value=${method} onChange=${(e) => setMethod(e.target.value)}><option value="cash">Paid now · cash</option><option value="mpesa">Paid now · M-Pesa</option><option value="credit">On credit · added to supplier balance</option></select><//>` : null}` : null}
      ${type === 'receive' && item.cat === 'supply' ? html`<p className="hint">Record what you paid for consumables under Expenses so it counts in monthly profit.</p>` : null}
      ${type === 'use' && item.cat === 'ingredient' ? html`<p className="hint">What the kitchen uses is counted as part of the cost of the food.</p>` : null}
    </div>
  <//>`;
}

function ReadyStockPanel() {
  const { s, update, notify, user } = useApp();
  const [counts, setCounts] = useState({});
  const [modal, setModal] = useState(null);
  const day = dayStr();
  const grams = s.settings.portionGrams || 250;
  const rm = readyMeats(s);
  const low = readyLowMeats(s);
  const dayData = s.readyDays[day] || {};
  const rec = (m) => dayData[m.id] || { opening: s.kitchen[m.id] || 0, received: 0, used: 0, closing: null, variance: 0 };
  const saveCount = (m) => {
    const v = counts[m.id];
    if (v === undefined || v === '' || isNaN(parseInt(v, 10)) || parseInt(v, 10) < 0) { notify('Enter the counted number of portions', 'err'); return; }
    update((d) => recordReadyClosing(d, m.id, parseInt(v, 10), user.name));
    setCounts((o) => { const n = Object.assign({}, o); delete n[m.id]; return n; });
    notify('Closing count recorded for ' + m.name);
  };
  const modalMeat = modal && modal.id ? meatOf(s, modal.id) : null;
  return html`<div>
    <p className="hint">Meat transferred from the butchery is converted into whole ${grams}g portions. Count what's actually left at closing time to catch any difference — a shortfall is written off as waste automatically.</p>
    ${low.length ? html`<div className="alert mb"><span>⚠️</span><div><b>Low ready-made stock:</b> ${low.map((m) => m.name + ' (' + portionsLabel(grams, s.kitchen[m.id] || 0) + ')').join(' · ')}</div></div>` : null}
    ${rm.length ? html`<div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Meat</th><th className="r">Opening</th><th className="r">Received</th><th className="r">Sold / used</th><th className="r">Balance now</th><th>Closing count</th><th className="r">Variance</th><th>Status</th><th></th></tr></thead>
      <tbody>${rm.map((m) => {
        const r = rec(m);
        const bal = s.kitchen[m.id] || 0;
        const isLow = bal <= (m.readyLow || 0);
        return html`<tr key=${m.id}>
          <td><b>${m.emoji} ${m.name}</b></td>
          <td className="r">${r.opening}</td><td className="r">${r.received}</td><td className="r">${r.used}</td>
          <td className="r num-strong">${portionsLabel(grams, bal)}</td>
          <td><div className="row"><input className="inp num" style=${{ width: '76px' }} type="number" step="1" min="0" placeholder=${r.closing !== null ? String(r.closing) : String(bal)} value=${counts[m.id] !== undefined ? counts[m.id] : ''} onChange=${(e) => { const v = e.target.value; setCounts((o) => Object.assign({}, o, { [m.id]: v })); }} /><button className="btn soft sm" onClick=${() => saveCount(m)}>Save</button>${r.closing !== null ? html`<span className="pill ok">Counted ✓</span>` : null}</div></td>
          <td className=${'r ' + (r.variance < 0 ? 'neg' : r.variance > 0 ? 'pos' : '')}>${r.variance > 0 ? '+' : ''}${r.variance}</td>
          <td>${bal <= 0 ? html`<span className="pill danger">Out</span>` : isLow ? html`<span className="pill warn">Low</span>` : html`<span className="pill ok">OK</span>`}</td>
          <td><div className="row wrap" style=${{ justifyContent: 'flex-end' }}>
            <button className="btn soft sm" onClick=${() => setModal({ type: 'transfer', id: m.id })}>Take from butchery</button>
            <button className="btn ghost sm" onClick=${() => setModal({ type: 'waste', id: m.id })}>Waste</button>
          </div></td>
        </tr>`;
      })}</tbody>
    </table></div>` : html`<div className="empty">No meats are set up for ready-made sale yet — add prices in Settings → Prices → Ready-made.</div>`}
    ${modal ? html`<${KitchenStockModal} type=${modal.type} onClose=${() => setModal(null)} />` : null}
  </div>`;
}

function MovementLedgerPanel() {
  const { s } = useApp();
  const [ym, setYm] = useState(ymOf(dayStr()));
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const r = monthRange(ym);
  let rows = movementLedger(s, r[0], r[1]);
  if (cat !== 'all') rows = rows.filter((x) => x.cat === cat);
  const term = q.trim().toLowerCase();
  if (term) rows = rows.filter((x) => (x.item + ' ' + x.type + ' ' + x.ref + ' ' + x.by).toLowerCase().includes(term));
  const cats = [CAT_BUTCHERY, CAT_READY, CAT_DRINKS, CAT_INGREDIENT, CAT_SUPPLY];
  return html`<div>
    <p className="hint">Every purchase, transfer, sale, wastage and stock-count adjustment that touched stock, in one place — each row traces back to the actual record that caused it, so this can never drift out of step with Butchery, Kitchen, Consumables or Sales.</p>
    <div className="row wrap between mb">
      <${MonthPicker} value=${ym} onChange=${setYm} />
      <div className="row wrap">
        <select className="inp" style=${{ width: '190px' }} value=${cat} onChange=${(e) => setCat(e.target.value)}><option value="all">All categories</option>${cats.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}</select>
        <input className="inp" style=${{ width: '210px' }} placeholder="Search item, reference, person" value=${q} onChange=${(e) => setQ(e.target.value)} />
      </div>
    </div>
    ${rows.length ? html`<div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>When</th><th>Category</th><th>Item</th><th>Movement</th><th className="r">Qty</th><th>Reference</th><th>By</th></tr></thead>
      <tbody>${rows.slice(0, 400).map((x, i) => html`<tr key=${i}>
        <td>${dateNice(x.day)} ${timeStr(x.at)}</td>
        <td><span className="pill">${x.cat}</span></td>
        <td>${x.item}</td>
        <td>${x.type}</td>
        <td className=${'r num-strong ' + (x.dir === 'in' ? 'pos' : 'neg')}>${x.dir === 'in' ? '+' : '−'}${r3(x.qty)} ${x.unit}${x.unit === 'portion' && x.qty !== 1 ? 's' : ''}</td>
        <td>${x.ref || html`<span className="muted">—</span>`}</td>
        <td>${x.by || html`<span className="muted">—</span>`}</td>
      </tr>`)}</tbody>
      <tfoot><tr><td colSpan="7">${rows.length} movement${rows.length === 1 ? '' : 's'}${rows.length > 400 ? ' (showing the latest 400)' : ''} in ${monthLabel(ym)}</td></tr></tfoot>
    </table></div>` : html`<div className="empty">No stock movements in ${monthLabel(ym)} for this filter.</div>`}
  </div>`;
}

function InventoryPage() {
  const { s } = useApp();
  const [tab, setTab] = useState('ready');
  const lowOf = (cat) => consLow(s).filter((c) => c.cat === cat).length;
  return html`<div>
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[{ id: 'ready', label: 'Ready-made stock', badge: readyLowMeats(s).length || null }, { id: 'meat', label: 'Meat & butchery', badge: meatLow(s).length || null }, { id: 'drink', label: 'Drinks', badge: lowOf('drink') || null }, { id: 'ingredient', label: 'Kitchen ingredients', badge: lowOf('ingredient') || null }, { id: 'supply', label: 'Consumables', badge: lowOf('supply') || null }, { id: 'ledger', label: 'Movement ledger' }]} />
    ${tab === 'ready' ? html`<${ReadyStockPanel} />` : tab === 'meat' ? html`<${ButcheryStock} />` : tab === 'ledger' ? html`<${MovementLedgerPanel} />` : html`<${ConsumablesPanel} key=${tab} cat=${tab} />`}
  </div>`;
}

const CONS_INFO = {
  drink: { title: 'Drinks', hint: 'Drinks sold at the till come off stock automatically. Receive new stock here, and count what is left at closing time to catch any difference.', used: 'Sold / used', noun: 'drink' },
  ingredient: { title: 'Kitchen ingredients', hint: 'Food ingredients such as maize flour and cooking oil. Record what the kitchen uses — it is counted as part of the cost of the food, so profit stays accurate.', used: 'Used in kitchen', noun: 'ingredient' },
  supply: { title: 'Consumables', hint: 'Non-food operating supplies: serviettes, toothpicks, straws, disposable cups and plates, takeaway packaging. Gas and charcoal are not stock — record those under Expenses.', used: 'Used', noun: 'consumable' },
};
function ConsumablesPanel({ cat }) {
  const { s, update, notify, user } = useApp();
  const info = CONS_INFO[cat];
  const [counts, setCounts] = useState({});
  const [modal, setModal] = useState(null);
  const day = dayStr();
  const isAdmin = user.role === 'admin';
  const low = consLow(s).filter((c) => c.cat === cat);
  const dayData = s.consDays[day] || {};
  const rec = (c) => dayData[c.id] || { opening: c.qty, received: 0, used: 0, closing: null, variance: 0 };
  const saveCount = (c) => {
    const v = counts[c.id];
    if (v === undefined || v === '' || isNaN(parseFloat(v)) || parseFloat(v) < 0) { notify('Enter the counted amount', 'err'); return; }
    update((d) => recordClosing(d, c.id, parseFloat(v), user.name));
    setCounts((o) => { const n = Object.assign({}, o); delete n[c.id]; return n; });
    notify('Closing stock recorded for ' + c.name);
  };
  const groups = [[cat, info.title]];
  const modalItem = modal && modal.id ? consOf(s, modal.id) : null;
  return html`<div>
    <div className="row wrap between mb">
      <p className="hint" style=${{ margin: 0 }}>${info.hint}</p>
      ${isAdmin ? html`<button className="btn" onClick=${() => setModal({ type: 'add' })}>Add ${info.noun}</button>` : null}
    </div>
    ${low.length ? html`<div className="alert mb"><span>⚠️</span><div><b>Low stock:</b> ${low.map((c) => c.name + ' (' + r3(c.qty) + ' ' + c.unit + ' left)').join(' · ')}</div></div>` : null}
    ${groups.map((g) => {
      const items = s.cons.filter((c) => c.cat === g[0] && c.active !== false);
      if (!items.length) return null;
      return html`<div key=${g[0]} className="mb">
        <div className="sec-title">${g[1]} · ${dateNice(day)}</div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Item</th><th className="r">Opening</th><th className="r">Received</th><th className="r">${info.used}</th><th className="r">Left now</th><th>Closing count</th><th className="r">Difference</th><th>Status</th><th></th></tr></thead>
          <tbody>${items.map((c) => {
            const r = rec(c);
            const isLow = c.qty <= c.low;
            return html`<tr key=${c.id}>
              <td><b>${c.name}</b><div className="muted" style=${{ fontSize: '11.5px' }}>${c.unit}${c.cat === 'drink' ? ' · ' + money(c.price) : ''}</div></td>
              <td className="r">${r3(r.opening)}</td><td className="r">${r3(r.received)}</td><td className="r">${r3(r.used)}</td>
              <td className="r num-strong">${r3(c.qty)}</td>
              <td><div className="row"><input className="inp num" style=${{ width: '86px' }} type="number" inputMode="decimal" step="any" placeholder=${r.closing !== null ? String(r.closing) : String(r3(c.qty))} value=${counts[c.id] !== undefined ? counts[c.id] : ''} onChange=${(e) => { const v = e.target.value; setCounts((o) => Object.assign({}, o, { [c.id]: v })); }} /><button className="btn soft sm" onClick=${() => saveCount(c)}>Save</button>${r.closing !== null ? html`<span className="pill ok">Counted ✓</span>` : null}</div></td>
              <td className=${'r ' + (r.variance < 0 ? 'neg' : r.variance > 0 ? 'pos' : '')}>${r.variance > 0 ? '+' : ''}${r3(r.variance)}</td>
              <td>${c.qty <= 0 ? html`<span className="pill danger">Out</span>` : isLow ? html`<span className="pill warn">Low</span>` : html`<span className="pill ok">OK</span>`}</td>
              <td><div className="row wrap" style=${{ justifyContent: 'flex-end' }}>
                <button className="btn soft sm" onClick=${() => setModal({ type: 'receive', id: c.id })}>Receive</button>
                <button className="btn ghost sm" onClick=${() => setModal({ type: 'use', id: c.id })}>Use</button>
                ${isAdmin ? html`<button className="btn ghost sm" onClick=${() => setModal({ type: 'edit', id: c.id })}>Edit</button>` : null}
              </div></td>
            </tr>`;
          })}</tbody>
        </table></div>
      </div>`;
    })}
    ${!s.cons.some((c) => c.cat === cat && c.active !== false) ? html`<div className="empty">Nothing here yet.${isAdmin ? ' Use the button above to add the first ' + info.noun + '.' : ''}</div>` : null}
    ${modal && modal.type === 'add' ? html`<${ConsItemModal} fixedCat=${cat} onClose=${() => setModal(null)} />` : null}
    ${modal && modal.type === 'edit' && modalItem ? html`<${ConsItemModal} item=${modalItem} onClose=${() => setModal(null)} />` : null}
    ${modal && (modal.type === 'receive' || modal.type === 'use') && modalItem ? html`<${ConsMoveModal} type=${modal.type} item=${modalItem} onClose=${() => setModal(null)} />` : null}
  </div>`;
}

/* ---------------- SALES ---------------- */
const SRC_LABEL = { butchery: 'Butchery', ready: 'Kitchen', table: 'Table', special: 'Special' };
function VoidModal({ sale, onClose }) {
  const { update, notify, user } = useApp();
  const [reason, setReason] = useState('');
  const go = () => {
    if (!reason.trim()) { notify('Give a reason for the void', 'err'); return; }
    let err = null;
    update((d) => { err = voidSale(d, sale.id, reason, user.name); });
    if (err) { notify(err, 'err'); return; }
    notify('Receipt ' + receiptNo(sale) + ' voided');
    onClose();
  };
  return html`<${Modal} title=${'Void receipt ' + receiptNo(sale)} onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn warn" onClick=${go}>Void this sale</button>`}>
    <div className="row between mb"><span className="sec">Amount</span><b>${money(sale.total)}</b></div>
    <${Field} label="Reason for voiding (required)"><textarea className="inp" value=${reason} onChange=${(e) => setReason(e.target.value)} placeholder="e.g. Rung up twice, wrong item, customer cancelled" autoFocus></textarea><//>
    <p className="hint mt">Any stock this sale took out is put back automatically. This is recorded in the Audit Trail and can't be undone.</p>
  <//>`;
}
function SalesPage() {
  const { s, showReceipt, user } = useApp();
  const [ym, setYm] = useState(ymOf(dayStr()));
  const [src, setSrc] = useState('all');
  const [q, setQ] = useState('');
  const [voidFor, setVoidFor] = useState(null);
  const r = monthRange(ym);
  let list = s.sales.filter((x) => inRange(x.day, r[0], r[1]));
  if (src !== 'all') list = list.filter((x) => x.source === src);
  const term = q.trim().toLowerCase();
  if (term) list = list.filter((x) => (receiptNo(x) + ' ' + x.cashier + ' ' + x.lines.map((l) => l.name).join(' ')).toLowerCase().indexOf(term) >= 0);
  list = list.slice().sort((a, b) => b.at.localeCompare(a.at));
  const active = list.filter((x) => !x.voided);
  const total = sum(active, (x) => x.total);
  return html`<div>
    <div className="row wrap between mb">
      <${MonthPicker} value=${ym} onChange=${setYm} />
      <div className="row wrap">
        <select className="inp" style=${{ width: '170px' }} value=${src} onChange=${(e) => setSrc(e.target.value)}><option value="all">All sections</option><option value="butchery">Butchery</option><option value="ready">Kitchen ready-made</option><option value="table">Tables</option><option value="special">Specials</option></select>
        <input className="inp" style=${{ width: '210px' }} placeholder="Search receipt, item, cashier" value=${q} onChange=${(e) => setQ(e.target.value)} />
      </div>
    </div>
    ${list.length ? html`<div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Receipt</th><th>When</th><th>Section</th><th>Items</th><th>Cashier</th><th>Paid by</th><th className="r">Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.slice(0, 300).map((x) => html`<tr key=${x.id} className=${x.voided ? 'dim' : ''}>
        <td className="click" onClick=${() => showReceipt(x, false)}><b>${receiptNo(x)}</b></td><td>${dateNice(x.day)} ${timeStr(x.at)}</td>
        <td>${SRC_LABEL[x.source] || x.source}${x.tableNo ? ' ' + x.tableNo : ''}</td>
        <td style=${{ maxWidth: '280px' }}>${x.lines.map((l) => l.name + (l.label ? ' (' + l.label + ')' : '')).join(', ')}</td>
        <td>${x.cashier}</td><td>${PAY_LABEL[(x.pay || {}).method] || '—'}</td><td className="r num-strong">${money(x.total)}</td>
        <td>${x.voided ? html`<span className="pill danger">Voided</span>` : x.status === 'unpaid' ? html`<span className="pill warn">Unpaid</span>` : x.status === 'partial' ? html`<span className="pill warn">Balance ${money(x.balance)}</span>` : html`<span className="pill ok">Paid</span>`}</td>
        <td>${!x.voided ? html`<button className="btn danger-ghost sm" onClick=${() => setVoidFor(x)}>Void</button>` : html`<span className="muted" style=${{ fontSize: '11.5px' }} title=${x.voidReason}>by ${x.voidBy}</span>`}</td>
      </tr>`)}</tbody>
      <tfoot><tr><td colSpan="6">${active.length} sales${x_over(list)}</td><td className="r">${money(total)}</td><td colSpan="2"></td></tr></tfoot>
    </table></div>` : html`<div className="empty">No sales in ${monthLabel(ym)} for this filter.</div>`}
    ${voidFor ? html`<${VoidModal} sale=${voidFor} onClose=${() => setVoidFor(null)} />` : null}
  </div>`;
}
function x_over(list) { return list.length > 300 ? ' (showing the latest 300)' : ''; }

/* ---------------- EXPENSES ---------------- */
function ExpensesPage() {
  const { s, update, notify, user, ask } = useApp();
  const isAdmin = user.role === 'admin';
  const [ym, setYm] = useState(ymOf(dayStr()));
  const [date, setDate] = useState(dayStr());
  const [cat, setCat] = useState(EXPENSE_CATS[0]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [via, setVia] = useState('Cash');
  const r = monthRange(ym);
  const CASHIER_HIDDEN_CATS = ['Rent'];
  const list = s.expenses.filter((e) => inRange(e.day, r[0], r[1]) && (isAdmin || !CASHIER_HIDDEN_CATS.includes(e.cat))).sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at));
  const catOptions = isAdmin ? EXPENSE_CATS : EXPENSE_CATS.filter((c) => !CASHIER_HIDDEN_CATS.includes(c));
  const total = sum(list, (e) => e.amount);
  const byCat = {};
  list.forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; });
  const add = () => {
    const a = num(amount);
    if (!(a > 0)) { notify('Enter the amount', 'err'); return; }
    update((d) => { d.expenses.push({ id: uid(), day: date, at: new Date().toISOString(), cat, title: title.trim(), amount: a, via, by: user.name }); });
    setTitle(''); setAmount('');
    notify('Expense recorded');
    if (ymOf(date) !== ym) setYm(ymOf(date));
  };
  const del = (e) => ask('Delete expense?', e.cat + ' · ' + money(e.amount) + (e.title ? ' · ' + e.title : ''), () => update((d) => { d.expenses = d.expenses.filter((x) => x.id !== e.id); }), true);
  return html`<div className="split">
    <div>
      <div className="row wrap between mb"><${MonthPicker} value=${ym} onChange=${setYm} /><b>${monthLabel(ym)} total: ${money(total)}</b></div>
      <p className="hint">Running costs such as charcoal, rent, salaries and electricity. Stock you buy for resale (meat, drinks) is not an expense; it becomes a cost only when sold, so record it through Receive stock.</p>
      ${list.length ? html`<div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Paid via</th><th className="r">Amount</th><th></th></tr></thead>
        <tbody>${list.map((e) => html`<tr key=${e.id}><td>${dateNice(e.day)}</td><td><span className="pill">${e.cat}</span></td><td>${e.title || html`<span className="muted">—</span>`}</td><td>${e.via}</td><td className="r num-strong">${money(e.amount)}</td><td className="right">${user.role === 'admin' ? html`<button className="icon-btn" onClick=${() => del(e)} aria-label="Delete expense">🗑</button>` : null}</td></tr>`)}</tbody>
      </table></div>` : html`<div className="empty">No expenses recorded for ${monthLabel(ym)}.</div>`}
      ${Object.keys(byCat).length ? html`<div className="card mt"><h3>By category</h3><div className="chips">${Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).map((k) => html`<span className="chip" key=${k}>${k}<small>${money(byCat[k])}</small></span>`)}</div></div>` : null}
    </div>
    <div className="card stick">
      <h3>Record an expense</h3>
      <div className="col">
        <${Field} label="Date"><input className="inp" type="date" value=${date} max=${dayStr()} onChange=${(e) => setDate(e.target.value || dayStr())} /><//>
        <${Field} label="Category"><select className="inp" value=${cat} onChange=${(e) => setCat(e.target.value)}>${catOptions.map((c) => html`<option key=${c}>${c}</option>`)}</select><//>
        <${Field} label="Details (optional)"><input className="inp" value=${title} onChange=${(e) => setTitle(e.target.value)} placeholder="e.g. 2 bags charcoal" /><//>
        <${Field} label=${'Amount (' + CUR + ')'}><input className="inp num" type="number" inputMode="decimal" value=${amount} onChange=${(e) => setAmount(e.target.value)} /><//>
        <${Field} label="Paid via"><select className="inp" value=${via} onChange=${(e) => setVia(e.target.value)}><option>Cash</option><option>M-Pesa</option><option>Bank</option></select><//>
        <button className="btn lg" onClick=${add}>Save expense</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- DASHBOARD (monthly profit) ---------------- */
function DashboardPage() {
  const { s, go } = useApp();
  const cur = ymOf(dayStr());
  const [ym, setYm] = useState(cur);
  const isCur = ym === cur;
  const rng = monthRange(ym);
  const pl = useMemo(() => computePL(s, rng[0], rng[1]), [s, ym]);
  const months = useMemo(() => {
    const a = [];
    for (let i = 5; i >= 0; i--) { const m = shiftMonth(cur, -i); const r = monthRange(m); a.push({ ym: m, pl: computePL(s, r[0], r[1]) }); }
    return a;
  }, [s]);
  const today = computePL(s, dayStr(), dayStr());
  const maxV = Math.max(1, ...months.map((m) => Math.max(m.pl.rev, m.pl.gross, Math.abs(m.pl.net))));
  const h = (v) => Math.max(2, Math.round(Math.abs(v) / maxV * 100)) + '%';
  const receivable = sum(s.specials.filter((x) => !x.paid), (x) => x.price);
  const unpaidN = s.specials.filter((x) => !x.paid).length;
  const lowM = meatLow(s), lowC = consLow(s);
  const pend = s.requests.filter((r) => r.status === 'pending');
  const top = Object.keys(pl.items).sort((a, b) => pl.items[b] - pl.items[a]).slice(0, 6);
  const cats = Object.keys(pl.byCat).sort((a, b) => pl.byCat[b] - pl.byCat[a]);
  const payTotal = pl.pay.cash + pl.pay.mpesa + pl.pay.card;
  return html`<div className="col" style=${{ gap: '18px' }}>
    <div className="row wrap between">
      <${MonthPicker} value=${ym} onChange=${setYm} />
      <span className="pill info">${isCur ? 'Month to date · profit is worked out monthly' : 'Full month · profit is worked out monthly'}</span>
    </div>
    <div className="kpis">
      <div className="kpi"><div className="l">Sales revenue</div><div className="v">${money(pl.rev)}</div><div className="s">${pl.count} sales in ${monthLabel(ym)}</div></div>
      <div className="kpi hl"><div className="l">Gross profit (approx.)</div><div className=${'v ' + (pl.gross < 0 ? 'neg' : '')}>${money(pl.gross)}</div><div className="s">${pct(pl.gm)} of revenue</div></div>
      <div className="kpi"><div className="l">Operating expenses</div><div className="v">${money(pl.opex)}</div><div className="s">${cats.length} categories recorded</div></div>
      <div className="kpi hl"><div className="l">Net profit (approx.)</div><div className=${'v ' + (pl.net < 0 ? 'neg' : 'pos')}>${money(pl.net)}</div><div className="s">${pct(pl.nm)} net margin</div></div>
    </div>
    ${pl.opex === 0 && pl.rev > 0 ? html`<div className="alert"><span>💡</span><div>No expenses are recorded for ${monthLabel(ym)}, so net profit equals gross profit. Add rent, salaries, charcoal, electricity and other running costs in <button className="btn ghost sm" onClick=${() => go('expenses')}>Expenses</button> for a realistic figure.</div></div>` : null}
    <div className="split wide-r">
      <div className="col" style=${{ gap: '16px' }}>
        <div className="card">
          <div className="card-head"><h3>Profit and loss · ${monthLabel(ym)}</h3><span className="pill">Approximate</span></div>
          <div className="tbl-wrap" style=${{ border: 0 }}><table className="tbl">
            <thead><tr><th>Trading</th><th className="r">Revenue</th><th className="r">Cost of goods</th><th className="r">Gross profit</th><th className="r">Margin</th></tr></thead>
            <tbody>
              ${CHANNELS.map((c) => { const x = pl.ch[c.id]; const g = x.rev - x.cogs; return html`<tr key=${c.id}><td>${c.label}</td><td className="r">${money(x.rev)}</td><td className="r">${money(x.cogs)}</td><td className=${'r ' + (g < 0 ? 'neg' : '')}>${money(g)}</td><td className="r">${x.rev ? pct(g / x.rev) : '—'}</td></tr>`; })}
              <tr><td>Waste, spoilage and stock losses</td><td className="r">—</td><td className="r">${money(pl.shrink)}</td><td className=${'r ' + (pl.shrink ? 'neg' : '')}>${money(-pl.shrink)}</td><td className="r">—</td></tr>
              <tr className="total"><td>Gross profit</td><td className="r">${money(pl.rev)}</td><td className="r">${money(pl.cogs)}</td><td className=${'r ' + (pl.gross < 0 ? 'neg' : 'pos')}>${money(pl.gross)}</td><td className="r">${pct(pl.gm)}</td></tr>
            </tbody>
            <thead><tr><th colSpan="5" style=${{ paddingTop: '16px' }}>Operating expenses</th></tr></thead>
            <tbody>
              ${cats.length ? cats.map((k) => html`<tr key=${k} className="sub"><td colSpan="3">${k}</td><td className="r" colSpan="2">${money(pl.byCat[k])}</td></tr>`) : html`<tr className="sub"><td colSpan="5">No expenses recorded this month</td></tr>`}
              <tr className="total"><td colSpan="3">Total operating expenses</td><td className="r" colSpan="2">${money(pl.opex)}</td></tr>
              <tr className="total"><td colSpan="3">Net profit (before tax)</td><td className=${'r ' + (pl.net < 0 ? 'neg' : 'pos')} colSpan="2">${money(pl.net)} · ${pct(pl.nm)}</td></tr>
            </tbody>
          </table></div>
          <p className="hint" style=${{ margin: '12px 0 0' }}>How this is worked out: revenue is counted when payment is received (unpaid specials are shown separately). Cost of goods is the average buying cost of the meat, sides and drinks sold, plus recorded waste. Stock purchases are not expenses; they become a cost when sold. Selling prices are treated as tax-inclusive and no tax is deducted. This is a management estimate, not audited accounts.</p>
        </div>
        <div className="grid2">
          <div className="card"><h3>Best sellers</h3>${top.length ? html`<div className="col gap-sm">${top.map((k) => html`<div className="row between" key=${k}><span>${k}</span><b className="num-strong">${money(pl.items[k])}</b></div>`)}</div>` : html`<div className="empty">No sales this month</div>`}</div>
          <div className="card"><h3>How customers paid</h3>${payTotal ? html`<div className="col gap-sm">${[['Cash', pl.pay.cash], ['M-Pesa', pl.pay.mpesa], ['Card', pl.pay.card]].map((p) => html`<div className="row between" key=${p[0]}><span>${p[0]}</span><span><b className="num-strong">${money(p[1])}</b> <span className="muted">${pct(payTotal ? p[1] / payTotal : 0)}</span></span></div>`)}</div>` : html`<div className="empty">No payments this month</div>`}</div>
        </div>
      </div>
      <div className="col" style=${{ gap: '16px' }}>
        <div className="card">
          <div className="card-head"><h3>Last 6 months</h3></div>
          <div className="legend mb"><span><i></i>Revenue</span><span><i className="g"></i>Gross profit</span><span><i style=${{ background: 'var(--t-info)' }}></i>Net profit</span></div>
          <div className="bars">${months.map((m) => html`<div className="bar-col" key=${m.ym}>
            <div className="bar-pair">
              <div className="bar" style=${{ height: h(m.pl.rev) }} title=${'Revenue ' + money(m.pl.rev)}></div>
              <div className="bar g" style=${{ height: h(m.pl.gross) }} title=${'Gross profit ' + money(m.pl.gross)}></div>
              <div className="bar" style=${{ height: h(m.pl.net), background: m.pl.net < 0 ? 'var(--t-danger)' : 'var(--t-info)' }} title=${'Net profit ' + money(m.pl.net)}></div>
            </div>
            <small style=${{ fontWeight: m.ym === ym ? 700 : 400 }}>${monthShort(m.ym)}</small>
          </div>`)}</div>
        </div>
        <div className="card">
          <h3>Today at a glance</h3>
          <div className="row between"><span className="sec">Takings so far today</span><b className="num-strong">${money(today.rev)}</b></div>
          <div className="row between mt"><span className="sec">Sales today</span><b className="num-strong">${today.count}</b></div>
          <p className="hint" style=${{ margin: '10px 0 0' }}>Profit is only shown for whole months.</p>
        </div>
        <div className="card">
          <h3>Needs attention</h3>
          <div className="col gap-sm">
            ${unpaidN ? html`<div className="alert info"><span>🧾</span><div><b>${unpaidN} unpaid special${unpaidN > 1 ? 's' : ''}</b> · ${money(receivable)} still to collect. This is not in revenue until paid.</div></div>` : null}
            ${pend.length ? html`<div className="alert"><span>🍖</span><div>Kitchen is waiting on butchery: ${pend.map((r) => r.name).join(', ')}</div></div>` : null}
            ${lowM.length ? html`<div className="alert"><span>🥩</span><div><b>Low meat stock:</b> ${lowM.map((m) => m.name + ' (' + r3(m.stock) + ')').join(', ')}</div></div>` : null}
            ${lowC.length ? html`<div className="alert"><span>📦</span><div><b>Low consumables:</b> ${lowC.map((c) => c.name + ' (' + r3(c.qty) + ')').join(', ')}</div></div>` : null}
            ${!unpaidN && !pend.length && !lowM.length && !lowC.length ? html`<div className="empty">Nothing needs attention right now</div>` : null}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------------- SETTINGS (admin) ---------------- */
function PriceButchery() {
  const { s, update, ask } = useApp();
  const [nm, setNm] = useState('');
  const [kind, setKind] = useState('kg');
  const set = (id, k, v) => update((d) => { meatOf(d, id)[k] = v; });
  const setPortion = (id, key, v) => update((d) => { meatOf(d, id).butcheryPortions[key] = v; });
  const add = () => {
    if (!nm.trim()) return;
    update((d) => {
      const id = nm.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 14) + '-' + uid().slice(0, 3);
      const portions = kind === 'bird' ? { full: 0, half: 0 } : { 0.25: 0, 0.5: 0, 0.75: 0, 1: 0 };
      d.meats.push({ id, name: nm.trim(), emoji: kind === 'bird' ? '🐔' : '🥩', kind, butchery: 0, butcheryPortions: portions, ready: 0, readyPortions: kind === 'kg' ? { 0.25: 0, 0.5: 0, 0.75: 0, 1: 0 } : {}, special: 0, specialPortions: kind === 'bird' ? { full: 0, half: 0 } : undefined, cost: 0, stock: 0, low: 5, active: true });
      if (kind === 'kg') d.kitchen[id] = 0;
    });
    setNm('');
  };
  return html`<div>
    <p className="hint">Set each portion's own price — a ¼ kg doesn't have to be exactly a quarter of the 1 kg price. Kg meats also sell by custom weight or by amount in ${CUR}, using the "per kg (custom amounts)" rate below.</p>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Meat</th><th className="r">¼ kg</th><th className="r">½ kg</th><th className="r">¾ kg</th><th className="r">1 kg</th><th className="r">Full bird</th><th className="r">Half bird</th><th className="r">Per kg (custom amounts)</th><th className="r">Avg buying cost</th><th className="r">Low-stock alert</th><th></th></tr></thead>
      <tbody>${s.meats.map((m) => html`<tr key=${m.id} className=${m.active === false ? 'dim' : ''}>
        <td><div className="row"><span>${m.emoji}</span><${TextInput} value=${m.name} onCommit=${(v) => set(m.id, 'name', v)} /></div></td>
        ${m.kind === 'kg' ? [0.25, 0.5, 0.75, 1].map((f) => html`<td key=${f} className="r"><${NumInput} value=${m.butcheryPortions[f] || 0} onCommit=${(v) => setPortion(m.id, f, v)} width="82px" /></td>`) : html`<td colSpan="4" className="muted center">Not sold by weight</td>`}
        ${m.kind === 'bird' ? html`<td className="r"><${NumInput} value=${m.butcheryPortions.full || 0} onCommit=${(v) => setPortion(m.id, 'full', v)} width="90px" /></td><td className="r"><${NumInput} value=${m.butcheryPortions.half || 0} onCommit=${(v) => setPortion(m.id, 'half', v)} width="90px" /></td>` : html`<td colSpan="2" className="muted center">Not sold as a bird</td>`}
        <td className="r">${m.kind === 'kg' ? html`<${NumInput} value=${m.butchery} onCommit=${(v) => set(m.id, 'butchery', v)} width="100px" />` : html`<span className="muted">—</span>`}</td>
        <td className="r"><${NumInput} value=${m.cost} onCommit=${(v) => set(m.id, 'cost', v)} width="100px" /></td>
        <td className="r"><${NumInput} value=${m.low} onCommit=${(v) => set(m.id, 'low', v)} width="90px" /></td>
        <td><button className="btn ghost sm" onClick=${() => set(m.id, 'active', m.active === false)}>${m.active === false ? 'Show' : 'Hide'}</button></td>
      </tr>`)}</tbody>
    </table></div>
    <div className="card mt"><h3>Add a meat</h3><div className="row wrap">
      <input className="inp" style=${{ width: '220px' }} placeholder="Name, e.g. Mutton" value=${nm} onChange=${(e) => setNm(e.target.value)} />
      <select className="inp" style=${{ width: '190px' }} value=${kind} onChange=${(e) => setKind(e.target.value)}><option value="kg">Sold by kilogram</option><option value="bird">Sold as full / half bird</option></select>
      <button className="btn" onClick=${add}>Add meat</button>
    </div></div>
  </div>`;
}
function PriceReady() {
  const { s, update } = useApp();
  const setPortion = (id, key, v) => update((d) => { meatOf(d, id).readyPortions[key] = v; });
  const setLow = (id, v) => update((d) => { meatOf(d, id).readyLow = v; });
  const setGrams = (v) => update((d) => { d.settings.portionGrams = Math.max(10, Math.round(v)); });
  return html`<div>
    <p className="hint">Price for ready-made (cooked) meat — each portion is set independently. Leave all four at 0 to stop selling a meat ready-made. Chicken is never sold ready-made.</p>
    <div className="fgrid mb" style=${{ maxWidth: '260px' }}><${Field} label="Portion size (grams)" sub="Used to convert kg transferred from the butchery into whole portions"><${NumInput} value=${s.settings.portionGrams || 250} onCommit=${setGrams} min=${10} /><//></div>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Meat</th><th className="r">¼ kg</th><th className="r">½ kg</th><th className="r">¾ kg</th><th className="r">1 kg</th><th className="r">Low-stock alert (portions)</th></tr></thead>
      <tbody>${s.meats.filter((m) => m.active !== false).map((m) => m.kind === 'bird'
        ? html`<tr key=${m.id}><td>${m.emoji} ${m.name}</td><td colSpan="5" className="muted">Not sold ready-made</td></tr>`
        : html`<tr key=${m.id}><td>${m.emoji} ${m.name}</td>${[0.25, 0.5, 0.75, 1].map((f) => html`<td key=${f} className="r"><${NumInput} value=${m.readyPortions[f] || 0} onCommit=${(v) => setPortion(m.id, f, v)} width="90px" /></td>`)}<td className="r"><${NumInput} value=${m.readyLow || 0} onCommit=${(v) => setLow(m.id, v)} width="90px" /></td></tr>`)}</tbody>
    </table></div>
  </div>`;
}
function PriceSpecials() {
  const { s, update } = useApp();
  const [st, setSt] = useState('');
  const set = (id, k, v) => update((d) => { meatOf(d, id)[k] = v; });
  const setPortion = (id, key, v) => update((d) => { meatOf(d, id).specialPortions[key] = v; });
  return html`<div>
    <p className="hint">Price for meat cooked to order — ¼, ½, ¾ and 1 kg are each set independently, just like Butchery and Ready-made. Other weights (1½ kg, 2 kg, or a custom amount) use the "per kg (other amounts)" rate. A bird's full and half prices are each set independently. Sides are priced separately under Sides.</p>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Meat</th><th className="r">¼ kg</th><th className="r">½ kg</th><th className="r">¾ kg</th><th className="r">1 kg</th><th className="r">Full bird</th><th className="r">Half bird</th><th className="r">Per kg (other amounts)</th></tr></thead>
      <tbody>${s.meats.filter((m) => m.active !== false).map((m) => html`<tr key=${m.id}><td>${m.emoji} ${m.name}</td>
        ${m.kind === 'kg' ? [0.25, 0.5, 0.75, 1].map((f) => html`<td key=${f} className="r"><${NumInput} value=${(m.specialPortions && m.specialPortions[f]) || 0} onCommit=${(v) => setPortion(m.id, f, v)} width="82px" /></td>`) : html`<td colSpan="4" className="muted center">Not sold by weight</td>`}
        <td className="r">${m.kind === 'bird' ? html`<${NumInput} value=${(m.specialPortions && m.specialPortions.full) || 0} onCommit=${(v) => setPortion(m.id, 'full', v)} width="90px" />` : html`<span className="muted">—</span>`}</td>
        <td className="r">${m.kind === 'bird' ? html`<${NumInput} value=${(m.specialPortions && m.specialPortions.half) || 0} onCommit=${(v) => setPortion(m.id, 'half', v)} width="90px" />` : html`<span className="muted">—</span>`}</td>
        <td className="r">${m.kind === 'kg' ? html`<${NumInput} value=${m.special} onCommit=${(v) => set(m.id, 'special', v)} width="100px" />` : html`<span className="muted">—</span>`}</td>
      </tr>`)}</tbody>
    </table></div>
    <div className="card mt"><h3>Cooking styles</h3>
      <div className="chips mb">${s.styles.map((x) => html`<span className="chip on" key=${x} style=${{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>${x}<button className="icon-btn" style=${{ color: '#fff', padding: '0 4px' }} onClick=${() => update((d) => { d.styles = d.styles.filter((y) => y !== x); })} aria-label=${'Remove ' + x}>✕</button></span>`)}</div>
      <div className="row"><input className="inp" style=${{ width: '220px' }} placeholder="e.g. Kienyeji roast" value=${st} onChange=${(e) => setSt(e.target.value)} /><button className="btn soft" onClick=${() => { if (st.trim()) { update((d) => { d.styles.push(st.trim()); }); setSt(''); } }}>Add style</button></div>
    </div>
  </div>`;
}
function PriceSides() {
  const { s, update, ask } = useApp();
  const [nm, setNm] = useState(''), [pr, setPr] = useState(''), [co, setCo] = useState('');
  const set = (id, k, v) => update((d) => { d.sides.find((x) => x.id === id)[k] = v; });
  const add = () => {
    if (!nm.trim()) return;
    update((d) => { d.sides.push({ id: nm.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 14) + '-' + uid().slice(0, 3), name: nm.trim(), price: num(pr), cost: num(co), active: true }); });
    setNm(''); setPr(''); setCo('');
  };
  return html`<div>
    <p className="hint">Sides sold with ready-made meat and specials (ugali, chapati and so on). The cost is your approximate cost to make one serving; it feeds the gross profit figures.</p>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Side</th><th className="r">Price (${CUR})</th><th className="r">Cost each (${CUR})</th><th></th></tr></thead>
      <tbody>${s.sides.map((x) => html`<tr key=${x.id}>
        <td><${TextInput} value=${x.name} onCommit=${(v) => set(x.id, 'name', v)} /></td>
        <td className="r"><${NumInput} value=${x.price} onCommit=${(v) => set(x.id, 'price', v)} width="110px" /></td>
        <td className="r"><${NumInput} value=${x.cost} onCommit=${(v) => set(x.id, 'cost', v)} width="110px" /></td>
        <td><button className="btn danger-ghost sm" onClick=${() => ask('Remove ' + x.name + '?', 'It will no longer appear on the menu. Past sales keep their records.', () => update((d) => { d.sides = d.sides.filter((y) => y.id !== x.id); }), true)}>Remove</button></td>
      </tr>`)}</tbody>
    </table></div>
    <div className="card mt"><h3>Add a side</h3><div className="row wrap">
      <input className="inp" style=${{ width: '200px' }} placeholder="Name" value=${nm} onChange=${(e) => setNm(e.target.value)} />
      <input className="inp num" style=${{ width: '120px' }} type="number" placeholder="Price" value=${pr} onChange=${(e) => setPr(e.target.value)} />
      <input className="inp num" style=${{ width: '120px' }} type="number" placeholder="Cost" value=${co} onChange=${(e) => setCo(e.target.value)} />
      <button className="btn" onClick=${add}>Add side</button>
    </div></div>
  </div>`;
}
function PriceDrinks() {
  const { s, update, ask } = useApp();
  const [add, setAdd] = useState(false);
  const set = (id, k, v) => update((d) => { consOf(d, id)[k] = v; });
  const drinks = s.cons.filter((c) => c.cat === 'drink');
  return html`<div>
    <p className="hint">Drinks sold on tables. Stock is tracked under Consumables and comes off automatically when a drink is sold.</p>
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Drink</th><th>Unit</th><th className="r">Price (${CUR})</th><th className="r">Buying cost (${CUR})</th><th className="r">Low-stock alert</th><th></th></tr></thead>
      <tbody>${drinks.map((c) => html`<tr key=${c.id}>
        <td><${TextInput} value=${c.name} onCommit=${(v) => set(c.id, 'name', v)} /></td>
        <td>${c.unit}</td>
        <td className="r"><${NumInput} value=${c.price} onCommit=${(v) => set(c.id, 'price', v)} width="110px" /></td>
        <td className="r"><${NumInput} value=${c.cost} onCommit=${(v) => set(c.id, 'cost', v)} width="110px" /></td>
        <td className="r"><${NumInput} value=${c.low} onCommit=${(v) => set(c.id, 'low', v)} width="90px" /></td>
        <td><button className="btn danger-ghost sm" onClick=${() => ask('Remove ' + c.name + '?', 'It will disappear from the menu and from Consumables.', () => update((d) => { d.cons = d.cons.filter((y) => y.id !== c.id); }), true)}>Remove</button></td>
      </tr>`)}</tbody>
    </table></div>
    <div className="mt"><button className="btn" onClick=${() => setAdd(true)}>Add a drink</button></div>
    ${add ? html`<${ConsItemModal} fixedCat="drink" onClose=${() => setAdd(false)} />` : null}
  </div>`;
}

function InstrAdd() {
  const { update } = useApp();
  const [v, setV] = useState('');
  const add = () => { if (v.trim()) { update((d) => { d.instructions.push(v.trim()); }); setV(''); } };
  return html`<div className="row wrap"><input className="inp" style=${{ width: '240px' }} placeholder="e.g. No pepper" value=${v} onChange=${(e) => setV(e.target.value)} onKeyDown=${(e) => { if (e.key === 'Enter') add(); }} /><button className="btn soft" onClick=${add}>Add</button></div>`;
}
function PrinterTab() {
  const { s, update, showReceipt, user } = useApp();
  const st = s.settings;
  const setS = (k, v) => update((d) => { d.settings[k] = v; });
  const testSale = {
    id: 'test', no: 1, day: dayStr(), at: new Date().toISOString(), source: 'ready', cashier: user.name, tableNo: null,
    lines: [{ name: 'Test line', label: 'Printer check', qty: 1, unit: 'pc', kind: 'side', total: 100, cost: 0 }],
    total: 100, status: 'paid', balance: 0, pay: { method: 'cash', cash: 100, tendered: 100, change: 0 },
  };
  return html`<div className="card" style=${{ maxWidth: '640px' }}>
    <h3>Receipt printer</h3>
    <p className="hint">Printing uses your browser's own Print dialog — point it at your receipt printer (or "Save as PDF" to check the layout) and it will remember that choice next time.</p>
    <div className="sec-title mt">Paper width</div>
    <div className="chips">${[['58', '58mm'], ['80', '80mm']].map((w) => html`<button key=${w[0]} className=${'chip' + (st.printerWidth === w[0] ? ' on' : '')} onClick=${() => setS('printerWidth', w[0])}>${w[1]}</button>`)}</div>
    <button className="btn mt" onClick=${() => showReceipt(testSale, true)}>Print a test receipt</button>
  </div>`;
}

/* ---------------- REPORTS ---------------- */
/* ---------------- DEBTORS ---------------- */
function DebtorsPage() {
  const { s, update, notify, user, showReceipt } = useApp();
  const [q, setQ] = useState('');
  const [payFor, setPayFor] = useState(null);
  let list = debtors(s);
  const total = sum(list, (x) => x.balance);
  const term = q.trim().toLowerCase();
  if (term) list = list.filter((x) => (x.name + ' ' + x.phone + ' ' + x.ref).toLowerCase().includes(term));
  const pay = (p, doPrint) => {
    const res = payFor.kind === 'special'
      ? update((d) => { const sale = paySpecial(d, payFor.id, p, user.name, null); return sale ? { sale } : { err: 'Could not record payment' }; })
      : update((d) => settleSaleBalance(d, payFor.id, p, user.name));
    setPayFor(null);
    if (res.err) { notify(res.err, 'err'); return; }
    notify(payFor.name + ' — balance cleared');
    if (doPrint) showReceipt(res.sale, true);
  };
  return html`<div>
    <div className="row wrap between mb">
      <p className="hint" style=${{ margin: 0 }}>Everyone who currently owes money — customers sold to on credit in Butchery, and unpaid or deposit-only special orders and receipts, all in one place.</p>
      <input className="inp" style=${{ width: '240px' }} placeholder="Search name, phone, receipt" value=${q} onChange=${(e) => setQ(e.target.value)} />
    </div>
    ${total > 0 ? html`<div className="alert mb"><span>🧾</span><div>Total owed to the business: <b>${money(total)}</b> across ${list.length} debt${list.length === 1 ? '' : 's'}.</div></div>` : null}
    ${list.length ? html`<div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Customer</th><th>Phone</th><th>Source</th><th>Reference</th><th>Date</th><th className="r">Total</th><th className="r">Paid</th><th className="r">Balance</th><th></th></tr></thead>
      <tbody>${list.map((x) => html`<tr key=${x.kind + x.id}>
        <td><b>${x.name}</b></td><td>${x.phone || html`<span className="muted">—</span>`}</td>
        <td>${x.source}</td><td>${x.ref}</td><td>${dateNice(x.day)}</td>
        <td className="r">${money(x.total)}</td><td className="r">${money(x.paid)}</td>
        <td className="r num-strong neg">${money(x.balance)}</td>
        <td><button className="btn good sm" onClick=${() => setPayFor(x)}>Clear balance</button></td>
      </tr>`)}</tbody>
      <tfoot><tr><td colSpan="7">Total outstanding</td><td className="r">${money(total)}</td><td></td></tr></tfoot>
    </table></div>` : html`<div className="empty">No one currently owes the business anything.</div>`}
    ${payFor ? html`<${CheckoutModal} title=${'Clear balance · ' + payFor.name} total=${payFor.balance} print="ask" onClose=${() => setPayFor(null)} onConfirm=${pay} />` : null}
  </div>`;
}

function ReportsPage() {
  const { s } = useApp();
  const [period, setPeriod] = useState('month');
  const today = dayStr();
  const t = new Date();
  const back = (n) => { const d = new Date(t); d.setDate(d.getDate() - n); return dayStr(d); };
  const ranges = { today: [today, today], week: [back(6), today], month: monthRange(ymOf(today)) };
  const [from, to] = ranges[period];
  const pl = computePL(s, from, to);
  const waste = s.waste.filter((w) => inRange(w.day, from, to));
  const wasteByReason = {}; waste.forEach((w) => { wasteByReason[w.reason] = (wasteByReason[w.reason] || 0) + (w.cost || 0); });
  const supplierRows = s.suppliers.map((sup) => ({ sup, paid: sum(s.supplierPayments.filter((p) => p.supplierId === sup.id && inRange(p.day, from, to)), (p) => p.amount) }));
  const payrollByEmp = {}; s.payroll.filter((p) => inRange(p.day, from, to)).forEach((p) => { payrollByEmp[p.name] = (payrollByEmp[p.name] || 0) + p.amount; });
  const outstandingSpecials = s.specials.filter((x) => !x.paid && !x.cleared);
  const outstandingSales = s.sales.filter((x) => !x.voided && x.status !== 'paid');
  const outstandingTotal = sum(outstandingSpecials, (x) => x.price - (x.paidAmount || 0)) + sum(outstandingSales, (x) => x.balance);
  return html`<div className="col" style=${{ gap: '16px' }}>
    <${Tabs} value=${period} onChange=${setPeriod} tabs=${[{ id: 'today', label: 'Today' }, { id: 'week', label: 'Last 7 days' }, { id: 'month', label: 'This month' }]} />
    <div className="kpis">
      <div className="kpi"><div className="l">Revenue</div><div className="v">${money(pl.rev)}</div><div className="s">${pl.count} sales</div></div>
      <div className="kpi hl"><div className="l">Gross profit</div><div className="v">${money(pl.gross)}</div><div className="s">${pct(pl.gm)}</div></div>
      <div className="kpi"><div className="l">Expenses & staff cost</div><div className="v">${money(pl.opex)}</div></div>
      <div className="kpi hl"><div className="l">Net profit</div><div className=${'v ' + (pl.net < 0 ? 'neg' : 'pos')}>${money(pl.net)}</div><div className="s">${pct(pl.nm)}</div></div>
    </div>
    <div className="grid2">
      <div className="card"><h3>Sales by section</h3><div className="col gap-sm">${CHANNELS.map((c) => html`<div className="row between" key=${c.id}><span>${c.label}</span><b className="num-strong">${money(pl.ch[c.id].rev)}</b></div>`)}</div></div>
      <div className="card"><h3>Stock loss / waste</h3>${Object.keys(wasteByReason).length ? html`<div className="col gap-sm">${Object.keys(wasteByReason).map((k) => html`<div className="row between" key=${k}><span>${k}</span><b className="num-strong neg">${money(wasteByReason[k])}</b></div>`)}<div className="row between total" style=${{ paddingTop: '6px', borderTop: '1px solid var(--t-border)' }}><span>Total</span><b>${money(pl.shrink)}</b></div></div>` : html`<div className="empty">No waste recorded</div>`}</div>
      <div className="card"><h3>Suppliers</h3>${supplierRows.length ? html`<div className="col gap-sm">${supplierRows.map((r) => html`<div className="row between" key=${r.sup.id}><span>${r.sup.name}</span><span>paid ${money(r.paid)} · owes ${money(r.sup.balance)}</span></div>`)}</div>` : html`<div className="empty">No suppliers on file</div>`}</div>
      <div className="card"><h3>Employee payments</h3>${Object.keys(payrollByEmp).length ? html`<div className="col gap-sm">${Object.keys(payrollByEmp).map((k) => html`<div className="row between" key=${k}><span>${k}</span><b className="num-strong">${money(payrollByEmp[k])}</b></div>`)}</div>` : html`<div className="empty">No payments in this period</div>`}</div>
    </div>
    <div className="card">
      <div className="card-head"><h3>Outstanding customer balances</h3><b>${money(outstandingTotal)}</b></div>
      ${outstandingSpecials.length || outstandingSales.length ? html`<div className="col gap-sm">
        ${outstandingSpecials.map((x) => html`<div className="row between" key=${x.id}><span>Special #${x.no} · ${x.customer || 'walk-in'}${x.phone ? ' · ' + x.phone : ''}</span><b className="num-strong">${money(x.price - (x.paidAmount || 0))}</b></div>`)}
        ${outstandingSales.map((x) => html`<div className="row between" key=${x.id}><span>${receiptNo(x)} · ${SRC_LABEL[x.source] || x.source}</span><b className="num-strong">${money(x.balance)}</b></div>`)}
      </div>` : html`<div className="empty">Nothing outstanding right now</div>`}
    </div>
  </div>`;
}

/* ---------------- USER MANUAL ---------------- */
function ManualPage() {
  const sections = [
    ['Signing in', 'Use the username and password an admin gave you. Signing in is checked by the server, which then issues this browser a session token; until you sign in, no shop data is sent to the screen at all. Admins see everything, including Dashboard and Reports. Cashiers see every other section — Kitchen, Butchery, Inventory, Sales, Debtors, Expenses, Salaries & Advances, Suppliers and Cash & Bank — but never Dashboard or Reports, never Rent expenses, and never the salaries of monthly-paid staff.'],
    ['Butchery', 'Sell raw meat by the quarter, half, three-quarter or full kilogram, by a custom weight, or by how much the customer wants to spend. Chicken sells as a full or half bird. A customer can also be sold to "on credit" — the meat leaves stock now, they pay later, and it shows up under Debtors until cleared.'],
    ['Kitchen — Ready-made', 'Pre-cooked meat sold by the portion, plus sides and drinks, for walk-in customers. A receipt always prints, whether paid or left unpaid. If the kitchen runs low, use "Request meat from butchery" — you can still keep selling while you wait.'],
    ['Kitchen — Specials', 'Made-to-order meat with a cooking style, sides (tap a side to add it, tap again for more) and instructions (tap to select — no typing needed). The customer can pay in full, leave a deposit, or pay later, tracked through Pending → Preparing → Ready → Served in the Specials register.'],
    ['Tables', 'Kitchen opens here. Tap a table to open its order — ready-made meat, sides, drinks and specials all go onto that table\'s bill, and the bill is paid when the table settles. Every order belongs to a table.'],
    ['Inventory Management', 'Five views: Ready-made stock (portions, converted automatically from kg transferred out of the butchery), Meat & butchery (raw stock, receiving, waste, kitchen requests), Drinks (sold to customers), Kitchen ingredients (maize flour, cooking oil — used to prepare food, so they count toward food cost), Consumables (non-food supplies like serviettes, straws and takeaway packaging), and a Movement ledger showing every purchase, transfer, sale, wastage and stock-count adjustment in one place.'],
    ['Sales, Debtors & Voids', 'Every receipt is listed under Sales. Anyone who currently owes money — a Butchery credit customer or an unpaid/deposit special order — is listed under Debtors, with a button to clear their balance. If something was rung up in error, void it and give a reason — the stock it used is put back automatically, and the void is recorded in the Audit Trail.'],
    ['Suppliers & Cash & Bank', 'Suppliers tracks what you owe for stock bought on credit. Cash & Bank reconciles both cash and M-Pesa for the day — expected takings versus what was actually counted or shown on the M-Pesa statement — and records cash banked or M-Pesa withdrawn.'],
    ['Salaries & Advances', 'Record what staff are paid and any advances given — both count as a cost in that month\'s profit figures. Cashiers can record a payment to daily/weekly staff, but monthly salaries are admin-only.'],
    ['Dashboard & Reports', 'Admin only. The Dashboard shows one month\'s profit at a time. Reports gives a shorter view for today, the last 7 days, or this month, including waste, suppliers, staff payments and money still owed by customers.'],
    ['Settings', 'Admins manage prices (every portion — ¼, ½, ¾, 1 kg — priced independently for Butchery, Ready-made and Specials), special-order instructions, business details, the receipt printer, sounds, user accounts, and backups from here.'],
  ];
  return html`<div className="col" style=${{ gap: '14px', maxWidth: '820px' }}>
    <div className="card"><p style=${{ margin: 0 }}>A quick guide to running the till day to day. This POS was developed by <b>David Thairu</b>.</p></div>
    ${sections.map((s) => html`<div className="card" key=${s[0]}><h3>${s[0]}</h3><p style=${{ margin: 0, color: 'var(--t-textSecondary)' }}>${s[1]}</p></div>`)}
  </div>`;
}

/* ---------------- SETUP WIZARD (first run) ---------------- */
function SetupWizard({ onDone }) {
  const { s, update, user } = useApp();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ business: s.settings.business, address: s.settings.address, phone: s.settings.phone, currency: s.settings.currency, tables: s.settings.tables });
  const [pw, setPw] = useState({ admin: '', cashier: '' });
  const steps = ['Welcome', 'Business details', 'Users', 'Prices & stock', 'Done'];
  const finish = () => {
    update((d) => {
      Object.assign(d.settings, f, { setupDone: true });
      if (pw.admin.trim()) { const a = d.users.find((u) => u.role === 'admin'); if (a) a.pass = pw.admin.trim(); }
      if (pw.cashier.trim()) { const c = d.users.find((u) => u.role === 'cashier'); if (c) c.pass = pw.cashier.trim(); }
    });
    onDone();
  };
  const skip = () => { update((d) => { d.settings.setupDone = true; }); onDone(); };
  return html`<div className="login-wrap"><div className="login-card" style=${{ width: 'min(560px,100%)' }}>
    <div className="row between"><div className="logo">🐖</div><button className="btn ghost sm" onClick=${skip}>Skip for now</button></div>
    <h2>Set up ${step === 0 ? 'your shop' : steps[step]}</h2>
    ${step === 0 ? html`<div className="col">
      <p>This short wizard covers the essentials — business details and passwords. Prices, meats, sides, drinks and opening stock already have sample values you can edit any time in Settings, or set up properly right now.</p>
      <button className="btn lg" onClick=${() => setStep(1)}>Get started</button>
    </div>` : null}
    ${step === 1 ? html`<div className="col">
      <${Field} label="Business name"><input className="inp" value=${f.business} onChange=${(e) => setF(Object.assign({}, f, { business: e.target.value }))} /><//>
      <${Field} label="Address"><input className="inp" value=${f.address} onChange=${(e) => setF(Object.assign({}, f, { address: e.target.value }))} /><//>
      <${Field} label="Phone"><input className="inp" value=${f.phone} onChange=${(e) => setF(Object.assign({}, f, { phone: e.target.value }))} /><//>
      <div className="fgrid">
        <${Field} label="Currency label"><input className="inp" value=${f.currency} onChange=${(e) => setF(Object.assign({}, f, { currency: e.target.value }))} /><//>
        <${Field} label="Number of tables"><input className="inp num" type="number" value=${f.tables} onChange=${(e) => setF(Object.assign({}, f, { tables: Math.max(1, num(e.target.value)) }))} /><//>
      </div>
      <div className="row wrap"><button className="btn ghost" onClick=${() => setStep(0)}>Back</button><button className="btn" onClick=${() => setStep(2)}>Next</button></div>
    </div>` : null}
    ${step === 2 ? html`<div className="col">
      <p className="hint" style=${{ margin: 0 }}>Set real passwords for the admin and cashier logins, or leave blank to keep the current ones. Add more staff logins later in Settings → Users.</p>
      <${Field} label="Admin password"><input className="inp" value=${pw.admin} onChange=${(e) => setPw(Object.assign({}, pw, { admin: e.target.value }))} placeholder="Leave blank to keep current" /><//>
      <${Field} label="Cashier password"><input className="inp" value=${pw.cashier} onChange=${(e) => setPw(Object.assign({}, pw, { cashier: e.target.value }))} placeholder="Leave blank to keep current" /><//>
      <div className="row wrap"><button className="btn ghost" onClick=${() => setStep(1)}>Back</button><button className="btn" onClick=${() => setStep(3)}>Next</button></div>
    </div>` : null}
    ${step === 3 ? html`<div className="col">
      <p>Sample prices, meats, sides, drinks and opening stock are already loaded so you can start selling today. Go to <b>Settings → Prices</b> and <b>Consumables</b> whenever you're ready to replace them with your own.</p>
      <div className="row wrap"><button className="btn ghost" onClick=${() => setStep(2)}>Back</button><button className="btn lg" onClick=${finish}>Finish setup</button></div>
    </div>` : null}
  </div></div>`;
}

function SettingsPage() {
  const { s, update, notify, user, ask, replaceAll } = useApp();
  const [tab, setTab] = useState('prices');
  const [sub, setSub] = useState('butchery');
  const [nu, setNu] = useState({ name: '', username: '', pass: '', role: 'cashier' });
  const [restore, setRestore] = useState('');
  const st = s.settings;
  const setS = (k, v) => update((d) => { d.settings[k] = v; });
  const admins = s.users.filter((u) => u.role === 'admin').length;
  const addUser = () => {
    if (!nu.name.trim() || !nu.username.trim() || !nu.pass) { notify('Fill in name, username and password', 'err'); return; }
    if (s.users.some((u) => u.username.toLowerCase() === nu.username.trim().toLowerCase())) { notify('That username is taken', 'err'); return; }
    update((d) => { d.users.push({ id: uid(), username: nu.username.trim(), name: nu.name.trim(), role: nu.role, pass: nu.pass }); });
    setNu({ name: '', username: '', pass: '', role: 'cashier' });
    notify('User added');
  };
  const doRestore = () => {
    let obj = null;
    try { obj = JSON.parse(restore); } catch (e) { obj = null; }
    if (!obj || !Array.isArray(obj.meats) || !Array.isArray(obj.sales)) { notify('That does not look like a SmartPOS backup', 'err'); return; }
    ask('Restore this backup?', 'This replaces everything in the app on this device.', () => { replaceAll(migrate(obj)); setRestore(''); notify('Backup restored'); }, true);
  };
  const copyBackup = () => {
    const txt = JSON.stringify(s);
    try { navigator.clipboard.writeText(txt).then(() => notify('Backup copied. Paste it somewhere safe.'), () => notify('Copy blocked. Select the text and copy it by hand.', 'err')); }
    catch (e) { notify('Copy blocked. Select the text and copy it by hand.', 'err'); }
  };
  const subTabs = [{ id: 'butchery', label: 'Butchery' }, { id: 'ready', label: 'Ready-made' }, { id: 'special', label: 'Specials' }, { id: 'sides', label: 'Sides' }, { id: 'drinks', label: 'Drinks' }];
  return html`<div>
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[{ id: 'prices', label: 'Prices' }, { id: 'instructions', label: 'Instructions' }, { id: 'business', label: 'Business & receipts' }, { id: 'printer', label: 'Printer' }, { id: 'users', label: 'Users' }, { id: 'backup', label: 'Backup' }]} />
    ${tab === 'prices' ? html`<div>
      <div className="alert info mb"><span>ℹ️</span><div>Prices and costs here are sample values. Change them to your own. Every screen (butchery, kitchen, tables, receipts, profit) uses these numbers straight away.</div></div>
      <${Tabs} value=${sub} onChange=${setSub} tabs=${subTabs} />
      ${sub === 'butchery' ? html`<${PriceButchery} />` : sub === 'ready' ? html`<${PriceReady} />` : sub === 'special' ? html`<${PriceSpecials} />` : sub === 'sides' ? html`<${PriceSides} />` : html`<${PriceDrinks} />`}
    </div>` : null}
    ${tab === 'instructions' ? html`<div className="card" style=${{ maxWidth: '640px' }}>
      <h3>Special-order instructions</h3>
      <p className="hint">These appear as clickable options when a cashier builds a special order, so nobody has to type the same phrases over and over.</p>
      <div className="chips mb">${s.instructions.map((x) => html`<span className="chip on" key=${x} style=${{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>${x}<button className="icon-btn" style=${{ color: '#fff', padding: '0 4px' }} onClick=${() => update((d) => { d.instructions = d.instructions.filter((y) => y !== x); })} aria-label=${'Remove ' + x}>✕</button></span>`)}</div>
      <${InstrAdd} />
    </div>` : null}
    ${tab === 'business' ? html`<div className="card" style=${{ maxWidth: '760px' }}><div className="fgrid">
      <${Field} label="Business name"><${TextInput} value=${st.business} onCommit=${(v) => setS('business', v)} /><//>
      <${Field} label="Address (on receipts)"><input className="inp" defaultValue=${st.address} onBlur=${(e) => setS('address', e.target.value.trim())} /><//>
      <${Field} label="Phone (on receipts)"><input className="inp" defaultValue=${st.phone} onBlur=${(e) => setS('phone', e.target.value.trim())} /><//>
      <${Field} label="Receipt footer message"><input className="inp" defaultValue=${st.footer} onBlur=${(e) => setS('footer', e.target.value.trim())} /><//>
      <${Field} label="Currency label"><${TextInput} value=${st.currency} onCommit=${(v) => setS('currency', v)} /><//>
      <${Field} label="Number of tables"><${NumInput} value=${st.tables} min=${1} step="1" onCommit=${(v) => setS('tables', Math.min(60, Math.round(v)))} /><//>
    </div>
    <div className="sec-title mt">Colour theme</div>
    <div className="chips">${[['dark', 'Dark'], ['light', 'Light'], ['warm', 'Warm'], ['auto', 'Match device']].map((t) => html`<button key=${t[0]} className=${'chip' + (st.theme === t[0] ? ' on' : '')} onClick=${() => setS('theme', t[0])}>${t[1]}</button>`)}</div>
    <div className="sec-title mt">Sound</div>
    <div className="chips"><button className=${'chip' + (st.sounds !== false ? ' on' : '')} onClick=${() => setS('sounds', true)}>On</button><button className=${'chip' + (st.sounds === false ? ' on' : '')} onClick=${() => setS('sounds', false)}>Off</button></div>
    <p className="hint" style=${{ marginTop: '6px' }}>A short tone plays for a successful action, and a different one for an error.</p></div>` : null}
    ${tab === 'printer' ? html`<${PrinterTab} />` : null}
    ${tab === 'users' ? html`<div className="col" style=${{ maxWidth: '860px', gap: '16px' }}>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Name</th><th>Username</th><th>Password</th><th>Role</th><th></th></tr></thead>
        <tbody>${s.users.map((u) => html`<tr key=${u.id}>
          <td><${TextInput} value=${u.name} onCommit=${(v) => update((d) => { d.users.find((x) => x.id === u.id).name = v; })} /></td>
          <td>${u.username}</td>
          <td><${TextInput} value=${u.pass} onCommit=${(v) => update((d) => { d.users.find((x) => x.id === u.id).pass = v; })} /></td>
          <td><span className=${'pill ' + (u.role === 'admin' ? 'info' : '')}>${u.role === 'admin' ? 'Admin' : 'Cashier'}</span></td>
          <td>${u.id === user.id || (u.role === 'admin' && admins <= 1) ? html`<span className="muted" style=${{ fontSize: '12px' }}>${u.id === user.id ? 'You' : 'Last admin'}</span>` : html`<button className="btn danger-ghost sm" onClick=${() => ask('Remove ' + u.name + '?', 'They will no longer be able to sign in.', () => update((d) => { d.users = d.users.filter((x) => x.id !== u.id); }), true)}>Remove</button>`}</td>
        </tr>`)}</tbody>
      </table></div>
      <div className="card"><h3>Add a user</h3><div className="fgrid">
        <${Field} label="Name"><input className="inp" value=${nu.name} onChange=${(e) => setNu(Object.assign({}, nu, { name: e.target.value }))} /><//>
        <${Field} label="Username"><input className="inp" value=${nu.username} onChange=${(e) => setNu(Object.assign({}, nu, { username: e.target.value }))} /><//>
        <${Field} label="Password"><input className="inp" value=${nu.pass} onChange=${(e) => setNu(Object.assign({}, nu, { pass: e.target.value }))} /><//>
        <${Field} label="Role"><select className="inp" value=${nu.role} onChange=${(e) => setNu(Object.assign({}, nu, { role: e.target.value }))}><option value="cashier">Cashier</option><option value="admin">Admin</option></select><//>
      </div><div className="mt"><button className="btn" onClick=${addUser}>Add user</button></div></div>
      <p className="hint">Sign-in is checked by the server, and no shop data is sent to this screen until you have signed in successfully. Note that passwords are still stored as plain text inside the database file, so keep that file private and backed up.</p>
    </div>` : null}
    ${tab === 'backup' ? html`<div className="col" style=${{ maxWidth: '860px', gap: '16px' }}>
      <div className="alert"><span>💾</span><div>All data lives in this browser on this device. Copy a backup regularly, especially before clearing browser data or changing devices.</div></div>
      <div className="card"><h3>Back up</h3><textarea className="inp" readOnly value=${JSON.stringify(s)} style=${{ minHeight: '110px', fontFamily: 'monospace', fontSize: '12px' }}></textarea><div className="mt"><button className="btn" onClick=${copyBackup}>Copy backup</button></div></div>
      <div className="card"><h3>Restore</h3><textarea className="inp" value=${restore} onChange=${(e) => setRestore(e.target.value)} placeholder="Paste a backup here" style=${{ minHeight: '110px', fontFamily: 'monospace', fontSize: '12px' }}></textarea><div className="mt row"><button className="btn" disabled=${!restore.trim()} onClick=${doRestore}>Restore backup</button></div></div>
      <div className="card"><h3>Start fresh</h3><p className="hint">Clears all sales, stock and settings and loads the sample data again.</p><button className="btn danger-ghost" onClick=${() => ask('Erase everything?', 'All sales, stock, specials and settings on this device will be replaced with sample data.', () => { replaceAll(seed()); notify('Sample data loaded'); }, true)}>Erase all data</button></div>
    </div>` : null}
  </div>`;
}

/* ---------------- LOGIN ---------------- */
function Login({ users, name, onLogin }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // The server checks the password against the real accounts and returns a
  // session token. The browser never holds a password list to compare against.
  const submit = async () => {
    if (busy) return;
    setErr(''); setBusy(true);
    try { await onLogin(u.trim(), p); } catch (e) { setErr((e && e.message) || 'Sign-in failed.'); setBusy(false); }
  };
  const key = (e) => { if (e.key === 'Enter') submit(); };
  return html`<div className="login-wrap"><div className="login-card">
    <div className="logo">🐖</div>
    <div><h2>${name}</h2><p>Sign in to run the shop.</p></div>
    <${Field} label="Username"><input className="inp" value=${u} onChange=${(e) => { setU(e.target.value); setErr(''); }} onKeyDown=${key} autoFocus autoCapitalize="none" /><//>
    <${Field} label="Password"><input className="inp" type="password" value=${p} onChange=${(e) => { setP(e.target.value); setErr(''); }} onKeyDown=${key} /><//>
    ${err ? html`<div className="err-msg">${err}</div>` : null}
    <button className="btn lg block" disabled=${busy} onClick=${submit}>${busy ? 'Signing in…' : 'Sign in'}</button>
  </div></div>`;
}

/* ---------------- APP SHELL ---------------- */
const NAV = [
  { sec: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: '📊', admin: true }] },
  { sec: 'Operations', items: [{ id: 'kitchen', label: 'Kitchen', icon: '🍖' }, { id: 'butchery', label: 'Butchery', icon: '🥩' }] },
  { sec: 'Stock', items: [{ id: 'inventory', label: 'Inventory Management', icon: '📋' }] },
  { sec: 'Finance', items: [{ id: 'sales', label: 'Sales', icon: '🧾' }, { id: 'debtors', label: 'Debtors', icon: '🧾' }, { id: 'expenses', label: 'Expenses', icon: '💸' }, { id: 'employees', label: 'Salaries & Advances', icon: '👷' }, { id: 'suppliers', label: 'Suppliers', icon: '🚚' }, { id: 'cashbank', label: 'Cash & Bank', icon: '🏦' }, { id: 'reports', label: 'Reports', icon: '📈', admin: true }] },
  { sec: 'Management', items: [{ id: 'audit', label: 'Audit Trail', icon: '🛡️' }, { id: 'settings', label: 'Settings', icon: '⚙️', admin: true }, { id: 'manual', label: 'User Manual', icon: '📘' }] },
];
const TITLES = { dashboard: 'Dashboard', tables: 'Tables', butchery: 'Butchery', kitchen: 'Kitchen', inventory: 'Inventory Management', sales: 'Sales', debtors: 'Debtors', expenses: 'Expenses', employees: 'Salaries & Advances', suppliers: 'Suppliers', cashbank: 'Cash & Bank', reports: 'Reports', audit: 'Audit Trail', settings: 'Settings', manual: 'User Manual' };
const PAGES = { dashboard: DashboardPage, tables: TablesPage, butchery: ButcheryPage, kitchen: KitchenPage, inventory: InventoryPage, sales: SalesPage, debtors: DebtorsPage, expenses: ExpensesPage, employees: EmployeesPage, suppliers: SuppliersPage, cashbank: CashBankPage, reports: ReportsPage, audit: AuditPage, settings: SettingsPage, manual: ManualPage };

/* ---------------- AUDIT TRAIL ---------------- */
const AUDIT_ICON = { 'Void sale': '🗑️', 'Supplier payment': '🚚', 'Salary payment': '👷', 'Staff advance': '👷', 'Cash count': '💵', 'Bank deposit': '🏦' };
function AuditPage() {
  const { s } = useApp();
  const [ym, setYm] = useState(ymOf(dayStr()));
  const [q, setQ] = useState('');
  const r = monthRange(ym);
  let list = s.audit.filter((x) => inRange(x.day, r[0], r[1]));
  const term = q.trim().toLowerCase();
  if (term) list = list.filter((x) => (x.type + ' ' + x.detail + ' ' + x.by).toLowerCase().indexOf(term) >= 0);
  list = list.slice().sort((a, b) => b.at.localeCompare(a.at));
  return html`<div>
    <div className="row wrap between mb"><${MonthPicker} value=${ym} onChange=${setYm} /><input className="inp" style=${{ width: '240px' }} placeholder="Search action, detail, person" value=${q} onChange=${(e) => setQ(e.target.value)} /></div>
    <p className="hint">A record of voids and other sensitive actions — who did what, and when. Nothing here can be edited or removed.</p>
    ${list.length ? html`<div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>When</th><th>Action</th><th>Detail</th><th>By</th></tr></thead>
      <tbody>${list.map((x) => html`<tr key=${x.id}><td>${dateNice(x.day)} ${timeStr(x.at)}</td><td>${AUDIT_ICON[x.type] || '•'} ${x.type}</td><td>${x.detail}</td><td>${x.by}</td></tr>`)}</tbody>
    </table></div>` : html`<div className="empty">No recorded actions in ${monthLabel(ym)}.</div>`}
  </div>`;
}

/* ---------------- EMPLOYEES · SALARIES & ADVANCES ---------------- */
function EmployeeAdd() {
  const { update, notify } = useApp();
  const [f, setF] = useState({ name: '', role: '', payType: 'daily', rate: '' });
  const go = () => {
    if (!f.name.trim()) { notify('Enter a name', 'err'); return; }
    update((d) => addEmployee(d, f));
    setF({ name: '', role: '', payType: 'daily', rate: '' });
    notify('Employee added');
  };
  return html`<div className="card"><h3>Add an employee</h3><div className="fgrid">
    <${Field} label="Name"><input className="inp" value=${f.name} onChange=${(e) => setF(Object.assign({}, f, { name: e.target.value }))} /><//>
    <${Field} label="Role (optional)"><input className="inp" value=${f.role} onChange=${(e) => setF(Object.assign({}, f, { role: e.target.value }))} placeholder="e.g. Cleaner, Chef" /><//>
    <${Field} label="Pay basis"><select className="inp" value=${f.payType} onChange=${(e) => setF(Object.assign({}, f, { payType: e.target.value }))}>${Object.keys(PAY_TYPES).map((k) => html`<option key=${k} value=${k}>${PAY_TYPES[k]}</option>`)}</select><//>
    <${Field} label=${'Usual rate (' + CUR + ')'}><input className="inp num" type="number" value=${f.rate} onChange=${(e) => setF(Object.assign({}, f, { rate: e.target.value }))} /><//>
  </div><div className="mt"><button className="btn" onClick=${go}>Add employee</button></div></div>`;
}
function PayrollForm() {
  const { s, update, notify, user } = useApp();
  const isAdmin = user.role === 'admin';
  const active = s.employees.filter((e) => e.active !== false && (isAdmin || e.payType !== 'monthly'));
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState('salary');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const emp = active.find((e) => e.id === employeeId);
  const go = () => {
    let err = null;
    update((d) => { err = recordPayroll(d, { employeeId, type, amount: num(amount), method, note }, user.name); });
    if (err) { notify(err, 'err'); return; }
    setAmount(''); setNote('');
    notify(type === 'advance' ? 'Advance recorded' : 'Payment recorded');
  };
  return html`<div className="card stick"><h3>Record a payment</h3><div className="col">
    <${Field} label="Employee"><select className="inp" value=${employeeId} onChange=${(e) => setEmployeeId(e.target.value)}><option value="">Choose…</option>${active.map((e) => html`<option key=${e.id} value=${e.id}>${e.name}${e.role ? ' · ' + e.role : ''}</option>`)}</select><//>
    ${emp ? html`<p className="hint" style=${{ margin: 0 }}>${PAY_TYPES[emp.payType]} · usual rate ${money(emp.rate)}</p>` : null}
    <${Field} label="Type"><div className="chips"><button className=${'chip' + (type === 'salary' ? ' on' : '')} onClick=${() => setType('salary')}>Salary payment</button><button className=${'chip' + (type === 'advance' ? ' on' : '')} onClick=${() => setType('advance')}>Advance</button></div><//>
    <${Field} label=${'Amount (' + CUR + ')'}><input className="inp num" type="number" value=${amount} onChange=${(e) => setAmount(e.target.value)} placeholder=${emp ? String(emp.rate) : ''} /><//>
    <${Field} label="Paid via"><select className="inp" value=${method} onChange=${(e) => setMethod(e.target.value)}>${OUT_METHODS.map((m) => html`<option key=${m}>${m}</option>`)}</select><//>
    <${Field} label="Note (optional)"><input className="inp" value=${note} onChange=${(e) => setNote(e.target.value)} /><//>
    <button className="btn lg" disabled=${!employeeId} onClick=${go}>Save</button>
  </div></div>`;
}
function EmployeesPage() {
  const { s, update, ask, user } = useApp();
  const isAdmin = user.role === 'admin';
  const monthlyIds = new Set(s.employees.filter((e) => e.payType === 'monthly').map((e) => e.id));
  const [ym, setYm] = useState(ymOf(dayStr()));
  const r = monthRange(ym);
  const list = s.payroll.filter((p) => inRange(p.day, r[0], r[1]) && (isAdmin || !monthlyIds.has(p.employeeId))).sort((a, b) => b.at.localeCompare(a.at));
  const total = sum(list, (p) => p.amount);
  const byEmp = {};
  list.forEach((p) => { byEmp[p.name] = (byEmp[p.name] || 0) + p.amount; });
  const employeeRows = isAdmin ? s.employees : s.employees.filter((e) => e.payType !== 'monthly');
  return html`<div className="split">
    <div>
      <div className="row wrap between mb"><${MonthPicker} value=${ym} onChange=${setYm} /><b>${monthLabel(ym)} total: ${money(total)}</b></div>
      <p className="hint">Salaries and advances are counted as a staff cost in the month they're paid, and reduce net profit accordingly.${!isAdmin ? ' Monthly-paid staff salaries are only visible to admins.' : ''}</p>
      ${list.length ? html`<div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Date</th><th>Employee</th><th>Type</th><th>Via</th><th>Note</th><th className="r">Amount</th></tr></thead>
        <tbody>${list.map((p) => html`<tr key=${p.id}><td>${dateNice(p.day)}</td><td>${p.name}</td><td><span className="pill">${p.type === 'advance' ? 'Advance' : 'Salary'}</span></td><td>${p.method}</td><td>${p.note || html`<span className="muted">—</span>`}</td><td className="r num-strong">${money(p.amount)}</td></tr>`)}</tbody>
      </table></div>` : html`<div className="empty">No payments recorded for ${monthLabel(ym)}.</div>`}
      ${Object.keys(byEmp).length ? html`<div className="card mt"><h3>By employee</h3><div className="chips">${Object.keys(byEmp).map((k) => html`<span className="chip" key=${k}>${k}<small>${money(byEmp[k])}</small></span>`)}</div></div>` : null}
      <div className="card mt">
        <div className="card-head"><h3>Employees</h3></div>
        ${employeeRows.length ? html`<div className="tbl-wrap" style=${{ border: 0 }}><table className="tbl"><thead><tr><th>Name</th><th>Role</th><th>Pay basis</th><th className="r">Usual rate</th><th></th></tr></thead>
          <tbody>${employeeRows.map((e) => html`<tr key=${e.id} className=${e.active === false ? 'dim' : ''}><td>${e.name}</td><td>${e.role || '—'}</td><td>${PAY_TYPES[e.payType]}</td><td className="r">${isAdmin || e.payType !== 'monthly' ? money(e.rate) : html`<span className="muted">—</span>`}</td><td><button className="btn ghost sm" onClick=${() => update((d) => { d.employees.find((x) => x.id === e.id).active = e.active === false; })}>${e.active === false ? 'Reactivate' : 'Mark left'}</button></td></tr>`)}</tbody>
        </table></div>` : html`<div className="empty">No employees added yet</div>`}
      </div>
      <div className="mt">${isAdmin ? html`<${EmployeeAdd} />` : null}</div>
    </div>
    <${PayrollForm} />
  </div>`;
}

/* ---------------- SUPPLIERS ---------------- */
function SupplierAdd() {
  const { update, notify } = useApp();
  const [name, setName] = useState(''), [phone, setPhone] = useState('');
  const go = () => { if (!name.trim()) { notify('Enter a name', 'err'); return; } update((d) => addSupplier(d, name, phone)); setName(''); setPhone(''); notify('Supplier added'); };
  return html`<div className="row wrap"><input className="inp" style=${{ width: '220px' }} placeholder="Supplier name" value=${name} onChange=${(e) => setName(e.target.value)} /><input className="inp" style=${{ width: '160px' }} placeholder="Phone (optional)" value=${phone} onChange=${(e) => setPhone(e.target.value)} /><button className="btn" onClick=${go}>Add supplier</button></div>`;
}
function SupplierPayModal({ sup, onClose }) {
  const { update, notify, user } = useApp();
  const [amount, setAmount] = useState(String(sup.balance > 0 ? sup.balance : ''));
  const [method, setMethod] = useState('Cash');
  const go = () => {
    let err = null;
    update((d) => { err = paySupplier(d, sup.id, num(amount), method, user.name); });
    if (err) { notify(err, 'err'); return; }
    notify('Payment recorded');
    onClose();
  };
  return html`<${Modal} title=${'Pay ' + sup.name} onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn" onClick=${go}>Record payment</button>`}>
    <div className="row between mb"><span className="sec">Currently owed</span><b>${money(sup.balance)}</b></div>
    <${Field} label=${'Amount (' + CUR + ')'}><input className="inp num" type="number" value=${amount} onChange=${(e) => setAmount(e.target.value)} autoFocus /><//>
    <div className="mt"><${Field} label="Paid via"><select className="inp" value=${method} onChange=${(e) => setMethod(e.target.value)}>${OUT_METHODS.map((m) => html`<option key=${m}>${m}</option>`)}</select><//></div>
  <//>`;
}
function SuppliersPage() {
  const { s } = useApp();
  const [payFor, setPayFor] = useState(null);
  const owed = sum(s.suppliers, (x) => x.balance);
  const recent = s.supplierPayments.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20);
  return html`<div className="split">
    <div>
      <p className="hint">Suppliers you buy meat or supplies from on credit. A supplier's balance is what you still owe them — it isn't an expense until you actually pay it.</p>
      ${owed > 0 ? html`<div className="alert mb"><span>🚚</span><div>Total owed to suppliers: <b>${money(owed)}</b></div></div>` : null}
      ${s.suppliers.length ? html`<div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Supplier</th><th>Phone</th><th className="r">Balance owed</th><th></th></tr></thead>
        <tbody>${s.suppliers.map((x) => html`<tr key=${x.id}><td><b>${x.name}</b></td><td>${x.phone || '—'}</td><td className=${'r num-strong' + (x.balance > 0 ? ' neg' : '')}>${money(x.balance)}</td><td className="right">${x.balance > 0 ? html`<button className="btn good sm" onClick=${() => setPayFor(x)}>Pay</button>` : null}</td></tr>`)}</tbody>
      </table></div>` : html`<div className="empty">No suppliers on file yet.</div>`}
      <div className="card mt"><h3>Add a supplier</h3><${SupplierAdd} /></div>
      <div className="card mt"><div className="card-head"><h3>Recent payments</h3></div>
        ${recent.length ? html`<div className="tbl-wrap" style=${{ border: 0 }}><table className="tbl"><thead><tr><th>Date</th><th>Supplier</th><th>Via</th><th className="r">Amount</th></tr></thead>
          <tbody>${recent.map((p) => html`<tr key=${p.id}><td>${dateNice(p.day)}</td><td>${p.name}</td><td>${p.method}</td><td className="r num-strong">${money(p.amount)}</td></tr>`)}</tbody></table></div>` : html`<div className="empty">No payments recorded yet</div>`}
      </div>
    </div>
    <div className="card"><h3>How supplier credit works</h3>
      <p className="hint" style=${{ margin: 0 }}>When you receive stock in Butchery, Kitchen or Consumables, choose "On credit" and pick a supplier — the cost is added to their balance here instead of counting as cash spent that day. Come back here to record what you actually pay them; that's what shows up in cash reconciliation.</p>
    </div>
    ${payFor ? html`<${SupplierPayModal} sup=${payFor} onClose=${() => setPayFor(null)} />` : null}
  </div>`;
}

/* ---------------- CASH & BANK ---------------- */
function CashBankPage() {
  const { s, update, notify, user } = useApp();
  const [day, setDay] = useState(dayStr());
  const [openFloat, setOpenFloat] = useState('0');
  const [openMpesa, setOpenMpesa] = useState('0');
  const [counted, setCounted] = useState('');
  const [countedMpesa, setCountedMpesa] = useState('');
  const [depAmt, setDepAmt] = useState('');
  const [depMethod, setDepMethod] = useState('cash');
  const [depRef, setDepRef] = useState('');
  const existing = s.reconciliations.find((x) => x.day === day);
  const t = tillExpected(s, day, num(openFloat), num(openMpesa));
  const save = () => {
    if (counted === '') { notify('Enter the counted cash amount', 'err'); return; }
    update((d) => recordReconciliation(d, day, num(openFloat), num(counted), num(openMpesa), countedMpesa === '' ? null : num(countedMpesa), user.name));
    notify('Till count saved');
  };
  const deposit = () => {
    let err = null;
    update((d) => { err = recordDeposit(d, num(depAmt), depRef, depMethod, user.name); });
    if (err) { notify(err, 'err'); return; }
    setDepAmt(''); setDepRef('');
    notify((depMethod === 'mpesa' ? 'M-Pesa withdrawal' : 'Deposit') + ' recorded');
  };
  const deposits = s.deposits.filter((x) => x.day === day);
  const history = s.reconciliations.slice().sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14);
  const row = (label, val, neg) => html`<tr><td>${label}</td><td className=${'r' + (neg ? ' neg' : '')}>${neg ? '-' : ''}${money(val)}</td></tr>`;
  return html`<div className="split">
    <div className="col" style=${{ gap: '16px' }}>
      <div className="card">
        <div className="card-head"><h3>Till count</h3><input className="inp" type="date" style=${{ width: '160px' }} value=${day} max=${dayStr()} onChange=${(e) => setDay(e.target.value || dayStr())} /></div>
        <div className="grid2">
          <div>
            <div className="sec-title">Cash</div>
            <div className="fgrid">
              <${Field} label="Opening float"><input className="inp num" type="number" value=${openFloat} onChange=${(e) => setOpenFloat(e.target.value)} /><//>
              <${Field} label="Counted in the till"><input className="inp num" type="number" value=${counted} onChange=${(e) => setCounted(e.target.value)} /><//>
            </div>
            <div className="tbl-wrap mt" style=${{ border: 0 }}><table className="tbl">
              <tbody>
                ${row('Cash sales collected', t.cash.salesIn)}
                ${row('Paid for stock', t.cash.purchasesOut, true)}
                ${row('Expenses', t.cash.expensesOut, true)}
                ${row('To suppliers', t.cash.supplierOut, true)}
                ${row('Salaries & advances', t.cash.payrollOut, true)}
                ${row('Banked today', t.cash.depositsOut, true)}
                <tr className="total"><td>Expected cash</td><td className="r">${money(t.cash.expected)}</td></tr>
              </tbody>
            </table></div>
            ${counted !== '' ? html`<div className="row between mt"><span className="sec">Difference</span><b className=${num(counted) - t.cash.expected < 0 ? 'neg' : num(counted) - t.cash.expected > 0 ? 'pos' : ''}>${money(num(counted) - t.cash.expected)}</b></div>` : null}
          </div>
          <div>
            <div className="sec-title">M-Pesa</div>
            <div className="fgrid">
              <${Field} label="Opening balance"><input className="inp num" type="number" value=${openMpesa} onChange=${(e) => setOpenMpesa(e.target.value)} /><//>
              <${Field} label="Balance per M-Pesa statement" sub="Optional — leave blank to skip checking this"><input className="inp num" type="number" value=${countedMpesa} onChange=${(e) => setCountedMpesa(e.target.value)} /><//>
            </div>
            <div className="tbl-wrap mt" style=${{ border: 0 }}><table className="tbl">
              <tbody>
                ${row('M-Pesa sales collected', t.mpesa.salesIn)}
                ${row('Paid for stock', t.mpesa.purchasesOut, true)}
                ${row('Expenses', t.mpesa.expensesOut, true)}
                ${row('To suppliers', t.mpesa.supplierOut, true)}
                ${row('Salaries & advances', t.mpesa.payrollOut, true)}
                ${row('Withdrawn to bank today', t.mpesa.depositsOut, true)}
                <tr className="total"><td>Expected M-Pesa balance</td><td className="r">${money(t.mpesa.expected)}</td></tr>
              </tbody>
            </table></div>
            ${countedMpesa !== '' ? html`<div className="row between mt"><span className="sec">Difference</span><b className=${num(countedMpesa) - t.mpesa.expected < 0 ? 'neg' : num(countedMpesa) - t.mpesa.expected > 0 ? 'pos' : ''}>${money(num(countedMpesa) - t.mpesa.expected)}</b></div>` : null}
          </div>
        </div>
        <button className="btn lg block mt" onClick=${save}>Save till count</button>
        ${existing ? html`<p className="hint" style=${{ margin: '8px 0 0' }}>Already counted today at ${timeStr(existing.at)}: cash variance ${money(existing.variance)}${existing.varianceMpesa !== null ? ', M-Pesa variance ' + money(existing.varianceMpesa) : ''}.</p>` : null}
      </div>
      <div className="card"><div className="card-head"><h3>Recent till counts</h3></div>
        ${history.length ? html`<div className="tbl-wrap" style=${{ border: 0 }}><table className="tbl"><thead><tr><th>Date</th><th className="r">Cash expected</th><th className="r">Cash counted</th><th className="r">Cash variance</th><th className="r">M-Pesa variance</th></tr></thead>
          <tbody>${history.map((x) => html`<tr key=${x.id}><td>${dateNice(x.day)}</td><td className="r">${money(x.expected)}</td><td className="r">${money(x.counted)}</td><td className=${'r ' + (x.variance < 0 ? 'neg' : x.variance > 0 ? 'pos' : '')}>${money(x.variance)}</td><td className="r">${x.varianceMpesa === null || x.varianceMpesa === undefined ? html`<span className="muted">—</span>` : html`<span className=${x.varianceMpesa < 0 ? 'neg' : x.varianceMpesa > 0 ? 'pos' : ''}>${money(x.varianceMpesa)}</span>`}</td></tr>`)}</tbody></table></div>` : html`<div className="empty">No till counts recorded yet</div>`}
      </div>
    </div>
    <div className="card stick">
      <h3>Bank movements</h3>
      <p className="hint">Cash taken to the bank, or M-Pesa withdrawn out — either way this is reflected in the till count above for that day.</p>
      <div className="col">
        <${Field} label="Type"><div className="chips"><button className=${'chip' + (depMethod === 'cash' ? ' on' : '')} onClick=${() => setDepMethod('cash')}>Cash deposit</button><button className=${'chip' + (depMethod === 'mpesa' ? ' on' : '')} onClick=${() => setDepMethod('mpesa')}>M-Pesa withdrawal</button></div><//>
        <${Field} label=${'Amount (' + CUR + ')'}><input className="inp num" type="number" value=${depAmt} onChange=${(e) => setDepAmt(e.target.value)} /><//>
        <${Field} label="Reference / slip number (optional)"><input className="inp" value=${depRef} onChange=${(e) => setDepRef(e.target.value)} /><//>
        <button className="btn" onClick=${deposit}>Record</button>
      </div>
      ${deposits.length ? html`<div className="mt"><div className="sec-title">Recorded on ${dateNice(day)}</div><div className="col gap-sm">${deposits.map((x) => html`<div className="row between" key=${x.id}><span>${timeStr(x.at)} · ${(x.method || 'cash') === 'mpesa' ? 'M-Pesa' : 'Cash'} · ${x.by}${x.ref ? ' · ' + x.ref : ''}</span><b>${money(x.amount)}</b></div>`)}</div></div>` : null}
    </div>
  </div>`;
}

const sessionToken = () => { try { return sessionStorage.getItem('mh_token'); } catch (e) { return null; } };
const storeSession = (token, user) => { try { sessionStorage.setItem('mh_token', token); sessionStorage.setItem('mh_user', JSON.stringify(user)); } catch (e) { /* ignore */ } };
const clearSession = () => { try { sessionStorage.removeItem('mh_token'); sessionStorage.removeItem('mh_user'); } catch (e) { /* ignore */ } };

// Boot order matters: fetch only the public sign-in list first, sign in, and
// only then download the shop's data. Before this, the browser downloaded
// everything — including every password — before anyone had signed in.
function AppLoader() {
  const [phase, setPhase] = useState('boot');
  const [boot, setBoot] = useState(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const d = await apiLoadState();
      setData(d); setErr(null); setPhase('ready');
    } catch (e) {
      if (e && e.status === 401) { clearSession(); setAuthToken(null); setPhase('login'); }
      else { setErr(e); setPhase('error'); }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    apiBoot()
      .then((b) => {
        if (!alive) return;
        setBoot(b);
        const t = sessionToken();
        if (t) { setAuthToken(t); return load(); }
        setPhase('login');
      })
      .catch((e) => { if (alive) { setErr(e); setPhase('error'); } });
    return () => { alive = false; };
  }, []);

  const doLogin = async (username, pass) => {
    const d = await apiLogin(username, pass);
    storeSession(d.token, d.user);
    await load();
  };

  if (phase === 'boot' || phase === 'loading') return html`<div className="login-wrap"><div className="login-card center"><div className="logo">🐖</div><p>${phase === 'boot' ? 'Connecting to the local server…' : 'Loading your data…'}</p></div></div>`;
  if (phase === 'error') return html`<div className="login-wrap"><div className="login-card">
    <div className="logo">⚠️</div>
    <h2>Can't reach the local server</h2>
    <p>Make sure the SmartPOS server is running (open a terminal in the project folder and run <code>node server.js</code>), then reload this page.</p>
    <button className="btn lg block" onClick=${() => window.location.reload()}>Try again</button>
  </div></div>`;
  if (phase === 'login') return html`<${Login} users=${boot ? boot.users : []} name=${boot ? boot.business : 'SmartPOS'} onLogin=${doLogin} />`;
  return html`<${App} initial=${data} />`;
}
function GlobalSearch({ isAdmin }) {
  const { s, go } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const term = q.trim().toLowerCase();
  const results = [];
  if (term.length >= 2) {
    s.sales.filter((x) => !x.voided).forEach((x) => { if ((receiptNo(x) + ' ' + x.cashier + ' ' + x.lines.map((l) => l.name).join(' ')).toLowerCase().includes(term)) results.push({ icon: '🧾', label: receiptNo(x) + ' · ' + money(x.total), sub: SRC_LABEL[x.source] || x.source, page: 'sales' }); });
    s.specials.forEach((x) => { if ((x.customer + ' ' + x.phone + ' ' + x.meat + ' #' + x.no).toLowerCase().includes(term)) results.push({ icon: '🍖', label: 'Special #' + x.no + (x.customer ? ' · ' + x.customer : ''), sub: x.meat + (x.phone ? ' · ' + x.phone : ''), page: 'kitchen' }); });
    if (isAdmin) s.suppliers.forEach((x) => { if (x.name.toLowerCase().includes(term)) results.push({ icon: '🚚', label: x.name, sub: 'Owed ' + money(x.balance), page: 'suppliers' }); });
    s.meats.forEach((m) => { if (m.name.toLowerCase().includes(term)) results.push({ icon: m.emoji, label: m.name, sub: 'Butchery ' + r3(m.stock) + (m.kind === 'bird' ? ' birds' : ' kg'), page: 'butchery' }); });
    [].concat(s.sides, s.cons.filter((c) => c.cat === 'drink')).forEach((x) => { if (x.name.toLowerCase().includes(term)) results.push({ icon: '🍽️', label: x.name, sub: money(x.price), page: 'kitchen' }); });
  }
  return html`<div style=${{ position: 'relative' }}>
    <input className="inp" style=${{ width: '220px' }} placeholder="Search sales, specials, suppliers…" value=${q}
      onChange=${(e) => { setQ(e.target.value); setOpen(true); }} onFocus=${() => setOpen(true)} onBlur=${() => setTimeout(() => setOpen(false), 150)} />
    ${open && term.length >= 2 ? html`<div className="card" style=${{ position: 'absolute', top: '110%', right: 0, width: '300px', maxHeight: '340px', overflow: 'auto', zIndex: 50, padding: '8px' }}>
      ${results.length ? results.slice(0, 12).map((r, i) => html`<button key=${i} className="nav-item" style=${{ color: 'var(--t-text)' }} onClick=${() => { go(r.page); setQ(''); setOpen(false); }}><span className="ic">${r.icon}</span><span style=${{ textAlign: 'left' }}><b style=${{ display: 'block' }}>${r.label}</b><small className="muted">${r.sub}</small></span></button>`) : html`<div className="empty" style=${{ padding: '10px' }}>No matches</div>`}
    </div>` : null}
  </div>`;
}

function App({ initial }) {
  const [s, setS] = useState(initial);
  const ref = useRef(s);
  const [user, setUser] = useState(() => { try { const u = sessionStorage.getItem('mh_user'); return u ? JSON.parse(u) : null; } catch (e) { return null; } });
  const [page, setPage] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [confirmBox, setConfirmBox] = useState(null);
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [conflict, setConflict] = useState(null);
  // Watch for a refused save. The server refuses one when another screen saved
  // first, which is how we avoid silently deleting that screen's sales.
  useEffect(() => {
    const id = setInterval(() => {
      const c = window.__smartposConflict;
      setConflict((cur) => (c && (!cur || cur.at !== c.at) ? c : cur));
    }, 1500);
    return () => clearInterval(id);
  }, []);
  CUR = s.settings.currency || 'KSh';

  const update = useCallback((fn) => { const next = clone(ref.current); const res = fn(next); ref.current = next; setS(next); saveState(next); return res; }, []);
  const replaceAll = useCallback((next) => { ref.current = next; setS(next); saveState(next); flushSave(); }, []);
  const notify = useCallback((msg, kind) => { setToast({ msg, kind: kind || 'ok', id: Date.now() }); if (ref.current.settings.sounds !== false) (kind === 'err' ? SOUND.err : SOUND.ok)(); }, []);
  // opts is optional and additive: { hideStatus, orderNo, tableNo, kind }.
  // Existing callers pass only (sale, auto) and are unaffected.
  const showReceipt = useCallback((sale, auto, opts) => setReceipt({ sale, auto: !!auto, opts: opts || null, id: Date.now() }), []);
  const ask = useCallback((title, msg, onYes, danger) => setConfirmBox({ title, msg, onYes, danger }), []);
  const requestMore = useCallback((meatId, qty) => {
    const u = user;
    const res = update((d) => {
      if (d.requests.some((r) => r.meatId === meatId && r.status === 'pending')) return 'dup';
      const m = meatOf(d, meatId);
      d.requests.push({ id: uid(), day: dayStr(), at: new Date().toISOString(), meatId, name: m.name, qty: qty > 0 ? qty : 10, by: u ? u.name : 'Kitchen', status: 'pending' });
      return 'ok';
    });
    notify(res === 'dup' ? 'A request for that meat is already waiting' : 'Request sent to the butchery', res === 'dup' ? 'err' : 'ok');
  }, [user]);

  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { document.documentElement.setAttribute('data-skin', s.settings.theme || 'dark'); }, [s.settings.theme]);
  useEffect(() => {
    const roll = () => { if (!ref.current.consDays[dayStr()]) update((d) => { ensureDay(d, dayStr()); }); };
    roll();
    const t = setInterval(roll, 60000);
    const onHide = () => flushSave();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(t); window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  const logout = () => { apiLogout(); clearSession(); setAuthToken(null); flushSave(); window.location.reload(); };
  const resolveConflict = async () => {
    try {
      const d = await apiReloadAfterConflict();
      replaceAll(d);
      setConflict(null);
      notify('Latest data loaded · carry on where you left off');
    } catch (e) { notify('Could not reload — check the server is running', 'err'); }
  };
  const ctx = { s, update, replaceAll, notify, user, showReceipt, ask, requestMore, go: (p) => { setPage(p); setNavOpen(false); } };

  if (!user) { setTimeout(() => window.location.reload(), 0); return html`<div className="login-wrap"><div className="login-card center"><div className="logo">🐖</div><p>Returning to sign-in…</p></div></div>`; }
  const live = s.users.find((x) => x.id === user.id) || user;
  if (live.role === 'admin' && !s.settings.setupDone) return html`<${Ctx.Provider} value=${ctx}><${SetupWizard} onDone=${() => setPage(null)} /><//>`;
  const isAdmin = live.role === 'admin';
  const cur = page && PAGES[page] && (isAdmin || !(NAV.some((g) => g.items.some((i) => i.id === page && i.admin)))) ? page : (isAdmin ? 'dashboard' : 'kitchen');
  const Page = PAGES[cur];
  const badges = { inventory: consLow(s).length + meatLow(s).length + readyLowMeats(s).length, kitchen: s.specials.filter((x) => !x.cleared && x.status !== 'served').length, debtors: debtors(s).length };
  const themes = ['dark', 'light', 'warm', 'auto'];
  const nextTheme = () => update((d) => { d.settings.theme = themes[(themes.indexOf(d.settings.theme) + 1) % themes.length]; });
  const ctx2 = Object.assign({}, ctx, { user: live });

  return html`<${Ctx.Provider} value=${ctx2}>
    <div className=${'app' + (navOpen ? ' nav-open' : '')}>
      ${conflict ? html`<div style=${{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'var(--t-danger)', color: '#fff', padding: '14px 18px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 6px 24px #00000066' }}>
        <b>Data changed elsewhere</b>
        <span style=${{ flex: 1, minWidth: '240px' }}>Another screen saved changes while you were working, so this screen's copy is out of date. Nothing has been deleted, but your last change was not saved. Load the latest data to carry on.</span>
        <button className="btn sm" style=${{ background: '#fff', color: '#1b1c26' }} onClick=${resolveConflict}>Load latest data</button>
      </div>` : null}
      <aside className="sidebar">
        <div className="brand"><div className="logo">🐖</div><div><b>${s.settings.business}</b><small>SmartPOS v2</small></div></div>
        <nav className="nav">${NAV.map((g) => {
          const items = g.items.filter((i) => !i.admin || isAdmin);
          if (!items.length) return null;
          return html`<div key=${g.sec}><div className="nav-sec">${g.sec}</div>${items.map((i) => html`<button key=${i.id} className=${'nav-item' + (cur === i.id ? ' active' : '')} onClick=${() => { setPage(i.id); setNavOpen(false); }}><span className="ic">${i.icon}</span>${i.label}${badges[i.id] ? html`<span className="bdg">${badges[i.id]}</span>` : null}</button>`)}</div>`;
        })}</nav>
        <div className="side-foot"><b>${live.name}</b>${isAdmin ? 'Administrator' : 'Cashier'}<div className="mt"><button className="btn ghost sm" onClick=${logout}>Sign out</button></div></div>
      </aside>
      <div className="scrim" onClick=${() => setNavOpen(false)}></div>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick=${() => setNavOpen(true)} aria-label="Open menu">☰</button>
          <h1>${TITLES[cur]}</h1>
          <span className="grow"></span>
          <${GlobalSearch} isAdmin=${isAdmin} />
          <span className="date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <button className="btn ghost sm" onClick=${nextTheme} title="Change colour theme">◐ Theme</button>
        </header>
        <main className="content"><${Page} key=${cur} /></main>
      </div>
    </div>
    ${receipt ? html`<${ReceiptModal} key=${receipt.id} sale=${receipt.sale} auto=${receipt.auto} opts=${receipt.opts} onClose=${() => setReceipt(null)} />` : null}
    ${confirmBox ? html`<${Modal} title=${confirmBox.title} onClose=${() => setConfirmBox(null)} footer=${html`<button className="btn ghost" onClick=${() => setConfirmBox(null)}>Cancel</button><button className=${'btn' + (confirmBox.danger ? ' warn' : '')} onClick=${() => { const f = confirmBox.onYes; setConfirmBox(null); f(); }}>Confirm</button>`}><p>${confirmBox.msg}</p><//>` : null}
    ${toast ? html`<div className=${'toast' + (toast.kind === 'err' ? ' err' : '')} role="status" key=${toast.id}>${toast.msg}</div>` : null}
  <//>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AppLoader));
