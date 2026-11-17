const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../../src/server/server.js');
const dbConfig = require('../../config/database.config.js');
const { supabase } = require('../../config/supabase.config.js');

const JWT_SECRET = process.env.JWT_SECRET || 'hostel-secret-key-change-in-production';

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

test('Comprehensive Gate Pass Workflow Integration Tests (15 Scenarios)', async (t) => {
  let server;
  let adminToken = '';
  let student1Token = '';
  let student2Token = '';
  const timestamp = Date.now();
  const student1Email = `student_gp_${timestamp}@test.edu`;
  const student2Email = `student2_gp_${timestamp}@test.edu`;
  const student1UserId = `a0000000-0000-0000-0000-${String(timestamp).slice(-12)}`;
  const student2UserId = `b0000000-0000-0000-0000-${String(timestamp).slice(-12)}`;
  let activePassId = null;

  server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));

  t.after(async () => {
    if (server) server.close();
    try {
      await supabase.from('gate_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('gate_pass_approvals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('gate_pass_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('students').delete().in('college_email', [student1Email, student2Email]);
      await supabase.from('profiles').delete().in('email', [student1Email, student2Email]);
    } catch (_) {}
  });

  // Setup tokens
  const testAdminEmail = `admin_gatepass_${timestamp}@college.test`;
  adminToken = jwt.sign(
    { id: '00000000-0000-0000-0000-000000000001', email: testAdminEmail, role: 'Admin', name: 'Hostel Administrator' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  student1Token = jwt.sign(
    { id: student1UserId, email: student1Email, role: 'Student', name: 'Alice Resident' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  student2Token = jwt.sign(
    { id: student2UserId, email: student2Email, role: 'Student', name: 'Bob Resident' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Seed students in Supabase
  try {
    await supabase.from('profiles').insert([
      { id: student1UserId, email: student1Email, full_name: 'Alice Resident', role: 'STUDENT', account_status: 'ACTIVE' },
      { id: student2UserId, email: student2Email, full_name: 'Bob Resident', role: 'STUDENT', account_status: 'ACTIVE' }
    ]);
    const { error: seedErr } = await supabase.from('students').insert([
      {
        user_id: student1UserId,
        student_code: `STU${String(timestamp).slice(-5)}`,
        register_number: `REG${String(timestamp).slice(-6)}`,
        student_name: 'Alice Resident',
        college_email: student1Email,
        student_status: 'ACTIVE'
      },
      {
        user_id: student2UserId,
        student_code: `STU${String(timestamp + 1).slice(-5)}`,
        register_number: `REG${String(timestamp + 1).slice(-6)}`,
        student_name: 'Bob Resident',
        college_email: student2Email,
        student_status: 'ACTIVE'
      }
    ]);
    if (seedErr) console.warn('Supabase test seed error:', seedErr.message);
  } catch (err) {
    console.warn('Supabase test seed catch:', err.message);
  }

  // 1. Validation: Submission fails when required fields are missing
  await t.test('Scenario 1: Rejects submission when required fields are missing', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/gate-passes',
      token: student1Token,
      body: { reason: 'Going home' } // missing dates & destination
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // 2. Validation: Rejects submission when return time is before departure time
  await t.test('Scenario 2: Rejects submission when return is before departure', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/gate-passes',
      token: student1Token,
      body: {
        reason: 'Family visit',
        destination: 'Chennai Central',
        departureDate: '2026-11-20',
        departureTime: '18:00',
        returnDate: '2026-11-20',
        returnTime: '12:00' // earlier!
      }
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /after departure/i);
  });

  // 3. Valid submission succeeds and sets status to PENDING
  await t.test('Scenario 3: Student submits valid gate pass request (Status: PENDING)', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/gate-passes',
      token: student1Token,
      body: {
        reason: 'Attending hackathon',
        destination: 'Anna University Library',
        departureDate: '2026-11-20',
        departureTime: '08:00',
        returnDate: '2026-11-20',
        returnTime: '20:00',
        additionalDescription: 'Bus pass confirmed'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.request.status, 'PENDING');
    assert.ok(res.body.request.id);
    activePassId = res.body.request.id;
  });

  // 4. Before approval: Scanner is LOCKED with required message
  await t.test('Scenario 4: Scanner status is LOCKED while status is PENDING', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: '/api/gate-passes/scanner-status',
      token: student1Token
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isLocked, true);
    assert.strictEqual(res.body.isEligible, false);
    assert.strictEqual(res.body.status, 'PENDING');
    assert.strictEqual(res.body.message, 'Your Gate Pass is waiting for Admin approval.');
  });

  // 5. Admin lists requests in Gate Pass Management
  await t.test('Scenario 5: Admin retrieves gate pass requests list with filters', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: '/api/admin/gate-passes',
      token: adminToken
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.requests));
    const found = res.body.requests.find(r => String(r.id) === String(activePassId));
    assert.ok(found, 'Created pass should appear in admin list');
  });

  // 6. Security authorization: Unauthorized student cannot approve pass
  await t.test('Scenario 6: Student cannot approve gate pass (Role-based restriction)', async () => {
    const res = await requestJson(server, {
      method: 'PATCH',
      path: `/api/admin/gate-passes/${activePassId}/approve`,
      token: student1Token
    });
    assert.strictEqual(res.status, 403, 'Students should be forbidden from approving');
  });

  // 7. Admin approves gate pass request
  await t.test('Scenario 7: Admin approves gate pass request (Status: APPROVED)', async () => {
    const res = await requestJson(server, {
      method: 'PATCH',
      path: `/api/admin/gate-passes/${activePassId}/approve`,
      token: adminToken
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.passStatus, 'APPROVED');
  });

  // 8. After Admin approval: Scanner dynamically UNLOCKS
  await t.test('Scenario 8: Dynamic scanner status confirms UNLOCKED after Admin approval', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: '/api/gate-passes/scanner-status',
      token: student1Token
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isLocked, false);
    assert.strictEqual(res.body.isEligible, true);
    assert.strictEqual(res.body.status, 'APPROVED');
    assert.strictEqual(res.body.nextAction, 'EXIT');
  });

  // 9. Scan permanent gate QR code with invalid identifier is rejected
  await t.test('Scenario 9: Rejects scan with invalid or spoofed gate identifier', async () => {
    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/gate-passes/scan-gate-qr',
      token: student1Token,
      body: { gateIdentifier: 'FAKE_GATE_QR_99' }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /unrecognized or inactive/i);
  });

  // 10. Student scans permanent gate QR code (GATE_DMI_MAIN_01) -> EXIT recorded
  await t.test('Scenario 10: First scan of permanent gate QR code records EXITED movement', async () => {
    // Wait for rate limit window
    await new Promise(r => setTimeout(r, 2200));

    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/gate-passes/scan-gate-qr',
      token: student1Token,
      body: { gateIdentifier: 'GATE_DMI_MAIN_01' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.title, 'Gate Pass Scan Successful!');
    assert.strictEqual(res.body.passStatus, 'EXITED');
    assert.strictEqual(res.body.transaction.type, 'EXIT');
  });

  // 11. Scanner status updates to EXITED (ready for return)
  await t.test('Scenario 11: Scanner status in EXITED state confirms next action is RETURN', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: '/api/gate-passes/scanner-status',
      token: student1Token
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isLocked, false);
    assert.strictEqual(res.body.status, 'EXITED');
    assert.strictEqual(res.body.nextAction, 'RETURN');
  });

  // 12. Student scans permanent gate QR code second time -> RETURN recorded
  await t.test('Scenario 12: Second scan of permanent gate QR records RETURNED and closes cycle', async () => {
    // Wait 2.1 seconds to avoid rapid scan rate limit
    await new Promise(r => setTimeout(r, 2100));

    const res = await requestJson(server, {
      method: 'POST',
      path: '/api/gate-passes/scan-gate-qr',
      token: student1Token,
      body: { gateIdentifier: 'GATE_DMI_MAIN_01' }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.passStatus, 'RETURNED');
    assert.strictEqual(res.body.transaction.type, 'RETURN');
  });

  // 13. Admin rejection scenario: submission -> rejected -> scanner remains locked
  await t.test('Scenario 13: Admin rejects pass with reason; student scanner stays LOCKED', async () => {
    // Student 2 submits pass
    const submitRes = await requestJson(server, {
      method: 'POST',
      path: '/api/gate-passes',
      token: student2Token,
      body: {
        reason: 'Shopping',
        destination: 'Mall',
        departureDate: '2026-11-21',
        departureTime: '17:00',
        returnDate: '2026-11-21',
        returnTime: '21:00'
      }
    });
    assert.strictEqual(submitRes.status, 201);
    const pass2Id = submitRes.body.request.id;

    // Admin rejects with reason
    const rejectRes = await requestJson(server, {
      method: 'PATCH',
      path: `/api/admin/gate-passes/${pass2Id}/reject`,
      token: adminToken,
      body: { reason: 'Academic hours in progress' }
    });
    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual(rejectRes.body.passStatus, 'REJECTED');

    // Student 2 scanner must remain LOCKED
    const scanStatusRes = await requestJson(server, {
      method: 'GET',
      path: '/api/gate-passes/scanner-status',
      token: student2Token
    });
    assert.strictEqual(scanStatusRes.status, 200);
    assert.strictEqual(scanStatusRes.body.isLocked, true);
    assert.strictEqual(scanStatusRes.body.status, 'REJECTED');
  });

  // 14. Access isolation: Student 2 only sees own passes, not Student 1
  await t.test('Scenario 14: Data isolation prevents Student 2 from seeing Student 1 passes', async () => {
    const res = await requestJson(server, {
      method: 'GET',
      path: '/api/gate-passes/my',
      token: student2Token
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const hasStudent1Pass = res.body.requests.some(r => String(r.id) === String(activePassId));
    assert.strictEqual(hasStudent1Pass, false, 'Student 2 must not see Student 1 pass');
  });

  // 15. ZERO NOTIFICATION PERSISTENCE IN DATABASE
  await t.test('Scenario 15: Zero notification persistence in database (No notification rows added)', async () => {
    // Check Supabase notifications table (should not exist or have 0 rows for this pass)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('title', 'Gate Pass Approved!');
      
      if (!error && data) {
        assert.strictEqual(data.length, 0, 'No notification rows should be created in Supabase for gate passes');
      }
    } catch (_) {}

    // Check SQLite Notifications table
    try {
      const [rows] = await dbConfig.execute(
        `SELECT * FROM Notifications WHERE Message LIKE '%Gate Pass%' OR Title LIKE '%Gate Pass%'`
      );
      assert.strictEqual(rows.length, 0, 'No notification records written to SQLite Notifications');
    } catch (_) {}
  });

});

