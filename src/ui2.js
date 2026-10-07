/* =====================================================================
   UI — Part 2: Butchery · Kitchen · Tables
   ===================================================================== */
const Fragment = React.Fragment;

/* ---------------- stock modal: receive / waste / transfer ---------------- */
function StockModal({ type, meat, onClose }) {
  const { s: st0, update, notify, user } = useApp();
  const m = meat;
  const grams = st0.settings.portionGrams || 250;
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState(WASTE_REASONS[0]);
  const [loc, setLoc] = useState('butchery');
  const wasteUnit = type === 'waste' && loc === 'kitchen' ? 'portions' : m.kind === 'bird' ? 'birds' : 'kg';
  const unit = type === 'waste' ? wasteUnit : m.kind === 'bird' ? 'birds' : 'kg';
  const titles = { receive: 'Receive ' + m.name + ' into butchery', waste: 'Record waste · ' + m.name, transfer: 'Take ' + m.name + ' to the kitchen' };
  const go = () => {
    const q = num(qty);
    if (!(q > 0)) { notify('Enter a quantity above zero', 'err'); return; }
    let err = null;
    update((d) => {
      if (type === 'receive') receiveMeat(d, m.id, q, num(cost), supplierId || null, supplierId ? method : 'cash', user.name);
      else if (type === 'waste') err = recordWaste(d, { loc, meatId: m.id, qty: loc === 'kitchen' ? Math.round(q) : q, reason, by: user.name });
      else err = transferToKitchen(d, m.id, q, user.name, 'morning');
    });
    if (err) { notify(err, 'err'); return; }
    notify(type === 'receive' ? 'Stock received' : type === 'waste' ? 'Waste recorded' : q + ' kg of ' + m.name + ' moved to the kitchen');
    onClose();
  };
  return html`<${Modal} title=${titles[type]} onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn" onClick=${go}>${type === 'receive' ? 'Add to stock' : type === 'waste' ? 'Record waste' : 'Move to kitchen'}</button>`}>
    <div className="col">
      ${type === 'transfer' ? html`<p className="hint">Send any amount to the kitchen — it's converted into ${grams}g portions automatically. Butchery has ${r3(m.stock)} kg of ${m.name} right now.</p>` : null}
      ${type === 'waste' && m.kind === 'kg' ? html`<${Field} label="Where was it lost?"><select className="inp" value=${loc} onChange=${(e) => setLoc(e.target.value)}><option value="butchery">Butchery (${r3(m.stock)} kg)</option><option value="kitchen">Kitchen ready-made (${portionsLabel(grams, st0.kitchen[m.id] || 0)})</option></select><//>` : null}
      <${Field} label=${'Quantity (' + unit + ')'}><input className="inp num" type="number" inputMode="decimal" step=${loc === 'kitchen' && type === 'waste' ? '1' : 'any'} value=${qty} onChange=${(e) => setQty(e.target.value)} autoFocus /><//>
      ${type === 'receive' ? html`
        <${Field} label="Total amount paid (KSh)" sub="Used to update the average buying cost, which drives your profit figures."><input className="inp num" type="number" inputMode="decimal" value=${cost} onChange=${(e) => setCost(e.target.value)} /><//>
        <${Field} label="Supplier (optional)"><select className="inp" value=${supplierId} onChange=${(e) => setSupplierId(e.target.value)}><option value="">No supplier on file</option>${st0.suppliers.map((x) => html`<option key=${x.id} value=${x.id}>${x.name}</option>`)}</select><//>
        ${supplierId ? html`<${Field} label="How is this being paid?"><select className="inp" value=${method} onChange=${(e) => setMethod(e.target.value)}><option value="cash">Paid now · cash</option><option value="mpesa">Paid now · M-Pesa</option><option value="credit">On credit · added to supplier balance</option></select><//>` : null}` : null}
      ${type === 'waste' ? html`<${Field} label="Reason"><select className="inp" value=${reason} onChange=${(e) => setReason(e.target.value)}>${WASTE_REASONS.map((r) => html`<option key=${r}>${r}</option>`)}</select><//>` : null}
    </div>
  <//>`;
}

