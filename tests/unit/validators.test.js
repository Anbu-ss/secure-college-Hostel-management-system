const test = require('node:test');
const assert = require('node:assert');
const { isValidDepartment, isValidAdminRole, isValidStudentRole, VALID_DEPARTMENTS, ADMIN_ROLES } = require('../../src/utils/validators');

test('Validator: should validate official college departments', () => {
  assert.strictEqual(isValidDepartment('IT'), true);
  assert.strictEqual(isValidDepartment('CSE'), true);
  assert.strictEqual(isValidDepartment('UNKNOWN'), false);
});

test('Validator: should validate administrative roles', () => {
  assert.strictEqual(isValidAdminRole('Warden'), true);
  assert.strictEqual(isValidAdminRole('HOD'), true);
  assert.strictEqual(isValidAdminRole('Security'), true);
  assert.strictEqual(isValidAdminRole('Student'), false);
});

test('Validator: should validate student role', () => {
  assert.strictEqual(isValidStudentRole('Student'), true);
  assert.strictEqual(isValidStudentRole('Admin'), false);
});

