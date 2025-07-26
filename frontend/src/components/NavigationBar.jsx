import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { NavLink } from 'react-router-dom';

function NavigationBar({ account, setAccount, user, setUser }) {
  const navLinkStyle = { color: 'inherit', textDecoration: 'none', margin: '0 16px', padding: '8px 16px', borderRadius: '4px' };
  const activeLinkStyle = { backgroundColor: 'rgba(0, 191, 165, 0.2)' };

  const handleDisconnect = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          <NavLink to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            VentureHUB
          </NavLink>
        </Typography>
        <Box>
          {user && user.role === 'vc' && (
            <>
              <NavLink to="/deal-flow" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>Deal Flow</NavLink>
              <NavLink to="/portfolio" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>Portfolio</NavLink>
            </>
          )}
          {user && user.role === 'entrepreneur' && (
            <>
              <NavLink to="/my-ventures" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>My Ventures</NavLink>
              <NavLink to="/incubate" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>Incubate</NavLink>
            </>
          )}
          
          {user && (
             <NavLink to="/exchange" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>Exchange</NavLink>
          )}
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        
        {user && user.walletAddress && (
          <Typography sx={{ mr: 2, border: '1px solid grey', p: '4px 8px', borderRadius: '4px' }}>
            {`${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}`}
          </Typography>
        )}
        
        <Button variant="outlined" color="secondary" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </Toolbar>
    </AppBar>
  );
}

export default NavigationBar;