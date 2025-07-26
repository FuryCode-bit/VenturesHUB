import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Typography, Box, Alert, CircularProgress,
  Grid, Card, CardContent, CardActions, Button, CardMedia, Chip, Divider,
  List, ListItem, ListItemText
} from '@mui/material';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const token = localStorage.getItem('token');
const getIpfsUrl = (ipfsUri) => {
  if (!ipfsUri) return 'https://via.placeholder.com/300';
  const cid = ipfsUri.substring(7);
  return `https://ipfs.io/ipfs/${cid}`;
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

function VcPortfolioPage() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:4000/api/portfolio/all', { headers: { 'x-auth-token': token } });
        setInvestments(response.data);
      } catch (err) {
        setError('Failed to fetch your investment portfolio.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPortfolio();
  }, []);

  if (loading) return <Container sx={{ textAlign: 'center', mt: 10 }}><CircularProgress /></Container>;
  if (error) return <Container><Alert severity="error">{error}</Alert></Container>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>My Investment Portfolio</Typography>
      
      {investments.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 2 }}>You have not invested in any ventures yet.</Typography>
      ) : (
        <Grid container spacing={4}>
          {investments.map((investment) => {

            const hasOnchainData = investment.currentPrice != null && investment.initialPrice != null;

            const userSharesBN = ethers.toBigInt(investment.shares_owned || '0');
            const totalSharesBN = ethers.toBigInt(investment.total_shares ? investment.total_shares.toString() : '0');
            const ownershipPercentage = totalSharesBN > 0n ? Number((userSharesBN * 10000n) / totalSharesBN) / 100 : 0;
            
            let priceChange = 0;
            if (hasOnchainData) {
                const initialPriceNum = parseFloat(ethers.formatUnits(investment.initialPrice, 6));
                const currentPriceNum = parseFloat(ethers.formatUnits(investment.currentPrice, 6));
                if (initialPriceNum > 0 && currentPriceNum > 0) {
                    priceChange = ((currentPriceNum - initialPriceNum) / initialPriceNum) * 100;
                }
            }

            return (
              <Grid item key={investment.id} xs={12} sm={6} md={4} lg={3}>
                <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: "250px", maxWidth: "250px", border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <CardMedia component="img" height="160" image={getIpfsUrl(investment.logo_url)} alt={`${investment.name} logo`} sx={{ objectFit: 'contain', p: 1 }} />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h5" component="div" gutterBottom>{investment.name}</Typography>
                    <Chip label={investment.industry} color="primary" size="small" />
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">Your Stake</Typography>
                      <Typography>{formatBigNumber(investment.shares_owned, 18)} Shares</Typography>
                      <Typography color="primary.main" sx={{ fontWeight: 'bold' }}>{ownershipPercentage.toFixed(4)}%</Typography>
                      
                      <Typography 
                        sx={{ fontWeight: 'bold', mt: 1, color: priceChange >= 0 ? 'success.main' : 'error.main' }}
                      >
                        Value: {hasOnchainData ? `$${formatBigNumber(investment.currentValue, 6)}` : '...'}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <List dense sx={{p:0, overflow: 'hidden'}}>
                        <ListItem sx={{p:0}}>
                            <ListItemText primary="Initial Share Price" secondary={hasOnchainData ? `$${formatBigNumber(investment.initialPrice, 6)}` : '...'}/>
                        </ListItem>
                        <ListItem sx={{p:0}}>
                            <ListItemText primary="Current Market Price" secondary={
                                hasOnchainData ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: priceChange >= 0 ? 'success.main' : 'error.main' }}>
                                        <Typography component="span" sx={{ fontWeight: 'bold' }}>{`$${formatBigNumber(investment.currentPrice, 6)}`}</Typography>
                                        {priceChange !== 0 && ( priceChange > 0 ? <ArrowUpwardIcon sx={{ fontSize: '1rem' }} /> : <ArrowDownwardIcon sx={{ fontSize: '1rem' }} />)}
                                        {priceChange !== 0 && ( <Typography component="span" sx={{ fontSize: '0.8rem' }}>({priceChange.toFixed(2)}%)</Typography> )}
                                    </Box>
                                ) : (
                                    <Typography>...</Typography>
                                )
                            }/>
                        </ListItem>
                    </List>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'space-between' }}>
                    <Button size="small" component={Link} to={`/ventures/${investment.id}`}>Details</Button>
                    <Button size="small" variant="contained" component={Link} to={`/committee/${investment.id}`}>Govern</Button>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
}

export default VcPortfolioPage;