const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

(async () => {
  const db = await open({
    filename: process.env.DB_PATH || path.join(__dirname, '../database/database.sqlite'),
    driver: sqlite3.Database
  });

  const email = 'anbuselvakumar5@gmail.com';
  console.log('Searching for email:', email);

  const user = await db.get('SELECT * FROM Users WHERE Email = ?', [email]);
  if (!user) {
    console.log('❌ User not found in Users table!');
    
    // Let's print the first 10 users to see who exists
    const allUsers = await db.all('SELECT ID, Name, Email, Role, Department FROM Users LIMIT 10');
    console.log('\nFirst 10 users in database:');
    console.table(allUsers);
  } else {
    console.log('✅ User found in Users table:');
    console.log(user);

    if (user.Role === 'Student') {
      const student = await db.get('SELECT * FROM Students WHERE UserID = ?', [user.ID]);
      console.log('\nStudent profile:');
      console.log(student);
    }
  }

  await db.close();
})();
