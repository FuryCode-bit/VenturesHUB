// scripts/seed-users.js
const bcrypt = require('bcryptjs');
const pool = require('../db'); // Adjust the path if your script is located elsewhere
require('dotenv').config(); // Ensures environment variables are loaded

// --- Configuration ---
const usersToCreate = [
  { fullName: 'founder1', email: 'founder1@teste.com', role: 'entrepreneur' },
  { fullName: 'founder2', email: 'founder2@teste.com', role: 'entrepreneur' },
  { fullName: 'investor1', email: 'investor1@teste.com', role: 'vc' },
  { fullName: 'investor2', email: 'investor2@teste.com', role: 'vc' },
];

const commonPassword = 'test123';

// --- Main Script Logic ---
async function seedUsers() {
  let conn;
  console.log('🌱 Starting user seeding script...');

  try {
    // Hash the password once to be used for all users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(commonPassword, salt);
    console.log(`🔑 Password hashed successfully.`);

    conn = await pool.getConnection();
    console.log('🗄️  Database connection established.');

    // Use a for...of loop to handle async operations correctly
    for (const user of usersToCreate) {
      try {
        await conn.query(
          'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [user.fullName, user.email, passwordHash, user.role]
        );
        console.log(`✅ User '${user.email}' created successfully.`);
      } catch (error) {
        // Handle cases where the user might already exist
        if (error.code === 'ER_DUP_ENTRY') {
          console.warn(`⚠️  User '${user.email}' already exists. Skipping.`);
        } else {
          // Throw other errors to be caught by the outer catch block
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('❌ An error occurred during the seeding process:', error);
    process.exit(1); // Exit with an error code
  } finally {
    // Ensure the connection is always released
    if (conn) {
      conn.release();
      console.log('🗄️  Database connection released.');
    }
    // End the pool so the script doesn't hang
    await pool.end();
    console.log('🏁 Seeding script finished.');
  }
}

// Run the seeder
seedUsers();