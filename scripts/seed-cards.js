const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

const regions = ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Sweden'];
const types = ['Standard', 'Gold', 'Platinum', 'Business'];
const banks = {
  'USA': ['Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'Capital One', 'US Bank', 'PNC Bank'],
  'UK': ['Barclays', 'HSBC', 'Lloyds', 'NatWest', 'Santander UK', 'TSB Bank'],
  'Canada': ['RBC', 'TD Bank', 'Scotiabank', 'BMO', 'CIBC'],
  'Australia': ['Commonwealth', 'ANZ', 'Westpac', 'NAB', 'Macquarie'],
  'Germany': ['Deutsche Bank', 'Commerzbank', 'DZ Bank', 'HypoVereinsbank', 'Postbank'],
  'France': ['BNP Paribas', 'Crédit Agricole', 'Société Générale', 'Crédit Mutuel', 'La Banque Postale'],
  'Spain': ['Santander', 'BBVA', 'CaixaBank', 'Bankia', 'Sabadell'],
  'Italy': ['Intesa Sanpaolo', 'UniCredit', 'Banco BPM', 'Monte dei Paschi'],
  'Netherlands': ['ING', 'Rabobank', 'ABN AMRO', 'SNS Bank'],
  'Sweden': ['Swedbank', 'SEB', 'Nordea', 'Handelsbanken']
};
const typePrices = { 'Standard': [499, 2999], 'Gold': [1800, 5500], 'Platinum': [3500, 8000], 'Business': [20000, 50000] };
const firstNames = ['John', 'Emma', 'Michael', 'Sophia', 'David', 'Olivia', 'James', 'Isabella', 'Robert', 'Mia', 'William', 'Charlotte', 'Daniel', 'Amelia', 'Matthew', 'Harper', 'Joseph', 'Evelyn', 'Samuel', 'Abigail'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const totalCards = 500;
const batchSize = 100;
let inserted = 0;

function insertBatch() {
  const values = [];
  for (let i = 0; i < batchSize && inserted < totalCards; i++, inserted++) {
    const region = pick(regions);
    const type = pick(types);
    const [minP, maxP] = typePrices[type];
    const priceCents = rand(minP, maxP);
    const bin = String(rand(400000, 599999));
    const lastNine = String(rand(100000000, 999999999));
    const cardNumber = bin + lastNine;
    const expMonth = String(rand(1, 12)).padStart(2, '0');
    const expYear = rand(27, 31);
    const exp = `${expMonth}/${expYear}`;
    const holderName = `${pick(firstNames)} ${pick(lastNames)}`;
    const cvv = String(rand(100, 999));
    const bank = pick(banks[region] || ['Unknown Bank']);
    const now = Date.now() - (totalCards - inserted) * 1000;

    values.push(`(${priceCents},'${region}','${type}','${cardNumber}','${exp}','${holderName.replace(/'/g, "''")}','${cvv}','${bank.replace(/'/g, "''")}','${bin}',1,0,${now})`);
  }

  const sql =     `INSERT INTO cards (price_cents, region, type, card_number, exp, holder_name, cvv, bank, bin, is_active, is_sold, created_at) VALUES ${values.join(',')}`;
  db.run(sql, (err) => {
    if (err) {
      console.error('Insert error:', err.message);
      db.close();
      process.exit(1);
    }
    console.log(`  Inserted ${inserted}/${totalCards} cards`);
    if (inserted < totalCards) {
      insertBatch();
    } else {
      db.close();
      console.log('✅ Cards seeded successfully!');
    }
  });
}

console.log(`Seeding ${totalCards} cards...`);
insertBatch();
