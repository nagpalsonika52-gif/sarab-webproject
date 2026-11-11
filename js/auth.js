(function() {
    var config = window.SARAB_AUTH_CONFIG || {};
    var authClient = null;
    var overlay = document.getElementById('authOverlay');
    var form = document.getElementById('authForm');
    var message = document.getElementById('authMessage');
    var mode = 'signin';
    var previousFocus = null;

    var elements = {
        open: document.getElementById('authOpenBtn'),
        signOut: document.getElementById('authSignOutBtn'),
        close: document.getElementById('authClose'),
        title: document.getElementById('authTitle'),
        intro: document.getElementById('authIntro'),
        name: document.getElementById('authName'),
        nameLabel: document.getElementById('authNameLabel'),
        email: document.getElementById('authEmail'),
        emailLabel: document.querySelector('label[for="authEmail"]'),
        password: document.getElementById('authPassword'),
        passwordGroup: document.getElementById('authPasswordGroup'),
        passwordToggle: document.getElementById('authPasswordToggle'),
        forgot: document.getElementById('authForgot'),
        submit: document.getElementById('authSubmit'),
        switch: document.getElementById('authSwitch'),
        modeToggle: document.getElementById('authModeToggle')
    };

    function showMessage(text, isSuccess) {
        message.textContent = text;
        message.classList.toggle('visible', Boolean(text));
        message.classList.toggle('success', Boolean(isSuccess));
    }

    function setMode(nextMode) {
        mode = nextMode;
        showMessage('');
        elements.name.hidden = mode !== 'signup';
        elements.nameLabel.hidden = mode !== 'signup';
        elements.email.hidden = mode === 'recovery';
        elements.emailLabel.hidden = mode === 'recovery';
        elements.email.required = mode !== 'recovery';
        elements.passwordGroup.hidden = mode === 'recovery-request';
        elements.forgot.hidden = mode !== 'signin';
        elements.switch.hidden = mode === 'recovery' || mode === 'recovery-request';
        elements.password.required = mode !== 'recovery-request';

        if (mode === 'signup') {
            elements.title.textContent = 'Create your account';
            elements.intro.textContent = 'Join Sarab for a more personal dining experience.';
            elements.submit.innerHTML = 'Create account <i class="fas fa-arrow-right"></i>';
            elements.modeToggle.textContent = 'Sign in';
            elements.switch.firstChild.textContent = 'Already have an account? ';
            elements.password.autocomplete = 'new-password';
        } else if (mode === 'recovery-request') {
            elements.title.textContent = 'Reset your password';
            elements.intro.textContent = 'We will email you a secure link to reset your password.';
            elements.submit.innerHTML = 'Send reset link <i class="fas fa-arrow-right"></i>';
        } else if (mode === 'recovery') {
            elements.title.textContent = 'Choose a new password';
            elements.intro.textContent = 'Enter a new password for your account.';
            elements.submit.innerHTML = 'Update password <i class="fas fa-arrow-right"></i>';
        } else {
            elements.title.textContent = 'Welcome back';
            elements.intro.textContent = 'Sign in to continue to your account.';
            elements.submit.innerHTML = 'Sign in <i class="fas fa-arrow-right"></i>';
            elements.modeToggle.textContent = 'Create an account';
            elements.switch.firstChild.textContent = 'New to Sarab? ';
            elements.password.autocomplete = 'current-password';
        }
    }

    function openDialog() {
        previousFocus = document.activeElement;
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        window.setTimeout(function() {
            (mode === 'recovery' ? elements.password : elements.email).focus();
        }, 0);
    }

    function closeDialog() {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (previousFocus) previousFocus.focus();
    }

    function updateAccount(session) {
        var user = session && session.user;
        elements.open.querySelector('span').textContent = user
            ? (user.user_metadata.full_name || user.email.split('@')[0])
            : 'Sign in';
        elements.open.setAttribute('aria-label', user ? 'Account: ' + user.email : 'Sign in');
        elements.signOut.hidden = !user;
    }

    elements.open.addEventListener('click', openDialog);
    elements.close.addEventListener('click', closeDialog);
    elements.modeToggle.addEventListener('click', function() {
        setMode(mode === 'signup' ? 'signin' : 'signup');
    });
    elements.forgot.addEventListener('click', function(event) {
        event.preventDefault();
        setMode('recovery-request');
    });
    elements.passwordToggle.addEventListener('click', function() {
        var showing = elements.password.type === 'text';
        elements.password.type = showing ? 'password' : 'text';
        this.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        this.innerHTML = showing ? '<i class="far fa-eye"></i>' : '<i class="far fa-eye-slash"></i>';
    });
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) closeDialog();
    });
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && overlay.classList.contains('open')) closeDialog();
    });

    elements.signOut.addEventListener('click', async function() {
        if (!authClient) return;
        var result = await authClient.auth.signOut();
        if (result.error) {
            openDialog();
            showMessage(result.error.message);
        }
    });

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        showMessage('');

        if (!authClient) {
            showMessage('Authentication is not configured yet. Add your Supabase project URL and anon key in js/auth-config.js.');
            return;
        }

        var email = elements.email.value.trim();
        var password = elements.password.value;
        elements.submit.disabled = true;

        try {
            var result;
            if (mode === 'signup') {
                result = await authClient.auth.signUp({
                    email: email,
                    password: password,
                    options: { data: { full_name: elements.name.value.trim() } }
                });
                if (!result.error && !result.data.session) {
                    showMessage('Check your email for a confirmation link to finish creating your account.', true);
                    return;
                }
            } else if (mode === 'recovery-request') {
                result = await authClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + window.location.pathname
                });
                if (!result.error) {
                    showMessage('Check your email for a secure password reset link.', true);
                    return;
                }
            } else if (mode === 'recovery') {
                if (password.length < 8) {
                    showMessage('Choose a password with at least 8 characters.');
                    return;
                }
                result = await authClient.auth.updateUser({ password: password });
            } else {
                result = await authClient.auth.signInWithPassword({ email: email, password: password });
            }

            if (result.error) {
                showMessage(result.error.message);
            } else if (mode === 'recovery') {
                setMode('signin');
                showMessage('Your password has been updated. Sign in with your new password.', true);
            } else {
                closeDialog();
                form.reset();
                setMode('signin');
            }
        } catch (error) {
            showMessage('Something went wrong. Please try again.');
        } finally {
            elements.submit.disabled = false;
        }
    });

    if (window.supabase && config.supabaseUrl && config.supabaseAnonKey &&
        !config.supabaseUrl.startsWith('YOUR_') && !config.supabaseAnonKey.startsWith('YOUR_')) {
        authClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
        authClient.auth.onAuthStateChange(function(event, session) {
            updateAccount(session);
            if (event === 'PASSWORD_RECOVERY') {
                setMode('recovery');
                openDialog();
            }
        });
        authClient.auth.getSession().then(function(result) {
            updateAccount(result.data.session);
        });
    }
})();