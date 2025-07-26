import React, { useState } from 'react';
import { Box, Button, Typography, Container, Paper, TextField, Link as MuiLink, CircularProgress } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_SERVER_URL = 'http://localhost:4000';

function LoginPage({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_SERVER_URL}/api/auth/login`, { email, password });
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setUser(user);
      
      navigate(user.role === 'vc' ? '/deal-flow' : '/my-ventures');

    } catch (err) {
      console.error("Login failed:", err);
      const message = err.response?.data?.message || "Login failed. Please try again.";
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', height: '100vh' }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <Typography component="h1" variant="h4" gutterBottom>VentureHUB Login</Typography>
        <Box component="form" onSubmit={handleLogin} sx={{ mt: 1, width: '100%' }}>
          <TextField margin="normal" required fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField margin="normal" required fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <Typography color="error" align="center" sx={{ mt: 2 }}>{error}</Typography>}
          <Box sx={{ mt: 3, mb: 2, position: 'relative' }}>
            <Button type="submit" fullWidth variant="contained" disabled={isLoading}>Sign In</Button>
            {isLoading && <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-12px', ml: '-12px' }} />}
          </Box>
          <Typography align="center"><MuiLink component={RouterLink} to="/register" variant="body2">{"Don't have an account? Register"}</MuiLink></Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default LoginPage;