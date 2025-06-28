const express = require('express');
const router = express.Router();
const multer = require('multer');
const voiceAuthController = require('../controllers/voiceAuthController');

// Configure multer for voice file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'temp/');
  },
  filename: function(req, file, cb) {
    cb(null, `voice-${Date.now()}.wav`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Voice authentication routes
router.post('/register', upload.single('file'), voiceAuthController.registerVoice);
router.post('/verify', upload.single('file'), voiceAuthController.verifyVoice);

module.exports = router;
