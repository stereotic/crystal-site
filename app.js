const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const svgCaptcha = require('svg-captcha');
const cron = require('node-cron');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const cors = require('cors');
const validator = require('validator');
require('dotenv').config();

// ========== ПРОВЕРКА ПЕРЕМЕННЫХ ==========
const requiredEnv = ['DOMAIN', 'SESSION_SECRET', 'SMTP_USER', 'SMTP_PASS', 'USER_BOT_TOKEN', 'ADMIN_BOT_TOKEN'];
for (const envVar of requiredEnv) {
    if (!process.env[envVar]) {
        console.error(`Missing env: ${envVar}`);
        process.exit(1);
    }
}

const app = express();
const PORT = process.env.PORT || 3001;
const DOMAIN = process.env.DOMAIN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const USER_BOT_TOKEN = process.env.USER_BOT_TOKEN;
const ADMIN_BOT_TOKEN = process.env.ADMIN_BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(id => id);
const BOT_USERNAME = process.env.BOT_USERNAME || 'CrystalCC_xBot';

// ========== CORS ==========
const allowedOrigins = [DOMAIN, 'http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001'];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes(origin.replace(/https?:\/\//, ''))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// ========== КУРСЫ ==========
let USD_TO_BTC = 50000;
let USD_TO_ETH = 3000;
const USD_TO_USDT = 1;

async function updateRates() {
    try {
        const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        if (data?.bitcoin?.usd) USD_TO_BTC = data.bitcoin.usd;
        if (data?.ethereum?.usd) USD_TO_ETH = data.ethereum.usd;
        console.log(`Rates: BTC=$${USD_TO_BTC}, ETH=$${USD_TO_ETH}`);
    } catch (e) { console.error('Rate error:', e.message); }
}
updateRates();
cron.schedule('*/5 * * * *', updateRates);

// ========== БАЗА ДАННЫХ ==========
let db = new sqlite3.Database('./database.db');
function configureDb() {
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA busy_timeout = 10000;
        PRAGMA foreign_keys = ON;
    `, (err) => { if (err) console.error('DB pragma:', err.message); });
}
configureDb();

function reconnectDb(reason) {
    console.log(`Reconnect DB: ${reason}`);
    db.close(() => {});
    db = new sqlite3.Database('./database.db', (err) => {
        if (err) console.error('Reconnect error:', err);
        else configureDb();
    });
}

function guard(err, reason) {
    if (!err) return;
    const msg = err.message || '';
    if (/SQLITE_(IOERR|BUSY|CANTOPEN)/.test(msg)) reconnectDb(reason);
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            guard(err, 'get');
            err ? reject(err) : resolve(row);
        });
    });
}
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            guard(err, 'all');
            err ? reject(err) : resolve(rows || []);
        });
    });
}
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            guard(err, 'run');
            err ? reject(err) : resolve({ changes: this.changes || 0, lastID: this.lastID || 0 });
        });
    });
}
async function transaction(work) {
    await run('BEGIN IMMEDIATE');
    try {
        const result = await work();
        await run('COMMIT');
        return result;
    } catch (e) {
        await run('ROLLBACK').catch(() => {});
        throw e;
    }
}

// ========== ТАБЛИЦЫ ==========
run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    username TEXT,
    password TEXT,
    balance_cents INTEGER DEFAULT 0,
    created INTEGER,
    lastLogin INTEGER,
    banned INTEGER DEFAULT 0,
    is_worker INTEGER DEFAULT 0,
    is_premium INTEGER DEFAULT 0,
    ref_code TEXT UNIQUE,
    tg_id TEXT UNIQUE,
    tg_username TEXT,
    first_name TEXT,
    worker_id TEXT,
    partner_id TEXT,
    referrer_tg_id TEXT,
    reset_token TEXT,
    reset_expires INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT,
    type TEXT,
    card_number TEXT,
    exp TEXT,
    holder_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT,
    non_vbv INTEGER DEFAULT 0,
    fullz INTEGER DEFAULT 0,
    refundable INTEGER DEFAULT 0,
    price_cents INTEGER,
    cvv TEXT,
    bank TEXT,
    bin TEXT,
    created_at INTEGER,
    is_active INTEGER DEFAULT 1,
    deleted_at INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS purchased_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    region TEXT,
    type TEXT,
    card_number TEXT,
    exp TEXT,
    holder_name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    phone TEXT,
    non_vbv INTEGER DEFAULT 0,
    fullz INTEGER DEFAULT 0,
    refundable INTEGER DEFAULT 0,
    price_cents INTEGER,
    cvv TEXT,
    bank TEXT,
    bin TEXT,
    purchased_at INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS wallets (
    currency TEXT PRIMARY KEY,
    address TEXT
)`);
run(`CREATE TABLE IF NOT EXISTS deposit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    amount_cents INTEGER,
    currency TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS withdraw_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    amount_cents INTEGER,
    status TEXT DEFAULT 'pending',
    created_at INTEGER,
    wallet_address TEXT,
    wallet_currency TEXT
)`);
run(`CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_tg_id TEXT,
    mammoth_email TEXT,
    created_at INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS worker_settings (
    tg_id TEXT PRIMARY KEY,
    balance_cents INTEGER DEFAULT 100000,
    min_deposit_cents INTEGER DEFAULT 15000,
    logs_enabled INTEGER DEFAULT 1
)`);
run(`CREATE TABLE IF NOT EXISTS card_checks (
    card_hash TEXT PRIMARY KEY,
    balance_cents INTEGER,
    checked_at INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    role TEXT,
    text TEXT,
    file_id TEXT,
    file_type TEXT,
    time INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS premium_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    time INTEGER
)`);
run(`CREATE TABLE IF NOT EXISTS email_verifications (
    email TEXT PRIMARY KEY,
    code TEXT,
    expires INTEGER
)`);

// Инициализация кошельков
const initWallets = async () => {
    const currencies = ['BTC', 'ETH', 'USDT_TRC20', 'USDT_BEP20'];
    for (const cur of currencies) {
        await run("INSERT OR IGNORE INTO wallets (currency, address) VALUES (?, ?)", [cur, 'Not set']);
    }
    console.log('✅ Wallets initialized');
};
initWallets().catch(console.error);
run(`CREATE TABLE IF NOT EXISTS mirror_bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_tg_id TEXT,
    bot_token TEXT,
    bot_username TEXT,
    created_at INTEGER,
    is_active INTEGER DEFAULT 1
)`);
run(`CREATE TABLE IF NOT EXISTS worker_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_tg_id TEXT,
    event_type TEXT,
    mammoth_email TEXT,
    mammoth_tg_id TEXT,
    mammoth_tg_username TEXT,
    details TEXT,
    created_at INTEGER,
    is_read INTEGER DEFAULT 0
)`);

// Миграции старых колонок
(async () => {
    const cols = await all("PRAGMA table_info(users)");
    const names = new Set(cols.map(c => c.name));
    if (!names.has('balance_cents')) {
        await run("ALTER TABLE users ADD COLUMN balance_cents INTEGER DEFAULT 0");
        await run("UPDATE users SET balance_cents = balance_usd * 100 WHERE balance_usd IS NOT NULL");
    }
    const cardCols = await all("PRAGMA table_info(cards)");
    const cardNames = new Set(cardCols.map(c => c.name));
    if (!cardNames.has('is_active')) {
        await run("ALTER TABLE cards ADD COLUMN is_active INTEGER DEFAULT 1");
        await run("ALTER TABLE cards ADD COLUMN deleted_at INTEGER");
    }
    if (!cardNames.has('price_cents')) {
        await run("ALTER TABLE cards ADD COLUMN price_cents INTEGER");
        await run("UPDATE cards SET price_cents = price_usd * 100 WHERE price_usd IS NOT NULL");
    }
    if (!cardNames.has('bin')) {
        await run("ALTER TABLE cards ADD COLUMN bin TEXT");
        await run("UPDATE cards SET bin = substr(card_number, 1, 6) WHERE card_number IS NOT NULL");
    }
    const depCols = await all("PRAGMA table_info(deposit_requests)");
    const depNames = new Set(depCols.map(c => c.name));
    if (!depNames.has('amount_cents')) {
        await run("ALTER TABLE deposit_requests ADD COLUMN amount_cents INTEGER");
        await run("UPDATE deposit_requests SET amount_cents = amount * 100 WHERE amount IS NOT NULL");
    }
    const withCols = await all("PRAGMA table_info(withdraw_requests)");
    const withNames = new Set(withCols.map(c => c.name));
    if (!withNames.has('amount_cents')) {
        await run("ALTER TABLE withdraw_requests ADD COLUMN amount_cents INTEGER");
        await run("UPDATE withdraw_requests SET amount_cents = amount * 100 WHERE amount IS NOT NULL");
    }
    const pcCols = await all("PRAGMA table_info(purchased_cards)");
    const pcNames = new Set(pcCols.map(c => c.name));
    if (!pcNames.has('price_cents')) {
        await run("ALTER TABLE purchased_cards ADD COLUMN price_cents INTEGER");
        await run("UPDATE purchased_cards SET price_cents = price_usd * 100 WHERE price_usd IS NOT NULL");
    }
    if (!pcNames.has('bin')) {
        await run("ALTER TABLE purchased_cards ADD COLUMN bin TEXT");
    }
    const wsCols = await all("PRAGMA table_info(worker_settings)");
    const wsNames = new Set(wsCols.map(c => c.name));
    if (!wsNames.has('logs_enabled')) {
        await run("ALTER TABLE worker_settings ADD COLUMN logs_enabled INTEGER DEFAULT 1");
    }
})();

// ========== BIN БАЗА ==========
const binDatabase = {
    'USA': {
        'Standard': ['414720','414721','414722','414723','414724','414725','414726','414727','414728','414729'],
        'Gold': ['517805','517806','517807','517808','517809','517810','517811','517812','517813','517814'],
        'Platinum': ['542418','542419','542420','542421','542422','542423','542424','542425','542426','542427'],
        'Business': ['552489','552490','552491','552492','552493','552494','552495','552496','552497','552498']
    },
    'UK': {
        'Standard': ['446200','446201','446202','446203','446204','446205','446206','446207','446208','446209'],
        'Gold': ['532700','532701','532702','532703','532704','532705','532706','532707','532708','532709'],
        'Platinum': ['540100','540101','540102','540103','540104','540105','540106','540107','540108','540109'],
        'Business': ['552500','552501','552502','552503','552504','552505','552506','552507','552508','552509']
    },
    'Canada': {
        'Standard': ['450600','450601','450602','450603','450604','450605','450606','450607','450608','450609'],
        'Gold': ['530700','530701','530702','530703','530704','530705','530706','530707','530708','530709'],
        'Platinum': ['545400','545401','545402','545403','545404','545405','545406','545407','545408','545409'],
        'Business': ['553600','553601','553602','553603','553604','553605','553606','553607','553608','553609']
    },
    'Australia': {
        'Standard': ['432100','432101','432102','432103','432104','432105','432106','432107','432108','432109'],
        'Gold': ['528200','528201','528202','528203','528204','528205','528206','528207','528208','528209'],
        'Platinum': ['548500','548501','548502','548503','548504','548505','548506','548507','548508','548509'],
        'Business': ['556200','556201','556202','556203','556204','556205','556206','556207','556208','556209']
    },
    'EU': {
        'Standard': ['420000','420001','420002','420003','420004','420005','420006','420007','420008','420009'],
        'Gold': ['524200','524201','524202','524203','524204','524205','524206','524207','524208','524209'],
        'Platinum': ['547800','547801','547802','547803','547804','547805','547806','547807','547808','547809'],
        'Business': ['557200','557201','557202','557203','557204','557205','557206','557207','557208','557209']
    },
    'France': {
        'Standard': ['497200','497201','497202','497203','497204','497205','497206','497207','497208','497209'],
        'Gold': ['535500','535501','535502','535503','535504','535505','535506','535507','535508','535509'],
        'Platinum': ['541800','541801','541802','541803','541804','541805','541806','541807','541808','541809'],
        'Business': ['558300','558301','558302','558303','558304','558305','558306','558307','558308','558309']
    },
    'Germany': {
        'Standard': ['490600','490601','490602','490603','490604','490605','490606','490607','490608','490609'],
        'Gold': ['533400','533401','533402','533403','533404','533405','533406','533407','533408','533409'],
        'Platinum': ['546200','546201','546202','546203','546204','546205','546206','546207','546208','546209'],
        'Business': ['559700','559701','559702','559703','559704','559705','559706','559707','559708','559709']
    }
};
const defaultBin = { 'Standard': '400000', 'Gold': '500000', 'Platinum': '540000', 'Business': '550000' };
function getRealBin(region, type) {
    const regionBins = binDatabase[region];
    if (regionBins && regionBins[type]) {
        const bins = regionBins[type];
        return bins[Math.floor(Math.random() * bins.length)];
    }
    return defaultBin[type];
}

// ========== ГЕНЕРАЦИЯ КАРТ ==========
const regionBanks = {
    USA: ['Chase','Bank of America','Wells Fargo','Citi'],
    UK: ['Barclays','HSBC','Lloyds','NatWest'],
    Canada: ['RBC','TD','Scotiabank','BMO'],
    Australia: ['Commonwealth','Westpac','ANZ','NAB'],
    EU: ['Deutsche Bank','BNP Paribas','Santander','UniCredit'],
    France: ['BNP Paribas','Crédit Agricole','Société Générale','BPCE'],
    Spain: ['Banco Santander','BBVA','CaixaBank','Bankia'],
    Turkey: ['Ziraat Bankası','İş Bankası','Garanti BBVA','Yapı Kredi'],
    Italy: ['UniCredit','Intesa Sanpaolo','Monte dei Paschi','Banco BPM'],
    Mexico: ['BBVA México','Banamex','Santander México','Banorte'],
    Germany: ['Deutsche Bank','Commerzbank','KfW','DZ Bank'],
    Greece: ['National Bank of Greece','Piraeus Bank','Alpha Bank','Eurobank'],
    Austria: ['Erste Group','Raiffeisen Bank International','Bank Austria','BAWAG P.S.K.'],
    Portugal: ['Caixa Geral de Depósitos','Millennium bcp','Novo Banco','Banco BPI'],
    Netherlands: ['ING Group','Rabobank','ABN AMRO','SNS Bank'],
    Switzerland: ['UBS','Credit Suisse','Raiffeisen','Julius Bär'],
    Belgium: ['KBC','BNP Paribas Fortis','ING Belgium','Belfius'],
    Sweden: ['Swedbank','SEB','Handelsbanken','Nordea'],
    Norway: ['DNB','SpareBank 1','Nordea Norge','Sbanken']
};
const regions = Object.keys(regionBanks).sort();
const rand = arr => arr[Math.floor(Math.random() * arr.length)];

const firstNamesByRegion = {
    USA: ["John","James","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles"],
    UK: ["Oliver","George","Harry","Jack","Jacob","Charlie","Thomas","Oscar","James","William"],
    Canada: ["Liam","Noah","Ethan","Logan","Lucas","Mason","Jacob","William","Alexander","James"],
    Australia: ["Jack","Oliver","William","Thomas","Noah","Lachlan","Cooper","James","Lucas","Ethan"],
    EU: ["Hans","Pierre","Giovanni","Klaus","François","Luis","Carlos","Marco","Sven","Jan"],
    France: ["Jean","Pierre","Michel","André","Philippe","Nicolas","Christophe","Patrick","Sébastien","Laurent"],
    Spain: ["Antonio","José","Manuel","Francisco","Juan","David","Carlos","Javier","Miguel","Rafael"],
    Turkey: ["Mehmet","Mustafa","Ahmet","Ali","Hüseyin","Hasan","İbrahim","Murat","Osman","Yusuf"],
    Italy: ["Giuseppe","Mario","Luigi","Giovanni","Francesco","Antonio","Roberto","Paolo","Salvatore","Angelo"],
    Mexico: ["José","Juan","Miguel","Carlos","Jesús","Luis","Pedro","Francisco","Alejandro","Manuel"],
    Germany: ["Hans","Klaus","Thomas","Michael","Andreas","Stefan","Wolfgang","Jürgen","Peter","Markus"],
    Greece: ["Georgios","Dimitris","Ioannis","Konstantinos","Nikolaos","Panagiotis","Christos","Vasilis","Athanasios","Alexandros"],
    Austria: ["Franz","Josef","Hans","Karl","Heinz","Erich","Gerhard","Walter","Manfred","Johann"],
    Portugal: ["João","José","António","Manuel","Francisco","Carlos","Jorge","Paulo","Pedro","Luís"],
    Netherlands: ["Jan","Piet","Hendrik","Cornelis","Gerard","Willem","Johannes","Jacobus","Adrianus","Marinus"],
    Switzerland: ["Hans","Peter","Markus","Thomas","Daniel","Stefan","Martin","Christian","Andreas","Michael"],
    Belgium: ["Jean","Pierre","Luc","Marc","Philippe","Michel","Daniel","Paul","André","Jacques"],
    Sweden: ["Erik","Lars","Karl","Anders","Johan","Magnus","Peter","Mikael","Per","Olof"],
    Norway: ["Ole","Lars","Jan","Per","Bjørn","Knut","Sven","Arne","Thomas","Anders"]
};
const lastNamesByRegion = {
    USA: ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez"],
    UK: ["Smith","Jones","Williams","Taylor","Brown","Davies","Evans","Wilson","Thomas","Roberts"],
    Canada: ["Smith","Brown","Tremblay","Martin","Roy","Wilson","MacDonald","Gagnon","Johnson","Taylor"],
    Australia: ["Smith","Jones","Williams","Brown","Wilson","Taylor","Johnson","White","Martin","Anderson"],
    EU: ["Müller","Dubois","Rossi","Fernández","Jensen","Van Dijk","Kowalski","Novak","Popov","Schmidt"],
    France: ["Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau"],
    Spain: ["García","Fernández","González","Rodríguez","López","Martínez","Sánchez","Pérez","Gómez","Ruiz"],
    Turkey: ["Yılmaz","Kaya","Demir","Çelik","Şahin","Yıldız","Öztürk","Aydın","Özdemir","Arslan"],
    Italy: ["Rossi","Russo","Ferrari","Esposito","Bianchi","Romano","Colombo","Ricci","Marino","Greco"],
    Mexico: ["Hernández","García","Martínez","López","González","Rodríguez","Pérez","Sánchez","Ramírez","Flores"],
    Germany: ["Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Schulz","Hoffmann"],
    Greece: ["Papadopoulos","Papadakis","Georgiou","Demetriou","Christodoulou","Ioannou","Katsaros","Nikolaou","Vasiliou","Alexandrou"],
    Austria: ["Gruber","Huber","Bauer","Wagner","Müller","Pichler","Steiner","Moser","Mayer","Hofer"],
    Portugal: ["Silva","Santos","Ferreira","Pereira","Oliveira","Costa","Rodrigues","Martins","Jesus","Sousa"],
    Netherlands: ["De Jong","Jansen","De Vries","Van den Berg","Van Dijk","Bakker","Visser","Smit","Meijer","De Boer"],
    Switzerland: ["Müller","Meier","Schmid","Keller","Weber","Huber","Wagner","Steiner","Fischer","Brunner"],
    Belgium: ["Peeters","Janssens","Maes","Jacobs","Mertens","Willems","Claes","Goossens","De Smet","Verhoeven"],
    Sweden: ["Andersson","Johansson","Karlsson","Nilsson","Eriksson","Larsson","Olsson","Persson","Svensson","Gustafsson"],
    Norway: ["Hansen","Johansen","Olsen","Larsen","Andersen","Pedersen","Nilsen","Kristiansen","Jensen","Karlsen"]
};
const citiesByRegion = {
    USA: ["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","Austin"],
    UK: ["London","Manchester","Birmingham","Liverpool","Leeds","Sheffield","Bristol","Newcastle","Nottingham","Southampton"],
    Canada: ["Toronto","Montreal","Vancouver","Calgary","Edmonton","Ottawa","Winnipeg","Quebec City","Hamilton","Halifax"],
    Australia: ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Gold Coast","Canberra","Newcastle","Wollongong","Hobart"],
    EU: ["Berlin","Paris","Rome","Madrid","Amsterdam","Brussels","Vienna","Warsaw","Prague","Budapest"],
    France: ["Paris","Marseille","Lyon","Toulouse","Nice","Nantes","Strasbourg","Montpellier","Bordeaux","Lille"],
    Spain: ["Madrid","Barcelona","Valencia","Seville","Zaragoza","Malaga","Murcia","Palma","Bilbao","Alicante"],
    Turkey: ["Istanbul","Ankara","Izmir","Bursa","Antalya","Adana","Gaziantep","Konya","Mersin","Diyarbakır"],
    Italy: ["Rome","Milan","Naples","Turin","Palermo","Genoa","Bologna","Florence","Bari","Catania"],
    Mexico: ["Mexico City","Guadalajara","Monterrey","Puebla","Tijuana","León","Ciudad Juárez","Zapopan","Cancún","Mérida"],
    Germany: ["Berlin","Hamburg","Munich","Cologne","Frankfurt","Stuttgart","Düsseldorf","Leipzig","Dortmund","Essen"],
    Greece: ["Athens","Thessaloniki","Patras","Heraklion","Larissa","Volos","Ioannina","Chania","Rhodes","Kavala"],
    Austria: ["Vienna","Graz","Linz","Salzburg","Innsbruck","Klagenfurt","Villach","Wels","Sankt Pölten","Dornbirn"],
    Portugal: ["Lisbon","Porto","Vila Nova de Gaia","Amadora","Braga","Funchal","Coimbra","Setúbal","Almada","Queluz"],
    Netherlands: ["Amsterdam","Rotterdam","The Hague","Utrecht","Eindhoven","Tilburg","Groningen","Almere","Breda","Nijmegen"],
    Switzerland: ["Zurich","Geneva","Basel","Bern","Lausanne","Lucerne","Winterthur","St. Gallen","Lugano","Biel"],
    Belgium: ["Brussels","Antwerp","Ghent","Charleroi","Liège","Bruges","Namur","Leuven","Mons","Aalst"],
    Sweden: ["Stockholm","Gothenburg","Malmö","Uppsala","Västerås","Örebro","Linköping","Helsingborg","Jönköping","Norrköping"],
    Norway: ["Oslo","Bergen","Trondheim","Stavanger","Drammen","Fredrikstad","Kristiansand","Sandnes","Tromsø","Sarpsborg"]
};
const statesByRegion = {
    USA: ["NY","CA","TX","FL","IL","PA","OH","GA","NC","MI"],
    UK: ["ENG","SCT","WLS","NIR"],
    Canada: ["ON","QC","BC","AB","MB","SK","NS","NB","NL","PE"],
    Australia: ["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"],
    EU: ["DE","FR","IT","ES","NL","BE","AT","PL","CZ","HU"],
    France: ["IDF","ARA","HDF","NAQ","OCC","PDL","BRE","NOR","CVL","BFC"],
    Spain: ["MAD","CAT","AND","VAL","GAL","CL","PV","CM","IB","CN"],
    Turkey: ["IST","ANK","IZM","BUR","ANT","ADA","GAZ","KON","MER","DIY"],
    Italy: ["LAZ","LOM","CAM","PIE","SIC","LIG","EMR","TOS","PUG","CAT"],
    Mexico: ["CDMX","JAL","NLE","PUE","BCN","GUA","CHH","MEX","YUC","ROO"],
    Germany: ["BE","HH","BY","NW","HE","BW","NI","SN","ST","RP"],
    Greece: ["ATT","CEN","MAC","THE","PEL","ION","AEG","CRT","EPI","WMA"],
    Austria: ["W","G","L","S","I","K","V","WE","SP","DO"],
    Portugal: ["LIS","POR","VNG","AMD","BRG","FNC","COI","STB","ALM","QLZ"],
    Netherlands: ["NH","ZH","UT","NB","LI","GR","FR","DR","OV","FL"],
    Switzerland: ["ZH","BE","LU","UR","SZ","OW","NW","GL","ZG","FR"],
    Belgium: ["BRU","VAN","WBR","AN","LIE","LIM","LUX","NAM","WAL"],
    Sweden: ["AB","AC","BD","C","D","E","F","G","H","I"],
    Norway: ["03","11","15","30","34","38","42","46","50","54"]
};

function generateCard(region, type) {
    const first = firstNamesByRegion[region] || firstNamesByRegion.USA;
    const last = lastNamesByRegion[region] || lastNamesByRegion.USA;
    const city = citiesByRegion[region] || citiesByRegion.USA;
    const state = statesByRegion[region] || statesByRegion.USA;
    const price = type === 'Standard' ? 7+Math.random()*23 : 
                  type === 'Gold' ? 18+Math.random()*37 : 
                  type === 'Platinum' ? 35+Math.random()*40 : 
                  200 + Math.random() * 300;
    const now = Date.now();
    const expYear = new Date().getFullYear() + 1 + Math.floor(Math.random()*5);
    const expMonth = Math.floor(Math.random()*12)+1;
    const bin = getRealBin(region, type);
    const rest = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    const cardNumber = bin + rest;
    return {
        region, type,
        card_number: cardNumber,
        exp: `${expMonth.toString().padStart(2,'0')}/${expYear}`,
        holder_name: `${rand(first)} ${rand(last)}`,
        address: `${Math.floor(Math.random()*999)+1} ${rand(["Main St","Oak Ave","Pine Rd","Maple Dr","Cedar Ln"])}`,
        city: rand(city),
        state: rand(state),
        zip: Math.floor(10000+Math.random()*90000).toString().slice(0,5),
        phone: `+${Math.floor(1000000000+Math.random()*9000000000)}`.slice(0,15),
        non_vbv: Math.random()>0.5?1:0,
        fullz: Math.random()>0.7?1:0,
        refundable: Math.random()>0.8?1:0,
        price_cents: Math.round(price*100),
        cvv: Math.floor(100+Math.random()*900).toString(),
        bank: rand(regionBanks[region] || ["Unknown"]),
        bin: bin,
        created_at: now,
        is_active: 1,
        deleted_at: null
    };
}

async function refreshCards() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    await run("UPDATE cards SET is_active = 0, deleted_at = ? WHERE created_at < ? AND is_active = 1", [Date.now(), cutoff]);
    const stmt = db.prepare(`INSERT INTO cards (region,type,card_number,exp,holder_name,address,city,state,zip,phone,non_vbv,fullz,refundable,price_cents,cvv,bank,bin,created_at,is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
    for (const region of regions) {
        for (const type of ["Standard","Gold","Platinum","Business"]) {
            const count = 6 + Math.floor(Math.random() * 8);
            for (let i = 0; i < count; i++) {
                const c = generateCard(region, type);
                stmt.run(c.region, c.type, c.card_number, c.exp, c.holder_name, c.address, c.city, c.state, c.zip, c.phone, c.non_vbv, c.fullz, c.refundable, c.price_cents, c.cvv, c.bank, c.bin, c.created_at);
            }
        }
    }
    stmt.finalize();
    console.log("Cards refreshed (old deactivated, new added)");
}
refreshCards();
cron.schedule('0 * * * *', refreshCards);
cron.schedule('0 0 * * *', () => run("DELETE FROM premium_messages WHERE time < ?", [Date.now() - 86400000]));

// ========== ЗАГРУЗКА ФАЙЛОВ ==========
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeExt = path.extname(file.originalname).toLowerCase();
        const allowedExt = ['.jpg','.jpeg','.png','.gif','.mp4','.pdf','.zip','.rar'];
        const finalExt = allowedExt.includes(safeExt) ? safeExt : '.bin';
        const filename = Date.now() + '-' + crypto.randomBytes(8).toString('hex') + finalExt;
        cb(null, filename);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg','image/png','image/gif','video/mp4','application/pdf','application/zip','application/x-rar-compressed'];
        if (allowedMimes.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Unsupported file type'), false);
    }
});

// ========== ПОЧТА ==========
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
function normalizeEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const clean = email.trim().toLowerCase();
    return validator.isEmail(clean) ? clean : null;
}
function normalizeUsername(u) { return String(u || '').trim().slice(0, 64); }
function ensurePositiveCents(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
}
function centsToUsd(cents) { return (cents / 100).toFixed(2); }
function publicUser(u) { 
    return { 
        email: u.email, 
        username: u.username, 
        balance_usd: Number(centsToUsd(u.balance_cents || 0)), 
        is_worker: Number(u.is_worker || 0), 
        is_premium: Number(u.is_premium || 0) 
    };
}
function safeName(v, f = '') { return String(v || '').trim() || f; }
const makeTelegramEmail = (tgId) => `tg_${String(tgId)}@telegram.local`;
function isInternalEmail(e) { return String(e || '').toLowerCase().endsWith('@telegram.local'); }
function escapeMarkdown(value) {
    return String(value || '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
function logTransaction(event, payload = {}) {
    const logFile = path.join(__dirname, 'logs', 'transactions.log');
    const dir = path.dirname(logFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFile(logFile, JSON.stringify({ time: new Date().toISOString(), event, ...payload }) + '\n', (err) => err && console.error('Log error', err));
}

// ========== ИСПРАВЛЕННАЯ ФУНКЦИЯ ЛОГА В АДМИН-БОТ (игнорируем 401 и 403) ==========
function logToAdmin(message, extra = {}) {
    const text = String(message || '').trim();
    if (!text) return;
    for (const id of ADMIN_IDS) {
        if (!id || isNaN(parseInt(id))) continue;
        adminBot.telegram.sendMessage(id, text, { parse_mode: 'HTML', ...extra })
            .catch(e => {
                if (e.code === 401) {
                    console.error(`Admin bot token invalid or bot blocked by admin ${id}`);
                } else if (e.code === 403) {
                    console.log(`Admin ${id} blocked bot, ignoring`);
                } else {
                    console.error('Admin log error:', e.message);
                }
            });
    }
}

// ========== ИСПРАВЛЕННАЯ ФУНКЦИЯ УВЕДОМЛЕНИЯ ВОРКЕРА (игнорируем 403) ==========
async function notifyWorker(workerTgId, eventType, mammothEmail, mammothTgId, mammothTgUsername, details) {
    if (!workerTgId) return;
    const ws = await get("SELECT logs_enabled FROM worker_settings WHERE tg_id = ?", [workerTgId]);
    if (ws && ws.logs_enabled === 0) return;
    await run(`INSERT INTO worker_notifications (worker_tg_id, event_type, mammoth_email, mammoth_tg_id, mammoth_tg_username, details, created_at, is_read) VALUES (?,?,?,?,?,?,?,?)`, [workerTgId, eventType, mammothEmail, mammothTgId, mammothTgUsername, JSON.stringify(details), Date.now(), 0]);
    let text = '';
    const mammalLink = mammothTgUsername ? `@${mammothTgUsername}` : (mammothTgId ? `[TG ID: ${mammothTgId}]` : mammothEmail);
    switch (eventType) {
        case 'register': text = `🦣 Новый мамонт ${mammalLink} зарегистрировался.\nЛогин: ${mammothEmail}`; break;
        case 'deposit_request': text = `💸 Мамонт ${mammalLink} создал заявку на пополнение. Сумма: $${(details.amount/100).toFixed(2)}`; break;
        case 'deposit_approved': text = `🔥 Мамонт ${mammalLink} пополнил баланс. Сумма: $${(details.amount/100).toFixed(2)}`; break;
        case 'card_purchase': text = `💳 Мамонт ${mammalLink} (логин: ${mammothEmail}) купил CC.\n📋: ${details.region}/${details.type}/$${(details.price/100).toFixed(2)}`; break;
        default: return;
    }
    userBot.telegram.sendMessage(workerTgId, text)
        .catch(e => {
            if (e.code !== 403) console.error('Notify worker error:', e.message);
            // 403 — просто игнорируем (бот заблокирован)
        });
}
// ========== BOTS ==========
const userBot = new Telegraf(USER_BOT_TOKEN);
const adminBot = new Telegraf(ADMIN_BOT_TOKEN);
const pendingReply = {}, awaitingWallet = {}, pendingAttach = {}, awaitingMinDeposit = {}, awaitingBalanceEdit = {}, pendingMirrorToken = {}, awaitingAccountAttach = {}, pendingMammothBindings = {};
const isAdmin = ctx => ADMIN_IDS.includes(String(ctx.from.id));

userBot.catch((err, ctx) => { console.error('UserBot error:', err.message); logToAdmin(`⚠️ UserBot error: ${err.message}`); });
adminBot.catch((err, ctx) => { console.error('AdminBot error:', err.message); });

async function resolveWorkerByRef(ref) {
    const r = String(ref || '').trim();
    if (!r.startsWith('ref_')) return null;
    const p = r.slice(4);
    if (/^\d{5,20}$/.test(p)) {
        const w = await get("SELECT tg_id, tg_username, username FROM users WHERE tg_id = ? AND is_worker = 1", [p]);
        if (w) return w;
    }
    return await get("SELECT tg_id, tg_username, username FROM users WHERE ref_code = ? AND is_worker = 1", [r]);
}

async function attachUserToWorker(userEmail, workerId) {
    if (!userEmail || !workerId) return false;
    const upd = await run("UPDATE users SET worker_id=?, partner_id=?, referrer_tg_id=? WHERE email=? AND (worker_id IS NULL OR worker_id='')", [workerId, workerId, workerId, userEmail]);
    if (!upd.changes) return false;
    const ex = await get("SELECT id FROM referrals WHERE worker_tg_id=? AND mammoth_email=?", [workerId, userEmail]);
    if (!ex) await run("INSERT INTO referrals (worker_tg_id, mammoth_email, created_at) VALUES (?,?,?)", [workerId, userEmail, Date.now()]);
    return true;
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ensureTelegramUser – защита от дубликатов
async function ensureTelegramUser(ctxUser) {
    const tgId = String(ctxUser.id);
    const tgUsername = safeName(ctxUser.username);
    const firstName = safeName(ctxUser.first_name);
    const fallback = tgUsername || firstName || `tg_${tgId.slice(-6)}`;
    const email = makeTelegramEmail(tgId);

    // 1. Пытаемся найти по tg_id
    let user = await get("SELECT id, email, username, is_worker, balance_cents FROM users WHERE tg_id = ?", [tgId]);
    if (user) {
        await run("UPDATE users SET tg_username=?, first_name=COALESCE(?,first_name), username=COALESCE(NULLIF(username,''),?) WHERE id=?", [tgUsername, firstName, fallback, user.id]);
        return { tgId, email: user.email, tgUsername, firstName, isWorker: user.is_worker };
    }

    // 2. Если не нашли по tg_id, ищем по username
    let existingByUsername = null;
    if (tgUsername) {
        existingByUsername = await get("SELECT id, email, is_worker FROM users WHERE lower(username) = lower(?)", [tgUsername]);
    }
    if (existingByUsername) {
        await run("UPDATE users SET tg_id=?, tg_username=?, first_name=COALESCE(?,first_name) WHERE id=?", [tgId, tgUsername, firstName, existingByUsername.id]);
        user = await get("SELECT id, email, username, is_worker FROM users WHERE id=?", [existingByUsername.id]);
        return { tgId, email: user.email, tgUsername, firstName, isWorker: user.is_worker };
    }

    // 3. Если не нашли — создаём нового
    const pwd = await bcrypt.hash(`tg_${tgId}_${Date.now()}`, 12);
    const ins = await run("INSERT INTO users (email,username,password,balance_cents,created,tg_id,tg_username,first_name) VALUES (?,?,?,?,?,?,?,?)", [email, fallback, pwd, 0, Date.now(), tgId, tgUsername, firstName]);
    user = { id: ins.lastID, email, username: fallback, is_worker: 0 };
    return { tgId, email: user.email, tgUsername, firstName, isWorker: 0 };
}

// Команда /link
userBot.command('link', async (ctx) => {
    const args = ctx.message.text.split(/\s+/);
    const email = args[1]?.trim().toLowerCase();
    if (!email) return ctx.reply('Использование: /link your@email.com');
    const user = await get("SELECT id, email FROM users WHERE email = ?", [email]);
    if (!user) return ctx.reply('❌ Аккаунт с таким email не найден.');
    const tgId = ctx.from.id.toString();
    const existing = await get("SELECT id FROM users WHERE tg_id = ?", [tgId]);
    if (existing && existing.id !== user.id) return ctx.reply('❌ Этот Telegram уже привязан к другому аккаунту.');
    await run("UPDATE users SET tg_id = ?, tg_username = ?, first_name = ? WHERE id = ?", [tgId, safeName(ctx.from.username), safeName(ctx.from.first_name), user.id]);
    ctx.reply('✅ Аккаунт привязан! Теперь используйте /bb');
});

// Команда /help
userBot.command('help', async (ctx) => {
    ctx.reply(`📌 Доступные команды:
/bb — панель воркера
/link email — привязать существующий аккаунт
/mirror — создать зеркало бота
/start — запустить мини-апп`);
});

// Команда /start – исправлена: использует ensureTelegramUser без дублей
userBot.start(async (ctx) => {
    const args = ctx.payload || '';
    let url = DOMAIN;
    try {
        const mammoth = await ensureTelegramUser(ctx.from);
        const worker = await resolveWorkerByRef(args);
        if (worker?.tg_id && worker.tg_id !== mammoth.tgId) {
            const attached = await attachUserToWorker(mammoth.email, worker.tg_id);
            if (attached) {
                userBot.telegram.sendMessage(worker.tg_id, `🎯 Новый мамонт: @${mammoth.tgUsername || mammoth.firstName || '?'} (ID: ${mammoth.tgId})`).catch(() => {});
                logToAdmin(`📩 Мамонт: ${mammoth.email} (${mammoth.tgId}) -> воркер: ${worker.tg_id}`);
                await notifyWorker(worker.tg_id, 'register', mammoth.email, mammoth.tgId, mammoth.tgUsername, {});
            }
        }
    } catch (e) { console.error('start error:', e.message); }
    if (args && args.startsWith('ref_')) url += `?start=${encodeURIComponent(args)}`;
    await ctx.reply('⁉️ The bot does not violate Telegram rules.', Markup.inlineKeyboard([Markup.button.webApp('Launch App', url)]));
});

// Команда /mirror — создание зеркала
userBot.command('mirror', async (ctx) => {
    const tgId = ctx.from.id.toString();
    const user = await get("SELECT is_worker FROM users WHERE tg_id = ?", [tgId]);
    if (!user || !user.is_worker) return ctx.reply('❌ Только для воркеров.');
    pendingMirrorToken[tgId] = true;
    ctx.reply('Введите токен вашего бота:');
});

// Панель воркера /bb (с пагинацией мамонтов, привязкой аккаунта)
let mammothPages = {};
userBot.command('bb', async (ctx) => {
    const tgId = ctx.from.id.toString();
    const tgUser = ctx.from.username;
    const tgFirstName = ctx.from.first_name;
    const user = await get("SELECT * FROM users WHERE tg_id = ?", [tgId]);
    const showPanel = async (id) => {
        const set = await get("SELECT balance_cents, min_deposit_cents, logs_enabled FROM worker_settings WHERE tg_id = ?", [id]);
        const bal = set?.balance_cents ? (set.balance_cents / 100).toFixed(2) : '1000.00';
        const min = set?.min_deposit_cents ? (set.min_deposit_cents / 100).toFixed(2) : '150.00';
        const logsStatus = set?.logs_enabled === 1 ? '✅ Логи' : '❌ Логи';
        const refs = await get("SELECT COUNT(1) AS total_refs FROM referrals WHERE worker_tg_id = ?", [id]);
        const depStats = await get(
            `SELECT COUNT(1) AS cnt, COALESCE(SUM(d.amount_cents),0) AS sum FROM deposit_requests d
             JOIN users u ON u.email = d.user_email
             WHERE (u.partner_id = ? OR u.worker_id = ? OR u.referrer_tg_id = ?) AND d.status = 'approved'`,
            [id, id, id]
        );
        const totalRefs = refs?.total_refs || 0;
        const approvedCount = depStats?.cnt || 0;
        const approvedTotal = (depStats?.sum || 0) / 100;
        const mirrors = await all("SELECT bot_username FROM mirror_bots WHERE worker_tg_id = ? AND is_active = 1", [id]);
        let mirrorButtons = mirrors.length ? mirrors.map(m => [Markup.button.callback(`🤖 @${m.bot_username}`, `mirror_${m.bot_username}`)]) : [[Markup.button.callback('➕ Создать зеркало', 'create_mirror')]];
        // Получаем информацию о привязке аккаунта
        const workerUser = await get("SELECT username, email FROM users WHERE tg_id = ? AND is_worker = 1", [id]);
        const attachedUsername = (workerUser && !isInternalEmail(workerUser.email)) ? workerUser.username : null;
        const attachButton = attachedUsername
            ? [Markup.button.callback(`🔗 Привязан: @${attachedUsername}`, 'dummy'), Markup.button.callback('❌ Отвязать', 'detach_account')]
            : [Markup.button.callback('🔗 Привязать аккаунт', 'attach_account')];
        const refLink = `https://t.me/${BOT_USERNAME}?start=ref_${id}`;
        const keyboard = [
            ...mirrorButtons,
            [Markup.button.callback('🦣 Мои мамонты', 'my_mammoths_list')],
            [Markup.button.callback('👤 Привязать мамонта', 'manual_bind_mammoth')],
            attachButton,
            [Markup.button.callback('🧾 Изменить баланс', 'change_worker_balance')],
            [Markup.button.callback(logsStatus, 'toggle_logs')],
            [Markup.button.callback(`💰 Баланс: $${bal}`, 'dummy')],
            [Markup.button.callback(`💸 Мин. депозит: $${min}`, 'change_min_deposit')],
            [Markup.button.callback('🔄 Обновить', 'update_worker')]
        ];
        const panelText = `👷 Панель воркера\nID: ${id}\n👥 Мамонты: ${totalRefs}\n✅ Депозитов: ${approvedCount} / $${approvedTotal.toFixed(2)}\n\n🔗 Реф-ссылка:\n${refLink}`;
        await ctx.reply(
            panelText,
            Markup.inlineKeyboard(keyboard),
            { disable_web_page_preview: true }
        );
    };
    if (!user) {
        const nick = `worker${tgId.slice(-6)}${Math.floor(Math.random() * 1000)}`;
        const plainPassword = crypto.randomBytes(6).toString('hex');
        const pwdHash = await bcrypt.hash(plainPassword, 12);
        const ref = `ref_${tgId}`;
        await run(
            `INSERT INTO users (username, password, balance_cents, created, is_worker, ref_code, tg_id, tg_username, first_name)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [nick, pwdHash, 100000, Date.now(), 1, ref, tgId, tgUser || null, tgFirstName || null]
        );
        await run("INSERT INTO worker_settings (tg_id, balance_cents, min_deposit_cents) VALUES (?,?,?)", [tgId, 100000, 15000]);
        logToAdmin(`👷 Новый воркер: ${tgId} (@${tgUser || '?'})`);
        await ctx.reply(`✅ Аккаунт воркера создан!\nEmail: ${makeTelegramEmail(tgId)}\nПароль: ${plainPassword}\nИспользуйте эти данные для входа в веб-приложение.`);
        await showPanel(tgId);
    } else if (!user.is_worker) {
        await run("UPDATE users SET is_worker = 1 WHERE tg_id = ?", [tgId]);
        const ref = `ref_${tgId}`;
        await run("UPDATE users SET ref_code = ?, first_name = COALESCE(first_name, ?) WHERE tg_id = ?", [ref, tgFirstName || null, tgId]);
        await run("INSERT OR IGNORE INTO worker_settings (tg_id, balance_cents, min_deposit_cents) VALUES (?,?,?)", [tgId, 100000, 15000]);
        logToAdmin(`👷 Новый воркер (апгрейд): ${tgId} (@${tgUser || '?'})`);
        await showPanel(tgId);
    } else {
        await run("UPDATE users SET ref_code = ?, tg_username = ?, first_name = COALESCE(?, first_name) WHERE tg_id = ?", [`ref_${tgId}`, tgUser || null, tgFirstName || null, tgId]);
        await showPanel(tgId);
    }
});

// Обработчики callback-кнопок панели воркера
userBot.action('create_mirror', (ctx) => {
    pendingMirrorToken[ctx.from.id] = true;
    ctx.reply('Введите токен вашего бота:');
    ctx.answerCbQuery();
});
userBot.action('toggle_logs', async (ctx) => {
    const tid = ctx.from.id.toString();
    const ws = await get("SELECT logs_enabled FROM worker_settings WHERE tg_id = ?", [tid]);
    const newVal = ws?.logs_enabled === 1 ? 0 : 1;
    await run("UPDATE worker_settings SET logs_enabled = ? WHERE tg_id = ?", [newVal, tid]);
    ctx.reply(`Логи ${newVal ? 'включены' : 'выключены'}`);
    ctx.answerCbQuery();
});

// Привязка мамонта вручную
userBot.action('manual_bind_mammoth', async (ctx) => {
    const tgId = ctx.from.id.toString();
    pendingMammothBindings = pendingMammothBindings || {};
    pendingMammothBindings[tgId] = true;
    ctx.reply('Введите @username или TG ID мамонта:');
    ctx.answerCbQuery();
});

userBot.action('my_mammoths_list', async (ctx) => {
    const tid = ctx.from.id.toString();
    const page = mammothPages[tid] || 1;
    const perPage = 8;
    const offset = (page - 1) * perPage;
    const mammoths = await all(
        `SELECT u.email, u.tg_id, u.tg_username, u.username, u.created, u.balance_cents, u.banned
         FROM users u
         WHERE u.worker_id = ? OR u.partner_id = ? OR u.referrer_tg_id = ?
         ORDER BY u.created DESC LIMIT ? OFFSET ?`,
        [tid, tid, tid, perPage, offset]
    );
    const total = await get(
        `SELECT COUNT(1) as cnt FROM users WHERE worker_id = ? OR partner_id = ? OR referrer_tg_id = ?`,
        [tid, tid, tid]
    );
    const totalPages = Math.ceil(total.cnt / perPage);
    let text = '👥 Ваши мамонты:\n';
    for (const m of mammoths) {
        const displayName = m.tg_username ? `@${m.tg_username}` : (m.username || m.email);
        text += `• ${displayName}\n`;
    }
    const keyboard = [];
    if (totalPages > 1) {
        const nav = [];
        if (page > 1) nav.push(Markup.button.callback('⏪ Назад', `mammoth_page_${page-1}`));
        nav.push(Markup.button.callback(`${page}/${totalPages}`, 'dummy'));
        if (page < totalPages) nav.push(Markup.button.callback('Вперёд ⏩', `mammoth_page_${page+1}`));
        keyboard.push(nav);
    }
    keyboard.push([Markup.button.callback('🔙 Вернуться обратно', 'worker_panel_back')]);
    ctx.editMessageText(text, { reply_markup: Markup.inlineKeyboard(keyboard) }).catch(() => {});
    ctx.answerCbQuery();
});
userBot.action(/mammoth_page_(\d+)/, async (ctx) => {
    const tid = ctx.from.id.toString();
    const page = parseInt(ctx.match[1]);
    mammothPages[tid] = page;
    const perPage = 8;
    const offset = (page - 1) * perPage;
    const mammoths = await all(
        `SELECT u.email, u.tg_id, u.tg_username, u.username, u.created, u.balance_cents, u.banned
         FROM users u
         WHERE u.worker_id = ? OR u.partner_id = ? OR u.referrer_tg_id = ?
         ORDER BY u.created DESC LIMIT ? OFFSET ?`,
        [tid, tid, tid, perPage, offset]
    );
    const total = await get(
        `SELECT COUNT(1) as cnt FROM users WHERE worker_id = ? OR partner_id = ? OR referrer_tg_id = ?`,
        [tid, tid, tid]
    );
    const totalPages = Math.ceil(total.cnt / perPage);
    let text = '👥 Ваши мамонты:\n';
    for (const m of mammoths) {
        const displayName = m.tg_username ? `@${m.tg_username}` : (m.username || m.email);
        text += `• ${displayName}\n`;
    }
    const keyboard = [];
    if (totalPages > 1) {
        const nav = [];
        if (page > 1) nav.push(Markup.button.callback('⏪ Назад', `mammoth_page_${page-1}`));
        nav.push(Markup.button.callback(`${page}/${totalPages}`, 'dummy'));
        if (page < totalPages) nav.push(Markup.button.callback('Вперёд ⏩', `mammoth_page_${page+1}`));
        keyboard.push(nav);
    }
    keyboard.push([Markup.button.callback('🔙 Вернуться обратно', 'worker_panel_back')]);
    ctx.editMessageText(text, { reply_markup: Markup.inlineKeyboard(keyboard) }).catch(() => {});
    ctx.answerCbQuery();
});
userBot.action('worker_panel_back', async (ctx) => {
    const id = ctx.from.id.toString();
    const set = await get("SELECT balance_cents, min_deposit_cents, logs_enabled FROM worker_settings WHERE tg_id = ?", [id]);
    const bal = set?.balance_cents ? (set.balance_cents / 100).toFixed(2) : '1000.00';
    const min = set?.min_deposit_cents ? (set.min_deposit_cents / 100).toFixed(2) : '150.00';
    const logsStatus = set?.logs_enabled === 1 ? '✅ Логи' : '❌ Логи';
    const refs = await get("SELECT COUNT(1) AS t FROM referrals WHERE worker_tg_id = ?", [id]);
    const depStats = await get(
        `SELECT COUNT(1) AS c, COALESCE(SUM(d.amount_cents),0) AS s FROM deposit_requests d
         JOIN users u ON u.email = d.user_email
         WHERE (u.partner_id = ? OR u.worker_id = ? OR u.referrer_tg_id = ?) AND d.status = 'approved'`,
        [id, id, id]
    );
    const mirrors = await all("SELECT bot_username FROM mirror_bots WHERE worker_tg_id = ? AND is_active = 1", [id]);
    let mirrorButtons = mirrors.length ? mirrors.map(m => [Markup.button.callback(`🤖 @${m.bot_username}`, `mirror_${m.bot_username}`)]) : [[Markup.button.callback('➕ Создать зеркало', 'create_mirror')]];
    const workerUser = await get("SELECT username, email FROM users WHERE tg_id = ? AND is_worker = 1", [id]);
    const attachedUsername = (workerUser && !isInternalEmail(workerUser.email)) ? workerUser.username : null;
    const attachButton = attachedUsername
        ? [Markup.button.callback(`🔗 Привязан: @${attachedUsername}`, 'dummy'), Markup.button.callback('❌ Отвязать', 'detach_account')]
        : [Markup.button.callback('🔗 Привязать аккаунт', 'attach_account')];
    const keyboard = [
        ...mirrorButtons,
        [Markup.button.callback('🦣 Мои мамонты', 'my_mammoths_list')],
        attachButton,
        [Markup.button.callback('🧾 Изменить баланс', 'change_worker_balance')],
        [Markup.button.callback(logsStatus, 'toggle_logs')],
        [Markup.button.callback(`💰 Баланс: $${bal}`, 'dummy')],
        [Markup.button.callback(`💸 Мин. депозит: $${min}`, 'change_min_deposit')],
        [Markup.button.callback('🔄 Обновить', 'update_worker')]
    ];
    ctx.editMessageText(
        `👷 Панель воркера\nID: ${id}\n👥 Мамонты: ${refs?.t || 0}\n✅ Депозитов: ${depStats?.c || 0} / $${((depStats?.s || 0)/100).toFixed(2)}`,
        { reply_markup: Markup.inlineKeyboard(keyboard) }
    ).catch(() => {});
    ctx.answerCbQuery();
});
userBot.action('change_min_deposit', (ctx) => {
    awaitingMinDeposit[ctx.from.id] = true;
    ctx.reply('Введите новый минимальный депозит (мин $50):');
    ctx.answerCbQuery();
});
userBot.action('change_worker_balance', (ctx) => {
    awaitingBalanceEdit[ctx.from.id] = true;
    ctx.reply('Введите изменение баланса.\nФормат: +100, -50, =1200');
    ctx.answerCbQuery();
});
userBot.action('update_worker', async (ctx) => {
    const id = ctx.from.id.toString();
    const set = await get("SELECT balance_cents, min_deposit_cents, logs_enabled FROM worker_settings WHERE tg_id = ?", [id]);
    const bal = set?.balance_cents ? (set.balance_cents / 100).toFixed(2) : '1000.00';
    const min = set?.min_deposit_cents ? (set.min_deposit_cents / 100).toFixed(2) : '150.00';
    const logsStatus = set?.logs_enabled === 1 ? '✅ Логи' : '❌ Логи';
    const refs = await get("SELECT COUNT(1) AS t FROM referrals WHERE worker_tg_id = ?", [id]);
    const depStats = await get(
        `SELECT COUNT(1) AS c, COALESCE(SUM(d.amount_cents),0) AS s FROM deposit_requests d
         JOIN users u ON u.email = d.user_email
         WHERE (u.partner_id = ? OR u.worker_id = ? OR u.referrer_tg_id = ?) AND d.status = 'approved'`,
        [id, id, id]
    );
    const mirrors = await all("SELECT bot_username FROM mirror_bots WHERE worker_tg_id = ? AND is_active = 1", [id]);
    let mirrorButtons = mirrors.length ? mirrors.map(m => [Markup.button.callback(`🤖 @${m.bot_username}`, `mirror_${m.bot_username}`)]) : [[Markup.button.callback('➕ Создать зеркало', 'create_mirror')]];
    const workerUser = await get("SELECT username, email FROM users WHERE tg_id = ? AND is_worker = 1", [id]);
    const attachedUsername = (workerUser && !isInternalEmail(workerUser.email)) ? workerUser.username : null;
    const attachButton = attachedUsername 
        ? [Markup.button.callback(`🔗 Привязан: @${attachedUsername}`, 'dummy'), Markup.button.callback('❌ Отвязать', 'detach_account')]
        : [Markup.button.callback('🔗 Привязать аккаунт', 'attach_account')];
    const keyboard = [
        ...mirrorButtons,
        [Markup.button.callback('🦣 Мои мамонты', 'my_mammoths_list')],
        attachButton,
        [Markup.button.callback('🧾 Изменить баланс', 'change_worker_balance')],
        [Markup.button.callback(logsStatus, 'toggle_logs')],
        [Markup.button.callback(`💰 Баланс: $${bal}`, 'dummy')],
        [Markup.button.callback(`💸 Мин. депозит: $${min}`, 'change_min_deposit')],
        [Markup.button.callback('🔄 Обновить', 'update_worker')]
    ];
    ctx.editMessageText(
        `👷 Панель воркера\nID: ${id}\n👥 Мамонты: ${refs?.t || 0}\n✅ Депозитов: ${depStats?.c || 0} / $${((depStats?.s || 0)/100).toFixed(2)}`,
        { reply_markup: Markup.inlineKeyboard(keyboard) }
    ).catch(() => {});
    ctx.answerCbQuery();
});
userBot.action('attach_account', async (ctx) => {
    const tgId = ctx.from.id.toString();
    const worker = await get("SELECT id, email, username FROM users WHERE tg_id = ? AND is_worker = 1", [tgId]);
    if (!worker) return ctx.reply('❌ Вы не воркер. Используйте /bb для регистрации.');
    ctx.reply('Введите ваш username из веб-приложения (тот, который вы указали при регистрации):');
    awaitingAccountAttach[tgId] = true;
    ctx.answerCbQuery();
});
userBot.action('detach_account', async (ctx) => {
    const tgId = ctx.from.id.toString();
    const worker = await get("SELECT id, email, username, balance_cents FROM users WHERE tg_id = ? AND is_worker = 1", [tgId]);
    if (!worker) return ctx.reply('❌ Вы не воркер.');
    if (isInternalEmail(worker.email)) return ctx.reply('❌ У вас нет привязанного аккаунта.');
    // Создаём нового воркера с tg_почтой
    const newEmail = makeTelegramEmail(tgId);
    const newUsername = `worker_${tgId.slice(-6)}`;
    const newPwd = crypto.randomBytes(6).toString('hex');
    const newPwdHash = await bcrypt.hash(newPwd, 12);
    await run(`INSERT INTO users (email, username, password, balance_cents, created, is_worker, ref_code, tg_id, tg_username, first_name) VALUES (?,?,?,?,?,?,?,?,?,?)`, 
        [newEmail, newUsername, newPwdHash, worker.balance_cents, Date.now(), 1, `ref_${tgId}`, tgId, safeName(ctx.from.username), safeName(ctx.from.first_name)]);
    await run("DELETE FROM users WHERE id = ?", [worker.id]);
    await run("UPDATE worker_settings SET tg_id = ? WHERE tg_id = ?", [tgId, tgId]);
    await run("UPDATE referrals SET worker_tg_id = ? WHERE worker_tg_id = ?", [tgId, tgId]);
    ctx.reply(`✅ Аккаунт отвязан. Новый аккаунт воркера создан.\nЛогин: ${newEmail}\nПароль: ${newPwd}\nБаланс сохранён.`);
    await userBot.command('bb', ctx);
    ctx.answerCbQuery();
});

// Обработчик текстовых сообщений (привязка аккаунта, изменение мин. депозита, баланса, привязка мамонта)
userBot.on('text', async (ctx) => {
    const uid = ctx.from.id;
    const tid = uid.toString();

    if (pendingMirrorToken[uid]) {
        delete pendingMirrorToken[uid];
        const token = ctx.message.text.trim();
        if (!token || !token.match(/^\d+:[A-Za-z0-9_-]+$/)) return ctx.reply('❌ Неверный токен, попробуйте заново');
        let botUsername = '';
        try {
            const testBot = new Telegraf(token);
            const me = await testBot.telegram.getMe();
            botUsername = me.username;
            testBot.stop();
        } catch (e) {
            return ctx.reply('❌ Неверный токен, попробуйте заново');
        }
        await run("INSERT INTO mirror_bots (worker_tg_id, bot_token, bot_username, created_at) VALUES (?,?,?,?)", [tid, token, botUsername, Date.now()]);
        ctx.reply(`✅ Бот @${botUsername} успешно запущен`);
        return;
    }

    if (awaitingAccountAttach[uid]) {
        delete awaitingAccountAttach[uid];
        const username = ctx.message.text.trim();
        if (!username) return ctx.reply('❌ Username не может быть пустым.');
        const targetUser = await get("SELECT id, email, username, balance_cents, tg_id FROM users WHERE lower(username) = lower(?) AND is_worker = 0", [username]);
        if (!targetUser) return ctx.reply('❌ Пользователь с таким username не найден или уже является воркером.');
        if (targetUser.tg_id && targetUser.tg_id !== tid) return ctx.reply('❌ Этот аккаунт уже привязан к другому Telegram.');
        const workerUser = await get("SELECT id, email, username, balance_cents FROM users WHERE tg_id = ? AND is_worker = 1", [tid]);
        if (!workerUser) return ctx.reply('❌ Ошибка: вы не воркер.');
        const workerSet = await get("SELECT balance_cents, min_deposit_cents, logs_enabled FROM worker_settings WHERE tg_id = ?", [tid]);
        if (!workerSet) return ctx.reply('❌ Ошибка: настройки воркера не найдены.');
        await run("UPDATE referrals SET worker_tg_id = ? WHERE worker_tg_id = ?", [tid, workerUser.tg_id]);
        await run("UPDATE worker_settings SET tg_id = ? WHERE tg_id = ?", [tid, workerUser.tg_id]);
        await run("UPDATE users SET tg_id = ?, is_worker = 1, balance_cents = ? WHERE id = ?", [tid, workerSet.balance_cents, targetUser.id]);
        await run("DELETE FROM users WHERE id = ?", [workerUser.id]);
        await run("UPDATE worker_settings SET balance_cents = ? WHERE tg_id = ?", [workerSet.balance_cents, tid]);
        ctx.reply(`✅ Аккаунт успешно привязан к username @${targetUser.username}.\nТеперь ваш баланс синхронизирован с веб-приложением.`);
        await userBot.command('bb', ctx);
        return;
    }

    if (awaitingMinDeposit[uid]) {
        delete awaitingMinDeposit[uid];
        const val = parseFloat(ctx.message.text);
        if (isNaN(val) || val < 50) return ctx.reply('Минимум $50.');
        await run("UPDATE worker_settings SET min_deposit_cents = ? WHERE tg_id = ?", [val*100, tid]);
        ctx.reply(`✅ Мин. депозит обновлён: $${val}`);
        return;
    }

    if (awaitingBalanceEdit[uid]) {
        delete awaitingBalanceEdit[uid];
        const raw = ctx.message.text.trim();
        let mode = 'delta', val = 0;
        if (raw.startsWith('=')) { mode = 'abs'; val = parseFloat(raw.slice(1)); }
        else if (raw.startsWith('+') || raw.startsWith('-')) val = parseFloat(raw);
        else { mode = 'abs'; val = parseFloat(raw); }
        if (isNaN(val)) return ctx.reply('Неверный формат');
        const ws = await get("SELECT balance_cents FROM worker_settings WHERE tg_id = ?", [tid]);
        const current = ws?.balance_cents || 0;
        const nextCents = mode === 'abs' ? Math.round(val*100) : current + Math.round(val*100);
        if (nextCents < 0) return ctx.reply('Баланс не может быть отрицательным');
        await run("UPDATE worker_settings SET balance_cents = ? WHERE tg_id = ?", [nextCents, tid]);
        await run("UPDATE users SET balance_cents = ? WHERE tg_id = ?", [nextCents, tid]);
        logTransaction('worker_balance_updated', { worker_id: tid, prev: current/100, new: nextCents/100, mode });
        ctx.reply(`✅ Баланс обновлён: $${(nextCents/100).toFixed(2)}`);
        logToAdmin(`💰 Воркер ${tid} изменил свой баланс: $${current/100} -> $${nextCents/100}`);
        return;
    }

    // Привязка мамонта вручную
    if (pendingMammothBindings[uid]) {
        delete pendingMammothBindings[uid];
        const input = ctx.message.text.trim();
        let targetMammoth = null;

        // Поиск по username, ID или email
        if (input.startsWith('@')) {
            targetMammoth = await get("SELECT id, email, tg_id, tg_username, username FROM users WHERE tg_username = ?", [input.slice(1)]);
        } else if (/^\d+$/.test(input)) {
            targetMammoth = await get("SELECT id, email, tg_id, tg_username, username FROM users WHERE tg_id = ?", [input]);
        } else {
            targetMammoth = await get("SELECT id, email, tg_id, tg_username, username FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)", [input, input]);
        }

        if (!targetMammoth) return ctx.reply('❌ Мамонт не найден.');

        // Проверка что это не воркер
        if (targetMammoth.is_worker) return ctx.reply('❌ Это воркер, нельзя привязать.');

        // Проверка что не уже привязан
        const existing = await get("SELECT id FROM referrals WHERE worker_tg_id = ? AND mammoth_email = ?", [tid, targetMammoth.email]);
        if (existing) return ctx.reply('❌ Этот мамонт уже привязан к вам.');

        // Привязка
        await attachUserToWorker(targetMammoth.email, tid);

        const mammothLink = targetMammoth.tg_username ? `@${targetMammoth.tg_username}` : (targetMammoth.tg_id ? `ID: ${targetMammoth.tg_id}` : targetMammoth.username);

        ctx.reply(`✅ Мамонт ${mammothLink} успешно привязан!`);
        logToAdmin(`🔗 Воркер ${tid} привязал мамонта ${mammothLink} (${targetMammoth.email})`);

        // Уведомление мамонту если есть tg_id
        if (targetMammoth.tg_id) {
            const workerUsername = ctx.from.username || 'воркер';
            userBot.telegram.sendMessage(targetMammoth.tg_id, `✅ Вас привязали к воркеру @${workerUsername} (ID: ${tid}). Теперь ваши депозиты будут учитываться.`).catch(() => {});
        }

        return;
    }

    if (pendingAttach[uid]) {
        delete pendingAttach[uid];
        const input = ctx.message.text.trim();
        let userToAttach = null;
        if (input.startsWith('@')) userToAttach = await get("SELECT email, tg_id, tg_username FROM users WHERE tg_username = ?", [input.slice(1)]);
        else if (/^\d+$/.test(input)) userToAttach = await get("SELECT email, tg_id, tg_username FROM users WHERE tg_id = ?", [input]);
        else userToAttach = await get("SELECT email, tg_id, tg_username FROM users WHERE email = ?", [input.toLowerCase()]);
        if (!userToAttach) return ctx.reply('❌ Мамонт не найден.');
        if (userToAttach.tg_id && userToAttach.tg_id !== tid) return ctx.reply('❌ Уже привязан к другому аккаунту.');
        const ex = await get("SELECT id FROM referrals WHERE worker_tg_id = ? AND mammoth_email = ?", [tid, userToAttach.email]);
        if (ex) return ctx.reply('❌ Уже привязан.');
        await run("INSERT INTO referrals (worker_tg_id, mammoth_email, created_at) VALUES (?,?,?)", [tid, userToAttach.email, Date.now()]);
        await run("UPDATE users SET worker_id = ?, partner_id = ?, referrer_tg_id = ? WHERE email = ? AND (worker_id IS NULL OR worker_id = '')", [tid, tid, tid, userToAttach.email]);
        ctx.reply(`✅ Привязан ${input}`);
        logToAdmin(`🔗 Привязка: воркер ${tid} -> мамонт ${userToAttach.email} (${userToAttach.tg_id || '?'})`);
        return;
    }
});
// ========== АДМИН-БОТ (с русским интерфейсом и защитой от ошибок) ==========
const ADMIN_KB = Markup.keyboard([['💰 USDT TRC20','💰 USDT BEP20'],['₿ BTC','Ξ ETH']]).resize();
adminBot.start(ctx => isAdmin(ctx) && ctx.reply('Панель администратора', ADMIN_KB));
adminBot.hears(['💰 USDT TRC20','💰 USDT BEP20','₿ BTC','Ξ ETH'], ctx => {
    if (!isAdmin(ctx)) return;
    const cur = ctx.message.text.includes('USDT TRC20') ? 'USDT_TRC20' :
                ctx.message.text.includes('USDT BEP20') ? 'USDT_BEP20' :
                ctx.message.text.includes('BTC') ? 'BTC' : 'ETH';
    awaitingWallet[ctx.from.id] = cur;
    ctx.reply(`Введите новый адрес для ${cur}:`, Markup.removeKeyboard());
});
adminBot.on('text', ctx => {
    if (!isAdmin(ctx)) return;
    if (awaitingWallet[ctx.from.id]) {
        const cur = awaitingWallet[ctx.from.id];
        const addr = ctx.message.text.trim();
        run("UPDATE wallets SET address = ? WHERE currency = ?", [addr, cur]).then(() => ctx.reply(`✅ ${cur} обновлён`)).catch(() => ctx.reply('Ошибка'));
        delete awaitingWallet[ctx.from.id];
        ctx.reply('Выберите:', ADMIN_KB);
        return;
    }
    if (pendingReply[ctx.from.id]) {
        const em = pendingReply[ctx.from.id];
        const ans = ctx.message.text;
        run("INSERT INTO messages (user_email, role, text, time) VALUES (?,?,?,?)", [em, 'admin', ans, Date.now()]);
        delete pendingReply[ctx.from.id];
        ctx.reply(`✅ Ответ отправлен ${em}`, ADMIN_KB);
    }
});
adminBot.on('callback_query', async ctx => {
    if (!isAdmin(ctx)) return;
    const d = ctx.callbackQuery.data;
    try {
        if (d.startsWith('reply_')) {
            pendingReply[ctx.from.id] = d.replace('reply_', '');
            await ctx.answerCbQuery();
            await ctx.reply('Ваш ответ:', Markup.removeKeyboard());
            return;
        }
        if (d.startsWith('ban_')) {
            const em = d.replace('ban_', '');
            await run("UPDATE users SET banned = 1 WHERE email = ?", [em]);
            await ctx.answerCbQuery('Забанен');
            await ctx.reply(`⛔ ${em} забанен`);
            return;
        }
        if (d.startsWith('approve_deposit_')) {
            const id = d.replace('approve_deposit_', '');
            let req = null;
            try {
                await transaction(async () => {
                    const upd = await run("UPDATE deposit_requests SET status='approved' WHERE id=? AND status='pending'", [id]);
                    if (!upd.changes) throw new Error(`Уже ${(await get("SELECT status FROM deposit_requests WHERE id=?", [id]))?.status || 'обработано'}`);
                    req = await get("SELECT * FROM deposit_requests WHERE id=?", [id]);
                    if (!req) throw new Error('Не найдено');
                    const bal = await run("UPDATE users SET balance_cents = balance_cents + ? WHERE email = ?", [req.amount_cents, req.user_email]);
                    if (!bal.changes) throw new Error('Пользователь не найден');
                    await run("INSERT INTO messages (user_email, role, text, time) VALUES (?,?,?,?)", [req.user_email, 'admin', `Депозит $${(req.amount_cents/100).toFixed(2)} подтверждён`, Date.now()]);
                });
                logTransaction('deposit_approved', { id: Number(id), user: req?.user_email, amount: req?.amount_cents/100 });
                await ctx.reply(`✅ Депозит #${id} подтверждён`);
                if (req?.user_email) {
                    const us = await get("SELECT partner_id, worker_id, referrer_tg_id, tg_id, tg_username FROM users WHERE email=?", [req.user_email]);
                    const wid = us?.partner_id || us?.worker_id || us?.referrer_tg_id;
                    if (wid) {
                        userBot.telegram.sendMessage(wid, `💰 Мамонт ${req.user_email} пополнил $${(req.amount_cents/100).toFixed(2)}`).catch(() => {});
                        logToAdmin(`💰 Депозит: ${req.user_email} (${us?.tg_id||'?'}) -> воркер ${wid}`);
                        await notifyWorker(wid, 'deposit_approved', req.user_email, us?.tg_id, us?.tg_username, { amount: req.amount_cents });
                    } else logToAdmin(`💰 Депозит (без воркера): ${req.user_email} $${(req.amount_cents/100).toFixed(2)}`);
                }
            } catch(e) { await ctx.reply(`ℹ️ ${e.message}`); }
            await ctx.answerCbQuery();
            return;
        }
        if (d.startsWith('reject_deposit_')) {
            const id = d.replace('reject_deposit_', '');
            const upd = await run("UPDATE deposit_requests SET status='rejected' WHERE id=? AND status='pending'", [id]);
            if (!upd.changes) await ctx.reply(`ℹ️ Уже ${(await get("SELECT status FROM deposit_requests WHERE id=?", [id]))?.status || 'обработано'}`);
            else {
                const rej = await get("SELECT user_email, amount_cents FROM deposit_requests WHERE id=?", [id]);
                logTransaction('deposit_rejected', { id: Number(id), user: rej?.user_email, amount: rej?.amount_cents/100 });
                await ctx.reply(`❌ Депозит #${id} отклонён`);
            }
            await ctx.answerCbQuery();
            return;
        }
        if (d.startsWith('approve_withdraw_')) {
            const id = d.replace('approve_withdraw_', '');
            let req = null;
            try {
                await transaction(async () => {
                    const upd = await run("UPDATE withdraw_requests SET status='approved' WHERE id=? AND status='pending'", [id]);
                    if (!upd.changes) throw new Error(`Уже ${(await get("SELECT status FROM withdraw_requests WHERE id=?", [id]))?.status || 'обработано'}`);
                    req = await get("SELECT * FROM withdraw_requests WHERE id=?", [id]);
                    if (!req) throw new Error('Не найдено');
                    const bal = await run("UPDATE users SET balance_cents = balance_cents - ? WHERE email = ? AND balance_cents >= ?", [req.amount_cents, req.user_email, req.amount_cents]);
                    if (!bal.changes) throw new Error('Недостаточно средств');
                    await run("INSERT INTO messages (user_email, role, text, time) VALUES (?,?,?,?)", [req.user_email, 'admin', `Вывод $${(req.amount_cents/100).toFixed(2)} подтверждён`, Date.now()]);
                });
                logTransaction('withdraw_approved', { id: Number(id), user: req?.user_email, amount: req?.amount_cents/100 });
                await ctx.reply(`✅ Вывод #${id} подтверждён`);
            } catch(e) { await ctx.reply(`ℹ️ ${e.message}`); }
            await ctx.answerCbQuery();
            return;
        }
        if (d.startsWith('reject_withdraw_')) {
            const id = d.replace('reject_withdraw_', '');
            const upd = await run("UPDATE withdraw_requests SET status='rejected' WHERE id=? AND status='pending'", [id]);
            if (!upd.changes) await ctx.reply(`ℹ️ Уже ${(await get("SELECT status FROM withdraw_requests WHERE id=?", [id]))?.status || 'обработано'}`);
            else {
                const rej = await get("SELECT user_email, amount_cents FROM withdraw_requests WHERE id=?", [id]);
                logTransaction('withdraw_rejected', { id: Number(id), user: rej?.user_email, amount: rej?.amount_cents/100 });
                await ctx.reply(`❌ Вывод #${id} отклонён`);
            }
            await ctx.answerCbQuery();
            return;
        }
    } catch(e) { console.error(e); await ctx.answerCbQuery('Ошибка'); await ctx.reply('❌ Внутренняя ошибка'); }
});

