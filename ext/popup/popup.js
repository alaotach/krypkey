class KrypKeyExtension {
  constructor() {
    this.loginSection = document.getElementById('login-section');
    this.passwordsSection = document.getElementById('passwords-section');
    this.qrContainer = document.getElementById('qr-container');
    this.passwordsList = document.getElementById('passwords-list');
    this.logoutBtn = document.getElementById('logout-btn');
    this.accessMethodSet = false;
    this.unlocked = false;
    this.sessionId = null;
    this.encryptedLocalPasswords = [];

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuthStatus();
  }

  setupEventListeners() {
    this.logoutBtn.addEventListener('click', () => this.handleLogout());
  }


  async promptForAccessMethodSetup() {
    try {
      // Check if access method is already set
      if (this.accessMethodSet) {
        return; // Already set up, nothing to do
      }
      
      // Create modal for access method setup
      const setupModalHTML = `
        <div id="access-setup-modal" class="modal">
          <div class="modal-content">
            <h2>Set Up Access Method</h2>
            <p>Choose how you want to unlock your passwords in the future:</p>
            
            <div class="setup-option">
              <h3>Set up PIN</h3>
              <div class="pin-setup">
                <input type="password" id="setup-pin" placeholder="Enter 4-6 digit PIN" maxlength="6" />
                <input type="password" id="confirm-pin" placeholder="Confirm PIN" maxlength="6" />
                <button id="save-pin-btn" class="btn">Save PIN</button>
              </div>
            </div>
            
            <div id="biometric-setup-option" class="setup-option" style="display: none;">
              <h3>Enable Biometric Authentication</h3>
              <button id="enable-biometric-btn" class="btn">Enable Biometrics</button>
            </div>
            
            <div class="setup-footer">
              <button id="skip-setup-btn" class="btn btn-secondary">Skip for now</button>
            </div>
          </div>
        </div>
      `;
      
      // Add modal to DOM
      document.body.insertAdjacentHTML('beforeend', setupModalHTML);
      
      // Check if browser supports biometric authentication
      if (navigator.credentials && navigator.credentials.preventSilentAccess) {
        document.getElementById('biometric-setup-option').style.display = 'block';
        
        // Add event listener for biometric setup
        document.getElementById('enable-biometric-btn').addEventListener('click', () => {
          this.setupBiometricAuth();
        });
      }
      
      // Add event listener for PIN setup
      document.getElementById('save-pin-btn').addEventListener('click', () => {
        const pin = document.getElementById('setup-pin').value;
        const confirmPin = document.getElementById('confirm-pin').value;
        
        if (!pin || pin.length < 4) {
          alert('Please enter a PIN with at least 4 digits');
          return;
        }
        
        if (pin !== confirmPin) {
          alert('PINs do not match');
          return;
        }
        
        this.savePin(pin);
      });
      
      // Add event listener for skipping
      document.getElementById('skip-setup-btn').addEventListener('click', () => {
        document.getElementById('access-setup-modal').remove();
      });
      
    } catch (error) {
      console.error('Error setting up access method:', error);
    }
  }

  async savePin(pin) {
    try {
      // Generate a simple hash of the PIN (in production, use a proper hashing function)
      const encoder = new TextEncoder();
      const pinData = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', pinData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const pinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Store the hashed PIN
      await chrome.storage.local.set({ pinHash });
      
      // Update session to indicate PIN is set
      const storedData = await chrome.storage.local.get('currentSession');
      if (storedData?.currentSession) {
        storedData.currentSession.pinSet = true;
        await chrome.storage.local.set({ currentSession: storedData.currentSession });
      }
      
      this.accessMethodSet = true;
      
      // Close the setup modal
      document.getElementById('access-setup-modal').remove();
      
      // Show success message
      alert('PIN successfully set!');
    } catch (error) {
      console.error('Error saving PIN:', error);
      alert('Failed to set PIN. Please try again.');
    }
  }

  // Set up biometric authentication
async setupBiometricAuth() {
  try {
    // Check if the device supports biometric authentication
    if (!navigator.credentials || !navigator.credentials.preventSilentAccess) {
      alert('Your browser does not support biometric authentication');
      return;
    }
    
    // Create credential for biometric auth
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: new Uint8Array(32),
        rp: {
          name: 'KrypKey',
          id: window.location.hostname
        },
        user: {
          id: new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
          name: 'krypkey-user',
          displayName: 'KrypKey User'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000
      }
    });
    
    if (credential) {
      // Store indication that biometric auth is enabled
      await chrome.storage.local.set({ biometricEnabled: true });
      
      // Update session to indicate biometrics are set
      const storedData = await chrome.storage.local.get('currentSession');
      if (storedData?.currentSession) {
        storedData.currentSession.biometricEnabled = true;
        await chrome.storage.local.set({ currentSession: storedData.currentSession });
      }
      
      this.accessMethodSet = true;
      
      // Close the setup modal
      document.getElementById('access-setup-modal').remove();
      
      // Show success message
      alert('Biometric authentication successfully enabled!');
    }
  } catch (error) {
    console.error('Error setting up biometric auth:', error);
    alert('Failed to set up biometric authentication. Please try again or use a PIN instead.');
  }
}

// Add to the KrypKeyExtension class

