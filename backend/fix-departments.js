/**
 * fix-departments.js — Patch existing students/users with NULL departments
 * Run this ONCE to assign defaults to any existing data.
 * 
 * Usage: node fix-departments.js
 */
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const readline = require('readline');

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];

function prompt(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans.trim().toUpperCase()); }));
}

(async () => {
  const db = await open({ filename: path.join(__dirname, 'database.sqlite'), driver: sqlite3.Database });

  // Find students with no department
  const nullStudents = await db.all(
    'SELECT u.ID, u.Name, s.RegisterNumber FROM Students s JOIN Users u ON u.ID = s.UserID WHERE s.Department IS NULL'
  );

  if (nullStudents.length === 0) {
    console.log('✅ All students already have departments. Nothing to fix!');
    await db.close();
    return;
  }

  console.log(`\nFound ${nullStudents.length} student(s) with no department assigned:\n`);
  console.log('Available departments:', DEPARTMENTS.join(', '));

  for (const student of nullStudents) {
    let dept = '';
    while (!DEPARTMENTS.includes(dept)) {
      dept = await prompt(`  Assign department for "${student.Name}" (${student.RegisterNumber}): `);
      if (!DEPARTMENTS.includes(dept)) console.log(`  ❌ Invalid. Choose from: ${DEPARTMENTS.join(', ')}`);
    }
    await db.run('UPDATE Students SET Department = ? WHERE UserID = ?', [dept, student.ID]);
    await db.run('UPDATE Users SET Department = ? WHERE ID = ?', [dept, student.ID]);
    console.log(`  ✅ ${student.Name} → ${dept}`);
  }

  console.log('\n✅ All departments assigned. Students will now appear correctly for Staff/HOD.\n');
  await db.close();
})();
