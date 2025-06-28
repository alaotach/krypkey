let activeTabStates = {};

chrome.runtime.onInstalled.addListener(() => {
    console.log('KrypKey extension installed');
  });
  
  // Handle messages from content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'checkAuth') {
      chrome.storage.local.get('currentSession', (data) => {
        sendResponse({ isAuthenticated: !!data.currentSession });
      });
      return true;
    }
  });

/**
 * KrypKey Background Script
 * Manages communication between content scripts and popup
 */

// Debug configuration
const DEBUG = true;
const DEBUG_PREFIX = '🔑 KrypKey BG:';

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

// Track authentication state
let authState = {
  isAuthenticated: false,
  lastAuthTime: null,
  currentRequest: null
};

// Authentication timeout (10 minutes)
const AUTH_TIMEOUT_MS = 10 * 60 * 1000;

// Keep track of extension status
const extensionStatus = {
  initialized: Date.now(),
  messageCount: 0,
  errors: [],
  lastError: null,
  activeRequests: []
};

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  debugLog('Extension installed');
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    extensionStatus.messageCount++;
    debugLog('Received message:', message.type, 'from', sender.tab ? `tab ${sender.tab.id}` : 'popup');
    
    // Add to active requests
    const requestId = Date.now() + Math.random().toString(36).substring(2, 15);
    extensionStatus.activeRequests.push({
      id: requestId,
      type: message.type,
      timestamp: Date.now(),
      sender: sender.tab ? `Tab ${sender.tab.id}` : 'Popup'
    });
    
    // Clean up old requests (keep only last 50)
    if (extensionStatus.activeRequests.length > 50) {
      extensionStatus.activeRequests = extensionStatus.activeRequests.slice(-50);
    }
    
    switch (message.type) {
      // Authentication check
      case 'checkAuth':
        // Check if authenticated and not expired
        const isAuthenticated = authState.isAuthenticated && 
                               (Date.now() - authState.lastAuthTime < AUTH_TIMEOUT_MS);
        
        if (!isAuthenticated && authState.isAuthenticated) {
          // Reset if expired
          debugLog('Auth state expired, resetting');
          authState.isAuthenticated = false;
        }
        
        debugLog('Auth check:', isAuthenticated ? 'Authenticated' : 'Not authenticated');
        sendResponse({ isAuthenticated: authState.isAuthenticated });
        break;
        
      // Set authentication state
      case 'setAuth':
        debugLog('Setting auth state to:', message.isAuthenticated);
        authState.isAuthenticated = message.isAuthenticated;
        if (authState.isAuthenticated) {
          authState.lastAuthTime = Date.now();
        }
        
        // If we have a pending auth request, notify the content script
        if (authState.currentRequest && authState.isAuthenticated) {
          debugLog('Notifying content script of successful auth for pending request');
          notifyContentScriptOfAuth(authState.currentRequest, message.credentials);
          authState.currentRequest = null;
        }
        
        sendResponse({ success: true });
        break;
        
      // Query for passwords
      case 'queryPasswords':
        // Forward to popup or handle here if we have stored credentials
        chrome.storage.local.get('currentSession', async (data) => {
          try {
            if (data.currentSession && data.currentSession.unlocked) {
              // If extension is unlocked, query for matching passwords
              debugLog('Extension unlocked, querying passwords for domain:', message.domain);
              
              try {
                const matches = await queryPasswordsFromStorage(message.domain, message.query);
                debugLog(`Found ${matches.length} matches for ${message.domain}`);
                sendResponse({ success: true, matches });
              } catch (error) {
                debugError('Error querying passwords:', error);
                sendResponse({ success: false, error: error.message });
              }
            } else {
              debugLog('Extension not unlocked, cannot query passwords');
              sendResponse({ success: false, error: 'Extension not unlocked' });
            }
          } catch (error) {
            debugError('Error processing query:', error);
            sendResponse({ success: false, error: error.message });
          }
        });
        return true; // Keep the message channel open for async response
        
      // Request authentication
      case 'requestAuth':
        debugLog('Auth requested for credential:', message.credential?.title, 'domain:', message.domain);
        
        // Store the request
        authState.currentRequest = {
          tabId: sender.tab.id,
          credential: message.credential,
          domain: message.domain,
          url: message.url
        };
        
        // Open the popup for authentication
        openPopupForAuth();
        sendResponse({ received: true });
        break;
        
      // Authentication result from popup
      case 'authResult':
        debugLog('Received auth result:', message.success ? 'SUCCESS' : 'FAILED');
        
        if (authState.currentRequest) {
          notifyContentScriptOfAuth(authState.currentRequest, message.credentials);
          authState.currentRequest = null;
        } else {
          debugError('No pending auth request to fulfill');
        }
        
        sendResponse({ success: true });
        break;
        
      // Debug: Check content script status
      case 'debugContentScript':
        debugLog('Debug request for tab:', message.tabId);
        
        if (message.tabId) {
          chrome.tabs.sendMessage(message.tabId, { type: 'checkStatus' }, (response) => {
            const error = chrome.runtime.lastError; 
            if (error) {
              debugError('Error checking content script status:', error);
              sendResponse({ success: false, error: error.message });
            } else {
              debugLog('Content script status received');
              sendResponse({ success: true, status: response });
            }
          });
          return true; // Keep message channel open
        } else {
          sendResponse({ success: false, error: 'No tab ID provided' });
        }
        break;
        
      // Debug: Get background status
      case 'debugBackgroundStatus':
        sendResponse({
          success: true,
          status: {
            authState: {
              isAuthenticated: authState.isAuthenticated,
              lastAuthTime: authState.lastAuthTime,
              hasCurrentRequest: !!authState.currentRequest
            },
            extensionStatus: {
              ...extensionStatus,
              uptime: Date.now() - extensionStatus.initialized
            }
          }
        });
        break;
        
      // Debug: Force test suggestions in content script
      case 'debugShowTestSuggestions':
        if (message.tabId) {
          chrome.tabs.sendMessage(message.tabId, { 
            type: 'showTestSuggestions',
            suggestions: message.suggestions || [
              { 
                id: 'test1', 
                title: 'Test Account', 
                username: 'test@example.com',
                password: 'TestPassword123'
              }
            ]
          }, (response) => {
            const error = chrome.runtime.lastError;
            if (error) {
              debugError('Error showing test suggestions:', error);
              sendResponse({ success: false, error: error.message });
            } else {
              sendResponse({ success: true, response });
            }
          });
          return true; // Keep message channel open
        } else {
          sendResponse({ success: false, error: 'No tab ID provided' });
        }
        break;
    }
  } catch (error) {
    debugError('Error processing message:', error);
    extensionStatus.errors.push({ time: Date.now(), error: error.message });
    extensionStatus.lastError = { time: Date.now(), error: error.message, stack: error.stack };
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for async responses
});