/* ---------------- BUTCHERY ---------------- */
function ButcherySell() {
  const { s, update, notify, user, showReceipt } = useApp();
  const [sel, setSel] = useState(null);
  const [cart, setCart] = useState([]);
  const [kg, setKg] = useState('');
  const [amt, setAmt] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const meats = activeMeats(s).filter((x) => x.butchery > 0);
  const m = meats.find((x) => x.id === sel);
  const inCart = (id) => sum(cart.filter((l) => l.mid === id), (l) => l.qty);
  const avail = (mm) => r3(mm.stock - inCart(mm.id));
  const total = sum(cart, (l) => l.total);
  const add = (mm, qty, tot, label) => {
    if (!(qty > 0)) { notify('Enter a quantity', 'err'); return; }
    if (qty > avail(mm) + 1e-9) { notify('Only ' + r3(avail(mm)) + (mm.kind === 'bird' ? ' birds' : ' kg') + ' of ' + mm.name + ' left', 'err'); return; }
    setCart((c) => c.concat([{ key: 'b-' + uid(), kind: 'meat', ch: 'butchery', mid: mm.id, name: mm.name, label, qty, unit: mm.kind === 'bird' ? 'bird' : 'kg', total: tot, cost: r2(mm.cost * qty), deduct: [{ loc: 'butchery', id: mm.id, qty }] }]));
    setKg(''); setAmt('');
  };
  const confirm = (pay, doPrint, customer) => {
    const res = update((d) => {
      const err = checkStock(d, cart.flatMap((l) => l.deduct));
      if (err) return { err };
      return { sale: createSale(d, { source: 'butchery', lines: cart, pay, cashier: user.name, customer }) };
    });
    if (res.err) { notify(res.err, 'err'); return; }
    setCart([]); setPayOpen(false); setSel(null);
    notify(pay ? 'Sale complete · ' + money(res.sale.total) : 'Sold on credit to ' + res.sale.customer.name);
    if (doPrint) showReceipt(res.sale, true);
  };
  const kgQty = num(kg), amtNum = Math.round(num(amt));
  return html`<div className="split">
    <div>
      <p className="hint">Raw meat only. Beef, goat and pork sell in ¼, ½, ¾ or 1 kg, by custom weight, or by amount in ${CUR}. Chicken sells as a full or half bird.</p>
      ${meats.length ? null : html`<div className="empty">No butchery prices set. An admin can add them in Settings → Prices → Butchery.</div>`}
      <div className="meat-grid">
        ${meats.map((mm) => {
          const a = avail(mm);
          return html`<button key=${mm.id} className=${'meat-card' + (sel === mm.id ? ' sel' : '')} onClick=${() => { setSel(mm.id); setKg(''); setAmt(''); }} disabled=${a <= 0}>
            <div className="mc-top">
              <span className="mc-emoji">${mm.emoji}</span>
              <div><div className="mc-name">${mm.name}</div><div className="mc-sub">${mm.kind === 'bird' ? 'Full ' + money(mm.butcheryPortions.full) + ' · Half ' + money(mm.butcheryPortions.half) : money(mm.butchery) + ' / kg'}</div></div>
              <span className=${'pill ' + (a <= 0 ? 'danger' : a <= mm.low ? 'warn' : 'ok')}>${a <= 0 ? 'Out' : r3(a) + (mm.kind === 'bird' ? ' birds' : ' kg')}</span>
            </div>
          </button>`;
        })}
      </div>
      ${m ? html`<div className="qty-panel">
        <h4>${m.emoji} ${m.name}</h4>
        ${m.kind === 'bird' ? html`
          <div className="portion-row" style=${{ gridTemplateColumns: '1fr 1fr' }}>
            <button className="portion" disabled=${avail(m) < 1} onClick=${() => add(m, 1, m.butcheryPortions.full, 'Full bird')}><b>Full bird</b><span>${money(m.butcheryPortions.full)}</span></button>
            <button className="portion" disabled=${avail(m) < 0.5} onClick=${() => add(m, 0.5, m.butcheryPortions.half, 'Half bird')}><b>Half bird</b><span>${money(m.butcheryPortions.half)}</span></button>
          </div>` : html`
          <div className="portion-row">
            ${FRACS.map((f) => html`<button key=${f} className="portion" disabled=${avail(m) + 1e-9 < f} onClick=${() => add(m, f, m.butcheryPortions[f] || 0, FRAC_LABEL[f])}><b>${FRAC_LABEL[f]}</b><span>${money(m.butcheryPortions[f] || 0)}</span></button>`)}
          </div>
          <div className="or">or</div>
          <div className="fgrid">
            <${Field} label="Custom weight (kg)" sub=${kgQty > 0 ? money(Math.round(m.butchery * kgQty)) : 'For example 1.5'}>
              <div className="row"><input className="inp num" type="number" inputMode="decimal" step="0.05" value=${kg} onChange=${(e) => setKg(e.target.value)} /><button className="btn soft" onClick=${() => add(m, kgQty, Math.round(m.butchery * kgQty), r3(kgQty) + ' kg')}>Add</button></div>
            <//>
            <${Field} label=${'By amount (' + CUR + ')'} sub=${amtNum > 0 ? '= ' + r3(amtNum / m.butchery) + ' kg' : 'Customer says how much to spend'}>
              <select className="inp" value="" onChange=${(e) => { if (e.target.value) setAmt(e.target.value); }} style=${{ marginBottom: '6px' }}>
                <option value="">Quick amount…</option>
                ${[100, 200, 500, 1000].map((v) => html`<option key=${v} value=${v}>${money(v)}</option>`)}
              </select>
              <div className="row"><input className="inp num" type="number" inputMode="decimal" placeholder="Or type amount" value=${amt} onChange=${(e) => setAmt(e.target.value)} /><button className="btn soft" onClick=${() => add(m, r3(amtNum / m.butchery), amtNum, money(amtNum) + ' → ' + r3(amtNum / m.butchery) + ' kg')}>Add</button></div>
            <//>
          </div>`}
      </div>` : null}
    </div>
    <div className="card stick">
      <div className="card-head"><h3>Sale</h3>${cart.length ? html`<button className="btn ghost sm" onClick=${() => setCart([])}>Clear</button>` : null}</div>
      <${CartList} lines=${cart} setLines=${setCart} empty="Pick a meat, then a portion" />
      <div className="total-row"><span className="sec">Total</span><b>${money(total)}</b></div>
      <button className="btn lg block mt" disabled=${!cart.length} onClick=${() => setPayOpen(true)}>Take payment</button>
    </div>
    ${payOpen ? html`<${CheckoutModal} title="Butchery payment" total=${total} print="ask" creditCustomer=${true} onClose=${() => setPayOpen(false)} onConfirm=${confirm} />` : null}
  </div>`;
}

