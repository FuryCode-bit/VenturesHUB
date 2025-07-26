import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import {
  Container, Typography, Grid, Paper, Box, Button, List, ListItem, ListItemText,
  Divider, Chip, Tooltip, CircularProgress, Alert, Modal, TextField, Fade, Backdrop,
  FormControl, InputLabel, Select, MenuItem, IconButton
} from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import PageviewIcon from '@mui/icons-material/Pageview';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// ABIs
import VentureDAOABI from '../abi/VentureDAO.json';
import VentureShareABI from '../abi/VentureShare.json';
import SaleTreasuryABI from '../abi/SaleTreasury.json';

// --- Constants & Helpers ---
const token = localStorage.getItem('token');
const statusColors = { 0: 'warning', 1: 'primary', 2: 'error', 3: 'error', 4: 'success', 5: 'info', 6: 'default', 7: 'success' };
const statusLabels = { 0: 'Pending', 1: 'Active', 2: 'Canceled', 3: 'Defeated', 4: 'Succeeded', 5: 'Queued', 6: 'Expired', 7: 'Executed' };
const VOTE_TYPE = { AGAINST: 0, FOR: 1, ABSTAIN: 2 };

const formatBigNumber = (value, decimals = 18) => {
    if (!value || value.toString() === '0') return '0.00';
    return parseFloat(ethers.formatUnits(value, decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
};

const safeJsonParse = (jsonString) => {
    try {
        const parsed = JSON.parse(jsonString) || [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
};

const formatOwnershipPercentage = (percentage) => {
    if (percentage === 0) {
        return '0.00%';
    }
    if (percentage < 0.01) {
        return '< 0.01%';
    }
    return `${percentage.toFixed(2)}%`;
};

function SteeringCommitteePage() {
    const { ventureId } = useParams();
    const [dashboardData, setDashboardData] = useState(null);
    const [shareholders, setShareholders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // --- State for Modals ---
    const [createProposalModalOpen, setCreateProposalModalOpen] = useState(false);
    const [proposalData, setProposalData] = useState({ title: '', description: '', proposalType: 'text' });
    const [proposalError, setProposalError] = useState('');
    const [voteModalState, setVoteModalState] = useState({ open: false, proposalId: null, successMessage: '', errorMessage: '' });

    // --- State to track if the user needs to delegate their votes ---
    const [needsToDelegate, setNeedsToDelegate] = useState(false);

    const fetchData = useCallback(async () => {
        if (!token) { setError("Authentication required."); setLoading(false); return; }
        if (!dashboardData) setLoading(true);

        try {
            const [dashboardRes, shareholdersRes] = await Promise.all([
                axios.get(`http://localhost:4000/api/ventures/${ventureId}/dashboard`, { headers: { 'x-auth-token': token } }),
                axios.get(`http://localhost:4000/api/ventures/${ventureId}/shareholders`, { headers: { 'x-auth-token': token } })
            ]);
            setDashboardData(dashboardRes.data);
            setShareholders(shareholdersRes.data);
        } catch (err) {
            setError('Failed to fetch governance data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [ventureId, token, dashboardData]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ventureId]);

    useEffect(() => {
        const checkDelegation = async () => {
            if (!dashboardData?.venture.share_token_address || !window.ethereum) return;
            try {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const userAddress = await signer.getAddress();
                const shareTokenContract = new ethers.Contract(dashboardData.venture.share_token_address, VentureShareABI, provider);
                const delegates = await shareTokenContract.delegates(userAddress);
                setNeedsToDelegate(delegates === ethers.ZeroAddress);
            } catch (err) {
                console.error("Could not check delegation status:", err);
            }
        };
        checkDelegation();
    }, [dashboardData]);

    const handleOpenVoteModal = (proposal) => {
        setVoteModalState({ open: true, proposalId: proposal.proposal_onchain_id, successMessage: '', errorMessage: '' });
    };
    const handleCloseVoteModal = () => {
        setVoteModalState({ open: false, proposalId: null, successMessage: '', errorMessage: '' });
    };

    const handleDelegate = async () => {
        setIsActionLoading(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const shareTokenContract = new ethers.Contract(dashboardData.venture.share_token_address, VentureShareABI, signer);
            const tx = await shareTokenContract.delegate(await signer.getAddress());
            await tx.wait();
            alert("Voting power activated successfully! You can now vote on proposals.");
            setNeedsToDelegate(false);
            fetchData();
        } catch (err) {
            alert("Failed to activate voting power.");
            console.error(err);
        } finally {
            setIsActionLoading(false);
        }
    };
    
    const handleVoteNormal = async (proposalId, voteSupport) => {
        setIsActionLoading(true);
        setVoteModalState(p => ({ ...p, successMessage: '', errorMessage: '' }));
        try {
            if (!window.ethereum) throw new Error("MetaMask is not installed.");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const daoContract = new ethers.Contract(dashboardData.venture.dao_address, VentureDAOABI, signer);
            const tx = await daoContract.castVote(proposalId, voteSupport);
            await tx.wait();
            await fetchData();
            setVoteModalState(p => ({ ...p, successMessage: "Your vote was successfully cast on the blockchain!" }));
        } catch (err) {
            console.error("Normal voting process failed:", err);
            let message = err.reason || err.message || "An unknown error occurred.";
            if (err.code === 4001 || err.code === 'ACTION_REJECTED') { message = "You rejected the transaction in your wallet."; }
            setVoteModalState(p => ({ ...p, errorMessage: message }));
        } finally {
            setIsActionLoading(false);
        }
    };

    // Kept for future implementation but not actively used by the UI
    const handleVoteGasless = async (proposalId, voteSupport) => {
        setIsActionLoading(true);
        setVoteModalState(p => ({ ...p, successMessage: '', errorMessage: '' }));
        try {
            if (!window.ethereum) throw new Error("MetaMask is not installed or not detected.");
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const { dao_address } = dashboardData.venture;
            const chainId = (await provider.getNetwork()).chainId;
            if (!dao_address) throw new Error("DAO contract address is missing.");
            const domain = { name: 'VentureDAO', version: '1', chainId: chainId, verifyingContract: dao_address };
            const types = { Ballot: [ { name: 'proposalId', type: 'uint256' }, { name: 'support', type: 'uint8' } ] };
            const valueToSign = { proposalId: ethers.getBigInt(proposalId), support: Number(voteSupport) };
            const signature = await signer.signTypedData(domain, types, valueToSign);
            const sig = ethers.Signature.from(signature);
            const response = await axios.post(
                'http://localhost:4000/api/governance/vote-gasless',
                { ventureId, proposalId: proposalId, support: voteSupport, v: sig.v, r: sig.r, s: sig.s },
                { headers: { 'x-auth-token': token } }
            );
            await fetchData();
            setVoteModalState(p => ({ ...p, successMessage: response.data.message }));
        } catch (err) {
            console.error("Gasless voting process failed:", err);
            let message = err.message || "An unknown error occurred.";
            if (err.code === 4001 || err.code === 'ACTION_REJECTED') { message = "You rejected the signature request in your wallet."; }
            setVoteModalState(p => ({ ...p, errorMessage: message }));
        } finally {
            setIsActionLoading(false);
        }
    };
    
    const handleSubmitProposal = async () => {
        if (!proposalData.title || !proposalData.description) { setProposalError("Title and description are required."); return; }
        setProposalError('');
        setIsActionLoading(true);
        try {
            await axios.post(
                'http://localhost:4000/api/proposals/create',
                { ventureId, title: proposalData.title, description: proposalData.description, proposalType: proposalData.proposalType },
                { headers: { 'x-auth-token': token } }
            );
            alert("Proposal submitted successfully!");
            setCreateProposalModalOpen(false);
            setProposalData({ title: '', description: '', proposalType: 'text' });
            await fetchData();
        } catch (err) {
            const message = err.response?.data?.details || err.message || "Failed to submit proposal.";
            setProposalError(message);
            console.error("Proposal submission error:", err);
        } finally {
            setIsActionLoading(false);
        }
    };
    
const handleQueueOrExecute = async (actionName, proposal, successMessage) => {
    setIsActionLoading(true);
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const daoContract = new ethers.Contract(dashboardData.venture.dao_address, VentureDAOABI, signer);

        // --- CORRECTED HASH GENERATION ---
        // `proposal.description` now contains the exact string hashed on-chain.
        // No more reconstruction is needed.
        const descriptionHash = ethers.id(proposal.description);

        const targets = safeJsonParse(proposal.targets);
        const values = safeJsonParse(proposal.values).map(v => ethers.getBigInt(v));
        const calldatas = safeJsonParse(proposal.calldatas);
        let tx;
        if (actionName === 'queue') { tx = await daoContract.queue(targets, values, calldatas, descriptionHash); }
        else if (actionName === 'execute') { tx = await daoContract.execute(targets, values, calldatas, descriptionHash); }
        else { throw new Error("Invalid action"); }
        await tx.wait();
        alert(successMessage);
        await fetchData();
    } catch (err) {
        alert(err.reason || "Transaction failed.");
        console.error(err);
    } finally {
        setIsActionLoading(false);
    }
};

    if (loading) return <Container sx={{ textAlign: 'center', mt: 10 }}><CircularProgress /></Container>;
    if (error) return <Container><Alert severity="error" sx={{ mt: 4 }}>{error}</Alert></Container>;
    if (!dashboardData) return <Container><Typography variant="h5">Venture data not found.</Typography></Container>;

    const { venture, proposals, userStake, onChain } = dashboardData;
    const activeModalProposal = voteModalState.open ? proposals.find(p => p.proposal_onchain_id === voteModalState.proposalId) : null;
    const canPropose = userStake && ethers.getBigInt(userStake.sharesOwned) > 0n;

    const calculateOwnership = (shares) => {
        if (!venture.total_shares || !shares) return 0;
        const totalSharesBN = ethers.getBigInt(venture.total_shares);
        if (totalSharesBN === 0n) return 0;
        const userSharesBN = ethers.getBigInt(shares);
        const PRECISION = 10n ** 6n;
        const percentageWithPrecision = (userSharesBN * 100n * PRECISION) / totalSharesBN;
        return Number(percentageWithPrecision) / Number(PRECISION);
    };
    
    const ownershipPercentage = calculateOwnership(userStake.sharesOwned);
    
    let priceChange = 0;
    const initialPrice = onChain.initialPrice ? parseFloat(ethers.formatUnits(onChain.initialPrice, 6)) : 0;
    const currentPrice = onChain.pricePerShare ? parseFloat(ethers.formatUnits(onChain.pricePerShare, 6)) : 0;
    if (initialPrice > 0 && currentPrice > 0) { priceChange = ((currentPrice - initialPrice) / initialPrice) * 100; }
    
    // ✅ THIS IS THE CORRECTED CALCULATION
    let totalVentureValue = 0n;
    if (venture.total_shares && onChain.pricePerShare) {
        const totalSharesBN = ethers.getBigInt(venture.total_shares);
        const currentPriceBN = ethers.getBigInt(onChain.pricePerShare);
        // Correctly scale by dividing out the share token's 18 decimals
        totalVentureValue = (totalSharesBN * currentPriceBN) / (10n ** 18n);
    }
    
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h3" component="h1">{venture.name} DAO</Typography>
                <Typography variant="h6" color="text.secondary">{venture.mission}</Typography>
            </Box>

            {needsToDelegate && ethers.getBigInt(userStake.sharesOwned) > 0n && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    To participate in governance, you must first activate your voting power by delegating shares to your own address.
                    <Button variant="contained" size="small" onClick={handleDelegate} disabled={isActionLoading} sx={{ ml: 2, color: 'white', bgcolor: 'warning.dark' }}>
                        {isActionLoading ? <CircularProgress size={20} color="inherit" /> : "Activate Votes"}
                    </Button>
                </Alert>
            )}

            <Grid container spacing={4}>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h5" style={{marginRight: "10px"}}>Governance Proposals</Typography>
                            <Tooltip title={!canPropose ? "You must own shares to submit a proposal." : (needsToDelegate ? "You must activate your votes first." : "")}>
                                <span><Button variant="contained" startIcon={<HowToVoteIcon />} disabled={!canPropose || isActionLoading || needsToDelegate} onClick={() => setCreateProposalModalOpen(true)}>Submit Proposal</Button></span>
                            </Tooltip>
                        </Box>
                        <Divider sx={{ mb: 2 }} />
                        {proposals.length === 0 ? (<Typography>No proposals yet.</Typography>) : (
                            <List sx={{ p: 0 }}>
                                {proposals.map((p, i) => (
                                    <React.Fragment key={p.id}>
                                        <ListItem>
                                            <ListItemText primary={p.title} secondary={`For: ${formatBigNumber(p.for_votes)} | Against: ${formatBigNumber(p.against_votes)}`} />
                                            <Box>
                                                {p.status === 1 && (<Button onClick={() => handleOpenVoteModal(p)} disabled={isActionLoading || needsToDelegate}>Vote</Button>)}
                                                {p.status === 4 && (<Button onClick={() => handleQueueOrExecute('queue', p, "Proposal queued!")}>Queue</Button>)}
                                                {p.status === 5 && (<Button onClick={() => handleQueueOrExecute('execute', p, "Proposal executed!")}>Execute</Button>)}
                                                <Chip label={statusLabels[p.status]} color={statusColors[p.status]} />
                                            </Box>
                                        </ListItem>
                                        {i < proposals.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </Paper>

                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h5" sx={{ mb: 2 }}>Shareholders</Typography>
                        <Divider sx={{ mb: 1 }} />
                        <List dense>
                            {shareholders.length > 0 ? shareholders.map((sh, index) => (
                                <React.Fragment key={index}>
                                    <ListItem>
                                        <ListItemText
                                            primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}><Typography sx={{ fontWeight: 'bold' }}>{sh.full_name}</Typography><Chip label={sh.role} size="small" /></Box>}
                                            secondary={`Owns ${formatBigNumber(sh.shares_owned)} shares`}
                                        />
                                        <Typography variant="body1" color="text.secondary">{formatOwnershipPercentage(calculateOwnership(sh.shares_owned))}</Typography>
                                    </ListItem>
                                    {index < shareholders.length - 1 && <Divider component="li" light />}
                                </React.Fragment>
                            )) : (<Typography color="text.secondary" sx={{ p: 2 }}>No shareholder data.</Typography>)}
                        </List>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, mb: 3, textAlign: 'center' }}>
                        <Typography variant="h6">Treasury Balance</Typography>
                        <Typography variant="h4" color="primary.main">{`$${formatBigNumber(onChain.treasuryBalance, 6)}`}</Typography>
                        <Typography variant="caption">USDC Held for Operations</Typography>
                    </Paper>
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Typography variant="h6">Your Stake</Typography>
                        <List dense>
                            <ListItem><ListItemText primary="Shares Owned" secondary={formatBigNumber(userStake.sharesOwned)} /></ListItem>
                            <ListItem><ListItemText primary="Voting Power" secondary={`${ownershipPercentage.toFixed(4)}%`} /></ListItem>
                        </List>
                    </Paper>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6">Market Information</Typography>
                        <List dense>
                            <ListItem><ListItemText primary="Initial Share Price" secondary={`$${formatBigNumber(onChain.initialPrice, 6)}`} /></ListItem>
                            <ListItem><ListItemText primary="Current Price" secondary={<Box sx={{ display: 'flex', alignItems: 'center', color: priceChange >= 0 ? 'success.main' : 'error.main' }}>{`$${formatBigNumber(onChain.pricePerShare, 6)}`}{priceChange > 0 ? <ArrowUpwardIcon/> : <ArrowDownwardIcon/>}</Box>}/></ListItem>
                            <ListItem><ListItemText primary="Total Valuation" secondary={`$${formatBigNumber(totalVentureValue, 6)}`} /></ListItem>
                        </List>
                    </Paper>
                </Grid>
            </Grid>
           
            <Modal open={createProposalModalOpen} onClose={() => setCreateProposalModalOpen(false)} closeAfterTransition slots={{ backdrop: Backdrop }} slotProps={{ backdrop: { timeout: 500 } }}>
                <Fade in={createProposalModalOpen}>
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 500 }, bgcolor: 'background.paper', boxShadow: 24, p: 4 }}>
                        <Typography variant="h6">Create New Proposal</Typography>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Proposal Type</InputLabel>
                            <Select value={proposalData.proposalType} onChange={(e) => setProposalData({ ...proposalData, proposalType: e.target.value })}>
                                <MenuItem value="text">General Discussion</MenuItem>
                                <MenuItem value="distribute_funds">Distribute Funds</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField fullWidth autoFocus margin="normal" label="Title" value={proposalData.title} onChange={(e) => setProposalData({ ...proposalData, title: e.target.value })} />
                        <TextField fullWidth margin="normal" label="Description" multiline rows={4} value={proposalData.description} onChange={(e) => setProposalData({ ...proposalData, description: e.target.value })} />
                        {proposalData.proposalType === 'distribute_funds' && (<Alert severity="info">This calls `distributeFunds` on the treasury.</Alert>)}
                        {proposalError && <Alert severity="error">{proposalError}</Alert>}
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}><Button onClick={() => setCreateProposalModalOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleSubmitProposal} disabled={isActionLoading}>{isActionLoading ? <CircularProgress size={24}/> : 'Submit'}</Button></Box>
                    </Box>
                </Fade>
            </Modal>
            
            <Modal open={voteModalState.open} onClose={handleCloseVoteModal}>
                <Fade in={voteModalState.open}>
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: { xs: '90%', sm: 600 }, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2 }}>
                        {activeModalProposal && (
                            <>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="h6">Cast Your Vote</Typography><IconButton onClick={handleCloseVoteModal}><CloseIcon /></IconButton></Box>
                                <Typography variant="h5" sx={{ mt: 2 }}>{activeModalProposal.title}</Typography>
                                <Chip label={statusLabels[activeModalProposal.status]} color={statusColors[activeModalProposal.status]} size="small" />
                                <Divider sx={{ my: 2 }} />
                                <Typography sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>{activeModalProposal.description}</Typography>
                                <Divider sx={{ my: 2 }} />
                                <Box sx={{ display: 'flex', justifyContent: 'space-around', marginBottom: "20px"}}><Typography>For: <strong>{formatBigNumber(activeModalProposal.for_votes)}</strong></Typography><Typography>Against: <strong>{formatBigNumber(activeModalProposal.against_votes)}</strong></Typography></Box>
                                {isActionLoading && <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress /></Box>}
                                {voteModalState.successMessage && <Alert severity="success" sx={{ mt: 2 }}>{voteModalState.successMessage}</Alert>}
                                {voteModalState.errorMessage && <Alert severity="error" sx={{ mt: 2 }}>{voteModalState.errorMessage}</Alert>}
                                {!voteModalState.successMessage && (
                                    <Box sx={{ mt: 3 }}>
                                        <Typography variant="subtitle1" textAlign="center">Submit your vote directly (requires gas):</Typography>
                                        <Grid container spacing={2} justifyContent="center" sx={{ mt: 1 , marginBottom: "30px"}}>
                                            <Grid item xs={12} sm={6}>
                                                <Button fullWidth variant="contained" color="success" startIcon={<ThumbUpIcon />} onClick={() => handleVoteNormal(activeModalProposal.proposal_onchain_id, VOTE_TYPE.FOR)} disabled={isActionLoading}>Vote For</Button>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                <Button fullWidth variant="contained" color="error" startIcon={<ThumbDownIcon />} onClick={() => handleVoteNormal(activeModalProposal.proposal_onchain_id, VOTE_TYPE.AGAINST)} disabled={isActionLoading}>Vote Against</Button>
                                            </Grid>
                                        </Grid>
                                        <Tooltip title="Gas-free voting will be enabled in a future update." sx={{ mt: 2, display: 'flex', justifyContent: 'center'}}>
                                            <span><Button fullWidth variant="outlined" disabled>Vote Gas-Free (Coming Soon)</Button></span>
                                        </Tooltip>
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>
                </Fade>
            </Modal>
        </Container>
    );
}

export default SteeringCommitteePage;