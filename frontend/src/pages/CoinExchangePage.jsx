import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Container, Typography, Box, Paper, TextField, Button, CircularProgress, Alert } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

// --- ABIs ---
import SimpleExchangeABI from '../abi/SimpleExchange.json';
import MockERC20ABI from '../abi/MockERC20.json';

// --- Constants ---
const EXCHANGE_ADDRESS = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const USDC_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const EXCHANGE_RATE = 1; // 1 ETH = 1 USDC

function CoinExchangePage() {
  const [ethAmount, setEthAmount] = useState('');
  const [usdcToReceive, setUsdcToReceive] = useState('');
  const [ethBalance, setEthBalance] = useState('0');
  const [usdcBalance, setUsdcBalance] = useState('0');
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchBalances = async () => {
      if (!window.ethereum) return;
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const ethBal = await provider.getBalance(signer.address);
      setEthBalance(ethers.formatEther(ethBal));
      
      const usdcContract = new ethers.Contract(USDC_ADDRESS, MockERC20ABI, signer);
      const usdcBal = await usdcContract.balanceOf(signer.address);
      setUsdcBalance(ethers.formatUnits(usdcBal, 6));
    };
    fetchBalances();
  }, []);
  
  useEffect(() => {
    const amount = parseFloat(ethAmount);
    if (amount > 0) {
      setUsdcToReceive((amount * EXCHANGE_RATE).toString());
    } else {
      setUsdcToReceive('');
    }
  }, [ethAmount]);

  const handleSwap = async () => {
    if (!ethAmount || parseFloat(ethAmount) <= 0) {
      setError("Please enter a valid ETH amount.");
      return;
    }

    setError('');
    setSuccess('');
    setIsSwapping(true);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const exchangeContract = new ethers.Contract(EXCHANGE_ADDRESS, SimpleExchangeABI, signer);

      const ethValue = ethers.parseEther(ethAmount);
      
      console.log(`Exchanging ${ethAmount} ETH for USDC...`);
      const tx = await exchangeContract.swapEthForUsdc({ value: ethValue });
      await tx.wait();
      
      setSuccess(`Successfully swapped for ${usdcToReceive} USDC!`);
      
      const ethBal = await provider.getBalance(signer.address);
      setEthBalance(ethers.formatEther(ethBal));
      const usdcContract = new ethers.Contract(USDC_ADDRESS, MockERC20ABI, signer);
      const usdcBal = await usdcContract.balanceOf(signer.address);
      setUsdcBalance(ethers.formatUnits(usdcBal, 6));

    } catch (err) {
      console.error("Swap failed:", err);
      setError(err.reason || "Transaction failed. See console.");
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" gutterBottom align="center">Coin Exchange</Typography>
        <Typography color="text.secondary" align="center" paragraph>
          Swap ETH for Mock USDC to participate in venture funding.
        </Typography>
        <Typography align="center" sx={{ mb: 2 }}>
            <strong>Rate:</strong> 1 ETH ≈ {EXCHANGE_RATE.toLocaleString()} mUSDC
        </Typography>
        
        <Box sx={{ my: 2 }}>
          <Typography variant="caption">Your ETH Balance: {parseFloat(ethBalance).toFixed(4)}</Typography>
          <TextField
            fullWidth
            label="Amount to Swap (ETH)"
            type="number"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            disabled={isSwapping}
          />
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
          <SwapHorizIcon color="primary" />
        </Box>
        
        <Box sx={{ my: 2 }}>
          <Typography variant="caption">Your mUSDC Balance: {parseFloat(usdcBalance).toLocaleString()}</Typography>
          <TextField
            fullWidth
            label="Amount to Receive (mUSDC)"
            type="text"
            value={usdcToReceive}
            InputProps={{ readOnly: true }}
          />
        </Box>

        {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ my: 2 }}>{success}</Alert>}
        
        <Button
          fullWidth
          variant="contained"
          size="large"
          sx={{ mt: 2 }}
          onClick={handleSwap}
          disabled={isSwapping || !ethAmount}
        >
          {isSwapping ? <CircularProgress size={24} /> : 'Exchange'}
        </Button>
      </Paper>
    </Container>
  );
}

export default CoinExchangePage;