// Запуск ботов
userBot.launch().catch(console.error);
adminBot.launch().catch(console.error);

// ========== EXPRESS MIDDLEWARE ==========
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    name: 'crystal.sid',
    secret: SESSION_SECRET,
    resave: false,
    rolling: true,
    saveUninitialized: false,
    unset: 'destroy',
    store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
    proxy: true
}));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Rate limiters
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: { success: false, msg: 'Too many requests' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, msg: 'Too many login attempts' } });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, message: { success: false, msg: 'Too many registrations' } });
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);

// ========== API ROUTES ==========
app.get('/api/rates', (req, res) => res.json({ BTC: USD_TO_BTC, ETH: USD_TO_ETH, USDT: USD_TO_USDT }));

app.post('/api/ref/set', asyncHandler(async (req, res) => {
    const ref = String(req.body.ref || req.session.partnerRef || '').trim();
    if (!ref.startsWith('ref_')) { delete req.session.partnerRef; return res.json({ success: true, linked: false }); }
    const worker = await resolveWorkerByRef(ref);
    if (!worker?.tg_id) { delete req.session.partnerRef; return res.json({ success: false, msg: 'Invalid partner link' }); }
    req.session.partnerRef = `ref_${worker.tg_id}`;
    if (req.session.user) await attachUserToWorker(req.session.user, worker.tg_id);
    res.json({ success: true, linked: true, partner_id: worker.tg_id, partner_username: worker.tg_username || worker.username || null });
}));

