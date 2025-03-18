const Session = require('../models/sessionModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const userController = require('./userController')

const encryptPassword = (password, privateKey) => {
  const iv = crypto.randomBytes(16); // Initialization vector
  const key = crypto.createHash('sha256').update(privateKey).digest(); // Create a key from the private key
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; // Return the IV and encrypted password
};

// exports.checkSession = async (req, res) => {
//   try {
//     const { sessionId } = req.body;
//     const session = await Session.findOne({ sessionId }).populate('userId');

//     if (!session) {
//       return res.status(404).json({ message: 'Session not found' });
//     }

//     if (session.authenticated && session.token && session.userId) {
//       // If the session is authenticated, return the full session data
//       return res.status(200).json({
//         authenticated: true,
//         session: {
//           token: session.token,
//           username: session.username, // Changed from session.userId.username
//           userId: session.userId._id,
//           privateKey: session.privateKey
//         }
//       });
//     }

//     // Session exists but not yet authenticated
//     return res.status(200).json({ authenticated: false });
//   } catch (error) {
//     console.error('Session check error:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

exports.processPendingPasswords = async (req, res) => {
  try {
    const { sessionId, username, privateKey } = req.body;
    
    if (!sessionId || !username || !privateKey) {
      return res.status(400).json({ 
        message: 'Session ID, username, and private key are required' 
      });
    }
    
    // Find the session
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Find the user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get pending passwords that aren't already saved
    const pendingPasswords = session.pendingPasswords.filter(p => !p.saved);
    
    if (pendingPasswords.length === 0) {
      return res.status(200).json({
        message: 'No pending passwords to process',
        processedCount: 0
      });
    }
    
    console.log(`Processing ${pendingPasswords.length} pending passwords for session ${sessionId}`);
    let processedCount = 0;
    const passwordIds = [];
    
    // Process each password
    for (const pendingPassword of pendingPasswords) {
      try {
        const { title, password, _id } = pendingPassword;
        let plainTextPassword = password;
        
        // Step 1: Try to decrypt with session token if using XOR encryption
        if (typeof password === 'string' && password.includes(',')) {
          try {
            plainTextPassword = decryptWithSessionToken(password, session.token);
            console.log('Successfully decrypted password with XOR method');
          } catch (decryptError) {
            console.error('Failed to decrypt with session token:', decryptError);
          }
        } 
        // Step 2: Otherwise try to decrypt with server-side encryption (if in IV:data format)
        else if (typeof password === 'string' && password.includes(':')) {
          try {
            // For IV:data format, use the more specific decrypt function
            const [ivHex, encryptedText] = password.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const key = crypto.createHash('sha256').update(session.token).digest();
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            plainTextPassword = decrypted;
            console.log('Successfully decrypted password with AES CBC method');
          } catch (decryptError) {
            console.error('Failed to decrypt IV:data format:', decryptError);
          }
        }
        
        // Step 3: Encrypt with user's private key
        const passwordToStore = encryptPassword(plainTextPassword, privateKey);
        
        // Step 4: Add to user's passwords
        user.passwords.push({
          title,
          password: passwordToStore
        });
        
        // Mark this password for removal - store as string to ensure consistent comparison
        passwordIds.push(_id.toString());
        processedCount++;
        
      } catch (passwordError) {
        console.error('Error processing password:', passwordError);
      }
    }
    
    // Only modify the session and user if we actually processed passwords
    if (processedCount > 0) {
      // First save the user with new passwords to ensure they're stored
      try {
        await user.save();
        console.log(`Successfully saved ${processedCount} passwords to user account`);
      } catch (userSaveError) {
        console.error('Failed to save user with new passwords:', userSaveError);
        return res.status(500).json({
          message: 'Failed to save passwords to user account',
          processedCount: 0
        });
      }
      
      // After confirming user save was successful, remove processed passwords from session
      try {
        console.log('Original pending passwords count:', session.pendingPasswords.length);
        console.log('Passwords to remove:', passwordIds);
        
        // Using a direct approach to remove the passwords by ID
        const remainingPasswords = [];
        for (const pendingPwd of session.pendingPasswords) {
          if (!passwordIds.includes(pendingPwd._id.toString())) {
            remainingPasswords.push(pendingPwd);
          }
        }
        
        // Replace the entire array instead of filtering in-place
        session.pendingPasswords = remainingPasswords;
        console.log('Remaining passwords count:', session.pendingPasswords.length);
        
        // Save the updated session
        await session.save();
        console.log(`Removed ${processedCount} processed passwords from session`);
      } catch (sessionSaveError) {
        console.error('Failed to update session after processing passwords:', sessionSaveError);
        // We don't return an error here since the passwords were saved to the user
      }
    }
    
    return res.status(200).json({
      message: `Successfully processed ${processedCount} passwords`,
      processedCount
    });
    
  } catch (error) {
    console.error('Error processing pending passwords:', error);
    res.status(500).json({ 
      message: 'Server error processing passwords',
      processedCount: 0
    });
  }
};

function decryptWithSessionToken(encryptedData, token) {
  try {
    if (!encryptedData.includes(',')) {
      throw new Error('Invalid encrypted data format');
    }
    
    const dataArray = encryptedData.split(',').map(Number);
    const keyData = Buffer.from(token).toString('utf8');
    const keyBytes = Array.from(Buffer.from(keyData, 'utf8'));
    const decrypted = new Uint8Array(dataArray.length);
    
    for (let i = 0; i < dataArray.length; i++) {
      decrypted[i] = dataArray[i] ^ keyBytes[i % keyBytes.length];
    }
    
    return Buffer.from(decrypted).toString('utf8');
  } catch (error) {
    console.error('Session token decryption error:', error);
    throw error;
  }
}

exports.listSessions = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Find user first
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not foundhgghhgf' });
    }

    // Get active sessions for the user
    const sessions = await Session.find({ 
      username,
      authenticated: true,
      createdAt: { 
        $gt: new Date(Date.now() - process.env.SESSION_EXPIRY * 1000) 
      }
    }).sort({ createdAt: -1 });

    res.json(sessions);
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
exports.deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Find the session first to get the user reference
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // If session has a user associated, remove the session from user's sessions array
    if (session.userId) {
      const user = await User.findById(session.userId);
      if (user) {
        user.sessions = user.sessions.filter(
          id => id.toString() !== sessionId.toString()
        );
        await user.save();
      }
    }
    
    // Now delete the session
    await Session.findByIdAndDelete(sessionId);
    
    res.status(200).json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  try {
    await Session.findByIdAndDelete(req.session.id);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// In your sessionController.js
// Add a new function to handle pending passwords when a user logs in

exports.authenticateSession = async (req, res) => {
  try {
    const { sessionId, username, privateKey, deviceName } = req.body;
    
    console.log('Authenticate session request:', { 
      sessionId, 
      username, 
      privateKeyReceived: !!privateKey,
      deviceName
    });
    
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store the privateKey both as a virtual property and underscore property
    session.privateKey = privateKey;
    session._privateKey = privateKey; // This is an alternative approach
    
    // Update the session
    session.userId = user._id;
    session.username = username;
    session.deviceName = deviceName || 'Mobile Device';
    session.token = token;
    session.authenticated = true;
    
    // Link this session to the user
    if (!user.sessions.includes(session._id)) {
      user.sessions.push(session._id);
      await user.save();
    }
    
    // Process any pending passwords that were added via the extension
    // Re-encrypt them with the user's private key
    // In the authenticateSession function, where pending passwords are processed:

// Process any pending passwords that were added via the extension
if (session.pendingPasswords && session.pendingPasswords.length > 0) {
  console.log(`Processing ${session.pendingPasswords.length} pending passwords...`);
  const pendingPasswords = [...session.pendingPasswords]; // Create a copy to iterate over
  const processedIds = []; // Track which passwords to remove
  
  // Update the user's passwords with the pending ones
  for (const pendingPassword of pendingPasswords) {
    try {
      // Try to decrypt with session token first
      let passwordToStore = pendingPassword.password;
      try {
        const decryptedPassword = decryptWithSessionToken(passwordToStore, token);
        
        // Now encrypt with the user's private key
        const userController = require('./userController');
        passwordToStore = userController.encryptPassword(decryptedPassword, privateKey);
      } catch (encErr) {
        console.error('Error processing password encryption:', encErr);
        // Continue with original password as fallback
      }
      
      // Add password to user's collection
      user.passwords.push({
        title: pendingPassword.title,
        password: passwordToStore
      });
      
      // Mark this pending password for deletion
      processedIds.push(pendingPassword._id);
    } catch (err) {
      console.error(`Error processing pending password: ${err.message}`);
    }
  }
  
  // Remove processed passwords from the session
  session.pendingPasswords = session.pendingPasswords.filter(p => 
    !processedIds.some(id => id.equals(p._id))
  );
  
  // Save the user with new passwords
  await user.save();
  console.log('User passwords updated with pending passwords');
}
    
    await session.save();

    console.log('Authentication successful for user:', username);
    console.log('Private key stored (length):', privateKey ? privateKey.length : 0);

    // Store the privateKey in a global cache for this session
    if (!global.sessionPrivateKeys) {
      global.sessionPrivateKeys = {};
    }
    global.sessionPrivateKeys[sessionId] = privateKey;
    
    // Return the token, userId, and privateKey
    res.status(200).json({ 
      token, 
      userId: user._id, 
      username: user.username,
      privateKey, // Include privateKey in response
      sessionId  // Include sessionId in response
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add helper functions if they don't exist
function decryptWithSessionToken(encryptedData, token) {
  try {
    // If using the format with IV and encrypted text separated by colon
    if (encryptedData.includes(':')) {
      const [ivHex, encryptedText] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = crypto.createHash('sha256').update(token).digest();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } 
    // Otherwise assume it's using the XOR encryption from the extension
    else if (encryptedData.includes(',')) {
      const dataArray = encryptedData.split(',').map(Number);
      const keyData = Array.from(new TextEncoder().encode(token));
      const decrypted = new Uint8Array(dataArray.length);
      
      for (let i = 0; i < dataArray.length; i++) {
        decrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
      }
      
      return new TextDecoder().decode(decrypted);
    }
    
    throw new Error('Unknown encryption format');
  } catch (error) {
    console.error('Session decryption error:', error);
    throw error;
  }
}

exports.checkSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.authenticated && session.token) {
      // Get the privateKey from the global cache
      const cachedPrivateKey = global.sessionPrivateKeys && global.sessionPrivateKeys[sessionId];
      
      console.log('Session check - privateKey from cache exists:', !!cachedPrivateKey);
      
      // Return the authenticated session data with the private key AND sessionId
      return res.status(200).json({
        authenticated: true,
        session: {
          token: session.token,
          username: session.username,
          userId: session.userId,
          privateKey: cachedPrivateKey, // Use the cached private key
          sessionId: sessionId // ALWAYS include sessionId here
        }
      });
    }

    // Session exists but not yet authenticated
    return res.status(200).json({ authenticated: false });
  } catch (error) {
    console.error('Session check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update the createSession function 
// Update the createSession function to handle custom expiry
exports.createSession = async (req, res) => {
  try {
    const { sessionId, expirySeconds } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    // Check if session already exists
    const existingSession = await Session.findOne({ sessionId });
    if (existingSession) {
      return res.status(200).json({ message: 'Session already exists' });
    }
    
    // Use custom expiry if provided, otherwise use default (2 hours = 7200 seconds)
    const expiry = expirySeconds || parseInt(process.env.SESSION_EXPIRY) || 7200;
    
    // Create new session with minimal required fields and custom expiry
    const session = new Session({
      sessionId,
      deviceName: 'Extension',
      authenticated: false,
      pendingPasswords: [],  // Initialize with empty array
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (expiry * 1000)) // Convert seconds to milliseconds
    });
    
    await session.save();
    res.status(201).json({ 
      message: 'Session created successfully',
      sessionId: session.sessionId,
      expirySeconds: expiry
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifySession = async (req, res) => {
  try {
    // The user will be available from the authenticateToken middleware
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Check if this user has any valid sessions
    const validSessions = await Session.find({
      username,
      authenticated: true,
      createdAt: { 
        $gt: new Date(Date.now() - process.env.SESSION_EXPIRY * 1000) 
      }
    });

    if (validSessions.length === 0) {
      return res.status(401).json({ message: 'No valid sessions found' });
    }

    // Session is valid
    return res.status(200).json({ message: 'Session valid' });
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addPendingPassword = async (req, res) => {
  try {
    const { sessionId, title, password } = req.body;
    
    if (!sessionId || !title || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const session = await Session.findOne({ sessionId });
    if (!session || !session.authenticated) {
      return res.status(404).json({ message: 'Session not found or not authenticated' });
    }
    
    // Encrypt the password with the session token as the key
    const encryptedPassword = encryptWithSessionToken(password, session.token);
    
    // Add to pending passwords
    session.pendingPasswords.push({
      title,
      password: encryptedPassword,
      saved: false
    });
    
    await session.save();
    res.status(201).json({ message: 'Password saved for synchronization' });
  } catch (error) {
    console.error('Error adding pending password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.setAccessMethod = async (req, res) => {
  try {
    const { sessionId, pin, useBiometrics } = req.body;
    
    const session = await Session.findOne({ sessionId });
    if (!session || !session.authenticated) {
      return res.status(404).json({ message: 'Session not found or not authenticated' });
    }
    
    if (pin) {
      // Hash the PIN before storing it
      const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
      session.accessPin = hashedPin;
    }
    
    if (useBiometrics !== undefined) {
      session.useBiometrics = useBiometrics;
    }
    
    await session.save();
    res.status(200).json({ message: 'Access method updated' });
  } catch (error) {
    console.error('Error setting access method:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyAccessMethod = async (req, res) => {
  try {
    const { sessionId, pin } = req.body;
    
    const session = await Session.findOne({ sessionId });
    if (!session || !session.authenticated) {
      return res.status(404).json({ message: 'Session not found or not authenticated' });
    }
    
    if (pin) {
      const hashedPin = crypto.createHash('sha256').update(pin).digest('hex');
      if (session.accessPin !== hashedPin) {
        return res.status(401).json({ message: 'Invalid PIN' });
      }
    }
    
    res.status(200).json({ 
      success: true,
      useBiometrics: session.useBiometrics
    });
  } catch (error) {
    console.error('Error verifying access method:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPendingPasswords = async (req, res) => {
  try {
    const { sessionId, username } = req.query;
    
    // Authenticate via user authentication middleware
    const session = await Session.findOne({ 
      sessionId,
      username: req.user.username
    });
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Return only pending passwords that haven't been saved
    const pendingPasswords = session.pendingPasswords.filter(p => !p.saved);
    
    res.status(200).json({ pendingPasswords });
  } catch (error) {
    console.error('Error getting pending passwords:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markPasswordsSaved = async (req, res) => {
  try {
    const { sessionId, passwordIds } = req.body;
    
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Mark the specified passwords as saved
    passwordIds.forEach(id => {
      const password = session.pendingPasswords.id(id);
      if (password) {
        password.saved = true;
      }
    });
    
    await session.save();
    res.status(200).json({ message: 'Passwords marked as saved' });
  } catch (error) {
    console.error('Error marking passwords as saved:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

function encryptWithSessionToken(data, token) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(token).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Helper function to decrypt with session token
// function decryptWithSessionToken(encryptedData, token) {
//   const [ivHex, encryptedText] = encryptedData.split(':');
//   const iv = Buffer.from(ivHex, 'hex');
//   const key = crypto.createHash('sha256').update(token).digest();
//   const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
//   let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
//   decrypted += decipher.final('utf8');
//   return decrypted;
// }

exports.hasPendingPasswords = async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    const session = await Session.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Check if there are any pending passwords that have not been saved
    const hasPendingPasswords = session.pendingPasswords && 
                                session.pendingPasswords.some(p => !p.saved);
    
    return res.status(200).json({ hasPendingPasswords });
  } catch (error) {
    console.error('Error checking pending passwords:', error);
    res.status(500).json({ message: 'Server error' });
  }
};