function ButcheryStock() {
  const { s, update, notify, user } = useApp();
  const [modal, setModal] = useState(null);
  const [qtys, setQtys] = useState({});
  const pending = s.requests.filter((r) => r.status === 'pending');
  const today = dayStr();
  const fulfil = (r) => {
    const q = qtys[r.id] !== undefined ? num(qtys[r.id]) : r.qty;
    const res = update((d) => {
      const err = transferToKitchen(d, r.meatId, q, user.name, 'request');
      if (err) return err;
      const rq = d.requests.find((x) => x.id === r.id);
      rq.status = 'done'; rq.doneAt = new Date().toISOString(); rq.sent = q;
      return null;
    });
    if (res) notify(res, 'err'); else notify('Sent ' + q + ' kg of ' + r.name + ' to the kitchen');
  };
  const moves = [].concat(
    s.transfers.filter((x) => x.day === today).map((x) => ({ at: x.at, t: x.type === 'special' ? 'To kitchen · special order' : x.type === 'request' ? 'To kitchen · chef request' : 'To kitchen · morning', n: x.name, q: x.qty + ' kg', by: x.by })),
    s.purchases.filter((x) => x.day === today && x.kind === 'meat').map((x) => ({ at: x.at, t: 'Received', n: x.name, q: x.qty + '', by: x.by })),
    s.waste.filter((x) => x.day === today && x.loc !== 'cons').map((x) => ({ at: x.at, t: 'Waste · ' + x.reason, n: x.name, q: x.qty + ' ' + (x.unit === 'bird' ? 'birds' : 'kg'), by: x.by }))
  ).sort((a, b) => b.at.localeCompare(a.at));
  const modalMeat = modal ? meatOf(s, modal.meatId) : null;
  return html`<div className="col" style=${{ gap: '16px' }}>
    ${pending.length ? html`<div className="card">
      <div className="card-head"><h3>Kitchen requests <span className="pill warn">${pending.length} waiting</span></h3></div>
      <div className="col gap-sm">${pending.map((r) => html`<div className="row wrap" key=${r.id}>
        <b>${r.name}</b><span className="muted">asked by ${r.by} at ${timeStr(r.at)}</span><span className="grow"></span>
        <input className="inp num" style=${{ width: '90px' }} type="number" step="any" value=${qtys[r.id] !== undefined ? qtys[r.id] : r.qty} onChange=${(e) => { const v = e.target.value; setQtys((o) => Object.assign({}, o, { [r.id]: v })); }} />
        <span className="muted">kg</span>
        <button className="btn sm" onClick=${() => fulfil(r)}>Send to kitchen</button>
      </div>`)}</div>
    </div>` : null}
    <div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Meat</th><th className="r">In butchery</th><th className="r">Avg buying cost</th><th className="r">Sells at</th><th>Status</th><th></th></tr></thead>
      <tbody>${s.meats.filter((x) => x.active !== false).map((m) => html`<tr key=${m.id}>
        <td><b>${m.emoji} ${m.name}</b></td>
        <td className="r num-strong">${r3(m.stock)} ${m.kind === 'bird' ? 'birds' : 'kg'}</td>
        <td className="r">${money(m.cost)} / ${m.kind === 'bird' ? 'bird' : 'kg'}</td>
        <td className="r">${money(m.butchery)} / ${m.kind === 'bird' ? 'bird' : 'kg'}</td>
        <td>${m.stock <= 0 ? html`<span className="pill danger">Out of stock</span>` : m.stock <= m.low ? html`<span className="pill warn">Low</span>` : html`<span className="pill ok">OK</span>`}</td>
        <td className="right"><div className="row wrap" style=${{ justifyContent: 'flex-end' }}>
          <button className="btn soft sm" onClick=${() => setModal({ type: 'receive', meatId: m.id })}>Receive</button>
          ${m.kind === 'kg' ? html`<button className="btn soft sm" onClick=${() => setModal({ type: 'transfer', meatId: m.id })}>To kitchen</button>` : null}
          <button className="btn ghost sm" onClick=${() => setModal({ type: 'waste', meatId: m.id })}>Waste</button>
        </div></td>
      </tr>`)}</tbody>
    </table></div>
    <div className="card">
      <div className="card-head"><h3>Today's stock movements</h3></div>
      ${moves.length ? html`<div className="tbl-wrap" style=${{ border: 0 }}><table className="tbl"><thead><tr><th>Time</th><th>Movement</th><th>Meat</th><th className="r">Qty</th><th>By</th></tr></thead>
        <tbody>${moves.map((x, i) => html`<tr key=${i}><td>${timeStr(x.at)}</td><td>${x.t}</td><td>${x.n}</td><td className="r">${x.q}</td><td>${x.by}</td></tr>`)}</tbody></table></div>` : html`<div className="empty">No stock movements yet today</div>`}
    </div>
    ${modal && modalMeat ? html`<${StockModal} type=${modal.type} meat=${modalMeat} onClose=${() => setModal(null)} />` : null}
  </div>`;
}

function ButcheryPage() {
  return html`<${ButcherySell} />`;
}

/* ---------------- KITCHEN · ready-made ---------------- */
function KitchenReady() {
  const { s, update, notify, user, showReceipt } = useApp();
  const [cart, setCart] = useState([]);
  const [tbl, setTbl] = useState('');
  const [modal, setModal] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const reserved = useMemo(() => reservedOf(cart), [cart]);
  const total = sum(cart, (l) => l.total);
  const onAdd = (line) => setCart((c) => addLineTo(c, line));
  const rm = readyMeats(s);
  const pend = s.requests.filter((r) => r.status === 'pending');
  const unpaid = s.sales.filter((x) => x.source === 'ready' && !x.voided && x.status !== 'paid').sort((a, b) => b.at.localeCompare(a.at));
  // Place the order. A receipt prints immediately showing the order and the amount
  // only — never whether it has been paid — and the order stays open until the
  // customer pays, at which point the cashier takes payment and it closes.
  const place = () => {
    const tableNo = tbl ? Number(tbl) : null;
    const res = update((d) => {
      const err = checkStock(d, cart.flatMap((l) => l.deduct));
      if (err) return { err };
      return { sale: createSale(d, { source: 'ready', lines: cart, pay: null, cashier: user.name, tableNo }) };
    });
    if (res.err) { notify(res.err, 'err'); return; }
    setCart([]);
    notify('Order placed · receipt printing');
    // The receipt carries the table number but never whether it has been paid.
    showReceipt(res.sale, true, { hideStatus: true, tableNo });
  };
  const settle = (pay, doPrint) => {
    const res = update((d) => settleSaleBalance(d, payFor.id, pay, user.name));
    setPayFor(null);
    if (res.err) { notify(res.err, 'err'); return; }
    notify('Paid · ' + receiptNo(payFor) + ' closed');
    if (doPrint) showReceipt(res.sale, true);
  };
  return html`<div>
    <div className="stock-strip">
      ${rm.map((m) => html`<div className="stock-chip" key=${m.id}><span className="mc-emoji" style=${{ width: '34px', height: '34px', fontSize: '19px' }}>${m.emoji}</span><div><div className="mc-sub">${m.name} in kitchen</div><b>${portionsLabel(s.settings.portionGrams || 250, s.kitchen[m.id] || 0)}</b></div></div>`)}
      <span className="grow"></span>
      <span className="muted" style=${{ fontSize: '12.5px' }}>Manage stock under Inventory Management → Ready-made stock</span>
    </div>
    ${pend.length ? html`<div className="alert info mb">Waiting on butchery: ${pend.map((r) => r.name + ' (' + r.qty + ' kg)').join(', ')}</div>` : null}
    <div className="split">
      <${ReadyMenu} reserved=${reserved} onAdd=${onAdd} />
      <div className="col" style=${{ gap: '16px' }}>
        <div className="card stick">
          <div className="card-head"><h3>Ready-made order</h3>${cart.length ? html`<button className="btn ghost sm" onClick=${() => setCart([])}>Clear</button>` : null}</div>
          <${Field} label="Table number" sub="Leave blank for a counter or takeaway customer"><select className="inp" value=${tbl} onChange=${(e) => setTbl(e.target.value)}><option value="">No table</option>${Array.from({ length: s.settings.tables }, (_, i) => html`<option key=${i} value=${i + 1}>Table ${i + 1}</option>`)}</select><//>
          <${CartList} lines=${cart} setLines=${setCart} empty="Tap a portion, side or drink" />
          <div className="total-row"><span className="sec">Total</span><b>${money(total)}</b></div>
          <p className="hint" style=${{ margin: '6px 0 0' }}>The receipt prints immediately and shows the order and the amount only — never whether it has been paid. The order stays open here until the customer pays.</p>
          <button className="btn lg block mt" disabled=${!cart.length} onClick=${place}>Place order & print receipt</button>
        </div>
        ${unpaid.length ? html`<div className="card">
          <div className="card-head"><h3>Open orders <span className="pill warn">${unpaid.length}</span></h3></div>
          <div className="col gap-sm">${unpaid.map((x) => html`<div className="row wrap between" key=${x.id}>
            <div><b>${receiptNo(x)}</b> <span className="muted">${timeStr(x.at)} · ${x.cashier}${x.tableNo ? ' · Table ' + x.tableNo : ''}</span></div>
            <div className="row"><b className="num-strong">${money(x.balance)}</b><button className="btn ghost sm" onClick=${() => showReceipt(x, false, { hideStatus: true, tableNo: x.tableNo })}>Reprint</button><button className="btn good sm" onClick=${() => setPayFor(x)}>Take payment & close</button></div>
          </div>`)}</div>
          <p className="hint" style=${{ margin: '8px 0 0' }}>Taking payment closes the order and removes it from this list.</p>
        </div>` : null}
      </div>
    </div>
    ${payFor ? html`<${CheckoutModal} title=${'Take payment · ' + receiptNo(payFor)} total=${payFor.balance} print="ask" onClose=${() => setPayFor(null)} onConfirm=${settle} />` : null}
    ${modal ? html`<${KitchenStockModal} type=${modal.type} onClose=${() => setModal(null)} />` : null}
  </div>`;
}

