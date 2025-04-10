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
        const url = new URL('http://192.168.73.248:5000/api/sessions/has-pending-passwords');
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

  // Add this after the displayPasswords method

// New method to navigate between categories
showCategoryNavigation(activeCategories) {
  // Create navigation header if it doesn't exist
  let navHeader = document.querySelector('.category-navigation');
  
  if (!navHeader) {
    navHeader = document.createElement('div');
    navHeader.className = 'category-navigation';
    
    // Insert at the top of the passwords section, below any existing buttons
    if (this.passwordsList.firstChild) {
      this.passwordsList.insertBefore(navHeader, this.passwordsList.firstChild.nextSibling);
    } else {
      this.passwordsList.appendChild(navHeader);
    }
  }
  
  // Clear existing tabs
  navHeader.innerHTML = '';
  
  // Always include "All" category
  const allCategories = ['all', ...activeCategories].filter((value, index, self) => 
    self.indexOf(value) === index
  );
  
  // Create tabs
  allCategories.forEach(category => {
    const tab = document.createElement('div');
    tab.className = 'category-tab';
    tab.dataset.category = category;
    
    // Initial "All" is active
    if (category === 'all') {
      tab.classList.add('active');
    }
    
    tab.innerHTML = `
      <span class="category-tab-icon ${category !== 'all' ? category : ''}"></span>
      <span class="category-tab-text">${category === 'all' ? 'All' : this.getCategoryTitle(category)}</span>
    `;
    
    // Add click event to filter passwords
    tab.addEventListener('click', () => {
      // Set this tab as active
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Filter visible passwords
      this.filterPasswordsByCategory(category);
    });
    
    navHeader.appendChild(tab);
  });
}

// Method to filter passwords by selected category
filterPasswordsByCategory(category) {
  const passwordItems = document.querySelectorAll('.password-item');
  
  // Show/hide passwords based on category
  passwordItems.forEach(item => {
    if (category === 'all' || item.dataset.category === category) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
  
  // Also show/hide category headers
  const categoryHeaders = document.querySelectorAll('.category-header');
  categoryHeaders.forEach(header => {
    const categoryName = header.querySelector('h3').textContent;
    const matchingCategory = Object.keys(PASSWORD_CATEGORIES).find(
      key => this.getCategoryTitle(PASSWORD_CATEGORIES[key]) === categoryName
    );
    
    if (category === 'all' || (matchingCategory && PASSWORD_CATEGORIES[matchingCategory] === category)) {
      header.style.display = 'block';
    } else {
      header.style.display = 'none';
    }
  });
}

  // Add this after the filterPasswordsByCategory method

// Add search functionality
addSearchBar() {
  // Create search container
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';
  searchContainer.innerHTML = `
    <div class="search-input-wrapper">
      <input type="text" id="password-search" placeholder="Search passwords..." />
      <button id="clear-search" class="btn-icon clear-search-btn" style="display: none;">
        <span class="clear-icon">×</span>
      </button>
    </div>
  `;
  
  // Insert at the very top of passwords list
  this.passwordsList.insertBefore(searchContainer, this.passwordsList.firstChild);
  
  // Add event listeners
  const searchInput = document.getElementById('password-search');
  const clearButton = document.getElementById('clear-search');
  
  searchInput.addEventListener('input', () => {
    const searchValue = searchInput.value.toLowerCase();
    
    // Show/hide clear button
    clearButton.style.display = searchValue.length > 0 ? 'block' : 'none';
    
    // Search functionality
    this.searchPasswords(searchValue);
  });
  
  // Clear search
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    clearButton.style.display = 'none';
    
    // Show all passwords (respect current category filter)
    const activeTab = document.querySelector('.category-tab.active');
    if (activeTab) {
      this.filterPasswordsByCategory(activeTab.dataset.category);
    } else {
      this.filterPasswordsByCategory('all');
    }
  });
}

