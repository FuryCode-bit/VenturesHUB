import React from 'react';
import { Box, Typography, Container, Button, Grid } from '@mui/material';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

function MainPage() {
  return (
    <>
      <Container maxWidth="md" sx={{ textAlign: 'center', mt: 10 }}>
        <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
          Fund the Future, Fractionally.
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          VentureHUB is the decentralized platform transforming high-risk, high-reward intellectual property into liquid, investable assets.
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          We empower innovators to raise capital and allow investors to fund the next wave of innovation with unparalleled transparency and efficiency.
        </Typography>
        <Box sx={{ mt: 5 }}>
          <Button component={Link} to="/login" variant="contained" color="primary" size="large" sx={{ mr: 2 }}>
            Explore Deals
          </Button>
          <Button component={Link} to="/login" variant="outlined" color="primary" size="large">
            Fund Your Startup
          </Button>
        </Box>
      </Container>
    </>
  );
}
export default MainPage;