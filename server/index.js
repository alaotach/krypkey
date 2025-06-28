const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const userRoutes = require('./routes/users');
const sessionRoutes = require('./routes/sessions');
const Session = require('./models/sessionModel'); // Add this import
const utilsRoutes = require('./routes/utils');
const voiceRoutes = require('./routes/voice'); // Add this import

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*', // In production, specify your extension's origin
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    
    // Add session cleanup interval here
    setInterval(async () => {
      try {
        const expiryTime = new Date(Date.now() - process.env.SESSION_EXPIRY * 1000);
        await Session.deleteMany({ createdAt: { $lt: expiryTime } });
      } catch (error) {
        console.error('Session cleanup error:', error);
      }
    }, 3600000); // Runs every hour
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/voice', voiceRoutes); // Add voice authentication routes

// Make sure you have the temp directory for uploads
const fs = require('fs');
if (!fs.existsSync('./temp')) {
  fs.mkdirSync('./temp', { recursive: true });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});