let authMode = 'signin';

function initAuthForm() {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthMode(tab.dataset.tab));
  });

  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  document.getElementById('btn-toggle-auth-password').addEventListener('click', () => {
    togglePasswordVisibility('auth-password');
  });
  document.getElementById('btn-forgot-password').addEventListener('click', handleForgotPassword);
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  const btn = document.querySelector(`[data-toggle-target="${inputId}"]`)
    || (inputId === 'auth-password' ? document.getElementById('btn-toggle-auth-password') : null);
  if (btn) btn.classList.toggle('active', input.type === 'text');
}

async function handleForgotPassword() {
  const email = document.getElementById('auth-email').value.trim();
  hideAuthError();
  if (!email) {
    showAuthError(t('auth.err.emailForReset'));
    return;
  }
  const btn = document.getElementById('btn-forgot-password');
  btn.disabled = true;
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showAuthInfo(t('auth.resetSent', { email }));
  } catch (err) {
    showAuthError(prettyAuthError(err));
  } finally {
    btn.disabled = false;
  }
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
  el.classList.remove('auth-info');
}

function showAuthInfo(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('auth-info');
}

function hideAuthError() {
  const el = document.getElementById('auth-error');
  el.classList.add('hidden');
  el.classList.remove('auth-info');
}
