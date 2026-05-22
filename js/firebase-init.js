if (window.LOCAL_CONFIG?.firebase) {
  firebase.initializeApp(window.LOCAL_CONFIG.firebase);
} else {
  console.error('Missing Firebase config in js/config.local.js — add a `firebase` block.');
}

const ADMIN_EMAILS = (window.LOCAL_CONFIG?.adminEmails
  || (window.LOCAL_CONFIG?.adminEmail ? [window.LOCAL_CONFIG.adminEmail] : []))
  .map(e => e.toLowerCase());
const isAdmin = () => {
  const email = firebase.auth().currentUser?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.includes(email);
};
