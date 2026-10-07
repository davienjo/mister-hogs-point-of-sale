/* =====================================================================
   UI — React (UMD) + htm.  Part 1: shell & shared components
   ===================================================================== */
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;
const html = htm.bind(React.createElement);
const Ctx = createContext(null);
const useApp = () => useContext(Ctx);
function useNow(ms) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms || 30000); return () => clearInterval(t); }, [ms]);
  return n;
}

/* ---------------- sound feedback (Web Audio, no files, fully offline) ---------------- */
let _audioCtx = null;
function beep(freq, ms, vol) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const t0 = _audioCtx.currentTime;
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(gain); gain.connect(_audioCtx.destination);
    osc.start(t0); osc.stop(t0 + ms / 1000);
  } catch (e) { /* audio unavailable — fail silently */ }
}
const SOUND = { ok: () => beep(720, 90), err: () => beep(220, 160, 0.08), click: () => beep(520, 40, 0.035) };

/* ---------------- small shared components ---------------- */
const MODAL_STACK = [];
function Modal({ title, onClose, size, children, footer }) {
  const idRef = useRef({});
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const id = idRef.current;
    MODAL_STACK.push(id);
    const h = (e) => { if (e.key === 'Escape' && MODAL_STACK[MODAL_STACK.length - 1] === id && closeRef.current) closeRef.current(); };
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('keydown', h); const i = MODAL_STACK.indexOf(id); if (i >= 0) MODAL_STACK.splice(i, 1); };
  }, []);
  return html`<div className="modal-overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
    <div className=${'modal ' + (size || '')} role="dialog" aria-label=${title}>
      <div className="modal-head"><h3>${title}</h3><button className="icon-btn" onClick=${onClose} aria-label="Close">✕</button></div>
      <div className="modal-body">${children}</div>
      ${footer ? html`<div className="modal-foot">${footer}</div>` : null}
    </div>
  </div>`;
}
function Tabs({ tabs, value, onChange }) {
  return html`<div className="tabs" role="tablist">${tabs.map((t) => html`<button key=${t.id} role="tab" aria-selected=${value === t.id} className=${'tab' + (value === t.id ? ' active' : '')} onClick=${() => onChange(t.id)}>${t.label}${t.badge ? html`<span className="bdg">${t.badge}</span>` : null}</button>`)}</div>`;
}
function Field({ label, sub, children }) {
  return html`<div className="field"><label>${label}</label>${children}${sub ? html`<span className="sub">${sub}</span>` : null}</div>`;
}
function NumInput({ value, onCommit, step, min, width, placeholder, disabled }) {
  const [v, setV] = useState(String(value == null ? '' : value));
  useEffect(() => { setV(String(value == null ? '' : value)); }, [value]);
  const mn = min == null ? 0 : min;
  const commit = () => {
    const n = parseFloat(v);
    if (isNaN(n) || n < mn) { setV(String(value == null ? '' : value)); return; }
    if (n !== value) onCommit(n);
  };
  return html`<input className="inp num" type="number" inputMode="decimal" step=${step || 'any'} min=${mn} value=${v} placeholder=${placeholder} disabled=${disabled}
    style=${width ? { width: width } : null} onChange=${(e) => setV(e.target.value)} onBlur=${commit} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); }} />`;
}
function TextInput({ value, onCommit, placeholder, width }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  const commit = () => { const t = v.trim(); if (!t) { setV(value || ''); return; } if (t !== value) onCommit(t); };
  return html`<input className="inp" type="text" value=${v} placeholder=${placeholder} style=${width ? { width: width } : null}
    onChange=${(e) => setV(e.target.value)} onBlur=${commit} onKeyDown=${(e) => { if (e.key === 'Enter') e.target.blur(); }} />`;
}
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

