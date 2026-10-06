const { initializeTestEnvironment, assertSucceeds, assertFails } =
  require('@firebase/rules-unit-testing');
const fs = require('fs');
const {
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs,
} = require('firebase/firestore');

const fail = [];
let n = 0;
async function t(name, fn) {
  n++;
  try { await fn(); console.log('  PASS  ' + name); }
  catch (e) { console.log('  FAIL  ' + name + '   <- ' + (e.message || e).slice(0, 120)); fail.push(name); }
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'hayat-rules-test',
    firestore: { rules: fs.readFileSync(__dirname + '/../firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  });

  // ---- the crew the restaurant actually has -------------------------
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'crew', '_list'), { people: [
      { id: 'majid',  name: 'Majid',  role: 'office'  },
      { id: 'rashid', name: 'Rashid', role: 'captain' },
      { id: 'anees',  name: 'Anees',  role: 'waiter'  },
    ]});
    await setDoc(doc(d, 'crew', 'majid'),  { name: 'Majid',  code: '111111', role: 'office'  });
    await setDoc(doc(d, 'crew', 'rashid'), { name: 'Rashid', code: '222222', role: 'captain' });
    await setDoc(doc(d, 'crew', 'anees'),  { name: 'Anees',  code: '333333', role: 'waiter'  });
    await setDoc(doc(d, 'customers', '919000000001'), { name: 'A customer', addr: 'Somewhere' });
  });

  const anon = (uid) => env.authenticatedContext(uid).firestore();
  const signIn = (uid, crew, code, role, name) =>
    setDoc(doc(anon(uid), 'staff', uid), { crew, code, role, name, at: Date.now() });

  // ================= signing in =================
  await t('captain signs in with their own code and role',
    () => assertSucceeds(signIn('u-cap', 'rashid', '222222', 'captain', 'Rashid')));

  await t('waiter signs in with their own code and role',
    () => assertSucceeds(signIn('u-wai', 'anees', '333333', 'waiter', 'Anees')));

  await t('office signs in',
    () => assertSucceeds(signIn('u-off', 'majid', '111111', 'office', 'Majid')));

  await t('a wrong code is refused',
    () => assertFails(signIn('u-bad', 'anees', '000000', 'waiter', 'Anees')));

  await t('a waiter CANNOT claim the office role with their own code',
    () => assertFails(signIn('u-bad2', 'anees', '333333', 'office', 'Anees')));

  await t('a waiter CANNOT claim office by naming the office crew id',
    () => assertFails(signIn('u-bad3', 'majid', '333333', 'office', 'Anees')));

  await t('nobody may sign in as somebody else’s uid',
    () => assertFails(setDoc(doc(anon('u-cap'), 'staff', 'u-off'),
      { crew: 'rashid', code: '222222', role: 'captain', name: 'Rashid', at: 1 })));

  // ================= the shift change =================
  await t('a tablet can be re-signed by the next person',
    () => assertSucceeds(signIn('u-cap', 'anees', '333333', 'waiter', 'Anees')));

  await t('re-signing cannot promote: same uid, office role, waiter code',
    () => assertFails(signIn('u-cap', 'anees', '333333', 'office', 'Anees')));

  // put the captain back for the rest of the run
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'staff', 'u-cap'),
      { crew: 'rashid', code: '222222', role: 'captain', name: 'Rashid', at: 1 });
  });

  await t('nobody may delete a staff record from the app',
    () => assertFails(deleteDoc(doc(anon('u-cap'), 'staff', 'u-cap'))));

  await t('you may read your own record and no one else’s', async () => {
    await assertSucceeds(getDoc(doc(anon('u-cap'), 'staff', 'u-cap')));
    await assertFails(getDoc(doc(anon('u-cap'), 'staff', 'u-off')));
  });

  // ================= what the counter may do =================
  const ticket = (uid) => ({
    status: 'placed', custUid: uid, lines: [{ id: 'chicken-mandi', q: 1, price: 380 }],
    total: 380, source: 'counter', mode: 'takeaway', at: Date.now(), log: [],
  });

  await t('a captain may ring up a counter order',
    () => assertSucceeds(setDoc(doc(anon('u-cap'), 'orders', 'ORD-CAP'), ticket('u-cap'))));

  await t('a waiter may ring up a counter order',
    () => assertSucceeds(setDoc(doc(anon('u-wai'), 'orders', 'ORD-WAI'), ticket('u-wai'))));

  await t('a waiter may move their order along (accepted)',
    () => assertSucceeds(updateDoc(doc(anon('u-wai'), 'orders', 'ORD-WAI'),
      { status: 'accepted', at: Date.now(), log: [{ s: 'accepted', at: 1 }] })));

  await t('a captain may correct the lines on an order',
    () => assertSucceeds(updateDoc(doc(anon('u-cap'), 'orders', 'ORD-WAI'),
      { lines: [{ id: 'beef-mandi', q: 2, price: 420 }], total: 840 })));

  await t('a waiter may NOT mark an order paid',
    () => assertFails(updateDoc(doc(anon('u-wai'), 'orders', 'ORD-WAI'),
      { paid: true, payMode: 'cash' })));

  await t('a waiter may NOT rewrite who the order is for',
    () => assertFails(updateDoc(doc(anon('u-wai'), 'orders', 'ORD-WAI'),
      { phone: '919000000009', addr: 'Elsewhere' })));

  await t('a waiter may NOT delete an order',
    () => assertFails(deleteDoc(doc(anon('u-wai'), 'orders', 'ORD-WAI'))));

  // ================= what the counter may NOT see =================
  await t('a waiter may NOT read the customer book',
    () => assertFails(getDocs(collection(anon('u-wai'), 'customers'))));

  await t('a captain may NOT read the customer book',
    () => assertFails(getDocs(collection(anon('u-cap'), 'customers'))));

  await t('the office may read the customer book',
    () => assertSucceeds(getDocs(collection(anon('u-off'), 'customers'))));

  await t('a waiter may NOT read the bills (vm_bills)',
    () => assertFails(getDoc(doc(anon('u-wai'), 'vm_bills', 'any'))));

  await t('a waiter may NOT change prices (menus)',
    () => assertFails(setDoc(doc(anon('u-wai'), 'menus', '_active'), { id: 'x' })));

  await t('a waiter may NOT hand out codes (crew)',
    () => assertFails(setDoc(doc(anon('u-wai'), 'crew', 'anees'), { code: '999999' })));

  await t('a captain may NOT list riders',
    () => assertFails(getDocs(collection(anon('u-cap'), 'riders'))));

  // ================= a plain customer is unaffected =================
  await t('a customer may still place their own order',
    () => assertSucceeds(setDoc(doc(anon('u-cust'), 'orders', 'ORD-CUST'),
      { status: 'placed', custUid: 'u-cust', lines: [{ id: 'x', q: 1, price: 10 }], total: 10, at: 1, log: [] })));

  await t('a customer may NOT accept their own order',
    () => assertFails(updateDoc(doc(anon('u-cust'), 'orders', 'ORD-CUST'), { status: 'accepted' })));

  await env.cleanup();
  console.log('');
  console.log(fail.length ? ('FAILED ' + fail.length + '/' + n + ': ' + fail.join(', ')) : ('ALL GREEN (' + n + ' rules checks)'));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
