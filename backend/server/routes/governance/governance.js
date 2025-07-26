// routes/governance/governance.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const { ethers } = require('ethers');
const VentureDAOABI = require('../../abis/VentureDAO.json');


router.post('/vote-gasless', authMiddleware, async (req, res) => {
    const { ventureId, proposalId, support, v, r, s } = req.body;

    if (!ventureId || !proposalId || support === undefined || !v || !r || !s) {
        return res.status(400).json({ message: 'Missing required parameters for gasless voting.' });
    }

    try {
        const conn = await pool.getConnection();
        const [ventures] = await conn.query('SELECT dao_address FROM ventures WHERE id = ?', [ventureId]);
        conn.release();

        if (ventures.length === 0 || !ventures[0].dao_address) {
            throw new Error('DAO for this venture not found.');
        }
        const { dao_address } = ventures[0];

        // The backend operator wallet will pay the gas for the user.
        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);
        const operatorWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const daoContract = new ethers.Contract(dao_address, VentureDAOABI, operatorWallet);

        console.log(`Relaying gasless vote for proposal ${proposalId}...`);

        // The contract will use `ecrecover` to ensure the signature is valid and
        // that it comes from a legitimate token holder.
        const tx = await daoContract.castVoteBySigRaw(proposalId, support, v, r, s);

        await tx.wait();

        console.log(`Gasless vote relayed successfully. Tx Hash: ${tx.hash}`);

        res.status(200).json({
            message: 'Your vote has been successfully and freely cast on the blockchain!',
            transactionHash: tx.hash
        });

    } catch (error) {
        console.error('Gasless vote relay error:', error);
        res.status(500).json({ message: 'The server failed to relay your vote.', details: error.message || error.reason });
    }
});

module.exports = router;