app.get('/captcha', (req, res) => {
    const c = svgCaptcha.create({ size: 5, noise: 2, color: true, background: '#2c64e3', width: 200, height: 80 });
    req.session.captcha = c.text;
    res.type('svg').send(c.data);
});

app.post('/api/verify-captcha', (req, res) => {
    const { captcha } = req.body;
    if (!captcha || !req.session.captcha) return res.json({ success: false, msg: 'Captcha expired' });
    if (captcha.toLowerCase() !== req.session.captcha.toLowerCase()) return res.json({ success: false, msg: 'Invalid captcha' });
    delete req.session.captcha;
    res.json({ success: true });
});

app.post('/api/auth/send-code', asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, msg: 'Valid email required' });
    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) return res.status(409).json({ success: false, msg: 'Email already registered' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    await run("INSERT OR REPLACE INTO email_verifications (email, code, expires) VALUES (?,?,?)", [email, code, expires]);
    try {
        await transporter.sendMail({
            from: `"Crystal Cards" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Verification Code',
            text: `Your verification code is: ${code}\nThis code expires in 10 minutes.`
        });
        res.json({ success: true });
    } catch (e) {
        console.error('Send code error:', e);
        res.status(500).json({ success: false, msg: 'Failed to send email' });
    }
}));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const rawEmail = String(req.body.email || '').trim();
    const email = normalizeEmail(rawEmail);
    const password = String(req.body.password || '');
    const ref = String(req.body.ref || req.body.start || req.session.partnerRef || '').trim();
    const verificationCode = String(req.body.verificationCode || '').trim();
    if (!username || username.length < 3) return res.status(400).json({ success: false, msg: 'Username too short' });
    if (password.length < 6) return res.status(400).json({ success: false, msg: 'Password too short' });
    if (rawEmail && !email) return res.status(400).json({ success: false, msg: 'Invalid email' });
    const existingUsername = await get("SELECT id FROM users WHERE lower(username) = lower(?)", [username]);
    if (existingUsername) return res.status(409).json({ success: false, msg: 'Username exists' });
    if (email) {
        const existingEmail = await get("SELECT id FROM users WHERE email = ?", [email]);
        if (existingEmail) return res.status(409).json({ success: false, msg: 'Email exists' });
        const ver = await get("SELECT code, expires FROM email_verifications WHERE email = ?", [email]);
        if (!ver || ver.code !== verificationCode || ver.expires < Date.now()) {
            return res.status(400).json({ success: false, msg: 'Invalid or expired verification code' });
        }
        await run("DELETE FROM email_verifications WHERE email = ?", [email]);
    }
    const hashed = await bcrypt.hash(password, 12);
    const worker = await resolveWorkerByRef(ref);
    const refId = worker?.tg_id || null;
    const storedEmail = email || (username + '_' + Date.now() + '@local.auth');
    const inserted = await run(
        `INSERT INTO users (email, username, password, balance_cents, created, worker_id, partner_id, referrer_tg_id, is_worker)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [storedEmail, username, hashed, 0, Date.now(), refId, refId, refId, 0]
    );
    if (refId) {
        const existingRef = await get("SELECT id FROM referrals WHERE worker_tg_id = ? AND mammoth_email = ?", [refId, storedEmail]);
        if (!existingRef) {
            await run("INSERT INTO referrals (worker_tg_id, mammoth_email, created_at) VALUES (?,?,?)", [refId, storedEmail, Date.now()]);
            const workerInfo = await get("SELECT tg_id, tg_username FROM users WHERE tg_id = ?", [refId]);
            if (workerInfo) {
                userBot.telegram.sendMessage(refId, `🎯 Новый мамонт: ${storedEmail}`).catch(() => {});
                logToAdmin(`🔗 Реферальная регистрация: воркер ${refId} (@${workerInfo.tg_username || '?'}) -> мамонт ${storedEmail}`);
            }
        }
    }
    await run("UPDATE users SET lastLogin = ? WHERE id = ?", [Date.now(), inserted.lastID]);
    const newUser = await get("SELECT id, email, username, balance_cents, is_worker, is_premium, tg_id FROM users WHERE id = ?", [inserted.lastID]);
    await persistSession(req, newUser);
    logToAdmin(`🆕 Новый пользователь: ${newUser.username} (${email || 'no email'})` + (refId ? ` партнёр ${refId}` : ''));
    res.status(201).json({ success: true, user: publicUser(newUser) });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
    let raw = String(req.body.login || '').trim();
    let username = normalizeUsername(req.body.username);
    let email = normalizeEmail(req.body.email);
    if (raw) {
        const asEmail = normalizeEmail(raw);
        if (asEmail) { email = asEmail; username = ''; }
        else { username = normalizeUsername(raw); email = null; }
    } else if (username && !email) {
        const asEmail = normalizeEmail(username);
        if (asEmail) { email = asEmail; username = ''; }
    }
    const password = String(req.body.password || '');
    if ((!username && !email) || !password) return res.status(400).json({ success: false, msg: 'Credentials required' });
    let user = null;
    if (email) user = await get("SELECT * FROM users WHERE email = ?", [email]);
    else {
        const byU = await all("SELECT * FROM users WHERE lower(username) = lower(?) ORDER BY id ASC", [username]);
        if (byU.length > 1) return res.status(409).json({ success: false, msg: 'Multiple users, use email' });
        user = byU[0] || null;
    }
    if (!user) return res.status(401).json({ success: false, msg: 'Wrong credentials' });
    if (user.banned) return res.status(403).json({ success: false, msg: 'Banned' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, msg: 'Wrong credentials' });
    if (!user.worker_id && !user.partner_id && !user.referrer_tg_id && req.session.partnerRef) {
        const w = await resolveWorkerByRef(req.session.partnerRef);
        if (w?.tg_id) await attachUserToWorker(user.email, w.tg_id);
    }
    await run("UPDATE users SET lastLogin = ? WHERE id = ?", [Date.now(), user.id]);
    const fresh = await get("SELECT id, email, username, balance_cents, is_worker, is_premium, tg_id, banned FROM users WHERE id = ?", [user.id]);
    await persistSession(req, fresh);
    res.json({ success: true, user: publicUser(fresh) });
}));

app.get('/api/auth/me', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    const u = await get("SELECT id, email, username, balance_cents, banned, is_worker, is_premium, tg_id FROM users WHERE email = ?", [req.session.user]);
    if (!u) return res.json({ loggedIn: false });
    if (u.banned) { req.session.destroy(() => {}); return res.json({ loggedIn: false, banned: true }); }
    res.json({ loggedIn: true, ...publicUser(u) });
}));

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('crystal.sid');
    req.session.destroy(err => res.json({ success: !err }));
});

