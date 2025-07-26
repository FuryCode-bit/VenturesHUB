// routes/auth/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../db'); // Navigate up two levels to get to db.js

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    if (!fullName || !email || !password || !role) return res.status(400).json({ message: 'Please provide all fields.' });
    if (!['entrepreneur', 'vc'].includes(role)) return res.status(400).json({ message: 'Invalid role.' });

    const conn = await pool.getConnection();
    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      conn.release();
      return res.status(409).json({ message: 'User already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await conn.query('INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)', [fullName, email, passwordHash, role]);
    conn.release();
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Please provide email and password.' });

    const conn = await pool.getConnection();
    const [users] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    conn.release();
    
    const user = users[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    const payload = { user: { id: user.id, email: user.email, role: user.role } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role, walletAddress: user.wallet_address }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;