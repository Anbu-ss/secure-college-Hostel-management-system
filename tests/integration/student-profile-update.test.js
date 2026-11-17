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

test('Student Profile Completion & Sequential 3-Digit ID Verification', async (t) => {
  let server;
  const now = Date.now();
  const testStudentEmail = `test_student_prof_${now}@college.test`;
  let studentToken = '';
  let studentCode = '';

  await t.test('1. Setup server and verify sequential Student ID generation (001, 002, 003...)', async () => {
    server = http.createServer(app);
    await new Promise(r => server.listen(0, '127.0.0.1', r));

    // Ensure sequence sync
    await supabase.rpc('sync_student_code_seq');

    // Test sequence generation sequentially
    const c1 = await supabase.rpc('generate_next_student_code');
    const c2 = await supabase.rpc('generate_next_student_code');
    const c3 = await supabase.rpc('generate_next_student_code');

    const codeValues = [c1.data, c2.data, c3.data];
    assert.strictEqual(codeValues.length, 3);
    assert.match(codeValues[0], /^\d{3,}$/);
    assert.match(codeValues[1], /^\d{3,}$/);
    assert.match(codeValues[2], /^\d{3,}$/);

    const n1 = parseInt(codeValues[0], 10);
    const n2 = parseInt(codeValues[1], 10);
    const n3 = parseInt(codeValues[2], 10);
    assert.strictEqual(n2, n1 + 1, 'IDs must increment sequentially');
    assert.strictEqual(n3, n2 + 1, 'IDs must increment sequentially');
  });

  await t.test('2. Register new student and verify automatically assigned 3-digit Student ID', async () => {
    const regRes = await requestJson(server, {
      method: 'POST',
      path: '/api/student/register',
      body: {
        fullName: 'Profile Test Student',
        email: testStudentEmail,
        password: 'dmi@1202',
        confirmPassword: 'dmi@1202',
        phoneNumber: '9840123999'
      }
    });

    assert.strictEqual(regRes.status, 201);
    assert.ok(regRes.body.studentCode, 'Must return assigned studentCode');
    assert.match(regRes.body.studentCode, /^\d{3,}$/, 'Student ID must be zero-padded 3-digit string');
    studentCode = regRes.body.studentCode;

    // First Login with dmi@1202
    const loginRes = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        identifier: testStudentEmail,
        password: 'dmi@1202'
      }
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.mustChangePassword, true);

    // Change to permanent password
    const changeRes = await requestJson(server, {
      method: 'POST',
      path: '/api/student/change-password',
      body: {
        email: testStudentEmail,
        currentPassword: 'dmi@1202',
        newPassword: 'SecurePermanentPass#2026',
        confirmPassword: 'SecurePermanentPass#2026'
      }
    });

    assert.strictEqual(changeRes.status, 200);
    assert.ok(changeRes.body.token);
    studentToken = changeRes.body.token;
  });

  await t.test('3. Complete profile with Section C (Room Number only) and Section E (Residential Address)', async () => {
    const profileRes = await requestJson(server, {
      method: 'POST',
      path: '/api/student/complete-profile',
      token: studentToken,
      body: {
        dateOfBirth: '2004-08-15',
        gender: 'Male',
        department: 'CSE',
        academicYear: '2024-2028',
        yearOfStudy: 1,
        registerNumber: '2105' + String(now).slice(-8),
        roomNumber: 'A-304',
        phoneNumber: '9840123999',
        permanentAddress: '42 Main St, Anna Nagar',
        currentAddress: '42 Main St, Anna Nagar',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600040',
        guardianName: 'R. Ramakrishnan',
        guardianRelationship: 'Father',
        guardianPhone: '9840123888'
        // Alternate emergency contact is deliberately NOT provided
      }
    });

    assert.strictEqual(profileRes.status, 200);
    assert.strictEqual(profileRes.body.success, true);
    assert.strictEqual(profileRes.body.accountStatus, 'PENDING_APPROVAL');
  });

  await t.test('4. Verify stored Room Number, Address, and Student ID in Supabase Database', async () => {
    const { data: student } = await supabase
      .from('students')
      .select('id, student_code, room_number, college_email')
      .eq('college_email', testStudentEmail.toLowerCase())
      .single();

    assert.ok(student, 'Student record must exist');
    assert.strictEqual(student.student_code, studentCode, 'Saved student_code matches generated ID');
    assert.strictEqual(student.room_number, 'A-304', 'Saved room_number matches manually entered room');

    const { data: sp } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('student_id', student.id)
      .single();

    assert.ok(sp, 'Student profile row must exist');
    assert.strictEqual(sp.room_number, 'A-304', 'Room number saved in student_profiles');
    assert.strictEqual(sp.permanent_address, '42 Main St, Anna Nagar', 'Address line 1 saved');
    assert.strictEqual(sp.city, 'Chennai', 'City saved');
    assert.strictEqual(sp.state, 'Tamil Nadu', 'State saved');
    assert.strictEqual(sp.postal_code, '600040', 'Postal code saved');
    assert.strictEqual(sp.guardian_name, 'R. Ramakrishnan');
    assert.strictEqual(sp.guardian_phone, '9840123888');
  });

  await t.test('5. Verify GET /api/student/profile serves roomNumber and auto-generated studentCode', async () => {
    const getRes = await requestJson(server, {
      method: 'GET',
      path: '/api/student/profile',
      token: studentToken
    });

    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.profile.studentCode, studentCode);
    assert.strictEqual(getRes.body.profile.roomNumber, 'A-304');
    assert.strictEqual(getRes.body.profile.city, 'Chennai');
  });

  await t.test('6. Teardown test server and clean test student', async () => {
    try {
      await supabase.from('student_profiles').delete().eq('personal_email', testStudentEmail);
      await supabase.from('students').delete().eq('college_email', testStudentEmail);
      await supabase.from('profiles').delete().eq('email', testStudentEmail);
      const { data: authUser } = await supabase.auth.admin?.deleteUser?.(testStudentEmail);
    } catch (_) {}

    if (server) {
      await new Promise(r => server.close(r));
    }
  });
});
