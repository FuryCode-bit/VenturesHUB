// routes/ventures/ventures.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');
const { ethers } = require('ethers');
const multer = require('multer');
const { Readable } = require('stream');
const pinataSDK = require('@pinata/sdk');

// ... require all ABIs ...
const VentureFactoryABI = require('../../abis/VentureFactory.json');
const SaleTreasuryABI = require('../../abis/SaleTreasury.json')
const VentureDAOABI = require('../../abis/VentureDAO.json')
const VentureShareABI = require('../../abis/VentureShare.json')
const MockERC20ABI = require('../../abis/MockERC20.json')

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);

router.post('/create', [authMiddleware, multer({ storage: multer.memoryStorage() }).single('logo')], async (req, res) => {
    const { ventureName, industry, mission, teamInfo, fundraisingGoal, totalShares } = req.body;
    let conn;

    try {
        // --- Step 1: Validate Input and Pin to IPFS ---
        const logoFile = req.file;
        if (!ventureName || !industry || !mission || !fundraisingGoal || !totalShares || !logoFile) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }
        const readableStreamForFile = Readable.from(logoFile.buffer);
        const imageResult = await pinata.pinFileToIPFS(readableStreamForFile, { pinataMetadata: { name: `${ventureName}-logo` } });
        const imageUri = `ipfs://${imageResult.IpfsHash}`;
        
        const metadata = {
            name: ventureName,
            description: mission,
            image: imageUri,
            attributes: [
                { "trait_type": "Industry", "value": industry },
                { "trait_type": "Team", "value": teamInfo },
                { "trait_type": "Fundraising Goal (USDC)", "value": fundraisingGoal.toString() }
            ]
        };
        const metadataResult = await pinata.pinJSONToIPFS(metadata, { pinataMetadata: { name: `${ventureName}-metadata.json` } });
        const tokenURI = `ipfs://${metadataResult.IpfsHash}`;
        console.log("Step 1: Pinned logo and metadata to IPFS successfully.");

        // --- Step 2: Prepare On-Chain Parameters and a SINGLE Signer ---
        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);
        const operatorWallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        const ventureFactory = new ethers.Contract(process.env.VENTURE_FACTORY_ADDRESS, VentureFactoryABI, operatorWallet);
        
        conn = await pool.getConnection();
        const [userRows] = await conn.query('SELECT wallet_address FROM users WHERE id = ?', [req.user.id]);
        if (!userRows[0]?.wallet_address) {
            throw new Error('Founder does not have a linked wallet address.');
        }
        
        const founderAddress = userRows[0].wallet_address;
        const totalSharesBN = ethers.parseEther(totalShares);
        const sharesForSale = totalSharesBN * 40n / 100n;
        const fundraisingGoalBN = ethers.parseUnits(fundraisingGoal, 6);
        const initialPricePerShare = (fundraisingGoalBN * (10n ** 18n)) / sharesForSale;
        const tokenName = `${ventureName} Share`;
        const tokenSymbol = ventureName.substring(0, 4).toUpperCase().replace(/\s/g, '');
        console.log("Step 2: Prepared all parameters for blockchain transactions.");

        // --- Step 3: Execute the Two-Transaction Deployment Flow ---
        
        let nonce = await provider.getTransactionCount(operatorWallet.address, 'latest');
        console.log(`Nonce before TX1: ${nonce}`);

        // === TRANSACTION 1: CREATE THE TOKEN CONTRACT ===
        console.log("Step 3.1: Sending transaction to create the VentureShare token...");
        const createTokenTx = await ventureFactory.createShareToken(tokenName, tokenSymbol, totalSharesBN, { nonce: nonce });
        const tokenReceipt = await createTokenTx.wait();
        
        const tokenEventTopic = ventureFactory.interface.getEvent('TokenCreated').topicHash;
        const tokenLog = tokenReceipt.logs.find(log => log.address.toLowerCase() === ventureFactory.target.toLowerCase() && log.topics[0] === tokenEventTopic);
        if (!tokenLog) throw new Error("Critical error: TokenCreated event not found.");
        const shareTokenAddress = ventureFactory.interface.parseLog(tokenLog).args.shareToken;
        console.log(`Step 3.2: Token created successfully at address: ${shareTokenAddress}`);

        nonce++;
        console.log(`Nonce before TX2: ${nonce}`);

        // === TRANSACTION 2: CREATE THE REST OF THE VENTURE ECOSYSTEM ===
        console.log("Step 3.3: Sending transaction to create the venture ecosystem...");
        const ecosystemParams = {
            founderAddress,
            tokenURI,
            totalShares: totalSharesBN,
            pricePerShare: initialPricePerShare,
            demoAdminAddress: operatorWallet.address,
            shareTokenAddress
        };
        
        const createVentureTx = await ventureFactory.createVentureEcosystem(ecosystemParams);
        const ventureReceipt = await createVentureTx.wait();
        console.log("Step 3.4: Venture ecosystem created successfully.");
        
        // --- Step 4: Parse Final Event and Save to Database ---
        const ventureEventTopic = ventureFactory.interface.getEvent('VentureCreated').topicHash;
        const ventureLog = ventureReceipt.logs.find(log => log.address.toLowerCase() === ventureFactory.target.toLowerCase() && log.topics[0] === ventureEventTopic);
        if (!ventureLog) throw new Error("Critical error: VentureCreated event not found in the final transaction receipt.");
        const parsedVentureLog = ventureFactory.interface.parseLog(ventureLog);
        const { ventureId, vault, saleTreasury, dao, timelock } = parsedVentureLog.args;
        console.log(`Step 4.1: Parsed final addresses. DAO: ${dao}, Treasury: ${saleTreasury}`);

        await conn.query(
            `INSERT INTO ventures (venture_nft_id, founder_id, name, industry, mission, team_info, ipfs_metadata_uri, logo_url, share_token_address, vault_address, sale_treasury_address, dao_address, timelock_address, fundraising_goal, total_shares, initial_price_per_share) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [ventureId.toString(), req.user.id, ventureName, industry, mission, teamInfo, tokenURI, imageUri, shareTokenAddress, vault, saleTreasury, dao, timelock, fundraisingGoal, totalSharesBN.toString(), initialPricePerShare.toString()]
        );
        console.log("Step 4.2: Saved new venture to the database.");
        
        // --- Step 5: Send Success Response ---
        res.status(201).json({ 
            message: 'Venture launched successfully!', 
            ventureId: ventureId.toString(),
            transactionHash: createVentureTx.hash 
        });

    } catch (error) {
        console.error('Venture creation error:', error);
        const errorDetails = error.info || error.reason || error.message || "An unexpected error occurred.";
        res.status(500).json({ 
            message: 'Server error during venture creation.', 
            details: errorDetails 
        });
    } finally {
        if (conn) conn.release();
    }
});

router.get('/:ventureId/dashboard', authMiddleware, async (req, res) => {
    const { ventureId } = req.params;
    const { id: userId } = req.user;
    let conn;
    try {
        conn = await pool.getConnection();

        // --- Step 1: Get Venture Details & User Wallet ---
        const [ventures] = await conn.query('SELECT * FROM ventures WHERE id = ?', [ventureId]);
        if (ventures.length === 0) {
            conn.release();
            return res.status(404).json({ message: "Venture not found." });
        }
        const venture = ventures[0];

        const [users] = await conn.query('SELECT wallet_address FROM users WHERE id = ?', [userId]);
        const userWalletAddress = users[0]?.wallet_address;

        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);
        const shareTokenContract = new ethers.Contract(venture.share_token_address, VentureShareABI, provider);
        const saleTreasuryContract = new ethers.Contract(venture.sale_treasury_address, SaleTreasuryABI, provider);
        const daoContract = new ethers.Contract(venture.dao_address, VentureDAOABI, provider);
        const paymentTokenContract = new ethers.Contract(process.env.MOCK_USDC_CONTRACT_ADDRESS, MockERC20ABI, provider);

        // --- Step 2: Blockchain-First Shareholder Logic ---
        // Fetch all "Transfer" events to find all addresses that ever held tokens.
        const transferFilter = shareTokenContract.filters.Transfer(null, null);
        const transferEvents = await shareTokenContract.queryFilter(transferFilter, 0, 'latest');
        const allHolderAddresses = [...new Set(transferEvents.map(e => e.args.to))];

        // Get the CURRENT on-chain balance for each of those addresses.
        const balancePromises = allHolderAddresses.map(address =>
            shareTokenContract.balanceOf(address).then(balance => ({ address, balance }))
        );
        const allBalances = await Promise.all(balancePromises);
        
        // Filter out anyone who no longer holds shares.
        const currentShareholdersOnChain = allBalances.filter(holder => holder.balance > 0n);

        // Fetch internal user data for the current shareholder addresses.
        const [dbUsers] = await conn.query(
            `SELECT full_name, role, wallet_address FROM users WHERE wallet_address IN (?)`,
            [currentShareholdersOnChain.map(h => h.address)]
        );
        const dbUserMap = new Map(dbUsers.map(u => [u.wallet_address.toLowerCase(), u]));

        // Hydrate the on-chain data with DB data to create the final list.
        const shareholders = currentShareholdersOnChain.map(holder => {
            const dbUser = dbUserMap.get(holder.address.toLowerCase());
            return {
                full_name: dbUser?.full_name || `${holder.address.slice(0, 6)}...${holder.address.slice(-4)}`,
                role: dbUser?.role || 'external',
                shares_owned: holder.balance.toString()
            };
        }).sort((a, b) => { // Sort by share amount, descending
             const aShares = ethers.toBigInt(a.shares_owned);
             const bShares = ethers.toBigInt(b.shares_owned);
             if (aShares < bShares) return 1;
             if (aShares > bShares) return -1;
             return 0;
        });

        // --- Step 3: Fetch Other Data (Proposals, Balances) ---
        const [userShares, dbProposals, treasuryBalance, currentPrice] = await Promise.all([
            userWalletAddress ? shareTokenContract.balanceOf(userWalletAddress) : Promise.resolve(0n),
            conn.query('SELECT * FROM proposals WHERE venture_id = ? ORDER BY created_at DESC', [ventureId]),
            paymentTokenContract.balanceOf(venture.sale_treasury_address),
            saleTreasuryContract.pricePerShare()
        ]);
        
        const hydratedProposals = await Promise.all(dbProposals[0].map(async (proposal) => {
            try {
                const [state, votes] = await Promise.all([
                    daoContract.state(proposal.proposal_onchain_id),
                    daoContract.proposalVotes(proposal.proposal_onchain_id)
                ]);
                return {
                    ...proposal,
                    status: Number(state),
                    for_votes: votes.forVotes.toString(),
                    against_votes: votes.againstVotes.toString()
                };
            } catch (e) {
                console.warn(`Could not sync proposal ${proposal.proposal_onchain_id}: ${e.reason || e.message}`);
                return { ...proposal, status: null };
            }
        }));

        conn.release();

        // --- Step 4: Assemble Final Response ---
        res.json({
            venture,
            proposals: hydratedProposals,
            userStake: { sharesOwned: userShares.toString() },
            onChain: {
                treasuryBalance: treasuryBalance.toString(),
                pricePerShare: currentPrice.toString(),
                initialPrice: venture.initial_price_per_share
            },
            shareholders: shareholders
        });

    } catch (error) {
        if (conn) conn.release();
        console.error(`Error fetching dashboard data for venture ${ventureId}:`, error);
        res.status(500).json({ message: 'Server error while fetching dashboard data.' });
    }
});

router.get('/:ventureId/shareholders', authMiddleware, async (req, res) => {
    const { ventureId } = req.params;
    let conn;
    try {
        conn = await pool.getConnection();

        // --- Step 1: Get the venture's share token address ---
        const [ventures] = await conn.query('SELECT share_token_address FROM ventures WHERE id = ?', [ventureId]);
        if (ventures.length === 0 || !ventures[0].share_token_address) {
            conn.release();
            return res.status(404).json({ message: "Venture or its share token not found." });
        }
        const { share_token_address } = ventures[0];

        // --- Step 2: Get all token holders from the Blockchain (this remains the same) ---
        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);
        const shareTokenContract = new ethers.Contract(share_token_address, VentureShareABI, provider);

        const transferFilter = shareTokenContract.filters.Transfer(null, null);
        const transferEvents = await shareTokenContract.queryFilter(transferFilter, 0, 'latest');
        const allHolderAddresses = [...new Set(transferEvents.map(e => e.args.to))];

        const balancePromises = allHolderAddresses.map(address =>
            shareTokenContract.balanceOf(address).then(balance => ({ address, balance }))
        );
        const allBalances = await Promise.all(balancePromises);
        
        const currentShareholdersOnChain = allBalances.filter(holder => holder.balance > 0n);

        // --- Step 3: Get ALL registered users who hold these shares ---
        if (currentShareholdersOnChain.length === 0) {
            conn.release();
            return res.json([]); 
        }

        const [dbUsers] = await conn.query(
            // This query finds users whose wallets are in the list of on-chain holders
            `SELECT full_name, role, wallet_address FROM users WHERE wallet_address IN (?)`,
            [currentShareholdersOnChain.map(h => h.address)]
        );

        // --- Step 4: Create a Map for easy lookup and assemble the FINAL list ---
        // This combines the on-chain balance with the off-chain user details.
        const onChainBalanceMap = new Map(currentShareholdersOnChain.map(h => [h.address.toLowerCase(), h.balance]));

        const shareholders = dbUsers.map(user => ({
            full_name: user.full_name,
            role: user.role,
            // Get the live balance from the on-chain map
            shares_owned: onChainBalanceMap.get(user.wallet_address.toLowerCase()).toString()
        })).sort((a, b) => { // Sort by share amount, descending
             const aShares = ethers.toBigInt(a.shares_owned);
             const bShares = ethers.toBigInt(b.shares_owned);
             if (aShares < bShares) return 1;
             if (aShares > bShares) return -1;
             return 0;
        });

        conn.release();
        res.json(shareholders);

    } catch (error) {
        if (conn) conn.release();
        console.error('Failed to fetch shareholders:', error);
        res.status(500).json({ message: 'Server error fetching shareholder data.' });
    }
});

router.get('/:id/stats', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await pool.getConnection();
    const [ventures] = await conn.query('SELECT sale_treasury_address, total_shares, initial_price_per_share FROM ventures WHERE id = ?', [id]);
    conn.release();

    if (!ventures[0]?.sale_treasury_address) return res.status(404).json({ message: 'Venture not found.' });
    
    const { sale_treasury_address, total_shares, initial_price_per_share } = ventures[0];

    const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);
    const saleTreasuryContract = new ethers.Contract(sale_treasury_address, SaleTreasuryABI, provider);

    const [sharesSold, currentPrice, totalSharesForSale] = await Promise.all([
      saleTreasuryContract.sharesSold(),
      saleTreasuryContract.pricePerShare(),
      saleTreasuryContract.totalSharesForSale()
    ]);

    res.json({
      sharesSold: sharesSold.toString(),
      pricePerShare: currentPrice.toString(),
      initialPrice: initial_price_per_share,
      totalSharesForSale: totalSharesForSale.toString(),
      totalShares: total_shares.toString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching stats.' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    
    const [ventures] = await conn.query(
      'SELECT id, name, industry, logo_url, fundraising_goal, sale_treasury_address, total_shares FROM ventures ORDER BY created_at DESC'
    );
    conn.release();

    res.json(ventures);
  } catch (error) {
    console.error('Error fetching all ventures:', error);
    res.status(500).json({ message: 'Server error while fetching ventures.' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'Venture ID is required.' });
  }

  try {
    const conn = await pool.getConnection();
    const [ventures] = await conn.query('SELECT * FROM ventures WHERE id = ?', [id]);
    conn.release();

    if (ventures.length === 0) {
      return res.status(404).json({ message: 'Venture not found.' });
    }

    res.json(ventures[0]);
  } catch (error) {
    console.error(`Error fetching venture ${id}:`, error);
    res.status(500).json({ message: 'Server error while fetching venture details.' });
  }
});


module.exports = router;