// Open popup for authentication
function openPopupForAuth() {
  try {
    debugLog('Opening popup for authentication');
    
    chrome.windows.create({
      url: chrome.runtime.getURL('popup/popup.html?authRequest=true'),
      type: 'popup',
      width: 400,
      height: 600
    }, (window) => {
      if (chrome.runtime.lastError) {
        debugError('Error opening popup:', chrome.runtime.lastError);
      } else {
        debugLog('Opened auth popup with window ID:', window.id);
      }
    });
  } catch (error) {
    debugError('Error opening popup for auth:', error);
    extensionStatus.errors.push({ time: Date.now(), error: error.message });
  }
}

// Notify content script of authentication result
function notifyContentScriptOfAuth(request, credentials) {
  try {
    debugLog('Notifying content script of auth result, tab:', request.tabId);
    
    chrome.tabs.sendMessage(request.tabId, {
      type: 'authResult',
      success: true,
      credentials: request.credential || credentials
    }, (response) => {
      if (chrome.runtime.lastError) {
        debugError('Error notifying content script:', chrome.runtime.lastError);
      } else {
        debugLog('Content script notified successfully');
      }
    });
  } catch (error) {
    debugError('Error notifying content script:', error);
    extensionStatus.errors.push({ time: Date.now(), error: error.message });
  }
}

function normalizeDomain(url) {
  return url.replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase()
    .trim();
}

function domainToTitle(domain) {
  if (!domain) return '';
  
  // Remove TLD
  const parts = domain.split('.');
  if (parts.length >= 2) {
    const mainPart = parts[parts.length - 2];
    // Capitalize first letter
    return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
  }
  
  return domain;
}

