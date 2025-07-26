// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// === API ROUTES ===
const authRoutes = require('./routes/auth/auth');
const userRoutes = require('./routes/users/users');
const ventureRoutes = require('./routes/ventures/ventures');
const investmentRoutes = require('./routes/investments/investments');
const proposalRoutes = require('./routes/proposals/proposals');
const governanceRoutes = require('./routes/governance/governance');
const marketRoutes = require('./routes/market/market');
const portfolioRoutes = require('./routes/portfolio/portfolio');
const adminRoutes = require('./routes/admin/admin');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ventures', ventureRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/admin', adminRoutes);


// === START THE SERVER ===
app.listen(PORT, () => {
  console.log(`🚀 VentureHUB API Server is running on http://localhost:${PORT}`);
});