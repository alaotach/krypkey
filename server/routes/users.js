const express = require('express');
const { checkUsername, createUser, addPassword, getPasswords, deleteUser, deletePassword } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const router = express.Router();

router.post('/check-username', checkUsername);
router.post('/create', createUser);
router.post('/login', async (req, res) => {
  try {
    const { username, password, private_key } = req.body;
    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log(user._id, private_key);
    console.warn('Login success:', user._id);
    console.error('Login success:', user._id);
    res.status(200).json({ message: `dumdum ${user._id}`, token, userId: user._id, privateKey: private_key });
  } catch (error) {
    const { username } = req.body;
    const user = await User.findOne({ username });
    console.error('Login error:', error);
    res.status(500).json({ message: `Server error, ${user._id}` });
  }
});

// Protected routes
router.use(authenticateToken);
router.post('/add-password', addPassword);
router.get('/passwords', getPasswords);
router.post('/delete', deleteUser);
router.delete('/passwords/:passwordId', authenticateToken, deletePassword);

module.exports = router;