// Check if domains match using more sophisticated rules
function domainMatches(pwdDomain, currentDomain) {
  if (!pwdDomain || !currentDomain) return false;
  
  // Exact match
  if (pwdDomain === currentDomain) return true;
  
  // Subdomain match
  if (currentDomain.endsWith('.' + pwdDomain)) return true;
  if (pwdDomain.endsWith('.' + currentDomain)) return true;
  
  // Match without TLD
  const pwdMain = pwdDomain.split('.').slice(0, -1).join('.');
  const currentMain = currentDomain.split('.').slice(0, -1).join('.');
  
  if (pwdMain && currentMain && (pwdMain === currentMain)) return true;
  
  // Partial match for domains with dashes or complex names
  if (pwdMain && currentMain && (pwdMain.includes(currentMain) || currentMain.includes(pwdMain))) {
    // Only match if the shared part is substantial (at least 5 chars)
    if (pwdMain.length >= 5 && currentMain.length >= 5) return true;
  }
  
  return false;
}

// Check if username matches using fuzzy logic
function usernameMatches(passwordData, query) {
  const username = (passwordData.username || passwordData.loginUsername || '').toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Direct contains match
  if (username.includes(queryLower)) return true;
  
  // Email username part match (before @)
  if (username.includes('@') && queryLower.includes('@')) {
    const userPart = username.split('@')[0];
    const queryPart = queryLower.split('@')[0];
    if (userPart.includes(queryPart) || queryPart.includes(userPart)) return true;
  }
  
  // Handle common username variations
  if (username.replace(/[^a-z0-9]/g, '').includes(queryLower.replace(/[^a-z0-9]/g, ''))) return true;
  
  return false;
}

function sortPasswordMatches(matches, domain, query) {
  return matches.sort((a, b) => {
    // Calculate match scores
    const scoreA = calculateMatchScore(a, domain, query);
    const scoreB = calculateMatchScore(b, domain, query);
    
    // Sort by score (higher first)
    if (scoreA !== scoreB) return scoreB - scoreA;
    
    // If scores are equal, sort by last used date
    if (a.lastUsed && b.lastUsed) {
      return new Date(b.lastUsed) - new Date(a.lastUsed);
    }
    
    // If no lastUsed, prefer the one that has it
    if (a.lastUsed) return -1;
    if (b.lastUsed) return 1;
    
    return 0;
  });
}

// Calculate a relevance score for a password match
function calculateMatchScore(match, domain, query) {
  let score = 0;
  
  // Exact domain match is strongest signal
  if (normalizeDomain(match.website) === normalizeDomain(domain)) {
    score += 100;
  }
  
  // Last used recently gets a boost
  if (match.lastUsed) {
    const daysSinceLastUse = (Date.now() - new Date(match.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastUse < 1) score += 50;      // Used today
    else if (daysSinceLastUse < 7) score += 30; // Used this week
    else if (daysSinceLastUse < 30) score += 10; // Used this month
  }
  
  // Username query match gives a bigger boost the more specific the match is
  if (query.type === 'username' && query.query) {
    const username = (match.username || '').toLowerCase();
    const queryLower = query.query.toLowerCase();
    
    if (username === queryLower) score += 80; // Exact match
    else if (username.startsWith(queryLower)) score += 60; // Prefix match
    else if (username.includes(queryLower)) score += 40; // Contains match
  }
  
  return score;
}

// Query passwords from storage - use test data for now
// Add this near the queryPasswordsFromStorage function
function retrieveStoredPasswords() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['currentSession', 'encryptedPasswords', 'pendingPasswords'], (data) => {
      try {
        const results = {
          passwords: [],
          pendingPasswords: []
        };

        // Process encrypted passwords if available
        if (data.currentSession?.token && data.encryptedPasswords?.length > 0) {
          results.passwords = data.encryptedPasswords
            .map(encryptedPwd => {
              try {
                const decryptedData = decryptWithToken(encryptedPwd.encrypted, data.currentSession.token);
                const passwordData = JSON.parse(decryptedData);
                
                // Add existing ID or generate new one
                passwordData.id = encryptedPwd.id || generateId();
                return passwordData;
              } catch (err) {
                debugError('Failed to decrypt password:', err);
                return null;
              }
            })
            .filter(item => item !== null);
        }

        // Process pending passwords if available
        if (data.pendingPasswords?.length > 0) {
          results.pendingPasswords = data.pendingPasswords.map(pendingPwd => {
            // Ensure ID is present
            if (!pendingPwd.id) {
              pendingPwd.id = generateId();
            }
            return pendingPwd;
          });
        }

        resolve(results);
      } catch (error) {
        reject(error);
      }
    });
  });
}

