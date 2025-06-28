/**
 * KrypKey Content Script
 * Detects password fields on websites and suggests saved passwords
 */


// Add this at the beginning of the content script
// Track saved credentials to prevent multiple prompts
const savedCredentialsTracker = {
  savedItems: [],
  
  init() {
    try {
      const saved = sessionStorage.getItem('krypkey_saved_credentials');
      if (saved) {
        this.savedItems = JSON.parse(saved);
      }
    } catch (e) {
      this.savedItems = [];
    }
  },
  
  hasBeenSaved(credentials) {
    return this.savedItems.some(item => 
      item.password === credentials.password && 
      item.username === credentials.username
    );
  },
  
  markAsSaved(credentials) {
    if (!this.hasBeenSaved(credentials)) {
      this.savedItems.push({
        domain: credentials.domain,
        username: credentials.username,
        password: credentials.password,
        timestamp: Date.now()
      });
      
      sessionStorage.setItem('krypkey_saved_credentials', 
        JSON.stringify(this.savedItems)
      );
    }
  }
};

// Initialize the tracker
savedCredentialsTracker.init();




const DEBUG = true;
const DEBUG_PREFIX = '🔑 KrypKey:';

// Helper for debug logging
function debugLog(...args) {
  if (DEBUG) {
    console.log(DEBUG_PREFIX, ...args);
  }
}

// Helper for error logging
function debugError(...args) {
  if (DEBUG) {
    console.error(DEBUG_PREFIX, 'ERROR:', ...args);
  }
}

