const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function createUser() {
  const username = process.argv[2];
  const password = process.argv[3];
  const makeAdmin = process.argv[4] === '--admin';

  if (!username || !password) {
    console.log('\n💡 Использование: node create-user.js <username> <password> [--admin]');
    console.log('   Пример: node create-user.js Admin mypassword123 --admin');
    return;
  }

  const SQL = await initSqlJs();
  const dbPath = path.join(__dirname, 'database.db');

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found!');
    return;
  }

  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Проверяем существует ли пользователь
  const existing = db.exec('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length && existing[0].values.length) {
    console.log(`❌ Пользователь "${username}" уже существует!`);
    return;
  }

  // Хешируем пароль
  const hashedPassword = await bcrypt.hash(password, 10);

  // Создаем пользователя
  const isWorker = makeAdmin ? 1 : 0;
  db.run('INSERT INTO users (username, password, is_worker) VALUES (?, ?, ?)', [username, hashedPassword, isWorker]);

  // Сохраняем базу
  const data = db.export();
  const newBuffer = Buffer.from(data);
  fs.writeFileSync(dbPath, newBuffer);

  console.log(`\n✅ Пользователь "${username}" создан!`);
  if (makeAdmin) {
    console.log(`🛡️  Права администратора: ДА`);
  }
  console.log(`🔑 Пароль: ${password}`);
  console.log(`🔗 Войти: http://localhost:3000`);
}

createUser().catch(console.error);
