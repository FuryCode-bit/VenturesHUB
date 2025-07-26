// routes/admin/admin.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const { ethers } = require('ethers');
const SaleTreasuryABI = require('../../abis/SaleTreasury.json');

router.post('/set-price', authMiddleware, async (req, res) => {
    const { ventureId, newPrice } = req.body;
    try {
        const conn = await pool.getConnection();
        const [ventures] = await conn.query('SELECT sale_treasury_address FROM ventures WHERE id = ?', [ventureId]);
        conn.release();
        if (!ventures[0]?.sale_treasury_address) return res.status(404).json({ message: 'Venture not found.' });
        
        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);
        const operatorWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const treasuryContract = new ethers.Contract(ventures[0].sale_treasury_address, SaleTreasuryABI, operatorWallet);
        
        const priceBN = ethers.parseUnits(newPrice, 6);
        const tx = await treasuryContract.setPriceByAdmin(priceBN);
        await tx.wait();
        
        res.status(200).json({ message: `Price updated for venture ${ventureId}` });
    } catch (error) {
        res.status(500).json({ message: 'Server error setting price.' });
    }
});

module.exports = router;