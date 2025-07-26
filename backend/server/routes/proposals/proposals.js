// routes/proposals/proposals.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const { ethers } = require('ethers');
const SaleTreasuryABI = require('../../abis/SaleTreasury.json');
const VentureDAOABI = require('../../abis/VentureDAO.json');

router.post('/create', authMiddleware, async (req, res) => {
    const { ventureId, title, description, proposalType } = req.body;
    const dbProposerId = req.user.id;

    if (!ventureId || !title || !description || !proposalType) {
        return res.status(400).json({ message: 'Missing required fields for proposal.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const [ventures] = await conn.query('SELECT dao_address, sale_treasury_address FROM ventures WHERE id = ?', [ventureId]);
        if (ventures.length === 0) throw new Error('Venture not found.');
        const { dao_address, sale_treasury_address } = ventures[0];

        // The backend operator pays the gas and submits the proposal.
        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);
        const operatorWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const daoContract = new ethers.Contract(dao_address, VentureDAOABI, operatorWallet);

        let targets = [], values = [], calldatas = [];
        const fullDescription = `Title: ${title}\n\n${description}`;

        if (proposalType === 'distribute_funds') {
            const saleTreasuryInterface = new ethers.Interface(SaleTreasuryABI);
            targets = [sale_treasury_address];
            values = ["0"];
            calldatas = [saleTreasuryInterface.encodeFunctionData("distributeFunds")];
        } else {
            // For a simple text proposal, the target can be the DAO itself with no action.
            targets = [dao_address];
            values = ["0"];
            calldatas = ["0x"];
        }

        console.log(`Relaying proposal from backend operator...`);

        // The backend's operatorWallet becomes the official "proposer" on-chain.
        const tx = await daoContract.propose(
            targets,
            values,
            calldatas,
            fullDescription
        );

        const receipt = await tx.wait();
        console.log('Transaction confirmed. Parsing event...');

        const eventTopic = daoContract.interface.getEvent('ProposalCreated').topicHash;
        const log = receipt.logs.find(x => x.topics[0] === eventTopic);
        if (!log) throw new Error("ProposalCreated event log not found.");
        
        const parsedLog = daoContract.interface.parseLog(log);
        const onchainProposer = parsedLog.args.proposer;
        console.log(`\n✅ Proposal Created! On-Chain Proposer: ${onchainProposer}`);
        
        await conn.query(
            'INSERT INTO proposals (venture_id, proposer_id, proposal_onchain_id, title, description, targets, `values`, calldatas) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ventureId, dbProposerId, parsedLog.args.proposalId.toString(), title, fullDescription, JSON.stringify(targets), JSON.stringify(values), JSON.stringify(calldatas)]
        );

        conn.release();
        res.status(201).json({ message: 'Proposal submitted successfully!', transactionHash: tx.hash });

    } catch (error) {
        if (conn) conn.release();
        console.error('Proposal relay error:', error);
        res.status(500).json({ message: 'Server failed to relay proposal.', details: error.reason || error.message });
    }
});


module.exports = router;