function KitchenStockModal({ type, onClose }) {
  const { s, update, notify, user } = useApp();
  const rm = readyMeats(s);
  const grams = s.settings.portionGrams || 250;
  const [meatId, setMeatId] = useState(rm[0] ? rm[0].id : '');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState(WASTE_REASONS[0]);
  const m = meatOf(s, meatId);
  const go = () => {
    const q = num(qty);
    if (!m) { notify('Pick a meat', 'err'); return; }
    if (!(q > 0)) { notify('Enter a quantity above zero', 'err'); return; }
    let err = null;
    update((d) => {
      if (type === 'transfer') err = transferToKitchen(d, meatId, q, user.name, 'morning');
      else err = recordWaste(d, { loc: 'kitchen', meatId, qty: Math.round(q), reason, by: user.name });
    });
    if (err) { notify(err, 'err'); return; }
    notify(type === 'transfer' ? q + ' kg of ' + m.name + ' moved to the kitchen' : 'Waste recorded');
    onClose();
  };
  return html`<${Modal} title=${type === 'transfer' ? 'Take meat from the butchery' : 'Record kitchen waste'} onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn" onClick=${go}>${type === 'transfer' ? 'Move to kitchen' : 'Record waste'}</button>`}>
    <div className="col">
      ${type === 'transfer' ? html`<p className="hint">Move any amount from the butchery to the kitchen — it's automatically converted into ${grams}g portions.</p>` : null}
      <${Field} label="Meat"><select className="inp" value=${meatId} onChange=${(e) => setMeatId(e.target.value)}>${rm.map((x) => html`<option key=${x.id} value=${x.id}>${x.name} · butchery ${r3(x.stock)} kg · kitchen ${portionsLabel(grams, s.kitchen[x.id] || 0)}</option>`)}</select><//>
      <${Field} label=${type === 'transfer' ? 'Quantity (kg)' : 'Quantity (portions)'}><input className="inp num" type="number" inputMode="decimal" step=${type === 'transfer' ? 'any' : '1'} value=${qty} onChange=${(e) => setQty(e.target.value)} /><//>
      ${type === 'waste' ? html`<${Field} label="Reason"><select className="inp" value=${reason} onChange=${(e) => setReason(e.target.value)}>${WASTE_REASONS.map((r) => html`<option key=${r}>${r}</option>`)}</select><//>` : null}
    </div>
  <//>`;
}

/* ---------------- KITCHEN · specials ---------------- */
// Build the order receipt for a special. This is a print-only object — it is never
// saved, so it cannot affect Debtors, Sales or Reports. When a payment has been taken
// its pay/status/balance are copied across so the receipt shows the deposit position.
function specialOrderReceipt(sp, sale) {
  const lines = [Object.assign({}, specialLine(sp))];
  (sp.sides || []).forEach((x) => lines.push({ name: x.name, label: '', qty: x.qty, unit: 'pc', kind: 'side', total: x.price, cost: 0, deduct: [] }));
  if (sp.instr) lines.push({ name: '» ' + sp.instr, label: '', qty: 1, unit: 'pc', kind: 'note', total: 0, cost: 0, deduct: [] });
  const paidAmt = sale ? r2(sale.total - (sale.balance || 0)) : (sp.paidAmount || 0);
  return {
    id: 'order-' + sp.id, no: sp.no, day: sp.day, at: sp.at, source: 'special',
    lines, total: sp.price, cogs: sp.cost,
    pay: sale ? sale.pay : null,
    status: paidAmt >= sp.price - 0.5 ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid',
    balance: r2(Math.max(0, sp.price - paidAmt)),
    cashier: sp.by, tableNo: sp.tableNo, special: sp.id, voided: false,
  };
}