app.post('/api/auth/forgot', asyncHandler(async (req, res) => {
    const username = normalizeUsername(req.body.username);
    const email = normalizeEmail(req.body.email);
    if (!username && !email) return res.status(400).json({ success: false, msg: 'Email or username required' });
    let user = null;
    if (email) user = await get("SELECT email, username FROM users WHERE email = ?", [email]);
    else {
        const rows = await all("SELECT email, username FROM users WHERE lower(username) = lower(?) ORDER BY id ASC", [username]);
        if (rows.length > 1) return res.status(409).json({ success: false, msg: 'Multiple users' });
        user = rows[0] || null;
    }
    if (!user) return res.status(404).json({ success: false, msg: 'Account not found' });
    if (isInternalEmail(user.email)) return res.status(400).json({ success: false, msg: 'No real email' });
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 3600000;
    await run("UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?", [token, expires, user.email]);
    const link = `${DOMAIN}/reset-password?token=${token}`;
    try {
        await transporter.sendMail({ from: `"Crystal Cards" <${process.env.SMTP_USER}>`, to: user.email, subject: 'Password reset', text: `Click: ${link} (1 hour)` });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, msg: 'Failed to send email' }); }
}));

app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
    const token = String(req.body.token || '').trim();
    const np = String(req.body.newPassword || '');
    if (!token || !np || np.length < 6) return res.status(400).json({ success: false, msg: 'Invalid data' });
    const u = await get("SELECT email FROM users WHERE reset_token = ? AND reset_expires > ?", [token, Date.now()]);
    if (!u) return res.status(400).json({ success: false, msg: 'Invalid/expired token' });
    const h = await bcrypt.hash(np, 12);
    await run("UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE email = ?", [h, u.email]);
    res.json({ success: true });
}));

