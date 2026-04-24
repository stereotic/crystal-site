const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function makeAdmin() {
  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database.db');

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found!');
    return;
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Показываем всех пользователей
  console.log('\n📋 Список пользователей:');
  const users = db.exec('SELECT id, username, is_worker FROM users');

  if (users.length && users[0].values.length) {
    users[0].values.forEach(([id, username, is_worker]) => {
      console.log(`  ${id}. ${username} ${is_worker ? '(ADMIN)' : ''}`);
    });
  } else {
    console.log('  Нет пользователей');
    return;
  }

  // Получаем username из аргументов командной строки
  const username = process.argv[2];

  if (!username) {
    console.log('\n💡 Использование: node make-admin.js <username>');
    console.log('   Пример: node make-admin.js qwerty');
    return;
  }

  // Делаем пользователя админом
  db.run('UPDATE users SET is_worker = 1 WHERE username = ?', [username]);

  // Сохраняем базу
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, newBuffer);

  console.log(`\n✅ Пользователь "${username}" теперь администратор!`);
  console.log(`🔗 Админ-панель: http://localhost:3000/admin`);
}

makeAdmin().catch(console.error);