/* ---------------- checkout (payment) ---------------- */
function CheckoutModal({ title, total, print, onClose, onConfirm, allowUnpaid, unpaidLabel, creditCustomer }) {
  const [method, setMethod] = useState('cash');
  const [tendered, setTendered] = useState(String(total));
  const [cashPart, setCashPart] = useState('');
  const [ref, setRef] = useState('');
  const [credit, setCredit] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const t = num(tendered), cp = num(cashPart);
  const change = Math.max(0, t - total);
  let valid = true, msg = '';
  if (method === 'cash' && t < total) { valid = false; msg = 'Cash received is less than the total.'; }
  if (method === 'split' && (cp <= 0 || cp >= total)) { valid = false; msg = 'Enter the cash part: more than 0 and less than the total.'; }
  const build = () => {
    if (method === 'cash') return { method: 'cash', cash: total, tendered: t, change };
    if (method === 'mpesa') return { method: 'mpesa', mpesa: total, ref };
    if (method === 'card') return { method: 'card', card: total, ref };
    return { method: 'split', cash: cp, mpesa: total - cp, ref };
  };
  const go = (doPrint) => { if (valid) onConfirm(build(), doPrint); };
  const goCredit = () => { if (!custName.trim()) return; onConfirm(null, true, { name: custName.trim(), phone: custPhone.trim() }); };
  const quick = Array.from(new Set([total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000])).filter((x) => x >= total).sort((a, b) => a - b);
  const methods = [['cash', 'Cash'], ['mpesa', 'M-Pesa'], ['card', 'Card'], ['split', 'Cash + M-Pesa']];
  const footer = credit ? html`
    <button className="btn ghost" onClick=${() => setCredit(false)}>Back</button>
    <button className="btn" disabled=${!custName.trim()} onClick=${goCredit}>Sell on credit & print receipt</button>`
  : html`
    ${creditCustomer ? html`<button className="btn ghost" onClick=${() => setCredit(true)}>Sell on credit</button>` : null}
    ${allowUnpaid ? html`<button className="btn ghost" onClick=${() => onConfirm(null, true)}>${unpaidLabel || 'Leave unpaid & print receipt'}</button>` : null}
    ${print === 'ask' ? html`<button className="btn ghost" disabled=${!valid} onClick=${() => go(false)}>Confirm, don't print</button>` : null}
    <button className="btn" disabled=${!valid} onClick=${() => go(print !== 'none')}>${print === 'none' ? 'Confirm payment' : 'Confirm & print receipt'}</button>`;
  if (credit) return html`<${Modal} title=${'Sell on credit' + (title ? ' · ' + title : '')} onClose=${onClose} footer=${footer}>
    <div className="total-row" style=${{ paddingTop: 0 }}><span className="sec">Amount owed</span><b>${money(total)}</b></div>
    <p className="hint">The goods leave stock now; the customer pays later. Recorded under Debtors until cleared.</p>
    <${Field} label="Customer name (required)"><input className="inp" value=${custName} onChange=${(e) => setCustName(e.target.value)} autoFocus /><//>
    <div className="mt"><${Field} label="Phone number (optional)"><input className="inp" type="tel" value=${custPhone} onChange=${(e) => setCustPhone(e.target.value)} /><//></div>
  <//>`;
  return html`<${Modal} title=${title || 'Take payment'} onClose=${onClose} footer=${footer}>
    <div className="total-row" style=${{ paddingTop: 0 }}><span className="sec">Amount due</span><b>${money(total)}</b></div>
    <div className="chips mb">${methods.map((m) => html`<button key=${m[0]} className=${'chip' + (method === m[0] ? ' on' : '')} onClick=${() => setMethod(m[0])}>${m[1]}</button>`)}</div>
    ${method === 'cash' ? html`<div className="col">
      <${Field} label="Cash received"><input className="inp num" type="number" inputMode="decimal" value=${tendered} onChange=${(e) => setTendered(e.target.value)} /><//>
      <div className="chips">${quick.map((q) => html`<button key=${q} className="chip" onClick=${() => setTendered(String(q))}>${q === total ? 'Exact' : money(q)}</button>`)}</div>
      <div className="row between"><span className="sec">Change to give</span><b className="num-strong">${money(change)}</b></div>
    </div>` : null}
    ${method === 'mpesa' || method === 'card' ? html`<${Field} label=${method === 'mpesa' ? 'M-Pesa transaction code (optional)' : 'Card slip / reference (optional)'}><input className="inp" value=${ref} onChange=${(e) => setRef(e.target.value)} /><//>` : null}
    ${method === 'split' ? html`<div className="col">
      <${Field} label="Cash part" sub=${cp > 0 && cp < total ? 'M-Pesa part: ' + money(total - cp) : 'The rest is paid by M-Pesa'}><input className="inp num" type="number" inputMode="decimal" value=${cashPart} onChange=${(e) => setCashPart(e.target.value)} /><//>
      <${Field} label="M-Pesa transaction code (optional)"><input className="inp" value=${ref} onChange=${(e) => setRef(e.target.value)} /><//>
    </div>` : null}
    ${msg ? html`<p className="err-msg mt">${msg}</p>` : null}
  <//>`;
}

