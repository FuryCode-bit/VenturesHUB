import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import {
  Container, Grid, Card, CardContent, CardActions, Button,
  Typography, Box, LinearProgress, Chip, Modal, TextField,
  CircularProgress, Alert, CardMedia, Divider, List, ListItem, ListItemText
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

// --- Import ABIs ---
import SaleTreasuryABI from '../abi/SaleTreasury.json';
import MockERC20ABI from '../abi/MockERC20.json';

// --- Helper Functions & Constants ---
const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 400, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2
};
const MOCK_USDC_ADDRESS = process.env.REACT_APP_MOCK_USDC_CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const getIpfsUrl = (ipfsUri) => {
  if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return 'https://via.placeholder.com/300';
  const cid = ipfsUri.substring(7);
  return `https://ipfs.io/ipfs/${cid}`;
};

const formatUSDC = (value) => {
    if (!value || value.toString() === '0') return '0.00';
    return parseFloat(ethers.formatUnits(value, 6)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

function DealFlowPage() {
  const [ventures, setVentures] = useState([]);
  const [ventureStats, setVentureStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedVenture, setSelectedVenture] = useState(null);
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [sharesToReceive, setSharesToReceive] = useState('');
  const [isInvesting, setIsInvesting] = useState(false);
  const [investError, setInvestError] = useState('');
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const venturesRes = await axios.get('http://localhost:4000/api/ventures', { headers: { 'x-auth-token': token } });
        setVentures(venturesRes.data);
        if (venturesRes.data.length > 0) {
          const statsPromises = venturesRes.data.map(v => axios.get(`http://localhost:4000/api/ventures/${v.id}/stats`, { headers: { 'x-auth-token': token } }));
          const statsResults = await Promise.allSettled(statsPromises);
          const newStats = {};
          statsResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              newStats[venturesRes.data[index].id] = result.value.data;
            }
          });
          setVentureStats(newStats);
        }
      } catch (err) {
        setError('Could not load the deal flow.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [token]);

  const handleOpenModal = (venture) => {
    setSelectedVenture(venture);
    setInvestmentAmount('');
    setSharesToReceive('');
    setInvestError('');
    setModalOpen(true);
  };
  const handleCloseModal = () => { if (!isInvesting) setModalOpen(false); };

  useEffect(() => {
      if (investmentAmount > 0 && selectedVenture && ventureStats[selectedVenture.id]) {
        try {
          const stats = ventureStats[selectedVenture.id];
          const pricePerShare = ethers.toBigInt(stats.pricePerShare);
          if (pricePerShare > 0n) {
            const shares = (ethers.parseUnits(investmentAmount, 6) * (10n ** 18n)) / pricePerShare;
            setSharesToReceive(ethers.formatUnits(shares, 18));
          } else {
            setSharesToReceive('N/A - Price is zero');
          }
        } catch (e) { setSharesToReceive('Invalid amount'); }
      } else {
        setSharesToReceive('');
      }
  }, [investmentAmount, selectedVenture, ventureStats]);

 const handleInvest = async () => {
    if (!investmentAmount || +investmentAmount <= 0) { setInvestError("Please enter a valid amount."); return; }
    setInvestError('');
    setIsInvesting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, MockERC20ABI, signer);
      const saleTreasuryContract = new ethers.Contract(selectedVenture.sale_treasury_address, SaleTreasuryABI, signer);
      const amountToInvest = ethers.parseUnits(investmentAmount, 6);
      await (await usdcContract.approve(selectedVenture.sale_treasury_address, amountToInvest)).wait();
      const numSharesToBuy = ethers.parseUnits(sharesToReceive, 18);
      await (await saleTreasuryContract.buyShares(numSharesToBuy)).wait();
      await axios.post('http://localhost:4000/api/investments/record',
        { ventureId: selectedVenture.id, sharesOwned: numSharesToBuy.toString() },
        { headers: { 'x-auth-token': token } }
      );
      alert("Investment successful!");
      handleCloseModal();
    } catch (err) {
      setInvestError(err.reason || "Transaction failed.");
    } finally {
      setIsInvesting(false);
    }
  };

  const renderVentureCards = () => {
    if (ventures.length === 0) return <Typography>No ventures are seeking investment.</Typography>;
    
    return ventures.map((venture) => {
      const stats = ventureStats[venture.id];
      let totalVentureValue = '0';
      let priceChange = 0;
      let initialPriceNum = 0, currentPriceNum = 0;

      if (stats && stats.totalShares && stats.pricePerShare && stats.initialPrice) {
          try {
            initialPriceNum = parseFloat(ethers.formatUnits(stats.initialPrice, 6));
            currentPriceNum = parseFloat(ethers.formatUnits(stats.pricePerShare, 6));
            if (initialPriceNum > 0 && currentPriceNum > 0) {
                priceChange = ((currentPriceNum - initialPriceNum) / initialPriceNum) * 100;
            }

            const totalSharesBN = ethers.toBigInt(stats.totalShares);
            const pricePerShareBN = ethers.toBigInt(stats.pricePerShare);

            const totalValueBN = (totalSharesBN * pricePerShareBN) / (10n ** 18n);
            totalVentureValue = totalValueBN.toString();
          } catch(e) {
              console.error(`Could not calculate stats for venture ${venture.id}`, e);
          }
      }

      return (
        <Grid item key={venture.id} xs={12} sm={6} md={4} lg={3}>
          <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: '250px', maxWidth: '250px', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardMedia component="img" height="160" image={getIpfsUrl(venture.logo_url)} alt={`${venture.name} logo`} sx={{ objectFit: 'contain', p: 1 }}/>
            <CardContent sx={{ flexGrow: 1 }}>
              <Typography variant="h5" component="div" gutterBottom>{venture.name}</Typography>
              <Chip label={venture.industry} color="primary" size="small" />
              
              <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Current Valuation</Typography>
                  <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                    {stats ? `$${formatUSDC(totalVentureValue)}`: '...'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {stats ? `$${formatUSDC(stats.pricePerShare)} / Share` : '...'}
                      {stats && currentPriceNum > 0 && priceChange !== 0 && (
                          <Box component="span" sx={{ display: 'flex', alignItems: 'center', color: priceChange >= 0 ? 'success.main' : 'error.main' }}>
                            {priceChange > 0 ? <ArrowUpwardIcon sx={{ fontSize: '1rem' }} /> : <ArrowDownwardIcon sx={{ fontSize: '1rem' }} />}
                            <Typography variant="caption">({priceChange.toFixed(1)}%)</Typography>
                          </Box>
                      )}
                  </Typography>
              </Box>
            </CardContent>
            <CardActions sx={{ justifyContent: 'space-between', mt: 'auto' }}>
              <Button size="small" component={Link} to={`/ventures/${venture.id}`}>Details</Button>
              <Button size="small" variant="contained" onClick={() => handleOpenModal(venture)}>Invest</Button>
            </CardActions>
          </Card>
        </Grid>
      );
    });
  };

  if (loading) return <Container sx={{ textAlign: 'center', mt: 10 }}><CircularProgress /></Container>;
  if (error) return <Container><Alert severity="error" sx={{ mt: 4 }}>{error}</Alert></Container>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>Deal Flow</Typography>
      <Grid container spacing={4}>
        {renderVentureCards()}
      </Grid>
      
      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2">Invest in {selectedVenture?.name}</Typography>
          <Typography sx={{ mt: 2 }}>
            Price per Share: {selectedVenture && ventureStats[selectedVenture.id] ? `${formatUSDC(ventureStats[selectedVenture.id].pricePerShare)} USDC` : '...'}
          </Typography>
          <TextField fullWidth label="Amount to Invest (USDC)" type="number" sx={{ mt: 2 }} value={investmentAmount} onChange={(e) => setInvestmentAmount(e.target.value)} disabled={isInvesting}/>
          <TextField fullWidth label="Shares to Receive" type="text" sx={{ mt: 2 }} value={sharesToReceive} InputProps={{ readOnly: true }}/>
          {investError && <Alert severity="error" sx={{ mt: 2 }}>{investError}</Alert>}
          <Button fullWidth variant="contained" sx={{ mt: 3 }} onClick={handleInvest} disabled={isInvesting || !investmentAmount || !sharesToReceive || sharesToReceive.startsWith('Invalid')}>
            {isInvesting ? <CircularProgress size={24} /> : 'Finalize Investment'}
          </Button>
        </Box>
      </Modal>
    </Container>
  );
}

export default DealFlowPage;