// Visual debugging overlay
function showDebugOverlay(message, type = 'info') {
  if (!DEBUG) return;
  
  // Remove any existing debug overlay
  const existingOverlay = document.getElementById('krypkey-debug-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  const overlay = document.createElement('div');
  overlay.id = 'krypkey-debug-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: ${type === 'error' ? '#f44336' : '#4285F4'};
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 2147483647;
    max-width: 400px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    opacity: 0.9;
  `;
  
  overlay.textContent = `${DEBUG_PREFIX} ${message}`;
  document.body.appendChild(overlay);
  
  // Remove after 8 seconds
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  }, 8000);
}

// Track detected fields
let detectedFields = {
  username: null,
  password: null,
  form: null,
  origin: window.location.origin,
  domainName: extractDomainName(window.location.hostname)
};


// Keep track of suggestions state
let suggestions = {
  isShowing: false,
  container: null,
  matches: [],
  selectedIndex: 0
};

// Authentication state
let authState = {
  authenticated: false,
  promptVisible: false
};

// Track initialization status
let initStatus = {
  initialized: false,
  startTime: Date.now(),
  lastDetectionTime: null,
  detectionCount: 0,
  errors: []
};

function initializeManager() {
  // Check if we're already authenticated in this browsing session with retry
  checkAuthWithRetry(3);
  
  // Detect fields on page load
  setTimeout(() => {
    detectFields();
    // Second attempt after a delay for SPAs
    setTimeout(detectFields, 1000);
  }, 500);
  
  // Re-scan when DOM changes (for SPAs and dynamic content)
  setupMutationObserver();
  
  // Listen for messages from the extension
  setupMessageListener();
  
  initStatus.initialized = true;
  debugLog('Initialization complete');
}

function setupInitStatusChecker() {
  // Check if we've successfully detected fields every 2 seconds for the first 10 seconds
  let checkCount = 0;
  const maxChecks = 5;
  
  const checkInterval = setInterval(() => {
    checkCount++;
    
    if (detectedFields.password) {
      debugLog('Password field successfully detected');
      clearInterval(checkInterval);
      return;
    }
    
    if (checkCount >= maxChecks) {
      debugLog('Max init checks reached, stopping auto retry');
      clearInterval(checkInterval);
      return;
    }
    
    debugLog(`Init check ${checkCount}/${maxChecks}: No password field detected, retrying...`);
    detectFields();
  }, 2000);
}

function checkForCredentialsAfterRegistration(previousSubmission) {
  try {
    // First detect fields as normal
    detectFields();
    
    debugLog('Checking for credentials after registration', previousSubmission);
    
    // Try to use the credentials from the previous page first
    let credentials = {
      username: previousSubmission.username || '',
      password: previousSubmission.password || '',
      url: window.location.href,
      domain: detectedFields.domainName,
      sourcePage: 'post-registration',
      previousUrl: previousSubmission.previousUrl,
      wasSignupForm: true
    };
    
    // If we found a password field that's already filled, use that value instead
    if (detectedFields.password && detectedFields.password.value) {
      credentials.password = detectedFields.password.value;
      debugLog('Found filled password field after registration');
    }
    
    // If we found a username field that's already filled, use that value instead
    if (detectedFields.username && detectedFields.username.value) {
      credentials.username = detectedFields.username.value;
      debugLog('Found filled username field after registration');
    }
    
    // Only show save prompt if we have both username and password
    if (credentials.username && credentials.password) {
      // Show with a slight delay to ensure page is ready
      setTimeout(() => {
        debugLog('Offering to save credentials after registration');
        
        // First try to save to server directly
        chrome.runtime.sendMessage({
          type: 'forceSaveCredentials',
          credentials: credentials
        }, response => {
          debugLog('Force save response:', response);
          
          // Also show the save prompt
          checkAndOfferToSave(credentials);
        });
      }, 1000);
    } else {
      debugLog('Missing username or password after registration, not offering to save');
    }
  } catch (error) {
    debugError('Error in checkForCredentialsAfterRegistration:', error);
  }
}

const StateManager = {
  autofill: {
    hasShownPrompt: false,
    lastPromptTime: 0,
    minTimeBetweenPrompts: 5000, // 5 seconds between prompts
    cleanup() {
      this.hasShownPrompt = false;
      this.lastPromptTime = 0;
    }
  },

  suggestions: {
    isShowing: false,
    container: null,
    matches: [],
    selectedIndex: 0,
    lastShowTime: 0,
    minTimeBetweenShows: 1000,
    cleanup() {
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
      this.isShowing = false;
      this.matches = [];
      this.selectedIndex = 0;
      this.lastShowTime = 0;
    }
  },

  auth: {
    authenticated: false,
    promptVisible: false,
    cleanup() {
      this.authenticated = false;
      this.promptVisible = false;
    }
  },
  resetAll() {
    this.autofill.cleanup();
    this.suggestions.cleanup();
    this.auth.cleanup();
  }
};

// Improved init function with better error handling
// Improved init function with better error handling
function init() {
  try {
    StateManager.resetAll();
    debugLog('Initializing password manager on', window.location.href);
    showDebugOverlay('Initializing password manager...');
    
    // Add a ready state check for ensuring proper initialization
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initializeManager();
    } else {
      window.addEventListener('DOMContentLoaded', initializeManager);
      // Also listen for load as a fallback
      window.addEventListener('load', () => {
        // Rerun detection after window load to ensure all dynamic content is loaded
        setTimeout(detectFields, 500);
      });
    }

    // Check for stored submission data from registration
    const submissionData = sessionStorage.getItem('krypkey_form_submission');
    if (submissionData) {
      const parsedData = JSON.parse(submissionData);
      
      // Only process recent submissions (last 5 minutes)
      if (parsedData && Date.now() - parsedData.timestamp < 5 * 60 * 1000) {
        debugLog('Found recent form submission data:', parsedData);
        
        // If it was a signup form and we're now on a possibly logged-in page
        if (parsedData.wasSignupForm) {
          // Add a listener to check for auto-filled credentials after the page loads
          setTimeout(() => {
            checkForCredentialsAfterRegistration(parsedData);
          }, 1500);
        }
      }
      
      // Clean up session storage
      sessionStorage.removeItem('krypkey_form_submission');
    }
    
    // Setup an init status checker to retry if something fails
    setupInitStatusChecker();
  } catch (error) {
    debugError('Fatal initialization error:', error);
    initStatus.errors.push('Fatal error: ' + error.message);
    showDebugOverlay('Initialization failed: ' + error.message, 'error');
    
    // Try to recover from fatal error
    setTimeout(() => {
      try {
        debugLog('Attempting recovery from fatal error');
        initializeManager();
      } catch (recoveryError) {
        debugError('Recovery attempt failed:', recoveryError);
      }
    }, 2000);
  }
}

function checkAuthWithRetry(maxRetries) {
  let retryCount = 0;
  
  function attemptAuthCheck() {
    chrome.runtime.sendMessage({ type: 'checkAuth' }, (response) => {
      if (chrome.runtime.lastError) {
        debugError('Error checking auth status:', chrome.runtime.lastError);
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 100; // Exponential backoff
          debugLog(`Retrying auth check (${retryCount}/${maxRetries}) in ${delay}ms`);
          setTimeout(attemptAuthCheck, delay);
        } else {
          initStatus.errors.push('Auth check failed: ' + chrome.runtime.lastError.message);
          showDebugOverlay('Auth check failed: ' + chrome.runtime.lastError.message, 'error');
        }
        return;
      }
      
      authState.authenticated = !!response?.isAuthenticated;
      debugLog('Auth state:', authState.authenticated ? 'Authenticated' : 'Not authenticated');
    });
  }
  
  attemptAuthCheck();
}

function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Debounce detection to avoid excessive processing
    clearTimeout(window.krypkeyDetectionTimeout);
    window.krypkeyDetectionTimeout = setTimeout(() => {
      let shouldDetect = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          shouldDetect = true;
          break;
        }
      }
      
      if (shouldDetect) {
        debugLog('DOM changed, re-detecting fields');
        detectFields();
      }
    }, 300);
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
}

function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      debugLog('Received message:', message.type);
      
      if (message.type === 'fillPassword') {
        if (message.credentials && detectedFields.password) {
          debugLog('Filling password for', message.credentials.title);
          fillFields(message.credentials);
          sendResponse({ success: true });
        } else {
          const error = 'No password field detected or credentials missing';
          debugError(error);
          sendResponse({ success: false, message: error });
        }
      } else if (message.type === 'authResult') {
        debugLog('Auth result received:', message.success ? 'SUCCESS' : 'FAILED');
        authState.authenticated = message.success;
        
        if (message.success && message.credentials) {
          fillFields(message.credentials);
        }
        
        // Clean up auth prompt if it exists
        if (authState.promptVisible) {
          const promptContainer = document.getElementById('krypkey-auth-prompt');
          if (promptContainer) {
            promptContainer.remove();
            authState.promptVisible = false;
          }
        }
        
        sendResponse({ received: true });
      }else if (message.type === 'credentialSaved') {
        // Display a save confirmation
        showNotification('Password saved successfully!', 'success');
        sendResponse({ success: true });
      }
      
      else if (message.type === 'checkStatus') {
        // Check content script status
        sendResponse({
          initialized: initStatus.initialized,
          uptime: Date.now() - initStatus.startTime,
          detectedFields: {
            hasUsername: !!detectedFields.username,
            hasPassword: !!detectedFields.password,
            hasForm: !!detectedFields.form,
            domainName: detectedFields.domainName
          },
          authState: {
            authenticated: authState.authenticated,
            promptVisible: authState.promptVisible
          },
          errors: initStatus.errors,
          detectionCount: initStatus.detectionCount
        });
      } else if (message.type === 'debugDetectFields') {
        // Force field detection and get detailed results
        const results = debugDetectFields();
        sendResponse(results);
      } else if (message.type === 'showTestSuggestions') {
        // Show test suggestions for debugging
        const testSuggestions = message.suggestions || [
          { 
            id: 'test1', 
            title: 'Test Account', 
            username: 'test@example.com',
            password: 'TestPassword123'
          }
        ];
          
        showSuggestions(testSuggestions);
        sendResponse({ success: true });
      } else if (message.type === 'retryDetection') {
        // Manually trigger detection for debugging
        detectFields();
        sendResponse({ success: true });
      }
      else if (message.type === 'checkForCredentialsToSave') {
        // This runs after a detected registration form submission and page navigation
        debugLog('Checking for credentials to save after registration');
        
        // If we have username/password fields filled out on this page (could be "login after registration")
        if (detectedFields.password && detectedFields.password.value &&
            detectedFields.username && detectedFields.username.value) {
            
          // This could be a "post-registration" login page
          const credentials = {
            username: detectedFields.username.value,
            password: detectedFields.password.value,
            url: window.location.href,
            domain: detectedFields.domainName,
            sourcePage: message.previousFormData?.url || 'registration'
          };
          
          // Show a prompt to save the credentials that were just used to register
          checkAndOfferToSave(credentials);
          sendResponse({ success: true, found: true });
        } else {
          sendResponse({ success: true, found: false });
        }
      }
      else if (message.type === 'showSavePromptAfterRegistration') {
        debugLog('Received request to show save prompt after registration');
        
        // Use the provided credentials or try to fetch them from the page
        let credentials;
        
        if (message.credentials) {
          credentials = message.credentials;
          debugLog('Using credentials provided in the message');
        } else if (message.previousFormData) {
          // Create credentials from previous form data
          credentials = {
            username: message.previousFormData.username || '',
            password: message.previousFormData.password || '',
            url: window.location.href,
            domain: extractDomainName(window.location.hostname),
            sourcePage: 'post-registration'
          };
          debugLog('Created credentials from previous form data');
        } else {
          // Try to get from session storage as a last resort
          try {
            const storedData = sessionStorage.getItem('krypkey_form_submission');
            if (storedData) {
              const parsedData = JSON.parse(storedData);
              credentials = {
                username: parsedData.username || '',
                password: parsedData.password || '',
                url: window.location.href,
                domain: extractDomainName(window.location.hostname),
                sourcePage: 'post-registration'
              };
              debugLog('Created credentials from session storage');
              // Clear session storage after use
              sessionStorage.removeItem('krypkey_form_submission');
            }
          } catch (e) {
            debugError('Failed to get credentials from session storage:', e);
          }
        }
        if (credentials && credentials.password) {
          debugLog('Showing save prompt for post-registration credentials');
          
          // First try to save directly
          chrome.runtime.sendMessage({
            type: 'saveRegistrationCredentials',
            credentials: credentials
          });
          
          // Then show visual prompt
          setTimeout(() => {
            showSaveCredentialsPrompt(credentials);
            sendResponse({ success: true });
          }, 500);
        } else {
          debugLog('No valid credentials found for save prompt');
          sendResponse({ success: false, reason: 'no-credentials' });
        }
        
        return true; // Keep message port open for async response
      }
    }
    catch (error) {
      debugError('Error handling message:', error);
    }
    return true; // Keep message port open for async response
  });
}

// function detectFields() {
//   try {
//     initStatus.lastDetectionTime = Date.now();
//     initStatus.detectionCount++;
    
//     debugLog(`Running field detection #${initStatus.detectionCount}`);
    
//     // Find password fields with enhanced detection
//     const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
//     const passwordLikeFields = Array.from(document.querySelectorAll(
//       'input[name*="pass" i], input[id*="pass" i], input[aria-label*="password" i], ' +
//       'input[placeholder*="password" i], input[autocomplete="current-password"]'
//     )).filter(el => el.type !== 'password'); // Only get non-password inputs
    
//     const allPossiblePasswordFields = [...passwordFields, ...passwordLikeFields];
    
//     if (allPossiblePasswordFields.length === 0) {
//       debugLog('No password fields found on page');
//       return;
//     }
    
//     debugLog(`Found ${allPossiblePasswordFields.length} potential password fields`);
    
//     // Add a score-based ranking system for password fields
//     const rankedPasswordFields = allPossiblePasswordFields.map(field => {
//       let score = 0;
      
//       // Type is the strongest indicator
//       if (field.type === 'password') score += 100;
      
//       // Name/ID attributes
//       if (field.name?.toLowerCase().includes('pass')) score += 20;
//       if (field.id?.toLowerCase().includes('pass')) score += 20;
      
//       // Autocomplete attribute
//       if (field.getAttribute('autocomplete') === 'current-password') score += 30;
//       if (field.getAttribute('autocomplete') === 'new-password') score += 30;
      
//       // Aria attributes
//       if (field.getAttribute('aria-label')?.toLowerCase().includes('password')) score += 15;

//       // Placeholder text
//       if (field.placeholder?.toLowerCase().includes('password')) score += 15;
      
//       // Focus state
//       if (document.activeElement === field) score += 50;
      
//       return { field, score };
//     }).sort((a, b) => b.score - a.score);
    
//     if (rankedPasswordFields.length > 0) {
//       detectedFields.password = rankedPasswordFields[0].field;
//       debugLog('Selected password field:', 
//         detectedFields.password.id || detectedFields.password.name || 'unnamed field',
//         `(score: ${rankedPasswordFields[0].score})`);
        
//       // Determine if this is a signup form (new-password) or login form (current-password)
//       const autocomplete = detectedFields.password.getAttribute('autocomplete');
//       detectedFields.isSignupForm = autocomplete === 'new-password' || 
//                                    window.location.href.includes('signup') ||
//                                    window.location.href.includes('register');
                                   
//       debugLog(`Form type: ${detectedFields.isSignupForm ? 'SIGNUP' : 'LOGIN'}`);
//     } else {
//       return;
//     }
    
//     // Find the form containing the password field
//     detectedFields.form = detectedFields.password.form || 
//                           findParentElement(detectedFields.password, 'form');
    
//     // Find potential username fields with improved heuristics
//     const potentialContainer = detectedFields.form || findParentContainer(detectedFields.password);
//     findUsernameField(potentialContainer);
    
//     // Add event listeners and update UI
//     setupFieldListeners();
    
//     // Show AutoFill immediately if we're on a login form
//     if (!detectedFields.isSignupForm) {
//       // Short delay to ensure the page has fully loaded its own scripts
//       setTimeout(() => {
//         tryAutomaticFill();
//       }, 800);
//     } else {
//       // For signup forms, offer password generation
//       setupPasswordGenerationTrigger();
//     }
    
//     // Also monitor form submission for credential saving
//     if (detectedFields.form) {
//       setupFormSubmitListener();
//     }
    
//     // Display debug overlay with detection results
//     const fieldsFound = [
//       detectedFields.password ? 'Password ✓' : 'Password ✗',
//       detectedFields.username ? 'Username ✓' : 'Username ✗',
//       detectedFields.form ? 'Form ✓' : 'Form ✗',
//       detectedFields.isSignupForm ? 'Signup Form' : 'Login Form'
//     ].join(', ');
    
//     showDebugOverlay(`Fields detected: ${fieldsFound}`);

//   } catch (error) {
//     debugError('Error detecting fields:', error);
//     initStatus.errors.push('Field detection error: ' + error.message);
//     showDebugOverlay('Field detection failed: ' + error.message, 'error');
//   }
// }

// Add this at the top with other state variables
let autofillState = {
  hasShownPrompt: false,
  lastPromptTime: 0,
  minTimeBetweenPrompts: 5000 // 5 seconds between prompts
};

// Then modify the tryAutomaticFill function
function tryAutomaticFill() {
  try {
    debugLog('Attempting automatic credential fill');
    
    // Only try automatic fill if we have detected fields
    if (!detectedFields.password) {
      debugLog('No password field available for autofill');
      return;
    }

    const now = Date.now();
    if ((now - StateManager.autofill.lastPromptTime) < StateManager.autofill.minTimeBetweenPrompts) {
      debugLog('Skipping autofill: too soon since last prompt');
      return;
    }

    // Reset all states before showing new prompt
    StateManager.resetAll();

    // Create the request data
    const requestData = {
      type: 'queryPasswords',
      query: { type: 'exactDomain' },
      domain: detectedFields.domainName,
      url: window.location.href
    };
    
    debugLog('Sending autofill query for domain:', detectedFields.domainName);
    
    // Query passwords and show suggestions
    chrome.runtime.sendMessage(requestData, (response) => {
      if (chrome.runtime.lastError) {
        debugError('Error querying passwords:', chrome.runtime.lastError);
        return;
      }

      if (response?.success && response.matches?.length > 0) {
        showSuggestions(response.matches);
        StateManager.autofill.hasShownPrompt = true;
        StateManager.autofill.lastPromptTime = now;
      }
    });

  } catch (error) {
    debugError('Error during automatic fill:', error);
  }
}

function cleanup() {
  try {
    StateManager.resetAll();
    
    // Remove event listeners
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('scroll', handleScroll);
    
    debugLog('Cleanup completed');
  } catch (error) {
    debugError('Error during cleanup:', error);
  }
}

function resetAutofillState() {
  autofillState = {
    hasShownPrompt: false,
    lastPromptTime: 0,
    minTimeBetweenPrompts: 5000
  };
}

// Safely send a message to the background script with error handling
function safelySendMessage(message, callback = null) {
  return new Promise((resolve, reject) => {
    // Check if extension context is valid
    if (!chrome || !chrome.runtime) {
      const error = new Error('Extension context invalidated');
      debugError('Failed to send message, extension context invalid:', message.type);
      
      if (callback) callback({ success: false, error: 'Extension context invalidated' });
      reject(error);
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, response => {
        // Check for runtime errors
        if (chrome.runtime.lastError) {
          debugError(`Error sending ${message.type} message:`, chrome.runtime.lastError);
          
          if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
          reject(chrome.runtime.lastError);
          return;
        }
        
        if (callback) callback(response);
        resolve(response);
      });
    } catch (error) {
      debugError(`Exception sending ${message.type} message:`, error);
      
      if (callback) callback({ success: false, error: error.message });
      reject(error);
    }
  });
}

function showAutoFillPrompt(credential) {
  try {
    if (!detectedFields.password) return;
    
    // Create autofill prompt
    const prompt = document.createElement('div');
    prompt.className = 'krypkey-autofill-prompt';
    prompt.style.cssText = `
      position: absolute;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    // Create shadow DOM
    const shadow = prompt.attachShadow({ mode: 'closed' });
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .autofill-popup {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        padding: 10px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 200px;
        animation: slideIn 0.2s ease-out;
        border: 1px solid #ddd;
      }
      
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .autofill-icon {
        width: 24px;
        height: 24px;
        background: #4285F4;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        flex-shrink: 0;
      }

      .autofill-content {
        flex-grow: 1;
      }
      
      .autofill-title {
        font-size: 13px;
        color: #333;
      }
      
      .autofill-username {
        font-size: 12px;
        color: #666;
        margin-top: 1px;
      }
      
      .autofill-popup:hover {
        background-color: #f8f8f8;
      }
    `;

    const panel = document.createElement('div');
    panel.className = 'autofill-popup';
    
    panel.innerHTML = `
      <div class="autofill-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4L4 8L12 12L20 8L12 4Z" fill="white"/>
          <path d="M4 12V16L12 20L20 16V12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="autofill-content">
        <div class="autofill-title">Autofill with KrypKey</div>
        <div class="autofill-username">${credential.username || 'No username'}</div>
      </div>
    `;
    
    shadow.appendChild(style);
    shadow.appendChild(panel);
    
    // Add to DOM
    document.body.appendChild(prompt);
    
    // Position near the username field (if available) or password field
    const targetField = detectedFields.username || detectedFields.password;
    const fieldRect = targetField.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    prompt.style.left = `${fieldRect.left + scrollX}px`;
    prompt.style.top = `${fieldRect.bottom + scrollY + 5}px`;
    
    // Check for visibility and adjust if needed
    setTimeout(() => {
      const promptRect = prompt.getBoundingClientRect();
      if (promptRect.right > window.innerWidth) {
        prompt.style.left = `${window.innerWidth - promptRect.width - 10 + scrollX}px`;
      }
    }, 0);
    
    // Add click event
    panel.addEventListener('click', () => {
      fillFields(credential);
      prompt.remove();
    });
    
    // Auto-remove after 8 seconds if not clicked
    setTimeout(() => {
      if (prompt.parentNode) {
        prompt.remove();
      }
    }, 8000);
    
  } catch (error) {
    debugError('Error showing autofill prompt:', error);
  }
}

function showCredentialChooser(credentials) {
  try {
    if (!detectedFields.password) return;
    
    // Create chooser
    const chooser = document.createElement('div');
    chooser.className = 'krypkey-credentials-chooser';
    chooser.style.cssText = `
      position: absolute;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    // Create shadow DOM
    const shadow = chooser.attachShadow({ mode: 'closed' });
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .chooser-popup {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        padding: 12px 0;
        min-width: 260px;
        max-width: 320px;
        animation: slideIn 0.2s ease-out;
        border: 1px solid #ddd;
      }
      
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .chooser-header {
        padding: 0 16px 8px;
        color: #333;
        font-size: 13px;
        font-weight: 500;
        border-bottom: 1px solid #eee;
        margin-bottom: 8px;
      }
      
      .credential-option {
        padding: 8px 16px;
        display: flex;
        align-items: center;
        cursor: pointer;
        gap: 10px;
      }

      .credential-option:hover {
        background-color: #f8f8f8;
      }
      
      .credential-icon {
        width: 24px;
        height: 24px;
        background: #4285F4;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        flex-shrink: 0;
      }
      
      .credential-content {
        flex-grow: 1;
      }
      
      .credential-title {
        font-size: 13px;
        color: #333;
      }
      
      .credential-username {
        font-size: 12px;
        color: #666;
        margin-top: 1px;
      }
    `;
    
    // Create content
    const panel = document.createElement('div');
    panel.className = 'chooser-popup';
    
    let html = `<div class="chooser-header">Choose an account</div>`;
    credentials.forEach((credential, index) => {
      html += `
        <div class="credential-option" data-index="${index}">
          <div class="credential-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 8L12 12L20 8L12 4Z" fill="white"/>
              <path d="M4 12V16L12 20L20 16V12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="credential-content">
            <div class="credential-title">${credential.title || detectedFields.domainName}</div>
            <div class="credential-username">${credential.username || 'No username'}</div>
          </div>
        </div>
      `;
    });
    
    panel.innerHTML = html;
    
    shadow.appendChild(style);
    shadow.appendChild(panel);
    
    // Add to DOM
    document.body.appendChild(chooser);
    
    // Position near the username field (if available) or password field
    const targetField = detectedFields.username || detectedFields.password;
    const fieldRect = targetField.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    chooser.style.left = `${fieldRect.left + scrollX}px`;
    chooser.style.top = `${fieldRect.bottom + scrollY + 5}px`;
    
    // Check for visibility and adjust if needed
    setTimeout(() => {
      const chooserRect = chooser.getBoundingClientRect();
      if (chooserRect.right > window.innerWidth) {
        chooser.style.left = `${window.innerWidth - chooserRect.width - 10 + scrollX}px`;
      }
    }, 0);
    
    // Add click events for each option
    shadow.querySelectorAll('.credential-option').forEach(option => {
      option.addEventListener('click', () => {
        const index = parseInt(option.dataset.index);
        if (!isNaN(index) && index >= 0 && index < credentials.length) {
          fillFields(credentials[index]);
          chooser.remove();
        }
      });
    });
    
    // Add click outside to dismiss
    document.addEventListener('click', function dismissHandler(event) {
      if (!chooser.contains(event.target)) {
        chooser.remove();
        document.removeEventListener('click', dismissHandler);
      }
    });
    
  } catch (error) {
    debugError('Error showing credentials chooser:', error);
  }
}

function setupFormSubmitListener() {
  try {
    if (!detectedFields.form || !detectedFields.password) {
      debugLog('No form or password field to monitor for submission');
      return;
    }
    
    debugLog('Setting up form submit listener');
    
    // Remove any existing submit listeners
    if (detectedFields.form.hasSubmitListener) {
      detectedFields.form.removeEventListener('submit', handleFormSubmit);
    }
    
    // Add submit listener
    detectedFields.form.addEventListener('submit', handleFormSubmit);
    detectedFields.form.hasSubmitListener = true;
    
    // Also monitor login/submit buttons for clicks
    const submitButtons = Array.from(detectedFields.form.querySelectorAll(
      'button[type="submit"], input[type="submit"], button[id*="login" i], button[id*="submit" i], ' +
      'button[class*="login" i], button[class*="submit" i], ' + 
      'button[name*="login" i], button[name*="submit" i], ' + 
      'button[id*="register" i], button[class*="register" i], button[id*="signup" i], button[class*="signup" i]'
    ));
    
    submitButtons.forEach(button => {
      if (!button.hasClickListener) {
        button.addEventListener('click', handleButtonClick);
        button.hasClickListener = true;
      }
    });
    
    // Check if this might be a signup form and adjust UI accordingly
    if (detectedFields.isSignupForm) {
      debugLog('Setting up additional monitoring for signup form');
      
      // Setup special monitoring for signup form success
      monitorFormSubmissionResult();
    }
    
    debugLog(`Added listeners to ${submitButtons.length} submit buttons`);
    
  } catch (error) {
    debugError('Error setting up form submit listener:', error);
  }
}

// Update the handleFormSubmit function
function handleFormSubmit(event) {
  try {
    debugLog('Form submitted, capturing credentials');
    
    // Capture current field values
    const credentials = {
      username: detectedFields.username?.value || '',
      password: detectedFields.password?.value || '',
      url: window.location.href,
      domain: detectedFields.domainName,
      wasSignupForm: detectedFields.isSignupForm === true,
      isSignupForm: detectedFields.isSignupForm === true
    };
    
    // For debugging - log credentials (don't do this in production, sensitive!)
    debugLog('Captured credentials:', 
      credentials.username ? 'Username: (found)' : 'Username: (not found)',
      credentials.password ? 'Password: (found)' : 'Password: (not found)',
      'isSignupForm:', credentials.isSignupForm);
    
    // Store in session storage for cross-page access
    if (credentials.username && credentials.password) {
      try {
        const submissionData = {
          timestamp: Date.now(),
          previousUrl: window.location.href,
          username: credentials.username,
          password: credentials.password,
          wasSignupForm: detectedFields.isSignupForm === true
        };
        sessionStorage.setItem('krypkey_form_submission', JSON.stringify(submissionData));
        debugLog('Stored form credentials in session storage');
      } catch (e) {
        debugError('Error storing in session storage:', e);
      }
    }
    
    // Track form submission in background script
    const formData = captureFormData();
    chrome.runtime.sendMessage({
      type: 'formSubmitted',
      formData: formData,
      hasCredentials: !!(credentials.username && credentials.password),
      credentials: (credentials.username && credentials.password) ? credentials : null
    }, response => {
      if (chrome.runtime.lastError) {
        debugError('Error tracking form submission:', chrome.runtime.lastError);
      } else {
        debugLog('Form submission tracked successfully');
      }
    });
    
    // If this is a signup form with credentials, also send a direct save request
    if (detectedFields.isSignupForm && credentials.username && credentials.password) {
      chrome.runtime.sendMessage({
        type: 'saveRegistrationCredentials',
        credentials: credentials
      }, response => {
        if (chrome.runtime.lastError) {
          debugError('Error saving registration credentials:', chrome.runtime.lastError);
        } else {
          debugLog('Registration credentials sent for saving');
        }
      });
    }
    
    // For signup forms, immediately set up monitoring
    if (detectedFields.isSignupForm) {
      debugLog('Setting up monitoring for signup form submission');
      monitorFormSubmissionResult();
    }
    
  } catch (error) {
    debugError('Error handling form submission:', error);
  }
}


function captureFormData() {
  try {
    const formData = {
      url: window.location.href,
      domain: detectedFields.domainName,
      isSignupForm: detectedFields.isSignupForm === true,
      hasPassword: !!detectedFields.password?.value,
      hasUsername: !!detectedFields.username?.value
    };
    
    // Add non-sensitive field info
    if (detectedFields.username) {
      formData.usernameField = {
        id: detectedFields.username.id,
        name: detectedFields.username.name,
        type: detectedFields.username.type,
        hasFocus: document.activeElement === detectedFields.username
      };
    }
    
    if (detectedFields.password) {
      formData.passwordField = {
        id: detectedFields.password.id,
        name: detectedFields.password.name,
        hasFocus: document.activeElement === detectedFields.password
      };
    }
    
    if (detectedFields.form) {
      formData.formInfo = {
        id: detectedFields.form.id,
        action: detectedFields.form.action,
        method: detectedFields.form.method
      };
    }
    
    return formData;
  } catch (error) {
    debugError('Error capturing form data:', error);
    return { url: window.location.href };
  }
}

function handleButtonClick(event) {
  try {
    debugLog('Submit/login button clicked, capturing credentials');
    
    // Wait a short time to give the form a chance to populate any values
    setTimeout(() => {
      captureCredentialsForSaving();
    }, 300);
    
  } catch (error) {
    debugError('Error handling button click:', error);
  }
}

// Capture credentials for saving
function captureCredentialsForSaving() {
  try {
    if (!detectedFields.password || !detectedFields.password.value) {
      debugLog('No password value to save');
      return;
    }
    
    const passwordValue = detectedFields.password.value;
    const usernameValue = detectedFields.username ? detectedFields.username.value : '';
    
    debugLog(`Captured credentials - Username: ${usernameValue ? '(present)' : '(empty)'}, Password: (present)`);
    
    // Store the credentials temporarily
    const credentials = {
      username: usernameValue,
      password: passwordValue,
      url: window.location.href,
      domain: detectedFields.domainName
    };
    
    // Wait a while for the form submission to complete (sign-in process)
    // This increases the chance the submission was a successful login before showing the save prompt
    setTimeout(() => {
      // Check if the page changed (successful login)
      if (window.location.href !== credentials.url) {
        debugLog('Page URL changed, likely successful login');
        credentials.url = window.location.href;
      }
      
      // Now offer to save the credentials
      checkAndOfferToSave(credentials);
    }, 1500);
    
  } catch (error) {
    debugError('Error capturing credentials:', error);
  }
}

// Then modify checkAndOfferToSave to use this tracker
function checkAndOfferToSave(credentials) {
  try {
    debugLog('Checking if credentials should be saved', credentials);
    
    // If no real credentials, don't offer to save
    if (!credentials.password || credentials.password.length < 3) {
      return;
    }
    
    if (!credentials.username) {
      return;
    }
    
    // Check if already saved in this session
    if (savedCredentialsTracker.hasBeenSaved(credentials)) {
      debugLog('Already prompted to save this credential in this session');
      return;
    }
    
    // Query if we already have this username+password
    chrome.runtime.sendMessage({
      type: 'checkExistingCredentials',
      credentials: credentials
    }, (response) => {
      // If credentials exist, don't show save prompt
      if (response && response.exists) {
        debugLog('Credentials already exist, not showing save prompt');
        return;
      }
      
      // Show save prompt
      showSaveCredentialsPrompt(credentials);
      
      // Mark as saved
      savedCredentialsTracker.markAsSaved(credentials);
    });
  } catch (error) {
    debugError('Error checking credentials for saving:', error);
  }
}

function showSaveCredentialsPrompt(credentials) {
  try {
    // Create save prompt
    const prompt = document.createElement('div');
    prompt.className = 'krypkey-save-prompt';
    prompt.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    // Create shadow DOM
    const shadow = prompt.attachShadow({ mode: 'closed' });
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .save-badge {
        display: inline-block;
        background: #4285F4;
        color: white;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: 6px;
        vertical-align: middle;
      }
      .save-popup {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        padding: 16px;
        min-width: 320px;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        border: 1px solid #ddd;
      }
      
      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(40px); }
        to { opacity: 1; transform: translateX(0); }
      }
      
      .save-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      
      .save-icon {
        width: 32px;
        height: 32px;
        background: #4285F4;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        flex-shrink: 0;
      }
      
      .save-title {
        font-size: 15px;
        font-weight: 500;
        color: #333;
        flex-grow: 1;
      }
      
      .save-close {
        font-size: 18px;
        cursor: pointer;
        color: #666;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      
      .save-close:hover {
        background: #f0f0f0;
      }
      
      .save-content {
        margin-bottom: 16px;
      }
      
      .credential-details {
        background: #f8f8f8;
        border-radius: 6px;
        padding: 10px 12px;
        margin-bottom: 12px;
      }
      
      .credential-url {
        font-size: 13px;
        color: #333;
        margin-bottom: 8px;
        font-weight: 500;
      }
      
      .credential-username {
        font-size: 13px;
        color: #666;
      }

      .save-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      
      .btn {
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
        border: none;
      }
      
      .btn-secondary {
        background: #f0f0f0;
        color: #333;
      }
      
      .btn-secondary:hover {
        background: #e0e0e0;
      }
      
      .btn-primary {
        background: #4285F4;
        color: white;
      }
      
      .btn-primary:hover {
        background: #3367d6;
      }
    `;

    const displayUrl = credentials.url.replace(/^https?:\/\//, '').split('/')[0];
    
    const isFromRegistration = 
      credentials.sourcePage === 'registration' || 
      (credentials.url && credentials.url.toLowerCase().includes('register'));
    
    // Create content
    const panel = document.createElement('div');
    panel.className = 'save-popup';
    
    panel.innerHTML = `
      <div class="save-header">
        <div class="save-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 8L12 12L20 8L12 4Z" fill="white"/>
            <path d="M4 12V16L12 20L20 16V12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="save-title">
          Save password in KrypKey?
          ${isFromRegistration ? '<span class="save-badge">New Account</span>' : ''}
        </div>
        <div class="save-close">×</div>
      </div>
      <div class="save-content">
        <div class="credential-details">
          <div class="credential-url">${displayUrl}</div>
          <div class="credential-username">${credentials.username || 'No username'}</div>
        </div>
      </div>
      <div class="save-actions">
        <button class="btn btn-secondary save-never">Never</button>
        <button class="btn btn-secondary save-not-now">Not now</button>
        <button class="btn btn-primary save-yes">Save</button>
      </div>
    `;
    
    shadow.appendChild(style);
    shadow.appendChild(panel);
    
    // Add to DOM
    document.body.appendChild(prompt);
    
    // Add event listeners
    shadow.querySelector('.save-close').addEventListener('click', () => {
      prompt.remove();
    });
    
    shadow.querySelector('.save-never').addEventListener('click', () => {
      // Add domain to never save list
      chrome.runtime.sendMessage({
        type: 'addToNeverSaveList',
        domain: credentials.domain
      });
      prompt.remove();
    });
    shadow.querySelector('.save-not-now').addEventListener('click', () => {
      prompt.remove();
    });
    
    shadow.querySelector('.save-yes').addEventListener('click', () => {
      saveCredentials(credentials);
      prompt.remove();
    });
    
    // Auto-remove after 30 seconds if not interacted with
    setTimeout(() => {
      if (prompt.parentNode) {
        prompt.remove();
      }
    }, 30000);
    
  } catch (error) {
    debugError('Error showing save credentials prompt:', error);
  }
}

function monitorFormSubmissionResult() {
  if (!detectedFields.form || !detectedFields.password) return;
  
  // Store current URL and form values
  const currentUrl = window.location.href;
  const credentials = {
    username: detectedFields.username?.value || '',
    password: detectedFields.password.value || '',
    url: currentUrl,
    domain: detectedFields.domainName,
    wasSignupForm: detectedFields.isSignupForm
  };
  
  debugLog('Monitoring form submission result', credentials);
  
  // Explicitly save registration credentials to background script immediately
  if (credentials.username && credentials.password && detectedFields.isSignupForm) {
    debugLog('Registration detected, saving credentials immediately');
    
    // Send to background script for storage
    chrome.runtime.sendMessage({
      type: 'saveRegistrationCredentials',
      credentials: credentials
    }, response => {
      if (chrome.runtime.lastError) {
        debugError('Error saving registration credentials:', chrome.runtime.lastError);
      } else {
        debugLog('Registration credentials sent to background script successfully');
      }
    });
  }

  try {
    if (credentials.username && credentials.password) {
      const submissionData = {
        timestamp: Date.now(),
        previousUrl: currentUrl,
        username: credentials.username,
        password: credentials.password,
        wasSignupForm: detectedFields.isSignupForm === true
      };
      
      sessionStorage.setItem('krypkey_form_submission', JSON.stringify(submissionData));
      debugLog('Stored form submission data in session storage', submissionData);
      showNotification('Credentials captured, ready to save', 'info');
    }
  } catch (e) {
    debugError('Error storing form submission data:', e);
  }
  
  // Check again after a delay to see if URL changed
  setTimeout(() => {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      debugLog('Page URL changed after form submission, likely successful');
      
      // If this is a registration, explicitly show the save prompt
      if (detectedFields.isSignupForm && credentials.username && credentials.password) {
        debugLog('Registration form navigated, triggering save prompt');
        
        // Force Save
        chrome.runtime.sendMessage({
          type: 'forceSaveCredentials',
          credentials: credentials
        });
      }
    } else {
      // URL didn't change, check if credentials should be saved immediately
      if (detectedFields.isSignupForm && credentials.username && credentials.password) {
        debugLog('Form submitted without navigation, offering to save credentials');
        setTimeout(() => {
          checkAndOfferToSave(credentials);
        }, 1000);
      }
    }
  }, 2000);
}



function saveCredentials(credentials) {
  try {
    debugLog('Saving credentials to extension');
    
    // Create fuller credential object with title
    const fullCredential = {
      title: credentials.domain,
      username: credentials.username,
      password: credentials.password,
      website: credentials.url,
      category: 'login',
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    
    // Send to background script for storage
    chrome.runtime.sendMessage({
      type: 'saveCredentials',
      credential: fullCredential
    }, (response) => {
      if (chrome.runtime.lastError) {
        debugError('Error saving credentials:', chrome.runtime.lastError);
        showNotification('Failed to save credentials', 'error');
        return;
      }
      
      if (response?.success) {
        debugLog('Credentials saved successfully');
        showNotification('Password saved', 'success');
      } else {
        debugError('Error from background script when saving credentials:', response?.error);
        showNotification('Failed to save credentials', 'error');
      }
    });
    
  } catch (error) {
    debugError('Error saving credentials:', error);
    showNotification('Failed to save credentials', 'error');
  }
}

function setupPasswordGenerationTrigger() {
  try {
    if (!detectedFields.password || !detectedFields.isSignupForm) {
      return;
    }
    
    debugLog('Setting up password generation trigger for signup form');
    
    // Focus event should trigger the generator
    if (!detectedFields.password.hasGenerateListener) {
      detectedFields.password.addEventListener('focus', showPasswordGenerator);
      detectedFields.password.hasGenerateListener = true;
    }
    
  } catch (error) {
    debugError('Error setting up password generation:', error);
  }
}

function showPasswordGenerator(event) {
  try {
    // Ensure this is only shown once per field
    const field = event.target;
    if (field.hasShownGenerator) return;
    field.hasShownGenerator = true;
    
    debugLog('Showing password generator');
    
    // Create generator UI
    const generator = document.createElement('div');
    generator.className = 'krypkey-password-generator';
    generator.style.cssText = `
      position: absolute;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    // Create shadow DOM
    const shadow = generator.attachShadow({ mode: 'closed' });
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .generator-popup {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        padding: 12px 16px;
        min-width: 280px;
        animation: slideIn 0.2s ease-out;
        border: 1px solid #ddd;
      }
      
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .generator-header {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        gap: 10px;
      }
      
      .generator-icon {
        width: 24px;
        height: 24px;
        background: #4285F4;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        flex-shrink: 0;
      }
      
      .generator-title {
        font-size: 13px;
        color: #333;
        font-weight: 500;
        flex-grow: 1;
      }
      
      .generator-close {
        font-size: 18px;
        cursor: pointer;
        color: #666;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
      }
      
      .generator-close:hover {
        background: #f0f0f0;
      }
      
      .generator-password {
        background: #f8f8f8;
        border-radius: 4px;
        padding: 8px 12px;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .password-display {
        font-family: monospace;
        font-size: 14px;
        color: #333;
      }
      
      .refresh-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #4285F4;
        padding: 4px;
        border-radius: 4px;
      }
      
      .refresh-btn:hover {
        background: #e8f0fe;
      }
      
      .generator-actions {
        display: flex;
        justify-content: flex-end;
      }
      
      .use-btn {
        background: #4285F4;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
      }
      
      .use-btn:hover {
        background: #3367d6;
      }
      
      .strength-indicator {
        margin-bottom: 12px;
      }
      
      .strength-bar {
        height: 4px;
        background: #eee;
        border-radius: 2px;
        overflow: hidden;
      }
      
      .strength-fill {
        height: 100%;
        background: #4285F4;
      }
      
      .strength-text {
        font-size: 11px;
        color: #666;
        margin-top: 4px;
        text-align: right;
      }
    `;

    const generatedPassword = generateStrongPassword();
    
    // Create content
    const panel = document.createElement('div');
    panel.className = 'generator-popup';
    
    panel.innerHTML = `
      <div class="generator-header">
        <div class="generator-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 8L12 12L20 8L12 4Z" fill="white"/>
            <path d="M4 12V16L12 20L20 16V12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="generator-title">Use generated password</div>
        <div class="generator-close">×</div>
      </div>
      <div class="generator-password">
        <div class="password-display">${generatedPassword}</div>
        <button class="refresh-btn" title="Generate new password">↻</button>
      </div>
      <div class="strength-indicator">
        <div class="strength-bar">
          <div class="strength-fill" style="width: 90%"></div>
        </div>
        <div class="strength-text">Strong password</div>
      </div>
      <div class="generator-actions">
        <button class="use-btn">Use password</button>
      </div>
    `;
    
    shadow.appendChild(style);
    shadow.appendChild(panel);
    
    // Add to DOM
    document.body.appendChild(generator);
    
    // Position near the password field
    const fieldRect = field.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    generator.style.left = `${fieldRect.left + scrollX}px`;
    generator.style.top = `${fieldRect.bottom + scrollY + 5}px`;
    
    // Check for visibility and adjust if needed
    setTimeout(() => {
      const generatorRect = generator.getBoundingClientRect();
      if (generatorRect.right > window.innerWidth) {
        generator.style.left = `${window.innerWidth - generatorRect.width - 10 + scrollX}px`;
      }
    }, 0);
    
    // Add event listeners
    shadow.querySelector('.generator-close').addEventListener('click', () => {
      generator.remove();
    });
    
    shadow.querySelector('.refresh-btn').addEventListener('click', () => {
      const newPassword = generateStrongPassword();
      shadow.querySelector('.password-display').textContent = newPassword;
    });
    
    shadow.querySelector('.use-btn').addEventListener('click', () => {
      const password = shadow.querySelector('.password-display').textContent;
      field.value = password;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      generator.remove();
      
      // If we have a confirm password field, fill it too
      findAndFillConfirmPassword(password);
    });
    
    // Auto-remove after 15 seconds if not interacted with
    setTimeout(() => {
      if (generator.parentNode) {
        generator.remove();
      }
    }, 15000);
    
  } catch (error) {
    debugError('Error showing password generator:', error);
  }
}

function generateStrongPassword() {
  try {
    const length = 16;
    const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Removed confusing characters like I and O
    const lowercaseChars = 'abcdefghijkmnopqrstuvwxyz'; // Removed confusing characters like l
    const numberChars = '23456789'; // Removed confusing characters like 0 and 1
    const specialChars = '!@#$%^&*-_=+';
    
    const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
    let password = '';
    
    // Ensure at least one of each type of character
    password += uppercaseChars.charAt(Math.floor(Math.random() * uppercaseChars.length));
    password += lowercaseChars.charAt(Math.floor(Math.random() * lowercaseChars.length));
    password += numberChars.charAt(Math.floor(Math.random() * numberChars.length));
    password += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    
    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    password = shuffleString(password);
    
    return password;
    
  } catch (error) {
    debugError('Error generating password:', error);
    return 'Password1!'; // Fallback password
  }
}

function shuffleString(string) {
  const array = string.split('');
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array.join('');
}

function findAndFillConfirmPassword(password) {
  try {
    if (!detectedFields.form || !detectedFields.password) return;
    
    // Look for confirm password field in the same form
    const confirmPasswordFields = Array.from(detectedFields.form.querySelectorAll('input[type="password"]'))
      .filter(field => field !== detectedFields.password);
    
    if (!confirmPasswordFields.length) return;
    
    // Look for likely confirm password field with higher score
    const rankedFields = confirmPasswordFields.map(field => {
      let score = 0;
      
      // Confirm password fields often have these characteristics
      if (field.name?.toLowerCase().includes('confirm')) score += 20;
      if (field.id?.toLowerCase().includes('confirm')) score += 20;
      if (field.placeholder?.toLowerCase().includes('confirm')) score += 20;
      if (field.name?.toLowerCase().includes('verify')) score += 15;
      if (field.id?.toLowerCase().includes('verify')) score += 15;
      if (field.placeholder?.toLowerCase().includes('verify')) score += 15;
      if (field.name?.toLowerCase().includes('again')) score += 10;
      if (field.id?.toLowerCase().includes('again')) score += 10;
      if (field.placeholder?.toLowerCase().includes('again')) score += 10;
      
      // Label check
      const labelElement = document.querySelector(`label[for="${field.id}"]`);
      if (labelElement) {
        const labelText = labelElement.textContent.toLowerCase();
        if (labelText.includes('confirm')) score += 20;
        if (labelText.includes('verify')) score += 15;
        if (labelText.includes('again')) score += 10;
      }
      
      return { field, score };
    }).sort((a, b) => b.score - a.score);
    
    if (rankedFields.length > 0 && rankedFields[0].score > 0) {
      // Fill the highest-scoring confirm password field
      const confirmField = rankedFields[0].field;
      confirmField.value = password;
      confirmField.dispatchEvent(new Event('input', { bubbles: true }));
      confirmField.dispatchEvent(new Event('change', { bubbles: true }));
      debugLog(`Filled confirm password field: ${confirmField.id || confirmField.name || 'unnamed'}`);
    }
    
  } catch (error) {
    debugError('Error filling confirm password field:', error);
  }
}

// Special debug function to detect and report all form fields
function debugDetectFields() {
  debugLog('Running debug field detection');
  
  try {
    // Find all password fields
    const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
    const passwordFieldsInfo = passwordFields.map(field => ({
      id: field.id,
      name: field.name,
      placeholder: field.placeholder,
      visible: field.offsetParent !== null,
      position: field.getBoundingClientRect(),
      hasListener: !!field.hasPasswordListener
    }));
    
    // Find all potential username fields
    const usernameSelectors = [
      'input[type="email"]',
      'input[type="text"][id*="user" i]',
      'input[type="text"][id*="email" i]',
      'input[type="text"][name*="user" i]',
      'input[type="text"][name*="email" i]',
      'input[type="text"][placeholder*="user" i]',
      'input[type="text"][placeholder*="email" i]',
      'input[type="text"]'
    ];
    
    const usernameFields = [];
    for (const selector of usernameSelectors) {
      const fields = Array.from(document.querySelectorAll(selector));
      fields.forEach(field => {
        if (field.offsetParent !== null && !field.disabled) {
          usernameFields.push({
            selector,
            id: field.id,
            name: field.name,
            placeholder: field.placeholder,
            position: field.getBoundingClientRect(),
            hasListener: !!field.hasUsernameListener
          });
        }
      });
    }
    // Find forms
    const forms = Array.from(document.querySelectorAll('form')).map(form => ({
      id: form.id,
      action: form.action,
      method: form.method,
      hasPasswordField: !!form.querySelector('input[type="password"]'),
      fieldCount: form.querySelectorAll('input').length
    }));
    
    // Current detected fields
    const currentFields = {
      username: detectedFields.username ? {
        id: detectedFields.username.id,
        name: detectedFields.username.name,
        type: detectedFields.username.type,
        visible: detectedFields.username.offsetParent !== null
      } : null,
      password: detectedFields.password ? {
        id: detectedFields.password.id,
        name: detectedFields.password.name,
        visible: detectedFields.password.offsetParent !== null
      } : null,
      form: detectedFields.form ? {
        id: detectedFields.form.id,
        action: detectedFields.form.action,
        method: detectedFields.form.method
      } : null
    };
    
    // Visual indicator of detected fields
    if (detectedFields.password) {
      highlightElement(detectedFields.password, 'password');
    }
    
    if (detectedFields.username) {
      highlightElement(detectedFields.username, 'username');
    }
    
    return {
      url: window.location.href,
      domain: detectedFields.domainName,
      currentDetectedFields: currentFields,
      allPasswordFields: passwordFieldsInfo,
      allUsernameFields: usernameFields,
      allForms: forms,
      detectionCount: initStatus.detectionCount,
      lastDetectionTime: initStatus.lastDetectionTime
    };
  } catch (error) {
    debugError('Error in debug field detection:', error);
    return {
      error: error.message,
      stack: error.stack
    };
  }
}

// Highlight an element for debugging
function highlightElement(element, type) {
  if (!DEBUG) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'krypkey-debug-highlight';
  
  const rect = element.getBoundingClientRect();
  const color = type === 'password' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 0, 0.2)';
  const borderColor = type === 'password' ? 'red' : 'green';
  
  overlay.style.cssText = `
    position: absolute;
    left: ${rect.left + window.scrollX}px;
    top: ${rect.top + window.scrollY}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background-color: ${color};
    border: 2px solid ${borderColor};
    z-index: 9999;
    pointer-events: none;
    border-radius: 3px;
  `;
  
  const label = document.createElement('div');
  label.style.cssText = `
    position: absolute;
    top: -22px;
    left: 0;
    background-color: ${borderColor};
    color: white;
    padding: 2px 6px;
    font-size: 10px;
    font-family: monospace;
    border-radius: 2px;
  `;
  label.textContent = `KrypKey ${type}`;
  
  overlay.appendChild(label);
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  }, 5000);
}

// Extract domain name from hostname
function extractDomainName(hostname) {
  try {
    // Remove subdomain and get the main domain
    const parts = hostname.split('.');
    return parts.length > 2 ? 
      `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : 
      hostname;
  } catch (error) {
    debugError('Error extracting domain name:', error);
    return hostname;
  }
}