// Inside the queryPasswordsFromStorage function, replace the test data section with:

function queryPasswordsFromStorage(domain, query) {
  return new Promise((resolve, reject) => {
    try {
      debugLog('Querying passwords for domain:', domain);
      
      retrieveStoredPasswords()
        .then(({passwords, pendingPasswords}) => {
          let matches = [];
          
          // Process encrypted passwords
          matches = passwords
            .filter(passwordData => {
              try {
                // Normalize domains for better matching
                const pwdDomain = normalizeDomain(passwordData.website || '');
                const currentDomain = normalizeDomain(domain);
                
                // Enhanced domain matching logic
                const domainMatch = domainMatches(pwdDomain, currentDomain);
                
                // Better username matching if query provided
                const usernameMatch = 
                  query.type !== 'username' || 
                  !query.query || 
                  usernameMatches(passwordData, query.query);
                
                return domainMatch && usernameMatch;
              } catch (error) {
                debugError('Error matching password:', error);
                return false;
              }
            })
            .map(passwordData => ({
              id: passwordData.id || generateId(),
              title: passwordData.title || domainToTitle(passwordData.website || domain) || 'Unknown Site',
              username: passwordData.username || passwordData.loginUsername || '',
              password: passwordData.password || '',
              website: passwordData.website || '',
              category: passwordData.category || 'login',
              lastUsed: passwordData.lastUsed || null,
              createdAt: passwordData.createdAt || null
            }));
            
          // Also include pending passwords that match domain
          if (pendingPasswords.length > 0) {
            // Process pending passwords code...
          }

          // If no real matches found, add test data (but ONLY in debug mode)
          if (matches.length === 0 && domain && DEBUG) {
            debugLog('No matches found in storage, using test data');
            matches = [
              {
                id: 'test1',
                title: domainToTitle(domain),
                username: 'user@example.com',
                password: 'Password123!',
                website: `https://${domain}`,
                category: 'login',
                lastUsed: new Date().toISOString(),
                isTestData: true // Mark as test data
              },
              {
                id: 'test2',
                title: `${domainToTitle(domain)} (Work)`,
                username: 'work@company.com',
                password: 'WorkPassword456!',
                website: `https://${domain}`,
                category: 'login',
                lastUsed: new Date().toISOString(),
                isTestData: true // Mark as test data
              }
            ];
          }
          
          // Sort matches by relevance
          matches = sortPasswordMatches(matches, domain, query);
          
          resolve(matches);
        })
        .catch(error => {
          debugError('Error retrieving stored passwords:', error);
          resolve([]);
        });
    } catch (error) {
      debugError('Error in queryPasswordsFromStorage:', error);
      reject(error);
    }
  });
}




// Replace the decryptWithToken function with this implementation:

function decryptWithToken(encryptedData, token) {
  try {
    // If string is already JSON, return it (wasn't encrypted)
    if (typeof encryptedData === 'string' && 
        (encryptedData.startsWith('{') || encryptedData.startsWith('['))) {
      try {
        // Validate it's proper JSON
        JSON.parse(encryptedData);
        return encryptedData;
      } catch (e) {
        // Not valid JSON, continue to decryption
      }
    }
    
    // Handle XOR encryption (comma-separated values)
    if (typeof encryptedData === 'string' && encryptedData.includes(',')) {
      debugLog('Decrypting XOR data');
      
      const dataArray = encryptedData.split(',').map(Number);
      const keyData = Array.from(new TextEncoder().encode(token));
      const decrypted = new Uint8Array(dataArray.length);
      
      for (let i = 0; i < dataArray.length; i++) {
        decrypted[i] = dataArray[i] ^ keyData[i % keyData.length];
      }
      
      const result = new TextDecoder().decode(decrypted);
      return result;
    }
    
    // For any other encryption format or plaintext, return as is
    return encryptedData;
  } catch (error) {
    debugError('Decryption error:', error);
    return encryptedData; // Return original on error
  }
}

