/* Live API tests: authentication + the stale-save guard. */
const B = 'http://localhost:4173';
const pass = [], fail = [];
const t = (n, c, extra) => { (c ? pass : fail).push(n); console.log((c ? '  PASS  ' : '  FAIL  ') + n + (extra ? '   [' + extra + ']' : '')); };
const j = (r) => r.json().catch(() => ({}));

(async () => {
  /* ---------- 1. boot endpoint leaks nothing ---------- */
  const boot = await fetch(B + '/api/boot');
  const bd = await boot.json();
  t('GET /api/boot returns 200', boot.status === 200, 'status ' + boot.status);
  t('boot sends the business name', !!bd.business, bd.business);
  t('boot sends the user list', Array.isArray(bd.users) && bd.users.length > 0, (bd.users || []).length + ' users');
  t('boot NEVER sends passwords', !JSON.stringify(bd).includes('"pass"'));
  t('boot sends no sales data', bd.sales === undefined && bd.meats === undefined);

  /* ---------- 2. data is locked before sign-in ---------- */
  const noAuth1 = await fetch(B + '/api/state');
  t('GET /api/state without a token is refused', noAuth1.status === 401, 'status ' + noAuth1.status);
  const noAuth2 = await fetch(B + '/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  t('POST /api/state without a token is refused', noAuth2.status === 401, 'status ' + noAuth2.status);
  const badTok = await fetch(B + '/api/state', { headers: { Authorization: 'Bearer not-a-real-token' } });
  t('a forged token is refused', badTok.status === 401, 'status ' + badTok.status);

  /* ---------- 3. login ---------- */
  const wrong = await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', pass: 'nope' }) });
  t('wrong password is refused', wrong.status === 401, 'status ' + wrong.status);
  const wrongUser = await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'nobody', pass: 'x' }) });
  t('unknown user is refused', wrongUser.status === 401, 'status ' + wrongUser.status);
  const ok = await fetch(B + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', pass: 'admin' }) });
  const okd = await ok.json();
  t('correct credentials sign in', ok.status === 200 && !!okd.token, 'token ' + String(okd.token).slice(0, 8) + '…');
  const H = { Authorization: 'Bearer ' + okd.token, 'Content-Type': 'application/json' };

  /* ---------- 4. signed-in access + versioning ---------- */
  const g1 = await fetch(B + '/api/state', { headers: H });
  const v1 = g1.headers.get('X-Smartpos-Version');
  t('GET /api/state with a token works', g1.status === 200, 'status ' + g1.status);
  t('server reports a version', v1 !== null, 'version ' + v1);
  const state = await g1.json();

  const put = (st, ver) => fetch(B + '/api/state', {
    method: 'POST', headers: Object.assign({}, H, ver === null ? {} : { 'X-Smartpos-Expected-Version': String(ver) }),
    body: JSON.stringify(st),
  });

  const saveA = JSON.parse(JSON.stringify(state));
  saveA.sales.push({ id: 'TILL-A-SALE', no: 9001, day: '2026-10-07', at: new Date().toISOString(), source: 'ready', lines: [], total: 1500, balance: 0, status: 'paid', cashier: 'A', voided: false });
  const r1 = await put(saveA, v1);
  const v2 = r1.headers.get('X-Smartpos-Version');
  t('first save accepted', r1.status === 200, 'status ' + r1.status);
  t('version advanced', Number(v2) === Number(v1) + 1, v1 + ' -> ' + v2);

  /* ---------- 5. THE BUG: a second till holding stale data ---------- */
  const saveB = JSON.parse(JSON.stringify(state)); // loaded BEFORE till A saved
  saveB.sales.push({ id: 'TILL-B-SALE', no: 9002, day: '2026-10-07', at: new Date().toISOString(), source: 'ready', lines: [], total: 2200, balance: 0, status: 'paid', cashier: 'B', voided: false });
  const r2 = await put(saveB, v1); // stale version
  t('stale save from a second till is REFUSED', r2.status === 409, 'status ' + r2.status);
  const conflict = await j(r2);
  t('refusal explains itself', conflict.error === 'conflict', JSON.stringify(conflict));

  const after = await (await fetch(B + '/api/state', { headers: H })).json();
  const ids = after.sales.map((s) => s.id);
  t("TILL A's sale SURVIVED (this is what used to vanish)", ids.includes('TILL-A-SALE'), ids.join(',') || 'none');
  t("TILL B's stale copy did not overwrite anything", !ids.includes('TILL-B-SALE'));

  /* ---------- 6. the second till can recover by reloading ---------- */
  const fresh = await (await fetch(B + '/api/state', { headers: H })).json();
  const vNow = (await fetch(B + '/api/state', { headers: H })).headers.get('X-Smartpos-Version');
  fresh.sales.push({ id: 'TILL-B-RETRY', no: 9003, day: '2026-10-07', at: new Date().toISOString(), source: 'ready', lines: [], total: 2200, balance: 0, status: 'paid', cashier: 'B', voided: false });
  const r3 = await put(fresh, vNow);
  t('after reloading, the second till saves fine', r3.status === 200, 'status ' + r3.status);
  const final = await (await fetch(B + '/api/state', { headers: H })).json();
  const fids = final.sales.map((s) => s.id);
  t('both sales now present, neither lost', fids.includes('TILL-A-SALE') && fids.includes('TILL-B-RETRY'), fids.join(','));

  /* ---------- 7. logout ---------- */
  const out = await fetch(B + '/api/logout', { method: 'POST', headers: H });
  t('logout succeeds', out.status === 200, 'status ' + out.status);
  const afterOut = await fetch(B + '/api/state', { headers: H });
  t('the token stops working after logout', afterOut.status === 401, 'status ' + afterOut.status);

  /* ---------- 8. the app page itself is still served ---------- */
  const page = await fetch(B + '/');
  t('the till page still loads without auth', page.status === 200, 'status ' + page.status);

  console.log('\n' + pass.length + ' passed, ' + fail.length + ' failed');
  if (fail.length) { console.log('FAILED:'); fail.forEach((f) => console.log('  - ' + f)); process.exit(1); }
})();
