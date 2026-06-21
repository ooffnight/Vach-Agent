const bcrypt = require('bcryptjs');
const db = require('./server/db');
bcrypt.hash('admin123', 10).then(h => {
  return db.query('UPDATE users SET password_hash = $1', [h]);
}).then(() => {
  console.log('Updated users with new hash');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
