const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const TARGET_EMAIL = 'anbuselvakumar5@gmail.com';
const NEW_DEPT = 'IT';

(async () => {
  const db = await open({ filename: path.join(__dirname, 'database.sqlite'), driver: sqlite3.Database });

  const user = await db.get('SELECT ID, Name, Email FROM Users WHERE Email = ?', [TARGET_EMAIL]);
  if (!user) {
    console.log('User not found with email:', TARGET_EMAIL);
    await db.close();
    return;
  }
  console.log('Found user:', user.Name, '|', user.Email, '| ID:', user.ID);

  await db.run('UPDATE Users SET Department = ? WHERE ID = ?', [NEW_DEPT, user.ID]);
  await db.run('UPDATE Students SET Department = ? WHERE UserID = ?', [NEW_DEPT, user.ID]);

  const check = await db.get(
    'SELECT u.Name, u.Email, u.Department AS UserDept, s.Department AS StudentDept FROM Users u LEFT JOIN Students s ON s.UserID = u.ID WHERE u.ID = ?',
    [user.ID]
  );
  console.log('Updated result:', check);
  console.log('Done! Department changed to', NEW_DEPT);
  await db.close();
})();
