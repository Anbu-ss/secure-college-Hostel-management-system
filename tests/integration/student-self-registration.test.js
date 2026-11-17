const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../../src/server/server.js');
const { supabase } = require('../../config/supabase.config');

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
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(resData) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: resData });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function requestBuffer(server, { path, token }) {
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
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer: Buffer.concat(chunks)
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('Student Self-Registration, Mandatory Password Change, Profile Completion, Admin Approval, and Room Allocation', async (t) => {
  // Allow database to settle
  await new Promise(r => setTimeout(r, 600));

  let server;
  let adminToken = '';
  let studentToken = '';
  const now = Date.now();
  const testAdminEmail = `admin_selfreg_${now}@college.test`;
  const testAdminPassword = `TestAdminPwd${now}!`;
  const testStudentEmail = `student_${now}@gmail.com`;
  let studentId = null;
  let studentCode = '';

  await t.test('1. Setup Server and Admin Authentication', async () => {
    // Provision isolated test admin via secure institutional RPC
    await supabase.rpc('create_institutional_user', {
      p_email: testAdminEmail,
      p_password: testAdminPassword,
      p_full_name: 'Dynamic Test Admin',
      p_role: 'ADMIN'
    });

    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));

    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: { identifier: testAdminEmail, password: testAdminPassword }
    });

    assert.strictEqual(res.status, 200, 'Admin login should succeed');
    assert.ok(res.body.token, 'Admin receives JWT token');
    adminToken = res.body.token;
  });

  await t.test('2. Student Self-Registration with Initial Temporary Password dmi@1202', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/student/register',
      body: {
        fullName: 'Self Reg Student',
        email: testStudentEmail,
        password: 'dmi@1202',
        confirmPassword: 'dmi@1202',
        phoneNumber: '9840123456'
      }
    });

    assert.strictEqual(res.status, 201, 'Registration returns 201 Created');
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.studentCode, 'Assigned unique student code');
    studentCode = res.body.studentCode;
  });

  await t.test('3. First Login with dmi@1202 Requires Mandatory Password Change', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        identifier: testStudentEmail,
        password: 'dmi@1202'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.mustChangePassword, true, 'mustChangePassword must be true');
    assert.strictEqual(res.body.redirectUrl, '/student/change-password');
  });

  await t.test('4. Reject Changing Password to the Same Temporary Credential', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/student/change-password',
      body: {
        email: testStudentEmail,
        currentPassword: 'dmi@1202',
        newPassword: 'dmi@1202',
        confirmPassword: 'dmi@1202'
      }
    });

    assert.strictEqual(res.status, 400, 'Must reject password identical to temporary default');
  });

  await t.test('5. Successfully Change Password to Secure Permanent Credential', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/student/change-password',
      body: {
        email: testStudentEmail,
        currentPassword: 'dmi@1202',
        newPassword: 'SecurePermanentPass#2026',
        confirmPassword: 'SecurePermanentPass#2026'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.redirectUrl, '/student/complete-profile');
    assert.ok(res.body.token, 'Returns token with new session');
    studentToken = res.body.token;
  });

  await t.test('6. Student Completes Profile Form (Status Transitions to PENDING_APPROVAL)', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/student/complete-profile',
      token: studentToken,
      body: {
        dateOfBirth: '2004-05-12',
        gender: 'Male',
        department: 'CSE',
        academicYear: '2024-2028',
        yearOfStudy: 1,
        registerNumber: '2105' + Date.now().toString().slice(-8),
        roomNumber: 'B-204',
        phoneNumber: '9840123456',
        permanentAddress: '124 Gandhi Road',
        currentAddress: '124 Gandhi Road',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600001',
        guardianName: 'M. Senthil',
        guardianRelationship: 'Father',
        guardianPhone: '9840123457',
        emergencyContact: '9840123458'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.accountStatus, 'PENDING_APPROVAL');
    assert.strictEqual(res.body.redirectUrl, '/student/pending-approval');
  });

  await t.test('7. Unapproved Student Access to Active Dashboard is Guarded', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: '/api/student/dashboard',
      token: studentToken
    });

    assert.strictEqual(res.status, 403, 'Unapproved student cannot access active dashboard');
    assert.strictEqual(res.body.code, 'PENDING_APPROVAL');
  });

  await t.test('8. Admin Searches Student in Directory and Reviews Profile', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: `/api/admin/students?search=${encodeURIComponent(testStudentEmail)}`,
      token: adminToken
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.students.length >= 1, 'Student found in directory');
    const student = res.body.students[0];
    studentId = student.id;
    assert.strictEqual(student.email, testStudentEmail);
  });

  await t.test('9. Admin Approves Student Account and Allocates Room', async () => {
    // Approve
    const approveRes = await requestJson(server, {
      method: 'PATCH',
      path: `/api/admin/students/${studentId}/approve`,
      token: adminToken
    });
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.body.status, 'ACTIVE');

    // Allocate Room
    const allocateRes = await requestJson(server, {
      method: 'POST',
      path: `/api/admin/students/${studentId}/allocate-room`,
      token: adminToken,
      body: {
        hostelName: 'Main Boys Hostel',
        roomNumber: 'B-204'
      }
    });
    assert.strictEqual(allocateRes.status, 200);
    assert.strictEqual(allocateRes.body.roomNumber, 'B-204');
  });

  await t.test('10. Admin Exports Student Directory to Excel (.xlsx)', async () => {
    const res = await requestBuffer(server, {
      path: '/api/admin/students/export',
      token: adminToken
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('spreadsheetml'), 'Excel content-type returned');
    assert.ok(res.buffer.length > 500, 'Excel file binary generated');
  });

  await t.test('11. Approved Student Successfully Authenticates and Accesses Dashboard', async () => {
    // Student logs in with permanent password
    const loginRes = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        identifier: testStudentEmail,
        password: 'SecurePermanentPass#2026'
      }
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.user.role, 'Student');
    const newStudentToken = loginRes.body.token;

    // Student dashboard
    const dashRes = await requestJson(server, {
      method: 'GET',
      path: '/api/student/dashboard',
      token: newStudentToken
    });
    if (dashRes.status !== 200) {
      console.log('DASH RES ERROR BODY:', dashRes.body);
    }
    assert.strictEqual(dashRes.status, 200);
    assert.strictEqual(dashRes.body.success, true);
  });

  await t.test('12. Teardown Server & Clean Test Data', async () => {
    try {
      const sqlitePool = require('../../config/database.config');
      await sqlitePool.execute('DELETE FROM Users WHERE LOWER(Email) = LOWER(?)', [testStudentEmail]);
      await supabase.from('students').delete().eq('college_email', testStudentEmail.toLowerCase());
      await supabase.from('profiles').delete().in('email', [testStudentEmail.toLowerCase(), testAdminEmail.toLowerCase()]);
    } catch (_) {}
    if (server) {
      await new Promise(r => server.close(r));
    }
  });
});