// Generate a random ID for passwords
function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Add tab created/updated listeners to ensure content script is loaded
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && 
    (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
   
   debugLog('Tab updated, checking content script:', tabId);
   
   // Check if content script is loaded
   chrome.tabs.sendMessage(tabId, { type: 'checkStatus' }, (response) => {
     if (chrome.runtime.lastError) {
       debugLog('Content script not loaded, injecting:', tabId);
       
       // Script not loaded, inject it
       chrome.scripting.executeScript({
         target: { tabId },
         files: ['content/content.js']
       }).then(() => {
         debugLog('Content script injected successfully:', tabId);
         
         // Initialize content script explicitly with init call
         chrome.scripting.executeScript({
           target: { tabId },
           func: () => {
             // This will run in the page context
             if (typeof init === 'function') {
               debugLog('Explicitly calling init() function');
               init();
             } else {
               console.error('KrypKey init function not found!');
             }
           }
         }).catch(err => {
           debugError('Failed to call init function:', err);
         });
         
         // Also send explicit detection command with retry
         setTimeout(() => {
           chrome.tabs.sendMessage(tabId, { 
             type: 'retryDetection',
             forceInitialize: true 
           });
         }, 1000);
       }).catch(err => {
         debugError('Failed to inject content script:', err);
       });
     } else {
       debugLog('Content script already loaded, sending detection command:', tabId);
       // Still send detection command to ensure fields are detected
       chrome.tabs.sendMessage(tabId, { type: 'retryDetection' });
     }
   });
 }
});

function encryptWithToken(data, token) {
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
    debugError('Encryption error:', error);
    return null;
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Track tab state changes
  if (changeInfo.status === 'loading') {
    // Save the previous URL to detect cross-domain navigations
    const prevState = activeTabStates[tabId] || {};
    activeTabStates[tabId] = {
      ...prevState,
      previousUrl: prevState.currentUrl,
      currentUrl: tab.url,
      loadingStartTime: Date.now()
    };
    
    // If we detected a form submission and now we're navigating, this could be a login/signup
    if (prevState.formSubmitted && 
        Date.now() - prevState.formSubmitTime < 5000) {
      activeTabStates[tabId].possibleSuccessfulLogin = true;
      
      // If it was a signup form, alert the content script to check for credentials to save
      if (prevState.isSignupForm) {
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, {
            type: 'checkForCredentialsToSave',
            previousFormData: prevState.submittedData
          }).catch(() => {
            // Ignore errors - content script might not be loaded yet
          });
        }, 1500);
      }
    }
  }

  if (changeInfo.status === 'complete' && tab.url && 
    (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
   
   debugLog('Tab updated, checking content script:', tabId);
   
   // Check if content script is loaded
   chrome.tabs.sendMessage(tabId, { type: 'checkStatus' }, (response) => {
     if (chrome.runtime.lastError) {
       debugLog('Content script not loaded, injecting:', tabId);
       
       // Script not loaded, inject it
       chrome.scripting.executeScript({
         target: { tabId },
         files: ['content/content.js']
       }).then(() => {
         debugLog('Content script injected successfully:', tabId);
         
         // Fix: Don't try to execute init directly, just send a message
         setTimeout(() => {
           chrome.tabs.sendMessage(tabId, { 
             type: 'retryDetection',
             forceInitialize: true 
           }).catch(err => {
             // Ignore errors as the content script might still be initializing
             debugLog('Sending initial detection message');
           });
         }, 500);
       }).catch(err => {
         debugError('Failed to inject content script:', err);
       });
     } else {
       debugLog('Content script already loaded, sending detection command:', tabId);
       // Still send detection command to ensure fields are detected
       chrome.tabs.sendMessage(tabId, { type: 'retryDetection' });
     }
   });
 }
});

// Add this after the current chrome.tabs.onUpdated listener
// Listen specifically for tab navigation events after registration
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run this for tabs we're monitoring for registration
  if (activeTabStates[tabId] && 
      activeTabStates[tabId].registrationFormSubmitted &&
      changeInfo.status === 'complete') {
      
    debugLog('Post-registration navigation detected in tab:', tabId);
    
    // Wait for content script to initialize on the new page
    setTimeout(() => {
      // Check if we have credentials to save from the registration form
      if (activeTabStates[tabId].credentials || activeTabStates[tabId].hasCredentials) {
        // Send a direct message to show the save prompt
        chrome.tabs.sendMessage(tabId, {
          type: 'showSavePromptAfterRegistration',
          credentials: activeTabStates[tabId].credentials,
          previousFormData: activeTabStates[tabId].submittedData
        }).catch(err => {
          debugLog('Failed to send save prompt message, will retry');
          
          // Try again after another delay
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, {
              type: 'showSavePromptAfterRegistration',
              credentials: activeTabStates[tabId].credentials,
              previousFormData: activeTabStates[tabId].submittedData
            }).catch(() => {
              debugLog('Final attempt to show save prompt failed');
            });
          }, 1500);
        });
      }
    }, 1000);
    
    // Clear registration flag after processing once
    activeTabStates[tabId].registrationFormSubmitted = false;
  }
});