// Detect password and username fields on the page
function detectFields() {
  try {
    initStatus.lastDetectionTime = Date.now();
    initStatus.detectionCount++;
    
    debugLog(`Running field detection #${initStatus.detectionCount}`);
    
    // Find password fields with enhanced detection
    const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
    const passwordLikeFields = Array.from(document.querySelectorAll(
      'input[name*="pass" i], input[id*="pass" i], input[aria-label*="password" i], ' +
      'input[placeholder*="password" i], input[autocomplete="current-password"]'
    )).filter(el => el.type !== 'password'); // Only get non-password inputs
    
    const allPossiblePasswordFields = [...passwordFields, ...passwordLikeFields];
    
    if (allPossiblePasswordFields.length === 0) {
      debugLog('No password fields found on page');
      return;
    }
    
    debugLog(`Found ${allPossiblePasswordFields.length} potential password fields`);
    
    // Add a score-based ranking system for password fields
    const rankedPasswordFields = allPossiblePasswordFields.map(field => {
      let score = 0;
      
      // Type is the strongest indicator
      if (field.type === 'password') score += 100;
      
      // Name/ID attributes
      if (field.name?.toLowerCase().includes('pass')) score += 20;
      if (field.id?.toLowerCase().includes('pass')) score += 20;
      
      // Autocomplete attribute
      if (field.getAttribute('autocomplete') === 'current-password') score += 30;
      if (field.getAttribute('autocomplete') === 'new-password') score += 30;
      
      // Aria attributes
      if (field.getAttribute('aria-label')?.toLowerCase().includes('password')) score += 15;

      // Placeholder text
      if (field.placeholder?.toLowerCase().includes('password')) score += 15;
      
      // Focus state
      if (document.activeElement === field) score += 50;
      
      return { field, score };
    }).sort((a, b) => b.score - a.score);
    
    if (rankedPasswordFields.length > 0) {
      detectedFields.password = rankedPasswordFields[0].field;
      debugLog('Selected password field:', 
        detectedFields.password.id || detectedFields.password.name || 'unnamed field',
        `(score: ${rankedPasswordFields[0].score})`);
        
      // Determine if this is a signup form (new-password) or login form (current-password)
      const autocomplete = detectedFields.password.getAttribute('autocomplete');
      detectedFields.isSignupForm = autocomplete === 'new-password' || 
                                   window.location.href.includes('signup') ||
                                   window.location.href.includes('register');
                                   
      debugLog(`Form type: ${detectedFields.isSignupForm ? 'SIGNUP' : 'LOGIN'}`);
    } else {
      return;
    }
    
    // Find the form containing the password field
    detectedFields.form = detectedFields.password.form || 
                          findParentElement(detectedFields.password, 'form');
    
    // Find potential username fields with improved heuristics
    const potentialContainer = detectedFields.form || findParentContainer(detectedFields.password);
    findUsernameField(potentialContainer);
    
    // Add event listeners and update UI
    setupFieldListeners();
    
    // Show AutoFill immediately if we're on a login form
    if (!detectedFields.isSignupForm) {
      // Short delay to ensure the page has fully loaded its own scripts
      setTimeout(() => {
        tryAutomaticFill();
      }, 800);
    } else {
      // For signup forms, offer password generation
      setupPasswordGenerationTrigger();
    }
    
    // Also monitor form submission for credential saving
    if (detectedFields.form) {
      setupFormSubmitListener();
    }
    
    // Display debug overlay with detection results
    const fieldsFound = [
      detectedFields.password ? 'Password ✓' : 'Password ✗',
      detectedFields.username ? 'Username ✓' : 'Username ✗',
      detectedFields.form ? 'Form ✓' : 'Form ✗',
      detectedFields.isSignupForm ? 'Signup Form' : 'Login Form'
    ].join(', ');
    
    showDebugOverlay(`Fields detected: ${fieldsFound}`);

  } catch (error) {
    debugError('Error detecting fields:', error);
    initStatus.errors.push('Field detection error: ' + error.message);
    showDebugOverlay('Field detection failed: ' + error.message, 'error');
  }
}

