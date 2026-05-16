if (window.LOCAL_CONFIG?.firebase) {
  firebase.initializeApp(window.LOCAL_CONFIG.firebase);
} else {
  console.error('Missing Firebase config in js/config.local.js — add a `firebase` block.');
}

const ADMIN_EMAIL = window.LOCAL_CONFIG?.adminEmail || '';
const isAdmin = () => !!ADMIN_EMAIL && firebase.auth().currentUser?.email === ADMIN_EMAIL;