// Clean up tab state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeTabStates[tabId]) {
    delete activeTabStates[tabId];
  }
});

function saveCredentialsToStorage(credentials) {
  if (!credentials || !credentials.password) {
    debugError('Invalid credentials to save');
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['currentSession', 'encryptedPasswords'], (data) => {
      try {
        debugLog('Starting credential save process', credentials.domain || extractDomainFromUrl(credentials.url));
        
        // Allow saving without session for now (store locally)
        if (!data.currentSession?.token) {
          debugLog('No active session, saving credentials locally only');
          
          // Create full credential object
          const fullCredential = {
            title: credentials.domain || extractDomainFromUrl(credentials.url),
            username: credentials.username || '',
            password: credentials.password,
            website: credentials.url,
            category: 'login',
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString()
          };
          
          // Create a local storage entry
          const pendingPasswords = data.pendingPasswords || [];
          pendingPasswords.push({
            id: generateId(),
            credential: fullCredential,
            createdAt: new Date().toISOString(),
            synced: false
          });
          
          // Save the pending passwords to local storage
          chrome.storage.local.set({ pendingPasswords }, () => {
            if (chrome.runtime.lastError) {
              debugError('Error saving pending password:', chrome.runtime.lastError);
              resolve(false);
            } else {
              debugLog('Pending password saved locally successfully');
              resolve(true);
            }
          });
          return;
        }
        
        // Normal flow with active session
        const token = data.currentSession.token;
        
        // Create proper credential object
        const fullCredential = {
          title: credentials.domain || extractDomainFromUrl(credentials.url),
          username: credentials.username,
          password: credentials.password,
          website: credentials.url,
          category: 'login',
          createdAt: new Date().toISOString(),
          lastUsed: new Date().toISOString()
        };
        
        // Create a token-based encryption
        const encryptedData = encryptWithToken(JSON.stringify(fullCredential), token);
        
        if (!encryptedData) {
          debugError('Failed to encrypt credentials');
          resolve(false);
          return;
        }
        
        // Create unique ID
        const id = generateId();
        
        // Create new encrypted password entry
        const newPasswordEntry = {
          id,
          encrypted: encryptedData,
          domain: normalizeDomain(credentials.url || ''),
          createdAt: new Date().toISOString()
        };
        
        // Add to existing passwords or create new array
        const encryptedPasswords = data.encryptedPasswords || [];
        encryptedPasswords.push(newPasswordEntry);
        
        // Save back to storage
        chrome.storage.local.set({ encryptedPasswords }, () => {
          if (chrome.runtime.lastError) {
            debugError('Error saving encrypted password:', chrome.runtime.lastError);
            resolve(false);
          } else {
            debugLog('Credential saved successfully to local storage');
            
            // Also add this to the server if we have a valid session
            if (data.currentSession?.sessionId) {
              // Send to server API
              fetch('http://192.168.12.248:5000/api/sessions/pending-password', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.currentSession.token}`
                },
                body: JSON.stringify({
                  sessionId: data.currentSession.sessionId,
                  title: fullCredential.title,
                  password: JSON.stringify(fullCredential),
                  category: 'login'
                })
              })
              .then(response => {
                if (!response.ok) {
                  throw new Error('Server rejected the password save');
                }
                debugLog('Password saved to server successfully');
              })
              .catch(err => {
                debugError('Error saving password to server:', err);
                // Still consider this a success since we saved locally
              });
            }
            
            resolve(true);
          }
        });
      } catch (error) {
        debugError('Error saving credentials:', error);
        resolve(false);
      }
    });
  });
}

function extractDomainFromUrl(url) {
  try {
    if (!url) return '';
    const domain = url.replace(/^https?:\/\//, '').split('/')[0];
    return domain;
  } catch (error) {
    debugError('Error extracting domain from URL:', error);
    return '';
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    extensionStatus.messageCount++;
    debugLog('Received message:', message.type, 'from', sender.tab ? `tab ${sender.tab.id}` : 'popup');

    // Fix the form submission handler in the background script
    if (message.type === 'formSubmitted') {
      const tabId = sender.tab.id;
      
      if (!activeTabStates[tabId]) {
        activeTabStates[tabId] = {};
      }
      
      activeTabStates[tabId].formSubmitted = true;
      activeTabStates[tabId].formSubmitTime = Date.now();
      activeTabStates[tabId].submittedData = message.formData;
      
      // Important: Store credentials explicitly
      if (message.credentials) {
        activeTabStates[tabId].credentials = message.credentials;
        activeTabStates[tabId].hasCredentials = true;
        debugLog('Stored credentials for tab:', tabId);
      } else {
        activeTabStates[tabId].hasCredentials = message.hasCredentials === true;
      }
      
      debugLog('Form submitted in tab', tabId, message.formData);
      
      // If this is a signup form, save this information
      if (message.formData.isSignupForm) {
        activeTabStates[tabId].isSignupForm = true;
        
        // Set a flag to monitor this tab more closely
        activeTabStates[tabId].monitorForCredentialSave = true;
        
        // Important: Set stronger monitoring for registration forms
        activeTabStates[tabId].registrationFormSubmitted = true;
        activeTabStates[tabId].registrationTime = Date.now();
        
        // Show visual feedback for debugging
        chrome.tabs.sendMessage(tabId, {
          type: 'showDebugMessage',
          message: 'Registration detected! Monitoring for page change...'
        }).catch(() => {/* Ignore errors */});
        
        // Set multiple timers at different intervals to check if we should prompt for credential save
        if (activeTabStates[tabId].hasCredentials) {
          // Try multiple times in case the first attempts fail
      [1000, 2000, 3500, 5000].forEach(delay => {
        setTimeout(() => {
          // Check if tab still exists
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              // Tab no longer exists
              return;
            }
            
            // Send a notification to content script to check for credentials
            chrome.tabs.sendMessage(tabId, {
              type: 'checkForCredentialsToSave',
              previousFormData: activeTabStates[tabId].submittedData,
              credentials: activeTabStates[tabId].credentials 
            }).catch(err => {
              debugLog('Tab not ready for credential save check, will retry later');
            });
          });
        }, delay);
      });
    }
  }
  
  sendResponse({ success: true });
  return true;
}

    if (message.type === 'saveRegistrationCredentials') {
      const credentials = message.credentials;
      
      if (!credentials || !credentials.password) {
        sendResponse({ success: false, error: 'No valid credentials to save' });
        return true;
      }
      
      debugLog('Saving registration credentials:', credentials.domain);
      
      // Store in tab state for later use
      if (sender.tab && sender.tab.id) {
        const tabId = sender.tab.id;
        
        if (!activeTabStates[tabId]) {
          activeTabStates[tabId] = {};
        }
        
        activeTabStates[tabId].registrationCredentials = credentials;
        activeTabStates[tabId].registrationTime = Date.now();
        activeTabStates[tabId].registrationFormSubmitted = true;
        
        debugLog('Stored registration credentials in tab state:', tabId);
      }
      
      // Also save to storage for potential server sync
      saveCredentialsToStorage(credentials);
      
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'forceSaveCredentials') {
      const credentials = message.credentials;
      
      if (!credentials || !credentials.password) {
        sendResponse({ success: false, error: 'No valid credentials to force save' });
        return true;
      }
      
      debugLog('Force saving credentials for:', credentials.domain || extractDomainFromUrl(credentials.url));
      
      // First save to local storage and possibly server
      saveCredentialsToStorage(credentials)
        .then(success => {
          if (success) {
            debugLog('Credentials force-saved successfully');
            
            // Also show UI prompt if from a tab
            if (sender.tab && sender.tab.id) {
              const tabId = sender.tab.id;
              
              setTimeout(() => {
                chrome.tabs.sendMessage(tabId, {
                  type: 'showSavePromptAfterRegistration',
                  credentials: credentials
                }).catch(err => {
                  debugLog('Tab script not ready for credential prompt');
                });
              }, 1000);
            }
          } else {
            debugError('Failed to force save credentials');
          }
          
          sendResponse({ success });
        })
        .catch(err => {
          debugError('Error in force save:', err);
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep message channel open
    }

    if (message.type === 'addToNeverSaveList') {
      const domain = message.domain;
      
      debugLog('Adding domain to never save list:', domain);
      
      chrome.storage.local.get('neverSaveDomains', (data) => {
        const neverSaveDomains = data.neverSaveDomains || [];
        
        if (!neverSaveDomains.includes(domain)) {
          neverSaveDomains.push(domain);
          chrome.storage.local.set({ neverSaveDomains }, () => {
            if (chrome.runtime.lastError) {
              debugError('Error updating never save list:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              debugLog('Domain added to never save list');
              sendResponse({ success: true });
            }
          });
        } else {
          // Domain already in the list
          sendResponse({ success: true, alreadyExists: true });
        }
      });
      return true; // Keep message channel open
    }

    if (message.type === 'checkExistingCredentials') {
      const credentials = message.credentials;
      
      if (!credentials || !credentials.username || !credentials.password) {
        sendResponse({ exists: false });
        return true;
      }
      
      retrieveStoredPasswords()
        .then(({passwords, pendingPasswords}) => {
          // Check existing passwords
          const existsInPasswords = passwords.some(pwd => 
            (pwd.username === credentials.username || pwd.loginUsername === credentials.username) && 
            pwd.password === credentials.password
          );
          
          // Check pending passwords
          const existsInPending = pendingPasswords.some(pending => 
            pending.credential && 
            (pending.credential.username === credentials.username || 
             pending.credential.loginUsername === credentials.username) && 
            pending.credential.password === credentials.password
          );
          
          sendResponse({ exists: existsInPasswords || existsInPending });
        })
        .catch(error => {
          debugError('Error checking existing credentials:', error);
          sendResponse({ exists: false });
        });
      
      return true; // Keep message channel open for async response
    }


if (message.type === 'saveCredentials') {
  const credential = message.credential;
  
  debugLog('Saving credentials for:', credential.title);
  
  // First save credentials directly
  saveCredentialsToStorage(credential)
    .then(success => {
      if (success) {
        sendResponse({ success: true });
        
        // Also update UI to show it's pending if applicable
        if (sender.tab && sender.tab.id) {
          // Notify content script that credential was saved
          chrome.tabs.sendMessage(sender.tab.id, {
            type: 'credentialSaved',
            credential: credential
          }).catch(err => {
            // Ignore any errors, this is just for UI feedback
          });
        }
      } else {
        sendResponse({ success: false, error: 'Failed to save credential' });
      }
    })
    .catch(err => {
      debugError('Error in saveCredentials handler:', err);
      sendResponse({ success: false, error: err.message });
    });
  
  return true; // Keep message port open
}
    
    // Update existing queryPasswords case to handle username matches better
    if (message.type === 'queryPasswords') {
      debugLog('Querying passwords for domain:', message.domain);
      
      // Allow querying passwords even if not authenticated for better UX
      // We'll prompt for auth later if needed
      try {
        chrome.storage.local.get(['currentSession', 'encryptedPasswords'], async (data) => {
          try {
            const matches = await queryPasswordsFromStorage(message.domain, message.query);
            debugLog(`Found ${matches.length} matches for ${message.domain}`);
            
            // If we have matches but not authenticated, include a flag
            const requiresAuth = matches.length > 0 && 
              (!data.currentSession || !data.currentSession.unlocked);
            
            sendResponse({ 
              success: true, 
              matches,
              requiresAuth
            });
          } catch (error) {
            debugError('Error querying passwords:', error);
            sendResponse({ success: false, error: error.message });
          }
        });
        
        // Critical: Return true to keep channel open
        return true; 
      } catch (error) {
        debugError('Error processing query:', error);
        sendResponse({ success: false, error: error.message });
        return true; // Still return true to properly handle the error case
      }
    }
    
  } catch (error) {
    debugError('Error processing message:', error);
    extensionStatus.errors.push({ time: Date.now(), error: error.message });
    extensionStatus.lastError = { time: Date.now(), error: error.message, stack: error.stack };
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for async responses
});

// Add debug commands
// if (chrome.commands && chrome.commands.onCommand) {
//   chrome.commands.onCommand.addListener((command) => {
//     if (command === 'debug_toggle') {
//       debugLog('Debug command triggered');
      
//       // Get active tab
//       chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
//         if (tabs.length > 0) {
//           const tabId = tabs[0].id;
          
//           // Send test suggestions to content script
//           chrome.tabs.sendMessage(tabId, { 
//             type: 'showTestSuggestions'
//           }, (response) => {
//             if (chrome.runtime.lastError) {
//               debugError('Error sending test suggestions:', chrome.runtime.lastError);
//             } else {
//               debugLog('Test suggestions displayed');
//             }
//           });
//         }
//       });
//     }
//   });
// }