function setupFieldListeners() {
  if (detectedFields.password) {
    try {
      // Remove existing listeners first
      detectedFields.password.removeEventListener('focus', handlePasswordFieldFocus);
      detectedFields.password.removeEventListener('input', handlePasswordFieldInput);
      
      // Add new listeners
      detectedFields.password.addEventListener('focus', handlePasswordFieldFocus);
      detectedFields.password.addEventListener('input', handlePasswordFieldInput);
      
      // Also handle username field if found
      if (detectedFields.username) {
        detectedFields.username.removeEventListener('focus', handleUsernameFieldFocus);
        detectedFields.username.removeEventListener('input', handleUsernameFieldInput);
        
        detectedFields.username.addEventListener('focus', handleUsernameFieldFocus);
        detectedFields.username.addEventListener('input', handleUsernameFieldInput);
      }
      
      debugLog('Field listeners set up successfully');
    } catch (error) {
      debugError('Error setting up field listeners:', error);
      // Store the error in our tracking object
      initStatus.errors.push(`Field listener error: ${error.message}`);
    }
  }
}

// Find a potential username field
function findUsernameField(container) {
  // Potential username field types
  const usernameSelectors = [
    'input[type="email"]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][placeholder*="user" i]',
    'input[type="text"][placeholder*="email" i]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
    'input[type="text"]'
  ];
  
  // Collect all potential username fields
  const potentialUsernameFields = [];
  
  for (const selector of usernameSelectors) {
    try {
      const fields = Array.from(container.querySelectorAll(selector));
      // Only consider visible fields
      const visibleFields = fields.filter(field => 
        field.offsetParent !== null && 
        !field.disabled && 
        getComputedStyle(field).display !== 'none'
      );
      
      potentialUsernameFields.push(...visibleFields.map(field => ({
        field,
        selector
      })));
    } catch (error) {
      debugError(`Error finding username with selector ${selector}:`, error);
    }
  }

  if (potentialUsernameFields.length === 0) {
    debugLog('No matching username field found');
    return;
  }
  
  // Score each field based on likelihood of being a username field
  const rankedFields = potentialUsernameFields.map(({field, selector}) => {
    let score = 0;
    
    // Field is above password field (common pattern)
    if (detectedFields.password && 
        field.getBoundingClientRect().top < detectedFields.password.getBoundingClientRect().top) {
      score += 30;
    }
    
    // Same parent as password field
    if (detectedFields.password && 
        field.parentElement === detectedFields.password.parentElement) {
      score += 20;
    }
    
    // By field type
    if (field.type === 'email') score += 40;
    
    // By autocomplete attribute
    if (field.getAttribute('autocomplete') === 'username') score += 50;
    if (field.getAttribute('autocomplete') === 'email') score += 40;
    
    // By field name/id
    if (field.name?.toLowerCase().includes('email')) score += 35;
    if (field.id?.toLowerCase().includes('email')) score += 35;
    if (field.name?.toLowerCase().includes('user')) score += 30;
    if (field.id?.toLowerCase().includes('user')) score += 30;
    if (field.name?.toLowerCase().includes('login')) score += 25;
    if (field.id?.toLowerCase().includes('login')) score += 25;
    
    // By placeholder
    if (field.placeholder?.toLowerCase().includes('email')) score += 25;
    if (field.placeholder?.toLowerCase().includes('user')) score += 20;

    // By field label (if exists)
    const labelElement = document.querySelector(`label[for="${field.id}"]`);
    if (labelElement) {
      const labelText = labelElement.textContent.toLowerCase();
      if (labelText.includes('email')) score += 25;
      if (labelText.includes('user')) score += 20;
      if (labelText.includes('login')) score += 15;
    }
    
    // Prioritize fields that are already filled
    if (field.value) score += 10;
    
    // If field is currently focused
    if (document.activeElement === field) score += 40;
    
    return { field, score };
  }).sort((a, b) => b.score - a.score);
  
  if (rankedFields.length > 0) {
    detectedFields.username = rankedFields[0].field;
    debugLog(`Found username field with score ${rankedFields[0].score}`);
    return;
  }
  
  debugLog('No suitable username field found after scoring');
}

