const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

test('Integration: JWT token generation and role decoding', () => {
  const secret = process.env.JWT_SECRET || 'test_jwt_secret_12345';
  const mockUser = {
    id: 1,
    name: 'Test Student',
    email: 'student@example.com',
    role: 'Student',
    department: 'IT',
  };

  const token = jwt.sign(mockUser, secret, { expiresIn: '1h' });
  assert.ok(token);

  const decoded = jwt.verify(token, secret);
  assert.strictEqual(decoded.id, 1);
  assert.strictEqual(decoded.role, 'Student');
  assert.strictEqual(decoded.department, 'IT');
});

test('Integration: Admin role token verification', () => {
  const secret = process.env.JWT_SECRET || 'test_jwt_secret_12345';
  const mockAdmin = {
    id: 10,
    name: 'Hostel Warden',
    email: 'warden@example.com',
    role: 'Warden',
    department: null,
  };

  const token = jwt.sign(mockAdmin, secret, { expiresIn: '1h' });
  const decoded = jwt.verify(token, secret);
  assert.strictEqual(decoded.role, 'Warden');
  assert.ok(['Warden', 'Admin'].includes(decoded.role));
});