function SpecialForm({ tableNo, onDone }) {
  const { s, update, notify, user, showReceipt } = useApp();
  const meats = activeMeats(s).filter((x) => x.special > 0);
  const [meatId, setMeatId] = useState('');
  const [qty, setQty] = useState(0);
  const [custom, setCustom] = useState('');
  const [style, setStyle] = useState('');
  const [sides, setSides] = useState({});
  const [picked, setPicked] = useState([]);
  const [extra, setExtra] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tbl, setTbl] = useState(tableNo ? String(tableNo) : '');
  const [when, setWhen] = useState('later');
  const [deposit, setDeposit] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const m = meats.find((x) => x.id === meatId);
  const sideList = s.sides.filter((x) => x.active !== false);
  const sideArr = Object.keys(sides).filter((k) => sides[k] > 0).map((k) => ({ id: k, qty: sides[k] }));
  const sidesTotal = sum(sideArr, (x) => { const sd = s.sides.find((y) => y.id === x.id); return sd ? sd.price * x.qty : 0; });
  const meatTotal = m && qty > 0 ? specialPrice(m, qty) : 0;
  const price = meatTotal + sidesTotal;
  const onTable = !!tbl;
  const setSide = (id, d) => setSides((o) => Object.assign({}, o, { [id]: Math.max(0, (o[id] || 0) + d) }));
  const pickMeat = (id) => { setMeatId(id); setQty(0); setCustom(''); };
  const reset = () => { setMeatId(''); setQty(0); setCustom(''); setStyle(''); setSides({}); setPicked([]); setExtra(''); setName(''); setPhone(''); if (!tableNo) setTbl(''); setWhen('later'); setDeposit(''); };
  const togglePick = (x) => setPicked((o) => (o.includes(x) ? o.filter((y) => y !== x) : o.concat([x])));
  const depAmt = num(deposit);
  const create = (pay, doPrint) => {
    const instr = picked.concat(extra.trim() ? [extra.trim()] : []).join(', ');
    const form = { meatId, qty, style, sides: sideArr, instr, customer: name, phone, tableNo: tbl ? Number(tbl) : null };
    const amt = when === 'deposit' ? depAmt : null;
    const res = update((d) => {
      const r = createSpecial(d, form, user.name);
      if (r.err) return r;
      const sale = pay ? paySpecial(d, r.sp.id, pay, user.name, amt) : null;
      return { sp: r.sp, sale };
    });
    if (res.err) { notify(res.err, 'err'); return; }
    setPayOpen(false); reset();
    notify('Special #' + res.sp.no + ' created · receipt printing');
    // A receipt always prints on creation — paid in full, deposit, pay later, or on a
    // table — and it always carries the table number and the order number.
    showReceipt(specialOrderReceipt(res.sp, res.sale), true, { orderNo: res.sp.no, tableNo: res.sp.tableNo });
    if (onDone) onDone(res.sp);
  };
  const submit = () => {
    if (!m) { notify('Pick a meat first', 'err'); return; }
    if (!(qty > 0)) { notify('Choose the quantity', 'err'); return; }
    if (qty > m.stock + 1e-9) { notify('Butchery only has ' + r3(m.stock) + (m.kind === 'bird' ? ' birds' : ' kg') + ' of ' + m.name, 'err'); return; }
    if (when === 'deposit') {
      if (!(depAmt > 0) || depAmt >= price) { notify('Enter a deposit between 0 and the order total', 'err'); return; }
      setPayOpen(true); return;
    }
    if (when === 'now') { setPayOpen(true); return; }
    create(null, false);
  };
  const qtyChips = m && m.kind === 'bird' ? [[1, 'Full bird'], [0.5, 'Half bird']] : [[0.25, '¼ kg'], [0.5, '½ kg'], [0.75, '¾ kg'], [1, '1 kg'], [1.5, '1½ kg'], [2, '2 kg']];
  return html`<div className="col" style=${{ gap: '16px' }}>
    <div className="card">
      <h3>1 · Meat and quantity</h3>
      ${meats.length ? null : html`<div className="empty">No specials prices set. An admin can add them in Settings → Prices → Specials.</div>`}
      <div className="chips mb">${meats.map((x) => html`<button key=${x.id} className=${'chip' + (meatId === x.id ? ' on' : '')} onClick=${() => pickMeat(x.id)}>${x.emoji} ${x.name}<small>${money(x.special)}/${x.kind === 'bird' ? 'bird' : 'kg'}</small></button>`)}</div>
      ${m ? html`<div className="row wrap">
        <div className="chips">${qtyChips.map((q) => html`<button key=${q[0]} className=${'chip' + (qty === q[0] && !custom ? ' on' : '')} disabled=${q[0] > m.stock + 1e-9} onClick=${() => { setQty(q[0]); setCustom(''); }}>${q[1]}</button>`)}</div>
        ${m.kind === 'kg' ? html`<input className="inp num" style=${{ width: '130px' }} type="number" inputMode="decimal" step="0.05" placeholder="Other kg" value=${custom} onChange=${(e) => { setCustom(e.target.value); setQty(num(e.target.value)); }} />` : null}
        <span className="muted">${r3(m.stock)} ${m.kind === 'bird' ? 'birds' : 'kg'} in butchery</span>
      </div>` : null}
    </div>
    <div className="card">
      <h3>2 · How they want it cooked</h3>
      <div className="chips mb">${s.styles.map((x) => html`<button key=${x} className=${'chip' + (style === x ? ' on' : '')} onClick=${() => setStyle(style === x ? '' : x)}>${x}</button>`)}</div>
      <${Field} label="Cooking style (or type your own)"><input className="inp" value=${style} onChange=${(e) => setStyle(e.target.value)} placeholder="e.g. Choma" /><//>
      <div className="sec-title mt">Sides</div>
      <div className="chips">${sideList.map((x) => {
        const q = sides[x.id] || 0;
        return html`<span key=${x.id} className=${'chip side-pick' + (q ? ' on' : '')} style=${{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 0, overflow: 'hidden' }}>
          <button className="side-main" onClick=${() => setSide(x.id, 1)} aria-label=${'Add ' + x.name} style=${{ background: 'transparent', border: 0, color: 'inherit', padding: '7px 6px 7px 13px', font: 'inherit', cursor: 'pointer' }}>${x.name}<small>${money(x.price)}</small></button>
          ${q ? html`<span className="stepper" style=${{ background: '#00000030', borderRadius: 0, border: 0 }}><button onClick=${() => setSide(x.id, -1)} aria-label=${'Less ' + x.name}>−</button><span>${q}</span><button onClick=${() => setSide(x.id, 1)} aria-label=${'More ' + x.name}>+</button></span>` : html`<span style=${{ width: '7px' }}></span>`}
        </span>`;
      })}</div>
      <p className="hint" style=${{ margin: '6px 0 0' }}>Tap a side to add it — tap again for more, or use − / + once it's added.</p>
      <div className="sec-title mt">Special instructions</div>
      <div className="chips">${s.instructions.map((x) => html`<button key=${x} className=${'chip' + (picked.includes(x) ? ' on' : '')} onClick=${() => togglePick(x)}>${x}</button>`)}</div>
      <div className="mt"><${Field} label="Anything else (optional)"><input className="inp" value=${extra} onChange=${(e) => setExtra(e.target.value)} placeholder="Only if it's not covered above" /><//></div>
    </div>
    <div className="card">
      <h3>3 · Customer and payment</h3>
      <div className="fgrid">
        <${Field} label="Customer name (optional)"><input className="inp" value=${name} onChange=${(e) => setName(e.target.value)} /><//>
        <${Field} label="Phone number (optional)"><input className="inp" type="tel" value=${phone} onChange=${(e) => setPhone(e.target.value)} /><//>
        ${tableNo ? null : html`<${Field} label="Table (optional)" sub="If set, the special is added to that table's bill"><select className="inp" value=${tbl} onChange=${(e) => setTbl(e.target.value)}><option value="">No table · walk-in / takeaway</option>${Array.from({ length: s.settings.tables }, (_, i) => html`<option key=${i} value=${i + 1}>Table ${i + 1}</option>`)}</select><//>`}
      </div>
        <div className="sec-title mt">Payment</div>
        <div className="chips"><button className=${'chip' + (when === 'later' ? ' on' : '')} onClick=${() => setWhen('later')}>${onTable ? 'Pay at settle · on the table bill' : 'Pay later · mark unpaid'}</button><button className=${'chip' + (when === 'now' ? ' on' : '')} onClick=${() => setWhen('now')}>Pay in full now</button><button className=${'chip' + (when === 'deposit' ? ' on' : '')} onClick=${() => setWhen('deposit')}>Take a deposit</button></div>
        ${when === 'deposit' ? html`<div className="mt" style=${{ maxWidth: '220px' }}><${Field} label=${'Deposit amount (' + CUR + ')'} sub=${depAmt > 0 && depAmt < price ? 'Balance after: ' + money(price - depAmt) : ''}><input className="inp num" type="number" inputMode="decimal" value=${deposit} onChange=${(e) => setDeposit(e.target.value)} /><//></div>` : null}
        ${onTable ? html`<p className="hint mt">${when === 'later' ? 'This special goes onto Table ' + tbl + '\'s bill and is paid when the table settles.' : 'Taking money now does not close Table ' + tbl + ' — the rest of the bill still settles as normal, and only the balance left on this order is added to it.'}</p>` : null}
    </div>
    <div className="card row wrap between">
      <div><div className="muted">${m && qty > 0 ? qtyLabel(qty, m.kind === 'bird' ? 'bird' : 'kg') + ' ' + m.name : 'Order total'}${sidesTotal ? ' + sides' : ''}</div><b style=${{ fontSize: '24px' }}>${money(price)}</b></div>
      <button className="btn lg" onClick=${submit}>${when === 'now' ? 'Take payment & send to kitchen' : when === 'deposit' ? 'Take deposit & send to kitchen' : onTable ? 'Add to table bill & send to kitchen' : 'Send to kitchen (unpaid)'}</button>
    </div>
    <p className="hint">The exact quantity is taken out of butchery stock as soon as you send the order. Preparation takes about one hour. Every order — paid, deposited or unpaid — gets a receipt showing its status.</p>
    ${payOpen ? html`<${CheckoutModal} title=${when === 'deposit' ? 'Take deposit' : 'Special order payment'} total=${when === 'deposit' ? depAmt : price} print="always" onClose=${() => setPayOpen(false)} onConfirm=${create} />` : null}
  </div>`;
}

/* ---------------- KITCHEN · specials register ---------------- */
function SpecialsRegister() {
  const { s, update, notify, user, showReceipt } = useApp();
  const now = useNow(30000);
  const [filter, setFilter] = useState('active');
  const [q, setQ] = useState('');
  const [payFor, setPayFor] = useState(null);
  const today = dayStr();
  let list = s.specials.slice().sort((a, b) => b.at.localeCompare(a.at));
  if (filter === 'active') list = list.filter((x) => !x.cleared);
  else if (filter === 'unpaid') list = list.filter((x) => !x.paid);
  else if (filter === 'cleared') list = list.filter((x) => x.cleared);
  const term = q.trim().toLowerCase();
  if (term) list = list.filter((x) => (x.customer + ' ' + x.phone + ' ' + x.meat + ' ' + x.instr + ' #' + x.no).toLowerCase().indexOf(term) >= 0);
  const NEXT_STATUS = { pending: 'preparing', preparing: 'ready', ready: 'served' };
  const STATUS_ACTION = { pending: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' };
  const advance = (sp) => update((d) => { const x = d.specials.find((y) => y.id === sp.id); x.status = NEXT_STATUS[x.status] || x.status; });
  const clear = (sp) => { update((d) => { d.specials.find((y) => y.id === sp.id).cleared = true; }); notify('Order #' + sp.no + ' cleared'); };
  const pay = (p, doPrint) => {
    const pf = payFor;
    const res = update((d) => {
      const sale = paySpecial(d, pf.id, p, user.name, null);
      if (!sale) return { err: 'Nothing owing on this order' };
      const sp = d.specials.find((y) => y.id === pf.id);
      // Fully settled, so close it. The cashier chose at the payment dialog whether a
      // final receipt prints — either way the order is cleared.
      if (sp && sp.paid) sp.cleared = true;
      return { sale };
    });
    setPayFor(null);
    if (res.err) { notify(res.err, 'err'); return; }
    notify('Order #' + pf.no + ' paid & closed');
    if (doPrint) showReceipt(res.sale, true, { orderNo: pf.no, tableNo: pf.tableNo });
  };
  const reprint = (sp) => { const sale = s.sales.find((x) => x.id === sp.saleId); if (sale) showReceipt(sale, false, { orderNo: sp.no, tableNo: sp.tableNo }); else notify('Print the order receipt instead — no payment has been recorded on this order yet', 'err'); };
  const counts = { active: s.specials.filter((x) => !x.cleared).length, unpaid: s.specials.filter((x) => !x.paid).length };
  return html`<div>
    <div className="row wrap between mb">
      <${Tabs} value=${filter} onChange=${setFilter} tabs=${[{ id: 'active', label: 'Active', badge: counts.active || null }, { id: 'unpaid', label: 'Unpaid', badge: counts.unpaid || null }, { id: 'cleared', label: 'Cleared' }, { id: 'all', label: 'All' }]} />
      <input className="inp" style=${{ width: '260px', maxWidth: '100%' }} placeholder="Search name, phone, meat, order #" value=${q} onChange=${(e) => setQ(e.target.value)} />
    </div>
    <p className="hint">Order numbers restart at 1 every day, and every special stays here until you clear it, so nothing can go missing. <b>Status</b> is how far the kitchen has got — Pending → Preparing → Ready → Served. <b>Payment</b> is what has been received. <b>Balance</b> is what is still owed. <b>Cleared</b> marks the orders you have finished with. Use <b>Order receipt</b> to reprint a ticket at any time.</p>
    ${list.length ? html`<div className="tbl-wrap"><table className="tbl">
      <thead><tr><th>Order</th><th>Customer</th><th>Order details</th><th>Table</th><th className="r">Amount</th><th>Status</th><th>Payment</th><th className="r">Balance</th><th>Cleared</th><th></th></tr></thead>
      <tbody>${list.map((sp) => {
        const overdue = sp.status === 'preparing' && now > new Date(sp.due).getTime();
        const canClear = sp.paid && !sp.cleared;
        return html`<tr key=${sp.id} className=${sp.cleared ? 'dim' : ''}>
          <td><b>#${sp.no}</b><div className="muted" style=${{ fontSize: '11.5px' }}>${sp.day === today ? timeStr(sp.at) : dateNice(sp.day) + ' ' + timeStr(sp.at)}</div></td>
          <td>${sp.customer || html`<span className="muted">—</span>`}<div className="muted" style=${{ fontSize: '11.5px' }}>${sp.phone}</div></td>
          <td style=${{ minWidth: '230px' }}><b>${qtyLabel(sp.qty, sp.unit)} ${sp.meat}</b>${sp.style ? ' · ' + sp.style : ''}
            ${sp.sides.length ? html`<div className="sec" style=${{ fontSize: '12.5px' }}>${sp.sides.map((x) => x.name + (x.qty > 1 ? ' ×' + x.qty : '')).join(', ')}</div>` : null}
            ${sp.instr ? html`<div className="muted" style=${{ fontSize: '12.5px', fontStyle: 'italic' }}>${sp.instr}</div>` : null}</td>
          <td>${sp.tableNo ? 'Table ' + sp.tableNo : '—'}</td>
          <td className="r num-strong">${money(sp.price)}${sp.paidAmount > 0 && sp.paidAmount < sp.price ? html`<div className="muted" style=${{ fontSize: '11.5px', fontWeight: 400 }}>paid ${money(sp.paidAmount)}</div>` : null}</td>
          <td>${sp.status === 'served' ? html`<span className="pill ok">Served</span>` : sp.status === 'ready' ? html`<span className="pill info">Ready</span>` : sp.status === 'preparing' ? (overdue ? html`<span className="pill danger">Overdue · was due ${timeStr(sp.due)}</span>` : html`<span className="pill warn">Preparing · ready by ${timeStr(sp.due)}</span>`) : html`<span className="pill">Pending</span>`}</td>
          <td>${sp.paid ? html`<span className="pill ok">Paid</span>` : sp.paidAmount > 0 ? html`<span className="pill warn">Part-paid · deposit ${money(sp.paidAmount)}</span>` : html`<span className="pill danger">Unpaid</span>`}</td>
          <td className="r num-strong">${sp.paid ? html`<span className="muted">—</span>` : money(r2(sp.price - (sp.paidAmount || 0)))}</td>
          <td>${sp.cleared ? html`<span className="pill ok">Cleared</span>` : html`<span className="muted">Open</span>`}</td>
          <td><div className="row wrap" style=${{ justifyContent: 'flex-end' }}>
            ${sp.status !== 'served' ? html`<button className="btn soft sm" onClick=${() => advance(sp)}>${STATUS_ACTION[sp.status]}</button>` : null}
            ${!sp.paid && !sp.tableNo ? html`<button className="btn good sm" onClick=${() => setPayFor(sp)}>Clear balance</button>` : null}
            ${!sp.paid && sp.tableNo ? html`<span className="muted" style=${{ fontSize: '12px' }}>On Table ${sp.tableNo} bill</span>` : null}
            <button className="btn ghost sm" onClick=${() => showReceipt(specialOrderReceipt(sp, s.sales.find((x) => x.id === sp.saleId) || null), false, { orderNo: sp.no, tableNo: sp.tableNo })}>Order receipt</button>
            ${sp.saleId ? html`<button className="btn ghost sm" onClick=${() => reprint(sp)}>Payment receipt</button>` : null}
            ${!sp.cleared ? html`<button className="btn ghost sm" disabled=${!canClear} title=${canClear ? 'Close this order and remove it from the active register' : 'Available once payment is fully cleared'} onClick=${() => clear(sp)}>Clear</button>` : null}
          </div></td>
        </tr>`;
      })}</tbody></table></div>` : html`<div className="empty">${filter === 'active' ? 'No active special orders. New orders appear here.' : 'Nothing to show for this filter.'}</div>`}
    ${payFor ? html`<${CheckoutModal} title=${'Payment · special #' + payFor.no} total=${r2(payFor.price - (payFor.paidAmount || 0))} print="ask" onClose=${() => setPayFor(null)} onConfirm=${pay} />` : null}
  </div>`;
}

function KitchenPage() {
  const { s } = useApp();
  // One path only: pick a table, then take the order. There is no separate
  // counter or takeaway screen — every order happens against a table, so there
  // is only ever one place for the cashier to look.
  const [view, setView] = useState('tables');
  const openSpecials = s.specials.filter((x) => !x.cleared && x.status !== 'served').length;
  const unpaidSpecials = s.specials.filter((x) => !x.cleared && !x.paid).length;
  const openTables = Object.keys(s.tabs).length;
  if (view === 'register') return html`<div>
    <div className="row wrap between mb">
      <button className="btn ghost sm" onClick=${() => setView('tables')}>← Back to tables</button>
      <h3 style=${{ margin: 0 }}>Specials register</h3>
    </div>
    <${SpecialsRegister} />
  </div>`;
  return html`<div>
    <div className="row wrap between mb">
      <p className="hint" style=${{ margin: 0 }}>Tap a table to take its order.${openTables ? ' ' + openTables + (openTables === 1 ? ' table is' : ' tables are') + ' open right now.' : ' No tables open.'}</p>
      <button className="btn soft sm" onClick=${() => setView('register')}>Specials register${openSpecials ? ' · ' + openSpecials + ' active' : ''}${unpaidSpecials ? ' · ' + unpaidSpecials + ' unpaid' : ''}</button>
    </div>
    <${TablesPage} />
  </div>`;
}

/* ---------------- TABLES ---------------- */
function TableModal({ no, onClose }) {
  const { s, update, notify, user, showReceipt } = useApp();
  const [payOpen, setPayOpen] = useState(false);
  // The cashier picks a table first, then does everything for that customer from
  // here: ready-made items, a custom special, and the register that tracks it.
  const [view, setView] = useState('ready');
  const tab = s.tabs[no] || { lines: [] };
  const linked = tabLinked(s, no);
  const total = tabTotal(s, no);
  const mine = s.specials.filter((x) => x.tableNo === no && !x.cleared).length;
  const add = (line) => { const r = update((d) => addToTab(d, no, line)); if (r.err) notify(r.err, 'err'); };
  const change = (key, delta) => { const r = update((d) => changeTabLine(d, no, key, delta)); if (r.err) notify(r.err, 'err'); };
  const closeEmpty = () => { update((d) => { delete d.tabs[no]; }); onClose(); };
  const settle = (pay) => {
    const sale = update((d) => settleTab(d, no, pay, user.name));
    setPayOpen(false); onClose();
    notify('Table ' + no + ' paid · ' + money(sale.total));
    showReceipt(sale, true);
  };
  const empty = !tab.lines.length && !linked.length;
  return html`<${Fragment}>
    <${Modal} title=${'Table ' + no} size="wide" onClose=${onClose}>
      <div className="split wide-r">
        <div className="col" style=${{ gap: '12px' }}>
          <${Tabs} value=${view} onChange=${setView} tabs=${[
            { id: 'ready', label: 'Ready-made' },
            { id: 'special', label: 'Custom special' },
            { id: 'register', label: 'Special register', badge: mine || null },
          ]} />
          ${view === 'ready' ? html`<${ReadyMenu} reserved=${{ meat: {}, cons: {} }} onAdd=${add} />`
            : view === 'special' ? html`<${SpecialForm} key=${'sp-' + no} tableNo=${no} onDone=${() => setView('register')} />`
            : html`<${SpecialsRegister} key=${'reg-' + no} />`}
        </div>
        <div className="card stick">
          <div className="card-head"><h3>Bill · Table ${no}</h3></div>
          ${empty ? html`<div className="empty">Tap items on the left to start this table's bill</div>` : null}
          ${tab.lines.map((l) => html`<div className="cart-line" key=${l.key}>
            <div className="nm"><b>${l.name}</b><small>${l.label || ''}</small></div>
            ${l.kind === 'side' || l.kind === 'drink' ? html`<div className="stepper"><button onClick=${() => change(l.key, -1)} aria-label="Less">−</button><span>${l.qty}</span><button onClick=${() => change(l.key, 1)} aria-label="More">+</button></div>` : null}
            <div className="num-strong" style=${{ minWidth: '74px', textAlign: 'right' }}>${money(l.total)}</div>
            <button className="icon-btn" onClick=${() => change(l.key, -9999)} aria-label="Remove">✕</button>
          </div>`)}
          ${linked.map((sp) => { const owed = r2(sp.price - (sp.paidAmount || 0)); return html`<div className="cart-line" key=${sp.id}>
            <div className="nm"><b>Special #${sp.no} · ${sp.meat}</b><small>${qtyLabel(sp.qty, sp.unit)}${sp.style ? ' · ' + sp.style : ''} · ${sp.status}${sp.paidAmount > 0 ? ' · deposit ' + money(sp.paidAmount) + ' taken' : ''}</small></div>
            <div className="num-strong" style=${{ minWidth: '74px', textAlign: 'right' }}>${money(owed)}</div>
            <span style=${{ width: '30px' }}></span>
          </div>`; })}
          <div className="total-row"><span className="sec">Total</span><b>${money(total)}</b></div>
          <div className="col mt">
            <button className="btn soft" onClick=${() => setView('special')}>Add a custom special</button>
            <button className="btn lg" disabled=${empty} onClick=${() => setPayOpen(true)}>Settle & pay</button>
            <button className="btn ghost" onClick=${onClose}>← Back to tables</button>
            ${!linked.length && !tab.lines.length && s.tabs[no] ? html`<button className="btn ghost" onClick=${closeEmpty}>Close empty table</button>` : null}
          </div>
          <p className="hint" style=${{ margin: '10px 0 0' }}>Going back leaves this table open — come back to it any time. The bill prints when the table settles; specials print their own receipt the moment they are ordered.</p>
        </div>
      </div>
    <//>
    ${payOpen ? html`<${CheckoutModal} title=${'Pay · Table ' + no} total=${total} print="auto" onClose=${() => setPayOpen(false)} onConfirm=${settle} />` : null}
  <//>`;
}