// Find a parent container for a field when no form is present
function findParentContainer(element) {
  try {
    // Look for common container elements
    const containerElements = ['div', 'section', 'main', 'article'];
    let container = element;
    
    // Go up to 5 levels up to find a suitable container
    for (let i = 0; i < 5; i++) {
      if (!container.parentElement) break;
      container = container.parentElement;
      
      if (containerElements.includes(container.tagName.toLowerCase())) {
        debugLog('Found parent container:', container.tagName.toLowerCase());
        return container;
      }
    }
    
    debugLog('No specific parent container found, using body');
    return document.body; // Fall back to body if no container found
  } catch (error) {
    debugError('Error finding parent container:', error);
    return document.body;
  }
}

// Find parent element with a specific tag
function findParentElement(element, tagName) {
  try {
    let parent = element.parentElement;
    
    while (parent) {
      if (parent.tagName.toLowerCase() === tagName.toLowerCase()) {
        return parent;
      }
      parent = parent.parentElement;
    }
    
    return null;
  } catch (error) {
    debugError(`Error finding parent ${tagName}:`, error);
    return null;
  }
}

// Handle focus on password field
function handlePasswordFieldFocus(event) {
  try {
    debugLog('Password field focused');
    showDebugOverlay('Password field focused - looking for saved passwords');
    
    // Check if we have the domain in our saved passwords
    queryPasswords({ type: 'domain' });
  } catch (error) {
    debugError('Error handling password focus:', error);
  }
}

