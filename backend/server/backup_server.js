const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const multer = require('multer');
const { Readable } = require('stream');
const pinataSDK = require('@pinata/sdk');
const { ethers } = require('ethers');

const MockERC20ABI = require('./abis/MockERC20.json')
const VentureFactoryABI = require('./abis/VentureFactory.json');
const SaleTreasuryABI = require('./abis/SaleTreasury.json')
const VentureDAOABI = require('./abis/VentureDAO.json')
const VentureShareABI = require('./abis/VentureShare.json')

const app = express();
const PORT = process.env.PORT || 4000;

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// === DATABASE CONFIGURATION ===
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_API_SECRET);


const pool = mysql.createPool(dbConfig);

// === AUTHENTICATION MIDDLEWARE ===
const authMiddleware = (req, res, next) => {
  // Get token from the header
  const token = req.header('x-auth-token');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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


// --- PROTECTED USER ROUTES ---

// An endpoint to link a wallet address to a logged-in user
app.post('/api/users/link-wallet', authMiddleware, async (req, res) => {
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

app.post('/api/ventures/create', [authMiddleware, multer({ storage: multer.memoryStorage() }).single('logo')], async (req, res) => {
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

// endpoint for fetching ALL user holdings.
app.get('/api/portfolio/all', authMiddleware, async (req, res) => {
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

app.get('/api/ventures/:id', authMiddleware, async (req, res) => {
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

app.get('/api/ventures', authMiddleware, async (req, res) => {
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

app.get('/api/ventures/:id/stats', authMiddleware, async (req, res) => {
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


app.post('/api/investments/record', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { ventureId, sharesOwned } = req.body;

    if (!ventureId || !sharesOwned) {
        return res.status(400).json({ message: 'Venture ID and shares owned are required.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();

        // Step 1: Check if an investment record already exists for this user and venture.
        const [existing] = await conn.query(
            'SELECT id, shares_owned FROM investments WHERE user_id = ? AND venture_id = ?',
            [userId, ventureId]
        );

        const newSharesBN = ethers.toBigInt(sharesOwned);

        if (existing.length > 0) {
            // Step 2a: If it exists, UPDATE the record by adding the new shares.
            const existingInvestment = existing[0];
            const currentSharesBN = ethers.toBigInt(existingInvestment.shares_owned);
            const totalSharesBN = currentSharesBN + newSharesBN;

            await conn.query(
                'UPDATE investments SET shares_owned = ? WHERE id = ?',
                [totalSharesBN.toString(), existingInvestment.id]
            );
            console.log(`Updated investment for user ${userId} in venture ${ventureId}.`);

        } else {
            // Step 2b: If it does not exist, INSERT a new record.
            await conn.query(
                'INSERT INTO investments (user_id, venture_id, shares_owned) VALUES (?, ?, ?)',
                [userId, ventureId, newSharesBN.toString()]
            );
            console.log(`Created new investment for user ${userId} in venture ${ventureId}.`);
        }

        conn.release();
        res.status(200).json({ message: 'Investment recorded successfully.' });

    } catch (error) {
        if (conn) conn.release();
        console.error('Error recording investment:', error);
        res.status(500).json({ message: 'Server error while recording investment.' });
    }
});

// Endpoint to create a listing in the database AFTER the on-chain tx succeeds
app.post('/api/market/listings', authMiddleware, async (req, res) => {
    const { listingOnchainId, ventureId, sellerAddress, shareTokenAddress, amount, pricePerShare } = req.body;
    
    if (!listingOnchainId || !ventureId || !sellerAddress || !shareTokenAddress || !amount || !pricePerShare) {
        return res.status(400).json({ message: 'Missing required fields for listing.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'INSERT INTO listings (listing_onchain_id, venture_id, seller_address, share_token_address, amount, price_per_share) VALUES (?, ?, ?, ?, ?, ?)',
            [listingOnchainId, ventureId, sellerAddress, shareTokenAddress, amount, pricePerShare]
        );
        conn.release();
        res.status(201).json({ message: 'Listing successfully recorded in database.' });

    } catch (error) {
        if (conn) conn.release();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This listing ID has already been recorded.' });
        }
        console.error('Error recording new listing:', error);
        res.status(500).json({ message: 'Server error recording listing.' });
    }
});

// Endpoint to update the status of a listing when it is sold or cancelled.
app.put('/api/market/listings/:listingId', authMiddleware, async (req, res) => {
    const { listingId } = req.params;
    const { status } = req.body;

    if (!status || !['sold', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'A valid status (sold or cancelled) is required.' });
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query(
            'UPDATE listings SET status = ? WHERE listing_onchain_id = ?',
            [status, listingId]
        );
        conn.release();
        res.status(200).json({ message: `Listing ${listingId} has been marked as ${status}.` });

    } catch (error) {
        if (conn) conn.release();
        console.error(`Error updating listing ${listingId}:`, error);
        res.status(500).json({ message: 'Server error updating listing status.' });
    }
});

// Endpoint to fetch all open listings for the entire platform

app.get('/api/market/listings', authMiddleware, async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();

        const query = `
            SELECT 
                l.listing_onchain_id,
                l.seller_address,
                l.share_token_address,
                l.amount,
                l.price_per_share,
                v.id as venture_id,
                v.name as venture_name,
                v.logo_url as venture_logo
            FROM listings l
            JOIN ventures v ON l.share_token_address = v.share_token_address
            WHERE l.status = 'open'
            ORDER BY l.created_at DESC;
        `;
        
        const [listings] = await conn.query(query);
        conn.release();

        res.json(listings);

    } catch (error) {
        if (conn) conn.release();
        console.error('Error fetching marketplace listings:', error);
        res.status(500).json({ message: 'Server error fetching listings.' });
    }
});

app.post('/api/admin/set-price', authMiddleware, async (req, res) => {
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

// Endpoint that aggregates all data needed for the DAO dashboard page.
app.get('/api/ventures/:ventureId/dashboard', authMiddleware, async (req, res) => {
    const { ventureId } = req.params;
    const { id: userId } = req.user; 

    let conn;
    try {
        conn = await pool.getConnection();

        // Step 1: Get all venture details from the database.
        const [ventures] = await conn.query('SELECT * FROM ventures WHERE id = ?', [ventureId]);
        if (ventures.length === 0) {
            conn.release();
            return res.status(404).json({ message: "Venture not found." });
        }
        const venture = ventures[0];


        // Step 2: Get the user's wallet address from the database.
        const [users] = await conn.query('SELECT wallet_address FROM users WHERE id = ?', [userId]);
        if (users.length === 0 || !users[0].wallet_address) {
            return res.status(404).json({ message: "User wallet not found or not linked." });
        }
        const userWalletAddress = users[0].wallet_address;
        
        const provider = new ethers.JsonRpcProvider(process.env.JSON_RPC_URL);

        // Step 3: Get the user's LIVE share balance directly from the VentureShare contract.
        const shareTokenContract = new ethers.Contract(venture.share_token_address, VentureShareABI, provider);
        const userShares = (await shareTokenContract.balanceOf(userWalletAddress)).toString();

        // Step 4: Fetch all proposals for this venture from the database.
        const [dbProposals] = await conn.query('SELECT * FROM proposals WHERE venture_id = ? ORDER BY created_at DESC', [ventureId]);
        
        // Step 5: Fetch other live on-chain data concurrently.
        const saleTreasuryContract = new ethers.Contract(venture.sale_treasury_address, SaleTreasuryABI, provider);
        const daoContract = new ethers.Contract(venture.dao_address, VentureDAOABI, provider);
        const paymentTokenContract = new ethers.Contract(process.env.MOCK_USDC_CONTRACT_ADDRESS, MockERC20ABI, provider);
        
        const [treasuryBalance, currentPrice] = await Promise.all([
            paymentTokenContract.balanceOf(venture.sale_treasury_address),
            saleTreasuryContract.pricePerShare()
        ]);

        // (The rest of your proposal hydration logic remains the same...)
        console.log(`\n--- Syncing Proposal Status for Venture ID: ${ventureId} ---`);
        const hydratedProposals = await Promise.all(dbProposals.map(async (proposal) => {
            try {
                const proposalId = proposal.proposal_onchain_id;
                const [state, votes, snapshotBlock] = await Promise.all([
                    daoContract.state(proposalId),
                    daoContract.proposalVotes(proposalId),
                    daoContract.proposalSnapshot(proposalId)
                ]);
                const quorumNeeded = await daoContract.quorum(snapshotBlock);
                const currentTotalVotes = votes.forVotes + votes.againstVotes + votes.abstainVotes;
                const isQuorumReached = currentTotalVotes >= quorumNeeded;

                return { 
                    ...proposal, 
                    status: Number(state), 
                    for_votes: votes.forVotes.toString(), 
                    against_votes: votes.againstVotes.toString(),
                    quorum_needed: quorumNeeded.toString(),
                    current_total_votes: currentTotalVotes.toString(),
                    is_quorum_reached: isQuorumReached
                };
            } catch (e) {
                console.warn(`Could not sync proposal ${proposal.proposal_onchain_id}: ${e.reason || e.message}`);
                return { ...proposal, status: null };
            }
        }));

        conn.release();

        // Step 6: Assemble and send the final, complete response object.
        res.json({
            venture,
            proposals: hydratedProposals,
            userStake: { 
                sharesOwned: userShares 
            },
            onChain: {
                treasuryBalance: treasuryBalance.toString(),
                pricePerShare: currentPrice.toString(),
                initialPrice: venture.initial_price_per_share
            }
        });

    } catch (error) {
        if (conn) conn.release();
        console.error(`Error fetching dashboard data for venture ${ventureId}:`, error);
        res.status(500).json({ message: 'Server error while fetching dashboard data.' });
    }
});

// Endpoint that creates a new governance proposal (text-based or executable).
app.post('/api/proposals/create', authMiddleware, async (req, res) => {
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
            [ventureId, dbProposerId, parsedLog.args.proposalId.toString(), title, description, JSON.stringify(targets), JSON.stringify(values), JSON.stringify(calldatas)]
        );

        conn.release();
        res.status(201).json({ message: 'Proposal submitted successfully!', transactionHash: tx.hash });

    } catch (error) {
        if (conn) conn.release();
        console.error('Proposal relay error:', error);
        res.status(500).json({ message: 'Server failed to relay proposal.', details: error.reason || error.message });
    }
});

app.post('/api/governance/vote-gasless', authMiddleware, async (req, res) => {
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

app.get('/api/ventures/:ventureId/shareholders', authMiddleware, async (req, res) => {
    const { ventureId } = req.params;
    let conn;
    try {
        conn = await pool.getConnection();

        // This query joins investments with users, filters by the venture.
        const [shareholders] = await conn.query(
            `SELECT 
                u.full_name,
                u.role,
                i.shares_owned
            FROM investments i
            JOIN users u ON i.user_id = u.id
            WHERE i.venture_id = ?
            ORDER BY CAST(i.shares_owned AS UNSIGNED) DESC`,
            [ventureId]
        );

        res.json(shareholders);

    } catch (error) {
        console.error('Failed to fetch shareholders:', error);
        res.status(500).json({ message: 'Server error fetching shareholder data.' });
    } finally {
        if (conn) conn.release();
    }
});

// === START THE SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 VentureHUB API Server is running on http://localhost:${PORT}`);
});