import React, { useState } from 'react';
import { Box, Button, Typography, Container, Paper, TextField, Link as MuiLink, CircularProgress, FormControl, InputLabel, Select, MenuItem, Avatar } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_SERVER_URL = 'http://localhost:4000';

function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('entrepreneur');
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
    }

    setIsLoading(true);
    setLoadingMessage('Creating your account...');

    try {
      const userData = { fullName, email, password, role };
      
      // The backend now handles image generation
      setLoadingMessage('Generating your unique AI profile picture...');
      const response = await axios.post(`${API_SERVER_URL}/api/auth/register`, userData);
      
      setLoadingMessage('Success! Redirecting...');
      setSuccess('Registration successful! You can now log in.');
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      console.error("Registration failed:", err);
      const message = err.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
      setIsLoading(false);
    } 
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', height: '100vh' }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <Typography component="h1" variant="h4" gutterBottom>
          Create Account
        </Typography>

        <Typography component="p" variant="subtitle1" align="center" color="text.secondary" paragraph>
            Join VentureHUB as an Innovator or an Investor.
        </Typography>
        <Box component="form" onSubmit={handleRegister} sx={{ mt: 1, width: '100%' }}>
            <TextField margin="normal" required fullWidth label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <TextField margin="normal" required fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField margin="normal" required fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <FormControl fullWidth margin="normal" required>
                <InputLabel>I am an...</InputLabel>
                <Select value={role} label="I am an..." onChange={(e) => setRole(e.target.value)}>
                    <MenuItem value={'entrepreneur'}>Entrepreneur</MenuItem>
                    <MenuItem value={'vc'}>Venture Capitalist</MenuItem>
                </Select>
            </FormControl>

            {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}

            <Box sx={{ mt: 3, mb: 2, position: 'relative' }}>
                <Button type="submit" fullWidth variant="contained" disabled={isLoading}>
                    Register
                </Button>
                {isLoading && (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1}}>
                        <CircularProgress size={20} sx={{mr: 1}}/>
                        <Typography variant="caption">{loadingMessage}</Typography>
                    </Box>
                )}
            </Box>
            <Typography align="center">
                <MuiLink component={RouterLink} to="/login" variant="body2">
                {"Already have an account? Sign In"}
                </MuiLink>
            </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default RegisterPage;