// Add this method to the KrypKeyExtension class
showFeatureHighlights() {
  // Create a highlights section at the bottom of the passwords section
  const highlightsHTML = `
    <div class="feature-highlights">
      <h3>New Features Available!</h3>
      <ul>
        <li>
          <strong>Password AutoFill:</strong> KrypKey will detect password fields and suggest matching passwords.
        </li>
        <li>
          <strong>Password Strength Analysis:</strong> See how strong your passwords are as you type.
        </li>
        <li>
          <strong>AI Password Generator:</strong> Create strong, unique passwords using AI.
        </li>
      </ul>
      <button id="got-it-btn" class="btn">Got It!</button>
    </div>
  `;
  
  // Check if we've already shown this
  chrome.storage.local.get('highlightsShown', (data) => {
    if (!data.highlightsShown) {
      // Append to passwords section
      const highlights = document.createElement('div');
      highlights.innerHTML = highlightsHTML;
      this.passwordsSection.appendChild(highlights);
      
      // Add event listener for the "Got It" button
      document.getElementById('got-it-btn').addEventListener('click', () => {
        // Remove the highlights
        document.querySelector('.feature-highlights').remove();
        
        // Remember that we've shown this
        chrome.storage.local.set({ highlightsShown: true });
      });
    }
  });
}

