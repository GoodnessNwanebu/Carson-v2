// Clear Carson Session Data
// Run this in the browser console if you encounter session issues

console.log('🧹 Clearing Carson session data...');

// Clear localStorage
localStorage.removeItem('carsonSession');
console.log('✅ Cleared localStorage session data');

// Clear sessionStorage (just in case)
sessionStorage.clear();
console.log('✅ Cleared sessionStorage');

// Clear any cookies (if any)
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});
console.log('✅ Cleared cookies');

console.log('🎉 Session data cleared! Refresh the page to start fresh.'); 