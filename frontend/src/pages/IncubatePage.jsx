import React, { useState } from 'react';
import axios from 'axios';
import { 
  Container, Typography, TextField, Button, Box, Paper, 
  CircularProgress, Autocomplete 
} from '@mui/material';
import PhotoCamera from '@mui/icons-material/PhotoCamera';

// A list of common industries to suggest to the user.
const industrySuggestions = [
  // High-Growth & Trending
  'Artificial Intelligence & Machine Learning',
  'GreenTech & Renewable Energy',
  'FinTech & DeFi',
  'HealthTech & Life Sciences',
  'Cybersecurity',

  // Technology & Software
  'Web3 & Blockchain',
  'Enterprise SaaS',
  'Deep Tech & Robotics',
  'Gaming & E-Sports',
  'IoT (Internet of Things)',

  // Consumer & Niche Markets
  'E-commerce & Direct-to-Consumer',
  'Creator Economy & Digital Media',
  'FoodTech & AgTech',
  'EdTech (Education Technology)',
  'SpaceTech & Aerospace',

  // Other Strong Sectors
  'Logistics & Supply Chain',
  'Biotechnology',
  'Sustainable Consumer Goods',
  'Telecommunications',
  'Smart Mobility & Transportation'
];

function IncubatePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [formState, setFormState] = useState({
    name: '',
    industry: '',
    mission: '',
    teamInfo: '',
    fundraisingGoal: '',
    totalShares: '',
    logo: null,
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };
  
  const handleIndustryChange = (event, newValue) => {
    setFormState(prevState => ({ ...prevState, industry: newValue }));
  };

  const handleImageChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setFormState(prevState => ({ ...prevState, logo: file }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage('Launching venture... this involves multiple on-chain transactions and may take a moment.');
    setError('');

    const formData = new FormData();
    formData.append('ventureName', formState.name);
    formData.append('industry', formState.industry);
    formData.append('mission', formState.mission);
    formData.append('teamInfo', formState.teamInfo);
    formData.append('fundraisingGoal', formState.fundraisingGoal);
    formData.append('totalShares', formState.totalShares);
    formData.append('logo', formState.logo);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:4000/api/ventures/create', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token,
        },
      });
      setMessage(`Venture launched successfully! Transaction Hash: ${response.data.transactionHash}`);
    } catch (err) {
      const errorMessage = err.response?.data?.details || err.response?.data?.message || 'An unexpected error occurred.';
      setError(errorMessage);
      setMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" align="center" gutterBottom>Launch Your Venture</Typography>
        <Typography variant="subtitle1" color="text.secondary" align="center" paragraph>
          This single form creates your on-chain Venture Charter (IP-NFT) and prepares it for fractionalized investment.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <TextField fullWidth label="Venture Name" name="name" margin="normal" onChange={handleInputChange} required />
          <Autocomplete
            freeSolo
            options={industrySuggestions}
            value={formState.industry}
            onChange={handleIndustryChange}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Industry"
                name="industry"
                margin="normal"
                required
              />
            )}
          />

          <TextField fullWidth label="Core Idea / Mission" name="mission" multiline rows={4} margin="normal" onChange={handleInputChange} required />
          <TextField fullWidth label="Team Information" name="teamInfo" multiline rows={3} margin="normal" onChange={handleInputChange} required />
          <TextField fullWidth label="Fundraising Goal (USDC)" name="fundraisingGoal" type="number" margin="normal" onChange={handleInputChange} required />
          <TextField fullWidth label="Number of Shares to Create" name="totalShares" type="number" margin="normal" onChange={handleInputChange} required />
          
          <Box sx={{ mt: 2, p: 2, border: '1px dashed grey', textAlign: 'center' }}>
            <Button variant="outlined" component="label" startIcon={<PhotoCamera />}>Upload Company Logo<input type="file" accept="image/*" hidden onChange={handleImageChange} required /></Button>
            {imagePreview && <Box mt={2}><img src={imagePreview} alt="preview" height="100" /></Box>}
          </Box>
          
          <Box sx={{ mt: 3, position: 'relative' }}>
            <Button type="submit" fullWidth variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={24} /> : 'Launch Venture'}
            </Button>
          </Box>
          
          {message && <Typography color="primary" sx={{ mt: 2, textAlign: 'center' }}>{message}</Typography>}
          {error && <Typography color="error" sx={{ mt: 2, textAlign: 'center' }}>{error}</Typography>}
        </Box>
      </Paper>
    </Container>
  );
}

export default IncubatePage;