const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║     🎬 ДЕМОНСТРАЦИЯ: Изменение адреса через админ-бота       ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Симуляция работы админ-бота
const simulateAdminBot = async () => {
    console.log('📱 TELEGRAM - Админ-бот\n');
    console.log('┌─────────────────────────────────────────┐');
    console.log('│  Панель администратора                  │');
    console.log('├─────────────────────────────────────────┤');
    console.log('│  [💰 USDT TRC20] [💰 USDT BEP20]       │');
    console.log('│  [₿ BTC]         [Ξ ETH]               │');
    console.log('└─────────────────────────────────────────┘\n');

    console.log('👤 Админ: *нажимает кнопку "💰 USDT TRC20"*\n');

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('🤖 Бот: Введите новый адрес для USDT_TRC20:\n');

    await new Promise(resolve => setTimeout(resolve, 500));

    const newAddress = 'TNewTestAddress123456789ABCDEFGH';
    console.log(`👤 Админ: ${newAddress}\n`);

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('🔄 Обновление базы данных...\n');

    // Обновляем адрес в базе
    db.run("UPDATE wallets SET address = ? WHERE currency = ?", [newAddress, 'USDT_TRC20'], function(err) {
        if (err) {
            console.log('❌ Ошибка:', err.message);
            db.close();
            return;
        }

        console.log('✅ База данных обновлена!\n');
        console.log('🤖 Бот: ✅ USDT_TRC20 обновлён\n');

        setTimeout(() => {
            console.log('─────────────────────────────────────────────────────────────\n');
            console.log('🌐 САЙТ - Модальное окно Deposit\n');

            // Показываем, что видит пользователь на сайте
            db.all("SELECT * FROM wallets ORDER BY currency", [], (err, rows) => {
                if (err) {
                    console.log('❌ Ошибка:', err.message);
                    db.close();
                    return;
                }

                console.log('┌─────────────────────────────────────────┐');
                console.log('│  Deposit                           [✕]  │');
                console.log('├─────────────────────────────────────────┤');
                console.log('│  Select amount:                         │');
                console.log('│  [150] [300] [500] [1000]              │');
                console.log('│                                         │');
                console.log('│  Select payment method:                 │');
                console.log('│  [BTC] [ETH] [USDT TRC20] [USDT BEP20] │');
                console.log('│                                         │');
                console.log('│  Wallet address:                        │');
                console.log('│  ┌───────────────────────────────────┐ │');

                const usdtTrc20 = rows.find(r => r.currency === 'USDT_TRC20');
                if (usdtTrc20) {
                    console.log(`│  │ ${usdtTrc20.address.padEnd(35)}│ │`);
                }

                console.log('│  └───────────────────────────────────┘ │');
                console.log('│                                         │');
                console.log('│  [Check Payment]                        │');
                console.log('└─────────────────────────────────────────┘\n');

                console.log('✅ Пользователь видит НОВЫЙ адрес!\n');

                console.log('─────────────────────────────────────────────────────────────\n');
                console.log('📊 Текущее состояние всех кошельков:\n');

                rows.forEach(row => {
                    const shortAddr = row.address.length > 40
                        ? row.address.substring(0, 40) + '...'
                        : row.address;
                    console.log(`   ${row.currency.padEnd(15)} → ${shortAddr}`);
                });

                console.log('\n╔═══════════════════════════════════════════════════════════════╗');
                console.log('║                  ✅ ДЕМОНСТРАЦИЯ ЗАВЕРШЕНА                    ║');
                console.log('╚═══════════════════════════════════════════════════════════════╝\n');

                console.log('💡 Теперь попробуйте сами:');
                console.log('   1. Откройте админ-бота в Telegram');
                console.log('   2. Нажмите на любую кнопку');
                console.log('   3. Введите новый адрес');
                console.log('   4. Проверьте на сайте!\n');

                db.close();
            });
        }, 500);
    });
};

simulateAdminBot();