// Search through passwords
searchPasswords(searchTerm) {
  const passwordItems = document.querySelectorAll('.password-item');
  const categoryHeaders = document.querySelectorAll('.category-header');
  
  // Track which categories have visible items
  const categoriesWithVisibleItems = new Set();
  
  // Filter passwords
  passwordItems.forEach(item => {
    const title = item.querySelector('.password-title').textContent.toLowerCase();
    const details = item.querySelector('.password-details')?.textContent.toLowerCase() || '';
    
    if (searchTerm === '' || title.includes(searchTerm) || details.includes(searchTerm)) {
      item.style.display = 'block';
      if (item.dataset.category) {
        categoriesWithVisibleItems.add(item.dataset.category);
      }
    } else {
      item.style.display = 'none';
    }
  });
  
  // Show/hide category headers based on if they have visible items
  categoryHeaders.forEach(header => {
    const categoryName = header.querySelector('h3').textContent;
    const matchingCategory = Object.keys(PASSWORD_CATEGORIES).find(
      key => this.getCategoryTitle(PASSWORD_CATEGORIES[key]) === categoryName
    );
    
    if (matchingCategory && categoriesWithVisibleItems.has(PASSWORD_CATEGORIES[matchingCategory])) {
      header.style.display = 'block';
    } else {
      header.style.display = 'none';
    }
  });
}


  
  // Replace the addLocalPendingPassword method with this improved version:

  addLocalPendingPassword(title, passwordData, category = 'login') {
    const passwordElement = document.createElement('div');
    passwordElement.className = 'password-item pending';
    passwordElement.dataset.category = category;
    
    // Extract password if it's a string or an object
    let password = '';
    let displayData = '';
    
    try {
      // If passwordData is a JSON string, try to parse it
      if (typeof passwordData === 'string' && 
          (passwordData.startsWith('{') || passwordData.startsWith('['))) {
        try {
          const parsedData = JSON.parse(passwordData);
          // If successfully parsed as JSON, use the parsed object
          if (parsedData && typeof parsedData === 'object') {
            passwordData = parsedData;
          }
        } catch (e) {
          // If parsing fails, use as a simple string password
          console.warn('Failed to parse password data as JSON:', e);
        }
      }
      
      if (typeof passwordData === 'string') {
        // Handle as simple string password
        password = passwordData;
        
        // Simple structure for string passwords
        displayData = `
          <div class="preview-field">Simple password</div>
        `;
      } else if (typeof passwordData === 'object') {
        // Extract password field if it exists
        password = passwordData.password || '';
        
        // Create a detailed preview based on category
        switch (category) {
          case PASSWORD_CATEGORIES.LOGIN:
            displayData = `
              <div class="field-row">
                <span class="field-label">Username:</span>
                <span class="field-value">${passwordData.loginUsername || passwordData.username || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Password:</span>
                <input type="password" class="password-field field-value" value="${password}" readonly />
                <button class="quick-copy" title="Quick Copy" data-value="${password}">📋</button>
              </div>
              ${passwordData.website ? `
                <div class="field-row">
                  <span class="field-label">Website:</span>
                  <span class="field-value">${passwordData.website}</span>
                </div>
              ` : ''}
            `;
            break;
          case PASSWORD_CATEGORIES.SOCIAL:
            displayData = `
              <div class="field-row">
                <span class="field-label">Platform:</span>
                <span class="field-value">${passwordData.platform || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Username:</span>
                <span class="field-value">${passwordData.loginUsername || passwordData.username || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Password:</span>
                <input type="password" class="password-field field-value" value="${password}" readonly />
                <button class="quick-copy" title="Quick Copy" data-value="${password}">📋</button>
              </div>
              ${passwordData.profileUrl ? `
                <div class="field-row">
                  <span class="field-label">URL:</span>
                  <span class="field-value">${passwordData.profileUrl}</span>
                </div>
              ` : ''}
            `;
            break;
          case PASSWORD_CATEGORIES.CARD:
            // Check if CVV appears to be a token/encrypted value
            let cvvValue = passwordData.cvv || '';
            let displayCvv = cvvValue;
            
            // Handle potentially encrypted CVV values
            if (cvvValue && (cvvValue.startsWith('eyJ') || cvvValue.includes(','))) {
              // This looks like encrypted data, use placeholder dots instead
              displayCvv = "●●●";
            }
            
            displayData = `
              <div class="field-row">
                <span class="field-label">Card Type:</span>
                <span class="field-value">${passwordData.cardType || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Card Number:</span>
                <span class="field-value">${passwordData.cardNumber || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Cardholder:</span>
                <span class="field-value">${passwordData.cardholderName || ''}</span>
              </div>
              ${passwordData.expiryDate ? `
                <div class="field-row">
                  <span class="field-label">Expiry:</span>
                  <span class="field-value">${passwordData.expiryDate}</span>
                </div>
              ` : ''}
              ${cvvValue ? `
                <div class="field-row">
                  <span class="field-label">CVV:</span>
                  <input type="password" class="password-field field-value" value="${displayCvv}" readonly />
                  <button class="quick-copy" title="Quick Copy" data-value="${displayCvv}">📋</button>
                </div>
              ` : ''}
            `;
            break;
          case PASSWORD_CATEGORIES.VOUCHER:
            displayData = `
              <div class="field-row">
                <span class="field-label">Store:</span>
                <span class="field-value">${passwordData.store || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Code:</span>
                <input type="password" class="password-field field-value" value="${passwordData.code || ''}" readonly />
                ${passwordData.code ? `<button class="quick-copy" title="Quick Copy" data-value="${passwordData.code}">📋</button>` : ''}
              </div>
              ${passwordData.value ? `
                <div class="field-row">
                  <span class="field-label">Value:</span>
                  <span class="field-value">${passwordData.value}</span>
                </div>
              ` : ''}
              ${passwordData.expiryDate ? `
                <div class="field-row">
                  <span class="field-label">Expires:</span>
                  <span class="field-value">${passwordData.expiryDate}</span>
                </div>
              ` : ''}
            `;
            break;
          case PASSWORD_CATEGORIES.GIFT_CARD:
            displayData = `
              <div class="field-row">
                <span class="field-label">Store:</span>
                <span class="field-value">${passwordData.store || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Card Number:</span>
                <span class="field-value">${passwordData.cardNumber || ''}</span>
              </div>
              ${passwordData.pin ? `
                <div class="field-row">
                  <span class="field-label">PIN:</span>
                  <input type="password" class="password-field field-value" value="${passwordData.pin}" readonly />
                  <button class="quick-copy" title="Quick Copy" data-value="${passwordData.pin}">📋</button>
                </div>
              ` : ''}
              ${passwordData.balance ? `
                <div class="field-row">
                  <span class="field-label">Balance:</span>
                  <span class="field-value">${passwordData.balance}</span>
                </div>
              ` : ''}
            `;
            break;
          case PASSWORD_CATEGORIES.ADDRESS:
            displayData = `
              <div class="field-row">
                <span class="field-label">Name:</span>
                <span class="field-value">${passwordData.fullName || ''}</span>
              </div>
              <div class="field-row">
                <span class="field-label">Address:</span>
                <span class="field-value">${passwordData.streetAddress || ''}</span>
              </div>
              ${passwordData.city || passwordData.state ? `
                <div class="field-row">
                  <span class="field-label">City/State:</span>
                  <span class="field-value">${passwordData.city || ''}, ${passwordData.state || ''} ${passwordData.zipCode || ''}</span>
                </div>
              ` : ''}
              ${passwordData.country ? `
                <div class="field-row">
                  <span class="field-label">Country:</span>
                  <span class="field-value">${passwordData.country}</span>
                </div>
              ` : ''}
            `;
            break;
          case PASSWORD_CATEGORIES.OTHER:
            if (passwordData.customFields && passwordData.customFields.length) {
              displayData = passwordData.customFields.map(field => `
                <div class="field-row">
                  <span class="field-label">${field.label}:</span>
                  ${field.isSecret ? 
                    `<input type="password" class="password-field field-value" value="${field.value}" readonly />
                     <button class="quick-copy" title="Quick Copy" data-value="${field.value}">📋</button>` : 
                    `<span class="field-value">${field.value}</span>`
                  }
                </div>
              `).join('');
            } else if (password) {
              displayData = `
                <div class="field-row">
                  <span class="field-label">Password:</span>
                  <input type="password" class="password-field field-value" value="${password}" readonly />
                  <button class="quick-copy" title="Quick Copy" data-value="${password}">📋</button>
                </div>
              `;
            }
            break;
          default:
            // Default view for any other category
            displayData = `
              <div class="field-row">
                <span class="field-label">Password:</span>
                <input type="password" class="password-field field-value" value="${password}" readonly />
                <button class="quick-copy" title="Quick Copy" data-value="${password}">📋</button>
              </div>
            `;
        }
        
        // Add notes if available
        if (passwordData.notes) {
          displayData += `
            <div class="field-row notes">
              <span class="field-label">Notes:</span>
              <span class="field-value notes-text">${passwordData.notes}</span>
            </div>
          `;
        }
      }
    } catch (error) {
      console.error('Error processing pending password data:', error);
      // In case of any error, create a minimal display
      displayData = `
        <div class="field-row">
          <span class="field-label">Password:</span>
          <input type="password" class="password-field field-value" value="${password}" readonly />
          <button class="quick-copy" title="Quick Copy" data-value="${password}">📋</button>
        </div>
      `;
    }
    
    // Build the HTML with the title and pending badge
    passwordElement.innerHTML = `
      <div class="password-info">
        <div class="password-title">${title} <span class="pending-badge">Pending</span></div>
        <div class="password-details">
          ${displayData}
        </div>
      </div>
    `;
    
    // Add event listeners for password visibility toggle
    const toggleBtns = passwordElement.querySelectorAll('.toggle-visibility');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const passwordField = btn.closest('.field-row').querySelector('.password-field');
        if (passwordField) {
          passwordField.type = passwordField.type === 'password' ? 'text' : 'password';
        }
      });
    });
    
    // Add event listeners for copy buttons
    const copyBtns = passwordElement.querySelectorAll('.quick-copy');
    copyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value);
        
        // Show mini tooltip
        const tooltip = document.createElement('span');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = 'Copied!';
        btn.appendChild(tooltip);
        
        setTimeout(() => tooltip.remove(), 1000);
      });
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
        const verifyUrl = new URL('http://192.168.73.248:5000/api/sessions/verify');
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
      const createSessionResponse = await fetch('http://192.168.73.248:5000/api/sessions/create', {
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
      const response = await fetch('http://192.168.73.248:5000/api/sessions/check', {
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
        await fetch('http://192.168.73.248:5000/api/sessions/pending-password', {
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

// Replace the addPassword method with this updated version:

async addPassword(title, passwordData = {}, category = 'login') {
  try {
    console.log('Starting addPassword method...');
    console.log('Title:', title);
    console.log('Category:', category);
    console.log('Password data type:', typeof passwordData);
    
    if (!title) {
      throw new Error('Title is required');
    }
    
    // Check Chrome storage for session data
    const storedData = await chrome.storage.local.get(['currentSession']);
    if (!storedData || !storedData.currentSession) {
      console.error('No session data found in storage');
      throw new Error('No active session found in storage');
    }
    
    const token = storedData.currentSession.token;
    const sessionId = storedData.currentSession.sessionId;
    
    if (!token || !sessionId) {
      throw new Error('Session data is incomplete');
    }
    
    // For backward compatibility, handle simple password case
    if (typeof passwordData === 'string') {
      passwordData = { password: passwordData };
    }
    
    // Ensure username is properly mapped to the schema field loginUsername
    if (passwordData.username && !passwordData.loginUsername) {
      passwordData.loginUsername = passwordData.username;
      delete passwordData.username; // Remove username to avoid duplication
    }
    
    // Create a complete password object with all metadata
    const fullPasswordData = {
      title,
      category, // Make sure category is included in the JSON data
      ...passwordData,
      createdAt: new Date().toISOString()
    };
    
    console.log('Password data prepared:', JSON.stringify(fullPasswordData));
    
    // First encrypt with session token
    const encryptedPassword = this.encryptDataWithToken(JSON.stringify(fullPasswordData), token);
    
    let serverSuccess = false;
    
    try {
      // Check existing passwords to avoid duplicates
      const existingPasswords = await this.checkExistingPasswordsByTitle(title, token, sessionId);
      if (existingPasswords && existingPasswords.length > 0) {
        console.log('Found existing password with same title, checking for duplicates');
        
        // Check if this is exactly the same password
        const duplicate = existingPasswords.find(pwd => {
          // Basic comparison using title and username
          if (pwd.username === fullPasswordData.loginUsername || 
              pwd.loginUsername === fullPasswordData.loginUsername) {
            return true;
          }
          return false;
        });
        
        if (duplicate) {
          console.log('Duplicate password found, not saving again');
          this.showNotification('This password already exists', 'warning');
          return false;
        }
      }
    
      // Submit to the pending passwords endpoint for syncing
      console.log('Submitting password to server:', { 
        sessionId,
        title,
        category,
        passwordDataKeys: Object.keys(fullPasswordData)
      });
      
      // IMPORTANT: Save the password JSON string with category metadata
      const response = await fetch('http://192.168.73.248:5000/api/sessions/pending-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId,
          title,
          password: JSON.stringify(fullPasswordData),
          category // Send category as a separate field in the request
        })
      });
      
      if (response.ok) {
        console.log('Password successfully synced with server');
        this.showNotification('Password saved successfully', 'success');
        serverSuccess = true;
      } else {
        const errorText = await response.text();
        console.warn('Server sync failed, storing locally:', errorText);
        this.showNotification('Saved locally, will sync later', 'warning');
      }
    } catch (serverError) {
      console.error('Server error, storing password locally:', serverError);
      this.showNotification('Saved locally, will sync later', 'warning');
    }
    
    // Store locally only if server sync failed
    if (!serverSuccess) {
      // Initialize array if needed
      if (!Array.isArray(this.encryptedLocalPasswords)) {
        this.encryptedLocalPasswords = [];
      }
      
      this.encryptedLocalPasswords.push({
        title,
        encryptedValue: encryptedPassword,
        category,
        timestamp: Date.now()
      });
      
      // Save to local storage
      await chrome.storage.local.set({ localPasswords: this.encryptedLocalPasswords });
    }
    
    // Always add to the local display with a "pending" indicator
    // This guarantees we only display once whether server or local storage
    this.addLocalPendingPassword(title, fullPasswordData, category);
    
    return true;
  } catch (error) {
    console.error('Error in addPassword method:', error);
    this.showNotification('Error saving password: ' + error.message, 'error');
    return false;
  }
}

// Add this new helper method to check for existing passwords
async checkExistingPasswordsByTitle(title, token, sessionId) {
  try {
    // Check pending passwords first
    const pendingPasswordsUrl = new URL('http://192.168.73.248:5000/api/sessions/pending-passwords');
    pendingPasswordsUrl.searchParams.append('sessionId', sessionId);
    
    const pendingPasswordsResponse = await fetch(pendingPasswordsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (pendingPasswordsResponse.ok) {
      const pendingData = await pendingPasswordsResponse.json();
      if (pendingData.pendingPasswords && pendingData.pendingPasswords.length > 0) {
        // Filter by title
        const matchingPasswords = pendingData.pendingPasswords.filter(pwd => pwd.title === title);
        if (matchingPasswords.length > 0) {
          return matchingPasswords;
        }
      }
    }
    
    // If no pending passwords match, return empty array
    return [];
  } catch (error) {
    console.error('Error checking existing passwords:', error);
    return [];
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
    
    // Track all added passwords to prevent duplicates
    const addedPasswords = new Map(); // Use title+username as key
    
    // First, get pending passwords from session
    const sessionPasswordsUrl = new URL('http://192.168.73.248:5000/api/sessions/pending-passwords');
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
    let pendingPasswordsData = { pendingPasswords: [] };
    if (sessionPasswordsResponse.ok) {
      pendingPasswordsData = await sessionPasswordsResponse.json();
      if (pendingPasswordsData.pendingPasswords && pendingPasswordsData.pendingPasswords.length > 0) {
        console.log(`Found ${pendingPasswordsData.pendingPasswords.length} pending passwords in session`);
        
        // Display each pending password
        pendingPasswordsData.pendingPasswords.forEach(pendingPwd => {
          try {
            let parsedData;
            let category = pendingPwd.category || 'login';
            
            // Check if the password is a JSON string that needs parsing
            if (typeof pendingPwd.password === 'string') {
              if (pendingPwd.password.startsWith('{') || pendingPwd.password.startsWith('[')) {
                try {
                  parsedData = JSON.parse(pendingPwd.password);
                  // If successful, use the parsed data and its category
                  if (parsedData.category) {
                    category = parsedData.category;
                  }
                } catch (parseError) {
                  console.warn('Failed to parse password JSON:', parseError);
                }
              } else if (pendingPwd.password.includes(',')) {
                // XOR encrypted - try to decrypt
                const decrypted = this.decryptDataWithToken(pendingPwd.password, token);
                try {
                  // Try to parse the decrypted data as JSON
                  parsedData = JSON.parse(decrypted);
                  if (parsedData.category) {
                    category = parsedData.category;
                  }
                } catch (decryptError) {
                  console.warn('Failed to parse decrypted data:', decryptError);
                  parsedData = { password: decrypted };
                }
              }
            }
            const passwordData = parsedData || { password: pendingPwd.password };
            
            // Generate unique key for deduplication
            const key = `${pendingPwd.title}|${passwordData.username || passwordData.loginUsername || ''}`;
            
            // Only add if not already added
            if (!addedPasswords.has(key)) {
              this.addLocalPendingPassword(pendingPwd.title, passwordData, category);
              addedPasswords.set(key, true);
            }
          } catch (error) {
            console.error('Error processing pending password:', error);
            // Fallback to simple display
            this.addLocalPendingPassword(pendingPwd.title, pendingPwd.password);
          }
        });
      }
    }
    
    // Rest of your existing loadPasswords method...
    // Then fetch user's saved passwords from server
    const userPasswordsUrl = new URL('http://192.168.73.248:5000/api/users/passwords');
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
        try {
          const decryptedLocalPwd = this.decryptDataWithToken(localPwd.encryptedValue, token);
          let isDuplicate = false;
          const localData = JSON.parse(decryptedLocalPwd);
          
          // Generate a unique key for this password
          const key = `${localData.title}|${localData.username || localData.loginUsername || ''}`;
          
          // Check if this is a duplicate of something we already added
          if (addedPasswords.has(key)) {
            isDuplicate = true;
          } else {
            // Also check if it's already in the pending passwords
            if (pendingPasswordsData && pendingPasswordsData.pendingPasswords) {
              for (const pendingPwd of pendingPasswordsData.pendingPasswords) {
                if (pendingPwd.title === localData.title) {
                  isDuplicate = true;
                  break;
                }
              }
            }
          }
          
          // If not a duplicate, keep it and add to display
          if (!isDuplicate) {
            updatedLocalPasswords.push(localPwd);
            
            // Display as pending
            try {
              const parsedData = JSON.parse(decryptedLocalPwd);
              
              // Add to our map of displayed passwords
              const key = `${localPwd.title}|${parsedData.username || parsedData.loginUsername || ''}`;
              if (!addedPasswords.has(key)) {
                this.addLocalPendingPassword(
                  localPwd.title, 
                  parsedData, 
                  parsedData.category || localPwd.category || 'login'
                );
                addedPasswords.set(key, true);
              }
            } catch (e) {
              // If parsing fails, display as simple password
              if (!addedPasswords.has(localPwd.title)) {
                this.addLocalPendingPassword(localPwd.title, decryptedLocalPwd, localPwd.category || 'login');
                addedPasswords.set(localPwd.title, true);
              }
            }
          }
        } catch (error) {
          console.error('Error processing local password:', error);
          // On error, keep the local password to avoid data loss
          updatedLocalPasswords.push(localPwd);
        }
      }
    }
    
    // Display user's saved passwords (removing duplicates)
    passwords.forEach(pwd => {
      const key = `${pwd.title}|${pwd.username || pwd.loginUsername || ''}`;
      if (!addedPasswords.has(key)) {
        addedPasswords.set(key, true);
      }
    });
    
    // Display deduplicated passwords
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

// Replace the displayPasswords method

displayPasswords(passwords) {
  // Clear existing non-pending items
  const existingItems = this.passwordsList.querySelectorAll('.password-item:not(.pending)');
  existingItems.forEach(item => item.remove());

  // Add at the beginning of displayPasswords after clearing existing items
  if (passwords.length === 0) {
    this.passwordsList.innerHTML += `
      <div class="empty-state">
        <p>No passwords saved yet. Add a new password to get started.</p>
      </div>
    `;
    // Still add search and navigation
    this.showCategoryNavigation([]);
    this.addSearchBar();
    return;
  }
  
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
  
  // Group passwords by category
  const passwordsByCategory = passwords.reduce((acc, pwd) => {
    const category = pwd.category || 'login'; // Default to login if no category
    if (!acc[category]) acc[category] = [];
    acc[category].push(pwd);
    return acc;
  }, {});
  
  // Add category headers and passwords
  Object.keys(passwordsByCategory).forEach(category => {
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'category-header';
    categoryHeader.innerHTML = `
      <h3>${this.getCategoryTitle(category)}</h3>
    `;
    this.passwordsList.appendChild(categoryHeader);
    
    // Add each password in this category
    passwordsByCategory[category].forEach(passwordItem => {
      const passwordElement = document.createElement('div');
      passwordElement.className = 'password-item';
      passwordElement.dataset.category = category;
      
      // Base HTML structure
      passwordElement.innerHTML = `
        <div class="password-info">
          <div class="password-title">
            <span class="category-icon ${category}"></span>
            ${passwordItem.title}
          </div>
          <div class="password-details">
            ${this.renderPasswordFields(passwordItem)}
          </div>
          <div class="password-actions">
            <button class="toggle-visibility">
              <i class="eye-icon"></i>
            </button>
            <button class="copy-password" data-password="${passwordItem.password || ''}">
              Copy
            </button>
            <button class="edit-password">
              <i class="edit-icon"></i>
            </button>
          </div>
        </div>
      `;
      
      // Add event listeners
      const toggleBtn = passwordElement.querySelector('.toggle-visibility');
      toggleBtn.addEventListener('click', (e) => {
        const passwordFields = passwordElement.querySelectorAll('.password-field');
        passwordFields.forEach(field => {
          field.type = field.type === 'password' ? 'text' : 'password';
        });
      });
      
      const copyBtn = passwordElement.querySelector('.copy-password');
      if (copyBtn.dataset.password) {
        copyBtn.addEventListener('click', (e) => {
          navigator.clipboard.writeText(copyBtn.dataset.password);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy', 2000);
        });
      }
      
      const editBtn = passwordElement.querySelector('.edit-password');
      editBtn.addEventListener('click', (e) => {
        // Implement edit functionality
        this.showEditPasswordForm(passwordItem);
      });

      // Add quick copy functionality
      passwordElement.querySelectorAll('.quick-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = btn.dataset.value;
          navigator.clipboard.writeText(value);
          
          // Show mini tooltip
          const tooltip = document.createElement('span');
          tooltip.className = 'copy-tooltip';
          tooltip.textContent = 'Copied!';
          btn.appendChild(tooltip);
          
          setTimeout(() => tooltip.remove(), 1000);
        });
      });
      
      // Add to display
      this.passwordsList.appendChild(passwordElement);
    });
  });
  
  // Get active categories from displayed passwords - MOVED OUTSIDE THE LOOP
  const activeCategories = [...new Set(passwords.map(pwd => pwd.category || 'login'))];
  
  // Add category navigation tabs - ONLY ONCE
  this.showCategoryNavigation(activeCategories);
  
  // Add search bar - ONLY ONCE
  this.addSearchBar();
}

// Helper to get a display title for each category
getCategoryTitle(category) {
  switch (category.toLowerCase()) {
    case PASSWORD_CATEGORIES.LOGIN:
      return 'Logins';
    case PASSWORD_CATEGORIES.SOCIAL:
      return 'Social Media';
    case PASSWORD_CATEGORIES.CARD:
      return 'Cards';
    case PASSWORD_CATEGORIES.VOUCHER:
      return 'Vouchers';
    case PASSWORD_CATEGORIES.GIFT_CARD:
      return 'Gift Cards';
    case PASSWORD_CATEGORIES.ADDRESS:
      return 'Addresses';
    case PASSWORD_CATEGORIES.OTHER:
      return 'Other Items';
    default:
      return 'Passwords';
  }
}

// Render password fields based on category
renderPasswordFields(passwordItem) {
  const category = passwordItem.category || 'login';
  let fields = '';
  
  switch (category.toLowerCase()) {
    case PASSWORD_CATEGORIES.LOGIN:
      fields = `
        <div class="field-row">
          <span class="field-label">Username:</span>
          <span class="field-value">${passwordItem.username || passwordItem.loginUsername || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Password:</span>
          <input type="password" class="password-field field-value" value="${passwordItem.password || ''}" readonly />
        </div>
        ${passwordItem.website ? `
          <div class="field-row">
            <span class="field-label">Website:</span>
            <span class="field-value">${passwordItem.website}</span>
          </div>
        ` : ''}
      `;
      break;
      
    case PASSWORD_CATEGORIES.SOCIAL:
      fields = `
        <div class="field-row">
          <span class="field-label">Platform:</span>
          <span class="field-value">${passwordItem.platform || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Username:</span>
          <span class="field-value">${passwordItem.username || passwordItem.loginUsername || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Password:</span>
          <input type="password" class="password-field field-value" value="${passwordItem.password || ''}" readonly />
        </div>
      `;
      break;
      
    case PASSWORD_CATEGORIES.CARD:
      fields = `
        <div class="field-row">
          <span class="field-label">Card Type:</span>
          <span class="field-value">${passwordItem.cardType || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Card Number:</span>
          <span class="field-value">${passwordItem.cardNumber || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Cardholder:</span>
          <span class="field-value">${passwordItem.cardholderName || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Expiry:</span>
          <span class="field-value">${passwordItem.expiryDate || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">CVV:</span>
          <input type="password" class="password-field field-value" value="${passwordItem.cvv || ''}" readonly />
        </div>
      `;
      break;
      
    // Add other category renderings here...
    case PASSWORD_CATEGORIES.VOUCHER:
      fields = `
        <div class="field-row">
          <span class="field-label">Store:</span>
          <span class="field-value">${passwordItem.store || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Code:</span>
          <input type="password" class="password-field field-value" value="${passwordItem.code || ''}" readonly />
        </div>
        ${passwordItem.value ? `
          <div class="field-row">
            <span class="field-label">Value:</span>
            <span class="field-value">${passwordItem.value}</span>
          </div>
        ` : ''}
        ${passwordItem.expiryDate ? `
          <div class="field-row">
            <span class="field-label">Expires:</span>
            <span class="field-value">${passwordItem.expiryDate}</span>
          </div>
        ` : ''}
      `;
      break;
      
    case PASSWORD_CATEGORIES.GIFT_CARD:
      fields = `
        <div class="field-row">
          <span class="field-label">Store:</span>
          <span class="field-value">${passwordItem.store || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Card Number:</span>
          <span class="field-value">${passwordItem.cardNumber || ''}</span>
        </div>
        ${passwordItem.pin ? `
          <div class="field-row">
            <span class="field-label">PIN:</span>
            <input type="password" class="password-field field-value" value="${passwordItem.pin}" readonly />
          </div>
        ` : ''}
        ${passwordItem.balance ? `
          <div class="field-row">
            <span class="field-label">Balance:</span>
            <span class="field-value">${passwordItem.balance}</span>
          </div>
        ` : ''}
      `;
      break;
      
    case PASSWORD_CATEGORIES.ADDRESS:
      fields = `
        <div class="field-row">
          <span class="field-label">Name:</span>
          <span class="field-value">${passwordItem.fullName || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Address:</span>
          <span class="field-value">${passwordItem.streetAddress || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">City/State:</span>
          <span class="field-value">${passwordItem.city || ''}, ${passwordItem.state || ''} ${passwordItem.zipCode || ''}</span>
        </div>
        <div class="field-row">
          <span class="field-label">Country:</span>
          <span class="field-value">${passwordItem.country || ''}</span>
        </div>
      `;
      break;
      
    case PASSWORD_CATEGORIES.OTHER:
      if (passwordItem.customFields && passwordItem.customFields.length) {
        fields = passwordItem.customFields.map(field => `
          <div class="field-row">
            <span class="field-label">${field.label}:</span>
            ${field.isSecret ? 
              `<input type="password" class="password-field field-value" value="${field.value}" readonly />` : 
              `<span class="field-value">${field.value}</span>`
            }
          </div>
        `).join('');
      } else {
        fields = `
          <div class="field-row">
            <span class="field-label">Password:</span>
            <input type="password" class="password-field field-value" value="${passwordItem.password || ''}" readonly />
          </div>
        `;
      }
      break;
      
    default:
      fields = `
        <div class="field-row">
          <span class="field-label">Password:</span>
          <input type="password" class="password-field field-value" value="${passwordItem.password || ''}" readonly />
        </div>
      `;
  }
  
  // Add notes if available
  if (passwordItem.notes) {
    fields += `
      <div class="field-row notes">
        <span class="field-label">Notes:</span>
        <span class="field-value notes-text">${passwordItem.notes}</span>
      </div>
    `;
  }

  

  // For every password field, add a quick copy button
  const processedHTML = fields.replace(
    /<input type="password" class="password-field field-value" value="([^"]+)" readonly \/>/g,
    '<input type="password" class="password-field field-value" value="$1" readonly />' +
    '<button class="quick-copy" title="Quick Copy" data-value="$1">📋</button>'
  );
  
  return processedHTML;
  
  
  // return fields;
}



