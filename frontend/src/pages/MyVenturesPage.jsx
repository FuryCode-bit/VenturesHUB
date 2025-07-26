import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Typography, Paper, Box, Button, Alert, CircularProgress,
  Grid, Card, CardContent, CardActions, CardMedia, Chip,
  LinearProgress, Divider, List, ListItem, ListItemText
} from '@mui/material';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('token');

const getIpfsUrl = (ipfsUri) => {
  if (!ipfsUri || !ipfsUri.startsWith('ipfs://')) return 'https://via.placeholder.com/300';
  const cid = ipfsUri.substring(7);
  return `https://ipfs.io/ipfs/${cid}`;
};

const formatUSDC = (value) => {
    if (!value || value === '0') return '0.00';
    return parseFloat(ethers.formatUnits(value, 6)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

function MyVenturesPage() {
  const [ventures, setVentures] = useState([]);
  const [ventureStats, setVentureStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasWallet = user && user.walletAddress;

  useEffect(() => {
    if (!hasWallet) { setLoading(false); return; }
    const fetchVenturesAndStats = async () => {
      try {
        setLoading(true);
        const venturesRes = await axios.get('http://localhost:4000/api/portfolio/all', { headers: { 'x-auth-token': token } });
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
        setError('Failed to fetch your ventures.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchVenturesAndStats();
  }, [hasWallet]);

  const renderVentureCards = () => {
    if (ventures.length === 0) return <Typography color="text.secondary" sx={{ mt: 2 }}>You have not launched any ventures yet.</Typography>;
    return (
      <Grid container spacing={4}>
        {ventures.map((venture) => {
          const stats = ventureStats[venture.id];
          let raised = 0, progress = 0, totalVentureValue = '0', priceChange = 0;
          let currentPriceNum = 0, initialPriceNum = 0;

          if (stats && stats.initialPrice && stats.pricePerShare && stats.totalShares) {
            try {
              initialPriceNum = parseFloat(ethers.formatUnits(stats.initialPrice, 6));
              const sold = parseFloat(ethers.formatUnits(stats.sharesSold, 18));
              raised = initialPriceNum * sold;
              progress = venture.fundraising_goal > 0 ? (raised / venture.fundraising_goal) * 100 : 0;
              
              currentPriceNum = parseFloat(ethers.formatUnits(stats.pricePerShare, 6));
              if (initialPriceNum > 0 && currentPriceNum > 0) {
                  priceChange = ((currentPriceNum - initialPriceNum) / initialPriceNum) * 100;
              }
              
              const totalSharesBN = ethers.toBigInt(stats.totalShares);
              const pricePerShareBN = ethers.toBigInt(stats.pricePerShare);
              
              const totalValueBN = (totalSharesBN * pricePerShareBN) / (10n ** 18n);
              totalVentureValue = totalValueBN.toString();

            } catch (e) {
              console.error(`Error calculating stats for venture ${venture.id}`, e);
            }
          }

          return (
            <Grid item key={venture.id} xs={12} sm={6} md={4} lg={3}>
              <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: '250px', maxWidth: '250px', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <CardMedia component="img" height="160" image={getIpfsUrl(venture.logo_url)} alt={`${venture.name} logo`} sx={{ objectFit: 'contain', p: 1 }} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h5" component="div" gutterBottom>{venture.name}</Typography>
                  <Chip label={venture.industry} color="primary" size="small" />
                  <Box sx={{ width: '100%', mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">Fundraising Progress</Typography>
                    <Typography variant="body2">{stats ? `$${Math.round(raised).toLocaleString()} / $${parseInt(venture.fundraising_goal).toLocaleString()}` : '...'}</Typography>
                    <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 5, mt: 0.5 }} />
                  </Box>
                  <Divider sx={{ my: 2 }} />
                  <List dense sx={{p:0, overflow: 'hidden'}}>
                    <ListItem sx={{p:0}}><ListItemText primary="Initial Share Price" secondary={stats ? `$${formatUSDC(stats.initialPrice)}` : '...'}/></ListItem>
                    <ListItem sx={{p:0}}>
                        <ListItemText primary="Current Market Price" secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: priceChange >= 0 ? 'success.main' : 'error.main' }}>
                                <Typography component="span" sx={{ fontWeight: 'bold' }}>
                                    {stats ? `$${formatUSDC(stats.pricePerShare)}` : '...'}
                                </Typography>
                                {stats && currentPriceNum > 0 && priceChange !== 0 && ( priceChange > 0 ? <ArrowUpwardIcon sx={{ fontSize: '1rem' }} /> : <ArrowDownwardIcon sx={{ fontSize: '1rem' }} />)}
                                {stats && currentPriceNum > 0 && priceChange !== 0 && ( <Typography component="span" sx={{ fontSize: '0.8rem' }}>({priceChange.toFixed(2)}%)</Typography> )}
                            </Box>
                        }/>
                    </ListItem>
                     <ListItem sx={{p:0}}>
                      <ListItemText
                        primary="Total Valuation"
                        secondaryTypographyProps={{ color: 'primary.main', fontWeight: 'bold' }}
                        secondary={stats ? `$${formatUSDC(totalVentureValue)}` : '...'}
                      />
                    </ListItem>
                  </List>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between' }}>
                  <Button size="small" component={Link} to={`/ventures/${venture.id}`}>Details</Button>
                  <Button size="small" variant="contained" component={Link} to={`/committee/${venture.id}`}>Manage</Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };
  
  if (loading) return <Container sx={{ textAlign: 'center', mt: 10 }}><CircularProgress /></Container>;
  
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>My Ventures Dashboard</Typography>
        <Button component={Link} to="/incubate" variant="contained" disabled={!hasWallet}>Launch New Venture</Button>
      </Box>
      {!hasWallet && <Alert severity="warning" sx={{ mb: 4 }}><strong>Action Required:</strong> Please connect your wallet to launch and manage your ventures.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <Paper sx={{ p: 3, mt: 4, background: 'transparent', boxShadow: 'none', pt: "15px" }}>
        {hasWallet ? renderVentureCards() : <Typography color="text.secondary" sx={{ mt: 2 }}>Connect your wallet to see your ventures.</Typography>}
      </Paper>
    </Container>
  );
}

export default MyVenturesPage;