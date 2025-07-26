import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, Tooltip } from '@mui/material';
import { ethers } from 'ethers';
import axios from 'axios';

const API_SERVER_URL = 'http://localhost:4000';

function EntrepreneurLayout({ user, setUser }) {
  const [walletAddress, setWalletAddress] = useState(user.walletAddress || null);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  const connectWalletHandler = async () => {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found.");
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      const token = localStorage.getItem('token');
      if (!token) throw new Error("Authentication token not found. Please log in again.");
      
      await axios.post(`${API_SERVER_URL}/api/users/link-wallet`, 
        { walletAddress: address },
        { headers: { 'x-auth-token': token } }
      );

      setWalletAddress(address);
      const updatedUser = { ...user, walletAddress: address };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      alert('Wallet linked successfully!');
      
    } catch (error) {
      const message = error.response?.data?.message || "Failed to link wallet.";
      console.error(message, error);
      alert(message);
    }
  };

  const navLinkStyle = { color: 'inherit', textDecoration: 'none', margin: '0 16px', padding: '8px 16px', borderRadius: '4px' };
  const activeLinkStyle = { backgroundColor: 'rgba(0, 191, 165, 0.2)' };

  return (
    <Box>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>VentureHUB</Typography>
          <Box>
            <NavLink to="/my-ventures" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>
              My Ventures
            </NavLink>
            <NavLink to="/marketplace" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>
              Marketplace
            </NavLink>
            <NavLink to="/exchange" style={({ isActive }) => ({ ...navLinkStyle, ...(isActive ? activeLinkStyle : {}) })}>
              Exchange
            </NavLink>
            <Tooltip title={!walletAddress ? "Connect wallet to launch a new venture" : ""}>
              <span>
                <Button 
                  component={NavLink} 
                  to="/incubate" 
                  disabled={!walletAddress}
                  sx={{ ...navLinkStyle, color: !walletAddress ? 'grey' : 'inherit' }}
                >
                  + Launch New Venture
                </Button>
              </span>
            </Tooltip>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {walletAddress ? (
            <Typography sx={{ mr: 2, border: '1px solid grey', p: '4px 8px', borderRadius: '4px' }}>
              {`${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`}
            </Typography>
          ) : (
            <Button variant="contained" color="primary" onClick={connectWalletHandler} sx={{ mr: 2 }}>
              Connect Wallet
            </Button>
          )}
          <Button variant="outlined" color="secondary" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <main>
        <Outlet />
      </main>
    </Box>
  );
}

export default EntrepreneurLayout;