// Handle input in password field
function handlePasswordFieldInput(event) {
  try {
    const field = event.target;
    const value = field.value;
    
    // If user is typing their password, hide suggestions
    if (value && suggestions.isShowing) {
      debugLog('User typing password, hiding suggestions');
      hideSuggestions();
    }
    
    // Only show suggestions if the field is empty or on backspace 
    if (!value || event.inputType === 'deleteContentBackward') {
      debugLog('Password field empty or backspace pressed, showing suggestions');
      queryPasswords({ type: 'domain' });
    }
  } catch (error) {
    debugError('Error handling password input:', error);
  }
}

// Handle focus on username field
function handleUsernameFieldFocus(event) {
  try {
    debugLog('Username field focused');
    showDebugOverlay('Username field focused - looking for saved passwords');
    
    queryPasswords({ type: 'domain' });
  } catch (error) {
    debugError('Error handling username focus:', error);
  }
}

// Handle input in username field
function handleUsernameFieldInput(event) {
  try {
    const field = event.target;
    const value = field.value;
    
    if (value) {
      // If user is typing, query for matching usernames
      debugLog(`User typing username: ${value}, finding matches`);
      queryPasswords({ type: 'username', query: value });
    } else {
      // If field is empty, show all suggestions for the domain
      debugLog('Username field cleared, showing all suggestions');
      queryPasswords({ type: 'domain' });
    }
  } catch (error) {
    debugError('Error handling username input:', error);
  }
}

// Query the extension for matching passwords
function queryPasswords(query) {
  try {
    debugLog('Querying passwords for domain:', detectedFields.domainName);
    
    // Wrap in a Promise to catch errors
    return new Promise((resolve, reject) => {
      // Check if extension context is still valid
      if (!chrome.runtime) {
        debugError('Chrome runtime not available, extension context may be invalid');
        reject(new Error('Extension context invalidated'));
        return;
      }
      
      // Create the request message
      const requestData = {
        type: 'queryPasswords',
        domain: detectedFields.domainName,
        query: query || { type: 'domain' }
      };
      
      // Send message with timeout and retry
      let hasResponded = false;
      
      const sendMessageWithTimeout = (attempt = 1) => {
        if (attempt > 3) {
          debugError('Max retries reached for password query');
          reject(new Error('Failed to query passwords after multiple attempts'));
          return;
        }
        
        // Set a timeout
        const timeoutId = setTimeout(() => {
          if (!hasResponded) {
            debugLog(`Password query timed out (attempt ${attempt}), retrying...`);
            hasResponded = true;
            sendMessageWithTimeout(attempt + 1);
          }
        }, 3000);
        
        // Send the actual message
        try {
          chrome.runtime.sendMessage(requestData, (response) => {
            clearTimeout(timeoutId);
            
            if (hasResponded) return; // Ignore late responses
            hasResponded = true;
            
            // Handle runtime errors
            if (chrome.runtime.lastError) {
              debugError('Error querying passwords:', chrome.runtime.lastError);
              
              // Special handling for disconnected port and invalidated context
              if (chrome.runtime.lastError.message.includes('port') || 
                  chrome.runtime.lastError.message.includes('invalidated')) {
                reject(new Error('Extension context invalidated'));
              } else {
                reject(chrome.runtime.lastError);
              }
              return;
            }
            
            // Handle valid response
            if (response && response.success) {
              debugLog(`Found ${response.matches ? response.matches.length : 0} passwords`);
              resolve(response.matches || []);
            } else {
              debugLog('No passwords found or error in query');
              resolve([]);
            }
          });
        } catch (error) {
          clearTimeout(timeoutId);
          debugError('Exception sending password query:', error);
          reject(error);
        }
      };
      
      // Start the first attempt
      sendMessageWithTimeout();
    });
  } catch (error) {
    debugError('Error in queryPasswords:', error);
    return Promise.resolve([]); // Return empty array on error
  }
}

