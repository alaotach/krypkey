const User = require('../models/userModel');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// Voice storage directory
const VOICE_DIR = path.join(__dirname, '../voice_data');

// Ensure voice directory exists
if (!fs.existsSync(VOICE_DIR)) {
  fs.mkdirSync(VOICE_DIR, { recursive: true });
}

/**
 * Register a user's voice
 * POST /api/voice/register
 */
exports.registerVoice = async (req, res) => {
  try {
    const { user_id } = req.body;
    const voiceFile = req.file;
    
    if (!user_id || !voiceFile) {
      return res.status(400).json({ message: 'User ID and voice file are required' });
    }
    
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create user directory if it doesn't exist
    const userDir = path.join(VOICE_DIR, user_id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    
    // Save the voice file
    const voiceFilePath = path.join(userDir, 'voice_enrollment.wav');
    fs.copyFileSync(voiceFile.path, voiceFilePath);
    
    // Update user record
    user.voiceAuthEnabled = true;
    user.voiceAuthData = {
      registeredAt: new Date(),
      voicePath: voiceFilePath
    };
    
    await user.save();
    
    // Clean up temp file
    fs.unlinkSync(voiceFile.path);
    
    return res.status(200).json({ 
      message: 'Voice registration successful',
      stored_phrase: "My voice is my passport, verify me" // Standard phrase
    });
  } catch (error) {
    console.error('Voice registration error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Verify a user's voice
 * POST /api/voice/verify
 */
exports.verifyVoice = async (req, res) => {
  try {
    const { user_id } = req.body;
    const voiceFile = req.file;
    
    if (!user_id || !voiceFile) {
      return res.status(400).json({ message: 'User ID and voice file are required' });
    }
    
    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.voiceAuthEnabled || !user.voiceAuthData || !user.voiceAuthData.voicePath) {
      return res.status(400).json({ message: 'Voice authentication not set up for this user' });
    }
    
    // This is where you would typically use a real voice authentication service
    // For this example, we'll simulate a match with an 80% success rate for demonstration
    const isMatch = Math.random() > 0.2; // 80% chance of success
    const similarityScore = isMatch ? Math.random() * 0.3 + 0.7 : Math.random() * 0.3; // 70-100% match for success, 0-30% for failure
    
    // Clean up temp file
    fs.unlinkSync(voiceFile.path);
    
    return res.status(200).json({
      verified: isMatch,
      similarity_score: similarityScore,
      message: isMatch ? 'Voice verification successful' : 'Voice verification failed'
    });
  } catch (error) {
    console.error('Voice verification error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};
