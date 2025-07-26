import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import {
    Container, Typography, Grid, Paper, Box, Button, CircularProgress, Alert,
    TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
    Avatar, Divider, Table, List, ListItem, ListItemText, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, IconButton
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// --- ABIs ---
import MarketplaceABI from '../abi/Marketplace.json';
import VentureShareABI from '../abi/VentureShare.json';
import MockERC20ABI from '../abi/MockERC20.json';

// --- Environment Variables ---
const MARKETPLACE_ADDRESS = process.env.REACT_APP_MARKETPLACE_ADDRESS || "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
const USDC_ADDRESS = process.env.REACT_APP_MOCK_USDC_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// --- Constants ---
const USDC_DECIMALS = 6;
const SHARE_DECIMALS = 18;

// --- Helper Functions ---
const formatBigNumber = (value, decimals = 18) => {
    if (!value || value.toString() === '0') return '0.00';
    return parseFloat(ethers.formatUnits(value, decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const getIpfsUrl = (ipfsUri) => {
    if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return '';
    const cid = ipfsUri.substring(7);
    return `https://ipfs.io/ipfs/${cid}`;
};

// --- Main Component ---
function MarketplacePage() {
    const [listings, setListings] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // Dialog states
    const [listDialogOpen, setListDialogOpen] = useState(false);
    const [buyDialogOpen, setBuyDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [listAmount, setListAmount] = useState('');
    const [listPrice, setListPrice] = useState('');

    const token = localStorage.getItem('token');

    // --- Data Fetching ---
    const fetchData = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const [listingsRes, portfolioRes] = await Promise.all([
                axios.get('http://localhost:4000/api/market/listings', { headers: { 'x-auth-token': token } }),
                axios.get('http://localhost:4000/api/portfolio/all', { headers: { 'x-auth-token': token } })
            ]);
            setListings(listingsRes.data);
            setPortfolio(portfolioRes.data);
        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Could not load marketplace data. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Dialog Handlers ---
    const handleOpenListDialog = (share) => {
        setSelectedItem(share);
        setListAmount('');
        setListPrice('');
        setListDialogOpen(true);
    };
    const handleCloseListDialog = () => setListDialogOpen(false);

    const handleOpenBuyDialog = (listing) => {
        setSelectedItem(listing);
        setBuyDialogOpen(true);
    };
    const handleCloseBuyDialog = () => setBuyDialogOpen(false);

    // --- Web3 Interaction Functions ---
    const handleListShares = async () => {
        if (!selectedItem || !listAmount || !listPrice || parseFloat(listAmount) <= 0 || parseFloat(listPrice) <= 0) {
            alert('Please enter a valid amount and price.');
            return;
        }
        setIsActionLoading(true);
        setError('');
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const shareContract = new ethers.Contract(selectedItem.share_token_address, VentureShareABI, signer);
            const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI, signer);
            
            const amountBN = ethers.parseUnits(listAmount, SHARE_DECIMALS);
            const priceBN = ethers.parseUnits(listPrice, USDC_DECIMALS);

            const approveTx = await shareContract.approve(MARKETPLACE_ADDRESS, amountBN);
            await approveTx.wait();
            
            const listTx = await marketplaceContract.listShares(selectedItem.share_token_address, amountBN, priceBN);
            const receipt = await listTx.wait();

            const listedEvent = receipt.logs.find(log => {
                try {
                   const parsedLog = marketplaceContract.interface.parseLog(log);
                   return parsedLog && parsedLog.name === 'Listed';
               } catch (e) { return false; }
           });
           if (!listedEvent) throw new Error("Could not find the 'Listed' event.");
           const listingId = marketplaceContract.interface.parseLog(listedEvent).args.listingId;

            await axios.post('http://localhost:4000/api/market/listings', {
                listingOnchainId: listingId.toString(),
                ventureId: selectedItem.id,
                sellerAddress: await signer.getAddress(),
                shareTokenAddress: selectedItem.share_token_address,
                amount: amountBN.toString(),
                pricePerShare: priceBN.toString()
            }, { headers: { 'x-auth-token': token } });

            alert('Your shares have been listed successfully!');
            handleCloseListDialog();
            await fetchData();
        } catch (err) {
            console.error("Listing Error:", err);
            setError(err.reason || 'Failed to list shares. Check console for details.');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleBuyShares = async () => {
        if (!selectedItem) return;
        setIsActionLoading(true);
        setError('');
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const usdcContract = new ethers.Contract(USDC_ADDRESS, MockERC20ABI, signer);
            const marketplaceContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI, signer);

            const totalCost = (ethers.toBigInt(selectedItem.amount) * ethers.toBigInt(selectedItem.price_per_share)) / (10n ** ethers.toBigInt(SHARE_DECIMALS));

            const approveTx = await usdcContract.approve(MARKETPLACE_ADDRESS, totalCost);
            await approveTx.wait();

            const buyTx = await marketplaceContract.buyShares(selectedItem.listing_onchain_id);
            await buyTx.wait();

            await axios.put(`http://localhost:4000/api/market/listings/${selectedItem.listing_onchain_id}`, 
                { status: 'sold' }, 
                { headers: { 'x-auth-token': token }}
            );
            
            // Record the investment for the buyer
            await axios.post('http://localhost:4000/api/investments/record', 
                { ventureId: selectedItem.venture_id, sharesOwned: selectedItem.amount },
                { headers: { 'x-auth-token': token } }
            );

            alert('Purchase successful!');
            handleCloseBuyDialog();
            await fetchData();
        } catch (err) {
            console.error("Buying Error:", err);
            setError(err.reason || 'Failed to buy shares. Check console for details.');
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StorefrontIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                <Typography variant="h4" component="h1" fontWeight="bold">
                    Marketplace
                </Typography>
            </Box>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
                Buy and sell fractionalized equity from other VentureHub members.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Grid container spacing={4}>
                {/* --- Listings Table --- */}
                <Grid item xs={12} lg={8}>
                    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
                        <Typography variant="h5" fontWeight="medium" sx={{ mb: 2 }}>Open Listings</Typography>
                        <TableContainer>
                            <Table aria-label="open listings table">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Asset</TableCell>
                                        <TableCell align="right">Shares Available</TableCell>
                                        <TableCell align="right">Price per Share (USDC)</TableCell>
                                        <TableCell align="right">Total Value (USDC)</TableCell>
                                        <TableCell align="center">Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                                <CircularProgress />
                                            </TableCell>
                                        </TableRow>
                                    ) : listings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                                <Typography color="text.secondary">No shares are currently listed for sale.</Typography>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        listings.map((listing) => {
                                            const totalValue = (ethers.toBigInt(listing.amount) * ethers.toBigInt(listing.price_per_share)) / (10n ** ethers.toBigInt(SHARE_DECIMALS));
                                            return (
                                                <TableRow key={listing.listing_onchain_id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                                    <TableCell component="th" scope="row">
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <Avatar src={getIpfsUrl(listing.venture_logo)} sx={{ width: 40, height: 40, mr: 2 }} />
                                                            <Typography fontWeight="medium">{listing.venture_name}</Typography>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right">{formatBigNumber(listing.amount, SHARE_DECIMALS)}</TableCell>
                                                    <TableCell align="right">${formatBigNumber(listing.price_per_share, USDC_DECIMALS)}</TableCell>
                                                    <TableCell align="right">${formatBigNumber(totalValue, USDC_DECIMALS)}</TableCell>
                                                    <TableCell align="center">
                                                        <Button variant="contained" size="small" onClick={() => handleOpenBuyDialog(listing)} disabled={isActionLoading}>
                                                            Buy
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* --- My Portfolio Column --- */}
                <Grid item xs={12} lg={4}>
                    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <AccountBalanceWalletIcon sx={{ mr: 1.5, color: 'text.secondary' }}/>
                            <Typography variant="h5" fontWeight="medium">Your Share Portfolio</Typography>
                        </Box>
                        {loading ? <CircularProgress /> : portfolio.length === 0 ? (
                            <Typography color="text.secondary" sx={{ mt: 2 }}>You do not own any tradable shares.</Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {portfolio.map((share) => (
                                    <Paper key={share.id} variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <Avatar src={getIpfsUrl(share.logo_url)} sx={{ width: 48, height: 48, mr: 2 }} />
                                            <Box>
                                                <Typography fontWeight="medium">{share.name}</Typography>
                                                <Typography color="text.secondary" variant="body2" style={{marginRight: "10px"}}>
                                                    {formatBigNumber(share.shares_owned, SHARE_DECIMALS)} shares
                                                </Typography>
                                                <Typography color="primary" variant="caption">
                                                    Value: ${formatBigNumber((ethers.toBigInt(share.shares_owned) * ethers.toBigInt(share.currentPrice)) / (10n ** 18n), USDC_DECIMALS)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Button variant="outlined" size="small" onClick={() => handleOpenListDialog(share)}>
                                            List
                                        </Button>
                                    </Paper>
                                ))}
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* --- Modals for Listing and Buying --- */}
            <Dialog open={listDialogOpen} onClose={handleCloseListDialog} maxWidth="xs" fullWidth>
                <DialogTitle fontWeight="bold">List Your "{selectedItem?.name}" Shares</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{mb: 2}}>
                        Set the amount of shares and the price per share in USDC. The marketplace contract will hold your shares in escrow until they are sold.
                    </DialogContentText>
                    <TextField autoFocus margin="dense" label="Amount of Shares to Sell" type="number" fullWidth variant="outlined" value={listAmount} onChange={(e) => setListAmount(e.target.value)} helperText={`You own: ${formatBigNumber(selectedItem?.shares_owned, SHARE_DECIMALS)}`} />
                    <TextField margin="dense" label="Price per Share (USDC)" type="number" fullWidth variant="outlined" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
                </DialogContent>
                <DialogActions sx={{ p: '0 24px 24px' }}>
                    <Button onClick={handleCloseListDialog}>Cancel</Button>
                    <Button onClick={handleListShares} variant="contained" disabled={isActionLoading}>
                        {isActionLoading ? <CircularProgress size={24} /> : 'Approve & List Shares'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={buyDialogOpen} onClose={handleCloseBuyDialog} maxWidth="sm" fullWidth>
                <DialogTitle fontWeight="bold">Confirm Purchase</DialogTitle>
                <DialogContent>
                    <DialogContentText>You are about to purchase shares for **{selectedItem?.venture_name}**.</DialogContentText>
                    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                        <List>
                            <ListItem>
                                <ListItemText primary="Shares" />
                                <Typography fontWeight="bold">{formatBigNumber(selectedItem?.amount, SHARE_DECIMALS)}</Typography>
                            </ListItem>
                            <ListItem>
                                <ListItemText primary="Price per Share" />
                                <Typography fontWeight="bold">${formatBigNumber(selectedItem?.price_per_share, USDC_DECIMALS)}</Typography>
                            </ListItem>
                            <Divider sx={{ my: 1 }} />
                            <ListItem>
                                <ListItemText primary={<Typography fontWeight="bold">Total Cost</Typography>} />
                                <Typography variant="h6" color="primary" fontWeight="bold">
                                    ${formatBigNumber((ethers.toBigInt(selectedItem?.amount || 0) * ethers.toBigInt(selectedItem?.price_per_share || 0)) / (10n ** ethers.toBigInt(SHARE_DECIMALS)), USDC_DECIMALS)}
                                </Typography>
                            </ListItem>
                        </List>
                    </Paper>
                    <Alert severity="info" sx={{ mt: 2 }}>
                        This action will require two transactions: one to approve the USDC payment and a second to confirm the purchase.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ p: '0 24px 24px' }}>
                    <Button onClick={handleCloseBuyDialog}>Cancel</Button>
                    <Button onClick={handleBuyShares} variant="contained" disabled={isActionLoading}>
                        {isActionLoading ? <CircularProgress size={24} /> : 'Proceed to Buy'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

export default MarketplacePage;