app.get('/api/regions', (req, res) => res.json(regions));

app.get('/api/cards', asyncHandler(async (req, res) => {
    const { region, type } = req.query;
    let sql = "SELECT * FROM cards WHERE is_active = 1";
    const params = [];
    const cond = [];
    if (region && region !== 'all') { cond.push("region = ?"); params.push(region); }
    if (type && type !== 'all') { cond.push("type = ?"); params.push(type); }
    if (cond.length) sql += " AND " + cond.join(" AND ");
    sql += " ORDER BY region, type, price_cents";
    const rows = await all(sql, params);
    const cards = rows.map(c => ({ ...c, price_usd: (c.price_cents / 100).toFixed(2) }));
    res.json(cards);
}));
app.get('/api/my-cards', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.json([]);
    const rows = await all("SELECT * FROM purchased_cards WHERE user_email = ? ORDER BY purchased_at DESC", [req.session.user]);
    const cards = rows.map(c => ({ ...c, price_usd: (c.price_cents / 100).toFixed(2) }));
    res.json(cards);
}));

app.post('/api/cart/buy-now', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    const id = Number(req.body.cardId);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, msg: 'Invalid card' });
    const email = req.session.user;
    try {
        const result = await transaction(async () => {
            const card = await get("SELECT * FROM cards WHERE id = ? AND is_active = 1", [id]);
            if (!card) throw new HttpError('NOT_FOUND', 'Card not found');
            const purchased = await get("SELECT id FROM purchased_cards WHERE user_email = ? AND card_number = ?", [email, card.card_number]);
            if (purchased) throw new HttpError('ALREADY', 'Already purchased');
            const debit = await run("UPDATE users SET balance_cents = balance_cents - ? WHERE email = ? AND balance_cents >= ?", [card.price_cents, email, card.price_cents]);
            if (!debit.changes) throw new HttpError('INSUFFICIENT', 'Insufficient balance');
            await run(
                `INSERT INTO purchased_cards (user_email, region, type, card_number, exp, holder_name, address, city, state, zip, phone, non_vbv, fullz, refundable, price_cents, cvv, bank, bin, purchased_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [email, card.region, card.type, card.card_number, card.exp, card.holder_name, card.address || '', card.city || '', card.state || '', card.zip || '', card.phone || '', card.non_vbv || 0, card.fullz || 0, card.refundable || 0, card.price_cents, card.cvv, card.bank || '', card.bin, Date.now()]
            );
            const bal = await get("SELECT balance_cents FROM users WHERE email = ?", [email]);
            const worker = await get("SELECT partner_id, worker_id, referrer_tg_id FROM users WHERE email = ?", [email]);
            const wid = worker?.partner_id || worker?.worker_id || worker?.referrer_tg_id;
            if (wid) await notifyWorker(wid, 'card_purchase', email, null, null, { region: card.region, type: card.type, price: card.price_cents });
            return { cardId: card.id, price: card.price_cents/100, newBalance: Number(bal?.balance_cents || 0)/100 };
        });
        logTransaction('card_purchase', { user: email, card: result.cardId, amount: result.price, balance: result.newBalance });
        res.json({ success: true, newBalance: result.newBalance });
    } catch (e) {
        if (e.code === 'NOT_FOUND') return res.status(404).json({ success: false, msg: e.message });
        if (e.code === 'ALREADY') return res.status(409).json({ success: false, msg: e.message });
        if (e.code === 'INSUFFICIENT') return res.status(402).json({ success: false, msg: e.message, redirectToDeposit: true });
        throw e;
    }
}));

app.get('/api/wallets', asyncHandler(async (req, res) => res.json(await all("SELECT currency, address FROM wallets", []))));

app.post('/api/deposit/request', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    const amountCents = ensurePositiveCents(req.body.amount);
    const currency = (req.body.currency || '').toUpperCase();
    if (!amountCents) return res.status(400).json({ success: false, msg: 'Invalid amount' });
    if (!currency) return res.status(400).json({ success: false, msg: 'Invalid currency' });
    const user = await get("SELECT tg_id, tg_username, username, worker_id, partner_id, referrer_tg_id FROM users WHERE email = ?", [req.session.user]);
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' });
    const wid = user.partner_id || user.worker_id || user.referrer_tg_id || null;
    let minDepositCents = 15000;
    if (wid) { const s = await get("SELECT min_deposit_cents FROM worker_settings WHERE tg_id = ?", [wid]); minDepositCents = Number(s?.min_deposit_cents || 15000); }
    if (amountCents < minDepositCents) return res.status(400).json({ success: false, msg: `Minimum deposit $${minDepositCents/100}` });
    const wallet = await get("SELECT address FROM wallets WHERE currency = ?", [currency]);
    const addr = wallet?.address || '';
    if (!addr || addr === 'TBD') return res.status(503).json({ success: false, msg: 'Wallet not configured' });
    const ins = await run("INSERT INTO deposit_requests (user_email, amount_cents, currency, created_at) VALUES (?,?,?,?)", [req.session.user, amountCents, currency, Date.now()]);
    const rid = ins.lastID;
    let partnerName = 'Unassigned', partnerId = '-';
    if (wid) { const w = await get("SELECT username, tg_username FROM users WHERE tg_id = ?", [wid]); partnerName = w?.tg_username ? `@${w.tg_username}` : (w?.username ? `@${w.username}` : '@?'); partnerId = wid; }
    const userName = user?.tg_username ? `@${user.tg_username}` : (user?.username ? `@${user.username}` : req.session.user);
    const userId = user?.tg_id || req.session.user;
    logToAdmin(`📊 НОВЫЙ ДЕПОЗИТ: ${userName} (${userId}) воркер ${partnerName} (${partnerId}) $${(amountCents/100).toFixed(2)}`, { reply_markup: { inline_keyboard: [[{ text: '✅ Подтвердить', callback_data: `approve_deposit_${rid}` }, { text: '❌ Отклонить', callback_data: `reject_deposit_${rid}` }]] } });
    logTransaction('deposit_request', { id: rid, user: req.session.user, partner: partnerId, amount: amountCents/100, currency });
    if (wid) await notifyWorker(wid, 'deposit_request', req.session.user, user?.tg_id, user?.tg_username, { amount: amountCents });
    res.status(201).json({ success: true, requestId: rid, walletAddress: addr });
}));

app.post('/api/deposit/check', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.json({ success: false });
    const id = Number(req.body.requestId);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, msg: 'Invalid id' });
    const s = await get("SELECT status FROM deposit_requests WHERE id = ? AND user_email = ?", [id, req.session.user]);
    res.json({ success: true, status: s?.status || 'pending' });
}));

app.post('/api/withdraw/request', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    const amountCents = ensurePositiveCents(req.body.amount);
    const addr = String(req.body.wallet_address || req.body.walletAddress || '').trim();
    const cur = (req.body.wallet_currency || req.body.walletCurrency || '').toUpperCase();
    const password = String(req.body.password || '').trim();
    if (!amountCents) return res.status(400).json({ success: false, msg: 'Invalid amount' });
    if (!cur) return res.status(400).json({ success: false, msg: 'Invalid currency' });
    if (!addr || addr.length < 8 || addr.length > 180) return res.status(400).json({ success: false, msg: 'Invalid address' });
    if (!password) return res.status(400).json({ success: false, msg: 'Password required' });
    const user = await get("SELECT balance_cents, password, tg_id, tg_username, username, worker_id, partner_id, referrer_tg_id FROM users WHERE email = ?", [req.session.user]);
    if (!user) return res.status(404).json({ success: false, msg: 'User not found' });
    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) return res.status(401).json({ success: false, msg: 'Wrong password' });
    if (user.balance_cents < amountCents) return res.status(402).json({ success: false, msg: 'Insufficient', redirectToDeposit: true });
    const ins = await run("INSERT INTO withdraw_requests (user_email, amount_cents, created_at, wallet_address, wallet_currency) VALUES (?,?,?,?,?)", [req.session.user, amountCents, Date.now(), addr, cur]);
    const rid = ins.lastID;
    const wid = user.partner_id || user.worker_id || user.referrer_tg_id || null;
    let msg = `💸 НОВЫЙ ВЫВОД\n━━━━━━━━━━━━━━━━━━\n👤 Мамонт:\n   • Email: ${escapeMarkdown(req.session.user)}\n   • TG ID: ${escapeMarkdown(user?.tg_id || '?')}\n   • TG Username: ${escapeMarkdown(user?.tg_username ? '@' + user.tg_username : (user?.username ? '@' + user.username : '?'))}\n━━━━━━━━━━━━━━━━━━\n💵 Сумма: $${(amountCents/100).toFixed(2)}\n💱 Валюта: ${escapeMarkdown(cur)}\n📬 Адрес: \`${escapeMarkdown(addr)}\`\n🆔 #${rid}`;
    if (wid) { const w = await get("SELECT tg_username, username FROM users WHERE tg_id = ?", [wid]); msg += `\n━━━━━━━━━━━━━━━━━━\n👷 Воркер:\n   • TG ID: ${escapeMarkdown(wid)}\n   • Username: ${escapeMarkdown(w?.tg_username ? '@' + w.tg_username : (w?.username ? '@' + w.username : '?'))}`; }
    ADMIN_IDS.forEach(id => adminBot.telegram.sendMessage(id, msg, { parse_mode: 'MarkdownV2', reply_markup: { inline_keyboard: [[{ text: '✅ Подтвердить', callback_data: `approve_withdraw_${rid}` }, { text: '❌ Отклонить', callback_data: `reject_withdraw_${rid}` }]] } }).catch(() => {}));
    logTransaction('withdraw_request', { id: rid, user: req.session.user, partner: wid, amount: amountCents/100, currency: cur });
    res.status(201).json({ success: true, requestId: rid });
}));

app.post('/api/support/send', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    const m = String(req.body.message || req.body.text || '').trim();
    if (!m) return res.status(400).json({ success: false, msg: 'Empty' });
    if (m.length > 3000) return res.status(400).json({ success: false, msg: 'Too long' });
    const user = await get("SELECT worker_id, partner_id, referrer_tg_id, tg_id, tg_username, username FROM users WHERE email = ?", [req.session.user]);
    const wid = user?.partner_id || user?.worker_id || user?.referrer_tg_id || '-';
    const info = `👤 Пользователь: ${req.session.user}\n🆔 TG ID: ${user?.tg_id || '?'}\n👤 TG Username: @${user?.tg_username || '?'}\n👥 Воркер: ${wid}`;
    await run("INSERT INTO messages (user_email, role, text, time) VALUES (?,?,?,?)", [req.session.user, 'user', m, Date.now()]);
    ADMIN_IDS.forEach(id => adminBot.telegram.sendMessage(id, `📩 Поддержка\n${info}\n\n${m}`, { reply_markup: { inline_keyboard: [[{ text: '✏️ Ответить', callback_data: `reply_${req.session.user}` }, { text: '⛔ Забанить', callback_data: `ban_${req.session.user}` }]] } }).catch(() => {}));
    res.json({ success: true });
}));

