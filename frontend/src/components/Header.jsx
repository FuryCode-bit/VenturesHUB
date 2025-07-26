import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link } from 'react-router-dom';

function Header() {
  return (
    <AppBar position="static" color="transparent" elevation={0}>
      <Toolbar>
        <Typography variant="h6" component={Link} to="/" sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}>
          VentureHUB
        </Typography>
        <Box>
          <Button component={Link} to="/login" color="inherit" sx={{ mr: 1 }}>Login</Button>
          <Button component={Link} to="/login" variant="contained" color="primary">Fund Your Startup</Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
export default Header;