function detectFormType() {
  try {
    // Start with neutral stance
    let isSignupForm = false;
    let score = 0;
    
    // 1. Check form attributes
    if (detectedFields.form) {
      const action = detectedFields.form.action?.toLowerCase() || '';
      const id = detectedFields.form.id?.toLowerCase() || '';
      const classNames = detectedFields.form.className?.toLowerCase() || '';
      
      // Check URL and form attributes for registration indicators
      const signupTerms = ['register', 'signup', 'sign-up', 'create', 'join', 'new'];
      
      for (const term of signupTerms) {
        if (action.includes(term)) score += 3;
        if (id.includes(term)) score += 3;
        if (classNames.includes(term)) score += 2;
      }
    }
    
    // 2. Check URL for registration indicators
    const url = window.location.href.toLowerCase();
    if (url.includes('register') || url.includes('signup') || url.includes('create-account')) score += 5;
    if (url.includes('join') || url.includes('new-user')) score += 3;
    
    // 3. Check if there are two password fields (password + confirm)
    const passwordFields = Array.from(document.querySelectorAll('input[type="password"]'));
    if (passwordFields.length >= 2) score += 4;
    
    // 4. Check for confirm password field
    const confirmPasswordField = Array.from(document.querySelectorAll('input[type="password"]')).find(field => {
      const id = field.id?.toLowerCase() || '';
      const name = field.name?.toLowerCase() || '';
      const placeholder = field.placeholder?.toLowerCase() || '';
      const ariaLabel = field.getAttribute('aria-label')?.toLowerCase() || '';
      
      return id.includes('confirm') || name.includes('confirm') || placeholder.includes('confirm') ||
             id.includes('verify') || name.includes('verify') || placeholder.includes('verify') ||
             id.includes('again') || name.includes('again') || placeholder.includes('again') ||
             ariaLabel.includes('confirm') || ariaLabel.includes('verify') || ariaLabel.includes('again');
    });
    
    if (confirmPasswordField) score += 5;
    
    // 5. Check for terms of service or agreement checkboxes
    const tosCheckbox = Array.from(document.querySelectorAll('input[type="checkbox"]')).find(checkbox => {
      const id = checkbox.id?.toLowerCase() || '';
      const name = checkbox.name?.toLowerCase() || '';
      const label = document.querySelector(`label[for="${checkbox.id}"]`)?.textContent?.toLowerCase() || '';
      
      return id.includes('terms') || name.includes('terms') || label.includes('terms') ||
             id.includes('agree') || name.includes('agree') || label.includes('agree') ||
             id.includes('consent') || name.includes('consent') || label.includes('consent');
    });
    
    if (tosCheckbox) score += 3;
    
    // 6. Check for login link (signup forms often have "already have an account?" links)
    const loginLink = Array.from(document.querySelectorAll('a')).find(link => {
      const text = link.textContent?.toLowerCase() || '';
      const href = link.href?.toLowerCase() || '';
      
      return (text.includes('login') || text.includes('sign in') || text.includes('already have')) && 
             (href.includes('login') || href.includes('signin'));
    });
    
    if (loginLink) score += 2;
    
    // 7. Check if password field has autocomplete="new-password" attribute
    if (detectedFields.password && detectedFields.password.getAttribute('autocomplete') === 'new-password') {
      score += 5;
    }
    
    // 8. Check for typical signup fields
    const nameField = Array.from(document.querySelectorAll('input[type="text"]')).find(field => {
      const id = field.id?.toLowerCase() || '';
      const name = field.name?.toLowerCase() || '';
      const placeholder = field.placeholder?.toLowerCase() || '';
      
      return id.includes('firstname') || name.includes('firstname') || placeholder.includes('first name') ||
             id.includes('fname') || name.includes('fname') ||
             id.includes('name') && !id.includes('user') && !id.includes('login');
    });
    
    if (nameField) score += 2;
    
    // Determine final form type: score of 3+ indicates signup form
    isSignupForm = score >= 3;
    
    detectedFields.isSignupForm = isSignupForm;
    detectedFields.score = score;
    
    debugLog(`Form type detection: ${isSignupForm ? 'SIGNUP' : 'LOGIN'} form (score: ${score})`);
    return isSignupForm;
  } catch (error) {
    debugError('Error detecting form type:', error);
    return false;
  }
}

let suggestionsState = {
  isShowing: false,
  lastShowTime: 0,
  minTimeBetweenShows: 1000, // 1 second minimum between shows
  container: null
};

// Show password suggestions
// Show password suggestions
function showSuggestions(matches) {
  try {
    // Prevent rapid re-showing
    const now = Date.now();
    if (suggestionsState.isShowing || 
        (now - suggestionsState.lastShowTime) < suggestionsState.minTimeBetweenShows) {
      debugLog('Skipping show suggestions: too soon or already showing');
      return;
    }

    debugLog('Showing suggestions for', matches.length, 'passwords');
    
    // Clean up any existing container first
    if (suggestionsState.container) {
      suggestionsState.container.remove();
      suggestionsState.container = null;
    }

    // Create new container
    const container = document.createElement('div');
    container.className = 'krypkey-suggestions';
    container.style.cssText = `
      position: absolute;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    // Create shadow DOM
    const shadow = container.attachShadow({ mode: 'closed' });

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .suggestions-popup {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        min-width: 280px;
        max-width: 320px;
        border: 1px solid #ddd;
        animation: slideIn 0.2s ease-out;
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .suggestions-header {
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
        color: #666;
        font-size: 13px;
      }

      .suggestion-item {
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
      }

      .suggestion-item:hover,
      .suggestion-item.selected {
        background: #f5f5f5;
      }

      .suggestion-icon {
        width: 24px;
        height: 24px;
        background: #4285F4;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .suggestion-content {
        flex: 1;
      }

      .suggestion-title {
        font-size: 13px;
        color: #333;
      }

      .suggestion-username {
        font-size: 12px;
        color: #666;
        margin-top: 2px;
      }
    `;

    // Create content
    const panel = document.createElement('div');
    panel.className = 'suggestions-popup';

    let html = `
      <div class="suggestions-header">
        Saved passwords for this site
      </div>
    `;

    matches.forEach((match, index) => {
      html += `
        <div class="suggestion-item" data-index="${index}">
          <div class="suggestion-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 4L4 8L12 12L20 8L12 4Z" fill="white"/>
              <path d="M4 12V16L12 20L20 16V12" stroke="white" stroke-width="2"/>
            </svg>
          </div>
          <div class="suggestion-content">
            <div class="suggestion-title">${match.title || 'Unnamed Account'}</div>
            <div class="suggestion-username">${match.username || 'No username'}</div>
          </div>
        </div>
      `;
    });

    panel.innerHTML = html;
    shadow.appendChild(style);
    shadow.appendChild(panel);

    // Add click handlers
    shadow.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', handleSuggestionClick);
    });

    // Add to DOM
    document.body.appendChild(container);
    suggestionsState.container = container;

    // Position the popup
    const targetField = detectedFields.username || detectedFields.password;
    const fieldRect = targetField.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    container.style.left = `${fieldRect.left + scrollX}px`;
    container.style.top = `${fieldRect.bottom + scrollY + 5}px`;

    // Update state
    suggestionsState.isShowing = true;
    suggestionsState.lastShowTime = now;

    // Add cleanup on page events
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleScroll);

  } catch (error) {
    debugError('Error showing suggestions:', error);
  }
}

function resetAllStates() {
  // Reset autofill state
  resetAutofillState();
  
  // Reset suggestions state
  suggestionsState = {
    isShowing: false,
    lastShowTime: 0,
    minTimeBetweenShows: 1000,
    container: null
  };

  // Reset other states
  suggestions = {
    isShowing: false,
    container: null,
    matches: [],
    selectedIndex: 0
  };
}

// Update hideSuggestions
function hideSuggestions() {
  try {
    if (suggestionsState.container) {
      suggestionsState.container.remove();
      suggestionsState.container = null;
    }
    suggestionsState.isShowing = false;
    
    // Remove event listeners
    document.removeEventListener('click', handleClickOutside); 
    window.removeEventListener('scroll', handleScroll);
  } catch (error) {
    debugError('Error hiding suggestions:', error);
  }
}

// Position the suggestions dropdown
function positionSuggestions() {
  try {
    if (!suggestions.container || !detectedFields.password) {
      debugError('Cannot position suggestions: container or password field is missing');
      return;
    }
    
    const fieldRect = detectedFields.password.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    // Position below the password field
    suggestions.container.style.left = `${fieldRect.left + scrollX}px`;
    suggestions.container.style.top = `${fieldRect.bottom + scrollY + 5}px`;
    
    // Adjust if it would go offscreen
    const containerRect = suggestions.container.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    if (containerRect.right > viewportWidth) {
      suggestions.container.style.left = `${viewportWidth - containerRect.width - 10 + scrollX}px`;
    }
    
    debugLog('Positioned suggestions dropdown');
  } catch (error) {
    debugError('Error positioning suggestions:', error);
  }
}

// Hide the suggestions dropdown
// function hideSuggestions() {
//   try {
//     if (suggestions.container) {
//       suggestions.container.remove();
//       suggestions.container = null;
//       debugLog('Suggestions hidden');
//     }
//     suggestions.isShowing = false;
//     suggestions.matches = [];
//   } catch (error) {
//     debugError('Error hiding suggestions:', error);
//   }
// }