// Update the loadPasswords method to call this after loading passwords
// Add this line at the end of the loadPasswords method:
// this.showFeatureHighlights();

  // Show access prompt (PIN or biometrics) with logout button
  showAccessPrompt() {
    this.loginSection.style.display = 'none';
    this.passwordsSection.style.display = 'none';
    
    // Create and show the access prompt UI with logout button
    const accessPromptHTML = `
      <div id="access-prompt" class="access-prompt">
        <h2>Unlock Your Passwords</h2>
        <div class="access-methods">
          <div id="pin-prompt" class="pin-prompt">
            <label for="pin-input">Enter PIN</label>
            <input type="password" id="pin-input" maxlength="6" />
            <button id="verify-pin-btn" class="btn">Unlock</button>
          </div>
          <div id="biometric-prompt" style="display: none;">
            <button id="biometric-btn" class="btn">
              Use Biometric Authentication
            </button>
          </div>
        </div>
        <div class="access-prompt-footer">
          <button id="logout-from-prompt-btn" class="btn btn-secondary">Log out</button>
        </div>
      </div>
    `;
    
    // Insert the prompt into the DOM
    document.body.insertAdjacentHTML('beforeend', accessPromptHTML);
    
    // Check if biometrics are enabled for this session
    this.checkBiometricStatus().then(biometricEnabled => {
      if (biometricEnabled) {
        document.getElementById('biometric-prompt').style.display = 'block';
        document.getElementById('biometric-btn').addEventListener('click', () => {
          this.verifyBiometrics();
        });
      }
    });
    
    // Add event listener for PIN verification
    document.getElementById('verify-pin-btn').addEventListener('click', () => {
      const pin = document.getElementById('pin-input').value;
      if (pin) {
        this.verifyPin(pin);
      }
    });
    
    // Add event listener for the logout button
    document.getElementById('logout-from-prompt-btn').addEventListener('click', () => {
      // Remove the access prompt first
      document.getElementById('access-prompt').remove();
      // Then call the logout handler
      this.handleLogout();
    });
  }
  async checkBiometricStatus() {
    try {
      const storedData = await chrome.storage.local.get('currentSession');
      return !!storedData?.currentSession?.biometricEnabled;
    } catch (error) {
      console.error('Error checking biometric status:', error);
      return false;
    }
  }
  
  // Verify PIN entered by user
  async verifyPin(pin) {
    try {
      // Get stored PIN hash
      const storedData = await chrome.storage.local.get(['pinHash', 'currentSession']);
      
      if (!storedData.pinHash) {
        alert('No PIN has been set up. Please log in with your mobile app first.');
        return;
      }
      
      // Generate hash of entered PIN
      const encoder = new TextEncoder();
      const pinData = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', pinData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const enteredPinHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Compare hashes
      if (enteredPinHash === storedData.pinHash) {
        // PIN is correct, unlock the session
        this.unlocked = true;
        
        // Update session state
        if (storedData.currentSession) {
          storedData.currentSession.unlocked = true;
          await chrome.storage.local.set({ currentSession: storedData.currentSession });
        }
        
        // Remove the access prompt
        document.getElementById('access-prompt').remove();
        
        // Show passwords view
        this.loginSection.style.display = 'none';
        this.passwordsSection.style.display = 'block';
        await this.loadPasswords();
      } else {
        alert('Incorrect PIN. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      alert('Failed to verify PIN. Please try again.');
    }
  }

  async verifyBiometrics() {
    try {
      // Check if biometrics are supported
      if (!navigator.credentials || !navigator.credentials.get) {
        alert('Biometric authentication is not supported in this browser.');
        return;
      }
      
      // Request biometric authentication
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          rpId: window.location.hostname,
          userVerification: 'required',
          timeout: 60000
        }
      });
      
      if (credential) {
        // Authentication successful
        this.unlocked = true;
        
        // Update session state
        const storedData = await chrome.storage.local.get('currentSession');
        if (storedData.currentSession) {
          storedData.currentSession.unlocked = true;
          await chrome.storage.local.set({ currentSession: storedData.currentSession });
        }
        
        // Remove the access prompt
        document.getElementById('access-prompt').remove();
        
        // Show passwords view
        this.loginSection.style.display = 'none';
        this.passwordsSection.style.display = 'block';
        await this.loadPasswords();
      }
    } catch (error) {
      console.error('Biometric verification error:', error);
      alert('Biometric authentication failed. Please try again or use your PIN.');
    }
  }

  async checkPendingPasswords() {
    try {
      // Check local storage for any pending passwords
      const storedData = await chrome.storage.local.get(['localPasswords', 'currentSession']);
      
      if (storedData.localPasswords && storedData.localPasswords.length > 0) {
        return true;
      }
      
      // Also check server for any pending passwords
      if (storedData?.currentSession?.token && storedData?.currentSession?.sessionId) {
        const url = new URL('http://10.106.35.6:5000/api/sessions/has-pending-passwords');
        url.searchParams.append('sessionId', storedData.currentSession.sessionId);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${storedData.currentSession.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          return !!data.hasPendingPasswords;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking pending passwords:', error);
      return false;
    }
  }
  
  // Helper method to add local pending password to UI
  addLocalPendingPassword(title, password) {
    const passwordElement = document.createElement('div');
    passwordElement.className = 'password-item pending';
    passwordElement.innerHTML = `
      <div class="password-info">
        <div class="password-title">${title} <span class="pending-badge">Pending</span></div>
        <div class="password-value">
          <input type="password" value="${password}" readonly />
          <button class="toggle-visibility">
            <i class="eye-icon"></i>
          </button>
          <button class="copy-password" data-password="${password}">
            Copy
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const toggleBtn = passwordElement.querySelector('.toggle-visibility');
    toggleBtn.addEventListener('click', (e) => {
      const passwordInput = e.target.closest('.password-value').querySelector('input');
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    });
    
    const copyBtn = passwordElement.querySelector('.copy-password');
    copyBtn.addEventListener('click', (e) => {
      navigator.clipboard.writeText(copyBtn.dataset.password);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 2000);
    });
    
    // Add to display at the top
    this.passwordsList.prepend(passwordElement);
  }

  async checkAuthStatus() {
    try {
      const storedData = await chrome.storage.local.get(['currentSession', 'localPasswords']);
      console.log('Checking auth status:', storedData);
      
      // Load locally encrypted passwords if they exist
      if (storedData.localPasswords) {
        this.encryptedLocalPasswords = storedData.localPasswords;
      }
  
      if (storedData?.currentSession?.token && storedData?.currentSession?.username) {
        // Session exists, but we need to verify if it's still valid first
        this.sessionId = storedData.currentSession.sessionId;
        
        // First verify if the session is still valid on the server
        const verifyUrl = new URL('http://10.106.35.6:5000/api/sessions/verify');
        verifyUrl.searchParams.append('username', storedData.currentSession.username);
        
        try {
          const response = await fetch(verifyUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${storedData.currentSession.token}`,
              'Content-Type': 'application/json'
            }
          });
  
          // If session is no longer valid, show login page
          if (!response.ok) {
            console.log('Session expired or invalid');
            
            // Check if there are pending passwords to save before clearing everything
            const hasPendingPasswords = await this.checkPendingPasswords();
            if (!hasPendingPasswords) {
              // No pending passwords, safe to remove session
              await chrome.storage.local.remove('currentSession');
            }
            
            // Show login page
            this.loginSection.style.display = 'block';
            this.passwordsSection.style.display = 'none';
            await this.generateQRCode();
            return;
          }
          
          // Session is valid, now check if it's unlocked
          if (!this.unlocked) {
            // Need to prompt for PIN/biometrics
            this.showAccessPrompt();
            return;
          }
          
          // Session is valid and unlocked, show passwords
          this.loginSection.style.display = 'none';
          this.passwordsSection.style.display = 'block';
          await this.loadPasswords();
          return;
        } catch (error) {
          console.error('Error verifying session:', error);
          // Continue to login screen
        }
      }
      
      // No valid session, show login screen
      this.loginSection.style.display = 'block';
      this.passwordsSection.style.display = 'none';
      await this.generateQRCode();
    } catch (error) {
      console.error('Auth check error:', error);
      this.loginSection.style.display = 'block';
      this.passwordsSection.style.display = 'none';
      await this.generateQRCode();
    }
  }

  // Replace this in the generateQRCode method:

  async generateQRCode() {
    try {
      // Create session expiry selection UI before generating QR code
      this.loginSection.innerHTML = `
        <h2>Login with QR Code</h2>
        <div class="session-duration-selector">
          <label for="session-duration">How long should this session last?</label>
          <select id="session-duration">
            <option value="2">2 hours (default)</option>
            <option value="8">8 hours</option>
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
            <option value="custom">Custom duration</option>
          </select>
          <div id="custom-duration-input" class="custom-input" style="display:none;">
            <input type="number" id="custom-hours" min="1" max="720" value="2" />
            <span>hours</span>
          </div>
        </div>
        <div id="qr-container">
          <!-- QR code will be inserted here -->
        </div>
        <p class="status-text">Scan QR code with KrypKey mobile app</p>
      `;
  
      // Set up the custom duration input toggle
      const durationSelect = document.getElementById('session-duration');
      const customDurationInput = document.getElementById('custom-duration-input');
      
      durationSelect.addEventListener('change', () => {
        if (durationSelect.value === 'custom') {
          customDurationInput.style.display = 'flex';
        } else {
          customDurationInput.style.display = 'none';
        }
      });
  
      // Regenerate references after changing the DOM
      this.qrContainer = document.getElementById('qr-container');
  
      // Add generate button
      const generateButton = document.createElement('button');
      generateButton.className = 'btn';
      generateButton.textContent = 'Generate QR Code';
      generateButton.addEventListener('click', () => this.generateQRWithDuration());
      this.loginSection.appendChild(generateButton);
  
    } catch (error) {
      console.error('Error creating QR setup:', error);
      this.qrContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to create QR setup. Please try again.</p>
          <button class="retry-button">Retry</button>
        </div>
      `;
      
      const retryButton = this.qrContainer.querySelector('.retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          window.location.reload();
        });
      }
    }
  }
  
  // New method to generate QR code with the selected duration
  async generateQRWithDuration() {
    try {
      // Get the selected duration in hours
      let durationHours;
      const durationSelect = document.getElementById('session-duration');
      
      if (durationSelect.value === 'custom') {
        durationHours = parseInt(document.getElementById('custom-hours').value, 10);
        if (isNaN(durationHours) || durationHours < 1 || durationHours > 720) {
          alert('Please enter a valid duration between 1 and 720 hours.');
          return;
        }
      } else {
        durationHours = parseInt(durationSelect.value, 10);
      }
  
      // Convert hours to seconds for the server
      const expirySeconds = durationHours * 3600;
  
      // Generate a unique session ID
      const sessionId = crypto.randomUUID();
      const timestamp = Date.now();
      
      // Create QR code data including the expiry duration
      const qrData = {
        sessionId,
        timestamp,
        type: 'extension_auth',
        expirySeconds
      };
      
      // Register this session with the server
      const createSessionResponse = await fetch('http://10.106.35.6:5000/api/sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sessionId,
          expirySeconds 
        })
      });
      
      if (!createSessionResponse.ok) {
        console.error('Failed to register session with server');
        throw new Error('Failed to create session');
      }
  
      // Convert to Base64 for QR code
      const qrString = btoa(JSON.stringify(qrData));
      
      // Use a QR code library to generate and display the code
      this.qrContainer.innerHTML = `
        <img src="https://api.qrserver.com/v1/create-qr-code/?data=${qrString}&size=200x200" 
             alt="Login QR Code">
      `;
  
      // Show session duration under the QR code
      const statusText = document.querySelector('.status-text');
      statusText.textContent = `Scan QR code with KrypKey mobile app (Session: ${durationHours} hour${durationHours !== 1 ? 's' : ''})`;
  
      // Start polling for authentication
      this.startAuthPolling(sessionId);
    } catch (error) {
      console.error('Error creating QR code:', error);
      
      this.qrContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to create QR code. Please try again.</p>
          <button class="retry-button">Retry</button>
        </div>
      `;
      
      const retryButton = this.qrContainer.querySelector('.retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          this.generateQRWithDuration();
        });
      }
    }
  }

  async startAuthPolling(sessionId) {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch('http://10.106.35.6:5000/api/sessions/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        console.error('Session check failed:', response.status);
        return;
      }

      const data = await response.json();
      console.log('Poll response:', data);
      
      // Add more detailed logging
      if (data.authenticated && data.session) {
        console.log('Session authenticated:', {
          hasToken: !!data.session.token,
          hasUsername: !!data.session.username,
          hasPrivateKey: !!data.session.privateKey,
          hasSessionId: !!data.session.sessionId
        });
        
        // If the server doesn't send back the sessionId, add it ourselves
        if (!data.session.sessionId) {
          console.log('Adding missing sessionId to session data');
          data.session.sessionId = sessionId;
        }
      }

      if (data.authenticated && data.session && 
          data.session.token && data.session.username) {
        clearInterval(pollInterval);
        await this.handleSuccessfulLogin(data.session);
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 2000);

  setTimeout(() => {
    clearInterval(pollInterval);
    this.generateQRCode();
  }, 120000);

  return pollInterval;
}

  async handleSuccessfulLogin(session) {
    try {
      const { token, username, userId, privateKey, sessionId } = session;
      
      if (!privateKey) {
        console.error('No privateKey received from mobile app');
        throw new Error('No privateKey received from mobile app');
      }
      
      if (!sessionId) {
        console.error('No sessionId received from mobile app');
        throw new Error('No sessionId received from mobile app');
      }
      
      // Store session token in cookies (short-lived)
      document.cookie = `token=${token}; path=/`;
      document.cookie = `username=${username}; path=/`;
      document.cookie = `userId=${userId}; path=/`;
      document.cookie = `sessionId=${sessionId}; path=/`;
      
      // Store encrypted privateKey locally using session token as encryption key
      const encryptedPrivateKey = this.encryptDataWithToken(privateKey, token);
      
      // Store session data in local storage with encrypted private key
      await chrome.storage.local.set({
        currentSession: {
          token,
          username,
          userId,
          sessionId,         // Make sure sessionId is explicitly stored
          encryptedPrivateKey,
          unlocked: true,    // Initially unlocked after first login
          privateKey: null   // Don't store actual private key in plain text
        }
      });
      
      console.log('Session stored successfully with encrypted privateKey and sessionId:', sessionId);
      this.sessionId = sessionId;  // Also update in memory
      this.unlocked = true;
      
      // Check if there are any locally stored passwords to sync
      await this.syncLocalPasswords(token, encryptedPrivateKey);
      
      // Prompt for access method setup
      await this.promptForAccessMethodSetup();
      
      // Continue to showing passwords
      this.loginSection.style.display = 'none';
      this.passwordsSection.style.display = 'block';
      await this.loadPasswords();
    } catch (error) {
      console.error('Error storing session:', error);
      throw error;
    }
  }

  encryptDataWithToken(data, token) {
    try {
      // Generate a key from the token
      const encoder = new TextEncoder();
      const keyData = encoder.encode(token);
      
      // Simple XOR encryption (in production, use a proper encryption library)
      const dataArray = encoder.encode(data);
      const encrypted = new Uint8Array(dataArray.length);
      
      for (let i = 0; i < dataArray.length; i++) {
        encrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
      }
      
      return Array.from(encrypted).join(',');
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }
  
  // Decrypt data with token
  decryptDataWithToken(encryptedData, token) {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(token);
      
      const dataArray = encryptedData.split(',').map(Number);
      const decrypted = new Uint8Array(dataArray.length);
      
      for (let i = 0; i < dataArray.length; i++) {
        decrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
      }
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  async syncLocalPasswords(token, encryptedPrivateKey) {
    if (!this.encryptedLocalPasswords || this.encryptedLocalPasswords.length === 0) {
      return;
    }
    
    try {
      const storedData = await chrome.storage.local.get('currentSession');
      
      // Decrypt the private key with the session token
      const privateKey = this.decryptDataWithToken(encryptedPrivateKey, token);
      
      if (!privateKey) {
        throw new Error('Failed to decrypt private key for syncing');
      }
      
      console.log(`Syncing ${this.encryptedLocalPasswords.length} local passwords...`);
      
      // For each locally stored password, decrypt it with the session token
      // then re-encrypt it with the private key and save to server
      for (const encryptedPassword of this.encryptedLocalPasswords) {
        const { title, encryptedValue } = encryptedPassword;
        const password = this.decryptDataWithToken(encryptedValue, token);
        
        // Add the password to pending passwords on the server
        await fetch('http://10.106.35.6:5000/api/sessions/pending-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            sessionId: storedData.currentSession.sessionId,
            title,
            password
          })
        });
      }
      
      // Clear local passwords after successful sync
      this.encryptedLocalPasswords = [];
      await chrome.storage.local.remove('localPasswords');
      
    } catch (error) {
      console.error('Error syncing local passwords:', error);
    }
  }

  // Fix the addPassword method to properly use the token from storage