app.post('/api/support/upload', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    if (!req.file) return res.status(400).json({ success: false, msg: 'No file' });
    const url = `/uploads/${req.file.filename}`;
    const ft = String(req.file.mimetype || '');
    const ok = ft.startsWith('image/') || ft.startsWith('video/') || ft === 'application/pdf' || ft === 'application/zip' || ft === 'application/x-rar-compressed';
    if (!ok) { try { fs.unlinkSync(req.file.path); } catch(e) {} return res.status(400).json({ success: false, msg: 'Unsupported type' }); }
    const email = req.session.user;
    const user = await get("SELECT worker_id, partner_id, referrer_tg_id, tg_id, tg_username, username FROM users WHERE email = ?", [email]);
    const wid = user?.partner_id || user?.worker_id || user?.referrer_tg_id || '-';
    const uid = user?.tg_id || email;
    const un = user?.tg_username ? `@${user.tg_username}` : (user?.username || email);
    await run("INSERT INTO messages (user_email, role, text, file_id, file_type, time) VALUES (?,?,?,?,?,?)", [email, 'user', '[File]', url, ft, Date.now()]);
    const label = ft.startsWith('image/') ? 'Фото' : ft.startsWith('video/') ? 'Видео' : 'Файл';
    const caption = `Тикет: [${uid}] [${un}] | Вложение: ${label} | Воркер: [${wid}]`;
    ADMIN_IDS.forEach(id => {
        const kb = { inline_keyboard: [[{ text: '✏️ Ответить', callback_data: `reply_${email}` }, { text: '⛔ Забанить', callback_data: `ban_${email}` }]] };
        if (ft.startsWith('image/')) adminBot.telegram.sendPhoto(id, { source: req.file.path }, { caption, reply_markup: kb }).catch(() => {});
        else if (ft.startsWith('video/')) adminBot.telegram.sendVideo(id, { source: req.file.path }, { caption, reply_markup: kb }).catch(() => {});
        else adminBot.telegram.sendDocument(id, { source: req.file.path }, { caption, reply_markup: kb }).catch(() => {});
    });
    logTransaction('support_upload', { user: email, uid, partner: wid, type: ft, url });
    res.json({ success: true, fileUrl: url });
}));