// Update the selected suggestion item
function updateSelectedSuggestion(shadow) {
  try {
    const items = shadow.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      if (index === suggestions.selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  } catch (error) {
    debugError('Error updating selected suggestion:', error);
  }
}

// Handle keyboard navigation of suggestions
function handleKeyNavigation(e) {
  try {
    if (!suggestions.isShowing) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        suggestions.selectedIndex = Math.min(suggestions.selectedIndex + 1, suggestions.matches.length - 1);
        updateSelectedSuggestion();
        debugLog('Navigation: ArrowDown, index =', suggestions.selectedIndex);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        suggestions.selectedIndex = Math.max(suggestions.selectedIndex - 1, 0);
        updateSelectedSuggestion();
        debugLog('Navigation: ArrowUp, index =', suggestions.selectedIndex);
        break;
        
      case 'Enter':
        if (suggestions.isShowing) {
          e.preventDefault();
          debugLog('Navigation: Enter pressed, selecting suggestion');
          handleSuggestionSelect(suggestions.selectedIndex);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        debugLog('Navigation: Escape pressed, hiding suggestions');
        hideSuggestions();
        break;
    }
  } catch (error) {
    debugError('Error handling key navigation:', error);
  }
}

// Handle click on a suggestion
function handleSuggestionClick(e) {
  try {
    const index = parseInt(e.currentTarget.dataset.index);
    debugLog('Suggestion clicked, index =', index);
    handleSuggestionSelect(index);
  } catch (error) {
    debugError('Error handling suggestion click:', error);
  }
}

// Handle suggestion selection
function handleSuggestionSelect(index) {
  try {
    const selectedCredential = suggestions.matches[index];
    
    if (!selectedCredential) {
      debugError('No credential found at index', index);
      return;
    }
    
    debugLog('Selected credential:', selectedCredential.title);
    
    // Hide suggestions first
    hideSuggestions();
    
    // If already authenticated, fill immediately
    if (authState.authenticated) {
      fillFields(selectedCredential);
    } else {
      // Request authentication from background script
      chrome.runtime.sendMessage({
        type: 'requestAuth',
        credential: selectedCredential,
        domain: detectedFields.domainName,
        url: window.location.href
      }, (response) => {
        if (chrome.runtime.lastError) {
          debugError('Error requesting auth:', chrome.runtime.lastError);
          return;
        }
        
        if (response && response.received) {
          showDebugOverlay('Authentication request sent');
        }
      });
      
      // Also show authentication prompt in content script
      showAuthPrompt(selectedCredential);
    }
  } catch (error) {
    debugError('Error handling suggestion selection:', error);
    initStatus.errors.push('Selection error: ' + error.message);
  }
}

// Display authentication prompt
function showAuthPrompt(credential) {
  try {
    debugLog('Showing auth prompt for', credential.title);
    
    // Hide suggestions
    hideSuggestions();
    
    // Create auth prompt using shadow DOM for isolation
    const promptContainer = document.createElement('div');
    promptContainer.id = 'krypkey-auth-prompt';
    promptContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    // Create shadow DOM
    const shadow = promptContainer.attachShadow({ mode: 'closed' });
    
    // Add styles to shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      .auth-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease-out;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .auth-panel {
        background: white;
        border-radius: 8px;
        width: 360px;
        max-width: 90%;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        animation: scaleIn 0.2s ease-out;
      }
      
      @keyframes scaleIn {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      
      .auth-header {
        padding: 16px;
        background: #4285F4;
        color: white;
      }
      
      .auth-title {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
      }
      
      .auth-content {
        padding: 20px;
      }
      
      .auth-message {
        margin-top: 0;
        margin-bottom: 16px;
        color: #333;
      }
      
      .credential-card {
        padding: 14px;
        background: #f5f5f5;
        border-radius: 6px;
        margin-bottom: 20px;
      }
      
      .credential-title {
        font-weight: bold;
        margin-bottom: 4px;
      }
      
      .credential-username {
        color: #666;
        font-size: 14px;
      }
      
      .auth-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
      }
      
      .cancel-button {
        padding: 8px 16px;
        border: 1px solid #ddd;
        background: #f5f5f5;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        color: #333;
      }
      
      .cancel-button:hover {
        background: #eee;
      }
      
      .auth-button {
        padding: 8px 16px;
        background: #4285F4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .auth-button:hover {
        background: #3367d6;
      }
      
      .auth-button:disabled {
        background: #a4c2f4;
        cursor: not-allowed;
      }
    `;

    // Create content for shadow DOM
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    
    overlay.innerHTML = `
      <div class="auth-panel">
        <div class="auth-header">
          <h2 class="auth-title">Authenticate KrypKey</h2>
        </div>
        <div class="auth-content">
          <p class="auth-message">Authenticate to auto-fill your password for:</p>
          <div class="credential-card">
            <div class="credential-title">${credential.title || 'Unnamed Account'}</div>
            <div class="credential-username">${credential.username || ''}</div>
          </div>
          <div class="auth-footer">
            <button class="cancel-button">Cancel</button>
            <button class="auth-button">Authenticate</button>
          </div>
        </div>
      </div>
    `;
    
    shadow.appendChild(style);
    shadow.appendChild(overlay);
    
    document.body.appendChild(promptContainer);
    authState.promptVisible = true;
    
    // Add event listeners
    const cancelButton = shadow.querySelector('.cancel-button');
    cancelButton.addEventListener('click', () => {
      debugLog('Auth cancelled by user');
      promptContainer.remove();
      authState.promptVisible = false;
    });

    const authButton = shadow.querySelector('.auth-button');
    authButton.addEventListener('click', () => {
      // Request authentication from extension background script
      debugLog('Auth requested, sending message to background');
      
      chrome.runtime.sendMessage({
        type: 'requestAuth',
        credential: credential,
        domain: detectedFields.domainName,
        url: window.location.href
      }, response => {
        if (chrome.runtime.lastError) {
          debugError('Error requesting auth:', chrome.runtime.lastError);
          showDebugOverlay('Auth request failed: ' + chrome.runtime.lastError.message, 'error');
        } else {
          debugLog('Auth request response:', response);
        }
      });
      
      // Show loading state
      authButton.textContent = 'Authenticating...';
      authButton.disabled = true;
    });
  } catch (error) {
    debugError('Error showing auth prompt:', error);
    initStatus.errors.push('Auth prompt error: ' + error.message);
  }
}

// Fill form fields with credentials
function fillFields(credentials) {
  try {
    if (!detectedFields.password) {
      debugError('Cannot fill fields: password field is missing');
      return;
    }
    
    debugLog('Filling credentials for', credentials.title);
    
    // Fill password field
    const passwordSuccess = setFieldValue(detectedFields.password, credentials.password);
    
    // Fill username field if available
    let usernameSuccess = false;
    if (detectedFields.username && credentials.username) {
      usernameSuccess = setFieldValue(detectedFields.username, credentials.username);
    }
    
    // Notify that we filled the fields
    debugLog('Fields filled:', {
      password: passwordSuccess ? 'Success' : 'Failed',
      username: usernameSuccess ? 'Success' : 'Not filled/unavailable'
    });
    
    // Debug overlay
    showDebugOverlay(`Filled credentials for ${credentials.title}`, 'success');
    
    // Show success notification
    showNotification('Credentials filled successfully', 'success');
  } catch (error) {
    debugError('Error filling fields:', error);
    initStatus.errors.push('Fill fields error: ' + error.message);
    showNotification('Failed to fill credentials: ' + error.message, 'error');
  }
}

// Set value of a field with proper event dispatching
function setFieldValue(field, value) {
  try {
    if (!field || !value) {
      return false;
    }
    
    // Store original attributes
    const originalReadOnly = field.readOnly;
    const originalDisabled = field.disabled;
    
    // Make field editable if it's readonly or disabled
    if (originalReadOnly) {
      field.readOnly = false;
    }
    
    if (originalDisabled) {
      field.disabled = false;
    }
    
    // Focus the field first
    field.focus();
    
    // Set value directly
    field.value = value;
    
    // Trigger input event to notify the page
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Restore original attributes
    if (originalReadOnly) {
      field.readOnly = originalReadOnly;
    }
    
    if (originalDisabled) {
      field.disabled = originalDisabled;
    }
    
    // Log debug info about the fill
    debugLog(`Field filled: ${field.name || field.id || 'unnamed field'}`);
    
    return true;
  } catch (error) {
    debugError('Error setting field value:', error);
    return false;
  }
}

// Show notification
function showNotification(message, type = 'info') {
  try {
    debugLog('Showing notification:', message, type);
    
    const notif = document.createElement('div');
    notif.className = `krypkey-notification ${type}`;
    notif.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#4285F4'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      max-width: 300px;
      animation: krypkeySlideIn 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes krypkeySlideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes krypkeyFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    notif.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="font-size: 18px;">
          ${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ️'}
        </div>
        <div>${message}</div>
      </div>
    `;
    
    document.body.appendChild(notif);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notif.style.animation = 'krypkeyFadeOut 0.3s ease-out forwards';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  } catch (error) {
    debugError('Error showing notification:', error);
  }
}

// Initialize when the page is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  debugLog('Document ready, initializing immediately');
  init();
} else {
  debugLog('Document not ready, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', init);
}

// Add extra script injection to test if we're properly loaded
window.krypKeyContentScriptLoaded = true;
debugLog('Content script loaded and attached to window object');

// Add this at the end of your content.js file
function addDebugButton() {
  if (!DEBUG) return;
  
  const btn = document.createElement('div');
  btn.style.cssText = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: #3498db;
    color: white;
    padding: 5px 10px;
    border-radius: 5px;
    font-family: monospace;
    font-size: 12px;
    cursor: pointer;
    z-index: 999999;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  `;
  btn.textContent = '🔑 KrypKey Debug';
  
  btn.addEventListener('click', () => {
    const savedData = sessionStorage.getItem('krypkey_form_submission');
    let parsedData = null;
    
    try {
      if (savedData) {
        parsedData = JSON.parse(savedData);
      }
    } catch (e) {}
    
    console.log('KrypKey Status:', {
      fields: detectedFields,
      isSignupForm: !!detectedFields.isSignupForm,
      formSubmissionData: parsedData,
      errors: initStatus.errors
    });
    
    // Try to manually trigger the save flow
    if (parsedData && parsedData.username && parsedData.password) {
      chrome.runtime.sendMessage({
        type: 'forceSaveCredentials',
        credentials: {
          username: parsedData.username,
          password: parsedData.password,
          url: window.location.href,
          domain: extractDomainName(window.location.hostname)
        }
      });
      alert('Triggered credential save flow manually!');
    } else {
      alert('No stored credentials found. Try capturing a login first.');
    }
  });
  
  document.body.appendChild(btn);
}

// Add a special test function to debug credential saving
window.testCredentialSave = function() {
  // Get current fields
  const username = detectedFields.username?.value || prompt('Enter username/email for test:');
  const password = detectedFields.password?.value || prompt('Enter password for test:');
  
  if (!username || !password) {
    console.log('Cannot test without username and password');
    return;
  }
  
  const testCredentials = {
    username,
    password,
    url: window.location.href,
    domain: extractDomainName(window.location.hostname),
    wasSignupForm: true,
    isSignupForm: true
  };
  
  console.log('Testing with credentials:', testCredentials);
  
  // Store in session storage
  sessionStorage.setItem('krypkey_form_submission', JSON.stringify({
    timestamp: Date.now(),
    username,
    password,
    wasSignupForm: true,
    previousUrl: window.location.href
  }));
  
  // 1. Try direct save to server
  chrome.runtime.sendMessage({
    type: 'saveRegistrationCredentials',
    credentials: testCredentials
  }, response => {
    console.log('Save registration response:', response);
  });
  
  // 2. Show the save prompt
  showSaveCredentialsPrompt(testCredentials);
  
  // Also log success
  console.log('Credential save test initiated - check for prompt and server response');
};

// Add the debug button when initializing
setTimeout(() => {
  addDebugButton();
}, 1000); 

// Add explanation to console
console.log(
  '%c KrypKey Helper Functions: %c\n' +
  '- window.testCredentialSave() - Test credential saving\n' +
  '- Look for the blue debug button in the bottom-left corner',
  'background:#3498db;color:white;font-weight:bold;padding:3px 5px;border-radius:3px', 
  'color:#333;font-weight:normal'
);