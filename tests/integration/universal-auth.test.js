const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../../src/server/server.js');

function postJson(server, path, body, token) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers,
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch {
          resolve({ status: res.statusCode, raw: resData });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(server, path, token) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET',
      headers,
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(resData) });
        } catch {
          resolve({ status: res.statusCode, raw: resData });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('Universal Auth: All user roles authenticate via POST /api/auth/login and receive correct redirectUrl', async (t) => {
  const { supabase } = require('../../config/supabase.config');
  await new Promise(r => setTimeout(r, 400));

  const ts = Date.now();
  const testStudentEmail = `auth_test_student_${ts}@hostel.test`;
  const testStudentRegNo = `REG${ts.toString().slice(-6)}`;
  const testAdminEmail = `auth_test_admin_${ts}@hostel.test`;
  const testWardenEmail = `auth_test_warden_${ts}@hostel.test`;
  const testPassword = `TestPass@${ts.toString().slice(-4)}!`;

  // 1. Seed dynamic test accounts via Supabase RPCs
  const { data: stUser } = await supabase.rpc('register_student_user', {
    p_email: testStudentEmail,
    p_password: testPassword,
    p_full_name: 'Dynamic Test Student'
  });

  // Assign register number and activate student
  if (stUser?.user_id) {
    await supabase.from('profiles').update({
      account_status: 'ACTIVE',
      username: testStudentRegNo,
      must_change_password: false
    }).eq('id', stUser.user_id);

    await supabase.from('students').update({
      register_number: testStudentRegNo,
      student_status: 'ACTIVE'
    }).eq('user_id', stUser.user_id);
  }

  // Seed dynamic Admin & Warden via secure institutional RPC
  await supabase.rpc('create_institutional_user', {
    p_email: testAdminEmail,
    p_password: testPassword,
    p_full_name: 'Dynamic Test Admin',
    p_role: 'ADMIN'
  });

  await supabase.rpc('create_institutional_user', {
    p_email: testWardenEmail,
    p_password: testPassword,
    p_full_name: 'Dynamic Test Warden',
    p_role: 'WARDEN'
  });

  const TEST_PORT = 5099;
  const server = app.listen(TEST_PORT, '127.0.0.1');
  await new Promise(r => setTimeout(r, 100));

  t.after(async () => {
    server.close();
    try {
      // Clean up dynamic test accounts
      const testEmails = [testStudentEmail, testAdminEmail, testWardenEmail];
      for (const em of testEmails) {
        await supabase.from('students').delete().eq('college_email', em);
        await supabase.from('profiles').delete().eq('email', em);
      }
    } catch (_) {}
  });

  // 1. Student by email
  const resStudentEmail = await postJson(server, '/api/auth/login', {
    identifier: testStudentEmail,
    password: testPassword
  });
  assert.strictEqual(resStudentEmail.status, 200);
  assert.strictEqual(resStudentEmail.body.user.role, 'Student');
  assert.strictEqual(resStudentEmail.body.redirectUrl, '/student/dashboard');
  assert.ok(resStudentEmail.body.token);

  // 2. Student by RegisterNumber (username)
  const resStudentRegNo = await postJson(server, '/api/auth/login', {
    identifier: testStudentRegNo,
    password: testPassword
  });
  assert.strictEqual(resStudentRegNo.status, 200);
  assert.strictEqual(resStudentRegNo.body.user.role, 'Student');

  // 3. Warden
  const resWarden = await postJson(server, '/api/auth/login', {
    identifier: testWardenEmail,
    password: testPassword
  });
  assert.strictEqual(resWarden.status, 200);
  assert.strictEqual(resWarden.body.user.role, 'Warden');
  assert.strictEqual(resWarden.body.redirectUrl, '/warden/dashboard');

  // 4. Admin
  const resAdmin = await postJson(server, '/api/auth/login', {
    identifier: testAdminEmail,
    password: testPassword
  });
  assert.strictEqual(resAdmin.status, 200);
  assert.strictEqual(resAdmin.body.user.role, 'Admin');
  assert.strictEqual(resAdmin.body.redirectUrl, '/admin/dashboard');

  // 5. Rejection on bad password
  const resBadPwd = await postJson(server, '/api/auth/login', {
    identifier: testAdminEmail,
    password: 'wrong_password_xyz'
  });
  assert.strictEqual(resBadPwd.status, 401);

  // 6. Rejection on non-existent user
  const resUnknown = await postJson(server, '/api/auth/login', {
    identifier: 'ghost_user@example.com',
    password: 'somepassword'
  });
  assert.strictEqual(resUnknown.status, 401);

  // 7. Session verification via GET /api/auth/me
  const resMe = await getJson(server, '/api/auth/me', resStudentEmail.body.token);
  assert.strictEqual(resMe.status, 200);
  assert.strictEqual(resMe.body.authenticated, true);
  assert.strictEqual(resMe.body.user.registerNumber, testStudentRegNo);
});