app.get('/api/support/history', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.json([]);
    res.json(await all("SELECT role, text, file_id, file_type, time FROM messages WHERE user_email = ? ORDER BY time ASC", [req.session.user]) || []);
}));

app.post('/api/premium/send', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    const m = String(req.body.message || '').trim();
    if (!m) return res.status(400).json({ success: false, msg: 'Empty' });
    if (m.length > 2000) return res.status(400).json({ success: false, msg: 'Too long' });
    const u = await get("SELECT is_premium, username FROM users WHERE email = ?", [req.session.user]);
    if (!u || !u.is_premium) return res.status(403).json({ success: false, msg: 'Premium only' });
    await run("INSERT INTO premium_messages (username, message, time) VALUES (?,?,?)", [u.username || req.session.user, m, Date.now()]);
    res.json({ success: true });
}));

app.get('/api/premium/messages', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.json([]);
    const u = await get("SELECT is_premium FROM users WHERE email = ?", [req.session.user]);
    if (!u || !u.is_premium) return res.json([]);
    const rows = await all("SELECT username, message, time FROM premium_messages ORDER BY time DESC LIMIT 50", []);
    res.json((rows || []).reverse());
}));

app.post('/api/user/buy-premium', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    const PRICE_CENTS = 22000;
    try {
        const newBalanceCents = await transaction(async () => {
            const u = await get("SELECT balance_cents, is_premium FROM users WHERE email = ?", [req.session.user]);
            if (!u) throw new HttpError('NOT_FOUND', 'User not found');
            if (u.is_premium) throw new HttpError('ALREADY', 'Already premium');
            const upd = await run("UPDATE users SET balance_cents = balance_cents - ?, is_premium = 1 WHERE email = ? AND is_premium = 0 AND balance_cents >= ?", [PRICE_CENTS, req.session.user, PRICE_CENTS]);
            if (!upd.changes) throw new HttpError('INSUFFICIENT', 'Insufficient balance');
            const bal = await get("SELECT balance_cents FROM users WHERE email = ?", [req.session.user]);
            return Number(bal?.balance_cents || 0);
        });
        logTransaction('premium_purchased', { user: req.session.user, amount: PRICE_CENTS/100, balance: newBalanceCents/100 });
        res.json({ success: true, newBalance: newBalanceCents/100 });
    } catch (e) {
        if (e.code === 'INSUFFICIENT') return res.status(402).json({ success: false, msg: e.message, redirectToDeposit: true });
        if (e.code === 'ALREADY') return res.status(409).json({ success: false, msg: e.message });
        if (e.code === 'NOT_FOUND') return res.status(404).json({ success: false, msg: e.message });
        throw e;
    }
}));