function TablesPage() {
  const { s } = useApp();
  const [open, setOpen] = useState(null);
  const n = s.settings.tables;
  const cards = [];
  for (let i = 1; i <= n; i++) {
    const tab = s.tabs[i];
    const linked = tabLinked(s, i);
    const isOpen = !!tab || linked.length > 0;
    const items = (tab ? sum(tab.lines, (l) => l.qty) : 0) + linked.length;
    cards.push(html`<button key=${i} className=${'tcard' + (isOpen ? ' open' : '')} onClick=${() => setOpen(i)}>
      <div className="row between"><span className="tn">${i}</span><span className=${'pill ' + (isOpen ? 'warn' : 'ok')}>${isOpen ? 'Open' : 'Free'}</span></div>
      <div className="muted">${isOpen ? (tab ? 'Opened ' + timeStr(tab.openedAt) : 'Special order') : 'Tap to open'}</div>
      ${isOpen ? html`<div className="amt">${money(tabTotal(s, i))}<span className="muted" style=${{ fontWeight: 400 }}> · ${r3(items)} items</span></div>` : null}
    </button>`);
  }
  return html`<div>
    <p className="hint">Tap a table to open its order — ready-made meat, sides, drinks and special orders all go onto that table's bill, and the bill is paid when the table settles. Change the number of tables in Settings.</p>
    <div className="table-grid">${cards}</div>
    ${open ? html`<${TableModal} no=${open} onClose=${() => setOpen(null)} />` : null}
  </div>`;
}
