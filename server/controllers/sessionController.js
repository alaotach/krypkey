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

// Add more detailed logging to the processPendingPasswords function
exports.processPendingPasswords = async (req, res) => {
  try {
    const { sessionId, username, privateKey } = req.body;
    
    console.log('Processing pending passwords request:', {
      sessionId,
      username,
      hasPrivateKey: !!privateKey
    });
    
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
    
    console.log('Session found:', {
      authenticated: session.authenticated,
      pendingPasswordsCount: session.pendingPasswords.length
    });
    
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
        const { title, password: encryptedData, _id, category } = pendingPassword;
        
        console.log(`Processing pending password: "${title}" (${category || 'no category'})`);
        
        // Step 1: Decrypt the password with the session token
        let plainTextPassword;
        try {
          plainTextPassword = decryptWithSessionToken(encryptedData, session.token);
          console.log('Successfully decrypted password data:', {
            length: plainTextPassword.length,
            sample: plainTextPassword.substring(0, 30) + (plainTextPassword.length > 30 ? '...' : '')
          });
        } catch (decryptError) {
          console.error('Error decrypting password data:', decryptError);
          plainTextPassword = encryptedData; // Fallback to using as-is
        }
        
        // Step 2: Check if the password is a JSON string containing the full password object
        let passwordData = {};
        let normalizedData = {};
        
        try {
          // Parse the JSON string into an object
          passwordData = JSON.parse(plainTextPassword);
          
          console.log('Parsed password data:', {
            isObject: typeof passwordData === 'object',
            hasCategory: !!passwordData.category,
            category: passwordData.category,
            keys: Object.keys(passwordData)
          });
          
          // Check if this is a structured password object (has fields like category, etc.)
          if (passwordData && typeof passwordData === 'object') {
            // Base fields for all categories
            normalizedData = {
              title: title || passwordData.title,
              category: passwordData.category || category || 'login',
              notes: passwordData.notes,
              createdAt: passwordData.createdAt || new Date(),
              updatedAt: new Date()
            };
            
            // Add fields based on category (use the object's category or fallback to parameter)
            const passwordCategory = passwordData.category || category || 'login';
            
            // Copy over specific fields based on category
            switch(passwordCategory) {
              case 'login':
                normalizedData.loginUsername = passwordData.loginUsername || passwordData.username;
                normalizedData.password = passwordData.password;
                normalizedData.website = passwordData.website;
                break;
              case 'social':
                normalizedData.loginUsername = passwordData.loginUsername || passwordData.username;
                normalizedData.password = passwordData.password;
                normalizedData.platform = passwordData.platform;
                normalizedData.profileUrl = passwordData.profileUrl;
                break;
              case 'card':
                normalizedData.cardType = passwordData.cardType;
                normalizedData.cardNumber = passwordData.cardNumber;
                normalizedData.cardholderName = passwordData.cardholderName;
                normalizedData.expiryDate = passwordData.expiryDate;
                normalizedData.cvv = passwordData.cvv;
                break;
              case 'voucher':
                normalizedData.store = passwordData.store;
                normalizedData.code = passwordData.code;
                normalizedData.value = passwordData.value;
                normalizedData.expiryDate = passwordData.expiryDate;
                break;
              case 'giftcard':
                normalizedData.store = passwordData.store;
                normalizedData.cardNumber = passwordData.cardNumber;
                normalizedData.pin = passwordData.pin;
                normalizedData.balance = passwordData.balance;
                normalizedData.expiryDate = passwordData.expiryDate;
                break;
              case 'address':
                normalizedData.fullName = passwordData.fullName;
                normalizedData.streetAddress = passwordData.streetAddress;
                normalizedData.city = passwordData.city;
                normalizedData.state = passwordData.state;
                normalizedData.zipCode = passwordData.zipCode;
                normalizedData.country = passwordData.country;
                normalizedData.phoneNumber = passwordData.phoneNumber;
                normalizedData.email = passwordData.email;
                break;
              case 'other':
                normalizedData.customFields = passwordData.customFields;
                break;
            }
            
            // Log what we're going to encrypt
            console.log('Normalized data prepared:', {
              category: normalizedData.category,
              fields: Object.keys(normalizedData),
              hasPassword: !!normalizedData.password,
              hasUsername: !!normalizedData.loginUsername
            });
            
            // Encrypt sensitive fields with user's private key
            Object.keys(normalizedData).forEach(key => {
              // Skip if value is undefined/null/empty
              if (!normalizedData[key]) return;
              
              // Don't encrypt these fields
              if (['title', 'category', 'notes', 'createdAt', 'updatedAt', 'loginUsername', 'website', 'platform', 'profileUrl',
                   'cardType', 'cardholderName', 'store', 'value', 'balance', 'fullName', 'streetAddress', 'city', 'state',
                   'zipCode', 'country', 'phoneNumber', 'email', 'expiryDate'].includes(key)) {
                return;
              }
              
              // Only encrypt sensitive fields that have values
              if (['password', 'cardNumber', 'cvv', 'code', 'pin'].includes(key)) {
                console.log(`Encrypting sensitive field: ${key}`);
                normalizedData[key] = encryptPassword(normalizedData[key], privateKey);
              }
            });
            
            // Also handle custom fields if present
            if (normalizedData.customFields && Array.isArray(normalizedData.customFields)) {
              normalizedData.customFields = normalizedData.customFields.map(field => {
                if (field.isSecret && field.value) {
                  console.log(`Encrypting custom field: ${field.label}`);
                  return {
                    ...field,
                    value: encryptPassword(field.value, privateKey)
                  };
                }
                return field;
              });
            }
            
            // Add to user's passwords
            user.passwords.push(normalizedData);
          } else {
            // Not a structured object, treat as a simple password
            console.log('No structured data found, treating as simple password');
            const simplePasswordData = {
              title,
              password: encryptPassword(plainTextPassword, privateKey),
              category: category || 'login',
              createdAt: new Date(),
              updatedAt: new Date()
            };
            user.passwords.push(simplePasswordData);
          }
        } catch (parseError) {
          console.error('Error parsing password data:', parseError);
          // Not a JSON string, continue with the plain text password
          console.log('Using plaintext password (not JSON)');
          const simplePasswordData = {
            title,
            password: encryptPassword(plainTextPassword, privateKey),
            category: category || 'login',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          user.passwords.push(simplePasswordData);
        }
        
        // Mark this password for removal
        passwordIds.push(_id.toString());
        processedCount++;
      } catch (passwordError) {
        console.error('Error processing individual password:', passwordError);
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
        console.log('Passwords to remove IDs:', passwordIds);
        
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

// Enhanced decryptWithSessionToken function to handle different formats
function decryptWithSessionToken(encryptedData, token) {
  try {
    // Log the encrypted data format for debugging
    console.log('Decrypting data format:', {
      hasColon: encryptedData.includes(':'),
      hasComma: encryptedData.includes(','),
      length: encryptedData.length,
      firstChars: encryptedData.substring(0, 10) + '...'
    });
    
    // If using the format with IV and encrypted text separated by colon (AES)
    if (encryptedData.includes(':')) {
      try {
        const [ivHex, encryptedText] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = crypto.createHash('sha256').update(token).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch(e) {
        console.error('Error in AES decryption:', e);
        return encryptedData; // Return original data if decryption fails
      }
    } 
    // If using the XOR encryption from the extension (comma-separated values)
    else if (encryptedData.includes(',')) {
      try {
        const dataArray = encryptedData.split(',').map(Number);
        const keyData = Buffer.from(token, 'utf8');
        const decrypted = new Uint8Array(dataArray.length);
        
        for (let i = 0; i < dataArray.length; i++) {
          decrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
        }
        
        const result = new TextDecoder().decode(decrypted);
        
        // Check if the result is valid JSON, if parsing fails, return as-is
        try {
          JSON.parse(result);
          console.log('Successfully parsed decrypted data as JSON');
        } catch (e) {
          console.log('Decrypted data is not valid JSON');
        }
        
        return result;
      } catch(e) {
        console.error('Error in XOR decryption:', e);
        return encryptedData; // Return original data if decryption fails
      }
    }
    // For anything else, assume it's plaintext
    else {
      console.log('Using plaintext data (no encryption detected)');
      return encryptedData;
    }
  } catch (error) {
    console.error('Session decryption error:', error);
    // Return original data if decryption completely fails
    return encryptedData;
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

// In the authenticateSession function, modify the pending passwords processing:

// Process any pending passwords that were added via the extension
if (session.pendingPasswords && session.pendingPasswords.length > 0) {
  console.log(`Processing ${session.pendingPasswords.length} pending passwords...`);
  const pendingPasswords = [...session.pendingPasswords]; // Create a copy to iterate over
  const processedIds = []; // Track which passwords to remove
  
  // Update the user's passwords with the pending ones
  for (const pendingPassword of pendingPasswords) {
    try {
      const { title, password: encryptedData, category } = pendingPassword;
      
      console.log(`Processing pending password: "${title}" (${category || 'no category'})`);
      
      // Try to decrypt with session token first
      try {
        const decryptedPassword = decryptWithSessionToken(encryptedData, token);
        
        // Try to parse as JSON to extract structured data
        try {
          const parsedData = JSON.parse(decryptedPassword);
          
          // If we have a structured password object, use it
          if (parsedData && typeof parsedData === 'object') {
            // Now encrypt with the user's private key
            let normalizedData = {
              title: title || parsedData.title,
              category: parsedData.category || category || 'login',
              notes: parsedData.notes,
              createdAt: parsedData.createdAt || new Date(),
              updatedAt: new Date()
            };
            
            // Copy specific fields based on category
            switch(normalizedData.category) {
              case 'login':
                normalizedData.loginUsername = parsedData.loginUsername || parsedData.username;
                normalizedData.password = parsedData.password ? encryptPassword(parsedData.password, privateKey) : null;
                normalizedData.website = parsedData.website;
                break;
              case 'social':
                normalizedData.loginUsername = parsedData.loginUsername || parsedData.username;
                normalizedData.password = parsedData.password ? encryptPassword(parsedData.password, privateKey) : null;
                normalizedData.platform = parsedData.platform;
                normalizedData.profileUrl = parsedData.profileUrl;
                break;
              case 'card':
                normalizedData.cardType = parsedData.cardType;
                normalizedData.cardNumber = parsedData.cardNumber ? encryptPassword(parsedData.cardNumber, privateKey) : null;
                normalizedData.cardholderName = parsedData.cardholderName;
                normalizedData.expiryDate = parsedData.expiryDate;
                normalizedData.cvv = parsedData.cvv ? encryptPassword(parsedData.cvv, privateKey) : null;
                break;
              case 'voucher':
                normalizedData.store = parsedData.store;
                normalizedData.code = parsedData.code ? encryptPassword(parsedData.code, privateKey) : null;
                normalizedData.value = parsedData.value;
                normalizedData.expiryDate = parsedData.expiryDate;
                break;
              case 'giftcard':
                normalizedData.store = parsedData.store;
                normalizedData.cardNumber = parsedData.cardNumber ? encryptPassword(parsedData.cardNumber, privateKey) : null;
                normalizedData.pin = parsedData.pin ? encryptPassword(parsedData.pin, privateKey) : null;
                normalizedData.balance = parsedData.balance;
                normalizedData.expiryDate = parsedData.expiryDate;
                break;
              case 'address':
                normalizedData.fullName = parsedData.fullName;
                normalizedData.streetAddress = parsedData.streetAddress;
                normalizedData.city = parsedData.city;
                normalizedData.state = parsedData.state;
                normalizedData.zipCode = parsedData.zipCode;
                normalizedData.country = parsedData.country;
                normalizedData.phoneNumber = parsedData.phoneNumber;
                normalizedData.email = parsedData.email;
                break;
              case 'other':
                // Handle custom fields, ensuring we properly encrypt secret fields
                if (parsedData.customFields && Array.isArray(parsedData.customFields)) {
                  normalizedData.customFields = parsedData.customFields.map(field => {
                    if (field.isSecret && field.value) {
                      return {
                        ...field,
                        value: encryptPassword(field.value, privateKey)
                      };
                    }
                    return field;
                  });
                }
                break;
              default:
                // For simple passwords or unrecognized categories
                normalizedData.password = parsedData.password ? 
                  encryptPassword(parsedData.password, privateKey) : 
                  encryptPassword(decryptedPassword, privateKey);
            }
            
            // Log the normalized data structure before adding
            console.log(`Normalized ${normalizedData.category} data with fields:`, Object.keys(normalizedData));
            
            // Add password to user's collection
            user.passwords.push(normalizedData);
            console.log(`Added structured password "${title}" with category "${normalizedData.category}"`);
          } else {
            // Just a simple JSON string, encrypt it
            user.passwords.push({
              title,
              password: encryptPassword(decryptedPassword, privateKey),
              category: category || 'login',
              createdAt: new Date(),
              updatedAt: new Date()
            });
            console.log(`Added simple password "${title}" with category "${category || 'login'}"`);
          }
        } catch (jsonError) {
          // Not JSON, treat as simple string
          console.error('JSON parse error:', jsonError.message);
          user.passwords.push({
            title,
            password: encryptPassword(decryptedPassword, privateKey),
            category: category || 'login',
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`Added plain password "${title}" with category "${category || 'login'}"`);
        }
      } catch (decryptError) {
        console.error('Error decrypting password:', decryptError);
        // Use encrypted data as fallback
        user.passwords.push({
          title,
          password: encryptPassword(encryptedData, privateKey),
          category: category || 'login',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
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
    const { sessionId, title, password, category } = req.body;
    
    console.log('Adding pending password:', {
      sessionId,
      title,
      hasPassword: !!password,
      passwordLength: password ? password.length : 0,
      isJson: password && typeof password === 'string' && 
              (password.startsWith('{') || password.startsWith('[')),
      category: category || 'login'  // Ensure we have a default category
    });
    
    if (!sessionId || !title || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const session = await Session.findOne({ sessionId });
    if (!session || !session.authenticated) {
      return res.status(404).json({ message: 'Session not found or not authenticated' });
    }
    
    // Encrypt the password with the session token as the key
    const encryptedPassword = encryptWithSessionToken(password, session.token);
    
    // Add to pending passwords with explicit category
    session.pendingPasswords.push({
      title,
      password: encryptedPassword,
      saved: false,
      category: category || 'login'  // Use provided category or default to login
    });
    
    await session.save();
    
    console.log('Password saved for synchronization. Current count:', 
                session.pendingPasswords.length);
    
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

// In getPendingPasswords function or similar, ensure you include the category field
exports.getPendingPasswords = async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }
    
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    
    // Process the pending passwords to ensure they are in the right format
    const pendingPasswords = session.pendingPasswords.map(p => {
      try {
        // If the password is encrypted, try to decrypt it
        let processedPassword = p.password;
        
        if (session.token && (processedPassword.includes(':') || processedPassword.includes(','))) {
          try {
            processedPassword = decryptWithSessionToken(processedPassword, session.token);
            
            // Check if it's a JSON string and extract the password if needed
            try {
              const parsed = JSON.parse(processedPassword);
              if (parsed && typeof parsed === 'object' && parsed.password) {
                // If it's a structured object, use the password field
                processedPassword = parsed.password;
              }
            } catch (e) {
              // Not JSON, use as is
            }
          } catch (decryptError) {
            console.error('Error decrypting pending password:', decryptError);
            // If decryption fails, keep the original value
          }
        }
        
        return {
          _id: p._id,
          title: p.title,
          password: processedPassword,
          saved: p.saved,
          category: p.category || 'login', // Ensure category is always returned
          createdAt: p.createdAt
        };
      } catch (error) {
        console.error('Error processing pending password:', error);
        return {
          _id: p._id,
          title: p.title,
          password: '●●●●●●●●', // Fallback to masked password on error
          saved: p.saved,
          category: p.category || 'login',
          createdAt: p.createdAt
        };
      }
    });
    
    return res.status(200).json({ pendingPasswords });
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