// Add more debugging to the addPassword method to diagnose the issue
async addPassword(title, password) {
  try {
    console.log('Starting addPassword method...');
    
    // First check if we have a valid session in memory
    if (this.sessionId) {
      console.log('Found sessionId in memory:', this.sessionId);
    } else {
      console.log('No sessionId in memory, checking storage');
    }
    
    // Check Chrome storage for session data
    const storedData = await chrome.storage.local.get(['currentSession']);
    console.log('Retrieved from storage:', storedData);
    
    if (!storedData || !storedData.currentSession) {
      console.error('No session data found in storage');
      throw new Error('No active session found in storage');
    }
    
    if (!storedData.currentSession.token) {
      console.error('Session found but no token available');
      throw new Error('Session token not found');
    }
    
    if (!storedData.currentSession.sessionId) {
      console.error('Session found but no sessionId available');
      throw new Error('Session ID not found');
    }
    
    const token = storedData.currentSession.token;
    const sessionId = storedData.currentSession.sessionId;
    
    console.log('Using token and sessionId from storage:', {
      tokenLength: token.length,
      sessionId
    });
    
    // First encrypt with session token and store locally
    const encryptedPassword = this.encryptDataWithToken(password, token);
    
    if (!encryptedPassword) {
      throw new Error('Failed to encrypt password');
    }
    
    console.log('Password encrypted successfully');
    
    // Initialize encryptedLocalPasswords array if not exists
    if (!Array.isArray(this.encryptedLocalPasswords)) {
      console.log('Initializing encryptedLocalPasswords array');
      this.encryptedLocalPasswords = [];
    }
    
    // Add to local encrypted passwords
    this.encryptedLocalPasswords.push({
      title,
      encryptedValue: encryptedPassword,
      timestamp: Date.now()
    });
    
    console.log('Added to local encrypted passwords array. Current count:', this.encryptedLocalPasswords.length);
    
    // Save to local storage
    await chrome.storage.local.set({ localPasswords: this.encryptedLocalPasswords });
    console.log('Saved encrypted passwords to local storage');
    
    // Also submit to the pending passwords endpoint for syncing
    console.log('Submitting to server endpoint...');
    const response = await fetch('http://10.106.35.6:5000/api/sessions/pending-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        sessionId: sessionId,
        title,
        password
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn('Password saved locally but sync with server failed:', errorText);
    } else {
      console.log('Password successfully synced with server');
    }
    
    // Add it to the local display with a "pending" indicator
    this.addLocalPendingPassword(title, password);
    console.log('Password added to UI');
    
    return true;
  } catch (error) {
    console.error('Error in addPassword method:', error);
    return false;
  }
}

  // Fix the handleLogout method to properly remove session data
  // Add a debug/recovery method for session issues
