const express = require('express');
const router = express.Router();

// Import any controllers you might need
const { generatePassword } = require('../controllers/utilsController');

// Define routes
router.post('/generate-password', generatePassword);

module.exports = router;