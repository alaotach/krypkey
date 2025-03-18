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