async checkAndFixSessionState() {
  console.log('Checking session state...');
  
  try {
    // Check current memory state
    console.log('Current memory state:', {
      sessionId: this.sessionId,
      unlocked: this.unlocked
    });
    
    // Check storage state
    const storedData = await chrome.storage.local.get(['currentSession', 'localPasswords']);
    console.log('Storage state:', {
      hasSession: !!storedData.currentSession,
      hasPasswords: !!(storedData.localPasswords && storedData.localPasswords.length > 0)
    });
    
    if (storedData.currentSession) {
      console.log('Session details:', {
        hasToken: !!storedData.currentSession.token,
        hasUsername: !!storedData.currentSession.username,
        hasEncryptedPrivateKey: !!storedData.currentSession.encryptedPrivateKey,
        isUnlocked: !!storedData.currentSession.unlocked,
        sessionId: storedData.currentSession.sessionId
      });
      
      // Update memory state from storage if needed
      if (!this.sessionId && storedData.currentSession.sessionId) {
        console.log('Updating sessionId from storage');
        this.sessionId = storedData.currentSession.sessionId;
      }
      
      if (!this.unlocked && storedData.currentSession.unlocked) {
        console.log('Updating unlocked state from storage');
        this.unlocked = true;
      }
      
      // If we have localPasswords in storage but not in memory, sync them
      if (storedData.localPasswords && storedData.localPasswords.length > 0 && 
          (!this.encryptedLocalPasswords || this.encryptedLocalPasswords.length === 0)) {
        console.log('Syncing local passwords from storage to memory');
        this.encryptedLocalPasswords = storedData.localPasswords;
      }
      
      return true;
    } else {
      console.error('No session found in storage');
      return false;
    }
  } catch (error) {
    console.error('Error checking session state:', error);
    return false;
  }
}

  getTokenFromCookie() {
    const tokenCookie = document.cookie.split(';').find(c => c.trim().startsWith('token='));
    if (tokenCookie) {
      return tokenCookie.split('=')[1];
    }
    return null;
  }
  
  // Load passwords including locally stored ones
  // Replace this in the loadPasswords method:

