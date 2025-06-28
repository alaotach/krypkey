const express = require('express');
const { 
  checkSession, 
  listSessions, 
  deleteSession, 
  logout,
  authenticateSession,
  createSession,
  verifySession,
  addPendingPassword,
  setAccessMethod,
  verifyAccessMethod,
  getPendingPasswords,
  markPasswordsSaved,
  hasPendingPasswords,
  processPendingPasswords  // Add this new controller method
} = require('../controllers/sessionController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Existing routes
router.post('/create', createSession);
router.post('/authenticate', authenticateSession);
router.post('/check', checkSession);
router.get('/list', listSessions);
router.post('/delete', authenticateToken, deleteSession);
router.post('/logout', authenticateToken, logout);
router.get('/verify', authenticateToken, verifySession);

// New routes for two-key system
router.post('/pending-password', addPendingPassword);
router.post('/access-method', setAccessMethod);
router.post('/verify-access', verifyAccessMethod);
router.get('/pending-passwords', authenticateToken, getPendingPasswords);
router.post('/mark-saved', authenticateToken, markPasswordsSaved);
router.get('/has-pending-passwords', hasPendingPasswords);  // Make sure this route is added
// Add this new route
router.post('/process-passwords', authenticateToken, processPendingPasswords);

module.exports = router;