/* ---------------- receipt ---------------- */
const PAY_LABEL = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', split: 'Cash + M-Pesa' };
function ReceiptModal({ sale, auto, opts, onClose }) {
  const { s } = useApp();
  useEffect(() => {
    if (!auto) return undefined;
    const t = setTimeout(() => { try { window.print(); } catch (e) { /* print blocked */ } }, 450);
    return () => clearTimeout(t);
  }, []);
  const st = s.settings;
  const p = sale.pay || {};
  const o = opts || {};
  // hideStatus: a ready-made order receipt shows the order and the amount only —
  // never whether it has been paid. Every other receipt behaves exactly as before.
  const hide = !!o.hideStatus;
  const src = sale.source === 'table' ? 'Table ' + sale.tableNo : sale.source === 'butchery' ? 'Butchery' : sale.source === 'special' ? 'Special order' : 'Kitchen';
  const sp = sale.special ? s.specials.find((x) => x.id === sale.special) : null;
  return html`<${Modal} title="Receipt" onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Close</button><button className="btn" onClick=${() => { try { window.print(); } catch (e) { /* ignore */ } }}>Print</button>`}>
    <div className="receipt-sheet">
      <h4>${st.business}</h4>
      ${st.address ? html`<div className="c">${st.address}</div>` : null}
      ${st.phone ? html`<div className="c">Tel ${st.phone}</div>` : null}
      <hr />
      <div className="ln"><span>Receipt</span><span>${receiptNo(sale)}</span></div>
      <div className="ln"><span>Date</span><span>${dateNice(sale.day)} ${timeStr(sale.at)}</span></div>
      <div className="ln"><span>Served by</span><span>${sale.cashier}</span></div>
      <div className="ln"><span>Section</span><span>${src}</span></div>
      ${o.orderNo ? html`<div className="ln big"><span>Order no.</span><span>#${o.orderNo}</span></div>` : null}
      ${o.tableNo ? html`<div className="ln big"><span>Table no.</span><span>Table ${o.tableNo}</span></div>` : null}
      ${sale.voided ? html`<div className="ln big"><span>VOIDED</span><span></span></div>` : null}
      <hr />
      ${sale.lines.map((l, i) => html`<div className="ln" key=${i}><span>${l.name}${l.label ? ' · ' + l.label : ''}${l.qty > 1 && (l.kind === 'side' || l.kind === 'drink') ? ' x' + l.qty : ''}</span><span>${Math.round(l.total).toLocaleString('en-US')}</span></div>`)}
      <hr />
      <div className="ln big"><span>TOTAL</span><span>${money(sale.total)}</span></div>
      ${sp ? html`<div className="ln"><span>Order total</span><span>${Math.round(sp.price).toLocaleString('en-US')}</span></div><div className="ln"><span>Paid to date</span><span>${Math.round(sp.paidAmount).toLocaleString('en-US')}</span></div>` : null}
      ${hide ? null : html`<div className="ln"><span>Paid by</span><span>${PAY_LABEL[p.method] || '—'}</span></div>`}
      ${!hide && p.method === 'cash' && p.tendered ? html`<div className="ln"><span>Cash received</span><span>${Math.round(p.tendered).toLocaleString('en-US')}</span></div><div className="ln"><span>Change</span><span>${Math.round(p.change || 0).toLocaleString('en-US')}</span></div>` : null}
      ${!hide && p.method === 'split' ? html`<div className="ln"><span>Cash</span><span>${Math.round(p.cash).toLocaleString('en-US')}</span></div><div className="ln"><span>M-Pesa</span><span>${Math.round(p.mpesa).toLocaleString('en-US')}</span></div>` : null}
      ${!hide && p.ref ? html`<div className="ln"><span>Ref</span><span>${p.ref}</span></div>` : null}
      ${hide ? null : sale.status === 'unpaid' && sale.source === 'special' ? html`<div className="ln big"><span>UNPAID</span><span>${money(sale.balance)}</span></div>` : sale.status === 'partial' && sale.source === 'special' ? html`<div className="ln big"><span>BALANCE DUE</span><span>${money(sale.balance)}</span></div>` : sale.source === 'special' ? html`<div className="ln"><span>Status</span><span>PAID IN FULL</span></div>` : null}
      <hr />
      <div className="c">${st.footer}</div>
    </div>
  <//>`;
}

/* ---------------- cart list ---------------- */
function CartList({ lines, setLines, empty }) {
  const setQty = (key, delta) => setLines((ls) => ls.flatMap((l) => {
    if (l.key !== key) return [l];
    const nq = r3(l.qty + delta);
    return nq <= 0 ? [] : [scaleLine(l, nq)];
  }));
  const remove = (key) => setLines((ls) => ls.filter((l) => l.key !== key));
  if (!lines.length) return html`<div className="empty">${empty || 'Nothing added yet'}</div>`;
  return html`<div>${lines.map((l) => html`<div className="cart-line" key=${l.key}>
    <div className="nm"><b>${l.name}</b><small>${l.label || (l.unit && l.unit !== 'pc' ? l.unit : '')}</small></div>
    ${l.kind === 'side' || l.kind === 'drink' ? html`<div className="stepper"><button onClick=${() => setQty(l.key, -1)} aria-label="Less">−</button><span>${l.qty}</span><button onClick=${() => setQty(l.key, 1)} aria-label="More">+</button></div>` : null}
    <div className="num-strong" style=${{ minWidth: '74px', textAlign: 'right' }}>${money(l.total)}</div>
    <button className="icon-btn" onClick=${() => remove(l.key)} aria-label="Remove">✕</button>
  </div>`)}</div>`;
}