// New method to directly load and display passwords
// Fix the loadPasswords method to use the encrypted private key from storage
// Fix the loadPasswords method to use the encrypted private key from storage
async loadPasswords() {
  try {
    const storedSession = await chrome.storage.local.get('currentSession');
    if (!storedSession?.currentSession) {
      throw new Error('No active session found');
    }
    
    const token = storedSession.currentSession.token;
    const username = storedSession.currentSession.username;
    const sessionId = storedSession.currentSession.sessionId;
    const encryptedPrivateKey = storedSession.currentSession.encryptedPrivateKey;
    
    if (!token || !username || !encryptedPrivateKey) {
      throw new Error('Missing required session data');
    }
    
    // Decrypt the private key using the token
    const privateKey = this.decryptDataWithToken(encryptedPrivateKey, token);
    
    if (!privateKey) {
      throw new Error('Failed to decrypt private key');
    }
    
    console.log('Using username:', username);
    console.log('Private key successfully decrypted');
    
    // First, clear any existing passwords
    this.passwordsList.innerHTML = '';
    
    // First, get pending passwords from session
    const sessionPasswordsUrl = new URL('http://10.106.35.6:5000/api/sessions/pending-passwords');
    sessionPasswordsUrl.searchParams.append('sessionId', sessionId);
    sessionPasswordsUrl.searchParams.append('username', username);
    
    const sessionPasswordsResponse = await fetch(sessionPasswordsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Process session pending passwords
    if (sessionPasswordsResponse.ok) {
      const pendingPasswordsData = await sessionPasswordsResponse.json();
      if (pendingPasswordsData.pendingPasswords && pendingPasswordsData.pendingPasswords.length > 0) {
        console.log(`Found ${pendingPasswordsData.pendingPasswords.length} pending passwords in session`);
        
        // Display each pending password
        pendingPasswordsData.pendingPasswords.forEach(pendingPwd => {
          // Try to decrypt the password
          let password = pendingPwd.password;
          
          try {
            if (password.includes(',')) {
              // XOR encrypted
              password = this.decryptDataWithToken(password, token);
            } else if (password.includes(':')) {
              // AES encrypted - would need a proper implementation
              // This is a simplification
              password = "●●●●●●●●";
            }
          } catch (decryptError) {
            console.error('Failed to decrypt pending password:', decryptError);
            password = "●●●●●●●●";
          }
          
          this.addLocalPendingPassword(pendingPwd.title, password);
        });
      }
    }
    
    // Then fetch user's saved passwords from server
    const userPasswordsUrl = new URL('http://10.106.35.6:5000/api/users/passwords');
    userPasswordsUrl.searchParams.append('username', username);
    userPasswordsUrl.searchParams.append('privateKey', privateKey);
    
    const userPasswordsResponse = await fetch(userPasswordsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userPasswordsResponse.ok) {
      const errorData = await userPasswordsResponse.json();
      throw new Error(errorData.message || 'Failed to fetch passwords');
    }
    
    const passwords = await userPasswordsResponse.json();
    
    // Process any local passwords that aren't in the user's saved passwords or session
    const localPasswords = this.encryptedLocalPasswords || [];
    
    // Only keep local passwords that aren't duplicated elsewhere
    const updatedLocalPasswords = [];
    
    // Check for duplicates in local encrypted passwords
    if (localPasswords.length > 0) {
      console.log('Checking local passwords for duplicates...');
      
      for (const localPwd of localPasswords) {
        // Decrypt to compare
        const decryptedLocalPwd = this.decryptDataWithToken(localPwd.encryptedValue, token);
        let isDuplicate = false;
        
        // Check if this password is already in user's saved passwords
        for (const savedPwd of passwords) {
          if (savedPwd.title === localPwd.title) {
            isDuplicate = true;
            break;
          }
        }
        
        // If not a duplicate, keep it
        if (!isDuplicate) {
          updatedLocalPasswords.push(localPwd);
          this.addLocalPendingPassword(localPwd.title, decryptedLocalPwd);
        }
      }
      
      // Update the storage with cleaned list
      if (updatedLocalPasswords.length !== localPasswords.length) {
        console.log(`Removed ${localPasswords.length - updatedLocalPasswords.length} duplicate local passwords`);
        
        this.encryptedLocalPasswords = updatedLocalPasswords;
        if (updatedLocalPasswords.length > 0) {
          await chrome.storage.local.set({ localPasswords: updatedLocalPasswords });
        } else {
          await chrome.storage.local.remove('localPasswords');
        }
      }
    }
    
    // Display user's saved passwords
    this.displayPasswords(passwords);
    this.showFeatureHighlights();
    
    // Process any local pending passwords and sync them to server
    if (updatedLocalPasswords.length > 0) {
      console.log('Attempting to sync local pending passwords to server...');
      await this.syncLocalPasswords(token, encryptedPrivateKey);
    }
    
  } catch (error) {
    console.error('Error loading passwords:', error);
    
    // Create error message
    this.passwordsList.innerHTML = `
      <div class="error-message">
        <p>${error.message || 'Failed to load passwords'}</p>
        <button class="retry-button">Retry</button>
      </div>
    `;
    
    // Add event listener
    const retryButton = this.passwordsList.querySelector('.retry-button');
    if (retryButton) {
      retryButton.addEventListener('click', () => {
        this.unlocked = true; // Set to unlocked so we don't show PIN prompt again
        this.loadPasswords();
      });
    }
  }
}

  // Modify the displayPasswords method to include an "Add Password" option at the top

displayPasswords(passwords) {
  // Clear existing non-pending items
  const existingItems = this.passwordsList.querySelectorAll('.password-item:not(.pending)');
  existingItems.forEach(item => item.remove());
  
  // Add "Add Password" button at the top
  const addPasswordButton = document.createElement('div');
  addPasswordButton.className = 'add-password-button';
  addPasswordButton.innerHTML = `
    <button class="btn">
      <span>+ Add New Password</span>
    </button>
  `;
  
  // Add event listener to show add password form
  addPasswordButton.querySelector('button').addEventListener('click', () => {
    this.showAddPasswordForm();
  });
  
  // Add the button to the top of the passwords list
  this.passwordsList.prepend(addPasswordButton);
  
  // Add each password to the list
  passwords.forEach(passwordItem => {
    const passwordElement = document.createElement('div');
    passwordElement.className = 'password-item';
    passwordElement.innerHTML = `
      <div class="password-info">
        <div class="password-title">${passwordItem.title}</div>
        <div class="password-value">
          <input type="password" value="${passwordItem.password}" readonly />
          <button class="toggle-visibility">
            <i class="eye-icon"></i>
          </button>
          <button class="copy-password" data-password="${passwordItem.password}">
            Copy
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    const toggleBtn = passwordElement.querySelector('.toggle-visibility');
    toggleBtn.addEventListener('click', (e) => {
      const passwordInput = e.target.closest('.password-value').querySelector('input');
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    });
    
    const copyBtn = passwordElement.querySelector('.copy-password');
    copyBtn.addEventListener('click', (e) => {
      navigator.clipboard.writeText(copyBtn.dataset.password);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 2000);
    });
    
    // Add to display
    this.passwordsList.appendChild(passwordElement);
  });
}

// Add new method to show the add password form
// Update showAddPasswordForm to check session state before proceeding
showAddPasswordForm() {
  // First ensure we have a valid session
  this.checkAndFixSessionState().then(sessionValid => {
    if (!sessionValid) {
      this.showNotification('Session error. Please try logging out and back in.', 'error');
      return;
    }
    
    // Create the form modal
    const formHTML = `
      <div id="add-password-modal" class="modal">
        <div class="modal-content">
          <h2>Add New Password</h2>
          <form id="add-password-form">
            <div class="form-group">
              <label for="password-title">Website/App Name</label>
              <input type="text" id="password-title" placeholder="e.g., Google, Netflix, Bank" required>
            </div>
            
            <div class="form-group">
              <label for="password-value">Password</label>
              <div class="password-input-group">
                <input type="password" id="password-value" placeholder="Enter password" required>
                <button type="button" id="toggle-new-password" class="btn-icon">
                  <i class="eye-icon"></i>
                </button>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
              <button type="submit" class="btn">Save Password</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', formHTML);
    
    // Setup event listeners
    document.getElementById('toggle-new-password').addEventListener('click', () => {
      const passwordInput = document.getElementById('password-value');
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    });
    
    document.getElementById('cancel-add-password').addEventListener('click', () => {
      document.getElementById('add-password-modal').remove();
    });
    
    document.getElementById('add-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('password-title').value;
      const password = document.getElementById('password-value').value;
      
      if (!title || !password) {
        alert('Please enter both a title and password');
        return;
      }
      
      // Close the modal
      document.getElementById('add-password-modal').remove();
      
      // Add loading indicator
      const loadingEl = document.createElement('div');
      loadingEl.className = 'loading-indicator';
      loadingEl.innerHTML = '<p>Adding password...</p>';
      document.body.appendChild(loadingEl);
      
      try {
        // Check session state again just before adding
        await this.checkAndFixSessionState();
        
        // Call the addPassword method
        const success = await this.addPassword(title, password);
        
        if (success) {
          // Show success notification
          this.showNotification('Password added successfully!', 'success');
        } else {
          // Show error notification
          this.showNotification('Failed to add password. Please try again.', 'error');
        }
      } catch (error) {
        console.error('Error adding password:', error);
        this.showNotification('Error adding password: ' + error.message, 'error');
      } finally {
        // Remove loading indicator
        loadingEl.remove();
      }
    });
  });
}

