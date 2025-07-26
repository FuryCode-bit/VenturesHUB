// scripts/reset-and-seed.js
const mysql = require('mysql2/promise');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs'); // <-- ADD THIS IMPORT
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// --- Configuration ---
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
};

const usersToSeed = [
  { fullName: 'founder1', email: 'founder1@teste.com', role: 'entrepreneur' },
  { fullName: 'founder2', email: 'founder2@teste.com', role: 'entrepreneur' },
  { fullName: 'investor1', email: 'investor1@teste.com', role: 'vc' },
  { fullName: 'investor2', email: 'investor2@teste.com', role: 'vc' },
];

const commonPassword = 'teste123';

/**
 * Seeds the users table with predefined data.
 * @param {mysql.Connection} connection - An active mysql2 connection object.
 */
async function seedUsers(connection) {
  console.log('\n🌱 Seeding users...');
  
  // Hash the password once to be used for all users
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(commonPassword, salt);
  
  const query = 'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)';

  for (const user of usersToSeed) {
    try {
      await connection.query(query, [user.fullName, user.email, passwordHash, user.role]);
      console.log(`   ✅ User '${user.email}' created.`);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        console.warn(`   ⚠️  User '${user.email}' already exists. Skipping.`);
      } else {
        throw error; // Rethrow other errors to fail the script
      }
    }
  }

  console.log('🎉 User seeding complete!');
}


/**
 * Main function to reset the database and then seed it.
 */
async function resetAndSeedDatabase() {
  let connection;
  try {
    // Connect to the database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to the database.');

    // Warn the user
    console.warn('\n⚠️  WARNING: This will permanently delete all data in the database.');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // --- Step 1: Reset the Schema ---
    console.log('\n🔄 Reading schema.sql file...');
    const schemaSql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf-8');

    console.log('🚀 Executing schema... Dropping old tables and creating new ones...');
    await connection.query(schemaSql);
    console.log('   Database schema reset successfully!');
    
    // --- Step 2: Seed the Users ---
    // We call the seeder function here, passing the active connection.
    await seedUsers(connection);

    console.log('\n\n✨ --- Database setup complete! --- ✨');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    // Ensure the connection is always closed
    if (connection) {
      await connection.end();
      console.log('\n👋 Connection closed.');
    }
  }
}

// Run the entire process
resetAndSeedDatabase();