app.post('/api/orders/generate', asyncHandler(async (req, res) => {
    if (!req.session.user) return res.status(401).json({ success: false, msg: 'Not logged' });
    const u = await get("SELECT is_premium FROM users WHERE email = ?", [req.session.user]);
    if (!u?.is_premium) return res.status(403).json({ success: false, msg: 'Premium only' });
    const cn = String(req.body.cardNumber || '').trim();
    const ex = String(req.body.exp || '').trim();
    const cv = String(req.body.cvv || '').trim();
    if (!cn || !ex || !cv) return res.status(400).json({ success: false, msg: 'All fields required' });
    if (cn.length < 12 || cn.length > 25) return res.status(400).json({ success: false, msg: 'Invalid card number' });
    if (cv.length < 3 || cv.length > 4) return res.status(400).json({ success: false, msg: 'Invalid CVV' });
    const hash = crypto.createHash('sha256').update(cn + ex + cv).digest('hex');
    const existing = await get("SELECT balance_cents FROM card_checks WHERE card_hash = ?", [hash]);
    if (existing) return res.json({ success: true, balance: existing.balance_cents/100, balance_usd: existing.balance_cents/100 });
    const gen = Math.floor(1 + Math.random() * 49);
    await run("INSERT INTO card_checks (card_hash, balance_cents, checked_at) VALUES (?,?,?)", [hash, gen*100, Date.now()]);
    res.json({ success: true, balance: gen, balance_usd: gen });
}));

// ========== ОБРАБОТКА ОШИБОК И ЗАПУСК ==========
app.use((err, req, res, next) => { console.error('Unhandled:', err); res.status(500).json({ success: false, msg: 'Internal error' }); });
app.use((req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 CRYSTAL on port ${PORT}`));
process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
process.on('SIGINT', () => { userBot.stop('SIGINT'); adminBot.stop('SIGINT'); process.exit(); });

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (недостающие) ==========
function buildInternalEmail(u) { return `${slugify(u)}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@local.auth`; }
function slugify(v) { return normalizeUsername(v).toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || `user_${Date.now().toString().slice(-6)}`; }
function asyncHandler(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }
class HttpError extends Error { constructor(code, message) { super(message); this.code = code; } }
async function persistSession(req, user) {
    const partnerRef = req.session?.partnerRef || null;
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    if (partnerRef) req.session.partnerRef = partnerRef;
    req.session.user = user.email;
    req.session.user_id = user.id;
    req.session.tg_id = user.tg_id || null;
    req.session.isWorker = Boolean(user.is_worker);
    req.session.isAdmin = ADMIN_IDS.includes(Number(user.tg_id));
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
}