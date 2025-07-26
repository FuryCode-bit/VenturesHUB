import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container, Typography, Grid, Card, CardContent, CardActions, Button,
  Modal, Box, TextField, CircularProgress, Alert, CardMedia, Chip
} from '@mui/material';
import { ethers } from 'ethers';

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

const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 400, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2
};

function AdminPage() {
    const [ventures, setVentures] = useState([]);
    const [ventureStats, setVentureStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedVenture, setSelectedVenture] = useState(null);
    const [newPrice, setNewPrice] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

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
        setError('Could not load ventures.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const handleOpenModal = (venture) => {
        setSelectedVenture(venture);
        setNewPrice('');
        setSaveError('');
        setModalOpen(true);
    };
    
    const handleCloseModal = () => { if (!isSaving) setModalOpen(false); };

    const handleSetPrice = async () => {
        if (!newPrice || +newPrice <= 0) {
            setSaveError('Please enter a valid price.');
            return;
        }
        setIsSaving(true);
        setSaveError('');
        try {
            await axios.post('http://localhost:4000/api/admin/set-price', 
                { ventureId: selectedVenture.id, newPrice },
                { headers: { 'x-auth-token': token } }
            );
            alert('Price updated successfully!');
            handleCloseModal();
            fetchAllData(); 
        } catch (error) {
            setSaveError(error.response?.data?.message || 'Failed to set price.');
        } finally {
            setIsSaving(false);
        }
    };
    
    if (loading) return <Container sx={{ textAlign: 'center', mt: 10 }}><CircularProgress /></Container>;
    if (error) return <Container><Alert severity="error">{error}</Alert></Container>;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Admin Demo Controls</Typography>
            <Typography color="text.secondary" paragraph>Set the simulated market price for any venture.</Typography>
            
            <Grid container spacing={4}>
                {ventures.map((venture) => {
                    const stats = ventureStats[venture.id];
                    return (
                        <Grid item key={venture.id} xs={12} sm={6} md={4} lg={3}>
                            <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: '250px', maxWidth: '250px',border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                <CardMedia component="img" height="160" image={getIpfsUrl(venture.logo_url)} alt={`${venture.name} logo`} sx={{ objectFit: 'contain', p: 1 }}/>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Typography variant="h5" component="div">{venture.name}</Typography>
                                    <Chip label={venture.industry || 'N/A'} color="primary" size="small" />
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="body2" color="text.secondary">Current Market Price</Typography>
                                        <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                                            {stats ? `$${formatUSDC(stats.pricePerShare)}` : '...'}
                                        </Typography>
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'center', p: 2 }}>
                                    <Button fullWidth variant="contained" onClick={() => handleOpenModal(venture)}>
                                        Set Price
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            {/* --- Set Price Modal --- */}
            <Modal open={modalOpen} onClose={handleCloseModal}>
                <Box sx={modalStyle}>
                    <Typography variant="h6" component="h2">Set Market Price for {selectedVenture?.name}</Typography>
                    <TextField
                        fullWidth
                        label="New Market Price (USDC)"
                        type="number"
                        sx={{ mt: 2 }}
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        disabled={isSaving}
                    />
                    {saveError && <Alert severity="error" sx={{ mt: 2 }}>{saveError}</Alert>}
                    <Button
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3 }}
                        onClick={handleSetPrice}
                        disabled={isSaving || !newPrice}
                    >
                        {isSaving ? <CircularProgress size={24} /> : 'Confirm New Price'}
                    </Button>
                </Box>
            </Modal>
        </Container>
    );
}

export default AdminPage;