// Replace the showAddPasswordForm method

showAddPasswordForm() {
  // First ensure we have a valid session
  this.checkAndFixSessionState().then(sessionValid => {
    if (!sessionValid) {
      this.showNotification('Session error. Please try logging out and back in.', 'error');
      return;
    }
    
    // Create the category selection modal
    const categoryModalHTML = `
      <div id="category-select-modal" class="modal">
        <div class="modal-content">
          <h2>Select Password Type</h2>
          <div class="category-grid">
            <div class="category-option" data-category="${PASSWORD_CATEGORIES.LOGIN}">
              <div class="category-icon login"></div>
              <span>Login</span>
            </div>
            <div class="category-option" data-category="${PASSWORD_CATEGORIES.SOCIAL}">
              <div class="category-icon social"></div>
              <span>Social Media</span>
            </div>
            <div class="category-option" data-category="${PASSWORD_CATEGORIES.CARD}">
              <div class="category-icon card"></div>
              <span>Card</span>
            </div>
            <div class="category-option" data-category="${PASSWORD_CATEGORIES.VOUCHER}">
              <div class="category-icon voucher"></div>
              <span>Voucher</span>
            </div>
            <div class="category-option" data-category="${PASSWORD_CATEGORIES.GIFT_CARD}">
              <div class="category-icon giftcard"></div>
              <span>Gift Card</span>
            </div>
            <div class="category-option" data-category="${PASSWORD_CATEGORIES.ADDRESS}">
              <div class="category-icon address"></div>
              <span>Address</span>
            </div>
            <div class="category-option" data-category="${PASSWORD_CATEGORIES.OTHER}">
              <div class="category-icon other"></div>
              <span>Other</span>
            </div>
          </div>
          <div class="form-actions">
            <button id="cancel-category-select" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;
    
    // Add to DOM
    document.body.insertAdjacentHTML('beforeend', categoryModalHTML);
    
    // Add event listener for cancel button
    document.getElementById('cancel-category-select').addEventListener('click', () => {
      document.getElementById('category-select-modal').remove();
    });
    
    // Add event listeners for category options
    document.querySelectorAll('.category-option').forEach(option => {
      option.addEventListener('click', () => {
        const category = option.dataset.category;
        document.getElementById('category-select-modal').remove();
        this.showPasswordFormForCategory(category);
      });
    });
  });
}

// New method to show specific form based on category
showPasswordFormForCategory(category) {
  let formHTML = '';
  
  // Create form HTML based on category
  switch (category) {
    case PASSWORD_CATEGORIES.LOGIN:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Login</h2>
            <form id="add-password-form" data-category="${category}">
              <div class="form-group">
                <label for="password-title">Website/App Name</label>
                <input type="text" id="password-title" placeholder="e.g., Google, Netflix, Bank" required>
              </div>
              
              <div class="form-group">
                <label for="username">Username/Email</label>
                <input type="text" id="username" placeholder="Enter username or email">
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
              
              <div class="form-group">
                <label for="website">Website URL (optional)</label>
                <input type="text" id="website" placeholder="https://example.com">
              </div>
              
              <div class="form-group">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" placeholder="Additional information"></textarea>
              </div>
              
              <div class="form-actions">
                <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn">Save Login</button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
      
    case PASSWORD_CATEGORIES.SOCIAL:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Social Media Account</h2>
            <form id="add-password-form" data-category="${category}">
              <div class="form-group">
                <label for="password-title">Account Name</label>
                <input type="text" id="password-title" placeholder="e.g., My Facebook" required>
              </div>
              
              <div class="form-group">
                <label for="platform">Platform</label>
                <input type="text" id="platform" placeholder="e.g., Facebook, Twitter" required>
              </div>
              
              <div class="form-group">
                <label for="username">Username/Email</label>
                <input type="text" id="username" placeholder="Enter username or email">
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
              
              <div class="form-group">
                <label for="profile-url">Profile URL (optional)</label>
                <input type="text" id="profile-url" placeholder="https://example.com/profile">
              </div>
              
              <div class="form-group">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" placeholder="Additional information"></textarea>
              </div>
              
              <div class="form-actions">
                <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn">Save Account</button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
      
    case PASSWORD_CATEGORIES.CARD:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Card</h2>
            <form id="add-password-form" data-category="${category}">
              <div class="form-group">
                <label for="password-title">Card Name</label>
                <input type="text" id="password-title" placeholder="e.g., My Visa Card" required>
              </div>
              
              <div class="form-group">
                <label for="card-type">Card Type</label>
                <select id="card-type">
                  ${CARD_TYPES.map(type => `<option value="${type}">${type}</option>`).join('')}
                </select>
              </div>
              
              <div class="form-group">
                <label for="card-number">Card Number</label>
                <input type="text" id="card-number" placeholder="XXXX XXXX XXXX XXXX" required>
              </div>
              
              <div class="form-group">
                <label for="cardholder-name">Cardholder Name</label>
                <input type="text" id="cardholder-name" placeholder="Name as it appears on card" required>
              </div>
              
              <div class="form-row">
                <div class="form-group half">
                  <label for="expiry-date">Expiry Date</label>
                  <input type="text" id="expiry-date" placeholder="MM/YY" required>
                </div>
                
                <div class="form-group half">
                  <label for="cvv">CVV</label>
                  <input type="password" id="cvv" placeholder="123" required>
                </div>
              </div>
              
              <div class="form-group">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" placeholder="Additional information"></textarea>
              </div>
              
              <div class="form-actions">
                <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn">Save Card</button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
    
    // Add other category forms here...
    case PASSWORD_CATEGORIES.VOUCHER:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Voucher</h2>
            <form id="add-password-form" data-category="${category}">
              <div class="form-group">
                <label for="password-title">Voucher Name</label>
                <input type="text" id="password-title" placeholder="e.g., Amazon Gift Voucher" required>
              </div>
              
              <div class="form-group">
                <label for="store">Store/Service</label>
                <input type="text" id="store" placeholder="e.g., Amazon, Netflix" required>
              </div>
              
              <div class="form-group">
                <label for="code">Code</label>
                <input type="text" id="code" placeholder="Voucher code" required>
              </div>
              
              <div class="form-group">
                <label for="value">Value (optional)</label>
                <input type="text" id="value" placeholder="e.g., $50">
              </div>
              
              <div class="form-group">
                <label for="expiry-date">Expiry Date (optional)</label>
                <input type="date" id="expiry-date">
              </div>
              
              <div class="form-group">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" placeholder="Additional information"></textarea>
              </div>
              
              <div class="form-actions">
                <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn">Save Voucher</button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
      
    case PASSWORD_CATEGORIES.GIFT_CARD:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Gift Card</h2>
            <form id="add-password-form" data-category="${category}">
              <div class="form-group">
                <label for="password-title">Gift Card Name</label>
                <input type="text" id="password-title" placeholder="e.g., Starbucks Gift Card" required>
              </div>
              
              <div class="form-group">
                <label for="store">Store</label>
                <input type="text" id="store" placeholder="e.g., Starbucks, Amazon" required>
              </div>
              
              <div class="form-group">
                <label for="card-number">Card Number</label>
                <input type="text" id="card-number" placeholder="Card number" required>
              </div>
              
              <div class="form-group">
                <label for="pin">PIN (optional)</label>
                <input type="password" id="pin" placeholder="PIN">
              </div>
              
              <div class="form-group">
                <label for="balance">Balance (optional)</label>
                <input type="text" id="balance" placeholder="e.g., $25.00">
              </div>
              
              <div class="form-group">
                <label for="expiry-date">Expiry Date (optional)</label>
                <input type="date" id="expiry-date">
              </div>
              
              <div class="form-group">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" placeholder="Additional information"></textarea>
              </div>
              
              <div class="form-actions">
                <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn">Save Gift Card</button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
      
    case PASSWORD_CATEGORIES.ADDRESS:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Address</h2>
            <form id="add-password-form" data-category="${category}">
              <div class="form-group">
                <label for="password-title">Address Name</label>
                <input type="text" id="password-title" placeholder="e.g., Home, Work" required>
              </div>
              
              <div class="form-group">
                <label for="full-name">Full Name</label>
                <input type="text" id="full-name" placeholder="Full name" required>
              </div>
              
              <div class="form-group">
                <label for="street-address">Street Address</label>
                <textarea id="street-address" placeholder="Street address" required></textarea>
              </div>
              
              <div class="form-row">
                <div class="form-group half">
                  <label for="city">City</label>
                  <input type="text" id="city" placeholder="City" required>
                </div>
                
                <div class="form-group half">
                  <label for="state">State/Province</label>
                  <input type="text" id="state" placeholder="State/Province" required>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group half">
                  <label for="zip-code">ZIP/Postal Code</label>
                  <input type="text" id="zip-code" placeholder="ZIP/Postal code" required>
                </div>
                
                <div class="form-group half">
                  <label for="country">Country</label>
                  <input type="text" id="country" placeholder="Country" required>
                </div>
              </div>
              
              <div class="form-group">
                <label for="phone">Phone Number (optional)</label>
                <input type="tel" id="phone" placeholder="Phone number">
              </div>
              
              <div class="form-group">
                <label for="email">Email (optional)</label>
                <input type="email" id="email" placeholder="Email address">
              </div>
              
              <div class="form-group">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" placeholder="Additional information"></textarea>
              </div>
              
              <div class="form-actions">
                <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn">Save Address</button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
      
    case PASSWORD_CATEGORIES.OTHER:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Other Item</h2>
            <form id="add-password-form" data-category="${category}">
              <div class="form-group">
                <label for="password-title">Item Name</label>
                <input type="text" id="password-title" placeholder="e.g., Secure Note" required>
              </div>
              
              <div id="custom-fields-container">
                <div class="custom-field-row">
                  <div class="form-group">
                    <label for="field-label-0">Field Label</label>
                    <input type="text" id="field-label-0" placeholder="e.g., API Key" required>
                  </div>
                  <div class="form-group">
                    <label for="field-value-0">Value</label>
                    <input type="text" id="field-value-0" placeholder="Value" required>
                  </div>
                  <div class="form-checkbox">
                    <input type="checkbox" id="field-secret-0">
                    <label for="field-secret-0">Secret</label>
                  </div>
                </div>
              </div>
              
              <button type="button" id="add-custom-field" class="btn btn-secondary">
                Add Field
              </button>
              
              <div class="form-group">
                <label for="notes">Notes (optional)</label>
                <textarea id="notes" placeholder="Additional information"></textarea>
              </div>
              
              <div class="form-actions">
                <button type="button" id="cancel-add-password" class="btn btn-secondary">Cancel</button>
                <button type="submit" class="btn">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      `;
      break;
      
    default:
      formHTML = `
        <div id="add-password-modal" class="modal">
          <div class="modal-content">
            <h2>Add Password</h2>
            <form id="add-password-form" data-category="login">
              <div class="form-group">
                <label for="password-title">Title</label>
                <input type="text" id="password-title" placeholder="e.g., Gmail, Netflix" required>
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
  }
  
  // Add to DOM
  document.body.insertAdjacentHTML('beforeend', formHTML);
  
  // Setup event listeners
  document.getElementById('toggle-new-password')?.addEventListener('click', () => {
    const passwordInput = document.getElementById('password-value');
    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
  });
  
  document.getElementById('cancel-add-password').addEventListener('click', () => {
    document.getElementById('add-password-modal').remove();
  });
  
  // For "Other" category, add custom field functionality
  if (category === PASSWORD_CATEGORIES.OTHER) {
    let fieldCounter = 1;
    
    document.getElementById('add-custom-field').addEventListener('click', () => {
      const container = document.getElementById('custom-fields-container');
      const newField = document.createElement('div');
      newField.className = 'custom-field-row';
      newField.innerHTML = `
        <div class="form-group">
          <label for="field-label-${fieldCounter}">Field Label</label>
          <input type="text" id="field-label-${fieldCounter}" placeholder="e.g., API Key" required>
        </div>
        <div class="form-group">
          <label for="field-value-${fieldCounter}">Value</label>
          <input type="text" id="field-value-${fieldCounter}" placeholder="Value" required>
        </div>
        <div class="form-checkbox">
          <input type="checkbox" id="field-secret-${fieldCounter}">
          <label for="field-secret-${fieldCounter}">Secret</label>
        </div>
        <button type="button" class="remove-field btn-icon">
          <i class="remove-icon"></i>
        </button>
      `;
      
      container.appendChild(newField);
      
      // Add remove button handler
      newField.querySelector('.remove-field').addEventListener('click', () => {
        newField.remove();
      });
      
      fieldCounter++;
    });
  }
  
  // Add this to the showPasswordFormForCategory method, replacing the form submission handler

// Setup form submission
const form = document.getElementById('add-password-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('password-title').value.trim();
  if (!title) {
    this.showNotification('Title is required', 'error');
    return;
  }
  
  // Show loading indicator
  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading-indicator';
  loadingEl.innerHTML = '<p>Adding item...</p>';
  document.body.appendChild(loadingEl);
  
  try {
    await this.checkAndFixSessionState();
  
    // Prepare password data based on category
    const passwordData = this.collectFormDataForCategory(category, form);
    console.log('Collected password data:', passwordData);
    
    // Call the addPassword method with the data
    const success = await this.addPassword(title, passwordData, category);
    
    if (success) {
      // Show success notification
      this.showNotification(`${title} added successfully!`, 'success');
      // Close the modal
      document.getElementById('add-password-modal').remove();
    } else {
      // Show error notification
      this.showNotification('Failed to add item. Please try again.', 'error');
    }
  } catch (error) {
    console.error('Error adding password:', error);
    this.showNotification('Error adding item: ' + error.message, 'error');
  } finally {
    loadingEl.remove();
  }
});

}

// Helper method to collect form data based on category
collectFormDataForCategory(category, form) {
  if (!form) return {};
  
  // Helper function to safely get values
  const getValueOrEmpty = (id) => {
    const input = form.querySelector(`#${id}`);
    return input ? input.value.trim() : '';
  };
  
  let passwordData = {};
  
  switch (category) {
    case PASSWORD_CATEGORIES.LOGIN:
      passwordData = {
        loginUsername: getValueOrEmpty('username'),
        password: getValueOrEmpty('password-value'),
        website: getValueOrEmpty('website'),
        notes: getValueOrEmpty('notes')
      };
      break;
      
    case PASSWORD_CATEGORIES.SOCIAL:
      passwordData = {
        platform: getValueOrEmpty('platform'),
        loginUsername: getValueOrEmpty('username'),
        password: getValueOrEmpty('password-value'),
        profileUrl: getValueOrEmpty('profile-url'),
        notes: getValueOrEmpty('notes')
      };
      break;
      
    case PASSWORD_CATEGORIES.CARD:
      passwordData = {
        cardType: getValueOrEmpty('card-type'),
        cardNumber: getValueOrEmpty('card-number'),
        cardholderName: getValueOrEmpty('cardholder-name'),
        expiryDate: getValueOrEmpty('expiry-date'),
        cvv: getValueOrEmpty('cvv'),
        notes: getValueOrEmpty('notes')
      };
      break;
      
    case PASSWORD_CATEGORIES.VOUCHER:
      passwordData = {
        store: getValueOrEmpty('store'),
        code: getValueOrEmpty('code'),
        value: getValueOrEmpty('value'),
        expiryDate: getValueOrEmpty('expiry-date'),
        notes: getValueOrEmpty('notes')
      };
      break;
      
    case PASSWORD_CATEGORIES.GIFT_CARD:
      passwordData = {
        store: getValueOrEmpty('store'),
        cardNumber: getValueOrEmpty('card-number'),
        pin: getValueOrEmpty('pin'),
        balance: getValueOrEmpty('balance'),
        expiryDate: getValueOrEmpty('expiry-date'),
        notes: getValueOrEmpty('notes')
      };
      break;
      
    case PASSWORD_CATEGORIES.ADDRESS:
      passwordData = {
        fullName: getValueOrEmpty('full-name'),
        streetAddress: getValueOrEmpty('street-address'),
        city: getValueOrEmpty('city'),
        state: getValueOrEmpty('state'),
        zipCode: getValueOrEmpty('zip-code'),
        country: getValueOrEmpty('country'),
        phoneNumber: getValueOrEmpty('phone'),
        email: getValueOrEmpty('email'),
        notes: getValueOrEmpty('notes')
      };
      break;
      
    case PASSWORD_CATEGORIES.OTHER:
      passwordData = {
        notes: getValueOrEmpty('notes'),
        customFields: []
      };
      
      // Process custom fields
      const fieldRows = form.querySelectorAll('.custom-field-row');
      fieldRows.forEach((row, index) => {
        const labelInput = row.querySelector(`#field-label-${index}`);
        const valueInput = row.querySelector(`#field-value-${index}`);
        const secretCheckbox = row.querySelector(`#field-secret-${index}`);
        
        if (labelInput && valueInput) {
          const label = labelInput.value.trim();
          const value = valueInput.value.trim();
          const isSecret = secretCheckbox?.checked || false;
          
          if (label && value) {
            passwordData.customFields.push({ label, value, isSecret });
          }
        }
      });
      break;
      
    default:
      // Simple password
      passwordData = {
        password: getValueOrEmpty('password-value'),
        notes: getValueOrEmpty('notes')
      };
  }
  
  // Make sure to include a password field for login and social
  if ((category === PASSWORD_CATEGORIES.LOGIN || 
       category === PASSWORD_CATEGORIES.SOCIAL) && 
      !passwordData.password) {
    console.warn('Password value missing, using empty string');
    passwordData.password = '';
  }
  
  console.log('Collected form data:', passwordData);
  return passwordData;
}

// Enhance the showNotification method

showNotification(message, type = 'info', autoClose = true) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  // Add icon based on notification type
  let icon = '';
  switch (type) {
    case 'success':
      icon = '✓';
      break;
    case 'error':
      icon = '✕';
      break;
    case 'info':
      icon = 'ℹ';
      break;
    case 'warning':
      icon = '⚠';
      break;
  }
  
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${icon}</span>
      <p>${message}</p>
    </div>
    <button class="close-notification">×</button>
  `;
  
  document.body.appendChild(notification);
  
  // Add close button functionality
  notification.querySelector('.close-notification').addEventListener('click', () => {
    notification.classList.add('notification-hiding');
    setTimeout(() => notification.remove(), 300);
  });
  
  // Animation to slide in
  setTimeout(() => {
    notification.classList.add('notification-visible');
  }, 10);
  
  // Auto-close after 4 seconds
  if (autoClose) {
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.add('notification-hiding');
        setTimeout(() => notification.remove(), 300);
      }
    }, 4000);
  }
  
  return notification;
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
  
  //     const url = new URL('http://192.168.73.248:5000/api/users/passwords');
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
        await fetch('http://192.168.73.248:5000/api/sessions/logout', {
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


const PASSWORD_CATEGORIES = {
  LOGIN: 'login',
  SOCIAL: 'social',
  CARD: 'card',
  VOUCHER: 'voucher',
  GIFT_CARD: 'giftcard',
  ADDRESS: 'address',
  OTHER: 'other'
};

// Define card types for the Cards category
const CARD_TYPES = [
  'Credit Card',
  'Debit Card',
  'Prepaid Card',
  'Membership Card',
  'ID Card',
  'Other'
];
  // Initialize the extension
  document.addEventListener('DOMContentLoaded', () => {
    new KrypKeyExtension();
  });