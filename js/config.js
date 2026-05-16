// Public production config. Safe to commit — Firebase web API keys are designed
// to be public (security is enforced by Firestore rules), and the Worker URL is
// open by design (its own secret lives in Cloudflare).
//
// Local-only secrets (football-data.org key, admin email) live in
// js/config.local.js, which is gitignored.

window.LOCAL_CONFIG = window.LOCAL_CONFIG || {};
Object.assign(window.LOCAL_CONFIG, {
  apiBaseUrl: 'https://c2026-proxy.mongitox.workers.dev/v4',
  adminEmail: 'cagrija@microsoft.com',
  firebase: {
    apiKey: "AIzaSyBETHqT0A8DfACRVu-6l6Mb477qc7V_gPI",
    authDomain: "soccer-fantasy-17cb0.firebaseapp.com",
    projectId: "soccer-fantasy-17cb0",
    storageBucket: "soccer-fantasy-17cb0.firebasestorage.app",
    messagingSenderId: "381610932625",
    appId: "1:381610932625:web:93c7d0782e26bbae788230",
  },
});
