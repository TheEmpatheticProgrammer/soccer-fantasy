let authMode = 'signin';

function initAuthForm() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthMode(tab.dataset.tab));
  });

  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
}

function switchAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach(tab =>
    tab.classList.toggle('active', tab.dataset.tab === mode)
  );
  document.getElementById('auth-displayname-wrap').classList.toggle('hidden', mode === 'signin');
  document.getElementById('auth-displayname').required = mode === 'signup';
  refreshAuthLabels();
  hideAuthError();
}

function refreshAuthLabels() {
  document.getElementById('auth-submit').textContent =
    authMode === 'signin' ? t('auth.signIn') : t('auth.createAccount');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const displayName = document.getElementById('auth-displayname').value.trim();
  const submitBtn = document.getElementById('auth-submit');

  hideAuthError();
  submitBtn.disabled = true;

  try {
    if (authMode === 'signup') {
      if (!displayName) {
        showAuthError(t('auth.err.nameRequired'));
        return;
      }
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName });
      await cred.user.reload();
      if (typeof onProfileUpdated === 'function') onProfileUpdated();
    } else {
      await firebase.auth().signInWithEmailAndPassword(email, password);
    }
  } catch (err) {
    showAuthError(prettyAuthError(err));
  } finally {
    submitBtn.disabled = false;
  }
}

function prettyAuthError(err) {
  const code = err.code || '';
  if (code === 'auth/email-already-in-use')   return t('auth.err.emailInUse');
  if (code === 'auth/invalid-email')          return t('auth.err.invalidEmail');
  if (code === 'auth/weak-password')          return t('auth.err.weakPassword');
  if (code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-credential')     return t('auth.err.invalidCred');
  if (code === 'auth/too-many-requests')      return t('auth.err.tooMany');
  if (code === 'auth/network-request-failed') return t('auth.err.network');
  return err.message || t('auth.err.generic');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideAuthError() {
  document.getElementById('auth-error').classList.add('hidden');
}
