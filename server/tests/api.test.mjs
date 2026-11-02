/**
 * End-to-end API regression tests (no framework needed).
 *
 * 1. Start the API against a THROWAWAY database with email disabled and the log captured:
 *      MONGO_URI=mongodb://127.0.0.1:27017/taskflow_test SMTP_HOST= AUTH_RATE_LIMIT=1000 node src/server.js > /tmp/taskflow-test.log 2>&1 &
 * 2. Run:  TEST_LOG=/tmp/taskflow-test.log node tests/api.test.mjs
 * Verification codes are read from the server's dev-email log lines ("OTP (verify) for ...").
 */
import fs from 'fs';

const BASE = process.env.API_URL || 'http://localhost:5001';
const LOG = process.env.TEST_LOG || '/tmp/taskflow-test.log';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL:', name, extra); } };

const call = async (method, path, { token, body, ua, cookie, form } = {}) => {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (ua) headers['user-agent'] = ua;
  if (cookie) headers.cookie = cookie;
  let payload;
  if (form) payload = form; else if (body) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(`${BASE}/api${path}`, { method, headers, body: payload });
  const text = await r.text();
  let json = {}; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, data: json.data, headers: r.headers, text };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const otp = async (purpose, email) => {
  await wait(120);
  const l = fs.readFileSync(LOG, 'utf8').split('\n').filter((x) => x.includes(`OTP (${purpose}) for ${email}`));
  return l.length ? l.pop().split(': ').pop().trim() : null;
};
const UA = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Mobile/15E148 Safari/604.1',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Edg/120',
  fox: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
  and: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit Safari/604.1',
};
const stamp = Date.now();
const A = `a${stamp}@test.com`, B = `b${stamp}@test.com`;
const signup = async (name, email) => {
  await call('POST', '/auth/register', { body: { name, email, password: 'secret123' } });
  const v = await call('POST', '/auth/verify-email', { body: { email, code: await otp('verify', email) }, ua: UA.mac });
  return { token: v.data?.accessToken, user: v.data?.user };
};

