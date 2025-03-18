// Check authentication status
chrome.runtime.sendMessage({ type: 'checkAuth' }, (response) => {
    if (response.isAuthenticated) {
      // Handle autofill functionality here
      console.log('User is authenticated');
    }
  });