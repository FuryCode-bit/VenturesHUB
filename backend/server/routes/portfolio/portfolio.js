// routes/portfolio/portfolio.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const { ethers } = require('ethers');
const VentureShareABI = require('../../abis/VentureShare.json');
const SaleTreasuryABI = require('../../abis/SaleTreasury.json');

router.get('/all', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    let conn;
    try {
        conn = await pool.getConnection();

        // Step 1: Get the user's wallet address.
        const [userRows] = await conn.query('SELECT wallet_address FROM users WHERE id = ?', [userId]);
        const userWalletAddress = userRows[0]?.wallet_address;

        if (!userWalletAddress) {
            conn.release();
            return res.json([]); // No wallet, no portfolio.
        }

        // Step 2: Get ALL ventures from the database. We will check the user's balance for each one.
        const [allVentures] = await conn.query('SELECT * FROM ventures');
        
        conn.release();

        if (allVentures.length === 0) {
            return res.json([]);
        }
        
        // Step 3: Iterate through every venture and check the user's on-chain balance.
        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);

        const hydratedPortfolio = await Promise.all(
            allVentures.map(async (venture) => {
            try {
                const shareContract = new ethers.Contract(venture.share_token_address, VentureShareABI, provider);
                const balance = await shareContract.balanceOf(userWalletAddress);

                if (balance === 0n) {
                    return null;
                }
                
                const treasuryContract = new ethers.Contract(venture.sale_treasury_address, SaleTreasuryABI, provider);
                const currentPrice = (await treasuryContract.pricePerShare()).toString();
                const valueBN = (balance * ethers.toBigInt(currentPrice)) / (10n ** 18n);

                return {
                    ...venture,
                    shares_owned: balance.toString(),
                    currentValue: valueBN.toString(),
                    currentPrice: currentPrice,
                    initialPrice: venture.initial_price_per_share, 
                };
            } catch (e) {
                console.error(`Could not hydrate portfolio item ${venture.name}:`, e.message);
                return null;
            }
        }));

        const finalPortfolio = hydratedPortfolio.filter(item => item !== null);

        res.json(finalPortfolio);

    } catch (error) {
        if (conn) conn.release();
        console.error('Error fetching full portfolio:', error);
        res.status(500).json({ message: 'Server error fetching full portfolio.' });
    }
});

module.exports = router;