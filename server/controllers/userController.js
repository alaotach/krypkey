const User = require('../models/userModel');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Helper function to encrypt a password
const encryptPassword = (password, privateKey) => {
  const iv = crypto.randomBytes(16); // Initialization vector
  const key = crypto.createHash('sha256').update(privateKey).digest(); // Create a key from the private key
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; // Return the IV and encrypted password
};

// Helper function to decrypt a password
// Helper function to decrypt a password
const decryptPassword = (encryptedPassword, privateKey) => {
  try {
    // Return early if password is undefined or null
    if (!encryptedPassword) {
      return '';
    }
    
    const [ivHex, encrypted] = encryptedPassword.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted password format');
    }
    console.log('IV:', ivHex); 
    console.log('Encrypted:', encrypted);
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.createHash('sha256').update(privateKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error decrypting password:', error);
    return encryptedPassword || ''; // Return the encrypted password or empty string if undefined
  }
};

exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });
    if (user) {
      return res.status(200).json({ message: 'Username already taken' });
    }
    res.status(200).json({ message: 'Username available' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deletePassword = async (req, res) => {
  try {
    const { passwordId } = req.params;
    const user = req.user; // From auth middleware

    if (!user || !passwordId) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Find and remove the password
    const passwordIndex = user.passwords.findIndex(
      p => p._id.toString() === passwordId
    );

    if (passwordIndex === -1) {
      return res.status(404).json({ message: 'Password not found' });
    }

    // Remove the password from the array
    user.passwords.splice(passwordIndex, 1);
    await user.save();

    res.status(200).json({ message: 'Password deleted successfully' });
  } catch (error) {
    console.error('Error deleting password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, password, mnemonic, privateKey } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create new user
    const user = new User({
      username,
      password,
      mnemonic: mnemonic || null,
      privateKey: privateKey || null,
      createdAt: new Date()
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id,
        username: user.username
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token
    });

  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

exports.addPassword = async (req, res) => {
  try {
    const { category, ...passwordData } = req.body;
    const user = req.user; // From auth middleware
    const privateKey = req.privateKey;

    if (!user || !passwordData.title) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Check for duplicates based on title and category
    const existingPasswordIndex = user.passwords.findIndex(pwd => 
      pwd.title === passwordData.title && 
      pwd.category === (category || 'login')
    );

    // Encrypt sensitive fields based on category
    switch (category) {
      case 'login':
      case undefined:
        // Default case is login
        if (passwordData.password && privateKey) {
          passwordData.password = encryptPassword(passwordData.password, privateKey);
        }
        break;
        
      // Other cases remain the same
      case 'creditcard':
        if (passwordData.cardNumber && privateKey) {
          passwordData.cardNumber = encryptPassword(passwordData.cardNumber, privateKey);
        }
        if (passwordData.cvv && privateKey) {
          passwordData.cvv = encryptPassword(passwordData.cvv, privateKey);
        }
        break;
        
      case 'voucher':
        if (passwordData.code && privateKey) {
          passwordData.code = encryptPassword(passwordData.code, privateKey);
        }
        break;
        
      case 'giftcard':
        if (passwordData.cardNumber && privateKey) {
          passwordData.cardNumber = encryptPassword(passwordData.cardNumber, privateKey);
        }
        if (passwordData.pin && privateKey) {
          passwordData.pin = encryptPassword(passwordData.pin, privateKey);
        }
        break;
        
      case 'other':
        if (passwordData.customFields && Array.isArray(passwordData.customFields)) {
          passwordData.customFields = passwordData.customFields.map(field => {
            if (field.isSecret && field.value && privateKey) {
              return {
                ...field,
                value: encryptPassword(field.value, privateKey)
              };
            }
            return field;
          });
        }
        break;
    }

    // Add category to the password data
    passwordData.category = category || 'login';
    
    // Set update timestamp
    passwordData.updatedAt = new Date();

    let message;
    let passwordId;
    
    if (existingPasswordIndex !== -1) {
      // Update existing password
      const existingPassword = user.passwords[existingPasswordIndex];
      passwordId = existingPassword._id;
      
      // Preserve created date
      passwordData.createdAt = existingPassword.createdAt;
      
      // Update the password
      user.passwords[existingPasswordIndex] = {
        ...existingPassword.toObject(),
        ...passwordData
      };
      
      message = 'Password updated successfully';
      console.log(`Updated existing password: ${passwordData.title}`);
    } else {
      // Add new password
      passwordData.createdAt = new Date();
      user.passwords.push(passwordData);
      passwordId = user.passwords[user.passwords.length - 1]._id;
      message = 'Password added successfully';
      console.log(`Added new password: ${passwordData.title}`);
    }

    await user.save();
    res.status(201).json({ 
      message,
      passwordId,
      updated: existingPasswordIndex !== -1
    });
  } catch (error) {
    console.error('Error adding/updating password:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPasswords = async (req, res) => {
  try {
    // Get query parameters
    const { privateKey, username } = req.query;
    
    console.log('Request query params:', {
      username,
      privateKeyReceived: !!privateKey
    });
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    if (!privateKey || privateKey === 'undefined') {
      return res.status(400).json({ message: 'Valid private key is required' });
    }

    // Find user by username
    const user = await User.findOne({ username });
    console.log('Looking up user by username:', username);
    
    if (!user) {
      return res.status(404).json({ message: `User not found: ${username}` });
    }

    console.log('Found user:', user.username);

    // Decrypt passwords using the provided private key
    const decryptedPasswords = user.passwords.map(pwd => {
      try {
        // Return a complete object with all fields
        return {
          id: pwd._id,
          title: pwd.title,
          category: pwd.category || 'login',
          notes: pwd.notes,
          loginUsername: pwd.loginUsername,
          password: pwd.password ? decryptPassword(pwd.password, privateKey) : '',
          website: pwd.website,
          platform: pwd.platform,
          profileUrl: pwd.profileUrl,
          cardType: pwd.cardType,
          cardNumber: pwd.cardNumber ? decryptPassword(pwd.cardNumber, privateKey) : '',
          cardholderName: pwd.cardholderName,
          expiryDate: pwd.expiryDate,
          cvv: pwd.cvv ? decryptPassword(pwd.cvv, privateKey) : '',
          store: pwd.store,
          code: pwd.code ? decryptPassword(pwd.code, privateKey) : '',
          value: pwd.value,
          pin: pwd.pin ? decryptPassword(pwd.pin, privateKey) : '',
          balance: pwd.balance,
          fullName: pwd.fullName,
          streetAddress: pwd.streetAddress,
          city: pwd.city,
          state: pwd.state,
          zipCode: pwd.zipCode,
          country: pwd.country,
          phoneNumber: pwd.phoneNumber,
          email: pwd.email,
          customFields: pwd.customFields && Array.isArray(pwd.customFields) ? 
            pwd.customFields.map(field => ({
              ...field,
              label: field.label,
              isSecret: field.isSecret,
              value: field.isSecret ? decryptPassword(field.value, privateKey) : field.value
            })) : [],
          createdAt: pwd.createdAt,
          updatedAt: pwd.updatedAt
        };
      } catch (err) {
        console.error('Error decrypting password:', err);
        return {
          id: pwd._id,
          title: pwd.title,
          category: pwd.category || 'login',
          error: 'Failed to decrypt password data'
        };
      }
    });

    res.status(200).json(decryptedPasswords);
  } catch (error) {
    console.error('Error in getPasswords:', error);
    res.status(500).json({ message: `Server error: ${error.message}` });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOneAndDelete({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Check if a user has voice authentication enabled
 * GET /api/users/check-voice-auth
 */
exports.checkVoiceAuth = async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    // Find the user in the database
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if voice auth is enabled for this user
    // Since we're implementing voice auth through the voice API,
    // we'll simulate this check for the demo
    
    // In a real implementation, this would check a field in your user document
    // or make a request to the voice API to check if this user has voice data registered
    const voiceAuthEnabled = user.voiceAuthEnabled || false;
    
    return res.status(200).json({ voiceAuthEnabled });
  } catch (error) {
    console.error('Error checking voice auth status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};