try {
  // ---------- sign up and email verification ----------
  let r = await call('POST', '/auth/register', { body: { name: '', email: 'bad', password: '1' } });
  ok('register validation 400', r.status === 400);
  r = await call('POST', '/auth/register', { body: { name: 'Alice', email: A, password: 'secret123' } });
  ok('register 201 needs verification, no token', r.status === 201 && r.data.needsVerification && !r.data.accessToken);
  r = await call('POST', '/auth/login', { body: { email: A, password: 'secret123' } });
  ok('unverified login -> 403', r.status === 403 && r.data?.needsVerification);
  ok('no token -> 401', (await call('GET', '/users/me')).status === 401);
  for (let i = 0; i < 5; i++) await call('POST', '/auth/verify-email', { body: { email: A, code: '000000' } });
  r = await call('POST', '/auth/verify-email', { body: { email: A, code: '000000' } });
  ok('code locks after 5 wrong tries', r.status === 429 || /expired|many/i.test(r.json.message || ''));
  await call('POST', '/auth/resend-otp', { body: { email: A, purpose: 'verify' } }); // may hit cooldown
  const { MongoClient } = await import(new URL('../node_modules/mongodb/lib/index.js', import.meta.url)).catch(() => ({}));
  if (MongoClient) { // clear the resend cooldown directly so the test need not wait 30s
    const c = await MongoClient.connect(process.env.MONGO_URI); await c.db().collection('otps').updateMany({ email: A }, { $set: { updatedAt: new Date(0) } }); await c.close();
    await call('POST', '/auth/resend-otp', { body: { email: A, purpose: 'verify' } });
  } else await wait(31000).then(() => call('POST', '/auth/resend-otp', { body: { email: A, purpose: 'verify' } }));
  const code = await otp('verify', A);
  const v = await call('POST', '/auth/verify-email', { body: { email: A, code }, ua: UA.mac });
  ok('verify email works', v.status === 200 && v.data.accessToken);
  const tA = v.data.accessToken;
  ok('code is single use', (await call('POST', '/auth/verify-email', { body: { email: A, code } })).status === 400);
  ok('duplicate verified email 409', (await call('POST', '/auth/register', { body: { name: 'x', email: A, password: 'secret123' } })).status === 409);
  ok('wrong password 401', (await call('POST', '/auth/login', { body: { email: A, password: 'nope1234' } })).status === 401);
  r = await call('POST', '/auth/login', { body: { email: 'nobody@test.com', password: 'secret123' } });
  ok('unknown user same message (no enumeration)', r.status === 401 && r.json.message === 'Invalid email or password');
  ok('code login removed (404)', (await call('POST', '/auth/login-otp', { body: { email: A } })).status === 404);
  r = await call('POST', '/auth/login', { body: { email: A, password: 'secret123' }, ua: UA.iphone });
  ok('verified user logs in with password only', r.status === 200 && r.data.accessToken);
  r = await call('POST', '/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } });
  ok('operator injection rejected', r.status === 400 || r.status === 401);

  // ---------- profile ----------
  r = await call('GET', '/users/me', { token: tA });
  ok('me leaks no secrets', !/"password"|refreshTokenHash|resetPasswordToken/.test(r.text));
  const fd = new FormData();
  fd.append('purposes', JSON.stringify(['work', 'study'])); fd.append('onboardingCompleted', 'true');
  fd.append('profile', JSON.stringify({ jobTitle: 'Engineer', company: 'Acme' })); fd.append('name', 'Alice A');
  r = await call('PUT', '/users/me', { token: tA, form: fd });
  ok('onboarding sets profile and categories', r.status === 200 && r.data.profile.jobTitle === 'Engineer' && r.data.categories.map((c) => c.name).join() === 'Work,Study');
  r = await call('PUT', '/users/me', { token: tA, body: { preferences: JSON.stringify({ dailyGoal: 8, pomodoro: { work: 30 } }) } });
  ok('preferences deep merge', r.data.preferences.dailyGoal === 8 && r.data.preferences.pomodoro.work === 30 && r.data.preferences.pomodoro.shortBreak === 5);
  ok('invalid preference rejected', (await call('PUT', '/users/me', { token: tA, body: { preferences: JSON.stringify({ weekStart: 'friday' }) } })).status === 400);
  ok('wrong current password 400', (await call('PUT', '/users/me', { token: tA, body: { currentPassword: 'x', newPassword: 'newsecret1' } })).status === 400);
  const bad = new FormData(); bad.append('avatar', new Blob(['<script>1</script>'], { type: 'text/html' }), 'x.html');
  ok('non-image avatar rejected', (await call('PUT', '/users/me', { token: tA, form: bad })).status === 400);

  // ---------- devices ----------
  r = await call('GET', '/auth/sessions', { token: tA });
  ok('device list shows names', r.data.devices.length === 2 && r.data.devices.some((d) => d.deviceName === 'Chrome on macOS' && d.current) && r.data.devices.some((d) => d.deviceName === 'Safari on iOS'));
  const ipId = r.data.devices.find((d) => d.deviceName === 'Safari on iOS')._id;
  r = await call('PATCH', `/auth/sessions/${ipId}`, { token: tA, body: { name: "Asha's iPhone" } });
  ok('rename device', r.status === 200 && r.data.deviceName === "Asha's iPhone");
  ok('empty device name 400', (await call('PATCH', `/auth/sessions/${ipId}`, { token: tA, body: { name: ' ' } })).status === 400);
  const toks = [];
  for (const ua of [UA.win, UA.fox, UA.and, UA.ipad]) toks.push((await call('POST', '/auth/login', { body: { email: A, password: 'secret123' }, ua })).data.accessToken);
  r = await call('GET', '/auth/sessions', { token: toks[3] });
  ok('device limit of 5 enforced', r.data.devices.length === 5);
  ok('oldest device signed out', (await call('GET', '/users/me', { token: tA })).status === 401);
  const tok = toks[3];
  const others = r.data.devices.filter((d) => !d.current);
  ok('sign out one device', (await call('DELETE', `/auth/sessions/${others[0]._id}`, { token: tok })).status === 200);
  ok('sign out missing device 404', (await call('DELETE', `/auth/sessions/${others[0]._id}`, { token: tok })).status === 404);
  await call('DELETE', '/auth/sessions', { token: tok });
  r = await call('GET', '/auth/sessions', { token: tok });
  ok('only current device remains', r.data.devices.length === 1 && r.data.devices[0].current);

  // ---------- refresh tokens ----------
  const lg = await call('POST', '/auth/login', { body: { email: A, password: 'secret123' }, ua: UA.mac });
  const sc = lg.headers.getSetCookie?.() || [];
  ok('auth cookies are httpOnly', sc.length >= 2 && sc.every((c) => /HttpOnly/i.test(c)));
  const cookie = sc.map((c) => c.split(';')[0]).join('; ');
  ok('refresh works', (await call('POST', '/auth/refresh', { cookie })).status === 200);
  ok('rotated refresh token rejected', (await call('POST', '/auth/refresh', { cookie })).status === 401);

  // ---------- forgot password ----------
  ok('forgot unknown email is generic 200', (await call('POST', '/auth/forgot-password', { body: { email: 'ghost@test.com' } })).status === 200);
  await call('POST', '/auth/forgot-password', { body: { email: A } });
  ok('forgot cooldown does not leak', (await call('POST', '/auth/forgot-password', { body: { email: A } })).status === 200);
  ok('wrong reset code 400', (await call('POST', '/auth/verify-reset-otp', { body: { email: A, code: '111111' } })).status === 400);
  r = await call('POST', '/auth/verify-reset-otp', { body: { email: A, code: await otp('reset', A) } });
  ok('reset code gives token', r.status === 200 && r.data.resetToken?.length === 64);
  const rt = r.data.resetToken;
  ok('short new password 400', (await call('POST', `/auth/reset-password/${rt}`, { body: { password: '123' } })).status === 400);
  ok('reset password', (await call('POST', `/auth/reset-password/${rt}`, { body: { password: 'brandnew99' } })).status === 200);
  ok('reset token single use', (await call('POST', `/auth/reset-password/${rt}`, { body: { password: 'another123' } })).status === 400);
  ok('all devices signed out after reset', (await call('GET', '/users/me', { token: tok })).status === 401);
  ok('old password rejected', (await call('POST', '/auth/login', { body: { email: A, password: 'secret123' } })).status === 401);
  r = await call('POST', '/auth/login', { body: { email: A, password: 'brandnew99' }, ua: UA.mac });
  ok('new password works', r.status === 200);
  const tokA = r.data.accessToken;

  // ---------- user B and task access control ----------
  const sb = await signup('Bob', B);
  const tokB = sb.token, idB = sb.user._id;
  const idA = (await call('GET', '/users/me', { token: tokA })).data._id;
  ok('empty task title 400', (await call('POST', '/tasks', { token: tokA, body: { title: '' } })).status === 400);
  ok('bad priority 400', (await call('POST', '/tasks', { token: tokA, body: { title: 'x', priority: 'urgent' } })).status === 400);
  const mk = async (b, t = tokA) => (await call('POST', '/tasks', { token: t, body: b })).data;
  const t1 = await mk({ title: 'Alpha task', priority: 'high', category: 'Work', dueDate: new Date(Date.now() + 3600e3).toISOString(), tags: ['x'] });
  const t2 = await mk({ title: 'Beta task', priority: 'low', status: 'inprogress', dueDate: new Date(Date.now() - 86400e3).toISOString() });
  const t3 = await mk({ title: 'Gamma daily', recurring: 'daily', subtasks: [{ title: 's1' }, { title: 's2' }] });
  ok('3 tasks created', t1?._id && t2?._id && t3?._id);
  const list = async (q = '', t = tokA) => (await call('GET', `/tasks${q}`, { token: t })).data;
  ok('list', (await list()).tasks.length === 3);
  ok('search', (await list('?search=alp')).tasks.length === 1);
  ok('regex characters are escaped', (await list('?search=' + encodeURIComponent('.*'))).tasks.length === 0);
  ok('filter priority', (await list('?priority=high,low')).tasks.length === 2);
  ok('filter overdue', (await list('?due=overdue')).tasks.map((t) => t.title).join() === 'Beta task');
  ok('sort priority desc', (await list('?sort=priority&order=desc')).tasks[0].priority === 'high');
  ok('pagination', (await list('?limit=2&page=2')).tasks.length === 1);
  ok('query operator object does not crash', [200, 400].includes((await call('GET', '/tasks?search[$ne]=x', { token: tokA })).status));
  ok('bad id 400', (await call('GET', '/tasks/notanid', { token: tokA })).status === 400);
  ok('ACCESS: B cannot read', (await call('GET', `/tasks/${t1._id}`, { token: tokB })).status === 403);
  ok('ACCESS: B cannot edit', (await call('PUT', `/tasks/${t1._id}`, { token: tokB, body: { title: 'hax' } })).status === 403);
  ok('ACCESS: B cannot delete', (await call('DELETE', `/tasks/${t1._id}`, { token: tokB })).status === 403);
  ok('ACCESS: B cannot change status', (await call('PATCH', `/tasks/${t1._id}/status`, { token: tokB, body: { status: 'done' } })).status === 403);
  ok('ACCESS: B list is empty', (await list('', tokB)).tasks.length === 0);
  r = await call('PUT', `/tasks/${t1._id}`, { token: tokA, body: { title: 'Alpha v2', subtasks: [{ title: 'one', done: true }] } });
  ok('update task', r.status === 200 && r.data.title === 'Alpha v2' && r.data.subtasks[0].done);
  r = await call('PATCH', `/tasks/${t3._id}/status`, { token: tokA, body: { status: 'done' } });
  ok('done sets completedAt', r.status === 200 && !!r.data.completedAt);
  ok('recurring task spawned next one', (await list('?search=Gamma')).tasks.length === 2);
  await call('PATCH', `/tasks/${t3._id}/status`, { token: tokA, body: { status: 'todo' } });
  await call('PATCH', `/tasks/${t3._id}/status`, { token: tokA, body: { status: 'done' } });
  ok('no duplicate spawn on re-complete', (await list('?search=Gamma')).tasks.length === 2);
  ok('bogus status 400', (await call('PATCH', `/tasks/${t1._id}/status`, { token: tokA, body: { status: 'bogus' } })).status === 400);
  await call('PATCH', '/tasks/reorder', { token: tokA, body: { items: [{ id: t1._id, position: 5 }] } });
  await call('PATCH', '/tasks/reorder', { token: tokB, body: { items: [{ id: t1._id, position: 99 }] } });
  ok('ACCESS: reorder by B has no effect', (await call('GET', `/tasks/${t1._id}`, { token: tokA })).data.position === 5);
  ok('time log', (await call('PATCH', `/tasks/${t1._id}/time`, { token: tokA, body: { minutes: 25 } })).data.timeSpent === 25);
  ok('negative time 400', (await call('PATCH', `/tasks/${t1._id}/time`, { token: tokA, body: { minutes: -5 } })).status === 400);
  ok('empty comment 400', (await call('POST', `/tasks/${t1._id}/comments`, { token: tokA, body: { text: '  ' } })).status === 400);
  ok('comment added', (await call('POST', `/tasks/${t1._id}/comments`, { token: tokA, body: { text: 'hello' } })).status === 201);
  ok('ACCESS: B cannot comment', (await call('POST', `/tasks/${t1._id}/comments`, { token: tokB, body: { text: 'hi' } })).status === 403);

  // ---------- attachments and upload safety ----------
  const up = async (name, type, content) => {
    const f = new FormData(); f.append('files', new Blob([content], { type }), name);
    return (await call('POST', `/tasks/${t1._id}/attachments`, { token: tokA, form: f })).data.attachments.at(-1);
  };
  const txt = await up('note.txt', 'text/plain', 'hello world');
  const dl = await fetch(BASE + txt.url);
  ok('attachment downloadable', dl.status === 200 && (await dl.text()) === 'hello world');
  const hh = async (u) => (await fetch(BASE + u)).headers;
  const html = await up('evil.html', 'text/html', '<script>1</script>');
  const svg = await up('evil.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>');
  let h = await hh(html.url);
  ok('uploaded html forced to download + sandboxed', /attachment/.test(h.get('content-disposition') || '') && /sandbox/.test(h.get('content-security-policy') || '') && h.get('x-content-type-options') === 'nosniff');
  ok('uploaded svg forced to download', /attachment/.test((await hh(svg.url)).get('content-disposition') || ''));
  r = await call('DELETE', `/tasks/${t1._id}/attachments/${txt._id}`, { token: tokA });
  ok('attachment removed', !r.data.attachments.some((a) => a._id === txt._id));
  ok('upload with no file 400', (await call('POST', `/tasks/${t1._id}/attachments`, { token: tokA, form: new FormData() })).status === 400);

  // ---------- archive, trash, export ----------
  await call('PATCH', `/tasks/${t2._id}/archive`, { token: tokA, body: { archived: true } });
  ok('archive list', (await list('?archived=true')).tasks.length === 1);
  ok('archived hidden from main list', !(await list()).tasks.some((t) => t._id === t2._id));
  await call('PATCH', `/tasks/${t2._id}/restore`, { token: tokA });
  await call('DELETE', `/tasks/${t2._id}`, { token: tokA });
  ok('trash list', (await list('?trash=true')).tasks.length === 1);
  ok('restore from trash', (await call('PATCH', `/tasks/${t2._id}/restore`, { token: tokA })).data.isDeleted === false);
  await call('DELETE', `/tasks/${t2._id}`, { token: tokA });
  ok('permanent delete', (await call('DELETE', `/tasks/${t2._id}?permanent=true`, { token: tokA })).status === 200);
  ok('permanently deleted task is gone', (await call('GET', `/tasks/${t2._id}`, { token: tokA })).status === 404);
  ok('export csv', (await call('GET', '/tasks/export?format=csv', { token: tokA })).text.startsWith('"Title"'));
  ok('export json', Array.isArray((await call('GET', '/tasks/export?format=json', { token: tokA })).json));

  // ---------- projects ----------
  ok('project needs a name', (await call('POST', '/projects', { token: tokA, body: { name: '' } })).status === 400);
  r = await call('POST', '/projects', { token: tokA, body: { name: 'Apollo' } });
  ok('project created as Owner', r.status === 201 && r.data.myRole === 'Owner');
  const pid = r.data._id;
  ok('ACCESS: non-member cannot view project', (await call('GET', `/projects/${pid}`, { token: tokB })).status === 403);
  ok('ACCESS: non-member cannot invite', (await call('POST', `/projects/${pid}/invite`, { token: tokB, body: { email: B } })).status === 403);
  ok('invite existing user', (await call('POST', `/projects/${pid}/invite`, { token: tokA, body: { email: B } })).status === 201);
  ok('duplicate invite 409', (await call('POST', `/projects/${pid}/invite`, { token: tokA, body: { email: B } })).status === 409);
  r = await call('POST', `/projects/${pid}/invite`, { token: tokA, body: { email: 'new@person.com', role: 'Admin' } });
  ok('invite unknown email becomes pending', r.status === 201 && r.data.pendingInvites.length === 1);
  ok('invalid invite email 400', (await call('POST', `/projects/${pid}/invite`, { token: tokA, body: { email: 'nope' } })).status === 400);
  ok('B got invite notification', (await call('GET', '/notifications', { token: tokB })).data.notifications.some((n) => n.type === 'invite'));
  const pt = await mk({ title: 'Project task', project: pid, assignees: [idB] });
  ok('project task with assignee', !!pt?._id && pt.assignees.length === 1);
  ok('member can read project task', (await call('GET', `/tasks/${pt._id}`, { token: tokB })).status === 200);
  ok('member can move project task', (await call('PATCH', `/tasks/${pt._id}/status`, { token: tokB, body: { status: 'review' } })).status === 200);
  ok('A notified of the move', (await call('GET', '/notifications', { token: tokA })).data.notifications.some((n) => n.type === 'status'));
  const bp = await call('POST', '/projects', { token: tokB, body: { name: 'Bob own' } });
  ok('ACCESS: cannot create task in foreign project', (await call('POST', '/tasks', { token: tokA, body: { title: 'sneaky', project: bp.data._id } })).status === 403);
  ok('ACCESS: member cannot edit project', (await call('PUT', `/projects/${pid}`, { token: tokB, body: { name: 'hax' } })).status === 403);
  ok('ACCESS: member cannot self-promote', (await call('PUT', `/projects/${pid}/members/${idB}`, { token: tokB, body: { role: 'Admin' } })).status === 403);
  ok('owner promotes member', (await call('PUT', `/projects/${pid}/members/${idB}`, { token: tokA, body: { role: 'Admin' } })).status === 200);
  ok('admin cannot demote owner', (await call('PUT', `/projects/${pid}/members/${idA}`, { token: tokB, body: { role: 'Member' } })).status === 403);
  ok('owner cannot be removed', (await call('DELETE', `/projects/${pid}/members/${idA}`, { token: tokB })).status === 400);
  ok('admin cannot delete project', (await call('DELETE', `/projects/${pid}`, { token: tokB })).status === 403);
  ok('member can leave', (await call('DELETE', `/projects/${pid}/members/${idB}`, { token: tokB })).status === 200);
  ok('left member loses access', (await call('GET', `/tasks/${pt._id}`, { token: tokB })).status === 403);
  const nid = (await call('GET', '/notifications', { token: tokB })).data.notifications[0]._id;
  ok('ACCESS: cannot mark another user notification', (await call('PATCH', `/notifications/${nid}`, { token: tokA })).status === 404);
  await call('PATCH', '/notifications/read-all', { token: tokB });
  ok('read all notifications', (await call('GET', '/notifications', { token: tokB })).data.unread === 0);
  ok('owner deletes project and its tasks', (await call('DELETE', `/projects/${pid}`, { token: tokA })).status === 200 && (await call('GET', `/tasks/${pt._id}`, { token: tokA })).status === 404);

  // ---------- analytics and misc ----------
  r = await call('GET', '/analytics/summary?tzOffset=-330', { token: tokA });
  ok('analytics shape', r.status === 200 && r.data.weekly.length === 7 && r.data.byPriority.length === 3 && r.data.streak.current >= 1);
  ok('unknown API route is JSON 404', (await call('GET', '/nonexistent')).status === 404);
  ok('delete account needs right password', (await call('DELETE', '/users/me', { token: tokB, body: { password: 'wrong' } })).status === 400);
  ok('delete account', (await call('DELETE', '/users/me', { token: tokB, body: { password: 'secret123' } })).status === 200);
  ok('deleted user cannot log in', (await call('POST', '/auth/login', { body: { email: B, password: 'secret123' } })).status === 401);
} catch (e) { console.log('TEST SCRIPT ERROR', e); fail++; }
console.log(`\nPASS ${pass}  FAIL ${fail}`);
process.exit(fail ? 1 : 0);
