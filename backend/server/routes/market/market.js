// routes/market/market.js
const express = require('express');
const router = express.Router();
const pool = require('../../db');
const authMiddleware = require('../../middleware/authMiddleware');

router.post('/listings', authMiddleware, async (req, res) => {
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

router.put('/listings/:listingId', authMiddleware, async (req, res) => {
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


router.get('/listings', authMiddleware, async (req, res) => {
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

module.exports = router;