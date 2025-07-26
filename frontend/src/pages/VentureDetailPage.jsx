import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Container, Typography, Paper, Box, Grid, CircularProgress, Alert,
  List, ListItem, ListItemText, Divider, Link as MuiLink
} from '@mui/material';
import { ethers } from 'ethers';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

const formatUSDC = (value) => {
    if (!value || value === '0') return '0.00';
    return parseFloat(ethers.formatUnits(value, 6)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatBigNumber = (value, decimals = 18) => {
    if (value == null || value.toString() === '0') return '0.00';
    try {
        return parseFloat(ethers.formatUnits(value, decimals)).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    } catch (e) {
        return '...';
    }
};

function VentureDetailPage() {
  const { id } = useParams();
  const [venture, setVenture] = useState(null);
  const [ventureStats, setVentureStats] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchAllData = async () => {
      if (!token) {
        setError('You must be logged in to view this page.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [ventureRes, statsRes] = await Promise.all([
          axios.get(`http://localhost:4000/api/ventures/${id}`, { headers: { 'x-auth-token': token } }),
          axios.get(`http://localhost:4000/api/ventures/${id}/stats`, { headers: { 'x-auth-token': token } })
        ]);
        const ventureData = ventureRes.data;
        setVenture(ventureData);
        setVentureStats(statsRes.data);
        if (ventureData?.ipfs_metadata_uri) {
          const ipfsHash = ventureData.ipfs_metadata_uri.replace('ipfs://', '');
          const metadataRes = await axios.get(`${IPFS_GATEWAY}${ipfsHash}`);
          if (metadataRes.data?.image) {
            const imageCID = metadataRes.data.image.replace('ipfs://', '');
            setLogoUrl(`${IPFS_GATEWAY}${imageCID}`);
          }
        }
      } catch (err) {
        setError('Failed to fetch venture data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [id, token]);

  const getEtherscanLink = (address) => `https://sepolia.etherscan.io/address/${address}`;

  if (loading) return <Container sx={{ mt: 10, textAlign: 'center' }}><CircularProgress /></Container>;
  if (error) return <Container><Alert severity="error" sx={{ mt: 4 }}>{error}</Alert></Container>;
  if (!venture || !ventureStats) return <Container><Typography variant="h5" sx={{ mt: 4 }}>Venture data not found.</Typography></Container>;

  let totalVentureValue = '0';
  let priceChange = 0;
  const hasSetCurrentPrice = ventureStats.pricePerShare && ethers.toBigInt(ventureStats.pricePerShare) > 0n;
  
  if (hasSetCurrentPrice && ventureStats.initialPrice) {
      try {
        const totalSharesBN = ethers.toBigInt(ventureStats.totalShares);
        const currentPriceBN = ethers.toBigInt(ventureStats.pricePerShare);

        const totalValueBN = (totalSharesBN * currentPriceBN) / (10n ** 18n);
        totalVentureValue = totalValueBN.toString();
        
        const initialPriceNum = parseFloat(ethers.formatUnits(ventureStats.initialPrice, 6));
        const currentPriceNum = parseFloat(ethers.formatUnits(ventureStats.pricePerShare, 6));
        if (initialPriceNum > 0) {
          priceChange = ((currentPriceNum - initialPriceNum) / initialPriceNum) * 100;
        }
      } catch (e) {
          console.error("Error calculating valuation:", e);
      }
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        {logoUrl && (
          <Box sx={{ width: 100, height: 100, mr: 3, flexShrink: 0, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <img src={logoUrl} alt={`${venture.name} logo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
        )}
        <Box>
          <Typography variant="h3" component="h1">{venture.name}</Typography>
          <Typography variant="h6" color="text.secondary">{venture.industry}</Typography>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom>Financial Snapshot</Typography>
        <Grid container spacing={{ xs: 2, md: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="body2" color="text.secondary">Total Venture Valuation</Typography>
            <Typography variant="h5" color="primary.main" sx={{ fontWeight: 'bold' }}>
              {hasSetCurrentPrice ? `$${formatUSDC(totalVentureValue)}` : 'Not Set'}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="body2" color="text.secondary">Current Share Price</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                {hasSetCurrentPrice ? `$${formatUSDC(ventureStats.pricePerShare)}` : 'Not Set'}
              </Typography>
              {hasSetCurrentPrice && priceChange !== 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', color: priceChange >= 0 ? 'success.main' : 'error.main' }}>
                  {priceChange > 0 ? <ArrowUpwardIcon sx={{ fontSize: '1rem' }} /> : <ArrowDownwardIcon sx={{ fontSize: '1rem' }} />}
                  <Typography variant="body2" component="span">({priceChange.toFixed(2)}%)</Typography>
                </Box>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="body2" color="text.secondary">Initial Share Price</Typography>
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{`$${formatUSDC(ventureStats.initialPrice)}`}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom>Mission</Typography>
            <Typography paragraph sx={{ whiteSpace: 'pre-wrap', mb: 4 }}>{venture.mission}</Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h5" gutterBottom>Team</Typography>
            <Typography paragraph sx={{ whiteSpace: 'pre-wrap' }}>{venture.team_info}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>On-Chain Contracts</Typography>
            <List dense>
              <ListItem><ListItemText primary="Fundraising Goal" secondary={`$${parseInt(venture.fundraising_goal).toLocaleString()}`} /></ListItem>
              <ListItem><ListItemText primary="Total Shares" secondary={formatBigNumber(venture.total_shares, 18)} /></ListItem>
              <Divider component="li" sx={{ my: 1 }} />
              <ListItem><ListItemText primary="Share Token" secondary={<MuiLink href={getEtherscanLink(venture.share_token_address)} target="_blank" rel="noopener"><code>{venture.share_token_address}</code></MuiLink>} /></ListItem>
              <ListItem><ListItemText primary="DAO" secondary={<MuiLink href={getEtherscanLink(venture.dao_address)} target="_blank" rel="noopener"><code>{venture.dao_address}</code></MuiLink>} /></ListItem>
              <ListItem><ListItemText primary="Treasury (Sale)" secondary={<MuiLink href={getEtherscanLink(venture.sale_treasury_address)} target="_blank" rel="noopener"><code>{venture.sale_treasury_address}</code></MuiLink>} /></ListItem>
              <ListItem><ListItemText primary="NFT Vault" secondary={<MuiLink href={getEtherscanLink(venture.vault_address)} target="_blank" rel="noopener"><code>{venture.vault_address}</code></MuiLink>} /></ListItem>
              <ListItem><ListItemText primary="Timelock" secondary={<MuiLink href={getEtherscanLink(venture.timelock_address)} target="_blank" rel="noopener"><code>{venture.timelock_address}</code></MuiLink>} /></ListItem>
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default VentureDetailPage;