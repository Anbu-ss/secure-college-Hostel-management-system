const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../../src/server/server.js');
const dbConfig = require('../../config/database.config.js');
const { supabase } = require('../../config/supabase.config.js');

function requestJson(server, { method, path, body, token }) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const data = body ? JSON.stringify(body) : null;
    const headers = {};
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
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
    if (data) req.write(data);
    req.end();
  });
}

test('Complete Student Lifecycle (Legacy SQLite Workflow - superseded by student-self-registration.test.js)', { skip: 'Legacy SQLite flow superseded by Supabase Native mode (see student-self-registration.test.js)' }, async (t) => {
  // Wait for db to be initialized
  await new Promise(r => setTimeout(r, 600));

  let server;
  let adminToken = '';
  const now = Date.now();
  const testAdminEmail = `admin_mgmt_${now}@college.test`;
  const testAdminPassword = `TestAdminPwd${now}!`;
  const testRegNo = 'REG-INT-' + now.toString().slice(-6);
  const testEmail = `student_${now}@college.edu`;
  let activationCode = '';
  let activationToken = '';
  let studentToken = '';

  await t.test('Server setup and Admin login', async () => {
    // Provision isolated test admin via secure institutional RPC
    await supabase.rpc('create_institutional_user', {
      p_email: testAdminEmail,
      p_password: testAdminPassword,
      p_full_name: 'Dynamic Test Admin',
      p_role: 'ADMIN'
    });

    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));

    // Login as Admin
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { identifier: testAdminEmail, password: testAdminPassword }
    });

    assert.strictEqual(res.status, 200, 'Admin login should succeed');
    assert.ok(res.body.token, 'Should receive JWT token');
    adminToken = res.body.token;
  });

  await t.test('Admin adds single student with PENDING_ACTIVATION', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/students',
      token: adminToken,
      body: {
        name: 'Integration Test Student',
        registerNumber: testRegNo,
        email: testEmail,
        department: 'Computer Science',
        yearOfStudy: '3rd Year',
        academicYear: '2025-2026',
        roomNumber: 'B-303'
      }
    });

    assert.strictEqual(res.status, 201, 'Student creation should return 201');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.activationCode, 'Should return initial activation code');
    activationCode = res.body.activationCode;
  });

  await t.test('Unactivated student cannot login yet', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { identifier: testRegNo, password: 'AnyPassword@123' }
    });

    assert.strictEqual(res.status, 403, 'Unactivated account must be rejected with 403');
    assert.strictEqual(res.body.requiresActivation, true, 'Flag requiresActivation must be true');
  });

  await t.test('Student initiates activation via Register Number', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/activation/initiate',
      body: { registerNumber: testRegNo }
    });

    assert.strictEqual(res.status, 200, 'Activation initiation should return 200');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.activationToken, 'Should return activation token');
    activationToken = res.body.activationToken;
    if (res.body.activationCode) {
      activationCode = res.body.activationCode;
    }
  });

  await t.test('Student completes activation with secure password', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/activation/complete',
      body: {
        activationToken,
        activationCode,
        password: 'SecureStudentPass@123'
      }
    });

    assert.strictEqual(res.status, 200, 'Activation completion should return 200');
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.status, 'ACTIVE');
  });

  await t.test('Activated student logs in successfully with Register Number', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        identifier: testRegNo,
        password: 'SecureStudentPass@123'
      }
    });

    assert.strictEqual(res.status, 200, 'Login with register number should succeed');
    assert.strictEqual(res.body.user.role, 'Student');
    assert.strictEqual(res.body.user.status, 'ACTIVE');
    assert.ok(res.body.token, 'Should receive token for student');
    studentToken = res.body.token;
  });

  await t.test('Student retrieves own profile', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: '/api/students/profile',
      token: studentToken
    });

    assert.strictEqual(res.status, 200, 'Get profile should return 200');
    assert.strictEqual(res.body.academic.RegisterNumber, testRegNo);
    assert.ok(res.body.profileCompletion >= 25, 'Profile completion score calculated');
  });

  await t.test('Student updates personal profile information', async () => {
    const res = await requestJson(server, {
      method: 'PUT',
      path: '/api/students/profile',
      token: studentToken,
      body: {
        phone: '9876543210',
        personalEmail: 'personal@gmail.com',
        bloodGroup: 'O+',
        gender: 'Male',
        addressLine1: '42 Main Street, Tech Park',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        guardianName: 'Guardian Name',
        guardianPhone: '9876543211',
        guardianRelation: 'Father'
      }
    });

    assert.strictEqual(res.status, 200, 'Profile update should return 200');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.profileCompletion > 50, 'Completion score should increase after filling details');
  });

  await t.test('Admin searches and toggles student status', async () => {
    // 1. Search for student
    const searchRes = await requestJson(server, {
      method: 'GET',
      path: `/api/students?search=${testRegNo}`,
      token: adminToken
    });

    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.students.length, 1);
    const studentDbId = searchRes.body.students[0].userId;

    // 2. Suspend account
    const suspendRes = await requestJson(server, {
      method: 'PATCH',
      path: `/api/students/${studentDbId}/status`,
      token: adminToken,
      body: { status: 'SUSPENDED' }
    });

    assert.strictEqual(suspendRes.status, 200);
    assert.strictEqual(suspendRes.body.status, 'SUSPENDED');

    // 3. Reactivate account
    const reactivateRes = await requestJson(server, {
      method: 'PATCH',
      path: `/api/students/${studentDbId}/status`,
      token: adminToken,
      body: { status: 'ACTIVE' }
    });

    assert.strictEqual(reactivateRes.status, 200);
    assert.strictEqual(reactivateRes.body.status, 'ACTIVE');
  });

  await t.test('Bulk import preview and validation', async () => {
    const previewRes = await requestJson(server, {
      method: 'POST',
      path: '/api/students/bulk-import/preview',
      token: adminToken,
      body: {
        rows: [
          { 'Register Number': 'REG-BLK-101', 'Full Name': 'Alice Bob', 'College Email': 'alice@college.edu', 'Department': 'CSE', 'Year': '1st Year' },
          { 'Register Number': '', 'Full Name': 'Invalid Student' } // intentional error row
        ]
      }
    });

    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.body.summary.total, 2);
    assert.strictEqual(previewRes.body.summary.valid, 1);
    assert.strictEqual(previewRes.body.summary.invalid, 1);
  });

  await t.test('Server teardown & Clean Test Data', async () => {
    try {
      await supabase.from('profiles').delete().in('email', [testEmail, testAdminEmail]);
      await supabase.from('students').delete().in('college_email', [testEmail]);
      const pool = require('../../config/database.config');
      await pool.execute('DELETE FROM Users WHERE LOWER(Email) = LOWER(?)', [testEmail]);
      await pool.execute('DELETE FROM ActivationTokens WHERE RegisterNumber = ?', [testRegNo]);
    } catch (_) {}
    if (server) {
      await new Promise(r => server.close(r));
    }
  });
});
