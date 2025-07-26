// routes/users/users.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');

router.post('/link-wallet', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        const userId = req.user.id;

        if (!walletAddress) {
            return res.status(400).json({ message: 'Wallet address is required.' });
        }
        
        const conn = await pool.getConnection();
        await conn.query('UPDATE users SET wallet_address = ? WHERE id = ?', [walletAddress, userId]);
        conn.release();

        res.json({ message: 'Wallet linked successfully!' });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This wallet address is already linked to another account.' });
        }
        console.error('Link wallet error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;