// Helper method to show notifications
showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <p>${message}</p>
    <button class="close-notification">×</button>
  `;
  
  document.body.appendChild(notification);
  
  // Add close button functionality
  notification.querySelector('.close-notification').addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto-close after 4 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 4000);
}

  // New method to directly load and display passwords
  // async loadPasswords() {
  //   try {
  //     const storedSession = await chrome.storage.local.get('currentSession');
  //     const token = storedSession.currentSession.token;
  
  //     // Retrieve username and privateKey from cookies
  //     const username = this.getCookie('username');
  //     const privateKey = this.getCookie('privateKey');
  
  //     // Debugging statements
  //     console.log('Retrieved username from cookie:', username);
  //     console.log('Retrieved privateKey from cookie:', privateKey ? 'exists' : 'missing');
  
  //     if (!username || !privateKey) {
  //       throw new Error('Missing required credentials');
  //     }
  
  //     const url = new URL('http://10.106.35.6:5000/api/users/passwords');
  //     url.searchParams.append('username', username);
  //     url.searchParams.append('privateKey', privateKey);
  
  //     const response = await fetch(url, {
  //       method: 'GET',
  //       headers: {
  //         'Authorization': `Bearer ${token}`,
  //         'Content-Type': 'application/json'
  //       }
  //     });
  
  //     if (!response.ok) {
  //       const errorData = await response.json();
  //       throw new Error(errorData.message || 'Failed to fetch passwords');
  //     }
  
  //     const passwords = await response.json();
  //     this.renderPasswords(passwords);
  //   } catch (error) {
  //     console.error('Error fetching passwords:', error);
  //     this.passwordsList.innerHTML = `
  //       <div class="error-message">
  //         <p>${error.message || 'Failed to load passwords'}</p>
  //         <button class="retry-button" onclick="window.location.reload()">
  //           Retry
  //         </button>
  //       </div>
  //     `;
  //   }
  // }

  // getCookie(name) {
  //   const value = `; ${document.cookie}`;
  //   const parts = value.split(`; ${name}=`);
  //   if (parts.length === 2) return parts.pop().split(';').shift();
  // }

  // renderPasswords(passwords) {
  //   if (passwords.length === 0) {
  //     this.passwordsList.innerHTML = `
  //       <div class="empty-state">
  //         <p>No passwords saved yet. Add passwords from the KrypKey mobile app.</p>
  //       </div>
  //     `;
  //     return;
  //   }
    
  //   this.passwordsList.innerHTML = passwords.map(pwd => `
  //     <div class="password-item">
  //       <div class="password-info">
  //         <div class="password-title">${pwd.title}</div>
  //         <div class="password-value">
  //           <input type="password" value="${pwd.password}" readonly />
  //           <button class="toggle-visibility" data-id="${pwd.id}">
  //             <i class="eye-icon"></i>
  //           </button>
  //           <button class="copy-password" data-password="${pwd.password}">
  //             Copy
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   `).join('');
  
  //   document.querySelectorAll('.toggle-visibility').forEach(btn => {
  //     btn.addEventListener('click', (e) => {
  //       const passwordInput = e.target.closest('.password-value').querySelector('input');
  //       passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
  //     });
  //   });
  
  //   document.querySelectorAll('.copy-password').forEach(btn => {
  //     btn.addEventListener('click', (e) => {
  //       navigator.clipboard.writeText(btn.dataset.password);
  //       btn.textContent = 'Copied!';
  //       setTimeout(() => btn.textContent = 'Copy', 2000);
  //     });
  //   });
  // }

  async handleLogout() {
    try {
      const storedData = await chrome.storage.local.get('currentSession');
      
      // Check if there are pending passwords before full logout
      const hasPendingPasswords = await this.checkPendingPasswords() || 
                                  (this.encryptedLocalPasswords && this.encryptedLocalPasswords.length > 0);
      
      if (hasPendingPasswords) {
        const confirmLogout = confirm(
          'You have passwords waiting to be synced with your phone. ' +
          'If you logout now, you must log in with your phone to save them. Continue?'
        );
        
        if (!confirmLogout) {
          return; // Abort logout
        }
      }
      
      // Don't actually delete the session from server if there are pending passwords
      if (!hasPendingPasswords) {
        await fetch('http://10.106.35.6:5000/api/sessions/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${storedData.currentSession.token}`
          }
        });
        
        // Clear everything
        await chrome.storage.local.remove(['currentSession', 'localPasswords']);
      } else {
        // Just clear UI state and cookies but keep the session data
        storedData.currentSession.unlocked = false;
        await chrome.storage.local.set({ currentSession: storedData.currentSession });
      }
      
      // Always clear cookies 
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      this.unlocked = false;
      this.passwordsSection.style.display = 'none';
      this.loginSection.style.display = 'block';
      await this.generateQRCode();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }
}

// Initialize the extension
document.addEventListener('DOMContentLoaded', () => {
  new KrypKeyExtension();
});