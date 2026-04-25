#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Crystal Cards Backend Setup\n');

// Check Node version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

if (majorVersion < 18) {
  console.error('❌ Node.js version 18 or higher is required');
  console.error(`   Current version: ${nodeVersion}`);
  process.exit(1);
}

console.log('✅ Node.js version check passed');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found');
  console.log('   Creating from .env.example...');

  const envExamplePath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created');
    console.log('   ⚠️  Please edit .env and add your configuration');
  } else {
    console.error('❌ .env.example not found');
    process.exit(1);
  }
}

// Create necessary directories
const dirs = ['logs', 'uploads', 'dist'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created ${dir}/ directory`);
  }
});

// Check if database exists
const dbPath = path.join(__dirname, '..', 'database.db');
if (!fs.existsSync(dbPath)) {
  console.log('⚠️  database.db not found');
  console.log('   The database will be created on first run');
}

console.log('\n✅ Setup complete!\n');
console.log('Next steps:');
console.log('1. Edit .env file with your configuration');
console.log('2. Run: npm run build');
console.log('3. Run: npm start');
console.log('\nFor development: npm run dev\n');
