// routes/investments/investments.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const { ethers } = require('ethers');

router.post('/record', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { ventureId } = req.body;

    if (!ventureId) {
        return res.status(400).json({ message: 'Venture ID is required.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();

        const [existing] = await conn.query(
            'SELECT id FROM investments WHERE user_id = ? AND venture_id = ?',
            [userId, ventureId]
        );

        // If no record exists, create one. We store '0' for shares_owned because
        // the true balance will always be fetched live from the blockchain.
        // This table's only job is to know THAT a user has invested, not HOW MUCH they currently have.
        if (existing.length === 0) {
            await conn.query(
                'INSERT INTO investments (user_id, venture_id, shares_owned) VALUES (?, ?, ?)',
                [userId, ventureId, '0']
            );
            console.log(`Created investment link for user ${userId} in venture ${ventureId}.`);
        } else {
            console.log(`Investment link for user ${userId} in venture ${ventureId} already exists.`);
        }

        conn.release();
        res.status(200).json({ message: 'Investment event acknowledged.' });

    } catch (error) {
        if (conn) conn.release();
        console.error('Error recording investment link:', error);
        res.status(500).json({ message: 'Server error while recording investment link.' });
    }
});

module.exports = router;