/* ---------------- ready-made menu (kitchen walk-in + tables) ---------------- */
function RequestQtyModal({ meat, onClose }) {
  const { requestMore } = useApp();
  const [qty, setQty] = useState('10');
  const go = () => { const q = num(qty); if (!(q > 0)) return; requestMore(meat.id, q); onClose(); };
  return html`<${Modal} title=${'Request ' + meat.name + ' from butchery'} onClose=${onClose} footer=${html`<button className="btn ghost" onClick=${onClose}>Cancel</button><button className="btn" onClick=${go}>Send request</button>`}>
    <${Field} label="How much do you need? (kg)"><input className="inp num" type="number" inputMode="decimal" step="any" value=${qty} onChange=${(e) => setQty(e.target.value)} autoFocus /><//>
    <p className="hint mt">The butchery will see this request and can adjust the amount before sending it through.</p>
  <//>`;
}
function ReadyMenu({ reserved, onAdd }) {
  const { s } = useApp();
  const rm = readyMeats(s);
  const grams = s.settings.portionGrams || 250;
  const sides = s.sides.filter((x) => x.active !== false);
  const drinks = s.cons.filter((c) => c.cat === 'drink' && c.active !== false && c.price > 0);
  const [reqFor, setReqFor] = useState(null);
  const leftPortions = (id) => (s.kitchen[id] || 0) - ((reserved.meat || {})[id] || 0);
  const dLeft = (c) => r3(c.qty - ((reserved.cons || {})[c.id] || 0));
  const pending = (id) => s.requests.some((r) => r.meatId === id && r.status === 'pending');
  return html`<div>
    <div className="sec-title">Ready-made meat · sold by weight</div>
    ${rm.length ? null : html`<div className="empty">No ready-made prices set yet. An admin can add them in Settings → Prices → Ready-made.</div>`}
    <div className="meat-grid">
      ${rm.map((m) => {
        const l = leftPortions(m.id);
        const out = l < 1;
        return html`<div key=${m.id} className=${'meat-card' + (out ? ' out' : '')}>
          <div className="mc-top">
            <span className="mc-emoji">${m.emoji}</span>
            <div><div className="mc-name">${m.name}</div><div className="mc-sub">1 kg ${money(m.readyPortions[1] || 0)}</div></div>
            <span className=${'pill ' + (l < 0 ? 'danger' : out ? 'warn' : l <= (m.readyLow || 0) ? 'warn' : 'ok')}>${l < 0 ? -l + ' portions owed' : out ? 'Recorded as out' : portionsLabel(grams, l) + ' left'}</span>
          </div>
          <div className="portion-row">
            ${FRACS.map((f) => html`<button key=${f} className="portion" onClick=${() => onAdd(readyMeatLine(m, f, grams))}><b>${FRAC_LABEL[f]}</b><span>${money(m.readyPortions[f] || 0)}</span></button>`)}
          </div>
          ${out ? html`<p className="hint" style=${{ margin: '2px 0' }}>You can still sell — the transfer just hasn't been logged yet.</p>` : null}
          <button className="btn ghost sm" disabled=${pending(m.id)} onClick=${() => setReqFor(m)}>${pending(m.id) ? 'Requested · waiting for butchery' : 'Request meat from butchery'}</button>
        </div>`;
      })}
    </div>
    ${reqFor ? html`<${RequestQtyModal} meat=${reqFor} onClose=${() => setReqFor(null)} />` : null}
    <div className="sec-title mt">Sides</div>
    ${sides.length ? null : html`<div className="empty">No sides yet. Add them in Settings → Prices → Sides.</div>`}
    <div className="chips">${sides.map((x) => html`<button key=${x.id} className="chip" onClick=${() => onAdd(sideLine(x))}>${x.name}<small>${money(x.price)}</small></button>`)}</div>
    <div className="sec-title mt">Drinks</div>
    ${drinks.length ? null : html`<div className="empty">No drinks with a price yet. Add them in Settings → Prices → Drinks.</div>`}
    <div className="chips">${drinks.map((c) => html`<button key=${c.id} className="chip" disabled=${dLeft(c) < 1} onClick=${() => onAdd(drinkLine(c))}>${c.name}<small>${money(c.price)}</small></button>`)}</div>
  </div>`;
}
