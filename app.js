import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously, signInWithCustomToken, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc, query, where, getDocs, collectionGroup, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

// --- Config & State ---
let firebaseConfig;
if (typeof __firebase_config !== 'undefined') {
    try { firebaseConfig = JSON.parse(__firebase_config); } catch (e) { console.error("Error parsing firebase config:", e); }
}

if (!firebaseConfig) {
    firebaseConfig = {
        apiKey: "AIzaSyAl4i1nP24SOvAt1ifbGD0SZo2u_l4MnB8",
        authDomain: "fieldwork-tracker-ae8f7.firebaseapp.com",
        projectId: "fieldwork-tracker-ae8f7",
        storageBucket: "fieldwork-tracker-ae8f7.firebasestorage.app",
        messagingSenderId: "4649951899",
        appId: "1:4649951899:web:28278ddb278baf67b39c3e"
    };
}

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

dayjs.extend(window.dayjs_plugin_customParseFormat);
const { jsPDF } = window.jspdf;

let db, auth, storage;
let userId = null;
let allEntries = [];
let profileData = { name: '', rbtNumber: '', supervisors: [], fieldworkType: 'Supervised' }; // Default to Supervised
let unsubscribeEntries = null;
let unsubscribeProfile = null;
let activeChatContactId = null;
let unsubscribeChatMessages = null;
let unsubscribeChats = null;
let supervisorChatsUnsubscribes = [];
let accessBlockedAlertShown = false;
let chartInstances = {};
let currentPdfDoc = null;
let currentPdfFilename = "report.pdf";

// --- DOM Elements ---
let loginView, loginErrorMessage, appContainer, loginBtn, guestLoginBtn, logoutBtn, userDisplay,
    viewBtns, views, monthSelector, prevMonthBtn, nextMonthBtn, yearSelector, monthlySummaryGrid,
    yearlySummaryGrid, allTimeSummaryGrid, logTableBody, yearlyLogTableBody, allTimeLogTableBody;

// Slide-over Form Elements
let fabAddEntry, slideOverPanel, slideOverBackdrop, slideOverContent, closeSlideOverBtn,
    slideOverTitle, trackerForm, saveEntryBtn, deleteEntryBtn;

// Form Inputs
let activityTypeRadios, activityTypeSelect, unrestrictedSection, unrestrictedTypeSelect, supervisorSelect;

// Settings
let settingsPanel, settingsBackdrop, settingsContent, settingsBtn, closeSettingsBtn,
    profileForm, supervisorForm, supervisorsList;

// Exports
let generateMfvfBtn, exportMonthlyCsvBtn, exportYearlyPdfBtn, exportYearlyCsvBtn,
    exportAllTimePdfBtn, exportAllTimeCsvBtn, mfvfModal, mfvfSupervisorSelect,
    mfvfGenerateConfirm, mfvfCancel;

// PDF Preview
let pdfPreviewModal, pdfIframe, pdfDownloadBtn, pdfCloseBtn,
    pdfSendSupervisorBtn, pdfSendSupervisorMenu, pdfSendToast;

let chartContexts = {};
let tableHeaders = {};

// AI Note Assistant State Variables
let geminiApiKey = '', geminiApiKeyInput, toggleApiKeyBtn, saveAiSettingsBtn,
    aiAssistBtn, aiUndoBar, aiUndoBtn, aiAcceptBtn, originalNotes = '';

// Username & Password Auth and Email Linking Elements
let tabGoogleGuest, tabUserPass, authGoogleGuestContainer, authUserPassContainer,
    signinForm, signupForm, signinUsername, signinPassword, signupUsername, signupPassword,
    goToSignup, goToSignin, emailLinkBanner, bannerLinkEmailBtn,
    accountSecuritySection, accountRealEmail, linkEmailBtn, emailLinkStatus;

// Notification System State Variables
let activeNotifications = [];
let globalChatsData = {};
let unsubscribeGlobalChats = null;
let supervisorNotificationUnsubscribes = [];
let desktopNotificationBtn, desktopNotificationDropdown, mobileNotificationBtn, mobileNotificationDropdown,
    desktopNotificationList, desktopNotificationEmpty, mobileNotificationList, mobileNotificationEmpty,
    desktopMarkAllRead, mobileMarkAllRead;

function initDOMElements() {
    console.log("App.js: Initializing DOM elements...");
    try {
        loginView = document.getElementById('login-view');
        loginErrorMessage = document.getElementById('login-error-message');
        appContainer = document.getElementById('app-container');
        loginBtn = document.getElementById('login-btn');
        guestLoginBtn = document.getElementById('guest-login-btn');
        logoutBtn = document.getElementById('logout-btn');
        userDisplay = document.getElementById('user-display');
        viewBtns = document.querySelectorAll('.view-btn');
        views = document.querySelectorAll('.view-container');
        monthSelector = document.getElementById('month-selector');
        prevMonthBtn = document.getElementById('prev-month-btn');
        nextMonthBtn = document.getElementById('next-month-btn');
        yearSelector = document.getElementById('year-selector');
        monthlySummaryGrid = document.getElementById('monthly-summary-grid');
        yearlySummaryGrid = document.getElementById('yearly-summary-grid');
        allTimeSummaryGrid = document.getElementById('all-time-summary-grid');
        logTableBody = document.getElementById('log-table-body');
        yearlyLogTableBody = document.getElementById('yearly-log-table-body');
        allTimeLogTableBody = document.getElementById('all-time-log-table-body');

        fabAddEntry = document.getElementById('fab-add-entry');
        slideOverPanel = document.getElementById('slide-over-panel');
        slideOverBackdrop = document.getElementById('slide-over-backdrop');
        slideOverContent = document.getElementById('slide-over-content');
        closeSlideOverBtn = document.getElementById('close-slide-over-btn');
        slideOverTitle = document.getElementById('slide-over-title');
        trackerForm = document.getElementById('tracker-form');
        saveEntryBtn = document.getElementById('save-entry-btn');
        deleteEntryBtn = document.getElementById('delete-entry-btn');

        activityTypeRadios = document.getElementsByName('activity-type-radio');
        activityTypeSelect = document.getElementById('activity-type');
        unrestrictedSection = document.getElementById('unrestricted-section');
        unrestrictedTypeSelect = document.getElementById('unrestricted-type-select');
        supervisorSelect = document.getElementById('supervisor-select');

        settingsPanel = document.getElementById('settings-panel');
        settingsBackdrop = document.getElementById('settings-backdrop');
        settingsContent = document.getElementById('settings-content');
        settingsBtn = document.getElementById('settings-btn');
        closeSettingsBtn = document.getElementById('close-settings-btn');
        profileForm = document.getElementById('profile-form');
        supervisorForm = document.getElementById('supervisor-form');
        supervisorsList = document.getElementById('supervisors-list');

        generateMfvfBtn = document.getElementById('generate-mfvf-btn');
        exportMonthlyCsvBtn = document.getElementById('export-monthly-csv-btn');
        exportYearlyPdfBtn = document.getElementById('export-yearly-pdf-btn');
        exportYearlyCsvBtn = document.getElementById('export-yearly-csv-btn');
        exportAllTimePdfBtn = document.getElementById('export-all-time-pdf-btn');
        exportAllTimeCsvBtn = document.getElementById('export-all-time-csv-btn');
        mfvfModal = document.getElementById('mfvf-modal');
        mfvfSupervisorSelect = document.getElementById('mfvf-supervisor-select');
        mfvfGenerateConfirm = document.getElementById('mfvf-generate-confirm');
        mfvfCancel = document.getElementById('mfvf-cancel');

        pdfPreviewModal = document.getElementById('pdf-preview-modal');
        pdfIframe = document.getElementById('pdf-iframe');
        pdfDownloadBtn = document.getElementById('pdf-download-btn');
        pdfCloseBtn = document.getElementById('pdf-close-btn');
        pdfSendSupervisorBtn = document.getElementById('pdf-send-supervisor-btn');
        pdfSendSupervisorMenu = document.getElementById('pdf-send-supervisor-menu');
        pdfSendToast = document.getElementById('pdf-send-toast');

        const totalHoursEl = document.getElementById('totalHoursChart');
        const restrictedHoursEl = document.getElementById('restrictedHoursChart');
        const unrestrictedHoursEl = document.getElementById('unrestrictedHoursChart');

        chartContexts = {
            total: totalHoursEl ? totalHoursEl.getContext('2d') : null,
            restricted: restrictedHoursEl ? restrictedHoursEl.getContext('2d') : null,
            unrestricted: unrestrictedHoursEl ? unrestrictedHoursEl.getContext('2d') : null
        };

        tableHeaders = {
            monthly: document.getElementById('monthly-table-header'),
            yearly: document.getElementById('yearly-table-header'),
            allTime: document.getElementById('all-time-table-header'),
            review: document.getElementById('review-table-header')
        };

        // Query AI Assistant Elements
        geminiApiKeyInput = document.getElementById('gemini-api-key');
        toggleApiKeyBtn = document.getElementById('toggle-api-key-btn');
        saveAiSettingsBtn = document.getElementById('save-ai-settings-btn');
        aiAssistBtn = document.getElementById('ai-assist-btn');
        aiUndoBar = document.getElementById('ai-undo-bar');
        aiUndoBtn = document.getElementById('ai-undo-btn');
        aiAcceptBtn = document.getElementById('ai-accept-btn');

        // Username & Password Auth elements
        tabGoogleGuest = document.getElementById('tab-google-guest');
        tabUserPass = document.getElementById('tab-user-pass');
        authGoogleGuestContainer = document.getElementById('auth-google-guest-container');
        authUserPassContainer = document.getElementById('auth-user-pass-container');
        signinForm = document.getElementById('signin-form');
        signupForm = document.getElementById('signup-form');
        signinUsername = document.getElementById('signin-username');
        signinPassword = document.getElementById('signin-password');
        signupUsername = document.getElementById('signup-username');
        signupPassword = document.getElementById('signup-password');
        goToSignup = document.getElementById('go-to-signup');
        goToSignin = document.getElementById('go-to-signin');
        emailLinkBanner = document.getElementById('email-link-banner');
        bannerLinkEmailBtn = document.getElementById('banner-link-email-btn');
        accountSecuritySection = document.getElementById('account-security-section');
        accountRealEmail = document.getElementById('account-real-email');
        linkEmailBtn = document.getElementById('link-email-btn');
        emailLinkStatus = document.getElementById('email-link-status');

        // Notifications UI elements
        desktopNotificationBtn = document.getElementById('desktop-notification-btn');
        desktopNotificationDropdown = document.getElementById('desktop-notification-dropdown');
        mobileNotificationBtn = document.getElementById('mobile-notification-btn');
        mobileNotificationDropdown = document.getElementById('mobile-notification-dropdown');
        desktopNotificationList = document.getElementById('desktop-notification-list');
        desktopNotificationEmpty = document.getElementById('desktop-notification-empty');
        mobileNotificationList = document.getElementById('mobile-notification-list');
        mobileNotificationEmpty = document.getElementById('mobile-notification-empty');
        desktopMarkAllRead = document.getElementById('desktop-mark-all-read');
        mobileMarkAllRead = document.getElementById('mobile-mark-all-read');

        // Load saved Gemini API key
        geminiApiKey = localStorage.getItem('gemini_api_key') || '';
        if (geminiApiKeyInput) {
            geminiApiKeyInput.value = geminiApiKey;
        }

        console.log("App.js: DOM elements initialized successfully");
    } catch (e) {
        console.error("App.js: Error initializing DOM elements:", e);
    }
}

// Role Selection & Navigation
const roleSelectionView = document.getElementById('role-selection-view');
const selectTraineeBtn = document.getElementById('select-trainee-btn');
const selectSupervisorBtn = document.getElementById('select-supervisor-btn');
const traineeNav = document.getElementById('trainee-nav');
const supervisorNav = document.getElementById('supervisor-nav');
const userRoleDisplay = document.getElementById('user-role-display');

// Supervisor Dashboard
const traineesList = document.getElementById('trainees-list');
const traineeReviewPlaceholder = document.getElementById('trainee-review-placeholder');
const traineeReviewContent = document.getElementById('trainee-review-content');
const reviewTraineeName = document.getElementById('review-trainee-name');
const reviewTraineeEmail = document.getElementById('review-trainee-email');
const reviewMonthSelector = document.getElementById('review-month-selector');
const reviewStatsGrid = document.getElementById('review-stats-grid');
const reviewTableBody = document.getElementById('review-table-body');
const signMonthBtn = document.getElementById('sign-month-btn');
const addTraineeBtn = document.getElementById('add-trainee-btn');

// This will be called inside init()
function setupTableHeaders() {
    const tableHeaderHTML = `
        <th class="px-4 py-3 font-medium text-text-muted">Date</th>
        <th class="px-4 py-3 font-medium text-text-muted">Time</th>
        <th class="px-4 py-3 font-medium text-text-muted">Hrs</th>
        <th class="px-4 py-3 font-medium text-text-muted">Client</th>
        <th class="px-4 py-3 font-medium text-text-muted">Type</th>
        <th class="px-4 py-3 font-medium text-text-muted hidden sm:table-cell">Unrestricted Type</th>
        <th class="px-4 py-3 font-medium text-text-muted">Supervision</th>
        <th class="px-4 py-3 font-medium text-text-muted">Supervisor</th>
        <th class="px-4 py-3 font-medium text-text-muted hidden md:table-cell">Notes</th>
        <th class="px-4 py-3 font-medium text-text-muted text-center">Feedback</th>
        <th class="px-4 py-3 font-medium text-text-muted text-right">Actions</th>
    `;
    const reviewTableHeaderHTML = `
        <th class="px-4 py-3 font-medium text-text-muted">Date</th>
        <th class="px-4 py-3 font-medium text-text-muted">Time</th>
        <th class="px-4 py-3 font-medium text-text-muted">Hrs</th>
        <th class="px-4 py-3 font-medium text-text-muted">Client</th>
        <th class="px-4 py-3 font-medium text-text-muted">Type</th>
        <th class="px-4 py-3 font-medium text-text-muted hidden sm:table-cell">Unrestricted Type</th>
        <th class="px-4 py-3 font-medium text-text-muted">Supervision</th>
        <th class="px-4 py-3 font-medium text-text-muted">Supervisor</th>
        <th class="px-4 py-3 font-medium text-text-muted hidden md:table-cell">Notes</th>
        <th class="px-4 py-3 font-medium text-text-muted">Feedback</th>
        <th class="px-4 py-3 font-medium text-text-muted text-right">Actions</th>
    `;
    if (tableHeaders.monthly) tableHeaders.monthly.innerHTML = tableHeaderHTML;
    if (tableHeaders.yearly) tableHeaders.yearly.innerHTML = tableHeaderHTML;
    if (tableHeaders.allTime) tableHeaders.allTime.innerHTML = tableHeaderHTML;
    if (tableHeaders.review) tableHeaders.review.innerHTML = reviewTableHeaderHTML;
}

// --- Authentication ---
const handleGoogleLogin = async () => {
    loginErrorMessage.classList.add('hidden');
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Google sign-in error", error);
        loginErrorMessage.classList.remove('hidden');
        loginErrorMessage.querySelector('span').textContent = `Login failed: ${error.message}`;
    }
};

const handleUsernameSignup = async (e) => {
    e.preventDefault();
    loginErrorMessage.classList.add('hidden');
    
    const username = signupUsername.value.trim();
    const password = signupPassword.value;
    
    if (username.length < 3) {
        loginErrorMessage.classList.remove('hidden');
        loginErrorMessage.querySelector('span').textContent = 'Username must be at least 3 characters.';
        return;
    }
    
    // Alphanumeric, underscores, hyphens only
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
        loginErrorMessage.classList.remove('hidden');
        loginErrorMessage.querySelector('span').textContent = 'Username can only contain letters, numbers, underscores, and hyphens.';
        return;
    }
    
    const normalizedUsername = username.toLowerCase();
    const email = `${normalizedUsername}@fieldlygo.com`;
    
    const signupBtn = document.getElementById('username-signup-btn');
    const originalText = signupBtn.textContent;
    signupBtn.disabled = true;
    signupBtn.textContent = 'Creating Account...';
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        
        // Save user profile document in Firestore
        const profileRef = doc(db, `users/${userCredential.user.uid}`);
        await setDoc(profileRef, {
            username: username,
            email: email, // Placeholder email
            name: username,
            registeredAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            planType: 'free',
            isVip: false,
            status: 'active',
            version: '1.0'
        }, { merge: true });
        
        signupForm.reset();
    } catch (error) {
        console.error("Username signup error", error);
        loginErrorMessage.classList.remove('hidden');
        let errorMsg = error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = 'This username is already taken. Please choose another one.';
        }
        loginErrorMessage.querySelector('span').textContent = `Sign Up failed: ${errorMsg}`;
    } finally {
        signupBtn.disabled = false;
        signupBtn.textContent = originalText;
    }
};

const handleUsernameSignin = async (e) => {
    e.preventDefault();
    loginErrorMessage.classList.add('hidden');
    
    const input = signinUsername.value.trim();
    const password = signinPassword.value;
    
    let email = input;
    if (!input.includes('@')) {
        email = `${input.toLowerCase()}@fieldlygo.com`;
    }
    
    const signinBtn = document.getElementById('username-signin-btn');
    const originalText = signinBtn.textContent;
    signinBtn.disabled = true;
    signinBtn.textContent = 'Signing In...';
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        signinForm.reset();
    } catch (error) {
        console.error("Username sign-in error", error);
        loginErrorMessage.classList.remove('hidden');
        let errorMsg = error.message;
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMsg = 'Incorrect username/email or password.';
        }
        loginErrorMessage.querySelector('span').textContent = `Sign In failed: ${errorMsg}`;
    } finally {
        signinBtn.disabled = false;
        signinBtn.textContent = originalText;
    }
};

const handleLinkEmail = async () => {
    if (!auth.currentUser) return;
    emailLinkStatus.textContent = '';
    emailLinkStatus.className = 'text-xs text-text-muted mt-1 leading-relaxed';
    
    const email = accountRealEmail.value.trim();
    
    if (!email || !email.includes('@') || !email.includes('.')) {
        emailLinkStatus.textContent = 'Please enter a valid email address.';
        emailLinkStatus.className = 'text-xs text-red-400 mt-1 leading-relaxed';
        return;
    }
    
    linkEmailBtn.disabled = true;
    linkEmailBtn.textContent = 'Linking...';
    
    try {
        const profileRef = doc(db, `users/${auth.currentUser.uid}`);
        await setDoc(profileRef, {
            email: email
        }, { merge: true });
        
        profileData.email = email;
        accountRealEmail.value = email;
        
        emailLinkStatus.textContent = 'Email address linked successfully! ✅';
        emailLinkStatus.className = 'text-xs text-emerald-400 mt-1 leading-relaxed';
        
        if (emailLinkBanner) emailLinkBanner.classList.add('hidden');
        if (userDisplay) userDisplay.textContent = auth.currentUser.displayName || email;
        
        await CustomModal.alert("Your real email address has been linked successfully! Other users (like supervisors) can now find you using this email.", "Email Linked");
    } catch (error) {
        console.error("Error linking email", error);
        emailLinkStatus.textContent = 'Error: ' + error.message;
        emailLinkStatus.className = 'text-xs text-red-400 mt-1 leading-relaxed';
    } finally {
        linkEmailBtn.disabled = false;
        linkEmailBtn.textContent = 'Link Email';
    }
};

// --- UI Logic: Modal ---
const openSlideOver = (mode = 'add', entry = null) => {
    if (aiUndoBar) aiUndoBar.classList.add('hidden');
    slideOverPanel.classList.remove('hidden');
    // Trigger reflow
    void slideOverPanel.offsetWidth;

    slideOverBackdrop.classList.remove('opacity-0');
    slideOverContent.classList.remove('opacity-0', 'scale-95');
    slideOverContent.classList.add('opacity-100', 'scale-100');

    if (mode === 'add') {
        slideOverTitle.textContent = 'Log Activity';
        trackerForm.reset();
        document.getElementById('entry-id').value = '';
        deleteEntryBtn.classList.add('hidden');
        saveEntryBtn.textContent = 'Save Entry';

        // Defaults
        document.getElementById('date').value = dayjs().format('YYYY-MM-DD');
        activityTypeRadios[0].checked = true; // Restricted default
        handleActivityTypeChange();
    } else if (mode === 'edit' && entry) {
        slideOverTitle.textContent = 'Edit Activity';
        deleteEntryBtn.classList.remove('hidden');
        saveEntryBtn.textContent = 'Update Entry';

        // Populate form
        document.getElementById('entry-id').value = entry.id;
        document.getElementById('date').value = entry.date;
        document.getElementById('start-time').value = entry.startTime;
        document.getElementById('end-time').value = entry.endTime;
        document.getElementById('setting').value = entry.setting || 'School';

        // Radio buttons
        if (entry.activityType === 'Unrestricted') {
            activityTypeRadios[1].checked = true;
        } else {
            activityTypeRadios[0].checked = true;
        }
        handleActivityTypeChange();

        if (entry.activityType === 'Unrestricted') {
            unrestrictedTypeSelect.value = entry.unrestrictedActivityType || '';
        }

        document.getElementById('supervision-type').value = entry.supervisionType;
        document.getElementById('supervisor-select').value = entry.supervisorName || '';
        document.getElementById('client-present').value = entry.clientPresent;
        document.getElementById('client-name').value = entry.clientName || '';
        document.getElementById('notes').value = entry.notes || '';
    }
};

const closeSlideOver = () => {
    if (aiUndoBar) aiUndoBar.classList.add('hidden');
    slideOverBackdrop.classList.add('opacity-0');
    slideOverContent.classList.remove('opacity-100', 'scale-100');
    slideOverContent.classList.add('opacity-0', 'scale-95');
    setTimeout(() => {
        slideOverPanel.classList.add('hidden');
    }, 300);
};

const handleActivityTypeChange = () => {
    const isUnrestricted = activityTypeRadios[1].checked;
    activityTypeSelect.value = isUnrestricted ? 'Unrestricted' : 'Restricted';

    if (isUnrestricted) {
        unrestrictedSection.classList.remove('hidden');
    } else {
        unrestrictedSection.classList.add('hidden');
        unrestrictedTypeSelect.value = '';
    }
};

// --- UI Logic: Settings ---
const openSettingsPanel = () => {
    settingsPanel.classList.remove('hidden');
    void settingsPanel.offsetWidth;
    settingsBackdrop.classList.remove('opacity-0'); // Reuse class or add specific
    settingsContent.classList.remove('translate-x-full');
};

const closeSettingsPanel = () => {
    settingsBackdrop.classList.add('opacity-0'); // Reuse class or add specific
    settingsContent.classList.add('translate-x-full');
    setTimeout(() => settingsPanel.classList.add('hidden'), 500);
};

// --- Render, Add, Edit, Remove Supervisors ---
let editingSupervisorOriginalName = null; // Track which supervisor is being edited

const renderSupervisors = () => {
    supervisorsList.innerHTML = '';
    const supervisorDropdowns = [supervisorSelect, mfvfSupervisorSelect];
    supervisorDropdowns.forEach(sel => {
        if (sel) sel.innerHTML = '<option value="">Select a supervisor...</option>';
    });

    if (profileData.supervisors) {
        profileData.supervisors.forEach(s => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5 group';
            div.innerHTML = `
                <div class="flex-1">
                    <div class="text-sm text-text font-medium">${s.name}</div>
                    <div class="text-xs text-text-muted">Cert: ${s.cert} • ${s.email || 'No Email'}</div>
                </div>
                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="edit-supervisor-btn text-primary hover:text-primary-hover p-1" data-name="${s.name}">
                        <i class="ph-bold ph-pencil-simple"></i>
                    </button>
                    <button class="remove-supervisor-btn text-red-400 hover:text-red-300 p-1" data-name="${s.name}">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                </div>`;
            supervisorsList.appendChild(div);
            supervisorDropdowns.forEach(sel => {
                if (sel) sel.add(new Option(`${s.name}`, s.name));
            });
        });
    }
};

const handleEditSupervisor = (name) => {
    const supervisor = profileData.supervisors.find(s => s.name === name);
    if (!supervisor) return;

    document.getElementById('supervisor-name-input').value = supervisor.name;
    document.getElementById('supervisor-cert-input').value = supervisor.cert;
    document.getElementById('supervisor-email-input').value = supervisor.email || '';

    editingSupervisorOriginalName = name;

    const addBtn = supervisorForm.querySelector('button[type="submit"]');
    addBtn.innerHTML = '<i class="ph-bold ph-check"></i> Update Supervisor';
    addBtn.classList.remove('bg-surface', 'hover:bg-surface-hover');
    addBtn.classList.add('bg-primary', 'hover:bg-primary-hover');
};

const addOrUpdateSupervisor = async (e) => {
    e.preventDefault();
    const addBtn = supervisorForm.querySelector('button[type="submit"]');
    const originalContent = addBtn.innerHTML;
    addBtn.textContent = editingSupervisorOriginalName ? 'Updating...' : 'Adding...';
    addBtn.disabled = true;

    const name = document.getElementById('supervisor-name-input').value;
    const cert = document.getElementById('supervisor-cert-input').value;
    const email = document.getElementById('supervisor-email-input').value;

    if (!profileData.supervisors) profileData.supervisors = [];

    // Check for duplicates (unless we are editing the same person)
    const exists = profileData.supervisors.find(s => s.name === name);
    if (exists && name !== editingSupervisorOriginalName) {
        addBtn.textContent = 'Name Exists!';
        setTimeout(() => {
            addBtn.innerHTML = originalContent;
            addBtn.disabled = false;
        }, 2000);
        return;
    }

    if (name && cert && email) {
        if (editingSupervisorOriginalName) {
            // Update existing
            const index = profileData.supervisors.findIndex(s => s.name === editingSupervisorOriginalName);
            if (index > -1) {
                profileData.supervisors[index] = { name, cert, email };
            }
        } else {
            // Add new
            profileData.supervisors.push({ name, cert, email });
        }

        const saveSuccess = async () => {
            if (userId === 'guest') {
                saveProfileToLocalStorage();
                return true;
            } else {
                const profileRef = doc(db, `users/${userId}`);
                try {
                    const resolvedEmails = [];
                    for (const s of profileData.supervisors) {
                        if (!s.email) continue;
                        const trimmedEmail = s.email.trim();
                        resolvedEmails.push(trimmedEmail);
                        
                        if (!trimmedEmail.includes('@')) {
                            const placeholderEmail = `${trimmedEmail.toLowerCase()}@fieldlygo.com`;
                            resolvedEmails.push(placeholderEmail);
                        } else {
                            try {
                                const q = query(collection(db, 'users'), where('email', '==', trimmedEmail));
                                const snap = await getDocs(q);
                                snap.forEach(docSnap => {
                                    const data = docSnap.data();
                                    if (data.username) {
                                        resolvedEmails.push(`${data.username.toLowerCase()}@fieldlygo.com`);
                                    }
                                });
                            } catch (err) {
                                console.error("Error looking up supervisor in users:", err);
                            }
                        }
                    }
                    const supervisorEmails = [...new Set(resolvedEmails)];

                    await setDoc(profileRef, {
                        supervisors: profileData.supervisors,
                        supervisorEmails: supervisorEmails
                    }, { merge: true });
                    return true;
                } catch (error) {
                    console.error("Error saving supervisor:", error);
                    return false;
                }
            }
        };

        if (await saveSuccess()) {
            addBtn.textContent = editingSupervisorOriginalName ? 'Updated!' : 'Added!';
            supervisorForm.reset();
            editingSupervisorOriginalName = null;

            // Reset button style
            setTimeout(() => {
                addBtn.innerHTML = '<i class="ph-bold ph-plus"></i> Add Supervisor';
                addBtn.classList.remove('bg-primary', 'hover:bg-primary-hover');
                addBtn.classList.add('bg-surface', 'hover:bg-surface-hover');
                addBtn.disabled = false;

                if (userId === 'guest') renderSupervisors(); // Manual refresh for local
            }, 1000);
        } else {
            addBtn.textContent = 'Error!';
            setTimeout(() => {
                addBtn.innerHTML = originalContent;
                addBtn.disabled = false;
            }, 2000);
        }
    }
};

const removeSupervisor = async (name) => {
    profileData.supervisors = profileData.supervisors.filter(s => s.name !== name);
    if (userId === 'guest') {
        saveProfileToLocalStorage();
        renderSupervisors();
    } else {
        const profileRef = doc(db, `users/${userId}`);
        await setDoc(profileRef, { supervisors: profileData.supervisors }, { merge: true });
    }
};

// Data migration helper for legacy explanations
const migrateLegacyExplanations = (entries) => {
    if (!entries || !Array.isArray(entries)) return [];
    return entries.map(entry => {
        const legacyText = entry.unrestrictedExplanation || entry.explanation;
        if (legacyText && !entry.notes) {
            entry.notes = legacyText;
        }
        return entry;
    });
};

// --- Local Storage Functions ---
const loadDataFromLocalStorage = () => {
    const raw = JSON.parse(localStorage.getItem('fieldwork_entries')) || [];
    let migrated = false;
    allEntries = raw.map(entry => {
        const legacyText = entry.unrestrictedExplanation || entry.explanation;
        if (legacyText && !entry.notes) {
            entry.notes = legacyText;
            migrated = true;
        }
        return entry;
    });
    if (migrated) {
        saveEntriesToLocalStorage();
    }
    profileData = JSON.parse(localStorage.getItem('fieldwork_profile')) || { name: 'Guest User', rbtNumber: '', supervisors: [], fieldworkType: 'Supervised' };

    document.getElementById('trainee-name').value = profileData.name;
    document.getElementById('rbt-number').value = profileData.rbtNumber;
    document.getElementById('fieldwork-type').value = profileData.fieldworkType || 'Supervised';
    renderSupervisors();
};

const saveEntriesToLocalStorage = () => {
    localStorage.setItem('fieldwork_entries', JSON.stringify(allEntries));
};

const saveProfileToLocalStorage = () => {
    localStorage.setItem('fieldwork_profile', JSON.stringify(profileData));
};

// --- Core App Logic ---
const switchView = async (viewId) => {
    console.log("App.js: switching view to variables", viewId);
    try {
        views.forEach(view => view.classList.add('hidden'));
        const targetView = document.getElementById(`${viewId}-view`);
        if (targetView) targetView.classList.remove('hidden');
        else console.warn("App.js: switchView target not found:", viewId);

        // Sidebar active states
        viewBtns.forEach(btn => {
            const isActive = btn.dataset.view === viewId;
            if (isActive) {
                btn.classList.add('bg-primary', 'text-sidebar-text', 'shadow-md', 'ring-1', 'ring-white/10');
                btn.classList.remove('text-sidebar-muted');
            } else {
                btn.classList.remove('bg-primary', 'text-sidebar-text', 'shadow-md', 'ring-1', 'ring-white/10');
                btn.classList.add('text-sidebar-muted');
            }
        });
        const traineesToggle = document.getElementById('sidebar-trainees-toggle');
        if (traineesToggle) {
            traineesToggle.classList.remove('bg-primary', 'text-sidebar-text', 'shadow-md', 'ring-1', 'ring-white/10');
            traineesToggle.classList.add('text-sidebar-muted');
        }

        switch (viewId) {
            case 'monthly': updateMonthlyView(); break;
            case 'yearly': updateYearlyView(); break;
            case 'all-time': updateAllTimeView(); break;
            case 'archived-mfvf': loadArchivedMfvfList(); break;
            case 'supervisor-dashboard': showTraineeList(); break;
            case 'mfvf-queue': renderMfvfQueue(); break;
            case 'trainee-compare': renderTraineeCompare(); break;
            case 'chat': updateChatView(); break;
        }
    } catch (e) {
        console.error("Error in switchView:", e);
        await CustomModal.alert("Error rendering view: " + e.message, "View Error");
    }
};

const calculateHours = (start, end) => {
    if (!start || !end) return 0;
    const startTime = dayjs(`1970-01-01T${start}`);
    let endTime = dayjs(`1970-01-01T${end}`);
    if (endTime.isBefore(startTime)) endTime = endTime.add(1, 'day');
    return endTime.diff(startTime, 'hour', true);
};

const calculateSummaryData = (entries) => {
    let total = 0, supervised = 0, restricted = 0, unrestricted = 0, contacts = 0;
    let observationMinutes = 0;
    let individualSupervision = 0;
    let groupSupervision = 0;

    entries.forEach(entry => {
        const hours = calculateHours(entry.startTime, entry.endTime);
        total += hours;
        if (entry.activityType === 'Restricted') restricted += hours;
        else unrestricted += hours;
        if (entry.supervisionType !== 'No Supervision') {
            supervised += hours;
            contacts++;

            // Individual vs Group Tracking
            if (entry.supervisionType === 'Group Supervision') {
                groupSupervision += hours;
            } else if (entry.supervisionType === '1:1 Meeting (with Supervisor)' ||
                entry.supervisionType === 'Observation with Client (by Supervisor)') {
                individualSupervision += hours;
            }

            // 2027 Requirement: Track Observation Duration
            if (entry.supervisionType.includes('Observation with Client')) {
                observationMinutes += hours * 60;
            }
        }
    });
    const percentage = total > 0 ? (supervised / total) * 100 : 0;
    const unsupervised = total - supervised;
    const observationHours = observationMinutes / 60;
    return {
        restricted, unrestricted, total, supervised, percentage,
        contacts, observationMinutes, observationHours, unsupervised,
        individualSupervision, groupSupervision
    };
};

// --- Rendering ---
const createStatCard = (title, value, subtext, iconClass, colorClass) => `
    <div class="glass-card p-4 rounded-xl flex items-center justify-between">
        <div>
            <p class="text-xs font-medium text-text-muted uppercase tracking-wider">${title}</p>
            <p class="text-2xl font-bold text-text mt-1">${value}</p>
            ${subtext ? `<p class="text-xs text-text-muted mt-1">${subtext}</p>` : ''}
        </div>
        <div class="w-10 h-10 rounded-lg ${colorClass} bg-opacity-10 flex items-center justify-center">
            <i class="${iconClass} text-xl"></i>
        </div>
    </div>
`;

const createSummaryHTML = (data, allTimeTotal, isMonthly = false) => {
    const isConcentrated = profileData.fieldworkType === 'Concentrated';
    const totalGoal = isConcentrated ? 1500 : 2000;
    // 2027 Change: Concentrated supervision reduced to 7.5%
    const supervisionGoal = isConcentrated ? 7.5 : 5;
    const observationGoal = isConcentrated ? 90 : 90; // 90 minutes observations

    // Supervision status
    const supervisionStatus = data.percentage >= supervisionGoal
        ? `<span class="text-green-400">On Track (${supervisionGoal}%)</span>`
        : `<span class="text-red-400">Needs Focus (${supervisionGoal}%)</span>`;

    // Observation status (2027)
    const obsStatus = data.observationMinutes >= observationGoal
        ? `<span class="text-green-400">OK</span>`
        : `<span class="text-red-400">Low</span>`;

    // Monthly Cap Warning (2027: 160 hours, only for monthly view)
    let totalTitle = 'Total Hours';
    if (isMonthly && data.total > 160) {
        totalTitle = `Total Hours <span class="text-red-400 text-[10px] ml-1 animate-pulse">(! >160h)</span>`;
    }

    const supervisedSubtext = `
        <div class="flex flex-col gap-1">
            <span>${data.percentage.toFixed(1)}% • ${supervisionStatus}</span>
        </div>
    `;

    const observationGoalText = `Goal: ${observationGoal}m • ${obsStatus}`;

    const formatDuration = (hours) => {
        const h = Math.floor(hours);
        const m = Math.round((hours % 1) * 60);
        return `${h}h ${m}m`;
    };

    return `
        ${createStatCard(totalTitle, formatDuration(data.total), `Remaining: ${formatDuration(Math.max(0, totalGoal - allTimeTotal))}`, 'ph-fill ph-clock', 'bg-blue-500 text-blue-400')}
        ${createStatCard('Restricted', formatDuration(data.restricted), null, 'ph-fill ph-hand-heart', 'bg-pink-500 text-pink-400')}
        ${createStatCard('Unrestricted', formatDuration(data.unrestricted), null, 'ph-fill ph-brain', 'bg-purple-500 text-purple-400')}
        ${createStatCard('Supervised', formatDuration(data.supervised), supervisedSubtext, 'ph-fill ph-users-three', 'bg-teal-500 text-teal-400')}
        ${createStatCard('Observation', formatDuration(data.observationHours), observationGoalText, 'ph-fill ph-eye', 'bg-cyan-500 text-cyan-400')}
        ${createStatCard('Unsupervised', formatDuration(data.unsupervised), null, 'ph-fill ph-user', 'bg-indigo-500 text-indigo-400')}
    `;
};

const updateAlerts = (data, containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    let hasAlerts = false;

    // Group Supervision Warning (BACB Requirement: Group <= 50% of total supervision)
    if (data.supervised > 0 && data.groupSupervision > (data.supervised * 0.5)) {
        const groupPercentage = ((data.groupSupervision / data.supervised) * 100).toFixed(1);
        const diff = (data.groupSupervision - data.individualSupervision).toFixed(2);

        const alert = document.createElement('div');
        alert.className = 'bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3 animate-fade-in';
        alert.innerHTML = `
            <div class="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0 text-yellow-500 transition-transform hover:scale-110">
                <i class="ph-fill ph-warning-diamond text-xl"></i>
            </div>
            <div class="flex-1">
                <h4 class="text-sm font-bold text-yellow-500 uppercase tracking-wider">Group Supervision Warning</h4>
                <p class="text-sm text-text-muted mt-1 leading-relaxed">
                    Your group supervision is <span class="text-yellow-500 font-semibold">${groupPercentage}%</span> of your total supervision 
                    and <span class="text-yellow-500 font-semibold">${diff} hours</span> more than individual supervision.
                </p>
                <p class="text-[10px] text-text-muted mt-2 opacity-60">BACB regulations require group supervision to not exceed 50% of total supervised hours.</p>
            </div>
        `;
        container.appendChild(alert);
        hasAlerts = true;
    }

    if (hasAlerts) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

const renderTable = (entries, tableBodyElement) => {
    tableBodyElement.innerHTML = '';
    if (entries.length === 0) {
        tableBodyElement.innerHTML = `<tr><td colspan="11" class="text-center py-12 text-text-muted">No activities logged for this period.</td></tr>`;
        return;
    }
    const sortedEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)); // Descending
    sortedEntries.forEach(entry => {
        const totalHours = calculateHours(entry.startTime, entry.endTime);
        const row = document.createElement('tr');
        const hasSupervisorNote = !!entry.supervisorNote;
        const isFixed = !!entry.feedbackFixed;
        
        let rowClass = 'hover:bg-surface-hover transition-colors group';
        if (hasSupervisorNote) {
            rowClass = isFixed 
                ? 'green-row transition-all duration-200 group' 
                : 'magenta-row transition-all duration-200 group';
        }
        row.className = rowClass;

        let notesDisplay = entry.notes || '';
        if (entry.activityType === 'Unrestricted' && entry.unrestrictedActivityType) {
            notesDisplay = `[${entry.unrestrictedActivityType}] ${notesDisplay}`;
        }

        let combinedNotes = notesDisplay;
        if (hasSupervisorNote) {
            combinedNotes += `\n\n💬 [Supervisor Note]: ${entry.supervisorNote}`;
        }

        const typeBadgeClass = entry.activityType === 'Unrestricted' ? 'badge-purple' : 'badge-danger';

        let notesCellContent = notesDisplay;

        const fbStatus = getFeedbackStatus(entry);
        const hasFb = hasFeedback(entry);
        let feedbackCellContent = '';
        if (hasFb) {
            const fbConf = getFeedbackStatusConfig(fbStatus);
            const areas = entry.feedbackIssueAreas || [];
            const areaPreview = areas.length > 0 ? areas.slice(0, 2).map(getFeedbackIssueLabel).join(' \u2022 ') : '';
            const notePreview = entry.supervisorNote ? (entry.supervisorNote.length > 25 ? entry.supervisorNote.substring(0, 25) + '...' : entry.supervisorNote) : '';
            const previewText = [areaPreview, notePreview].filter(Boolean).join(': ');
            feedbackCellContent = `
                <div class="text-left space-y-0.5">
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${fbConf.bg} ${fbConf.text}"><i class="ph-fill ph-${fbConf.icon}"></i> ${fbConf.label}</span>
                    ${previewText ? `<p class="text-[10px] ${fbConf.text} opacity-70 truncate max-w-[140px]">${previewText}</p>` : ''}
                </div>
            `;
        }

        row.innerHTML = `
            <td class="px-4 py-3 font-medium text-text">${dayjs(entry.date).format('MMM D, YYYY')}</td>
            <td class="px-4 py-3 text-text-muted text-xs">${dayjs('1970-01-01T' + entry.startTime).format('h:mm A')} - ${dayjs('1970-01-01T' + entry.endTime).format('h:mm A')}</td>
            <td class="px-4 py-3 font-bold text-text">${totalHours.toFixed(2)}</td>
            <td class="px-4 py-3 text-text-muted">${entry.clientName || '-'}</td>
            <td class="px-4 py-3"><span class="badge ${typeBadgeClass}">${entry.activityType}</span></td>
            <td class="px-4 py-3 text-text-muted text-xs hidden sm:table-cell">${entry.activityType === 'Unrestricted' ? (entry.unrestrictedActivityType || 'General') : '-'}</td>
            <td class="px-4 py-3 text-text-muted text-xs max-w-[150px] truncate" title="${entry.supervisionType}">${entry.supervisionType}</td>
            <td class="px-4 py-3 text-text-muted">${entry.supervisorName || '-'}</td>
            <td class="note-cell px-4 py-3 text-text-muted text-xs hidden md:table-cell max-w-xs truncate cursor-pointer hover:text-white transition-all duration-200" data-has-feedback="${hasSupervisorNote}" data-feedback="${(entry.supervisorNote || '').replace(/"/g, '&quot;')}" data-notes="${notesDisplay.replace(/"/g, '&quot;')}" title="${hasSupervisorNote ? 'Click to read supervisor note' : 'Click to view full note'}">${notesCellContent}</td>
            <td class="feedback-cell px-4 py-3 text-center cursor-pointer" data-id="${entry.id}" data-fixed="${isFixed}" data-feedback="${(entry.supervisorNote || '').replace(/"/g, '&quot;')}">${feedbackCellContent}</td>
            <td class="px-4 py-3 text-right flex justify-end gap-1">
                <button class="duplicate-btn p-2 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text transition-colors" data-id="${entry.id}" title="Duplicate">
                    <i class="ph-bold ph-copy"></i>
                </button>
                <button class="edit-btn p-2 rounded-lg hover:bg-surface-hover text-accent transition-colors" data-id="${entry.id}" title="Edit">
                    <i class="ph-bold ph-pencil-simple"></i>
                </button>
            </td>
        `;
        tableBodyElement.appendChild(row);
    });
};

const updateMonthlyView = () => {
    const selectedMonth = monthSelector.value;
    if (!selectedMonth) return;
    const [year, month] = selectedMonth.split('-');
    const monthlyEntries = allEntries.filter(e => {
        const d = dayjs(e.date);
        return d.year() == year && (d.month() + 1) == month;
    });
    const allTimeTotal = calculateSummaryData(allEntries).total;
    const summaryData = calculateSummaryData(monthlyEntries);
    monthlySummaryGrid.innerHTML = createSummaryHTML(summaryData, allTimeTotal, true);
    updateAlerts(summaryData, 'monthly-alerts');
    renderTable(monthlyEntries, logTableBody);
    renderMfvfWorkflowStatus(selectedMonth, monthlyEntries);
};

const getMfvfVerificationRef = (traineeId, month) => doc(db, `users/${traineeId}/verifications/${month}`);

const getMfvfStatusConfig = (status) => {
    const normalized = status || 'not_started';
    const config = {
        not_started: ['Not Started', 'text-slate-300', 'bg-slate-500/10 border-white/10', 'ph ph-file-plus'],
        draft: ['Draft', 'text-blue-300', 'bg-blue-500/10 border-blue-500/20', 'ph ph-pencil-simple'],
        submitted: ['Sent to Supervisor', 'text-amber-300', 'bg-amber-500/10 border-amber-500/25', 'ph ph-paper-plane-tilt'],
        changes_requested: ['Changes Requested', 'text-orange-300', 'bg-orange-500/10 border-orange-500/25', 'ph ph-warning-circle'],
        signed: ['Signed & Returned', 'text-green-300', 'bg-green-500/10 border-green-500/25', 'ph ph-check-circle'],
        rejected: ['Rejected', 'text-red-300', 'bg-red-500/10 border-red-500/25', 'ph ph-x-circle']
    };
    return config[normalized] || config.not_started;
};


const FEEDBACK_ISSUE_AREAS = [
    { id: 'supervisor', label: 'Supervisor' },
    { id: 'activity_type', label: 'Type of Activity' },
    { id: 'restricted_type', label: 'Restricted/Unrestricted Type' },
    { id: 'hours_time', label: 'Hours/Time' },
    { id: 'client', label: 'Client' },
    { id: 'supervision_status', label: 'Supervision Status' },
    { id: 'observation', label: 'Observation' },
    { id: 'notes', label: 'Notes' },
    { id: 'duplicate', label: 'Duplicate Entry' },
    { id: 'missing_info', label: 'Missing Information' },
    { id: 'other', label: 'Other' }
];

const getFeedbackIssueLabel = (id) => FEEDBACK_ISSUE_AREAS.find(a => a.id === id)?.label || id;

const getFeedbackStatusConfig = (status) => {
    const map = {
        pending: { label: 'Pending', color: 'pink', icon: 'envelope', bg: 'bg-pink-500/15', text: 'text-pink-400' },
        read: { label: 'Read', color: 'yellow', icon: 'eye', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
        resolved: { label: 'Resolved', color: 'green', icon: 'check-circle', bg: 'bg-green-500/15', text: 'text-green-400' },
        deleted: { label: 'Entry Deleted', color: 'slate', icon: 'trash', bg: 'bg-slate-500/15', text: 'text-slate-400' },
        entry_deleted: { label: 'Entry Deleted', color: 'slate', icon: 'trash', bg: 'bg-slate-500/15', text: 'text-slate-400' }
    };
    return map[status] || map.pending;
};

const hasFeedback = (entry) => !!(entry.supervisorNote || (entry.feedbackIssueAreas && entry.feedbackIssueAreas.length > 0));

const getFeedbackStatus = (entry) => {
    if (entry.feedbackStatus === 'entry_deleted' || entry.feedbackStatus === 'deleted') return entry.feedbackStatus;
    if (entry.feedbackStatus) return entry.feedbackStatus;
    if (!hasFeedback(entry)) return null;
    if (entry.feedbackFixed) return 'resolved';
    return 'pending';
};

const renderFeedbackIssueBadges = (areas) => {
    if (!areas || areas.length === 0) return '';
    return areas.map(a => `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/8 text-slate-300 border border-white/8">${getFeedbackIssueLabel(a)}</span>`).join(' ');
};
const renderMfvfWorkflowStatus = async (month, entries) => {
    const panel = document.getElementById('mfvf-workflow-status');
    if (!panel || !userId || userId === 'guest' || !month) return;

    try {
        const snap = await getDoc(getMfvfVerificationRef(userId, month));
        const request = snap.exists() ? snap.data() : null;
        const [label, textClass, boxClass, icon] = getMfvfStatusConfig(request?.status);
        const supervisorLabel = request?.supervisorName ? `Supervisor: ${request.supervisorName}` : 'Choose a supervisor and send this month for review.';
        const signedLine = request?.status === 'signed'
            ? `<p class="text-xs text-green-300 mt-1">Signed by ${request.supervisorSignatureName || request.supervisorName || 'Supervisor'} on ${dayjs(request.signedAt).format('MMM D, YYYY h:mm A')}.</p>`
            : '';
        const changesLine = request?.status === 'changes_requested' && request?.supervisorComments
            ? `<p class="text-xs text-orange-200 mt-1">Supervisor note: ${request.supervisorComments}</p>`
            : '';

        panel.innerHTML = `
            <div class="rounded-2xl border ${boxClass} p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${textClass}">
                        <i class="${icon} text-xl"></i>
                    </div>
                    <div>
                        <p class="text-xs uppercase tracking-widest font-bold ${textClass}">M-FVF Status: ${label}</p>
                        <p class="text-sm text-text mt-1">${dayjs(month).format('MMMM YYYY')} • ${entries.length} logged activities</p>
                        <p class="text-xs text-text-muted mt-1">${supervisorLabel}</p>
                        ${signedLine}
                        ${changesLine}
                    </div>
                </div>
                <button id="open-mfvf-workflow-btn" class="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors flex items-center gap-2 justify-center">
                    <i class="ph ph-file-pdf"></i>${request?.status === 'signed' ? 'View / Download' : request?.status === 'submitted' ? 'View Request' : 'Prepare Form'}
                </button>
            </div>
        `;
        panel.classList.remove('hidden');

        document.getElementById('open-mfvf-workflow-btn')?.addEventListener('click', openMfvfWorkflowModal);
    } catch (error) {
        console.error("Error loading M-FVF workflow status:", error);
        panel.classList.add('hidden');
    }
};

const updateYearlyView = () => {
    const selectedYear = yearSelector.value;
    if (!selectedYear) return;
    const yearlyEntries = allEntries.filter(e => dayjs(e.date).year() == selectedYear);
    const allTimeTotal = calculateSummaryData(allEntries).total;
    const summaryData = calculateSummaryData(yearlyEntries);
    yearlySummaryGrid.innerHTML = createSummaryHTML(summaryData, allTimeTotal);
    updateAlerts(summaryData, 'yearly-alerts');
    renderTable(yearlyEntries, yearlyLogTableBody);
};

const updateAllTimeView = () => {
    const summary = calculateSummaryData(allEntries);
    allTimeSummaryGrid.innerHTML = createSummaryHTML(summary, summary.total);
    updateAlerts(summary, 'all-time-alerts');
    renderTable(allEntries, allTimeLogTableBody);
    renderAllTimeCharts(allEntries);
};

// --- Chart Rendering ---
const renderAllTimeCharts = (entries) => {
    Object.values(chartInstances).forEach(chart => chart.destroy());
    if (entries.length === 0) return;

    const isConcentrated = profileData.fieldworkType === 'Concentrated';
    const totalGoal = isConcentrated ? 1500 : 2000;
    const restrictedGoal = totalGoal * 0.4;
    const unrestrictedGoal = totalGoal * 0.6;

    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const startDate = dayjs(sortedEntries[0].date).startOf('month');
    const today = dayjs().startOf('month');
    let monthSpan = today.diff(startDate, 'month') + 1;
    monthSpan = Math.max(1, monthSpan);
    const totalMonths = Math.min(monthSpan, 36);

    const labels = [];
    for (let i = 0; i < totalMonths; i++) {
        labels.push(startDate.add(i, 'month').format('MMM YY'));
    }

    let dataTotal = new Array(totalMonths).fill(0);
    let dataRestricted = new Array(totalMonths).fill(0);
    let dataUnrestricted = new Array(totalMonths).fill(0);

    entries.forEach(entry => {
        const entryDate = dayjs(entry.date);
        const monthIndex = entryDate.diff(startDate, 'month');
        if (monthIndex < 0 || monthIndex >= totalMonths) return;
        const hours = calculateHours(entry.startTime, entry.endTime);
        dataTotal[monthIndex] += hours;
        if (entry.activityType === 'Restricted') dataRestricted[monthIndex] += hours;
        else dataUnrestricted[monthIndex] += hours;
    });

    for (let i = 1; i < totalMonths; i++) {
        dataTotal[i] += dataTotal[i - 1];
        dataRestricted[i] += dataRestricted[i - 1];
        dataUnrestricted[i] += dataUnrestricted[i - 1];
    }

    const commonOptions = (goal) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#94a3b8' },
                suggestedMax: goal
            },
            x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        },
        elements: { point: { radius: 0, hitRadius: 10, hoverRadius: 4 } }
    });

    const createChart = (ctx, label, data, color, goal) => {
        if (!ctx) return null;
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: color + '20', // Hex alpha
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }]
            },
            options: commonOptions(goal)
        });
    };

    chartInstances.total = createChart(chartContexts.total, 'Total', dataTotal, '#3b82f6', totalGoal);
    chartInstances.restricted = createChart(chartContexts.restricted, 'Restricted', dataRestricted, '#ec4899', restrictedGoal);
    chartInstances.unrestricted = createChart(chartContexts.unrestricted, 'Unrestricted', dataUnrestricted, '#a855f7', unrestrictedGoal);
};

// --- Data Handling ---
const handleSaveEntry = async () => {
    const entryId = document.getElementById('entry-id').value;
    const entryData = {
        date: document.getElementById('date').value,
        startTime: document.getElementById('start-time').value,
        endTime: document.getElementById('end-time').value,
        setting: document.getElementById('setting').value,
        activityType: activityTypeSelect.value,
        unrestrictedActivityType: unrestrictedTypeSelect.value,
        supervisionType: document.getElementById('supervision-type').value,
        supervisorName: document.getElementById('supervisor-select').value,
        clientPresent: document.getElementById('client-present').value,
        clientName: document.getElementById('client-name').value,
        notes: document.getElementById('notes').value,
    };

    if (entryId) { // Update
        if (userId === 'guest') {
            const index = allEntries.findIndex(e => e.id === entryId);
            if (index > -1) {
                allEntries[index] = { ...allEntries[index], ...entryData };
                saveEntriesToLocalStorage();
                switchView(document.querySelector('.view-btn.bg-white\\/10').dataset.view);
            }
        } else {
            try {
                const docRef = doc(db, `users/${userId}/entries`, entryId);
                await updateDoc(docRef, entryData);
            } catch (error) { console.error("Error updating doc:", error); }
        }
    } else { // Create
        if (userId === 'guest') {
            entryData.id = crypto.randomUUID();
            allEntries.push(entryData);
            saveEntriesToLocalStorage();
            switchView(document.querySelector('.view-btn.bg-white\\/10').dataset.view);
        } else {
            entryData.userId = userId;
            try {
                const entriesRef = collection(db, `users/${userId}/entries`);
                await addDoc(entriesRef, entryData);
            } catch (error) { console.error("Error adding document:", error); }
        }
    }
    closeSlideOver();
};

const handleDeleteEntry = async () => {
    const entryId = document.getElementById('entry-id').value;
    if (!entryId || !(await CustomModal.confirm("Delete this entry permanently?", "Confirm Deletion"))) return;

    if (userId === 'guest') {
        allEntries = allEntries.filter(e => e.id !== entryId);
        saveEntriesToLocalStorage();
        switchView(document.querySelector('.view-btn.bg-white\\/10').dataset.view);
    } else {
        try {
            const entry = allEntries.find(e => e.id === entryId);
            if (entry && hasFeedback(entry)) {
                const snapshot = { date: entry.date, startTime: entry.startTime, endTime: entry.endTime, clientName: entry.clientName, activityType: entry.activityType, unrestrictedActivityType: entry.unrestrictedActivityType, supervisionType: entry.supervisionType, supervisorName: entry.supervisorName, notes: entry.notes };
                await updateDoc(doc(db, `users/${userId}/entries`, entryId), {
                    feedbackStatus: 'entry_deleted',
                    feedbackDeletedAt: new Date().toISOString(),
                    feedbackEntrySnapshot: entry.feedbackEntrySnapshot || snapshot,
                    entryDeleted: true
                });
            } else {
                await deleteDoc(doc(db, `users/${userId}/entries`, entryId));
            }
        } catch (error) { console.error("Error deleting doc:", error); }
    }
    closeSlideOver();
};

const handleTableClick = async (e) => {
    // Handle Click on Feedback Cell
    const feedbackCell = e.target.closest('.feedback-cell');
    if (feedbackCell) {
        const entryId = feedbackCell.dataset.id;
        if (!entryId) return;

        let entry = allEntries.find(en => en.id === entryId);
        if (!entry && selectedTraineeId && supervisorCache.entries[selectedTraineeId]) {
            entry = supervisorCache.entries[selectedTraineeId].find(en => en.id === entryId);
        }
        if (!entry || !hasFeedback(entry)) return;

        if (profileData.role === 'supervisor') {
            openFeedbackDetailModal(entry, false);
        } else {
            openFeedbackDetailModal(entry, true);
        }
        return;
    }

    // Handle Click on Note Cell
    const noteCell = e.target.closest('.note-cell');
    if (noteCell) {
        const traineeNote = noteCell.dataset.notes || noteCell.textContent;
        if (traineeNote && traineeNote.trim()) {
            CustomModal.alert(traineeNote, "Activity Notes", "ph-note-blank");
        }
        return;
    }

    // Handle Click on Add/Edit Supervisor Note button
    const addSupNoteBtn = e.target.closest('.add-supervisor-note-btn');
    if (addSupNoteBtn) {
        const entryId = addSupNoteBtn.dataset.id;

        if (selectedTraineeId) {
            const cached = supervisorCache.entries[selectedTraineeId];
            const entry = cached ? cached.find(x => x.id === entryId) : null;
            const existing = {
                issueAreas: entry?.feedbackIssueAreas || [],
                note: entry?.supervisorNote || '',
                requestedAction: entry?.feedbackRequestedAction || '',
                otherText: entry?.feedbackOtherText || ''
            };
            const result = await openSupervisorFeedbackModal(existing);
            if (result) {
                const entryRef = doc(db, `users/${selectedTraineeId}/entries/${entryId}`);
                try {
                    const isNew = !existing.note.trim() && !existing.issueAreas.length;
                    const entrySnapshot = entry ? { date: entry.date, startTime: entry.startTime, endTime: entry.endTime, clientName: entry.clientName, activityType: entry.activityType, unrestrictedActivityType: entry.unrestrictedActivityType, supervisionType: entry.supervisionType, supervisorName: entry.supervisorName, notes: entry.notes } : {};
                    const updateData = {
                        supervisorNote: result.note,
                        feedbackIssueAreas: result.issueAreas,
                        feedbackRequestedAction: result.requestedAction || '',
                        feedbackOtherText: result.otherText || '',
                        feedbackStatus: entry?.feedbackStatus === 'resolved' ? 'pending' : (entry?.feedbackStatus || 'pending'),
                        feedbackFixed: false,
                        updatedAt: new Date().toISOString()
                    };
                    if (isNew) {
                        updateData.feedbackSentAt = new Date().toISOString();
                        updateData.feedbackEntrySnapshot = entrySnapshot;
                    }
                    await updateDoc(entryRef, updateData);
                    if (cached) {
                        const idx = cached.findIndex(x => x.id === entryId);
                        if (idx !== -1) Object.assign(cached[idx], updateData);
                    }
                    await refreshCurrentMonth();
                } catch (error) {
                    console.error("Error saving supervisor feedback:", error);
                    await CustomModal.alert("Failed to save feedback: " + error.message, "Error");
                }
            }
        }
        return;
    }

    // Handle Click on Delete Supervisor Note button
    const deleteSupNoteBtn = e.target.closest('.delete-supervisor-note-btn');
    if (deleteSupNoteBtn) {
        const entryId = deleteSupNoteBtn.dataset.id;

        if (selectedTraineeId) {
            const confirmed = await CustomModal.confirm(
                "Are you sure you want to delete your feedback for this entry? This will also remove it from the trainee's page.",
                "Delete Supervisor Feedback"
            );
            if (confirmed) {
                const entryRef = doc(db, `users/${selectedTraineeId}/entries/${entryId}`);
                try {
                    await updateDoc(entryRef, {
                        supervisorNote: "", feedbackSentAt: "", feedbackIssueAreas: [],
                        feedbackRequestedAction: "", feedbackOtherText: "",
                        feedbackStatus: "", feedbackFixed: false, traineeResponse: "",
                        feedbackEntrySnapshot: {}
                    });
                    const cached = supervisorCache.entries[selectedTraineeId];
                    if (cached) {
                        const idx = cached.findIndex(x => x.id === entryId);
                        if (idx !== -1) {
                            cached[idx].supervisorNote = ''; cached[idx].feedbackSentAt = '';
                            cached[idx].feedbackIssueAreas = []; cached[idx].feedbackStatus = '';
                            cached[idx].feedbackFixed = false; cached[idx].traineeResponse = '';
                        }
                    }
                    await refreshCurrentMonth();
                } catch (error) {
                    console.error("Error deleting supervisor feedback:", error);
                    await CustomModal.alert("Failed to delete feedback: " + error.message, "Error");
                }
            }
        }
        return;
    }

    // Handle Duplicate
    const dupBtn = e.target.closest('.duplicate-btn');
    if (dupBtn) {
        const entryId = dupBtn.dataset.id;
        const entry = allEntries.find(item => item.id === entryId);
        if (entry) {
            openSlideOver('edit', entry);
            // Convert to "New Entry" mode by clearing ID
            document.getElementById('entry-id').value = '';
            document.getElementById('slide-over-title').textContent = 'Duplicate Activity';
        }
        return;
    }

    // Handle Edit
    const btn = e.target.closest('.edit-btn');
    if (!btn) return;
    const entryId = btn.dataset.id;
    const entry = allEntries.find(item => item.id === entryId);
    if (entry) openSlideOver('edit', entry);
};

const handleGuestLogin = async () => {
    // alert("Guest Login Clicked! Attempting to load dashboard...");
    console.log("App.js: Guest login started");
    try {
        if (!appContainer) throw new Error("appContainer element not found");
        if (!loginView) throw new Error("loginView element not found");

        loginErrorMessage.classList.add('hidden');
        userId = 'guest';

        // 1. Hide Login
        console.log("App.js: Hiding login view");
        loginView.classList.add('hidden');

        // 2. Load Data first to check profile settings
        console.log("App.js: Loading local storage data");
        loadDataFromLocalStorage();

        // 3. Update UI identity
        userDisplay.textContent = 'Guest User';

        // 4. Route based on role existence
        if (!profileData.role) {
            console.log("App.js: Guest has no role selected yet, directing to role selection screen");
            if (appContainer) appContainer.classList.add('hidden');
            if (roleSelectionView) roleSelectionView.classList.remove('hidden');
        } else {
            console.log("App.js: Guest role loaded:", profileData.role);
            if (roleSelectionView) roleSelectionView.classList.add('hidden');
            if (appContainer) appContainer.classList.remove('hidden');
            setupUIByRole(profileData.role);
            if (profileData.role === 'trainee') setupTraineeListeners();
            else setupSupervisorListeners();
            await switchView('monthly');
        }

        console.log("App.js: Guest login complete");
    } catch (e) {
        console.error("App.js: Guest login failed:", e);
        await CustomModal.alert("Login Error: " + e.message, "Login Error");
        // Attempt recovery
        loginView.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }
};

const handleLogout = async () => {
    if (userId === 'guest') {
        userId = null;
        appContainer.classList.add('hidden');
        loginView.classList.remove('hidden');
        allEntries = [];
        profileData = { name: '', rbtNumber: '', supervisors: [] };
    } else {
        try { await signOut(auth); } catch (error) { console.error("Sign-out error", error); }
    }
};

// --- AI Note Assistant Helpers ---
const callGemini = async (apiKey, prompt) => {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to call Gemini API');
    }
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text;
};

const handleAiAssist = async () => {
    if (!geminiApiKey) {
        await CustomModal.alert("✨ AI Assist requires a Gemini API Key!\n\nPlease open Settings (gear icon) and add your key in the 'AI Note Assistant' section.", "API Key Required");
        openSettingsPanel();
        return;
    }

    const clientName = document.getElementById('client-name')?.value.trim() || 'Client A';
    const setting = document.getElementById('setting')?.value || 'Clinic';
    const startTime = document.getElementById('start-time')?.value || '';
    const endTime = document.getElementById('end-time')?.value || '';
    const supervisionType = document.getElementById('supervision-type')?.value || 'Unsupervised';
    const supervisorName = document.getElementById('supervisor-select')?.value || '';
    const isUnrestricted = activityTypeRadios && activityTypeRadios[1] ? activityTypeRadios[1].checked : false;
    const unrestrictedCategory = unrestrictedTypeSelect ? unrestrictedTypeSelect.value : '';

    const durationHrs = calculateHours(startTime, endTime);
    const durationText = durationHrs > 0 ? `${durationHrs.toFixed(2)} hours` : "N/A";

    const notesField = document.getElementById('notes');
    if (!notesField) return;

    let currentVal = notesField.value.trim();
    let promptText = "";

    if (isUnrestricted) {
        // --- UNRESTRICTED HOURS PROMPT ---
        let rawNotes = currentVal;
        if (!rawNotes) {
            const inputPrompt = await CustomModal.prompt("Enter raw details of what you did (e.g., looked at graphs, updated BIP, trained staff):", "e.g., analyzed graph data, reviewed BIP criteria, etc.", "Clinical Work Details");
            if (!inputPrompt || !inputPrompt.trim()) return;
            rawNotes = inputPrompt.trim();
        }

        promptText = `Act as an expert Board Certified Behavior Analyst (BCBA) supervisor. Help me write a professional, audit-proof BACB fieldwork activity note for my UNRESTRICTED hours. 

Here are the details of my activity:
- Client Pseudonym/Initials: ${clientName || 'N/A'}
- Category of Unrestricted Work: ${unrestrictedCategory || 'Data Analysis / Clinical Task'}
- Exact Duration: ${durationText}
- Raw details of what I did: ${rawNotes}

Based on this information, please generate a structured note that includes:
1. A concise, professional summary of the behavior-analytic activity.
2. Active, analytical verbs (e.g., analyzed, designed, evaluated, formulated, synthesized) to reflect high-level clinical oversight.
3. The specific BACB Task List item (6th Edition) that best aligns with this unrestricted activity.

Keep the final note completely objective, concise, formatted perfectly, with no conversational preamble or quotes. Just plain text.`;
    } else {
        // --- RESTRICTED HOURS PROMPT (RBT → BCBA Intern Conversion) ---
        let rawNotes = currentVal;

        if (!rawNotes) {
            const inputPrompt = await CustomModal.prompt("Paste your original RBT session note here to convert it into a BCBA intern unrestricted fieldwork note:", "e.g., The RBT supported the student during transitions by implementing DRA...", "Original RBT Session Note");
            if (!inputPrompt || !inputPrompt.trim()) return;
            rawNotes = inputPrompt.trim();
        }

        promptText = `You are an expert in ABA documentation and BACB fieldwork requirements. Your task is to convert the following RBT session note into a BCBA intern unrestricted fieldwork note that is appropriate for BACB documentation.

Follow these rules exactly:

1. Replace all references to "RBT" with "intern."
2. Rewrite the note from the perspective of the intern engaging in behavior-analytic activities. The note should reflect unrestricted fieldwork experiences and demonstrate application of ABA principles.
3. Maintain the original facts and sequence of events from the RBT note. Do not invent activities, assessments, meetings, analyses, or interventions that were not described.
4. Use professional, objective language similar to BACB fieldwork examples. Avoid casual wording.
5. Highlight the behavior-analytic components of the activities when appropriate, including:
   - Differential reinforcement procedures
   - Antecedent interventions
   - Functional communication training (FCT)
   - Environmental modifications
   - Skill acquisition procedures
   - Behavior skills training
   - Prompting and prompt fading
   - Reinforcement systems
   - Self-management strategies
   - Data-based decision making
   - Collaboration related to treatment implementation
   - Safety procedures outlined in intervention plans
6. Do not describe the intern as merely "assisting," "helping," or "shadowing." The intern should be portrayed as actively implementing, facilitating, observing, or evaluating behavior-analytic procedures.
7. Avoid excessive detail. Notes should generally consist of 2–3 concise paragraphs and remain suitable for BACB fieldwork documentation.
8. Use ABA terminology accurately, but keep the language natural and readable.
9. Conclude every note with the single most appropriate BACB Task List (6th Ed.) Item based on the primary unrestricted activity demonstrated in the note.

Format your response exactly as follows (no preamble, no quotes, no markdown, just the note):

[Paragraph 1]

[Paragraph 2]

[Optional Paragraph 3 if needed]

BACB Task List (6th Ed.) Item: [Code] [Title]

---
Original RBT Note to Convert:
${rawNotes}`;
    }

    // Set UI to loading state
    aiAssistBtn.disabled = true;
    const origBtnHtml = aiAssistBtn.innerHTML;
    aiAssistBtn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Generating...`;
    notesField.classList.add('ai-loading-glow');
    notesField.disabled = true;

    try {
        const resultText = await callGemini(geminiApiKey, promptText);
        if (resultText) {
            let cleanedText = resultText.trim();
            // Remove enclosing quotes if returned
            if (cleanedText.startsWith('"') && cleanedText.endsWith('"')) {
                cleanedText = cleanedText.slice(1, -1);
            }
            // Remove markdown code blocks if returned
            if (cleanedText.startsWith('```')) {
                cleanedText = cleanedText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
            }
            cleanedText = cleanedText.trim();

            // Save original notes in memory
            originalNotes = notesField.value;
            // Inject polished text
            notesField.value = cleanedText;
            // Show Undo / Accept Bar
            if (aiUndoBar) aiUndoBar.classList.remove('hidden');
        } else {
            await CustomModal.alert("Sorry, Gemini returned an empty response. Please try again.", "Empty Response");
        }
    } catch (e) {
        console.error("AI Assist error:", e);
        await CustomModal.alert("AI Assist failed: " + e.message, "AI Assist Failed");
    } finally {
        // Reset loading states
        aiAssistBtn.disabled = false;
        aiAssistBtn.innerHTML = origBtnHtml;
        notesField.classList.remove('ai-loading-glow');
        notesField.disabled = false;
    }
};

const saveProfile = async (e) => {
    e.preventDefault();
    const saveBtn = profileForm.querySelector('button[type="submit"]');
    saveBtn.textContent = 'Saving...';

    const name = document.getElementById('trainee-name').value;
    const rbtNumber = document.getElementById('rbt-number').value;
    const fieldworkType = document.getElementById('fieldwork-type').value;

    profileData.name = name;
    profileData.rbtNumber = rbtNumber;
    profileData.fieldworkType = fieldworkType;

    if (userId === 'guest') {
        saveProfileToLocalStorage();
        saveBtn.textContent = 'Saved!';
        // Refresh view to show new goals
        const activeView = document.querySelector('.view-btn.bg-white\\/10')?.dataset.view || 'monthly';
        switchView(activeView);
    } else {
        const profileRef = doc(db, `users/${userId}`);
        try {
            const email = auth.currentUser.email;
            await setDoc(profileRef, { name, rbtNumber, fieldworkType, email }, { merge: true });
            saveBtn.textContent = 'Saved!';
        } catch (error) { console.error("Error saving profile:", error); }
    }
    setTimeout(() => saveBtn.textContent = 'Save Profile', 2000);
};

// --- PDF/CSV Generation (Simplified for brevity, logic remains similar) ---
// Note: Keeping existing logic but ensuring it uses new data structures if needed.
// For now, reusing the previous logic structure but cleaning up.

const generateMfvfPdf = async (entries, supervisor, monthStr, isSigned) => {
    const doc = new jsPDF();
    const summary = calculateSummaryData(entries);
    const monthName = dayjs(monthStr).format('MMMM YYYY');

    // Header
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text("Monthly Fieldwork Verification Form", 105, 20, { align: 'center' });

    // Verification Status
    if (isSigned) {
        doc.setDrawColor(0, 150, 0);
        doc.setLineWidth(0.5);
        doc.rect(140, 25, 60, 15);
        doc.setFontSize(12);
        doc.setTextColor(0, 120, 0);
        doc.text("DIGITALLY VERIFIED", 170, 32, { align: 'center' });
        doc.setFontSize(8);
        doc.text("Verified via Fieldly Portal", 170, 37, { align: 'center' });
    }

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Trainee: ${profileData.name || 'N/A'}`, 20, 40);
    doc.text(`Supervisor: ${supervisor ? supervisor.name : 'N/A'} (Cert: ${supervisor ? supervisor.cert : 'N/A'})`, 20, 48);
    doc.text(`Month: ${monthName}`, 20, 56);

    const formatDuration = (hours) => {
        const h = Math.floor(hours);
        const m = Math.round((hours % 1) * 60);
        return `${h}h ${m}m`;
    };

    // Summary Table
    const summaryRows = [
        ["Total Duration", formatDuration(summary.total)],
        ["Restricted Duration", formatDuration(summary.restricted)],
        ["Unrestricted Duration", formatDuration(summary.unrestricted)],
        ["Supervised Duration", formatDuration(summary.supervised)],
        ["Supervision %", `${summary.percentage.toFixed(1)}%`],
        ["Observation Duration", `${Math.round(summary.observationMinutes)} min`],
        ["Unsupervised Duration", formatDuration(summary.unsupervised)]
    ];

    doc.autoTable({
        startY: 65,
        head: [['Metric', 'Value']],
        body: summaryRows,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
    });

    // Entries Table - Sort by date and time
    const sortedEntries = [...entries].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        // If same date, sort by start time
        return a.startTime.localeCompare(b.startTime);
    });

    const tableData = sortedEntries.map(e => {
        // Combine session notes with unrestricted type if applicable
        let notesColumn = e.notes || '';
        if (e.activityType === 'Unrestricted' && e.unrestrictedActivityType) {
            notesColumn = `[${e.unrestrictedActivityType}] ${notesColumn}`;
        }

        return [
            dayjs(e.date).format('MM/DD'),
            e.startTime,
            e.endTime,
            calculateHours(e.startTime, e.endTime).toFixed(2),
            e.setting || '-',
            e.activityType,
            e.supervisionType,
            e.unrestrictedActivityType || '-',
            e.supervisorName || '-',
            e.clientPresent || '-',
            e.clientName || '-',
            notesColumn
        ];
    });

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 10,
        head: [['Date', 'Start', 'End', 'Hours', 'Setting', 'Type', 'Supervision', 'Unrestricted Type', 'Supervisor', 'Client Present', 'Client', 'Session Notes/Unrestricted Activities Explanations']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [71, 85, 105] },
        styles: { fontSize: 7, cellPadding: 1.5 },
        columnStyles: {
            0: { cellWidth: 12 }, // Date
            1: { cellWidth: 12 }, // Start
            2: { cellWidth: 12 }, // End
            3: { cellWidth: 10 }, // Hours
            4: { cellWidth: 12 }, // Setting
            5: { cellWidth: 15 }, // Type
            6: { cellWidth: 15 }, // Supervision
            7: { cellWidth: 18 }, // Unrestricted Type
            8: { cellWidth: 18 }, // Supervisor
            9: { cellWidth: 12 }, // Client Present
            10: { cellWidth: 15 }, // Client
            11: { cellWidth: 'auto' } // Notes - takes remaining space
        }
    });

    // Show Preview
    const pdfUrl = doc.output('bloburl');
    pdfIframe.src = pdfUrl;
    currentPdfDoc = doc;
    currentPdfFilename = `MFVF_${profileData.name || 'Trainee'}_${monthStr}.pdf`;
    pdfPreviewModal.classList.remove('hidden');
};

const buildMfvfPayload = async (selectedMonth, supervisor, status = 'draft') => {
    const [year, month] = selectedMonth.split('-');
    const entries = allEntries.filter(e => {
        const d = dayjs(e.date);
        return d.year() == year && (d.month() + 1) == month;
    });
    const summary = calculateSummaryData(entries);
    const state = document.getElementById('mfvf-state-input')?.value?.trim() || '';
    const country = document.getElementById('mfvf-country-input')?.value?.trim() || 'United States';
    const traineeNote = document.getElementById('mfvf-trainee-note-input')?.value?.trim() || '';

    let supervisorUid = supervisor.uid || '';
    if (!supervisorUid && supervisor.email) {
        try {
            const q = query(collection(db, 'users'), where('email', '==', supervisor.email.trim()), where('role', '==', 'supervisor'));
            const snap = await getDocs(q);
            if (!snap.empty) supervisorUid = snap.docs[0].id;
        } catch (error) {
            console.error("Error resolving supervisor UID for M-FVF:", error);
        }
    }

    return {
        status,
        month: selectedMonth,
        monthLabel: dayjs(selectedMonth).format('MMMM YYYY'),
        traineeId: userId,
        traineeName: profileData.name || auth.currentUser?.displayName || 'Trainee',
        traineeEmail: profileData.email || auth.currentUser?.email || '',
        bacbId: profileData.rbtNumber || '',
        supervisorUid,
        supervisorName: supervisor.name || '',
        supervisorEmail: supervisor.email || '',
        supervisorCert: supervisor.cert || '',
        traineeNote,
        formData: {
            state,
            country,
            independentHours: summary.unsupervised,
            supervisedHours: summary.supervised,
            totalHours: summary.total,
            restrictedHours: summary.restricted,
            unrestrictedHours: summary.unrestricted,
            observationMinutes: summary.observationMinutes,
            supervisionPercentage: summary.percentage,
            individualSupervision: summary.individualSupervision,
            groupSupervision: summary.groupSupervision
        },
        entryCount: entries.length,
        updatedAt: new Date().toISOString()
    };
};

const showPdfSendToast = (message = "M-FVF has been sent") => {
    if (!pdfSendToast) return;
    pdfSendToast.textContent = message;
    pdfSendToast.classList.remove('hidden');
    clearTimeout(showPdfSendToast.timer);
    showPdfSendToast.timer = setTimeout(() => {
        pdfSendToast.classList.add('hidden');
    }, 3200);
};

const askDownloadBeforeMfvfUpload = () => {
    return new Promise((resolve) => {
        const isLight = document.body.classList.contains('light-mode');
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/70 backdrop-blur-md modal-fade-in p-4';

        const cardBg = isLight ? 'bg-white' : 'rgba(15, 23, 42, 0.92)';
        const borderCol = isLight ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.12)';
        const textTitle = isLight ? 'text-slate-900' : 'text-white';
        const textBody = isLight ? 'text-slate-600' : 'text-slate-300';
        const cancelBtnBg = isLight ? 'bg-slate-100 hover:bg-slate-200' : 'bg-white/5 hover:bg-white/10';
        const cancelBtnText = isLight ? 'text-slate-700' : 'text-white';

        modal.innerHTML = `
            <div class="p-6 rounded-2xl max-w-md w-full border transform modal-scale-up text-center"
                 style="background: ${cardBg}; border-color: ${borderCol}; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45); backdrop-filter: blur(25px);">
                <div class="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 text-emerald-300 text-xl">
                    <i class="ph-fill ph-download-simple"></i>
                </div>
                <h3 class="text-lg font-bold ${textTitle} mb-2">Download PDF First</h3>
                <p class="text-sm ${textBody} mb-6 leading-relaxed text-left">
                    To send the exact completed form to your supervisor, first use the PDF viewer's own download/save button.
                    Then click Download below and select the saved PDF file so FieldlyGo can upload it for your supervisor.
                </p>
                <div class="grid grid-cols-2 gap-3">
                    <button class="modal-cancel-btn w-full ${cancelBtnBg} ${cancelBtnText} font-semibold py-2.5 px-4 rounded-xl border border-white/10 transition-all">
                        Cancel
                    </button>
                    <button class="modal-download-btn w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                        Download
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const closeModal = (result) => {
            modal.classList.replace('modal-fade-in', 'modal-fade-out');
            modal.querySelector('.transform').classList.replace('modal-scale-up', 'modal-scale-down');
            setTimeout(() => {
                modal.remove();
                resolve(result);
            }, 200);
        };
        modal.querySelector('.modal-cancel-btn').addEventListener('click', () => closeModal(false));
        modal.querySelector('.modal-download-btn').addEventListener('click', () => closeModal(true));
    });
};

const chooseMfvfPdfFile = () => {
    return new Promise((resolve) => {
        const input = document.getElementById('mfvf-upload-input');
        if (!input) {
            resolve(null);
            return;
        }
        input.value = '';
        input.onchange = () => resolve(input.files?.[0] || null);
        input.click();
    });
};

const sendMfvfToSupervisor = async (options = {}) => {
    const selectedMonth = options.selectedMonth || monthSelector.value;
    const supName = options.supervisorName || mfvfSupervisorSelect?.value;
    const supervisor = profileData.supervisors?.find(s => s.name === supName);

    if (!supervisor) {
        await CustomModal.alert('Please select a supervisor.', 'Selection Required');
        return;
    }
    if (!userId || userId === 'guest') {
        await CustomModal.alert('Please sign in before sending a verification form.', 'Sign In Required');
        return;
    }
    if (!storage) {
        await CustomModal.alert('Firebase Storage is not ready yet. Please refresh and try again.', 'Storage Not Ready');
        return;
    }

    // Check if a draft PDF has been saved from the Download step
    let draftPdfUrl = '';
    let draftPdfPath = '';
    let draftPdfName = '';
    try {
        const snap = await getDoc(getMfvfVerificationRef(userId, selectedMonth));
        if (snap.exists()) {
            const data = snap.data();
            draftPdfUrl = data.draftPdfUrl || '';
            draftPdfPath = data.draftPdfPath || '';
            draftPdfName = data.draftPdfName || '';
        }
    } catch (e) {
        console.warn('Could not read draft PDF info:', e);
    }

    // If no draft PDF — prompt trainee to download first
    if (!draftPdfUrl) {
        const go = await CustomModal.confirm(
            'No saved form found for this month. Please click "Save to Cloud" first to generate and save your filled form, then send it to your supervisor.',
            'Save to Cloud Required'
        );
        if (go) {
            if (typeof window.openMfvfPdfViewer === 'function') window.openMfvfPdfViewer();
        }
        return;
    }

    const sendBtn = options.button || document.getElementById('mfvf-send-supervisor-btn');
    const originalBtnHtml = sendBtn?.innerHTML || 'Send';
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin text-sm"></i> Sending...';
    }

    try {
        const payload = await buildMfvfPayload(selectedMonth, supervisor, 'submitted');
        const submittedAt = new Date().toISOString();

        // Use the draft PDF that was already uploaded to Storage — no need to copy it
        const submittedPdfUrl = draftPdfUrl;
        const submittedPdfPath = draftPdfPath;

        payload.status = 'submitted';
        payload.traineeSubmittedAt = submittedAt;
        payload.submittedPdfPath = submittedPdfPath;
        payload.submittedPdfUrl = submittedPdfUrl;
        payload.submittedPdfName = draftPdfName;
        payload.submittedPdfUpdatedAt = submittedAt;
        payload.supervisorComments = '';
        payload.signedPdfPath = '';
        payload.signedPdfUrl = '';

        await setDoc(getMfvfVerificationRef(userId, selectedMonth), payload, { merge: true });

        if (payload.supervisorUid) {
            const chatRef = doc(db, `users/${userId}/chats/${payload.supervisorUid}`);
            const messagesRef = collection(db, `users/${userId}/chats/${payload.supervisorUid}/messages`);
            const text = `${payload.traineeName} sent the ${payload.monthLabel} M-FVF for review and signature.`;
            await setDoc(chatRef, {
                traineeName: payload.traineeName,
                traineeEmail: payload.traineeEmail,
                supervisorName: payload.supervisorName,
                supervisorEmail: payload.supervisorEmail,
                lastMessageText: text,
                lastMessageAt: serverTimestamp(),
                lastSenderId: userId
            }, { merge: true });
            await addDoc(messagesRef, {
                text,
                senderId: userId,
                senderName: payload.traineeName,
                timestamp: serverTimestamp(),
                systemType: 'mfvf_submitted',
                month: selectedMonth
            });
        }

        if (options.source === 'pdf') {
            if (pdfSendSupervisorMenu) pdfSendSupervisorMenu.classList.add('hidden');
            showPdfSendToast('M-FVF has been sent ✓');
        } else {
            if (mfvfModal) mfvfModal.classList.add('hidden');
            await CustomModal.alert('M-FVF sent to your supervisor.', 'Sent');
        }
        updateMonthlyView();
    } catch (error) {
        console.error('Error sending M-FVF:', error);
        await CustomModal.alert('Failed to send M-FVF: ' + error.message, 'Send Error');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnHtml;
        }
    }
};

const openMfvfWorkflowModal = () => {
    window.openMfvfPdfViewer?.();
};

const exportToCsv = (entries, summaryData, filename) => {
    const headers = ["Date", "Start", "End", "Hours", "Setting", "Type", "Supervision", "Unrestricted Type", "Supervisor", "Client Present", "Client", "Session Notes/Unrestricted Activities Explanations"];
    let csvContent = headers.join(",") + "\n";

    // Sort entries by date and time
    const sortedEntries = [...entries].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        // If same date, sort by start time
        return a.startTime.localeCompare(b.startTime);
    });

    sortedEntries.forEach(entry => {
        const hours = calculateHours(entry.startTime, entry.endTime).toFixed(2);

        // Combine session notes with unrestricted type if applicable
        let notesColumn = entry.notes || '';
        if (entry.activityType === 'Unrestricted' && entry.unrestrictedActivityType) {
            notesColumn = `[${entry.unrestrictedActivityType}] ${notesColumn}`;
        }

        const row = [
            entry.date,
            entry.startTime,
            entry.endTime,
            hours,
            entry.setting || '-',
            entry.activityType,
            entry.supervisionType,
            entry.unrestrictedActivityType || '-',
            entry.supervisorName || '-',
            entry.clientPresent || '-',
            entry.clientName || '-',
            `"${notesColumn.replace(/"/g, '""')}"`
        ];
        csvContent += row.join(",") + "\n";
    });

    // Add summary table at the end
    csvContent += "\n"; // Empty line separator
    csvContent += "SUMMARY STATISTICS\n";
    const formatDuration = (hours) => {
        const h = Math.floor(hours);
        const m = Math.round((hours % 1) * 60);
        return `${h}h ${m}m`;
    };

    csvContent += "Metric,Value\n";
    csvContent += `Total Duration,${formatDuration(summaryData.total)}\n`;
    csvContent += `Restricted Duration,${formatDuration(summaryData.restricted)}\n`;
    csvContent += `Unrestricted Duration,${formatDuration(summaryData.unrestricted)}\n`;
    csvContent += `Supervised Duration,${formatDuration(summaryData.supervised)}\n`;
    csvContent += `Supervision %,${summaryData.percentage.toFixed(1)}%\n`;

    csvContent += `Observation Duration,${Math.round(summaryData.observationMinutes)} min\n`;
    csvContent += `Unsupervised Duration,${formatDuration(summaryData.unsupervised)}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
};

// --- Role-based UI Functions ---
// --- Role-based UI Functions ---
const handleRoleSelection = async (role) => {
    if (!userId) return;

    console.log(`[DEBUG] handleRoleSelection called with role: ${role}, userId: ${userId}`);

    if (userId === 'guest') {
        // Handle Guest Role Selection purely client-side
        profileData = {
            role: role,
            name: 'Guest User',
            rbtNumber: '',
            supervisors: [],
            fieldworkType: 'Supervised'
        };
        saveProfileToLocalStorage();
        
        // Hide selection, show app
        if (roleSelectionView) roleSelectionView.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
        
        // Setup UI for Guest
        setupUIByRole(role);
        if (role === 'trainee') {
            setupTraineeListeners();
        } else {
            setupSupervisorListeners();
        }
        
        if (userRoleDisplay) userRoleDisplay.textContent = role === 'supervisor' ? 'Supervisor' : 'Trainee';
        renderSupervisors();
        return;
    }

    // For Authenticated Firebase Users
    const profileRef = doc(db, `users/${userId}`);
    const user = auth.currentUser;
    if (!user) {
        console.error("No authenticated user found for role selection.");
        return;
    }

    try {
        const newProfile = {
            role: role,
            email: user.email || '',
            name: user.displayName || 'New User',
            photoURL: user.photoURL || null,
            planType: 'free',
            isVip: false,
            status: 'active',
            registeredAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            version: '1.0'
        };

        await setDoc(profileRef, newProfile, { merge: true });

        if (roleSelectionView) roleSelectionView.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
    } catch (error) {
        console.error("Error saving role and profile:", error);
        await CustomModal.alert("Error saving profile: " + error.message, "Profile Save Error");
    }
};

const setupUIByRole = (role) => {
    const traineeNav = document.getElementById('trainee-nav');
    const supervisorNav = document.getElementById('supervisor-nav');
    const fabAddEntry = document.getElementById('fab-add-entry');

    if (role === 'supervisor') {
        if (traineeNav) traineeNav.classList.add('hidden');
        if (supervisorNav) supervisorNav.classList.remove('hidden');
        if (fabAddEntry) fabAddEntry.classList.add('hidden');
        switchView('supervisor-dashboard');
    } else {
        if (traineeNav) traineeNav.classList.remove('hidden');
        if (supervisorNav) supervisorNav.classList.add('hidden');
        if (fabAddEntry) fabAddEntry.classList.remove('hidden');
        switchView('monthly');
    }
};

const setupTraineeListeners = () => {
    if (unsubscribeEntries) unsubscribeEntries();
    const entriesRef = collection(db, `users/${userId}/entries`);
    unsubscribeEntries = onSnapshot(entriesRef, (snapshot) => {
        allEntries = migrateLegacyExplanations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        console.log(`[DEBUG] Loaded ${allEntries.length} entries. First entry:`, allEntries[0]);
        const activeView = document.querySelector('.view-btn.bg-white\\/10')?.dataset.view || 'monthly';
        if (activeView !== 'supervisor-dashboard') switchView(activeView);
        updateNotificationsUI();
    });
};

const isUserAccessBlocked = (profile) => {
    const status = (profile?.status || 'active').toString().trim().toLowerCase();
    return profile?.accessEnabled === false || ['deactivated', 'disabled', 'suspended'].includes(status);
};

// --- Supervisor Command Center ---
let myTrainees = [];
let selectedTraineeId = null;
let supervisorCache = { entries: {}, verifications: {}, summaries: {}, warnings: {} };
let activeReviewTab = 'overview';
let activeEntryFilters = new Set();
let currentReviewEntries = [];
let currentReviewMonth = null;
let currentRenderMonth = null;

const MONTHLY_HOUR_CAP = 130;
const SUPERVISION_MIN_PCT = 5;

const formatHoursForDisplay = (hours) => {
    const h = Math.floor(hours || 0);
    const m = Math.round(((hours || 0) % 1) * 60);
    return `${h}h ${m}m`;
};

const openSubmittedMfvfPdf = async (request) => {
    const url = request?.submittedPdfUrl || request?.signedPdfUrl || request?.draftPdfUrl;
    if (!url) { await CustomModal.alert("No PDF attached to this request yet.", "PDF Not Found"); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
};

const generateAuditWarnings = (trainee, entries, currentMonthSummary, verification) => {
    const warnings = [];
    const s = currentMonthSummary;
    if (!trainee.name) warnings.push({ severity: 'red', label: 'Missing Name', icon: 'ph-user' });
    if (!trainee.rbtNumber && !trainee.bacbId) warnings.push({ severity: 'yellow', label: 'Missing BACB/RBT ID', icon: 'ph-identification-card' });
    if (!trainee.fieldworkType) warnings.push({ severity: 'yellow', label: 'Missing Fieldwork Type', icon: 'ph-info' });
    if (entries.length === 0) { warnings.push({ severity: 'red', label: 'No Entries This Month', icon: 'ph-calendar-blank' }); return warnings; }
    if (s.total > MONTHLY_HOUR_CAP) warnings.push({ severity: 'red', label: 'Over Monthly Cap', icon: 'ph-warning-circle' });
    if (s.percentage < SUPERVISION_MIN_PCT && s.total > 0) warnings.push({ severity: 'red', label: 'Low Supervision', icon: 'ph-users-three' });
    if (s.observationMinutes < 1 && s.total > 0) warnings.push({ severity: 'yellow', label: 'Missing Observation', icon: 'ph-eye' });
    if (s.unrestricted < 1 && s.total > 10) warnings.push({ severity: 'yellow', label: 'Low Unrestricted', icon: 'ph-brain' });
    const vStatus = verification?.status || 'not_started';
    if (vStatus === 'not_started' || vStatus === 'draft') warnings.push({ severity: 'yellow', label: 'Missing M-FVF', icon: 'ph-file-plus' });
    if (vStatus === 'submitted') warnings.push({ severity: 'yellow', label: 'Pending Signature', icon: 'ph-pencil-line' });
    const unresolvedCount = entries.filter(e => hasFeedback(e) && getFeedbackStatus(e) === 'pending').length;
    if (unresolvedCount > 0) warnings.push({ severity: 'yellow', label: `${unresolvedCount} Unresolved Note${unresolvedCount > 1 ? 's' : ''}`, icon: 'ph-envelope' });
    const missingClient = entries.filter(e => !e.clientName).length;
    if (missingClient > 3) warnings.push({ severity: 'yellow', label: 'Missing Clients', icon: 'ph-user-circle' });
    const missingSupervisor = entries.filter(e => e.supervisionType !== 'No Supervision' && !e.supervisorName).length;
    if (missingSupervisor > 0) warnings.push({ severity: 'yellow', label: 'Missing Supervisor Name', icon: 'ph-user-list' });
    return warnings;
};

const renderWarningBadges = (warnings, compact = false) => {
    if (!warnings.length) return compact ? '' : '<span class="text-xs text-green-400"><i class="ph ph-check-circle"></i> All clear</span>';
    return warnings.map(w => {
        const color = w.severity === 'red' ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${color}"><i class="ph ${w.icon}"></i>${compact ? '' : ` ${w.label}`}</span>`;
    }).join(' ');
};

const updateSupervisorDashboard = async () => {
    const traineesList = document.getElementById('trainees-list');
    if (!userId || profileData.role !== 'supervisor' || !traineesList) return;
    const userEmail = (profileData && profileData.email) || auth.currentUser.email;
    traineesList.innerHTML = '<div class="col-span-full p-8 text-center text-text-muted"><i class="ph ph-circle-notch animate-spin text-3xl mb-2"></i><p class="text-sm">Loading trainees...</p></div>';

    try {
        const q = query(collection(db, 'users'), where('supervisorEmails', 'array-contains', userEmail));
        const querySnapshot = await getDocs(q);
        myTrainees = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        const currentMonth = dayjs().format('YYYY-MM');

        await Promise.all(myTrainees.map(async (t) => {
            try {
                const entriesSnap = await getDocs(collection(db, `users/${t.id}/entries`));
                const allE = migrateLegacyExplanations(entriesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                supervisorCache.entries[t.id] = allE;
                const monthE = allE.filter(e => dayjs(e.date).format('YYYY-MM') === currentMonth);
                supervisorCache.summaries[t.id] = calculateSummaryData(monthE);
                const verifSnap = await getDoc(doc(db, `users/${t.id}/verifications/${currentMonth}`));
                supervisorCache.verifications[t.id] = verifSnap.exists() ? verifSnap.data() : null;
                supervisorCache.warnings[t.id] = generateAuditWarnings(t, monthE, supervisorCache.summaries[t.id], supervisorCache.verifications[t.id]);
            } catch (e) { console.warn('Failed to load data for trainee', t.id, e); }
        }));

        renderCommandCenter();
        renderSidebarTrainees();
        renderMfvfQueueBadge();
        initializeNotifications();
    } catch (error) {
        console.error("Error updating supervisor dashboard:", error);
        traineesList.innerHTML = error.code === 'permission-denied'
            ? `<div class="col-span-full p-5 rounded-2xl bg-red-500/10 border border-red-500/25 text-center py-8"><i class="ph ph-warning-circle text-3xl text-red-400 mb-3 block"></i><p class="text-sm font-bold text-red-400">Database Access Denied</p><p class="text-xs text-slate-300 mt-2">Your Firebase Security Rules are blocking supervisors from loading trainee documents.</p></div>`
            : `<div class="col-span-full p-4 text-center text-red-400">Error: ${error.message}</div>`;
    }
};

const renderCommandCenter = () => {
    const traineesList = document.getElementById('trainees-list');
    const attentionPanel = document.getElementById('needs-attention-panel');
    if (!traineesList) return;

    if (myTrainees.length === 0) {
        traineesList.innerHTML = `<div class="col-span-full p-8 rounded-xl bg-white/5 border border-white/5 text-center"><i class="ph ph-users text-3xl text-text-muted mb-2"></i><p class="text-sm text-text-muted">No trainees linked yet. Trainees add your email in their Settings.</p></div>`;
        if (attentionPanel) { attentionPanel.classList.add('hidden'); attentionPanel.innerHTML = ''; }
        return;
    }

    // Needs Attention Panel
    if (attentionPanel) {
        const items = [];
        let pendingSigs = 0, lowSupervision = 0, overCap = 0, unresolvedNotes = 0, missingMfvf = 0;
        myTrainees.forEach(t => {
            const v = supervisorCache.verifications[t.id];
            const s = supervisorCache.summaries[t.id];
            const entries = supervisorCache.entries[t.id] || [];
            if (v?.status === 'submitted') pendingSigs++;
            if (s && s.percentage < SUPERVISION_MIN_PCT && s.total > 0) lowSupervision++;
            if (s && s.total > MONTHLY_HOUR_CAP) overCap++;
            if (!v || v.status === 'not_started') missingMfvf++;
            unresolvedNotes += entries.filter(e => dayjs(e.date).format('YYYY-MM') === dayjs().format('YYYY-MM') && hasFeedback(e) && getFeedbackStatus(e) === 'pending').length;
        });
        if (pendingSigs) items.push({ count: pendingSigs, label: 'M-FVF awaiting signature', icon: 'ph-pencil-line', color: 'text-amber-400', action: 'mfvf-queue' });
        if (lowSupervision) items.push({ count: lowSupervision, label: `trainee${lowSupervision > 1 ? 's' : ''} below ${SUPERVISION_MIN_PCT}% supervision`, icon: 'ph-users-three', color: 'text-red-400', action: 'trainee-compare' });
        if (overCap) items.push({ count: overCap, label: `trainee${overCap > 1 ? 's' : ''} over monthly hour cap`, icon: 'ph-warning-circle', color: 'text-red-400', action: 'trainee-compare' });
        if (missingMfvf) items.push({ count: missingMfvf, label: `trainee${missingMfvf > 1 ? 's' : ''} missing M-FVF`, icon: 'ph-file-plus', color: 'text-amber-400', action: 'mfvf-queue' });
        if (unresolvedNotes) items.push({ count: unresolvedNotes, label: 'entries with unresolved notes', icon: 'ph-envelope', color: 'text-pink-400', action: null });

        if (items.length > 0) {
            attentionPanel.classList.remove('hidden');
            attentionPanel.innerHTML = `
                <div class="glass-panel rounded-2xl p-4 border border-amber-500/20 bg-amber-500/5">
                    <div class="flex items-center gap-2 mb-3">
                        <i class="ph-fill ph-bell-ringing text-amber-400"></i>
                        <h3 class="text-sm font-bold text-amber-300 uppercase tracking-wider">Needs Attention</h3>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        ${items.map(it => `
                            <button class="attention-item flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-left" ${it.action ? `data-action="${it.action}"` : ''}>
                                <i class="ph ${it.icon} text-lg ${it.color}"></i>
                                <span class="text-sm text-white"><strong>${it.count}</strong> ${it.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>`;
            attentionPanel.querySelectorAll('.attention-item[data-action]').forEach(btn => {
                btn.addEventListener('click', () => switchView(btn.dataset.action));
            });
        } else {
            attentionPanel.classList.remove('hidden');
            attentionPanel.innerHTML = `<div class="rounded-xl p-3 bg-green-500/5 border border-green-500/20 flex items-center gap-2"><i class="ph-fill ph-check-circle text-green-400"></i><span class="text-sm text-green-300 font-medium">All trainees on track this month.</span></div>`;
        }
    }

    // Trainee Cards
    const currentMonth = dayjs().format('YYYY-MM');
    traineesList.innerHTML = myTrainees.map(t => {
        const s = supervisorCache.summaries[t.id] || { total: 0, supervised: 0, percentage: 0, restricted: 0, unrestricted: 0 };
        const v = supervisorCache.verifications[t.id];
        const entries = supervisorCache.entries[t.id] || [];
        const warnings = supervisorCache.warnings[t.id] || [];
        const monthEntries = entries.filter(e => dayjs(e.date).format('YYYY-MM') === currentMonth);
        const lastEntry = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
        const pendingFeedback = monthEntries.filter(e => hasFeedback(e) && getFeedbackStatus(e) === 'pending').length;
        const [statusLabel, statusTextClass] = getMfvfStatusConfig(v?.status);
        const pctColor = s.percentage >= SUPERVISION_MIN_PCT ? 'text-green-400' : (s.total > 0 ? 'text-red-400' : 'text-text-muted');
        const redWarnings = warnings.filter(w => w.severity === 'red').length;
        const yellowWarnings = warnings.filter(w => w.severity === 'yellow').length;

        return `
            <button class="trainee-card w-full p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group" data-id="${t.id}">
                <div class="flex items-start gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                        <i class="ph-fill ph-user"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-white truncate">${t.name || 'Unknown Trainee'}</p>
                        <p class="text-[11px] text-text-muted truncate">${t.email || ''}</p>
                    </div>
                    ${redWarnings > 0 ? `<span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">${redWarnings}</span>` : ''}
                    ${yellowWarnings > 0 && redWarnings === 0 ? `<span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">${yellowWarnings}</span>` : ''}
                </div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div><span class="text-text-muted">Hours:</span> <span class="text-white font-medium">${s.total.toFixed(1)}h</span></div>
                    <div><span class="text-text-muted">Supervised:</span> <span class="${pctColor} font-medium">${s.percentage.toFixed(1)}%</span></div>
                    <div><span class="text-text-muted">M-FVF:</span> <span class="${statusTextClass} font-medium">${statusLabel}</span></div>
                    <div><span class="text-text-muted">Feedback:</span> <span class="${pendingFeedback > 0 ? 'text-pink-400' : 'text-text-muted'} font-medium">${pendingFeedback > 0 ? pendingFeedback + ' pending' : 'None'}</span></div>
                    <div class="col-span-2"><span class="text-text-muted">Last log:</span> <span class="text-text-muted">${lastEntry ? dayjs(lastEntry.date).format('MMM D') : 'Never'}</span></div>
                </div>
                ${warnings.length > 0 ? `<div class="mt-2.5 flex flex-wrap gap-1">${renderWarningBadges(warnings, true)}</div>` : ''}
            </button>`;
    }).join('');

    traineesList.querySelectorAll('.trainee-card').forEach(btn => {
        btn.addEventListener('click', () => selectTrainee(btn.dataset.id));
    });
};

const renderSidebarTrainees = () => {
    const container = document.getElementById('sidebar-trainees-list');
    if (!container) return;
    if (myTrainees.length === 0) { container.innerHTML = '<p class="text-xs text-sidebar-muted py-2 px-2">No trainees yet</p>'; return; }
    container.innerHTML = myTrainees.map(t => {
        const w = (supervisorCache.warnings[t.id] || []).filter(x => x.severity === 'red').length;
        return `<button class="sidebar-trainee-item w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-text/5 transition-all truncate" data-trainee-id="${t.id}">
            <i class="ph-fill ph-user text-xs"></i><span class="truncate flex-1">${t.name || 'Unknown'}</span>${w > 0 ? `<span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>` : ''}
        </button>`;
    }).join('');
    container.querySelectorAll('.sidebar-trainee-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const supView = document.getElementById('supervisor-dashboard-view');
            if (!supView || supView.classList.contains('hidden')) switchView('supervisor-dashboard');
            selectTrainee(btn.dataset.traineeId);
        });
    });
    highlightSidebarTrainee(selectedTraineeId);
};

const highlightSidebarTrainee = (traineeId) => {
    document.querySelectorAll('.sidebar-trainee-item').forEach(btn => {
        const active = btn.dataset.traineeId === traineeId;
        btn.classList.toggle('text-primary', active);
        btn.classList.toggle('bg-primary/10', active);
        btn.classList.toggle('text-sidebar-muted', !active);
    });
};

const showTraineeList = () => {
    const listContainer = document.getElementById('trainee-list-container');
    const reviewContainer = document.getElementById('trainee-review-container');
    if (listContainer) listContainer.classList.remove('hidden');
    if (reviewContainer) reviewContainer.classList.add('hidden');
    selectedTraineeId = null;
    highlightSidebarTrainee(null);
};

const selectTrainee = async (traineeId) => {
    const listContainer = document.getElementById('trainee-list-container');
    const reviewContainer = document.getElementById('trainee-review-container');
    selectedTraineeId = traineeId;
    highlightSidebarTrainee(traineeId);
    const trainee = myTrainees.find(t => t.id === traineeId);
    if (!trainee) return;
    if (listContainer) listContainer.classList.add('hidden');
    if (reviewContainer) reviewContainer.classList.remove('hidden');

    let entries = supervisorCache.entries[traineeId];
    if (!entries) {
        const snap = await getDocs(collection(db, `users/${traineeId}/entries`));
        entries = migrateLegacyExplanations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        supervisorCache.entries[traineeId] = entries;
    }
    currentReviewEntries = entries;
    activeEntryFilters.clear();
    activeReviewTab = 'overview';
    renderTraineeDetail(trainee, entries);
};

const renderTraineeDetail = async (trainee, entries) => {
    const trigger = document.getElementById('review-month-trigger');
    const label = document.getElementById('review-month-label');
    const calendarEl = document.getElementById('review-month-calendar');
    if (!trigger || !calendarEl) return;

    const entryMonths = [...new Set(entries.map(e => dayjs(e.date).format('YYYY-MM')))].sort();
    const allMonths = new Set(entryMonths);
    allMonths.add(dayjs().format('YYYY-MM'));

    const verifCache = {};
    await Promise.all([...allMonths].map(async (m) => {
        try {
            const snap = await getDoc(doc(db, `users/${trainee.id}/verifications/${m}`));
            verifCache[m] = snap.exists() ? snap.data() : null;
        } catch (e) { verifCache[m] = null; }
    }));

    const getMonthStatus = (m) => {
        const monthEntries = entries.filter(e => dayjs(e.date).format('YYYY-MM') === m);
        const v = verifCache[m];
        const hasEntries = monthEntries.length > 0;
        const hasVerif = v && v.status;
        if (hasVerif && v.status === 'signed') return { tier: 'green', label: 'Signed & Returned', cls: 'mcal-green', dotCls: 'bg-green-400' };
        if (hasVerif && v.status !== 'signed') {
            const [sl] = getMfvfStatusConfig(v.status);
            return { tier: 'yellow', label: sl, cls: 'mcal-yellow', dotCls: 'bg-yellow-400' };
        }
        if (hasEntries && !hasVerif) return { tier: 'red', label: 'Missing M-FVF', cls: 'mcal-red', dotCls: 'bg-red-400' };
        return { tier: 'gray', label: 'Not Started', cls: 'mcal-gray', dotCls: 'bg-slate-500' };
    };

    const updateLabel = (m) => {
        const st = getMonthStatus(m);
        const dotColor = { green: '#22c55e', yellow: '#f59e0b', red: '#ef4444', gray: '#64748b' }[st.tier];
        label.innerHTML = `<span class="inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0" style="background:${dotColor}"></span>${dayjs(m + '-01').format('MMM YYYY')} — ${st.label}`;
    };

    let calYear = parseInt(dayjs().format('YYYY'));
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const renderCalendar = () => {
        let html = `<div style="padding:16px 16px 12px;">
        <div class="flex items-center justify-between mb-4">
            <button class="mcal-prev-yr w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-all"><i class="ph-bold ph-caret-left"></i></button>
            <span class="text-base font-bold text-white">${calYear}</span>
            <button class="mcal-next-yr w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white transition-all"><i class="ph-bold ph-caret-right"></i></button>
        </div>`;
        html += `<div class="grid grid-cols-4 gap-2">`;
        for (let mi = 0; mi < 12; mi++) {
            const m = `${calYear}-${String(mi + 1).padStart(2, '0')}`;
            const st = getMonthStatus(m);
            const monthEntries = entries.filter(e => dayjs(e.date).format('YYYY-MM') === m);
            const isActive = m === currentReviewMonth;
            const statusColor = st.tier === 'green' ? 'text-green-300' : st.tier === 'yellow' ? 'text-amber-300' : st.tier === 'red' ? 'text-red-300' : 'text-slate-500';
            html += `<button class="mcal-tile ${st.cls} ${isActive ? 'mcal-tile-active' : ''}" data-month="${m}">
                <span class="text-xs font-bold text-white">${MONTH_NAMES[mi]}</span>
                <span class="text-[9px] font-semibold ${statusColor}" style="line-height:1.2">${st.label}</span>
                ${monthEntries.length > 0 ? `<span class="text-[8px] text-slate-400">${monthEntries.length} entr${monthEntries.length === 1 ? 'y' : 'ies'}</span>` : ''}
            </button>`;
        }
        html += `</div>`;
        html += `<div class="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.08]">
            <button class="mcal-today text-[11px] font-semibold text-primary hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-primary/20"><i class="ph ph-arrow-counter-clockwise mr-1"></i>This Month</button>
            <div class="flex items-center gap-2.5 text-[9px] text-slate-400">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#f87171"></span>Missing</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#fbbf24"></span>Waiting</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#4ade80"></span>Signed</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:#64748b"></span>None</span>
            </div>
        </div></div>`;
        calendarEl.innerHTML = html;

        calendarEl.querySelectorAll('.mcal-tile').forEach(tile => {
            tile.addEventListener('click', async () => {
                const m = tile.dataset.month;
                currentReviewMonth = m;
                if (!verifCache[m] && verifCache[m] !== null) {
                    try {
                        const snap = await getDoc(doc(db, `users/${trainee.id}/verifications/${m}`));
                        verifCache[m] = snap.exists() ? snap.data() : null;
                    } catch (e) { verifCache[m] = null; }
                }
                updateLabel(m);
                calendarEl.classList.add('hidden');
                await renderMonth();
                renderCalendar();
            });
        });
        calendarEl.querySelector('.mcal-prev-yr')?.addEventListener('click', (e) => { e.stopPropagation(); calYear--; renderCalendar(); });
        calendarEl.querySelector('.mcal-next-yr')?.addEventListener('click', (e) => { e.stopPropagation(); calYear++; renderCalendar(); });
        calendarEl.querySelector('.mcal-today')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const now = dayjs().format('YYYY-MM');
            calYear = parseInt(dayjs().format('YYYY'));
            currentReviewMonth = now;
            if (!verifCache[now] && verifCache[now] !== null) {
                getDoc(doc(db, `users/${trainee.id}/verifications/${now}`)).then(snap => {
                    verifCache[now] = snap.exists() ? snap.data() : null;
                }).catch(() => { verifCache[now] = null; });
            }
            updateLabel(now);
            calendarEl.classList.add('hidden');
            renderMonth();
            renderCalendar();
        });
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        calendarEl.classList.toggle('hidden');
        if (!calendarEl.classList.contains('hidden')) renderCalendar();
    };
    calendarEl.onclick = (e) => e.stopPropagation();
    if (!window._mcalDismissWired) {
        window._mcalDismissWired = true;
        document.addEventListener('click', () => {
            document.getElementById('review-month-calendar')?.classList.add('hidden');
        });
    }

    currentReviewMonth = dayjs().format('YYYY-MM');
    if (entryMonths.length > 0) currentReviewMonth = entryMonths[entryMonths.length - 1];

    const renderMonth = async () => {
        if (!currentReviewMonth) return;
        const [y, mo] = currentReviewMonth.split('-');
        const filtered = entries.filter(e => { const d = dayjs(e.date); return d.year() == y && (d.month() + 1) == mo; }).sort((a, b) => b.date.localeCompare(a.date));
        const verification = verifCache[currentReviewMonth] || null;
        const summary = calculateSummaryData(filtered);

        renderTraineeSnapshot(trainee, summary, verification, entries);
        renderOverviewTab(summary, filtered, verification, trainee);
        renderEntriesTab(filtered);
        renderMfvfTab(currentReviewMonth, verification);
        renderFeedbackTab(filtered);
        renderQuickActions(currentReviewMonth, verification);
        switchReviewTab(activeReviewTab);
    };

    currentRenderMonth = renderMonth;
    updateLabel(currentReviewMonth);
    await renderMonth();
};

const refreshCurrentMonth = async () => {
    if (currentRenderMonth) await currentRenderMonth();
};

const renderTraineeSnapshot = (trainee, summary, verification, allEntries) => {
    const el = document.getElementById('trainee-snapshot');
    if (!el) return;
    const missingFields = [];
    if (!trainee.name) missingFields.push('Name');
    if (!trainee.rbtNumber && !trainee.bacbId) missingFields.push('BACB/RBT ID');
    if (!trainee.fieldworkType) missingFields.push('Fieldwork Type');
    if (!trainee.fieldworkStartDate) missingFields.push('Start Date');

    const allTimeSummary = calculateSummaryData(allEntries);

    el.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-start gap-4">
            <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                <i class="ph-fill ph-user text-2xl"></i>
            </div>
            <div class="flex-1 min-w-0 space-y-3">
                <div>
                    <h3 class="text-xl font-bold text-white">${trainee.name || '<span class="text-red-400">No Name</span>'}</h3>
                    <p class="text-sm text-text-muted">${trainee.email || ''}</p>
                </div>
                <div class="grid grid-cols-3 gap-x-6 gap-y-2 text-xs">
                    <div><span class="text-text-muted">BACB/RBT ID:</span><p class="text-white font-medium">${trainee.rbtNumber || trainee.bacbId || '<span class="text-red-400">Missing</span>'}</p></div>
                    <div><span class="text-text-muted">Fieldwork Type:</span><p class="text-white font-medium">${trainee.fieldworkType || '<span class="text-amber-400">Not Set</span>'}</p></div>
                    <div><span class="text-text-muted">All-Time Hours:</span><p class="text-white font-medium">${allTimeSummary.total.toFixed(1)}h</p></div>
                </div>
                ${missingFields.length > 0 ? `<div class="flex items-center gap-2 text-xs text-amber-400"><i class="ph ph-warning"></i> Missing: ${missingFields.join(', ')}</div>` : ''}
            </div>
        </div>`;
};

const switchReviewTab = (tab) => {
    activeReviewTab = tab;
    document.querySelectorAll('.review-tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle('border-primary', isActive);
        btn.classList.toggle('text-primary', isActive);
        btn.classList.toggle('border-transparent', !isActive);
        btn.classList.toggle('text-text-muted', !isActive);
    });
    document.querySelectorAll('.review-tab-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`tab-${tab}`);
    if (panel) panel.classList.remove('hidden');
};

const renderOverviewTab = (summary, entries, verification, trainee) => {
    const grid = document.getElementById('review-stats-grid');
    const warningsPanel = document.getElementById('trainee-warnings-panel');
    if (grid) {
        grid.innerHTML = `
            ${createStatCard('Total', summary.total.toFixed(2), null, 'ph ph-clock', 'bg-blue-500 text-blue-400')}
            ${createStatCard('Restricted', summary.restricted.toFixed(2), null, 'ph ph-hand-heart', 'bg-pink-500 text-pink-400')}
            ${createStatCard('Unrestricted', summary.unrestricted.toFixed(2), null, 'ph ph-brain', 'bg-purple-500 text-purple-400')}
            ${createStatCard('Supervised', summary.supervised.toFixed(2), `${summary.percentage.toFixed(1)}%`, 'ph ph-users-three', 'bg-teal-500 text-teal-400')}
        `;
    }
    if (warningsPanel) {
        const warnings = generateAuditWarnings(trainee, entries, summary, verification);
        if (warnings.length > 0) {
            warningsPanel.innerHTML = `<div class="glass-panel rounded-xl p-4 border border-white/5 space-y-2">
                <h4 class="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Audit Checks</h4>
                <div class="flex flex-wrap gap-2">${renderWarningBadges(warnings, false)}</div>
            </div>`;
        } else {
            warningsPanel.innerHTML = `<div class="flex items-center gap-2 text-sm text-green-400"><i class="ph-fill ph-check-circle"></i> All audit checks passed for this month.</div>`;
        }
    }
};

const ENTRY_FILTERS = [
    { id: 'restricted', label: 'Restricted', test: e => e.activityType === 'Restricted' },
    { id: 'unrestricted', label: 'Unrestricted', test: e => e.activityType === 'Unrestricted' },
    { id: 'supervised', label: 'Supervised', test: e => e.supervisionType !== 'No Supervision' },
    { id: 'unsupervised', label: 'No Supervision', test: e => e.supervisionType === 'No Supervision' },
    { id: 'has-note', label: 'Has Feedback', test: e => hasFeedback(e) },
    { id: 'unresolved', label: 'Unresolved', test: e => hasFeedback(e) && getFeedbackStatus(e) === 'pending' },
    { id: 'observation', label: 'Observation', test: e => e.supervisionType?.includes('Observation') },
    { id: 'client', label: 'Client Present', test: e => e.clientPresent === 'Yes' },
];

const renderEntriesTab = (allFiltered) => {
    const filtersEl = document.getElementById('entry-filters');
    const reviewTableBody = document.getElementById('review-table-body');

    if (filtersEl) {
        filtersEl.innerHTML = ENTRY_FILTERS.map(f => {
            const active = activeEntryFilters.has(f.id);
            return `<button class="entry-filter-btn px-2.5 py-1 rounded-lg border transition-all ${active ? 'bg-primary/20 border-primary/40 text-primary font-semibold' : 'bg-white/5 border-white/10 text-text-muted hover:text-white hover:border-white/20'}" data-filter="${f.id}">${f.label}</button>`;
        }).join('');
        filtersEl.querySelectorAll('.entry-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const fid = btn.dataset.filter;
                if (activeEntryFilters.has(fid)) activeEntryFilters.delete(fid); else activeEntryFilters.add(fid);
                renderEntriesTab(allFiltered);
            });
        });
    }

    let filtered = allFiltered;
    if (activeEntryFilters.size > 0) {
        filtered = allFiltered.filter(e => {
            return [...activeEntryFilters].every(fid => {
                const f = ENTRY_FILTERS.find(x => x.id === fid);
                return f ? f.test(e) : true;
            });
        });
    }

    if (reviewTableBody) {
        if (filtered.length === 0) {
            reviewTableBody.innerHTML = `<tr><td colspan="11" class="px-4 py-8 text-center text-text-muted"><i class="ph ph-funnel text-2xl mb-2 block opacity-30"></i>${activeEntryFilters.size > 0 ? 'No entries match filters.' : 'No entries this month.'}</td></tr>`;
            return;
        }
        reviewTableBody.innerHTML = filtered.map(entry => {
            let notesDisplay = entry.notes || '';
            if (entry.activityType === 'Unrestricted' && entry.unrestrictedActivityType) notesDisplay = `[${entry.unrestrictedActivityType}] ${notesDisplay}`;
            const hasSupervisorNote = !!entry.supervisorNote;
            const isFixed = !!entry.feedbackFixed;
            const supFbStatus = getFeedbackStatus(entry);
            const supHasFb = hasFeedback(entry);
            let rowClass = 'hover:bg-surface-hover transition-colors';
            if (supHasFb) {
                if (supFbStatus === 'resolved') rowClass = 'green-row transition-all duration-200';
                else if (supFbStatus === 'entry_deleted' || supFbStatus === 'deleted') rowClass = 'opacity-50 bg-slate-500/5 transition-all duration-200';
                else if (supFbStatus === 'read') rowClass = 'bg-yellow-500/5 border-l-2 border-yellow-500/30 transition-all duration-200';
                else rowClass = 'magenta-row transition-all duration-200';
            }

            let feedbackCellContent = '';
            if (supHasFb) {
                const fbConf = getFeedbackStatusConfig(supFbStatus);
                const areas = entry.feedbackIssueAreas || [];
                const areaPreview = areas.length > 0 ? areas.slice(0, 2).map(getFeedbackIssueLabel).join(' \u2022 ') : '';
                const notePreview = entry.supervisorNote ? (entry.supervisorNote.length > 25 ? entry.supervisorNote.substring(0, 25) + '...' : entry.supervisorNote) : '';
                const previewText = [areaPreview, notePreview].filter(Boolean).join(': ');
                feedbackCellContent = `<div class="text-left space-y-0.5">
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${fbConf.bg} ${fbConf.text}"><i class="ph-fill ph-${fbConf.icon}"></i> ${fbConf.label}</span>
                    ${previewText ? `<p class="text-[10px] ${fbConf.text} opacity-70 truncate max-w-[160px]">${previewText}</p>` : ''}
                    ${entry.traineeResponse ? '<span class="text-[9px] text-teal-400"><i class="ph ph-chat-text"></i> Response</span>' : ''}
                </div>`;
            }

            return `<tr class="${rowClass}">
                <td class="px-4 py-3 text-white">${dayjs(entry.date).format('MMM D')}</td>
                <td class="px-4 py-3 text-text-muted text-xs">${entry.startTime} - ${entry.endTime}</td>
                <td class="px-4 py-3 text-white font-medium">${calculateHours(entry.startTime, entry.endTime).toFixed(2)}</td>
                <td class="px-4 py-3 text-text-muted">${entry.clientName || '-'}</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${entry.activityType === 'Restricted' ? 'bg-pink-500/10 text-pink-400' : 'bg-purple-500/10 text-purple-400'}">${entry.activityType}</span></td>
                <td class="px-4 py-3 text-text-muted text-xs hidden sm:table-cell">${entry.activityType === 'Unrestricted' ? (entry.unrestrictedActivityType || 'General') : '-'}</td>
                <td class="px-4 py-3 text-xs ${entry.supervisionType === 'No Supervision' ? 'text-text-muted' : 'text-teal-400 font-medium'}">${entry.supervisionType}</td>
                <td class="px-4 py-3 text-text-muted text-xs">${entry.supervisorName || '-'}</td>
                <td class="note-cell px-4 py-3 text-text-muted text-xs hidden md:table-cell max-w-xs truncate cursor-pointer hover:text-white" data-has-feedback="${hasSupervisorNote}" data-feedback="${(entry.supervisorNote || '').replace(/"/g, '&quot;')}" data-notes="${notesDisplay.replace(/"/g, '&quot;')}">${notesDisplay}</td>
                <td class="feedback-cell px-4 py-3 cursor-pointer" data-id="${entry.id}" data-fixed="${isFixed}" data-feedback="${(entry.supervisorNote || '').replace(/"/g, '&quot;')}">${feedbackCellContent}</td>
                <td class="px-4 py-3 text-right"><div class="flex justify-end gap-1">
                    <button class="add-supervisor-note-btn p-2 rounded-lg hover:bg-surface-hover text-primary hover:text-white transition-all" data-id="${entry.id}" data-supervisor-note="${(entry.supervisorNote || '').replace(/"/g, '&quot;')}" title="Add/Edit Note"><i class="ph-bold ph-note-pencil"></i></button>
                    ${hasSupervisorNote ? `<button class="delete-supervisor-note-btn p-2 rounded-lg hover:bg-surface-hover text-red-400 hover:text-red-500 transition-all" data-id="${entry.id}" title="Delete Note"><i class="ph-bold ph-trash"></i></button>` : ''}
                </div></td>
            </tr>`;
        }).join('');
    }

    const csvBtn = document.getElementById('export-csv-btn');
    if (csvBtn) {
        csvBtn.onclick = () => exportEntriesCsv(filtered);
    }
};

const exportEntriesCsv = (entries) => {
    if (!entries || entries.length === 0) { CustomModal.alert('No entries to export.', 'Export'); return; }
    const trainee = myTrainees?.find(t => t.id === selectedTraineeId);
    const traineeName = (trainee?.name || 'Trainee').replace(/[^a-zA-Z0-9]/g, '_');
    const monthLabel = currentReviewMonth ? dayjs(currentReviewMonth + '-01').format('MMM_YYYY') : 'entries';
    const esc = (v) => { const s = String(v ?? '').replace(/"/g, '""'); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s; };
    const headers = ['Date','Start','End','Hours','Client','Type','Unrestricted Type','Supervision','Supervisor','Notes','Feedback Status','Feedback Issues','Supervisor Feedback'];
    const rows = entries.map(e => {
        const hrs = calculateHours(e.startTime, e.endTime);
        const fbSt = getFeedbackStatus(e);
        const fbConf = fbSt ? getFeedbackStatusConfig(fbSt) : null;
        const areas = (e.feedbackIssueAreas || []).map(getFeedbackIssueLabel).join('; ');
        return [
            dayjs(e.date).format('YYYY-MM-DD'), e.startTime, e.endTime, hrs.toFixed(2),
            e.clientName || '', e.activityType || '', e.activityType === 'Unrestricted' ? (e.unrestrictedActivityType || '') : '',
            e.supervisionType || '', e.supervisorName || '', e.notes || '',
            fbConf ? fbConf.label : '', areas, e.supervisorNote || ''
        ].map(esc).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${traineeName}_entries_${monthLabel}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const renderMfvfTab = (month, request) => {
    const panel = document.getElementById('supervisor-mfvf-review-panel');
    const actionsEl = document.getElementById('mfvf-action-buttons');
    if (!panel) return;

    if (!request || request.status === 'not_started') {
        panel.innerHTML = `<div class="glass-panel rounded-xl p-6 text-center border border-white/5"><i class="ph ph-file-plus text-3xl text-text-muted mb-2"></i><p class="text-sm text-text-muted">No M-FVF submitted for ${dayjs(month).format('MMMM YYYY')} yet.</p></div>`;
        if (actionsEl) actionsEl.innerHTML = '';
        return;
    }

    const [label, textClass, boxClass, icon] = getMfvfStatusConfig(request.status);
    const data = request.formData || {};
    const canReview = request.status === 'submitted' || request.status === 'changes_requested';
    const signedLine = request.status === 'signed' ? `<p class="text-xs text-green-300 mt-2">Signed by ${request.supervisorSignatureName || request.supervisorName || 'Supervisor'} on ${dayjs(request.signedAt).format('MMM D, YYYY h:mm A')}.</p>` : '';

    panel.innerHTML = `
        <div class="rounded-2xl border ${boxClass} p-5">
            <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${textClass}"><i class="${icon} text-xl"></i></div>
                    <div>
                        <p class="text-xs uppercase tracking-widest font-bold ${textClass}">M-FVF: ${label}</p>
                        <h4 class="text-lg font-bold text-white mt-1">${request.traineeName || 'Trainee'} • ${request.monthLabel || dayjs(month).format('MMMM YYYY')}</h4>
                        <p class="text-xs text-text-muted mt-1">${request.traineeSubmittedAt ? `Submitted ${dayjs(request.traineeSubmittedAt).format('MMM D, YYYY h:mm A')}` : ''}</p>
                        ${request.supervisorComments ? `<p class="text-sm text-orange-200 mt-3">Your note: ${request.supervisorComments}</p>` : ''}
                        ${signedLine}
                    </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs min-w-full lg:min-w-[400px]">
                    <div class="rounded-xl bg-white/5 border border-white/5 p-3"><p class="text-text-muted uppercase tracking-wider">Total</p><p class="text-white font-bold mt-1">${formatHoursForDisplay(data.totalHours || 0)}</p></div>
                    <div class="rounded-xl bg-white/5 border border-white/5 p-3"><p class="text-text-muted uppercase tracking-wider">Supervised</p><p class="text-white font-bold mt-1">${formatHoursForDisplay(data.supervisedHours || 0)}</p></div>
                    <div class="rounded-xl bg-white/5 border border-white/5 p-3"><p class="text-text-muted uppercase tracking-wider">Observation</p><p class="text-white font-bold mt-1">${Math.round(data.observationMinutes || 0)}m</p></div>
                    <div class="rounded-xl bg-white/5 border border-white/5 p-3"><p class="text-text-muted uppercase tracking-wider">Location</p><p class="text-white font-bold mt-1">${data.state || '-'} / ${data.country || '-'}</p></div>
                </div>
            </div>
        </div>`;

    if (actionsEl) {
        actionsEl.innerHTML = `
            ${(request.submittedPdfUrl || request.signedPdfUrl || request.draftPdfUrl) ? `<button id="mfvf-open-submitted-pdf-btn" class="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors border border-white/10"><i class="ph ph-file-pdf"></i> Open PDF</button>` : ''}
            ${canReview ? `<button id="mfvf-request-changes-btn" class="px-4 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-200 border border-orange-500/25 text-sm font-semibold transition-colors"><i class="ph ph-chat-teardrop-text"></i> Request Changes</button>` : ''}
            ${canReview ? `<button id="mfvf-sign-btn" class="px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors shadow-lg"><i class="ph ph-pencil-line"></i> Review & Sign</button>` : ''}
        `;
        document.getElementById('mfvf-open-submitted-pdf-btn')?.addEventListener('click', () => openSubmittedMfvfPdf(request));
        document.getElementById('mfvf-request-changes-btn')?.addEventListener('click', () => requestMfvfChanges(month, request));
        document.getElementById('mfvf-sign-btn')?.addEventListener('click', () => openSupervisorReviewModal(month, request));
    }
};

const renderFeedbackTab = (entries) => {
    const el = document.getElementById('feedback-entries-list');
    if (!el) return;
    const withFeedback = entries.filter(e => hasFeedback(e));
    if (withFeedback.length === 0) {
        el.innerHTML = `<div class="glass-panel rounded-xl p-6 text-center border border-white/5"><i class="ph ph-chat-circle text-3xl text-text-muted mb-2"></i><p class="text-sm text-text-muted">No supervisor feedback this month.</p></div>`;
        return;
    }
    const pending = withFeedback.filter(e => { const s = getFeedbackStatus(e); return s === 'pending' || s === 'read'; });
    const resolved = withFeedback.filter(e => getFeedbackStatus(e) === 'resolved');
    const deleted = withFeedback.filter(e => { const s = getFeedbackStatus(e); return s === 'deleted' || s === 'entry_deleted'; });

    const renderCard = (e) => {
        const fbStatus = getFeedbackStatus(e);
        const fbConf = getFeedbackStatusConfig(fbStatus);
        const isDeleted = fbStatus === 'deleted' || fbStatus === 'entry_deleted';
        const borderColor = isDeleted ? 'border-slate-500/20' : (fbStatus === 'resolved' ? 'border-green-500/20' : 'border-pink-500/20');
        const bgColor = isDeleted ? 'bg-slate-500/5 opacity-60' : (fbStatus === 'resolved' ? 'bg-green-500/5' : 'bg-pink-500/5');
        const areas = e.feedbackIssueAreas || [];
        const totalHrs = calculateHours(e.startTime, e.endTime);
        const statusBadge = `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${fbConf.bg} ${fbConf.text}"><i class="ph-fill ph-${fbConf.icon}"></i> ${fbConf.label}</span>`;
        const cardId = `fb-card-${e.id}`;
        const snap = e.feedbackEntrySnapshot || {};
        const hasSnapshot = snap.date || snap.notes || snap.activityType;

        return `<div class="glass-panel rounded-xl p-4 border ${borderColor} ${bgColor}">
            <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                        <span class="text-xs text-white font-medium">${dayjs(e.date).format('MMM D, YYYY')}</span>
                        <span class="text-xs text-text-muted">${e.startTime} – ${e.endTime}</span>
                        <span class="text-xs text-text-muted font-medium">${totalHrs.toFixed(2)} hrs</span>
                        ${e.clientName ? `<span class="text-xs text-text-muted">${e.clientName}</span>` : ''}
                        ${statusBadge}
                    </div>
                    ${isDeleted ? '<div class="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 rounded-lg bg-slate-500/10 border border-slate-500/15"><i class="ph-fill ph-trash text-slate-400 text-xs"></i><span class="text-[11px] text-slate-400 font-medium">This entry was deleted by trainee.</span></div>' : ''}
                    ${areas.length > 0 ? `<div class="mb-2"><span class="text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold">Issue</span><div class="flex flex-wrap gap-1 mt-1">${renderFeedbackIssueBadges(areas)}</div></div>` : ''}
                    ${e.supervisorNote ? `<div class="mb-2"><span class="text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold">Supervisor Feedback</span><p class="text-sm text-white mt-0.5 whitespace-pre-line">${e.supervisorNote}</p></div>` : ''}
                    ${e.feedbackRequestedAction ? `<div class="mb-2"><span class="text-[10px] text-text-muted/60 uppercase tracking-wider font-semibold">Requested Action</span><p class="text-xs text-amber-300/80 mt-0.5">${e.feedbackRequestedAction}</p></div>` : ''}
                    ${e.traineeResponse ? `<div class="mb-2 pl-3 border-l-2 border-teal-500/30"><span class="text-[10px] text-teal-400/80 uppercase tracking-wider font-semibold">Trainee Response</span><p class="text-xs text-teal-200/80 mt-0.5 whitespace-pre-line">${e.traineeResponse}</p></div>` : ''}
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-muted mt-2 pt-2 border-t border-white/5">
                        ${e.feedbackSentAt ? `<span><i class="ph ph-paper-plane-tilt"></i> Sent ${dayjs(e.feedbackSentAt).format('MMM D, h:mm A')}</span>` : ''}
                        ${e.feedbackResolvedAt ? `<span><i class="ph-fill ph-check-circle"></i> Resolved ${dayjs(e.feedbackResolvedAt).format('MMM D, h:mm A')}</span>` : ''}
                        ${e.feedbackDeletedAt ? `<span><i class="ph ph-trash"></i> Deleted ${dayjs(e.feedbackDeletedAt).format('MMM D, h:mm A')}</span>` : ''}
                    </div>
                    ${hasSnapshot ? `<div class="mt-2"><button class="fb-toggle-snapshot text-[10px] text-text-muted/50 hover:text-text-muted transition-colors flex items-center gap-1" data-target="${cardId}"><i class="ph ph-caret-right text-[8px] fb-caret"></i> View entry details</button><div id="${cardId}" class="hidden mt-1.5 pl-3 border-l border-white/5 text-[11px] text-text-muted/60 space-y-0.5">${snap.activityType ? `<p><span class="text-text-muted/40">Type:</span> ${snap.activityType}${snap.unrestrictedActivityType ? ' / ' + snap.unrestrictedActivityType : ''}</p>` : ''}${snap.supervisionType ? `<p><span class="text-text-muted/40">Supervision:</span> ${snap.supervisionType}</p>` : ''}${snap.supervisorName ? `<p><span class="text-text-muted/40">Supervisor:</span> ${snap.supervisorName}</p>` : ''}${snap.notes ? `<p><span class="text-text-muted/40">Note:</span> ${snap.notes}</p>` : ''}</div></div>` : ''}
                </div>
                <div class="flex flex-col gap-1 flex-shrink-0">
                    ${!isDeleted ? `<button class="add-supervisor-note-btn p-2 rounded-lg hover:bg-surface-hover text-primary hover:text-white transition-all" data-id="${e.id}" title="Edit Feedback"><i class="ph-bold ph-note-pencil"></i></button>
                    <button class="delete-supervisor-note-btn p-2 rounded-lg hover:bg-surface-hover text-red-400 hover:text-red-500 transition-all" data-id="${e.id}" title="Delete Feedback"><i class="ph-bold ph-trash"></i></button>` : ''}
                </div>
            </div>
        </div>`;
    };

    const renderSection = (title, icon, colorClass, items) => {
        if (items.length === 0) return '';
        return `<div class="space-y-2"><h4 class="text-xs font-bold ${colorClass} uppercase tracking-wider flex items-center gap-1.5"><i class="ph-fill ph-${icon}"></i> ${title} (${items.length})</h4>${items.map(renderCard).join('')}</div>`;
    };

    el.innerHTML = [
        renderSection('Pending', 'envelope', 'text-pink-400', pending),
        renderSection('Resolved', 'check-circle', 'text-green-400', resolved),
        renderSection('Deleted Entries', 'trash', 'text-slate-400', deleted)
    ].filter(Boolean).join('<div class="mt-5"></div>');

    el.querySelectorAll('.fb-toggle-snapshot').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            if (!target) return;
            const hidden = target.classList.toggle('hidden');
            const caret = btn.querySelector('.fb-caret');
            if (caret) caret.style.transform = hidden ? '' : 'rotate(90deg)';
            btn.childNodes[btn.childNodes.length - 1].textContent = hidden ? ' View entry details' : ' Hide entry details';
        });
    });
};

const renderQuickActions = (month, verification) => {
    const el = document.getElementById('review-quick-actions');
    if (!el) return;
    const hasPdf = verification?.submittedPdfUrl || verification?.signedPdfUrl || verification?.draftPdfUrl;
    const canSign = verification?.status === 'submitted' || verification?.status === 'changes_requested';
    el.innerHTML = `
        ${hasPdf ? `<button class="qa-open-pdf px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"><i class="ph ph-file-pdf mr-1"></i> Open PDF</button>` : ''}
        ${canSign ? `<button class="qa-request-changes px-3 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-200 text-xs font-semibold transition-all border border-orange-500/20"><i class="ph ph-chat-teardrop-text mr-1"></i> Request Changes</button>` : ''}
        <button class="qa-add-note px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"><i class="ph ph-note mr-1"></i> Add Summary Note</button>
        ${canSign ? `<button class="qa-sign px-3 py-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-bold transition-all border border-green-500/30"><i class="ph ph-pencil-line mr-1"></i> Review & Sign</button>` : ''}
        <button class="qa-message px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all border border-primary/20"><i class="ph ph-chat-centered-text mr-1"></i> Message Trainee</button>
    `;
    el.querySelector('.qa-open-pdf')?.addEventListener('click', () => openSubmittedMfvfPdf(verification));
    el.querySelector('.qa-request-changes')?.addEventListener('click', () => requestMfvfChanges(month, verification));
    el.querySelector('.qa-sign')?.addEventListener('click', () => openSupervisorReviewModal(month, verification));
    el.querySelector('.qa-add-note')?.addEventListener('click', async () => {
        const note = await CustomModal.prompt("Add a summary note for this month:", verification?.supervisorComments || '', "Summary Note");
        if (note !== null) {
            await setDoc(getMfvfVerificationRef(selectedTraineeId, month), { supervisorComments: note.trim(), updatedAt: new Date().toISOString() }, { merge: true });
            selectTrainee(selectedTraineeId);
        }
    });
    el.querySelector('.qa-message')?.addEventListener('click', () => { switchView('chat'); });
};

// --- M-FVF Queue View ---
const renderMfvfQueue = async () => {
    const list = document.getElementById('mfvf-queue-list');
    const filtersEl = document.getElementById('mfvf-queue-filters');
    if (!list) return;
    if (myTrainees.length === 0) { list.innerHTML = '<p class="text-sm text-text-muted text-center py-8">No trainees loaded yet.</p>'; return; }

    list.innerHTML = '<div class="text-center py-8 text-text-muted"><i class="ph ph-circle-notch animate-spin text-xl"></i></div>';
    const queueItems = [];
    const currentMonth = dayjs().format('YYYY-MM');
    const last6 = Array.from({ length: 6 }, (_, i) => dayjs().subtract(i, 'month').format('YYYY-MM'));

    for (const t of myTrainees) {
        for (const m of last6) {
            try {
                let v = null;
                if (m === currentMonth && supervisorCache.verifications[t.id] !== undefined) {
                    v = supervisorCache.verifications[t.id];
                } else {
                    const snap = await getDoc(doc(db, `users/${t.id}/verifications/${m}`));
                    v = snap.exists() ? snap.data() : null;
                }
                queueItems.push({ trainee: t, month: m, verification: v, status: v?.status || 'not_started' });
            } catch (e) {
                queueItems.push({ trainee: t, month: m, verification: null, status: 'not_started' });
            }
        }
    }

    const statusOrder = { submitted: 0, changes_requested: 1, draft: 2, not_started: 3, signed: 4, rejected: 5 };
    queueItems.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || b.month.localeCompare(a.month));

    const statusFilters = ['all', 'submitted', 'changes_requested', 'draft', 'not_started', 'signed'];
    let activeQueueFilter = 'all';

    const renderFiltered = () => {
        const items = activeQueueFilter === 'all' ? queueItems : queueItems.filter(q => q.status === activeQueueFilter);
        if (filtersEl) {
            filtersEl.innerHTML = statusFilters.map(sf => {
                const [label] = sf === 'all' ? ['All'] : getMfvfStatusConfig(sf);
                const count = sf === 'all' ? queueItems.length : queueItems.filter(q => q.status === sf).length;
                const active = activeQueueFilter === sf;
                return `<button class="queue-filter-btn px-2.5 py-1 rounded-lg border transition-all ${active ? 'bg-primary/20 border-primary/40 text-primary font-semibold' : 'bg-white/5 border-white/10 text-text-muted hover:text-white'}" data-filter="${sf}">${label} (${count})</button>`;
            }).join('');
            filtersEl.querySelectorAll('.queue-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => { activeQueueFilter = btn.dataset.filter; renderFiltered(); });
            });
        }

        if (items.length === 0) { list.innerHTML = '<p class="text-sm text-text-muted text-center py-8">No items match this filter.</p>'; return; }
        list.innerHTML = items.map(q => {
            const [label, textClass, boxClass, icon] = getMfvfStatusConfig(q.status);
            const v = q.verification;
            const hasPdf = v?.submittedPdfUrl || v?.signedPdfUrl || v?.draftPdfUrl;
            const canReview = q.status === 'submitted' || q.status === 'changes_requested';
            return `<div class="glass-panel rounded-xl p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center ${textClass} flex-shrink-0"><i class="${icon}"></i></div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-sm font-bold text-white">${q.trainee.name || 'Unknown'}</span>
                            <span class="text-xs text-text-muted">${dayjs(q.month).format('MMM YYYY')}</span>
                            <span class="px-2 py-0.5 rounded-lg text-[10px] font-semibold ${textClass} ${boxClass} border border-white/10">${label}</span>
                        </div>
                        <p class="text-xs text-text-muted mt-0.5">${v?.traineeSubmittedAt ? `Submitted ${dayjs(v.traineeSubmittedAt).format('MMM D')}` : v?.savedAt ? `Saved ${dayjs(v.savedAt).format('MMM D')}` : 'Not submitted'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    ${hasPdf ? `<button class="queue-open-pdf px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10" data-trainee="${q.trainee.id}" data-month="${q.month}"><i class="ph ph-file-pdf"></i> PDF</button>` : ''}
                    ${canReview ? `<button class="queue-sign px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-bold border border-green-500/30" data-trainee="${q.trainee.id}" data-month="${q.month}"><i class="ph ph-pencil-line"></i> Review & Sign</button>` : ''}
                    ${canReview ? `<button class="queue-changes px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-200 text-xs font-semibold border border-orange-500/20" data-trainee="${q.trainee.id}" data-month="${q.month}"><i class="ph ph-chat-teardrop-text"></i> Changes</button>` : ''}
                    <button class="queue-view-trainee px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold border border-primary/20" data-trainee="${q.trainee.id}"><i class="ph ph-arrow-right"></i></button>
                </div>
            </div>`;
        }).join('');

        list.querySelectorAll('.queue-open-pdf').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tid = btn.dataset.trainee, m = btn.dataset.month;
                const item = queueItems.find(q => q.trainee.id === tid && q.month === m);
                if (item?.verification) openSubmittedMfvfPdf(item.verification);
            });
        });
        list.querySelectorAll('.queue-sign').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tid = btn.dataset.trainee, m = btn.dataset.month;
                const item = queueItems.find(q => q.trainee.id === tid && q.month === m);
                if (item?.verification) { selectedTraineeId = tid; openSupervisorReviewModal(m, item.verification); }
            });
        });
        list.querySelectorAll('.queue-changes').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tid = btn.dataset.trainee, m = btn.dataset.month;
                const item = queueItems.find(q => q.trainee.id === tid && q.month === m);
                if (item?.verification) { selectedTraineeId = tid; await requestMfvfChanges(m, item.verification); renderMfvfQueue(); }
            });
        });
        list.querySelectorAll('.queue-view-trainee').forEach(btn => {
            btn.addEventListener('click', () => { switchView('supervisor-dashboard'); selectTrainee(btn.dataset.trainee); });
        });
    };
    renderFiltered();
};

const renderMfvfQueueBadge = () => {
    const badge = document.getElementById('mfvf-queue-badge');
    if (!badge) return;
    let count = 0;
    myTrainees.forEach(t => { if (supervisorCache.verifications[t.id]?.status === 'submitted') count++; });
    if (count > 0) { badge.textContent = count; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
};

// --- Trainee Comparison Table ---
const renderTraineeCompare = () => {
    const header = document.getElementById('compare-table-header');
    const body = document.getElementById('compare-table-body');
    if (!header || !body) return;
    const currentMonth = dayjs().format('YYYY-MM');

    header.innerHTML = `
        <th class="px-4 py-3 cursor-pointer hover:text-primary" data-sort="name">Trainee</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary text-right" data-sort="total">Total hrs</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary text-right" data-sort="monthTotal">Month hrs</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary text-right" data-sort="restricted">Restricted</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary text-right" data-sort="unrestricted">Unrestricted</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary text-right" data-sort="pct">Supervised %</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary text-right" data-sort="obs">Observation</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary" data-sort="mfvf">M-FVF</th>
        <th class="px-4 py-3 cursor-pointer hover:text-primary" data-sort="lastLog">Last Log</th>
    `;

    let rows = myTrainees.map(t => {
        const entries = supervisorCache.entries[t.id] || [];
        const allTime = calculateSummaryData(entries);
        const monthE = entries.filter(e => dayjs(e.date).format('YYYY-MM') === currentMonth);
        const s = calculateSummaryData(monthE);
        const v = supervisorCache.verifications[t.id];
        const [statusLabel, textClass] = getMfvfStatusConfig(v?.status);
        const lastEntry = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
        const pctColor = s.percentage >= SUPERVISION_MIN_PCT ? 'text-green-400' : (s.total > 0 ? 'text-red-400' : 'text-text-muted');
        return {
            name: t.name || 'Unknown', total: allTime.total, monthTotal: s.total, restricted: s.restricted,
            unrestricted: s.unrestricted, pct: s.percentage, obs: s.observationMinutes,
            mfvf: statusLabel, lastLog: lastEntry?.date || '', id: t.id, textClass, pctColor
        };
    });

    let sortKey = 'name', sortAsc = true;
    const renderRows = () => {
        const sorted = [...rows].sort((a, b) => {
            let va = a[sortKey], vb = b[sortKey];
            if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortAsc ? va - vb : vb - va;
        });
        body.innerHTML = sorted.map(r => `
            <tr class="hover:bg-surface-hover transition-colors cursor-pointer" data-id="${r.id}">
                <td class="px-4 py-3 text-white font-medium">${r.name}</td>
                <td class="px-4 py-3 text-right text-text-muted">${r.total.toFixed(1)}</td>
                <td class="px-4 py-3 text-right text-white font-medium">${r.monthTotal.toFixed(1)}</td>
                <td class="px-4 py-3 text-right text-pink-400">${r.restricted.toFixed(1)}</td>
                <td class="px-4 py-3 text-right text-purple-400">${r.unrestricted.toFixed(1)}</td>
                <td class="px-4 py-3 text-right ${r.pctColor} font-medium">${r.pct.toFixed(1)}%</td>
                <td class="px-4 py-3 text-right text-text-muted">${Math.round(r.obs)}m</td>
                <td class="px-4 py-3"><span class="${r.textClass} text-xs font-semibold">${r.mfvf}</span></td>
                <td class="px-4 py-3 text-text-muted text-xs">${r.lastLog ? dayjs(r.lastLog).format('MMM D') : '-'}</td>
            </tr>
        `).join('');
        body.querySelectorAll('tr[data-id]').forEach(row => {
            row.addEventListener('click', () => { switchView('supervisor-dashboard'); selectTrainee(row.dataset.id); });
        });
    };
    header.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (sortKey === key) sortAsc = !sortAsc; else { sortKey = key; sortAsc = true; }
            renderRows();
        });
    });
    renderRows();
};

const openSupervisorReviewModal = async (month, request) => {
    if (!request || !selectedTraineeId) return;
    if (request.status === 'signed') {
        await CustomModal.alert('This M-FVF has already been signed. It cannot be re-signed without a correction request from the trainee.', 'Already Signed');
        return;
    }
    const traineeId = request.traineeId || selectedTraineeId;
    const pdfUrl = request.submittedPdfUrl || request.draftPdfUrl;
    const supName = profileData.name || '';
    const supCert = profileData.rbtNumber || profileData.bacbId || request.supervisorCert || '';

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] flex flex-col';
    overlay.style.cssText = 'background:rgba(5,8,22,0.97);backdrop-filter:blur(20px);';

    overlay.innerHTML = `
        <div class="flex items-center justify-between px-5 py-3 border-b border-white/8 flex-shrink-0" style="background:rgba(255,255,255,0.03);">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center"><i class="ph-fill ph-pencil-line text-green-400"></i></div>
                <div>
                    <h2 class="text-sm font-bold text-white">Review & Sign M-FVF</h2>
                    <p class="text-[11px] text-text-muted">${request.traineeName || 'Trainee'} — ${request.monthLabel || dayjs(month).format('MMMM YYYY')}</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 text-xs">
                    <label class="text-text-muted">Name:</label>
                    <input id="sup-review-name" value="${supName}" class="px-2 py-1 rounded-lg text-xs bg-white/5 text-white border border-white/10 focus:border-primary outline-none w-32" placeholder="Your name"/>
                </div>
                <div class="flex items-center gap-2 text-xs">
                    <label class="text-text-muted">BACB ID:</label>
                    <input id="sup-review-cert" value="${supCert}" class="px-2 py-1 rounded-lg text-xs bg-white/5 text-white border border-white/10 focus:border-primary outline-none w-28" placeholder="Cert #"/>
                </div>
                <button id="sup-review-sign-btn" class="px-5 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-600 text-white transition-all shadow-lg">
                    <i class="ph ph-check-circle mr-1"></i>Sign & Return to Trainee
                </button>
                <button id="sup-review-close" class="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-white transition-all" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);"><i class="ph-bold ph-x text-sm"></i></button>
            </div>
        </div>
        <div class="flex-1 overflow-auto flex justify-center p-6" id="sup-review-scroll">
            <div id="sup-review-stage" style="position:relative;display:none;">
                <canvas id="sup-review-canvas"></canvas>
                <div id="sup-review-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
            </div>
            <div id="sup-review-loading" class="flex items-center justify-center py-20 text-text-muted"><i class="ph ph-circle-notch animate-spin text-3xl mr-3"></i> Loading form...</div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    let supervisorSignatureDataUrl = null;
    const signBtn = overlay.querySelector('#sup-review-sign-btn');
    const closeBtn = overlay.querySelector('#sup-review-close');

    closeBtn.addEventListener('click', () => { overlay.remove(); document.body.style.overflow = ''; });

    const openSupSignaturePad = () => {
        const sigModal = document.createElement('div');
        sigModal.className = 'fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm';
        sigModal.innerHTML = `
            <div class="glass-panel rounded-2xl p-5 w-[440px] max-w-[92vw] border border-white/10 shadow-2xl">
                <div class="flex items-center gap-2 mb-1"><i class="ph-fill ph-pen-nib text-emerald-400 text-lg"></i><h3 class="text-lg font-bold text-white">Supervisor Signature</h3></div>
                <p class="text-xs text-text-muted mb-3">Sign in the box below.</p>
                <div class="rounded-xl bg-white overflow-hidden border border-white/10"><canvas id="sup-sig-canvas" style="width:100%;height:180px;display:block;touch-action:none;"></canvas></div>
                <div class="flex items-center justify-between mt-4 gap-2">
                    <button id="sup-sig-clear" class="px-4 py-2 rounded-xl text-sm font-medium text-text-muted hover:text-white border border-white/10 transition-colors"><i class="ph ph-eraser mr-1"></i>Clear</button>
                    <div class="flex gap-2">
                        <button id="sup-sig-cancel" class="px-4 py-2 rounded-xl text-sm font-medium text-text-muted hover:text-white border border-white/10 transition-colors">Cancel</button>
                        <button id="sup-sig-apply" class="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105" style="background:linear-gradient(135deg,#10b981,#059669);"><i class="ph-fill ph-check mr-1"></i>Apply Signature</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(sigModal);
        const cv = sigModal.querySelector('#sup-sig-canvas');
        const ratio = window.devicePixelRatio || 1;
        cv.width = cv.offsetWidth * ratio;
        cv.height = cv.offsetHeight * ratio;
        cv.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
        let padInst = null;
        if (window.SignaturePad) padInst = new window.SignaturePad(cv, { penColor: '#0f172a', backgroundColor: 'rgba(255,255,255,0)' });
        sigModal.querySelector('#sup-sig-clear').addEventListener('click', () => padInst?.clear());
        sigModal.querySelector('#sup-sig-cancel').addEventListener('click', () => sigModal.remove());
        sigModal.querySelector('#sup-sig-apply').addEventListener('click', () => {
            if (!padInst || padInst.isEmpty()) { sigModal.remove(); return; }
            const w = cv.width, h = cv.height;
            const ctx = cv.getContext('2d');
            const pixels = ctx.getImageData(0, 0, w, h).data;
            let t = h, l = w, b = 0, r = 0;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pixels[(y * w + x) * 4 + 3] > 10) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; }
            if (b > t && r > l) {
                const pd = 6;
                t = Math.max(0, t - pd); l = Math.max(0, l - pd);
                b = Math.min(h - 1, b + pd); r = Math.min(w - 1, r + pd);
                const tw = r - l + 1, th = b - t + 1;
                const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th;
                tmp.getContext('2d').drawImage(cv, l, t, tw, th, 0, 0, tw, th);
                supervisorSignatureDataUrl = tmp.toDataURL('image/png');
            } else {
                supervisorSignatureDataUrl = cv.toDataURL('image/png');
            }
            // Update on-form signature zone
            const zone = overlay.querySelector('#sup-review-sig-zone');
            if (zone) {
                zone.innerHTML = `<img src="${supervisorSignatureDataUrl}" style="width:100%;height:100%;object-fit:contain;padding:1px;" alt="signature"/>`;
                zone.style.borderColor = 'rgba(16,185,129,0.6)';
                zone.style.borderStyle = 'solid';
                zone.style.background = 'rgba(255,255,255,0.95)';
                zone.style.animation = 'none';
            }
            sigModal.remove();
        });
    };

    // Render the actual PDF form
    const stage = overlay.querySelector('#sup-review-stage');
    const canvas = overlay.querySelector('#sup-review-canvas');
    const revOverlay = overlay.querySelector('#sup-review-overlay');
    const loading = overlay.querySelector('#sup-review-loading');
    const scroll = overlay.querySelector('#sup-review-scroll');

    // State shared between PDF render and sign handler
    let pdfBytes = null;
    let templateBufCopy = null;
    let supSigRect = null;
    let traineeSigRect = null;
    let pageH = 0;
    let formReady = false;

    try {
        if (!window.pdfjsLib || !window.PDFLib) throw new Error('PDF libraries not loaded');

        if (pdfUrl) {
            const resp = await fetch(pdfUrl);
            if (!resp.ok) throw new Error('Could not load submitted PDF');
            pdfBytes = await resp.arrayBuffer();
        } else {
            throw new Error('No submitted PDF found for this M-FVF.');
        }

        const pdfjsDoc = await window.pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        const page = await pdfjsDoc.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const avail = (scroll?.clientWidth || 900) - 48;
        let scale = Math.max(1.0, Math.min(avail / baseViewport.width, 2.0));

        const viewport = page.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        stage.style.width = viewport.width + 'px';
        stage.style.height = viewport.height + 'px';
        const ctx2d = canvas.getContext('2d');
        ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({ canvasContext: ctx2d, viewport }).promise;

        // Load the TEMPLATE to discover field positions for supervisor signature + date zones
        const templateResp = await fetch('mfvf-template.pdf');
        const templateBuf = await templateResp.arrayBuffer();
        templateBufCopy = templateBuf.slice(0);
        const { PDFDocument, PDFSignature, PDFTextField } = window.PDFLib;
        const templateDoc = await PDFDocument.load(templateBuf);
        const templateForm = templateDoc.getForm();
        const templateFields = templateForm.getFields();
        pageH = baseViewport.height;

        for (const f of templateFields) {
            const name = f.getName();
            const isSig = PDFSignature && f instanceof PDFSignature;
            const isText = PDFTextField && f instanceof PDFTextField;
            let widgets = [];
            try { widgets = f.acroField.getWidgets(); } catch (e) {}
            const w0 = widgets[0];
            if (!w0) continue;
            const r = w0.getRectangle();

            if (isSig && name === 'TRAINEE_SIGNATURE') {
                traineeSigRect = r;
            } else if (isSig && name !== 'TRAINEE_SIGNATURE') {
                supSigRect = r;
                const left = r.x * scale, top = (pageH - (r.y + r.height)) * scale;
                const width = r.width * scale, height = r.height * scale;
                const zone = document.createElement('div');
                zone.id = 'sup-review-sig-zone';
                zone.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;border:2.5px dashed rgba(16,185,129,0.7);background:rgba(16,185,129,0.12);cursor:pointer;border-radius:4px;display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:10;animation:pulse 2s infinite;`;
                zone.innerHTML = '<span class="text-sm text-emerald-400 font-bold"><i class="ph-fill ph-pen-nib mr-1.5"></i>Click here to sign</span>';
                zone.addEventListener('click', openSupSignaturePad);
                revOverlay.appendChild(zone);
            } else if (isText && name === 'SUPERVISOR_SIGNATURE_DATE') {
                const left = r.x * scale, top = (pageH - (r.y + r.height)) * scale;
                const width = r.width * scale, height = r.height * scale;
                const dateInput = document.createElement('input');
                dateInput.type = 'date';
                dateInput.id = 'sup-review-date';
                dateInput.value = dayjs().format('YYYY-MM-DD');
                dateInput.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;background:rgba(255,255,255,0.9);border:2px solid rgba(16,185,129,0.5);border-radius:4px;color:#000;font-size:${Math.max(9, Math.min(height * 0.65, 13))}px;text-align:center;outline:none;pointer-events:auto;z-index:10;padding:0 2px;cursor:pointer;font-weight:500;`;
                dateInput.addEventListener('focus', () => { dateInput.style.borderColor = 'rgba(16,185,129,0.8)'; dateInput.style.background = 'rgba(255,255,255,1)'; });
                dateInput.addEventListener('blur', () => { dateInput.style.borderColor = 'rgba(16,185,129,0.5)'; dateInput.style.background = 'rgba(255,255,255,0.9)'; });
                revOverlay.appendChild(dateInput);
            }
        }

        loading.classList.add('hidden');
        stage.style.display = 'block';
        formReady = true;
    } catch (err) {
        console.error('Review modal render failed:', err);
        loading.innerHTML = `<div class="text-center text-red-400"><i class="ph ph-warning-circle text-3xl mb-2"></i><p class="text-sm">Failed to load form: ${err.message}</p></div>`;
    }

    // Sign & Return handler — attached outside try so it always exists
    signBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[M-FVF Sign] Button clicked. formReady:', formReady, 'hasSig:', !!supervisorSignatureDataUrl);
        if (!formReady) {
            await CustomModal.alert('The form has not finished loading. Please wait or close and try again.', 'Not Ready');
            return;
        }
        if (!supervisorSignatureDataUrl) {
            await CustomModal.alert('Please click the green signature box on the form to draw your signature first.', 'Signature Required');
            return;
        }
        const finalSupName = overlay.querySelector('#sup-review-name')?.value?.trim() || profileData.name || '';
        const finalSupCert = overlay.querySelector('#sup-review-cert')?.value?.trim() || '';
        const dateEl = overlay.querySelector('#sup-review-date');
        const supDateVal = dateEl?.value || dayjs().format('YYYY-MM-DD');
        const supDateFormatted = dayjs(supDateVal).format('MM/DD/YYYY');

        if (!finalSupName) {
            await CustomModal.alert('Please enter your name in the top bar before signing.', 'Name Required');
            return;
        }

        const confirmed = await CustomModal.confirm(
            `Sign and return this M-FVF to ${request.traineeName || 'the trainee'}?\n\nSupervisor: ${finalSupName}\nDate: ${supDateFormatted}\nMonth: ${request.monthLabel || month}`,
            'Confirm Sign & Return'
        );
        if (!confirmed) return;

        signBtn.disabled = true;
        signBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin text-sm mr-1"></i>Signing...';

        try {
            if (!templateBufCopy) throw new Error('Template PDF not available — please close and reopen.');
            if (!storage) throw new Error('Storage not initialized — please refresh the page.');

            const { PDFDocument: PDFDoc } = window.PDFLib;
            console.log('[M-FVF Sign] Loading template for final PDF...');
            const finalDoc = await PDFDoc.load(templateBufCopy.slice(0));
            const finalForm = finalDoc.getForm();
            const finalPage = finalDoc.getPages()[0];

            // Fill form fields from the verification record's submitted data
            const fd = request.formData || {};
            console.log('[M-FVF Sign] Form data:', JSON.stringify(fd));
            const fmtHH = (v) => { const n = parseFloat(v) || 0; return String(Math.floor(n)).padStart(2, '0'); };
            const fmtMM = (v) => { const n = parseFloat(v) || 0; return String(Math.round((n % 1) * 60)).padStart(2, '0'); };

            const fieldMap = {
                'TRAINEE_NAME': request.traineeName || '',
                'TRAINEE_BACB_ID': request.bacbId || '',
                'TRAINEE_CERTIFICATE_MONTH/YEAR': month ? dayjs(month + '-01').format('MM/YYYY') : '',
                'TRAINEE_FIELDWORK_STATE': fd.state || '',
                'TRAINEE_FIELDWORK_COUNTRY': fd.country || 'United States',
                'RESPONSIBLE_SUPERVISOR_NAME': finalSupName,
                'RESPONSIBLE_SUPERVISOR_BACB_ID': finalSupCert,
                'Independent_Hours': fmtHH(fd.independentHours),
                'Independent_Minutes': fmtMM(fd.independentHours),
                'Supervised_Hours': fmtHH(fd.supervisedHours),
                'Supervised_Minutes': fmtMM(fd.supervisedHours),
                'Total_Fieldwork_Hours': fmtHH(fd.totalHours),
                'Total_Fieldwork_Minutes': fmtMM(fd.totalHours),
                'PERCENT_HOURS_SUPERVISED': fd.supervisionPercentage != null ? parseFloat(fd.supervisionPercentage).toFixed(2) + '%' : '',
                'Observation_Hours': fmtHH((parseFloat(fd.observationMinutes) || 0) / 60),
                'Independent_Minutes 3': String(Math.round((parseFloat(fd.observationMinutes) || 0) % 60)).padStart(2, '0'),
                'TRAINEE_SIGNATURE_DATE': request.traineeSubmittedAt ? dayjs(request.traineeSubmittedAt).format('MM/DD/YYYY') : (request.savedAt ? dayjs(request.savedAt).format('MM/DD/YYYY') : ''),
                'SUPERVISOR_SIGNATURE_DATE': supDateFormatted
            };
            let filledCount = 0;
            for (const [name, val] of Object.entries(fieldMap)) {
                if (!val) continue;
                try { finalForm.getTextField(name).setText(val); filledCount++; } catch (e) { console.warn(`[M-FVF Sign] Could not fill field "${name}":`, e.message); }
            }
            console.log(`[M-FVF Sign] Filled ${filledCount} fields`);

            // Embed trainee signature
            if (traineeSigRect) {
                let traineeImgUrl = request.traineeSignatureDataUrl;
                if (!traineeImgUrl && pdfUrl && pdfBytes) {
                    try {
                        console.log('[M-FVF Sign] Extracting trainee signature from submitted PDF...');
                        const sigScale = 3;
                        const sigPage = await (await window.pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise).getPage(1);
                        const sigVp = sigPage.getViewport({ scale: sigScale });
                        const fullCanvas = document.createElement('canvas');
                        fullCanvas.width = sigVp.width;
                        fullCanvas.height = sigVp.height;
                        await sigPage.render({ canvasContext: fullCanvas.getContext('2d'), viewport: sigVp }).promise;
                        const cropCanvas = document.createElement('canvas');
                        cropCanvas.width = traineeSigRect.width * sigScale;
                        cropCanvas.height = traineeSigRect.height * sigScale;
                        cropCanvas.getContext('2d').drawImage(fullCanvas, traineeSigRect.x * sigScale, (pageH - (traineeSigRect.y + traineeSigRect.height)) * sigScale, cropCanvas.width, cropCanvas.height, 0, 0, cropCanvas.width, cropCanvas.height);
                        traineeImgUrl = cropCanvas.toDataURL('image/png');
                    } catch (sigErr) { console.warn('[M-FVF Sign] Could not extract trainee signature:', sigErr); }
                }
                if (traineeImgUrl) {
                    try {
                        const traineePng = await finalDoc.embedPng(traineeImgUrl);
                        const tr = traineeSigRect;
                        const maxW = tr.width, maxH = tr.height;
                        const ar = traineePng.width / traineePng.height;
                        let dw = maxW, dh = dw / ar;
                        if (dh > maxH) { dh = maxH; dw = dh * ar; }
                        finalPage.drawImage(traineePng, { x: tr.x + (tr.width - dw) / 2, y: tr.y + (tr.height - dh) / 2, width: dw, height: dh });
                        console.log('[M-FVF Sign] Trainee signature embedded');
                    } catch (e) { console.warn('[M-FVF Sign] Failed to embed trainee signature:', e); }
                }
            }

            // Embed supervisor signature
            if (supSigRect && supervisorSignatureDataUrl) {
                const supPng = await finalDoc.embedPng(supervisorSignatureDataUrl);
                const sr = supSigRect;
                const maxW = sr.width, maxH = sr.height;
                const ar = supPng.width / supPng.height;
                let dw = maxW, dh = dw / ar;
                if (dh > maxH) { dh = maxH; dw = dh * ar; }
                finalPage.drawImage(supPng, { x: sr.x + (sr.width - dw) / 2, y: sr.y + (sr.height - dh) / 2, width: dw, height: dh });
                console.log('[M-FVF Sign] Supervisor signature embedded');
            }

            try { finalForm.flatten(); } catch (e) { console.warn('[M-FVF Sign] Flatten warning:', e.message); }
            const signedBytes = await finalDoc.save();
            const signedBlob = new Blob([signedBytes], { type: 'application/pdf' });
            console.log(`[M-FVF Sign] Final PDF generated: ${signedBytes.byteLength} bytes`);

            // Upload signed PDF
            const signedPath = `mfvf/${traineeId}/${month}/signed.pdf`;
            console.log(`[M-FVF Sign] Uploading to ${signedPath}...`);
            const signedRef = storageRef(storage, signedPath);
            await uploadBytes(signedRef, signedBlob, { contentType: 'application/pdf' });
            const signedUrl = await getDownloadURL(signedRef);
            console.log('[M-FVF Sign] Upload complete:', signedUrl);

            // Update Firestore
            const signedAt = new Date().toISOString();
            await setDoc(getMfvfVerificationRef(traineeId, month), {
                status: 'signed',
                signedAt,
                signedPdfUrl: signedUrl,
                signedPdfPath: signedPath,
                supervisorId: userId,
                supervisorSignatureName: finalSupName,
                supervisorSignedDate: supDateFormatted,
                signedBySupervisorId: userId,
                signedBySupervisorName: finalSupName,
                supervisorComments: '',
                updatedAt: signedAt
            }, { merge: true });
            console.log('[M-FVF Sign] Firestore updated');

            // Notify trainee via chat
            try {
                await notifyMfvfTrainee(request, `${finalSupName || 'Your supervisor'} signed and returned your ${request.monthLabel || dayjs(month).format('MMMM YYYY')} M-FVF.`, 'mfvf_signed');
                console.log('[M-FVF Sign] Trainee notified');
            } catch (notifyErr) { console.warn('[M-FVF Sign] Notification failed (non-critical):', notifyErr); }

            // Close the review modal
            overlay.remove();
            document.body.style.overflow = '';

            // Show success
            await CustomModal.alert('Form was sent to trainee.', 'Signed & Returned');

            // Refresh the supervisor view
            if (supervisorCache.entries[traineeId]) delete supervisorCache.entries[traineeId];
            if (supervisorCache.verifications[traineeId]) delete supervisorCache.verifications[traineeId];
            if (typeof renderMfvfQueue === 'function') renderMfvfQueue();
            if (typeof selectTrainee === 'function' && selectedTraineeId) selectTrainee(selectedTraineeId);
        } catch (err) {
            console.error('[M-FVF Sign] ERROR:', err);
            signBtn.disabled = false;
            signBtn.innerHTML = '<i class="ph ph-check-circle mr-1"></i>Sign & Return to Trainee';
            await CustomModal.alert('Failed to sign and return the form.\n\nError: ' + err.message + '\n\nPlease check your connection and try again.', 'Sign Error');
        }
    });
};


const setupSupervisorListeners = () => {
    updateSupervisorDashboard();

    document.getElementById('add-trainee-btn')?.addEventListener('click', async () => {
        await CustomModal.alert("Trainees must add your email in their Settings > Profile to link with you.", "Link Trainee");
        updateSupervisorDashboard();
    });
    document.getElementById('back-to-trainees-btn')?.addEventListener('click', showTraineeList);
    document.getElementById('review-table-body')?.addEventListener('click', handleTableClick);
    document.getElementById('feedback-entries-list')?.addEventListener('click', handleTableClick);

    document.getElementById('review-tabs')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.review-tab-btn');
        if (btn) switchReviewTab(btn.dataset.tab);
    });
};

const notifyMfvfTrainee = async (request, text, systemType) => {
    if (!request?.traineeId || !userId) return;
    try {
        const chatRef = doc(db, `users/${request.traineeId}/chats/${userId}`);
        const messagesRef = collection(db, `users/${request.traineeId}/chats/${userId}/messages`);
        await setDoc(chatRef, {
            traineeName: request.traineeName || 'Trainee',
            traineeEmail: request.traineeEmail || '',
            supervisorName: profileData.name || 'Supervisor',
            supervisorEmail: profileData.email || auth.currentUser?.email || '',
            lastMessageText: text,
            lastMessageAt: serverTimestamp(),
            lastSenderId: userId
        }, { merge: true });
        await addDoc(messagesRef, {
            text, senderId: userId, senderName: profileData.name || 'Supervisor',
            timestamp: serverTimestamp(), systemType, month: request.month
        });
    } catch (error) { console.error("Error sending notification to trainee:", error); }
};

const signMfvfRequest = async (month, request) => {
    if (!selectedTraineeId || !month || !request) return;
    if (request.status === 'signed') { await CustomModal.alert('This M-FVF is already signed. Use the review modal instead.', 'Already Signed'); return; }
    const signatureName = await CustomModal.prompt("Type your full legal name to sign and return this M-FVF:", profileData.name || '', "Sign M-FVF");
    if (!signatureName || !signatureName.trim()) return;
    try {
        const signedAt = new Date().toISOString();
        await setDoc(getMfvfVerificationRef(selectedTraineeId, month), {
            status: 'signed', signedAt, supervisorId: userId,
            supervisorName: profileData.name || request.supervisorName || 'Supervisor',
            supervisorSignatureName: signatureName.trim(), supervisorComments: '', updatedAt: signedAt
        }, { merge: true });
        await notifyMfvfTrainee(request, `${profileData.name || 'Your supervisor'} signed and returned your ${request.monthLabel || dayjs(month).format('MMMM YYYY')} M-FVF.`, 'mfvf_signed');
        await CustomModal.alert("M-FVF signed and returned to the trainee.", "Signed");
        selectTrainee(selectedTraineeId);
    } catch (error) {
        console.error("Error signing M-FVF:", error);
        await CustomModal.alert("Failed to sign M-FVF: " + error.message, "Sign Error");
    }
};

const requestMfvfChanges = async (month, request) => {
    if (!selectedTraineeId || !month || !request) return;
    const comments = await CustomModal.prompt("What should the trainee change before you sign?", request.supervisorComments || '', "Request Changes");
    if (comments === null) return;
    try {
        await setDoc(getMfvfVerificationRef(selectedTraineeId, month), {
            status: 'changes_requested', supervisorComments: comments.trim(),
            reviewedAt: new Date().toISOString(), supervisorId: userId,
            supervisorName: profileData.name || request.supervisorName || 'Supervisor', updatedAt: new Date().toISOString()
        }, { merge: true });
        await notifyMfvfTrainee(request, `${profileData.name || 'Your supervisor'} requested changes on your ${request.monthLabel || dayjs(month).format('MMMM YYYY')} M-FVF.`, 'mfvf_changes_requested');
        await CustomModal.alert("Change request sent to the trainee.", "Changes Requested");
        selectTrainee(selectedTraineeId);
    } catch (error) {
        console.error("Error requesting M-FVF changes:", error);
        await CustomModal.alert("Failed to request changes: " + error.message, "Request Error");
    }
};

// --- M-FVF Center ---

const loadArchivedMfvfList = async () => {
    if (!userId || userId === 'guest') return;

    const container = document.getElementById('archived-mfvf-list');
    if (!container) return;

    try {
        const verificationsRef = collection(db, 'users', userId, 'verifications');
        const querySnapshot = await getDocs(verificationsRef);

        if (querySnapshot.empty) {
            container.innerHTML = `
                <div class="glass-panel rounded-xl p-10 text-center text-text-muted">
                    <i class="ph ph-files text-5xl mb-3 opacity-40"></i>
                    <p class="text-sm">No verification forms yet. Open the M-FVF editor to create one.</p>
                </div>
            `;
            return;
        }

        const verifications = [];
        querySnapshot.forEach(doc => {
            verifications.push({ id: doc.id, ...doc.data() });
        });
        verifications.sort((a, b) => (b.month || '').localeCompare(a.month || ''));

        // Counts
        const counts = { all: verifications.length, draft: 0, submitted: 0, changes_requested: 0, signed: 0 };
        verifications.forEach(v => { if (counts[v.status] !== undefined) counts[v.status]++; });

        // Status strip colors
        const stripColor = { draft: '#3b82f6', submitted: '#f59e0b', changes_requested: '#f97316', signed: '#22c55e', not_started: '#64748b' };
        const statusLabel = { draft: 'Draft', submitted: 'Sent to Supervisor', changes_requested: 'Needs Correction', signed: 'Signed & Returned', not_started: 'Not Started' };
        const statusBadgeClass = {
            draft: 'text-blue-300 bg-blue-500/15 border-blue-500/25',
            submitted: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
            changes_requested: 'text-orange-300 bg-orange-500/15 border-orange-500/25',
            signed: 'text-green-300 bg-green-500/15 border-green-500/25',
            not_started: 'text-slate-300 bg-slate-500/15 border-slate-500/25'
        };

        // Group by year
        const byYear = {};
        verifications.forEach(v => {
            const yr = v.month ? v.month.substring(0, 4) : 'Unknown';
            if (!byYear[yr]) byYear[yr] = [];
            byYear[yr].push(v);
        });
        const years = Object.keys(byYear).sort().reverse();

        // Card renderer
        const renderCard = (v) => {
            const st = v.status || 'not_started';
            const isSigned = st === 'signed';
            const isDraft = st === 'draft' || st === 'not_started';
            const isSent = st === 'submitted';
            const isCorrection = st === 'changes_requested';
            const strip = stripColor[st] || stripColor.not_started;
            const badge = statusBadgeClass[st] || statusBadgeClass.not_started;
            const label = statusLabel[st] || 'Unknown';
            const pdfUrl = v.signedPdfUrl || v.submittedPdfUrl || v.draftPdfUrl || '';
            const monthDisplay = v.monthLabel || (v.month ? dayjs(v.month + '-01').format('MMMM YYYY') : v.month);
            const totalHrs = v.formData?.totalHours;
            const supPct = v.formData?.supervisionPercentage;
            const dateStr = dayjs(v.traineeSubmittedAt || v.savedAt || v.updatedAt).format('MMM D, YYYY');

            let actions = '';
            if (isDraft) {
                actions = `
                    ${pdfUrl ? `<button class="archived-download-btn mfvf-act-btn" data-month="${v.month}" data-url="${pdfUrl}" title="View PDF"><i class="ph ph-eye text-sm mr-1"></i>Open</button>` : ''}
                    <button class="archived-send-btn mfvf-act-btn mfvf-act-primary" data-month="${v.month}"><i class="ph ph-paper-plane-tilt text-sm mr-1"></i>Send</button>
                    <button class="archived-delete-btn mfvf-act-icon text-red-400 hover:text-red-300 hover:bg-red-500/10" data-month="${v.month}" title="Delete Draft"><i class="ph ph-trash"></i></button>
                `;
            } else if (isSent) {
                actions = `
                    ${pdfUrl ? `<button class="archived-download-btn mfvf-act-btn" data-month="${v.month}" data-url="${pdfUrl}" title="View PDF"><i class="ph ph-eye text-sm mr-1"></i>View PDF</button>` : ''}
                    <button class="archived-cancel-btn mfvf-act-btn mfvf-act-warn" data-month="${v.month}"><i class="ph ph-x-circle text-sm mr-1"></i>Cancel</button>
                `;
            } else if (isCorrection) {
                actions = `
                    ${pdfUrl ? `<button class="archived-download-btn mfvf-act-btn" data-month="${v.month}" data-url="${pdfUrl}" title="Open & Fix"><i class="ph ph-pencil-simple text-sm mr-1"></i>Open & Fix</button>` : ''}
                    <button class="archived-send-btn mfvf-act-btn mfvf-act-primary" data-month="${v.month}"><i class="ph ph-paper-plane-tilt text-sm mr-1"></i>Resend</button>
                `;
            } else if (isSigned) {
                actions = `
                    <button class="archived-download-btn mfvf-act-btn mfvf-act-signed" data-month="${v.month}" data-url="${v.signedPdfUrl || pdfUrl}"><i class="ph ph-file-pdf text-sm mr-1"></i>Open Signed PDF</button>
                    ${pdfUrl ? `<a href="${pdfUrl}" target="_blank" rel="noopener noreferrer" class="mfvf-act-icon text-text-muted hover:text-white" title="Download"><i class="ph ph-download-simple"></i></a>` : ''}
                    <button class="archived-correction-btn mfvf-act-btn mfvf-act-outline" data-month="${v.month}" data-supervisor-id="${v.supervisorId || ''}"><i class="ph ph-pencil-simple text-sm mr-1"></i>Request Correction</button>
                `;
            }

            let signedBanner = '';
            if (isSigned) {
                const sigName = v.supervisorSignatureName || v.signedBySupervisorName || v.supervisorName || 'Supervisor';
                const sigDate = v.supervisorSignedDate || (v.signedAt ? dayjs(v.signedAt).format('MMM D, YYYY') : '');
                signedBanner = `
                    <div class="flex items-center gap-3 mt-2.5 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/15">
                        <i class="ph-fill ph-seal-check text-green-400 text-base flex-shrink-0"></i>
                        <div class="text-[11px] leading-snug">
                            <span class="text-green-300 font-semibold">Signed by ${sigName}</span>
                            ${sigDate ? `<span class="text-green-400/60 mx-1.5">&middot;</span><span class="text-green-400/70">Returned ${sigDate}</span>` : ''}
                            <span class="text-green-400/60 mx-1.5">&middot;</span><span class="text-green-400/70">Both signatures included</span>
                        </div>
                    </div>`;
            }

            let correctionBanner = '';
            if (isCorrection && (v.supervisorComments || v.correctionReason)) {
                correctionBanner = `
                    <div class="flex items-start gap-2.5 mt-2.5 px-3 py-2 rounded-lg bg-orange-500/8 border border-orange-500/15">
                        <i class="ph-fill ph-chat-teardrop-text text-orange-400 text-sm flex-shrink-0 mt-0.5"></i>
                        <p class="text-[11px] text-orange-200/80 leading-snug">${v.supervisorComments || v.correctionReason}</p>
                    </div>`;
            }

            return `
                <div class="mfvf-card group" data-status="${st}">
                    <div class="mfvf-card-strip" style="background:${strip};"></div>
                    <div class="mfvf-card-thumb">
                        <i class="ph${isSigned ? '-fill' : ''} ph-${isSigned ? 'seal-check' : 'file-pdf'} text-xl ${isSigned ? 'text-green-400' : 'text-slate-400'}"></i>
                    </div>
                    <div class="mfvf-card-body">
                        <div class="flex items-center gap-2 mb-0.5">
                            <span class="text-sm font-bold text-white leading-tight">${monthDisplay}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${badge}">${label}</span>
                        </div>
                        <div class="flex items-center gap-4 text-[11px] text-text-muted mt-1 flex-wrap">
                            <span><span class="text-text-muted/60">Supervisor:</span> <span class="text-slate-300">${v.supervisorName || '-'}</span></span>
                            <span><span class="text-text-muted/60">Hours:</span> <span class="text-slate-300">${totalHrs != null ? parseFloat(totalHrs).toFixed(1) : '-'}</span></span>
                            <span><span class="text-text-muted/60">Supervised:</span> <span class="text-slate-300">${supPct != null ? parseFloat(supPct).toFixed(1) + '%' : '-'}</span></span>
                            <span><span class="text-text-muted/60">${v.traineeSubmittedAt ? 'Sent' : 'Saved'}:</span> <span class="text-slate-300">${dateStr}</span></span>
                        </div>
                        ${signedBanner}${correctionBanner}
                    </div>
                    <div class="mfvf-card-actions">${actions}</div>
                </div>
            `;
        };

        // Build full HTML
        let html = '';

        // Tabs
        const tabs = [
            { key: 'all', label: 'All', count: counts.all },
            { key: 'draft', label: 'Drafts', count: counts.draft },
            { key: 'submitted', label: 'Sent', count: counts.submitted },
            { key: 'changes_requested', label: 'Needs Correction', count: counts.changes_requested },
            { key: 'signed', label: 'Signed', count: counts.signed }
        ];
        html += `<div class="flex items-center gap-1.5 mb-4 flex-wrap" id="mfvf-center-tabs">`;
        tabs.forEach(t => {
            html += `<button class="mfvf-tab ${t.key === 'all' ? 'mfvf-tab-active' : ''}" data-filter="${t.key}">${t.label}${t.count > 0 ? ` <span class="mfvf-tab-count">${t.count}</span>` : ''}</button>`;
        });
        html += `</div>`;

        // Summary pills
        html += `<div class="flex items-center gap-2.5 mb-5 flex-wrap">
            <span class="mfvf-pill" style="--pill-color:#22c55e;"><span class="mfvf-pill-dot"></span>${counts.signed} Signed</span>
            <span class="mfvf-pill" style="--pill-color:#3b82f6;"><span class="mfvf-pill-dot"></span>${counts.draft} Draft</span>
            <span class="mfvf-pill" style="--pill-color:#f59e0b;"><span class="mfvf-pill-dot"></span>${counts.submitted} Waiting</span>
            <span class="mfvf-pill" style="--pill-color:#f97316;"><span class="mfvf-pill-dot"></span>${counts.changes_requested} Correction</span>
        </div>`;

        // Cards grouped by year
        years.forEach(yr => {
            html += `<div class="mfvf-year-group" data-year="${yr}">
                <div class="flex items-center gap-2 mb-3 mt-2">
                    <span class="text-xs font-bold text-text-muted/50 uppercase tracking-widest">${yr}</span>
                    <div class="flex-1 h-px bg-white/5"></div>
                </div>
                <div class="space-y-2">${byYear[yr].map(renderCard).join('')}</div>
            </div>`;
        });

        container.innerHTML = html;

        // Tab filtering
        container.querySelectorAll('.mfvf-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.mfvf-tab').forEach(t => t.classList.remove('mfvf-tab-active'));
                tab.classList.add('mfvf-tab-active');
                const filter = tab.dataset.filter;
                container.querySelectorAll('.mfvf-card').forEach(card => {
                    if (filter === 'all') { card.style.display = ''; }
                    else {
                        const match = card.dataset.status === filter || (filter === 'draft' && card.dataset.status === 'not_started');
                        card.style.display = match ? '' : 'none';
                    }
                });
                container.querySelectorAll('.mfvf-year-group').forEach(grp => {
                    const visible = grp.querySelectorAll('.mfvf-card:not([style*="display: none"])');
                    grp.style.display = visible.length ? '' : 'none';
                });
            });
        });

        // Wire all action buttons
        container.querySelectorAll('.archived-send-btn').forEach(btn => {
            btn.addEventListener('click', () => openArchivedSendModal(btn.dataset.month, verifications));
        });
        container.querySelectorAll('.archived-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await CustomModal.confirm('Delete this draft M-FVF? This cannot be undone.', 'Delete Draft');
                if (!ok) return;
                try {
                    await deleteDoc(getMfvfVerificationRef(userId, btn.dataset.month));
                    loadArchivedMfvfList();
                } catch (e) { await CustomModal.alert('Failed to delete: ' + e.message, 'Error'); }
            });
        });
        container.querySelectorAll('.archived-cancel-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await CustomModal.confirm('Cancel this submission and return to draft? The supervisor will no longer see it in their queue.', 'Cancel Request');
                if (!ok) return;
                try {
                    await setDoc(getMfvfVerificationRef(userId, btn.dataset.month), {
                        status: 'draft', traineeSubmittedAt: '', submittedPdfUrl: '', submittedPdfPath: '',
                        supervisorComments: '', updatedAt: new Date().toISOString()
                    }, { merge: true });
                    loadArchivedMfvfList();
                } catch (e) { await CustomModal.alert('Failed to cancel: ' + e.message, 'Error'); }
            });
        });
        container.querySelectorAll('.archived-download-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) window.open(url, '_blank', 'noopener,noreferrer');
                else CustomModal.alert('No PDF available.', 'Not Found');
            });
        });
        container.querySelectorAll('.archived-correction-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reason = await CustomModal.prompt('What needs to be corrected? The supervisor will be notified.', '', 'Request Correction');
                if (!reason || !reason.trim()) return;
                const m = btn.dataset.month;
                const v = verifications.find(x => x.month === m);
                if (!v) return;
                try {
                    await setDoc(getMfvfVerificationRef(userId, m), {
                        status: 'changes_requested',
                        correctionRequestedAt: new Date().toISOString(),
                        correctionReason: reason.trim(),
                        updatedAt: new Date().toISOString()
                    }, { merge: true });
                    const supId = v.supervisorId || btn.dataset.supervisorId;
                    if (supId) {
                        const chatRef = doc(db, `users/${userId}/chats/${supId}`);
                        const messagesRef = collection(db, `users/${userId}/chats/${supId}/messages`);
                        await setDoc(chatRef, { lastMessageText: `Correction requested for ${v.monthLabel || m} M-FVF`, lastMessageAt: serverTimestamp(), lastSenderId: userId }, { merge: true });
                        await addDoc(messagesRef, { text: `Correction requested for ${v.monthLabel || m} M-FVF: ${reason.trim()}`, senderId: userId, senderName: profileData.name || 'Trainee', timestamp: serverTimestamp(), systemType: 'mfvf_correction_request', month: m });
                    }
                    await CustomModal.alert('Correction request sent to your supervisor.', 'Sent');
                    loadArchivedMfvfList();
                } catch (e) { await CustomModal.alert('Failed to send: ' + e.message, 'Error'); }
            });
        });
    } catch (err) {
        console.error('Error loading M-FVF Center:', err);
        container.innerHTML = `
            <div class="glass-panel rounded-xl p-8 text-center text-red-400">
                <i class="ph ph-warning-circle text-4xl mb-3"></i>
                <p>Error loading forms</p>
            </div>
        `;
    }
};


const openArchivedSendModal = (month, verifications) => {
    const v = verifications.find(x => x.month === month);
    if (!v) return;
    const supervisors = profileData.supervisors || [];
    const isLight = document.body.classList.contains('light-mode');
    const [statusLabel] = getMfvfStatusConfig(v.status);
    const isResend = v.status === 'submitted' || v.status === 'changes_requested';

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-md modal-fade-in p-4';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const cardBg = isLight ? 'bg-white' : 'bg-slate-900';
    const borderCol = isLight ? 'border-slate-200' : 'border-white/10';
    const textTitle = isLight ? 'text-slate-900' : 'text-white';
    const textBody = isLight ? 'text-slate-600' : 'text-slate-300';

    overlay.innerHTML = `
        <div class="p-6 rounded-2xl max-w-md w-full border ${borderCol} ${cardBg} transform modal-scale-up" style="box-shadow: 0 25px 50px -12px rgba(0,0,0,0.45);">
            <div class="flex items-center gap-3 mb-5">
                <div class="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary"><i class="ph ph-paper-plane-tilt text-xl"></i></div>
                <div>
                    <h3 class="text-lg font-bold ${textTitle}">${isResend ? 'Resend' : 'Send'} M-FVF</h3>
                    <p class="text-xs ${textBody}">${v.monthLabel || dayjs(month).format('MMMM YYYY')} — ${statusLabel}</p>
                </div>
            </div>
            ${isResend ? `<div class="rounded-lg p-3 mb-4 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2"><i class="ph ph-info mt-0.5"></i><span>This form was already sent to <strong>${v.supervisorName || 'a supervisor'}</strong>. You can resend to the same or choose a different supervisor.</span></div>` : ''}
            <div class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold ${textBody} mb-1.5">Supervisor</label>
                    ${supervisors.length > 0 ? `
                        <select id="archived-send-supervisor-select" class="w-full px-3 py-2.5 rounded-xl text-sm ${isLight ? 'bg-slate-100 text-slate-900 border-slate-200' : 'bg-white/5 text-white border-white/10'} border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all">
                            <option value="">Select a supervisor...</option>
                            ${supervisors.map(s => `<option value="${s.name}" ${v.supervisorName === s.name ? 'selected' : ''}>${s.name}${s.email ? ` (${s.email})` : ''}</option>`).join('')}
                        </select>
                    ` : `
                        <div class="rounded-xl p-4 text-center ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-text-muted'} text-sm">
                            <i class="ph ph-user-circle-minus text-xl mb-1 block"></i>
                            No supervisors available. Add a supervisor in Settings > Profile.
                        </div>
                    `}
                </div>
                <div>
                    <label class="block text-xs font-semibold ${textBody} mb-1.5">Message (optional)</label>
                    <textarea id="archived-send-note" rows="2" placeholder="Add a note for your supervisor..." class="w-full px-3 py-2.5 rounded-xl text-sm ${isLight ? 'bg-slate-100 text-slate-900 border-slate-200' : 'bg-white/5 text-white border-white/10'} border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none">${v.traineeNote || ''}</textarea>
                </div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
                <button id="archived-send-cancel" class="px-4 py-2.5 rounded-xl text-sm font-semibold ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/5 hover:bg-white/10 text-white'} border ${borderCol} transition-all">Cancel</button>
                <button id="archived-send-confirm" class="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-white transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed" ${supervisors.length === 0 ? 'disabled' : ''}>
                    <i class="ph ph-paper-plane-tilt mr-1.5"></i>Send
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const select = document.getElementById('archived-send-supervisor-select');
    const sendBtn = document.getElementById('archived-send-confirm');
    const cancelBtn = document.getElementById('archived-send-cancel');

    if (select && sendBtn) {
        const updateDisabled = () => { sendBtn.disabled = !select.value; };
        updateDisabled();
        select.addEventListener('change', updateDisabled);
    }

    cancelBtn?.addEventListener('click', () => overlay.remove());

    sendBtn?.addEventListener('click', async () => {
        if (!select?.value) return;
        const supervisor = supervisors.find(s => s.name === select.value);
        if (!supervisor) return;
        const traineeNote = document.getElementById('archived-send-note')?.value?.trim() || '';

        const isDifferentSup = isResend && v.supervisorName && v.supervisorName !== supervisor.name;
        if (isDifferentSup) {
            const ok = await CustomModal.confirm(
                `This form was previously sent to ${v.supervisorName}. Send to ${supervisor.name} instead?`,
                'Change Supervisor'
            );
            if (!ok) return;
        }

        const originalHtml = sendBtn.innerHTML;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin text-sm"></i> Sending...';

        try {
            let supervisorUid = '';
            if (supervisor.email) {
                try {
                    const q = query(collection(db, 'users'), where('email', '==', supervisor.email.trim()), where('role', '==', 'supervisor'));
                    const snap = await getDocs(q);
                    if (!snap.empty) supervisorUid = snap.docs[0].id;
                } catch (e) { console.warn('Could not resolve supervisor UID:', e); }
            }

            const submittedAt = new Date().toISOString();
            const updateData = {
                status: 'submitted',
                supervisorName: supervisor.name,
                supervisorEmail: supervisor.email || '',
                supervisorCert: supervisor.cert || '',
                supervisorUid,
                traineeId: userId,
                traineeName: profileData.name || 'Trainee',
                traineeEmail: profileData.email || auth.currentUser?.email || '',
                traineeNote,
                traineeSubmittedAt: submittedAt,
                submittedPdfUrl: v.draftPdfUrl || v.submittedPdfUrl || '',
                submittedPdfPath: v.draftPdfPath || v.submittedPdfPath || '',
                submittedPdfName: v.draftPdfName || v.submittedPdfName || '',
                submittedPdfUpdatedAt: submittedAt,
                supervisorComments: '',
                signedPdfPath: '',
                signedPdfUrl: '',
                updatedAt: submittedAt
            };

            await setDoc(getMfvfVerificationRef(userId, month), updateData, { merge: true });

            if (supervisorUid) {
                const chatRef = doc(db, `users/${userId}/chats/${supervisorUid}`);
                const messagesRef = collection(db, `users/${userId}/chats/${supervisorUid}/messages`);
                const msgText = `${profileData.name || 'Trainee'} sent the ${v.monthLabel || dayjs(month).format('MMMM YYYY')} M-FVF for review and signature.`;
                await setDoc(chatRef, {
                    traineeName: profileData.name || 'Trainee',
                    traineeEmail: profileData.email || auth.currentUser?.email || '',
                    supervisorName: supervisor.name,
                    supervisorEmail: supervisor.email || '',
                    lastMessageText: msgText,
                    lastMessageAt: serverTimestamp(),
                    lastSenderId: userId
                }, { merge: true });
                await addDoc(messagesRef, {
                    text: msgText,
                    senderId: userId,
                    senderName: profileData.name || 'Trainee',
                    timestamp: serverTimestamp(),
                    systemType: 'mfvf_submitted',
                    month
                });
            }

            overlay.remove();
            await CustomModal.alert(`M-FVF sent to ${supervisor.name}.`, 'Sent');
            loadArchivedMfvfList();
        } catch (error) {
            console.error('Error sending archived M-FVF:', error);
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalHtml;
            await CustomModal.alert('Failed to send: ' + error.message, 'Send Error');
        }
    });
};

// --- Chat / Messages System ---

const updateChatView = async () => {
    const contactsList = document.getElementById('chat-contacts-list');
    const contactsTitle = document.getElementById('chat-contacts-title');
    if (!contactsList || !userId) return;

    contactsList.innerHTML = '<div class="p-4 text-center text-text-muted text-xs"><i class="ph ph-circle-notch animate-spin"></i> Loading...</div>';

    // Reset active chat pane when loading the list
    document.getElementById('chat-window').classList.add('hidden');
    document.getElementById('chat-placeholder').classList.remove('hidden');
    activeChatContactId = null;

    if (unsubscribeChats) {
        unsubscribeChats();
        unsubscribeChats = null;
    }
    if (supervisorChatsUnsubscribes) {
        supervisorChatsUnsubscribes.forEach(unsub => unsub());
        supervisorChatsUnsubscribes = [];
    }
    if (unsubscribeChatMessages) {
        unsubscribeChatMessages();
        unsubscribeChatMessages = null;
    }

    try {
        if (profileData.role === 'supervisor') {
            contactsTitle.textContent = "Trainees";
            const userEmail = (profileData && profileData.email) || auth.currentUser.email;
            
            // Query for trainees linked to this supervisor
            const q = query(collection(db, 'users'), where('supervisorEmails', 'array-contains', userEmail));
            const querySnapshot = await getDocs(q);
            myTrainees = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

            if (myTrainees.length === 0) {
                contactsList.innerHTML = '<div class="p-4 text-center text-text-muted text-xs">No trainees linked.</div>';
                return;
            }

            const activeChatsMap = {};
            myTrainees.forEach(trainee => {
                const chatDocRef = doc(db, `users/${trainee.id}/chats/${userId}`);
                const unsub = onSnapshot(chatDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        activeChatsMap[trainee.id] = {
                            traineeId: trainee.id,
                            traineeName: trainee.name || 'Unknown Trainee',
                            traineeEmail: trainee.email,
                            ...docSnap.data()
                        };
                    } else {
                        delete activeChatsMap[trainee.id];
                    }
                    renderSupervisorChatsList(activeChatsMap);
                }, (err) => {
                    console.error("Error listening to supervisor chat:", trainee.id, err);
                });
                supervisorChatsUnsubscribes.push(unsub);
            });
        } else {
            contactsTitle.textContent = "Supervisors";
            
            const chatsRef = collection(db, `users/${userId}/chats`);
            unsubscribeChats = onSnapshot(chatsRef, (snapshot) => {
                renderTraineeChatsList(snapshot);
            }, (error) => {
                console.error("Error listening to trainee chats:", error);
                contactsList.innerHTML = `<div class="p-4 text-center text-red-400 text-xs">Error loading chats: ${error.message}</div>`;
            });
        }
    } catch (error) {
        console.error("Error loading chat contacts:", error);
        contactsList.innerHTML = `<div class="p-4 text-center text-red-400 text-xs">Error loading contacts: ${error.message}</div>`;
    }
};

const renderSupervisorChatsList = (activeChatsMap) => {
    const contactsList = document.getElementById('chat-contacts-list');
    if (!contactsList) return;
    
    const activeChats = Object.values(activeChatsMap);
    
    // Sort activeChats by lastMessageAt descending
    activeChats.sort((a, b) => {
        const timeA = a.lastMessageAt ? (a.lastMessageAt.toDate ? a.lastMessageAt.toDate() : new Date(a.lastMessageAt)) : 0;
        const timeB = b.lastMessageAt ? (b.lastMessageAt.toDate ? b.lastMessageAt.toDate() : new Date(b.lastMessageAt)) : 0;
        return timeB - timeA;
    });
    
    if (activeChats.length === 0) {
        contactsList.innerHTML = '<div class="p-4 text-center text-text-muted text-xs">No active chats. Click "+ Start New Chat" to begin.</div>';
        return;
    }
    
    contactsList.innerHTML = activeChats.map(chat => {
        const lastMsg = chat.lastMessageText || 'No messages yet';
        const lastTime = chat.lastMessageAt ? dayjs(chat.lastMessageAt.toDate ? chat.lastMessageAt.toDate() : chat.lastMessageAt).format('h:mm A') : '';
        const isUnread = isUnreadChat(chat.traineeId, chat);
        const activeClass = activeChatContactId === chat.traineeId ? 'active' : '';
        const unreadClass = isUnread && !activeClass ? 'unread' : '';
        return `
            <div class="chat-contact-item ${activeClass} ${unreadClass}" data-id="${chat.traineeId}" data-name="${chat.traineeName}" data-email="${chat.traineeEmail}">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-white font-medium text-sm truncate">${chat.traineeName}</span>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${isUnread && !activeClass ? '<span class="chat-unread-pill">New</span>' : ''}
                        <span class="text-[10px] text-text-muted">${lastTime}</span>
                    </div>
                </div>
                <span class="chat-contact-preview text-text-muted text-xs truncate mt-0.5">${lastMsg}</span>
            </div>
        `;
    }).join('');
    
    // Add click listeners to items
    const contactItems = contactsList.querySelectorAll('.chat-contact-item[data-id]');
    contactItems.forEach(item => {
        item.addEventListener('click', () => {
            contactItems.forEach(c => c.classList.remove('active'));
            item.classList.add('active');
            selectChatContact(item.dataset.id, item.dataset.name, item.dataset.email);
        });
    });

    openFirstUnreadChat(contactsList);
};

const renderTraineeChatsList = (snapshot) => {
    const contactsList = document.getElementById('chat-contacts-list');
    if (!contactsList) return;
    
    if (snapshot.empty) {
        contactsList.innerHTML = '<div class="p-4 text-center text-text-muted text-xs">No active chats. Click "+ Start New Chat" to begin.</div>';
        return;
    }
    
    const chats = [];
    snapshot.forEach(docSnap => {
        chats.push({
            supervisorUid: docSnap.id,
            ...docSnap.data()
        });
    });
    
    // Sort chats by lastMessageAt descending
    chats.sort((a, b) => {
        const timeA = a.lastMessageAt ? (a.lastMessageAt.toDate ? a.lastMessageAt.toDate() : new Date(a.lastMessageAt)) : 0;
        const timeB = b.lastMessageAt ? (b.lastMessageAt.toDate ? b.lastMessageAt.toDate() : new Date(b.lastMessageAt)) : 0;
        return timeB - timeA;
    });
    
    contactsList.innerHTML = chats.map(chat => {
        const lastMsg = chat.lastMessageText || 'No messages yet';
        const lastTime = chat.lastMessageAt ? dayjs(chat.lastMessageAt.toDate ? chat.lastMessageAt.toDate() : chat.lastMessageAt).format('h:mm A') : '';
        const isUnread = isUnreadChat(chat.supervisorUid, chat);
        const activeClass = activeChatContactId === chat.supervisorUid ? 'active' : '';
        const unreadClass = isUnread && !activeClass ? 'unread' : '';
        return `
            <div class="chat-contact-item ${activeClass} ${unreadClass}" data-id="${chat.supervisorUid}" data-name="${chat.supervisorName}" data-email="${chat.supervisorEmail}">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-white font-medium text-sm truncate">${chat.supervisorName}</span>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${isUnread && !activeClass ? '<span class="chat-unread-pill">New</span>' : ''}
                        <span class="text-[10px] text-text-muted">${lastTime}</span>
                    </div>
                </div>
                <span class="chat-contact-preview text-text-muted text-xs truncate mt-0.5">${lastMsg}</span>
            </div>
        `;
    }).join('');
    
    // Add click listeners to items
    const contactItems = contactsList.querySelectorAll('.chat-contact-item[data-id]');
    contactItems.forEach(item => {
        item.addEventListener('click', () => {
            contactItems.forEach(c => c.classList.remove('active'));
            item.classList.add('active');
            selectChatContact(item.dataset.id, item.dataset.name, item.dataset.email);
        });
    });

    openFirstUnreadChat(contactsList);
};

const selectChatContact = (contactId, name, email) => {
    activeChatContactId = contactId;
    markChatRead(contactId);
    const contactItem = document.querySelector(`.chat-contact-item[data-id="${contactId}"]`);
    if (contactItem) {
        contactItem.classList.remove('unread');
        contactItem.querySelector('.chat-unread-pill')?.remove();
    }
    updateNotificationsUI();
    
    document.getElementById('chat-placeholder').classList.add('hidden');
    document.getElementById('chat-window').classList.remove('hidden');
    
    document.getElementById('chat-active-name').textContent = name;
    document.getElementById('chat-active-email').textContent = email;

    // Reset and rebuild the real-time messages listener
    if (unsubscribeChatMessages) {
        unsubscribeChatMessages();
    }

    const traineeUid = (profileData.role === 'trainee' || profileData.role === 'admin') ? userId : activeChatContactId;
    const supervisorUid = profileData.role === 'supervisor' ? userId : activeChatContactId;
    
    const messagesContainer = document.getElementById('chat-messages-container');
    messagesContainer.innerHTML = '<div class="p-4 text-center text-text-muted text-xs"><i class="ph ph-circle-notch animate-spin"></i> Loading messages...</div>';

    const messagesRef = collection(db, `users/${traineeUid}/chats/${supervisorUid}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    unsubscribeChatMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';
        
        if (snapshot.empty) {
            messagesContainer.innerHTML = `
                <div class="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                    <i class="ph ph-chat-centered text-3xl mb-2"></i>
                    <p class="text-xs">No messages yet. Send a message to start the conversation!</p>
                </div>
            `;
            return;
        }

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const isMe = data.senderId === userId;
            const time = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date();
            const timeStr = dayjs(time).format('h:mm A');

            const messageWrapper = document.createElement('div');
            messageWrapper.className = `chat-message-wrapper ${isMe ? 'sent' : 'received'} group`;
            messageWrapper.dataset.messageId = docSnap.id;
            
            let actionsHtml = '';
            if (isMe) {
                actionsHtml = `
                    <div class="message-actions">
                        <button class="edit-msg-btn text-text-muted hover:text-white transition-colors" title="Edit message">
                            <i class="ph ph-pencil text-sm"></i>
                        </button>
                        <button class="delete-msg-btn text-red-400 hover:text-red-300 transition-colors" title="Delete message">
                            <i class="ph ph-trash text-sm"></i>
                        </button>
                    </div>
                `;
            }
            
            messageWrapper.innerHTML = `
                ${actionsHtml}
                <div class="chat-message-bubble ${isMe ? 'sent' : 'received'}">
                    <div class="message-text">${data.text}</div>
                    <div class="chat-message-meta">
                        <span>${timeStr}${data.edited ? ' • Edited' : ''}</span>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(messageWrapper);
        });

        const latestIncomingTime = snapshot.docs.reduce((latest, docSnap) => {
            const data = docSnap.data();
            if (data.senderId === userId || !data.timestamp) return latest;
            const time = data.timestamp.toDate ? data.timestamp.toDate().getTime() : new Date(data.timestamp).getTime();
            return Number.isFinite(time) ? Math.max(latest, time) : latest;
        }, 0);

        if (latestIncomingTime > 0) {
            markChatRead(contactId, latestIncomingTime);
            updateNotificationsUI();
        }

        // Scroll to the bottom of the message container
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }, (error) => {
        console.error("Error listening to chat messages:", error);
        messagesContainer.innerHTML = `<div class="p-4 text-center text-red-400 text-xs">Error loading messages: ${error.message}</div>`;
    });
};

const isUnreadChat = (contactId, chatSummary) => {
    if (!userId || !chatSummary?.lastSenderId || chatSummary.lastSenderId === userId) return false;
    const lastRead = parseInt(localStorage.getItem(`chat_read_${userId}_${contactId}`) || '0', 10);
    const lastMessageTime = getChatTimestamp(chatSummary);
    return lastMessageTime > lastRead;
};

const getChatTimestamp = (chatSummary) => {
    if (!chatSummary?.lastMessageAt) return 0;
    const time = chatSummary.lastMessageAt.toDate ? chatSummary.lastMessageAt.toDate().getTime() : new Date(chatSummary.lastMessageAt).getTime();
    return Number.isFinite(time) ? time : 0;
};

const markChatRead = (contactId, explicitTime = 0) => {
    if (!userId || !contactId) return;
    const summaryTime = getChatTimestamp(globalChatsData[contactId]);
    const readTime = Math.max(Date.now(), explicitTime, summaryTime) + 1;
    localStorage.setItem(`chat_read_${userId}_${contactId}`, readTime.toString());
};

const openFirstUnreadChat = (contactsList) => {
    if (activeChatContactId) return;
    const unreadItem = contactsList.querySelector('.chat-contact-item.unread[data-id]');
    if (!unreadItem) return;
    setTimeout(() => {
        if (!activeChatContactId && unreadItem.isConnected) unreadItem.click();
    }, 0);
};

const sendChatMessage = async (e) => {
    if (e) e.preventDefault();
    const input = document.getElementById('chat-message-input');
    if (!input || !input.value.trim() || !activeChatContactId || !userId) return;

    const text = input.value.trim();
    input.value = ''; // Clear input immediately for responsive UI

    const traineeUid = (profileData.role === 'trainee' || profileData.role === 'admin') ? userId : activeChatContactId;
    const supervisorUid = profileData.role === 'supervisor' ? userId : activeChatContactId;

    const messagesRef = collection(db, `users/${traineeUid}/chats/${supervisorUid}/messages`);
    const summaryDocRef = doc(db, `users/${traineeUid}/chats/${supervisorUid}`);

    try {
        await addDoc(messagesRef, {
            text: text,
            senderId: userId,
            senderName: profileData.name || auth.currentUser.displayName || auth.currentUser.email,
            timestamp: serverTimestamp()
        });

        await setDoc(summaryDocRef, {
            lastMessageText: text,
            lastMessageAt: serverTimestamp(),
            lastSenderId: userId
        }, { merge: true });
    } catch (error) {
        console.error("Error sending message:", error);
        await CustomModal.alert("Failed to send message: " + error.message, "Send Error");
    }
};

const editChatMessage = async (messageId, currentText) => {
    const newText = await CustomModal.prompt("Edit your message:", currentText, "Edit Message");
    if (newText === null) return;
    if (!newText.trim()) {
        await CustomModal.alert("Message cannot be empty.", "Edit Error");
        return;
    }
    
    const traineeUid = (profileData.role === 'trainee' || profileData.role === 'admin') ? userId : activeChatContactId;
    const supervisorUid = profileData.role === 'supervisor' ? userId : activeChatContactId;
    const messageDocRef = doc(db, `users/${traineeUid}/chats/${supervisorUid}/messages/${messageId}`);
    
    try {
        await updateDoc(messageDocRef, {
            text: newText.trim(),
            edited: true
        });
        
        const summaryDocRef = doc(db, `users/${traineeUid}/chats/${supervisorUid}`);
        const summarySnap = await getDoc(summaryDocRef);
        if (summarySnap.exists()) {
            const summaryData = summarySnap.data();
            if (summaryData.lastMessageText === currentText) {
                await updateDoc(summaryDocRef, {
                    lastMessageText: newText.trim()
                });
            }
        }
    } catch (error) {
        console.error("Error updating message:", error);
        await CustomModal.alert("Failed to edit message: " + error.message, "Edit Error");
    }
};

const deleteChatMessage = async (messageId) => {
    const confirmed = await CustomModal.confirm("Are you sure you want to delete this message? This cannot be undone.", "Delete Message");
    if (!confirmed) return;
    
    const traineeUid = (profileData.role === 'trainee' || profileData.role === 'admin') ? userId : activeChatContactId;
    const supervisorUid = profileData.role === 'supervisor' ? userId : activeChatContactId;
    const messageDocRef = doc(db, `users/${traineeUid}/chats/${supervisorUid}/messages/${messageId}`);
    
    try {
        await deleteDoc(messageDocRef);
        
        const summaryDocRef = doc(db, `users/${traineeUid}/chats/${supervisorUid}`);
        const messagesRef = collection(db, `users/${traineeUid}/chats/${supervisorUid}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(1));
        const qSnap = await getDocs(q);
        
        let lastMsg = 'No messages yet';
        let lastTime = serverTimestamp();
        if (!qSnap.empty) {
            const lastDoc = qSnap.docs[0].data();
            lastMsg = lastDoc.text;
            lastTime = lastDoc.timestamp || serverTimestamp();
        }
        
        await updateDoc(summaryDocRef, {
            lastMessageText: lastMsg,
            lastMessageAt: lastTime
        });
    } catch (error) {
        console.error("Error deleting message:", error);
        await CustomModal.alert("Failed to delete message: " + error.message, "Delete Error");
    }
};

const deleteActiveConversation = async () => {
    if (!activeChatContactId) return;
    
    const confirmed = await CustomModal.confirm(
        "Are you sure you want to delete this entire conversation? All messages will be permanently deleted and the chat will be removed from your active list.",
        "Delete Entire Conversation"
    );
    if (!confirmed) return;
    
    const traineeUid = (profileData.role === 'trainee' || profileData.role === 'admin') ? userId : activeChatContactId;
    const supervisorUid = profileData.role === 'supervisor' ? userId : activeChatContactId;
    
    const messagesRef = collection(db, `users/${traineeUid}/chats/${supervisorUid}/messages`);
    const summaryDocRef = doc(db, `users/${traineeUid}/chats/${supervisorUid}`);
    
    try {
        const querySnapshot = await getDocs(messagesRef);
        const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
        await Promise.all(deletePromises);
        
        await deleteDoc(summaryDocRef);
        
        document.getElementById('chat-window').classList.add('hidden');
        document.getElementById('chat-placeholder').classList.remove('hidden');
        activeChatContactId = null;
        if (unsubscribeChatMessages) {
            unsubscribeChatMessages();
            unsubscribeChatMessages = null;
        }
        
        await CustomModal.alert("Conversation deleted successfully.", "Conversation Deleted", "ph-trash");
    } catch (error) {
        console.error("Error deleting conversation:", error);
        await CustomModal.alert("Failed to delete conversation: " + error.message, "Delete Error");
    }
};

const openStartChatModal = async () => {
    const modal = document.getElementById('start-chat-modal');
    const selectEl = document.getElementById('chat-contact-select');
    if (!modal || !selectEl || !userId) return;
    
    selectEl.innerHTML = '<option value="" disabled selected>Loading contacts...</option>';
    modal.classList.remove('hidden');
    
    try {
        if (profileData.role === 'supervisor') {
            const userEmail = (profileData && profileData.email) || auth.currentUser.email;
            const q = query(collection(db, 'users'), where('supervisorEmails', 'array-contains', userEmail));
            const querySnapshot = await getDocs(q);
            const myTraineesList = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
            
            const eligibleTrainees = [];
            for (const trainee of myTraineesList) {
                const chatDocRef = doc(db, `users/${trainee.id}/chats/${userId}`);
                const chatSnap = await getDoc(chatDocRef);
                if (!chatSnap.exists()) {
                    eligibleTrainees.push(trainee);
                }
            }
            
            if (eligibleTrainees.length === 0) {
                selectEl.innerHTML = '<option value="" disabled selected>No new trainees to chat with</option>';
            } else {
                selectEl.innerHTML = '<option value="" disabled selected>Select a trainee</option>' + eligibleTrainees.map(trainee => `
                    <option value="${trainee.id}" data-name="${trainee.name || 'Trainee'}" data-email="${trainee.email}">${trainee.name || 'Trainee'} (${trainee.email})</option>
                `).join('');
            }
        } else {
            const supervisors = profileData.supervisors || [];
            const resolvedSupervisors = [];
            for (const sup of supervisors) {
                if (!sup || !sup.email) continue;
                const q = query(collection(db, 'users'), where('email', '==', sup.email.trim()), where('role', '==', 'supervisor'));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    resolvedSupervisors.push({ id: docSnap.id, name: sup.name || docSnap.data().name || 'Supervisor', email: sup.email });
                }
            }
            
            const eligibleSupervisors = [];
            for (const sup of resolvedSupervisors) {
                const chatDocRef = doc(db, `users/${userId}/chats/${sup.id}`);
                const chatSnap = await getDoc(chatDocRef);
                if (!chatSnap.exists()) {
                    eligibleSupervisors.push(sup);
                }
            }
            
            if (eligibleSupervisors.length === 0) {
                selectEl.innerHTML = '<option value="" disabled selected>No new supervisors to chat with</option>';
            } else {
                selectEl.innerHTML = '<option value="" disabled selected>Select a supervisor</option>' + eligibleSupervisors.map(sup => `
                    <option value="${sup.id}" data-name="${sup.name}" data-email="${sup.email}">${sup.name} (${sup.email})</option>
                `).join('');
            }
        }
    } catch (error) {
        console.error("Error populating start chat select:", error);
        selectEl.innerHTML = '<option value="" disabled selected>Error loading contacts</option>';
    }
};

const handleStartChatConfirm = async () => {
    const selectEl = document.getElementById('chat-contact-select');
    if (!selectEl || !selectEl.value) {
        await CustomModal.alert("Please select a valid contact to start chat.", "No Contact Selected");
        return;
    }
    
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const selectedId = selectEl.value;
    const selectedName = selectedOption.dataset.name;
    const selectedEmail = selectedOption.dataset.email;
    
    const traineeUid = (profileData.role === 'trainee' || profileData.role === 'admin') ? userId : selectedId;
    const supervisorUid = profileData.role === 'supervisor' ? userId : selectedId;
    
    const chatDocRef = doc(db, `users/${traineeUid}/chats/${supervisorUid}`);
    
    try {
        await setDoc(chatDocRef, {
            traineeName: (profileData.role === 'trainee' || profileData.role === 'admin') ? (profileData.name || 'Trainee') : selectedName,
            traineeEmail: (profileData.role === 'trainee' || profileData.role === 'admin') ? auth.currentUser.email : selectedEmail,
            supervisorName: profileData.role === 'supervisor' ? (profileData.name || 'Supervisor') : selectedName,
            supervisorEmail: profileData.role === 'supervisor' ? auth.currentUser.email : selectedEmail,
            lastMessageText: 'Chat started',
            lastMessageAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });
        
        document.getElementById('start-chat-modal').classList.add('hidden');
        
        // Automatically open the new chat
        selectChatContact(selectedId, selectedName, selectedEmail);
    } catch (error) {
        console.error("Error starting chat:", error);
        await CustomModal.alert("Failed to start chat: " + error.message, "Start Chat Error");
    }
};

// --- Custom Dialogue Modal System ---
const CustomModal = {
    alert(message, title = "Notification", icon = "ph-bell") {
        return new Promise((resolve) => {
            const isLight = document.body.classList.contains('light-mode');
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-md modal-fade-in p-4';
            
            const cardBg = isLight ? 'bg-white' : 'rgba(15, 23, 42, 0.75)';
            const borderCol = isLight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.1)';
            const textTitle = isLight ? 'text-slate-900' : 'text-white';
            const textBody = isLight ? 'text-slate-600' : 'text-slate-300';
            const btnBg = 'bg-primary hover:bg-primary-hover';
            const btnText = 'text-white';
            const shadow = isLight ? 'box-shadow: 0 25px 50px -12px rgba(99, 102, 241, 0.1)' : 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5)';
            const glassBlur = isLight ? 'backdrop-filter: blur(25px);' : 'backdrop-filter: blur(25px);';

            modal.innerHTML = `
                <div class="p-6 rounded-2xl max-w-md w-full border transform modal-scale-up text-center"
                     style="background: ${cardBg}; border-color: ${borderCol}; ${shadow}; ${glassBlur}">
                    <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary text-xl">
                        <i class="ph ${icon}"></i>
                    </div>
                    <h3 class="text-lg font-bold ${textTitle} mb-2">${title}</h3>
                    <div class="max-h-[50vh] overflow-y-auto pr-1 mb-6 text-left">
                        <p class="text-sm ${textBody} whitespace-pre-line leading-relaxed">${message}</p>
                    </div>
                    <button class="modal-close-btn w-full ${btnBg} ${btnText} font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                        Dismiss
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
            const closeBtn = modal.querySelector('.modal-close-btn');
            closeBtn.focus();
            closeBtn.addEventListener('click', () => {
                modal.classList.replace('modal-fade-in', 'modal-fade-out');
                modal.querySelector('.transform').classList.replace('modal-scale-up', 'modal-scale-down');
                setTimeout(() => {
                    modal.remove();
                    resolve();
                }, 200);
            });
        });
    },

    feedback(feedbackText, isFixed, onToggleFixed) {
        return new Promise((resolve) => {
            const isLight = document.body.classList.contains('light-mode');
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-md modal-fade-in p-4';
            
            const cardBg = isLight ? 'bg-white' : 'rgba(15, 23, 42, 0.75)';
            const borderCol = isLight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.1)';
            const textTitle = isLight ? 'text-slate-900' : 'text-white';
            const textBody = isLight ? 'text-slate-600' : 'text-slate-300';
            const btnBg = 'bg-primary hover:bg-primary-hover';
            const btnText = 'text-white';
            const shadow = isLight ? 'box-shadow: 0 25px 50px -12px rgba(99, 102, 241, 0.1)' : 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5)';
            const glassBlur = isLight ? 'backdrop-filter: blur(25px);' : 'backdrop-filter: blur(25px);';

            modal.innerHTML = `
                <div class="p-6 rounded-2xl max-w-sm w-full border transform modal-scale-up text-center"
                     style="background: ${cardBg}; border-color: ${borderCol}; ${shadow}; ${glassBlur}">
                    <div class="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center mx-auto mb-4 text-pink-500 text-xl">
                        <i class="ph-fill ph-envelope-open"></i>
                    </div>
                    <h3 class="text-lg font-bold ${textTitle} mb-2">Supervisor Feedback</h3>
                    <div class="max-h-[35vh] overflow-y-auto pr-1 mb-6 text-left border-b ${isLight ? 'border-slate-100' : 'border-white/5'} pb-4">
                        <p class="text-sm ${textBody} whitespace-pre-line leading-relaxed">${feedbackText}</p>
                    </div>
                    <div class="flex items-center justify-between mb-6 px-1">
                        <span class="text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-wider">Mark as Resolved / Fixed</span>
                        <input type="checkbox" id="modal-feedback-fixed-checkbox" class="rounded border-white/10 text-primary focus:ring-0 focus:ring-offset-0 bg-surface/50 h-5 w-5 cursor-pointer" ${isFixed ? 'checked' : ''}>
                    </div>
                    <button class="modal-close-btn w-full ${btnBg} ${btnText} font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                        Dismiss
                    </button>
                </div>
            `;
            document.body.appendChild(modal);
            const closeBtn = modal.querySelector('.modal-close-btn');
            const checkbox = modal.querySelector('#modal-feedback-fixed-checkbox');
            
            checkbox.addEventListener('change', () => {
                onToggleFixed(checkbox.checked);
            });
            
            closeBtn.focus();
            closeBtn.addEventListener('click', () => {
                modal.classList.replace('modal-fade-in', 'modal-fade-out');
                modal.querySelector('.transform').classList.replace('modal-scale-up', 'modal-scale-down');
                setTimeout(() => {
                    modal.remove();
                    resolve();
                }, 200);
            });
        });
    },

    confirm(message, title = "Confirm Action") {
        return new Promise((resolve) => {
            const isLight = document.body.classList.contains('light-mode');
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-md modal-fade-in p-4';
            
            const cardBg = isLight ? 'bg-white' : 'rgba(15, 23, 42, 0.75)';
            const borderCol = isLight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.1)';
            const textTitle = isLight ? 'text-slate-900' : 'text-white';
            const textBody = isLight ? 'text-slate-600' : 'text-slate-300';
            const cancelBtnBg = isLight ? 'bg-slate-100 hover:bg-slate-200' : 'bg-white/5 hover:bg-white/10';
            const cancelBtnText = isLight ? 'text-slate-700' : 'text-white';
            const cancelBorder = isLight ? 'border-slate-200' : 'border-white/5';
            const shadow = isLight ? 'box-shadow: 0 25px 50px -12px rgba(99, 102, 241, 0.1)' : 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5)';
            const glassBlur = isLight ? 'backdrop-filter: blur(25px);' : 'backdrop-filter: blur(25px);';

            modal.innerHTML = `
                <div class="p-6 rounded-2xl max-w-sm w-full border transform modal-scale-up text-center"
                     style="background: ${cardBg}; border-color: ${borderCol}; ${shadow}; ${glassBlur}">
                    <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-red-400 text-xl">
                        <i class="ph ph-warning-circle"></i>
                    </div>
                    <h3 class="text-lg font-bold ${textTitle} mb-2">${title}</h3>
                    <p class="text-sm ${textBody} mb-6 leading-relaxed">${message}</p>
                    <div class="grid grid-cols-2 gap-3">
                        <button class="modal-cancel-btn w-full ${cancelBtnBg} ${cancelBtnText} font-semibold py-2.5 px-4 rounded-xl border ${cancelBorder} transition-all">
                            Cancel
                        </button>
                        <button class="modal-confirm-btn w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                            Confirm
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const cancelBtn = modal.querySelector('.modal-cancel-btn');
            const confirmBtn = modal.querySelector('.modal-confirm-btn');
            confirmBtn.focus();

            cancelBtn.addEventListener('click', () => {
                closeModal(false);
            });
            confirmBtn.addEventListener('click', () => {
                closeModal(true);
            });

            function closeModal(result) {
                modal.classList.replace('modal-fade-in', 'modal-fade-out');
                modal.querySelector('.transform').classList.replace('modal-scale-up', 'modal-scale-down');
                setTimeout(() => {
                    modal.remove();
                    resolve(result);
                }, 200);
            }
        });
    },

    prompt(message, placeholder = "", title = "Input Needed") {
        return new Promise((resolve) => {
            const isLight = document.body.classList.contains('light-mode');
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-md modal-fade-in p-4';
            
            const cardBg = isLight ? 'bg-white' : 'rgba(15, 23, 42, 0.75)';
            const borderCol = isLight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.1)';
            const textTitle = isLight ? 'text-slate-900' : 'text-white';
            const textBody = isLight ? 'text-slate-600' : 'text-slate-300';
            const textareaBg = isLight ? 'bg-slate-50 border-slate-200 focus:border-primary text-slate-900' : 'bg-white/5 border-white/10 focus:border-primary text-white';
            const cancelBtnBg = isLight ? 'bg-slate-100 hover:bg-slate-200' : 'bg-white/5 hover:bg-white/10';
            const cancelBtnText = isLight ? 'text-slate-700' : 'text-white';
            const cancelBorder = isLight ? 'border-slate-200' : 'border-white/5';
            const shadow = isLight ? 'box-shadow: 0 25px 50px -12px rgba(99, 102, 241, 0.1)' : 'box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5)';
            const glassBlur = isLight ? 'backdrop-filter: blur(25px);' : 'backdrop-filter: blur(25px);';

            modal.innerHTML = `
                <div class="p-6 rounded-2xl max-w-md w-full border transform modal-scale-up"
                     style="background: ${cardBg}; border-color: ${borderCol}; ${shadow}; ${glassBlur}">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg">
                            <i class="ph ph-pencil-line"></i>
                        </div>
                        <h3 class="text-lg font-bold ${textTitle}">${title}</h3>
                    </div>
                    <p class="text-sm ${textBody} mb-4 leading-relaxed">${message}</p>
                    <textarea class="modal-input-field w-full h-28 border rounded-xl p-3 text-sm focus:outline-none transition-all resize-none mb-6 ${textareaBg}"
                              placeholder="${placeholder}"></textarea>
                    <div class="grid grid-cols-2 gap-3">
                        <button class="modal-cancel-btn w-full ${cancelBtnBg} ${cancelBtnText} font-semibold py-2.5 px-4 rounded-xl border ${cancelBorder} transition-all">
                            Cancel
                        </button>
                        <button class="modal-submit-btn w-full bg-primary hover:bg-primary-hover text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                            Submit
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const inputField = modal.querySelector('.modal-input-field');
            const cancelBtn = modal.querySelector('.modal-cancel-btn');
            const submitBtn = modal.querySelector('.modal-submit-btn');
            
            inputField.focus();

            cancelBtn.addEventListener('click', () => {
                closeModal(null);
            });
            submitBtn.addEventListener('click', () => {
                closeModal(inputField.value.trim());
            });

            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitBtn.click();
                }
            });

            function closeModal(result) {
                modal.classList.replace('modal-fade-in', 'modal-fade-out');
                modal.querySelector('.transform').classList.replace('modal-scale-up', 'modal-scale-down');
                setTimeout(() => {
                    modal.remove();
                    resolve(result);
                }, 200);
            }
        });
    }
};

// --- Theme Handling ---
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (themeBtn) themeBtn.innerHTML = '<i class="ph ph-moon"></i> Dark';
    } else {
        if (themeBtn) themeBtn.innerHTML = '<i class="ph ph-sun"></i> Light'; // Default
    }
};

const toggleTheme = () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.innerHTML = isLight ? '<i class="ph ph-moon"></i> Dark' : '<i class="ph ph-sun"></i> Light';
    }
};

function init() {
    initTheme();
    console.log("App.js: Initializing application...");

    initDOMElements();

    // Initialize interactive dynamic particle backgrounds
    initInteractiveParticles('login-particles-canvas');
    initInteractiveParticles('role-particles-canvas');

    setupTableHeaders();

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);

    // Event Listeners
    if (loginBtn) loginBtn.addEventListener('click', handleGoogleLogin);
    if (guestLoginBtn) guestLoginBtn.addEventListener('click', handleGuestLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    if (viewBtns) {
        viewBtns.forEach(btn => btn.addEventListener('click', (e) => {
            const target = e.target.closest('.view-btn');
            if (target) switchView(target.dataset.view);
        }));
    }

    const sidebarTraineesToggle = document.getElementById('sidebar-trainees-toggle');
    if (sidebarTraineesToggle) {
        sidebarTraineesToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const list = document.getElementById('sidebar-trainees-list');
            const chevron = document.getElementById('sidebar-trainees-chevron');
            if (list) list.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotate-180');
        });
    }

    if (monthSelector) {
        monthSelector.value = dayjs().format('YYYY-MM');
        monthSelector.addEventListener('change', updateMonthlyView);
    }

    if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => {
        monthSelector.stepUp(-1);
        updateMonthlyView();
    });

    if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => {
        monthSelector.stepUp(1);
        updateMonthlyView();
    });

    if (yearSelector) {
        yearSelector.value = dayjs().year();
        yearSelector.addEventListener('change', updateYearlyView);
    }

    // Slide-over
    if (fabAddEntry) fabAddEntry.addEventListener('click', () => openSlideOver('add'));
    if (closeSlideOverBtn) closeSlideOverBtn.addEventListener('click', closeSlideOver);
    if (slideOverBackdrop) slideOverBackdrop.addEventListener('click', closeSlideOver);
    if (saveEntryBtn) saveEntryBtn.addEventListener('click', handleSaveEntry);
    if (deleteEntryBtn) deleteEntryBtn.addEventListener('click', handleDeleteEntry);

    if (activityTypeRadios) {
        Array.from(activityTypeRadios).forEach(radio => radio.addEventListener('change', handleActivityTypeChange));
    }

    // Settings
    if (settingsBtn) settingsBtn.addEventListener('click', openSettingsPanel);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsPanel);
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettingsPanel);
    if (profileForm) profileForm.addEventListener('submit', saveProfile);
    if (supervisorForm) supervisorForm.addEventListener('submit', addOrUpdateSupervisor);

    // Username/Password login and linking listeners
    if (tabGoogleGuest) tabGoogleGuest.addEventListener('click', () => {
        tabGoogleGuest.classList.add('border-primary', 'text-white');
        tabGoogleGuest.classList.remove('border-transparent', 'text-text-muted');
        tabUserPass.classList.add('border-transparent', 'text-text-muted');
        tabUserPass.classList.remove('border-primary', 'text-white');
        authGoogleGuestContainer.classList.remove('hidden');
        authUserPassContainer.classList.add('hidden');
    });
    if (tabUserPass) tabUserPass.addEventListener('click', () => {
        tabUserPass.classList.add('border-primary', 'text-white');
        tabUserPass.classList.remove('border-transparent', 'text-text-muted');
        tabGoogleGuest.classList.add('border-transparent', 'text-text-muted');
        tabGoogleGuest.classList.remove('border-primary', 'text-white');
        authUserPassContainer.classList.remove('hidden');
        authGoogleGuestContainer.classList.add('hidden');
    });
    if (goToSignup) goToSignup.addEventListener('click', () => {
        signinForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    });
    if (goToSignin) goToSignin.addEventListener('click', () => {
        signupForm.classList.add('hidden');
        signinForm.classList.remove('hidden');
    });
    if (signinForm) signinForm.addEventListener('submit', handleUsernameSignin);
    if (signupForm) signupForm.addEventListener('submit', handleUsernameSignup);
    if (linkEmailBtn) linkEmailBtn.addEventListener('click', handleLinkEmail);
    if (bannerLinkEmailBtn) bannerLinkEmailBtn.addEventListener('click', () => {
        openSettingsPanel();
        setTimeout(() => {
            if (accountRealEmail) accountRealEmail.focus();
        }, 300);
    });

    // Chat Form Submission
    const chatInputForm = document.getElementById('chat-input-form');
    if (chatInputForm) chatInputForm.addEventListener('submit', sendChatMessage);

    // New Chat Event Listeners
    const chatStartNewBtn = document.getElementById('chat-start-new-btn');
    if (chatStartNewBtn) chatStartNewBtn.addEventListener('click', openStartChatModal);

    const cancelStartChatBtn = document.getElementById('cancel-start-chat-btn');
    if (cancelStartChatBtn) cancelStartChatBtn.addEventListener('click', () => {
        document.getElementById('start-chat-modal').classList.add('hidden');
    });

    const closeStartChatBackdrop = document.getElementById('close-start-chat-backdrop');
    if (closeStartChatBackdrop) closeStartChatBackdrop.addEventListener('click', () => {
        document.getElementById('start-chat-modal').classList.add('hidden');
    });

    const confirmStartChatBtn = document.getElementById('confirm-start-chat-btn');
    if (confirmStartChatBtn) confirmStartChatBtn.addEventListener('click', handleStartChatConfirm);

    const deleteConversationBtn = document.getElementById('delete-conversation-btn');
    if (deleteConversationBtn) deleteConversationBtn.addEventListener('click', deleteActiveConversation);

    // Event delegation for message edit/delete actions inside chat-messages-container
    const messagesContainer = document.getElementById('chat-messages-container');
    if (messagesContainer) {
        messagesContainer.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.edit-msg-btn');
            const deleteBtn = e.target.closest('.delete-msg-btn');
            
            if (editBtn) {
                const wrapper = editBtn.closest('.chat-message-wrapper');
                const messageId = wrapper.dataset.messageId;
                const currentText = wrapper.querySelector('.message-text').textContent;
                await editChatMessage(messageId, currentText);
            } else if (deleteBtn) {
                const wrapper = deleteBtn.closest('.chat-message-wrapper');
                const messageId = wrapper.dataset.messageId;
                await deleteChatMessage(messageId);
            }
        });
    }

    // AI Note Assistant Event Listeners
    if (saveAiSettingsBtn) {
        saveAiSettingsBtn.addEventListener('click', async () => {
            if (geminiApiKeyInput) {
                const key = geminiApiKeyInput.value.trim();
                localStorage.setItem('gemini_api_key', key);
                geminiApiKey = key;
                await CustomModal.alert("✨ Gemini API Key saved successfully!", "Settings Saved");
            }
        });
    }

    if (toggleApiKeyBtn) {
        toggleApiKeyBtn.addEventListener('click', () => {
            if (geminiApiKeyInput) {
                const isPass = geminiApiKeyInput.type === 'password';
                geminiApiKeyInput.type = isPass ? 'text' : 'password';
                const icon = toggleApiKeyBtn.querySelector('i');
                if (icon) {
                    icon.className = isPass ? 'ph ph-eye-slash text-lg' : 'ph ph-eye text-lg';
                }
            }
        });
    }

    if (aiAssistBtn) aiAssistBtn.addEventListener('click', handleAiAssist);

    if (aiUndoBtn) {
        aiUndoBtn.addEventListener('click', () => {
            const notesField = document.getElementById('notes');
            if (notesField) {
                notesField.value = originalNotes;
            }
            if (aiUndoBar) aiUndoBar.classList.add('hidden');
        });
    }

    if (aiAcceptBtn) {
        aiAcceptBtn.addEventListener('click', () => {
            if (aiUndoBar) aiUndoBar.classList.add('hidden');
        });
    }

    if (supervisorsList) {
        supervisorsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-supervisor-btn');
            if (removeBtn) removeSupervisor(removeBtn.dataset.name);
            const editBtn = e.target.closest('.edit-supervisor-btn');
            if (editBtn) handleEditSupervisor(editBtn.dataset.name);
        });
    }

    // ===== PDF VIEWER with Smart Auto-Fill Panel =====
    const BACB_PDF_URL = 'https://www.bacb.com/wp-content/uploads/2025/03/2027-Monthly-Fieldwork-Verification-Form-Individual_260213-2-a.pdf';
    const pdfPreviewModal = document.getElementById('pdf-preview-modal');
    const pdfIframe = document.getElementById('pdf-iframe');
    const pdfFallback = document.getElementById('pdf-fallback');
    const pdfCloseBtn = document.getElementById('pdf-close-btn');
    const pdfMonthSelector = document.getElementById('pdf-month-selector');
    const pdfAutofillPanel = document.getElementById('pdf-autofill-panel');
    const pdfCopyToast = document.getElementById('pdf-copy-toast');

    // Helper: format decimal hours → hh h mm m
    function fmtHrsMin(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours % 1) * 60);
        return `${h}h ${m}m`;
    }
    // Helper: format decimal hours → "__ hh __ mm" BACB form style
    function fmtBacb(hours) {
        const h = Math.floor(hours);
        const m = Math.round((hours % 1) * 60);
        return `${h} hh ${m} mm`;
    }

    function copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            // Animate the button
            const icon = btn.querySelector('i');
            const orig = icon.className;
            icon.className = 'ph-fill ph-check text-green-400 text-sm';
            btn.style.background = 'rgba(34,197,94,0.15)';
            btn.style.borderColor = 'rgba(34,197,94,0.3)';
            // Show toast
            if (pdfCopyToast) {
                pdfCopyToast.classList.remove('hidden');
                clearTimeout(pdfCopyToast._timer);
                pdfCopyToast._timer = setTimeout(() => pdfCopyToast.classList.add('hidden'), 2000);
            }
            setTimeout(() => {
                icon.className = orig;
                btn.style.background = '';
                btn.style.borderColor = '';
            }, 1800);
        }).catch(() => {
            // Fallback for older browsers
            const el = document.createElement('textarea');
            el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
            document.body.appendChild(el); el.select();
            document.execCommand('copy'); document.body.removeChild(el);
        });
    }

    function makeCopyCard(label, value, color = 'blue', icon = 'ph-fill ph-copy') {
        if (!value || value === '-' || value === '') {
            return `
            <div class="rounded-xl px-3 py-2.5 border border-white/5 opacity-40" style="background: rgba(255,255,255,0.02);">
                <p class="text-[10px] text-text-muted uppercase tracking-widest mb-0.5">${label}</p>
                <p class="text-xs text-text-muted italic">Not available</p>
            </div>`;
        }
        const colorMap = {
            blue:   ['rgba(59,130,246,0.1)',  'rgba(59,130,246,0.2)',  'text-blue-400'],
            purple: ['rgba(139,92,246,0.1)',   'rgba(139,92,246,0.2)',  'text-purple-400'],
            green:  ['rgba(34,197,94,0.1)',    'rgba(34,197,94,0.2)',   'text-green-400'],
            teal:   ['rgba(20,184,166,0.1)',   'rgba(20,184,166,0.2)',  'text-teal-400'],
            pink:   ['rgba(236,72,153,0.1)',   'rgba(236,72,153,0.2)', 'text-pink-400'],
            orange: ['rgba(249,115,22,0.1)',   'rgba(249,115,22,0.2)',  'text-orange-400'],
            red:    ['rgba(239,68,68,0.1)',    'rgba(239,68,68,0.2)',   'text-red-400'],
        };
        const [bg, border, textColor] = colorMap[color] || colorMap.blue;
        const escapedValue = value.replace(/"/g, '&quot;');
        return `
        <div class="group relative rounded-xl px-3 py-2.5 border transition-all hover:scale-[1.01] cursor-default"
            style="background: ${bg}; border-color: ${border};">
            <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                    <p class="text-[10px] ${textColor} uppercase tracking-widest mb-0.5 font-semibold">${label}</p>
                    <p class="text-sm font-bold text-white truncate">${value}</p>
                </div>
                <button class="pdf-copy-btn flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                    data-value="${escapedValue}"
                    style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"
                    title="Copy to clipboard">
                    <i class="ph-fill ph-copy ${textColor} text-sm"></i>
                </button>
            </div>
        </div>`;
    }

    function makeSectionHeader(label, iconClass = 'ph-fill ph-list') {
        return `<p class="text-[10px] text-text-muted uppercase tracking-widest font-bold mt-3 mb-1.5 px-1 flex items-center gap-1.5"><i class="${iconClass} text-xs"></i>${label}</p>`;
    }

    function renderAutofillPanel(selectedMonthStr) {
        if (!pdfAutofillPanel) return;

        const [year, month] = selectedMonthStr.split('-').map(Number);
        const monthEntries = allEntries.filter(e => {
            const d = dayjs(e.date);
            return d.year() === year && (d.month() + 1) === month;
        });

        const data = calculateSummaryData(monthEntries);
        const monthLabel = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('MMMM YYYY');
        const pct = data.percentage.toFixed(2);

        // Count unique supervisors this month
        const supervisorHoursMap = {};
        monthEntries.forEach(e => {
            if (e.supervisorName && e.supervisionType !== 'No Supervision') {
                const h = calculateHours(e.startTime, e.endTime);
                supervisorHoursMap[e.supervisorName] = (supervisorHoursMap[e.supervisorName] || 0) + h;
            }
        });

        const supervisorCards = Object.entries(supervisorHoursMap)
            .map(([name, hrs]) => makeCopyCard(`Supervisor — ${fmtHrsMin(hrs)} Supervised`, name, 'teal', 'ph-fill ph-user-circle'))
            .join('');

        // Profile info
        const name = profileData.name || '';
        const bacbId = profileData.rbtNumber || '';
        const today = dayjs().format('MMMM YYYY');

        // State / country — from entries if stored, else unknown
        const stateEntry = monthEntries.find(e => e.state);
        const state = stateEntry?.state || '';
        const countryEntry = monthEntries.find(e => e.country);
        const country = countryEntry?.country || 'United States';

        let html = '';

        // Identity section
        html += makeSectionHeader('Your Identity', 'ph-fill ph-identification-card');
        html += makeCopyCard('Trainee Name', name, 'blue');
        html += makeCopyCard('BACB ID / RBT Number', bacbId, 'blue');
        html += makeCopyCard('Month / Year', monthLabel, 'blue');

        // Hours section
        html += makeSectionHeader('Fieldwork Hours', 'ph-fill ph-clock');
        html += makeCopyCard('A. Independent Hours (supervisor NOT present)', fmtBacb(data.unsupervised), 'orange');
        html += makeCopyCard('B. Supervised Hours (supervisor present)', fmtBacb(data.supervised), 'green');
        html += makeCopyCard('Total Fieldwork Hours (A + B)', fmtBacb(data.total), 'purple');
        html += makeCopyCard('Percentage of Hours Supervised', `${pct}%`, data.percentage >= 5 ? 'green' : 'red');
        if (data.observationHours > 0) {
            html += makeCopyCard('Observation Duration', fmtBacb(data.observationHours), 'teal');
        }

        // Supervision breakdown
        html += makeSectionHeader('Supervision Detail', 'ph-fill ph-users-three');
        html += makeCopyCard('Individual Supervision Hours', fmtBacb(data.individualSupervision), 'teal');
        html += makeCopyCard('Group Supervision Hours', fmtBacb(data.groupSupervision), 'purple');

        // Supervisor names
        if (Object.keys(supervisorHoursMap).length > 0) {
            html += makeSectionHeader('Supervisor Name(s)', 'ph-fill ph-user-circle');
            html += supervisorCards;
        }

        // Location (only show if no entries this month)
        if (monthEntries.length === 0) {
            html += `
            <div class="mt-4 rounded-xl p-4 border border-yellow-500/20 text-center" style="background: rgba(234,179,8,0.06);">
                <i class="ph-fill ph-calendar-x text-yellow-400 text-xl mb-2 block"></i>
                <p class="text-xs text-yellow-400 font-semibold">No entries found for ${monthLabel}</p>
                <p class="text-[10px] text-text-muted mt-1">Log your activities first, then come back here to fill the form.</p>
            </div>`;
        }

        // BACB note at bottom
        html += `
        <div class="mt-3 rounded-xl p-3 border border-white/5" style="background: rgba(255,255,255,0.02);">
            <p class="text-[10px] text-text-muted leading-relaxed">
                <i class="ph-fill ph-info text-blue-400 mr-1"></i>
                Per BACB 2027 requirements: supervised hours must be ≥5% of total (or ≥7.5% for Concentrated). Group supervision ≤50% of supervised hours. Form must be signed by last day of following month.
            </p>
        </div>`;

        pdfAutofillPanel.innerHTML = html;

        // Wire up copy buttons
        pdfAutofillPanel.querySelectorAll('.pdf-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => copyToClipboard(btn.dataset.value, btn));
        });
    }

    function populatePdfMonthSelector() {
        if (!pdfMonthSelector || !monthSelector) return;
        // Mirror the main month selector options
        pdfMonthSelector.innerHTML = monthSelector.innerHTML;
        // Default to currently selected month
        pdfMonthSelector.value = monthSelector.value;
    }

    function renderPdfSupervisorSendMenu() {
        if (!pdfSendSupervisorMenu) return;
        pdfSendSupervisorMenu.innerHTML = '';

        const supervisors = profileData.supervisors || [];
        if (!supervisors.length) {
            const empty = document.createElement('p');
            empty.className = 'px-3 py-2 text-xs text-text-muted';
            empty.textContent = 'No supervisors added yet.';
            pdfSendSupervisorMenu.appendChild(empty);
            return;
        }

        supervisors.forEach((supervisor) => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/6';

            const info = document.createElement('div');
            info.className = 'min-w-0';

            const name = document.createElement('p');
            name.className = 'text-sm font-semibold text-white truncate';
            name.textContent = supervisor.name || 'Supervisor';

            const email = document.createElement('p');
            email.className = 'text-[11px] text-text-muted truncate';
            email.textContent = supervisor.email || 'No email saved';

            const sendBtn = document.createElement('button');
            sendBtn.type = 'button';
            sendBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 transition-colors';
            sendBtn.textContent = 'Send';
            sendBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await sendMfvfToSupervisor({
                    supervisorName: supervisor.name,
                    selectedMonth: pdfMonthSelector?.value || monthSelector.value,
                    button: sendBtn,
                    source: 'pdf'
                });
            });

            info.append(name, email);
            row.append(info, sendBtn);
            pdfSendSupervisorMenu.appendChild(row);
        });
    }

    function setPdfSupervisorSendVisible(isVisible) {
        const container = document.getElementById('pdf-send-supervisor-container');
        if (container) container.classList.toggle('hidden', !isVisible);
        if (!isVisible && pdfSendSupervisorMenu) pdfSendSupervisorMenu.classList.add('hidden');
    }

    function buildMfvfRequestPdf(month, request) {
        const doc = new jsPDF('p', 'mm', 'letter');
        const data = request.formData || {};
        const monthLabel = request.monthLabel || dayjs(month).format('MMMM YYYY');
        const signedDate = request.signedAt ? dayjs(request.signedAt).format('MMM D, YYYY h:mm A') : '';

        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 216, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.text('Monthly Fieldwork Verification Form Preview', 14, 15);

        doc.setTextColor(31, 41, 55);
        doc.setFontSize(10);
        let y = 36;
        const line = (label, value) => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${label}:`, 14, y);
            doc.setFont('helvetica', 'normal');
            doc.text(String(value || '-'), 62, y);
            y += 8;
        };

        line('Status', request.status === 'signed' ? 'Signed and returned' : 'Submitted for review');
        line('Month / Year', monthLabel);
        line('Trainee Name', request.traineeName || 'Trainee');
        line('BACB ID', request.bacbId || '');
        line('Supervisor Name', request.supervisorName || profileData.name || 'Supervisor');
        line('Supervisor Cert', request.supervisorCert || '');
        line('State', data.state || '');
        line('Country', data.country || '');

        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Fieldwork Hours', 14, y);
        y += 9;
        doc.setFontSize(10);
        line('Independent Hours', formatHoursForDisplay(data.unsupervisedHours || 0));
        line('Supervised Hours', formatHoursForDisplay(data.supervisedHours || 0));
        line('Total Fieldwork Hours', formatHoursForDisplay(data.totalHours || 0));
        line('Restricted Hours', formatHoursForDisplay(data.restrictedHours || 0));
        line('Unrestricted Hours', formatHoursForDisplay(data.unrestrictedHours || 0));
        line('Observation', `${Math.round(data.observationMinutes || 0)}m`);
        line('Supervision %', `${Number(data.supervisionPercentage || 0).toFixed(2)}%`);

        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Signatures', 14, y);
        y += 10;
        doc.setFontSize(10);
        line('Trainee', request.traineeName || 'Trainee');
        line('Submitted', request.traineeSubmittedAt ? dayjs(request.traineeSubmittedAt).format('MMM D, YYYY h:mm A') : '');
        line('Supervisor Signature', request.supervisorSignatureName || (request.status === 'signed' ? request.supervisorName : 'Pending'));
        line('Signed Date', signedDate || 'Pending');

        if (request.traineeNote || request.supervisorComments) {
            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.text('Notes', 14, y);
            y += 8;
            doc.setFont('helvetica', 'normal');
            const notes = [
                request.traineeNote ? `Trainee: ${request.traineeNote}` : '',
                request.supervisorComments ? `Supervisor: ${request.supervisorComments}` : ''
            ].filter(Boolean).join('\n');
            doc.text(doc.splitTextToSize(notes, 180), 14, y);
        }

        return doc;
    }

    function renderMfvfRequestPreviewPanel(month, request) {
        if (!pdfAutofillPanel) return;
        const data = request.formData || {};
        const monthLabel = request.monthLabel || dayjs(month).format('MMMM YYYY');
        const statusColor = request.status === 'signed' ? 'green' : 'orange';
        let html = '';

        html += makeSectionHeader('Submitted M-FVF', 'ph-fill ph-file-pdf');
        html += makeCopyCard('Status', request.status === 'signed' ? 'Signed and returned' : 'Submitted for review', statusColor);
        html += makeCopyCard('Month / Year', monthLabel, 'blue');
        html += makeCopyCard('Trainee Name', request.traineeName || 'Trainee', 'blue');
        html += makeCopyCard('BACB ID / RBT Number', request.bacbId || '', 'blue');
        html += makeCopyCard('Supervisor Name', request.supervisorName || profileData.name || 'Supervisor', 'teal');

        html += makeSectionHeader('Fieldwork Hours', 'ph-fill ph-clock');
        html += makeCopyCard('Independent Hours', formatHoursForDisplay(data.unsupervisedHours || 0), 'orange');
        html += makeCopyCard('Supervised Hours', formatHoursForDisplay(data.supervisedHours || 0), 'green');
        html += makeCopyCard('Total Fieldwork Hours', formatHoursForDisplay(data.totalHours || 0), 'purple');
        html += makeCopyCard('Observation', `${Math.round(data.observationMinutes || 0)}m`, 'teal');
        html += makeCopyCard('Percentage Supervised', `${Number(data.supervisionPercentage || 0).toFixed(2)}%`, Number(data.supervisionPercentage || 0) >= 5 ? 'green' : 'red');

        html += makeSectionHeader('Signature Status', 'ph-fill ph-signature');
        html += makeCopyCard('Supervisor Signature', request.supervisorSignatureName || (request.status === 'signed' ? request.supervisorName : 'Pending'), request.status === 'signed' ? 'green' : 'orange');
        html += makeCopyCard('Signed Date', request.signedAt ? dayjs(request.signedAt).format('MMM D, YYYY h:mm A') : 'Pending', request.status === 'signed' ? 'green' : 'orange');

        pdfAutofillPanel.innerHTML = html;
    }

    function openMfvfRequestPdfViewer(month, request) {
        if (!pdfPreviewModal || !pdfIframe || !request) return;
        populatePdfMonthSelector();
        if (pdfMonthSelector && month) pdfMonthSelector.value = month;
        renderMfvfRequestPreviewPanel(month, request);
        setPdfSupervisorSendVisible(false);
        if (pdfSendToast) pdfSendToast.classList.add('hidden');
        if (pdfFallback) pdfFallback.classList.add('hidden');
        pdfIframe.classList.remove('hidden');

        const doc = buildMfvfRequestPdf(month, request);
        currentPdfDoc = doc;
        currentPdfFilename = `MFVF_${request.traineeName || 'Trainee'}_${month || 'preview'}.pdf`;
        pdfIframe.src = doc.output('bloburl');

        pdfPreviewModal.classList.remove('hidden');
        pdfPreviewModal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    // ===== GENERATE & DOWNLOAD PRE-FILLED M-FVF PDF =====
    async function generateAndDownloadMfvfPdf() {
        const selectedMonth = pdfMonthSelector?.value || monthSelector?.value;
        if (!selectedMonth) {
            await CustomModal.alert('Please select a month first.', 'No Month Selected');
            return;
        }

        const [year, month] = selectedMonth.split('-').map(Number);
        const monthEntries = allEntries.filter(e => {
            const d = dayjs(e.date);
            return d.year() === year && (d.month() + 1) === month;
        });

        const summary = calculateSummaryData(monthEntries);
        const monthLabel = dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('MMMM YYYY');

        // Find the dominant supervisor for this month (most supervised hours)
        const supervisorHoursMap = {};
        monthEntries.forEach(e => {
            if (e.supervisorName && e.supervisionType !== 'No Supervision') {
                const h = calculateHours(e.startTime, e.endTime);
                supervisorHoursMap[e.supervisorName] = (supervisorHoursMap[e.supervisorName] || 0) + h;
            }
        });
        const topSupervisorName = Object.entries(supervisorHoursMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const supervisorProfile = profileData.supervisors?.find(s => s.name === topSupervisorName);

        // Formatting helpers
        const fmtHH = (hrs) => String(Math.floor(hrs)).padStart(2, '0');
        const fmtMM = (hrs) => String(Math.round((hrs % 1) * 60)).padStart(2, '0');

        const filename = `MFVF_${(profileData.name || 'Trainee').replace(/\s+/g, '_')}_${selectedMonth}.pdf`;

        // ─── Validation ───
        if (!userId || userId === 'guest') {
            await CustomModal.alert('Please sign in to save your M-FVF to the cloud.', 'Sign In Required');
            return;
        }
        if (!storage) {
            await CustomModal.alert('Firebase Storage is not ready yet. Please refresh and try again.', 'Storage Not Ready');
            return;
        }

        try {
            // Find state/country from entries
            const stateEntry = monthEntries.find(e => e.state);
            const countryEntry = monthEntries.find(e => e.country);

            // Call Cloud Function to fill BACB PDF (server-side, no CORS issues)
            // Specify region to match deployed function location
            const functions = getFunctions(app, 'us-central1');
            const fillBACBForm = httpsCallable(functions, 'fillBACBForm');

            console.log('Calling Cloud Function to fill BACB form...');
            const result = await fillBACBForm({
                traineeName: profileData.name || '',
                bacbId: profileData.rbtNumber || '',
                monthYear: dayjs(`${year}-${String(month).padStart(2,'0')}-01`).format('MM/DD/YYYY'),
                state: stateEntry?.state || '',
                country: countryEntry?.country || 'United States',
                supervisorName: supervisorProfile?.name || topSupervisorName || '',
                supervisorCert: supervisorProfile?.cert || '',
                independentHours: fmtHH(summary.unsupervised),
                independentMinutes: fmtMM(summary.unsupervised),
                supervisedHours: fmtHH(summary.supervised),
                supervisedMinutes: fmtMM(summary.supervised),
                observationMinutes: Math.round(summary.observationMinutes).toString(),
                totalHours: fmtHH(summary.total),
                totalMinutes: fmtMM(summary.total),
                supervisionPercentage: summary.percentage.toFixed(2),
                individualSupervision: `${fmtHH(summary.individualSupervision)} ${fmtMM(summary.individualSupervision)}`,
                groupSupervision: `${fmtHH(summary.groupSupervision)} ${fmtMM(summary.groupSupervision)}`
            });

            console.log('Cloud Function result:', result.data);

            if (!result.data.success) {
                throw new Error('Cloud Function did not return success');
            }

            // Decode base64 PDF back to blob
            const pdfBase64 = result.data.pdfBase64;
            const binaryString = atob(pdfBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

            // Upload filled PDF to Firebase Storage
            const storagePath = `mfvf/${userId}/${selectedMonth}/draft.pdf`;
            const fileRef = storageRef(storage, storagePath);
            await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' });
            const downloadUrl = await getDownloadURL(fileRef);

            // Save verification record to Firestore
            await setDoc(getMfvfVerificationRef(userId, selectedMonth), {
                status: 'draft',
                month: selectedMonth,
                monthLabel,
                traineeId: userId,
                traineeName: profileData.name || '',
                traineeEmail: profileData.email || auth.currentUser?.email || '',
                bacbId: profileData.rbtNumber || '',
                supervisorName: supervisorProfile?.name || topSupervisorName || '',
                supervisorEmail: supervisorProfile?.email || '',
                supervisorCert: supervisorProfile?.cert || '',
                draftPdfPath: storagePath,
                draftPdfUrl: downloadUrl,
                draftPdfName: filename,
                formData: {
                    state: stateEntry?.state || '',
                    country: countryEntry?.country || 'United States',
                    independentHours: summary.unsupervised,
                    supervisedHours: summary.supervised,
                    totalHours: summary.total,
                    restrictedHours: summary.restricted,
                    unrestrictedHours: summary.unrestricted,
                    observationMinutes: summary.observationMinutes,
                    supervisionPercentage: summary.percentage,
                    individualSupervision: summary.individualSupervision,
                    groupSupervision: summary.groupSupervision
                },
                entryCount: monthEntries.length,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            showPdfSendToast('Official BACB form filled & saved ✓');
        } catch (err) {
            console.error('M-FVF cloud save failed:', err);
            await CustomModal.alert(
                'Could not save your M-FVF to the cloud. Please check your connection and try again.\n\n' + (err?.message || err),
                'Cloud Save Failed'
            );
            throw err;
        }
    }

    // ===== CUSTOM INTERACTIVE M-FVF EDITOR (PDF.js render + form overlay + signature) =====
    const LOCAL_TEMPLATE_URL = 'mfvf-template.pdf';
    let mfvfEditorState = { month: null, scale: 1, pageW: 612, pageH: 792, fields: [], signatures: {}, templateBytes: null };
    let signaturePadInstance = null;
    let signatureTargetField = null;

    // Gather all computed context for a given month (shared by editor + save)
    function getMfvfContext(selectedMonth) {
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthEntries = allEntries.filter(e => {
            const d = dayjs(e.date);
            return d.year() === year && (d.month() + 1) === month;
        });
        const summary = calculateSummaryData(monthEntries);
        const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

        const supervisorHoursMap = {};
        monthEntries.forEach(e => {
            if (e.supervisorName && e.supervisionType !== 'No Supervision') {
                const h = calculateHours(e.startTime, e.endTime);
                supervisorHoursMap[e.supervisorName] = (supervisorHoursMap[e.supervisorName] || 0) + h;
            }
        });
        const topSupervisorName = Object.entries(supervisorHoursMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const supervisorProfile = profileData.supervisors?.find(s => s.name === topSupervisorName);
        const stateEntry = monthEntries.find(e => e.state);
        const countryEntry = monthEntries.find(e => e.country);

        return { year, month, monthEntries, summary, monthLabel, supervisorHoursMap, topSupervisorName, supervisorProfile, stateEntry, countryEntry };
    }

    // Map computed data to the real BACB form field names
    function computeMfvfFieldValues(selectedMonth) {
        const ctx = getMfvfContext(selectedMonth);
        const { summary, supervisorProfile, topSupervisorName, stateEntry, countryEntry, year, month } = ctx;
        const fmtHH = (hrs) => String(Math.floor(hrs)).padStart(2, '0');
        const fmtMM = (hrs) => String(Math.round((hrs % 1) * 60)).padStart(2, '0');
        const obsTotal = Math.round(summary.observationMinutes || 0);

        return {
            'TRAINEE_NAME': profileData.name || '',
            'TRAINEE_BACB_ID': profileData.rbtNumber || '',
            'TRAINEE_CERTIFICATE_MONTH/YEAR': `${String(month).padStart(2, '0')}/${year}`,
            'TRAINEE_FIELDWORK_STATE': stateEntry?.state || '',
            'TRAINEE_FIELDWORK_COUNTRY': countryEntry?.country || 'United States',
            'RESPONSIBLE_SUPERVISOR_NAME': '', // left blank by design — filled by trainee/supervisor
            'RESPONSIBLE_SUPERVISOR_BACB_ID': supervisorProfile?.cert || '',
            'Independent_Hours': fmtHH(summary.unsupervised),
            'Independent_Minutes': fmtMM(summary.unsupervised),
            'Supervised_Hours': fmtHH(summary.supervised),
            'Supervised_Minutes': fmtMM(summary.supervised),
            'Observation_Hours': String(Math.floor(obsTotal / 60)).padStart(2, '0'),
            'Independent_Minutes 3': String(obsTotal % 60).padStart(2, '0'),
            'Total_Fieldwork_Hours': fmtHH(summary.total),
            'Total_Fieldwork_Minutes': fmtMM(summary.total),
            'PERCENT_HOURS_SUPERVISED': `${summary.percentage.toFixed(2)}%`,
            'TRAINEE_SIGNATURE_DATE': '',
            'SUPERVISOR_SIGNATURE_DATE': ''
        };
    }

    // --- Live calculation: Total Fieldwork Hours + Percentage Supervised ---
    const mfvfInputEl = (overlay, name) => overlay.querySelector(`input[data-field-name="${name}"]`);
    const mfvfNum = (overlay, name) => {
        const n = parseInt(mfvfInputEl(overlay, name)?.value, 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const mfvfSetVal = (overlay, name, value) => {
        const el = mfvfInputEl(overlay, name);
        if (el) el.value = value;
    };

    function recomputeMfvfTotals(overlay) {
        const iH = mfvfNum(overlay, 'Independent_Hours');
        const iM = mfvfNum(overlay, 'Independent_Minutes');
        const sH = mfvfNum(overlay, 'Supervised_Hours');
        const sM = mfvfNum(overlay, 'Supervised_Minutes');

        // Carry minutes into hours (e.g. 45 + 30 = 75 → +1h 15m)
        const totalMinRaw = iM + sM;
        const totalMin = totalMinRaw % 60;
        const totalH = iH + sH + Math.floor(totalMinRaw / 60);
        const pad2 = (v) => String(v).padStart(2, '0');
        mfvfSetVal(overlay, 'Total_Fieldwork_Hours', pad2(totalH));
        mfvfSetVal(overlay, 'Total_Fieldwork_Minutes', pad2(totalMin));

        // Percentage supervised = supervised / total * 100
        const supervisedDec = sH + sM / 60;
        const totalDec = iH + iM / 60 + supervisedDec;
        const pct = totalDec > 0 ? (supervisedDec / totalDec) * 100 : 0;
        mfvfSetVal(overlay, 'PERCENT_HOURS_SUPERVISED', `${pct.toFixed(2)}%`);
    }

    function wireMfvfLiveCalc(overlay) {
        ['Independent_Hours', 'Independent_Minutes', 'Supervised_Hours', 'Supervised_Minutes'].forEach(name => {
            const el = mfvfInputEl(overlay, name);
            if (el) el.addEventListener('input', () => recomputeMfvfTotals(overlay));
        });
        // Calculated fields are derived — make them read-only so they can't be edited out of sync
        ['Total_Fieldwork_Hours', 'Total_Fieldwork_Minutes', 'PERCENT_HOURS_SUPERVISED'].forEach(name => {
            const el = mfvfInputEl(overlay, name);
            if (el) el.readOnly = true;
        });
        recomputeMfvfTotals(overlay);
    }

    // Render the BACB template to canvas and overlay interactive inputs over each real field
    async function renderMfvfEditor(selectedMonth) {
        const stage = document.getElementById('pdf-editor-stage');
        const canvas = document.getElementById('pdf-editor-canvas');
        const overlay = document.getElementById('pdf-overlay-layer');
        const loading = document.getElementById('pdf-editor-loading');
        const scroll = document.getElementById('pdf-editor-scroll');
        if (!stage || !canvas || !overlay) return;

        if (pdfIframe) pdfIframe.classList.add('hidden');
        if (pdfFallback) pdfFallback.classList.add('hidden');
        stage.style.display = 'none';
        overlay.innerHTML = '';
        if (loading) loading.classList.remove('hidden');

        try {
            if (!window.pdfjsLib || !window.PDFLib) throw new Error('PDF libraries not loaded');

            const resp = await fetch(LOCAL_TEMPLATE_URL);
            if (!resp.ok) throw new Error(`Template fetch failed: ${resp.status}`);
            const buf = await resp.arrayBuffer();
            mfvfEditorState.templateBytes = buf.slice(0);
            mfvfEditorState.month = selectedMonth;
            mfvfEditorState.signatures = {};

            // 1) Render page 1 with PDF.js
            const pdfjsDoc = await window.pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
            const page = await pdfjsDoc.getPage(1);
            const baseViewport = page.getViewport({ scale: 1 });
            mfvfEditorState.pageW = baseViewport.width;
            mfvfEditorState.pageH = baseViewport.height;

            const avail = (scroll?.clientWidth || 760) - 32;
            let scale = avail / baseViewport.width;
            scale = Math.max(1.0, Math.min(scale, 2.0));
            mfvfEditorState.scale = scale;

            const viewport = page.getViewport({ scale });
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = viewport.width + 'px';
            canvas.style.height = viewport.height + 'px';
            stage.style.width = viewport.width + 'px';
            stage.style.height = viewport.height + 'px';
            const ctx2d = canvas.getContext('2d');
            ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
            await page.render({ canvasContext: ctx2d, viewport }).promise;

            // 2) Read real field rectangles with pdf-lib and build overlay inputs
            // NOTE: use instanceof (not constructor.name) — the minified pdf-lib build mangles class names
            const { PDFDocument, PDFTextField, PDFSignature } = window.PDFLib;
            const libDoc = await PDFDocument.load(mfvfEditorState.templateBytes.slice(0));
            const form = libDoc.getForm();
            const fields = form.getFields();
            const values = computeMfvfFieldValues(selectedMonth);
            mfvfEditorState.fields = [];

            for (const f of fields) {
                const name = f.getName();
                const isText = PDFTextField && f instanceof PDFTextField;
                const isSig = PDFSignature && f instanceof PDFSignature;
                if (!isText && !isSig) continue;
                const type = isText ? 'PDFTextField' : 'PDFSignature';
                let widgets = [];
                try { widgets = f.acroField.getWidgets(); } catch (e) { /* none */ }
                const w0 = widgets[0];
                if (!w0) continue;
                const r = w0.getRectangle();
                const left = r.x * scale;
                const top = (mfvfEditorState.pageH - (r.y + r.height)) * scale;
                const width = r.width * scale;
                const height = r.height * scale;
                mfvfEditorState.fields.push({ name, type, rect: r });

                if (isText) {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.dataset.fieldName = name;
                    input.value = values[name] || '';
                    input.className = 'mfvf-overlay-input';
                    input.style.position = 'absolute';
                    input.style.left = left + 'px';
                    input.style.top = top + 'px';
                    input.style.width = width + 'px';
                    input.style.height = height + 'px';
                    input.style.fontSize = Math.max(7, Math.min(height * 0.72, 13)) + 'px';
                    overlay.appendChild(input);
                } else {
                    // Signature field → interactive zone
                    const zone = document.createElement('div');
                    zone.dataset.sigField = name;
                    zone.className = 'mfvf-sig-zone';
                    zone.style.position = 'absolute';
                    zone.style.left = left + 'px';
                    zone.style.top = top + 'px';
                    zone.style.width = width + 'px';
                    zone.style.height = height + 'px';
                    if (name === 'TRAINEE_SIGNATURE') {
                        zone.innerHTML = '<span class="mfvf-sig-label"><i class="ph-fill ph-pen-nib"></i> Tap to sign</span>';
                        zone.addEventListener('click', () => openSignaturePad('TRAINEE_SIGNATURE'));
                    } else {
                        zone.innerHTML = '<span class="mfvf-sig-label" style="color:#94a3b8;">Supervisor signs</span>';
                        zone.style.pointerEvents = 'none';
                        zone.style.borderColor = 'rgba(148,163,184,0.4)';
                        zone.style.background = 'rgba(148,163,184,0.06)';
                    }
                    overlay.appendChild(zone);
                }
            }

            // Wire live Total + Percentage calculation
            wireMfvfLiveCalc(overlay);

            stage.style.display = 'block';
        } catch (err) {
            console.error('M-FVF editor render failed:', err);
            if (pdfFallback) pdfFallback.classList.remove('hidden');
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    }

    // Signature pad modal
    function openSignaturePad(fieldName) {
        signatureTargetField = fieldName;
        const modal = document.getElementById('signature-modal');
        const cv = document.getElementById('signature-pad-canvas');
        if (!modal || !cv) return;
        modal.classList.remove('hidden');
        // Size the canvas to its displayed box (now that it's visible)
        const ratio = window.devicePixelRatio || 1;
        cv.width = cv.offsetWidth * ratio;
        cv.height = cv.offsetHeight * ratio;
        const cctx = cv.getContext('2d');
        cctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (window.SignaturePad) {
            // Transparent background → exported PNG contains only the strokes (no white box over the form line)
            signaturePadInstance = new window.SignaturePad(cv, { penColor: '#0f172a', backgroundColor: 'rgba(255,255,255,0)' });
        }
    }

    function closeSignaturePad() {
        const modal = document.getElementById('signature-modal');
        if (modal) modal.classList.add('hidden');
        if (signaturePadInstance) { signaturePadInstance.off?.(); signaturePadInstance = null; }
        signatureTargetField = null;
    }

    function trimSignatureCanvas(sourceCanvas) {
        const w = sourceCanvas.width, h = sourceCanvas.height;
        const ctx = sourceCanvas.getContext('2d');
        const pixels = ctx.getImageData(0, 0, w, h).data;
        let top = h, left = w, bottom = 0, right = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (pixels[(y * w + x) * 4 + 3] > 10) {
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                    if (x < left) left = x;
                    if (x > right) right = x;
                }
            }
        }
        if (bottom <= top || right <= left) return sourceCanvas.toDataURL('image/png');
        const pad = 10;
        top = Math.max(0, top - pad);
        left = Math.max(0, left - pad);
        bottom = Math.min(h - 1, bottom + pad);
        right = Math.min(w - 1, right + pad);
        const tw = right - left + 1, th = bottom - top + 1;
        const tmp = document.createElement('canvas');
        tmp.width = tw; tmp.height = th;
        tmp.getContext('2d').drawImage(sourceCanvas, left, top, tw, th, 0, 0, tw, th);
        return tmp.toDataURL('image/png');
    }

    function applySignature() {
        if (!signaturePadInstance || signaturePadInstance.isEmpty()) {
            closeSignaturePad();
            return;
        }
        const cv = document.getElementById('signature-pad-canvas');
        const dataUrl = trimSignatureCanvas(cv);
        const fieldName = signatureTargetField;
        mfvfEditorState.signatures[fieldName] = dataUrl;

        const overlay = document.getElementById('pdf-overlay-layer');
        const zone = overlay?.querySelector(`[data-sig-field="${fieldName}"]`);
        if (zone) {
            zone.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;" alt="signature"/>`;
            zone.classList.add('signed');
        }
        if (fieldName === 'TRAINEE_SIGNATURE') {
            const dateInput = overlay?.querySelector('[data-field-name="TRAINEE_SIGNATURE_DATE"]');
            if (dateInput && !dateInput.value) dateInput.value = dayjs().format('MM/DD/YYYY');
        }
        closeSignaturePad();
    }

    // Build the filled + flattened PDF from the template and overlay inputs
    async function buildMfvfPdfBlob() {
            const { PDFDocument } = window.PDFLib;
            const doc = await PDFDocument.load(mfvfEditorState.templateBytes.slice(0));
            const form = doc.getForm();

            // Fill text fields from the overlay inputs
            const overlay = document.getElementById('pdf-overlay-layer');
            const inputs = overlay ? overlay.querySelectorAll('input[data-field-name]') : [];
            inputs.forEach(inp => {
                const name = inp.dataset.fieldName;
                const val = inp.value;
                if (!val) return;
                try { form.getTextField(name).setText(val); } catch (e) { /* not a text field */ }
            });

            // Draw any captured signatures at their field rectangles
            const page = doc.getPages()[0];
            for (const [fieldName, dataUrl] of Object.entries(mfvfEditorState.signatures)) {
                const f = mfvfEditorState.fields.find(x => x.name === fieldName);
                if (!f) continue;
                const png = await doc.embedPng(dataUrl);
                const r = f.rect;
                const pad = 2;
                const maxW = r.width - 2 * pad;
                const maxH = r.height - 2 * pad;
                const ar = png.width / png.height;
                let dw = maxW;
                let dh = dw / ar;
                if (dh > maxH) { dh = maxH; dw = dh * ar; }
                page.drawImage(png, { x: r.x + (r.width - dw) / 2, y: r.y + (r.height - dh) / 2, width: dw, height: dh });
            }

            // Flatten so values render in every viewer (browsers, Google viewer, etc.)
            try { form.flatten(); } catch (e) { console.warn('Flatten failed (non-critical):', e); }

            const bytes = await doc.save();
            return new Blob([bytes], { type: 'application/pdf' });
    }

    // Download the filled PDF to the user's computer
    async function downloadMfvfEditor() {
        if (!mfvfEditorState.templateBytes) {
            await CustomModal.alert('The form is still loading. Please wait a moment and try again.', 'Please Wait');
            return;
        }
        try {
            const blob = await buildMfvfPdfBlob();
            const month = mfvfEditorState.month || pdfMonthSelector?.value || monthSelector?.value || '';
            const name = (profileData?.name || 'Trainee').replace(/\s+/g, '_');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `MFVF_${name}_${month}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        } catch (err) {
            console.error('M-FVF download failed:', err);
            await CustomModal.alert('Could not generate the PDF: ' + err.message, 'Download Failed');
        }
    }

    // Save: fill template fields + draw signature → upload to cloud
    async function saveMfvfEditor() {
        const selectedMonth = mfvfEditorState.month || pdfMonthSelector?.value || monthSelector?.value;
        if (!selectedMonth) {
            await CustomModal.alert('Please select a month first.', 'No Month Selected');
            return;
        }
        if (!userId || userId === 'guest') {
            await CustomModal.alert('Please sign in to save your M-FVF to the cloud.', 'Sign In Required');
            return;
        }
        if (!storage) {
            await CustomModal.alert('Firebase Storage is not ready yet. Please refresh and try again.', 'Storage Not Ready');
            return;
        }
        if (!mfvfEditorState.templateBytes) {
            await CustomModal.alert('The form is still loading. Please wait a moment and try again.', 'Please Wait');
            return;
        }

        try {
            const overlay = document.getElementById('pdf-overlay-layer');
            const blob = await buildMfvfPdfBlob();

            // Upload to cloud
            const filename = `MFVF_${(profileData.name || 'Trainee').replace(/\s+/g, '_')}_${selectedMonth}.pdf`;
            const storagePath = `mfvf/${userId}/${selectedMonth}/draft.pdf`;
            const fileRef = storageRef(storage, storagePath);
            await uploadBytes(fileRef, blob, { contentType: 'application/pdf' });
            const downloadUrl = await getDownloadURL(fileRef);

            // Read live values from overlay inputs (what user actually edited)
            const fieldVal = (name) => {
                const inp = overlay?.querySelector(`input[data-field-name="${name}"]`);
                return inp ? inp.value : '';
            };
            const indepH = parseFloat(fieldVal('Independent_Hours')) || 0;
            const indepM = parseFloat(fieldVal('Independent_Minutes')) || 0;
            const supH = parseFloat(fieldVal('Supervised_Hours')) || 0;
            const supM = parseFloat(fieldVal('Supervised_Minutes')) || 0;
            const totalH = parseFloat(fieldVal('Total_Fieldwork_Hours')) || 0;
            const totalM = parseFloat(fieldVal('Total_Fieldwork_Minutes')) || 0;
            const totalDecimal = totalH + totalM / 60;
            const supervisedDecimal = supH + supM / 60;
            const pctRaw = fieldVal('PERCENT_HOURS_SUPERVISED').replace('%', '');
            const pctValue = parseFloat(pctRaw) || 0;
            const obsH = parseFloat(fieldVal('Observation_Hours')) || 0;
            const obsM = parseFloat(fieldVal('Independent_Minutes 3')) || 0;

            const ctx = getMfvfContext(selectedMonth);
            const { monthLabel, monthEntries } = ctx;
            const liveSupervisorName = fieldVal('RESPONSIBLE_SUPERVISOR_NAME');
            const traineeSignatureDataUrl = mfvfEditorState.signatures['TRAINEE_SIGNATURE'] || null;
            const hasTraineeSignature = !!traineeSignatureDataUrl;
            const now = new Date().toISOString();

            await setDoc(getMfvfVerificationRef(userId, selectedMonth), {
                status: 'draft',
                month: selectedMonth,
                monthLabel,
                traineeId: userId,
                traineeName: fieldVal('TRAINEE_NAME') || profileData.name || '',
                traineeEmail: profileData.email || auth.currentUser?.email || '',
                bacbId: fieldVal('TRAINEE_BACB_ID') || profileData.rbtNumber || '',
                supervisorName: liveSupervisorName,
                supervisorCert: fieldVal('RESPONSIBLE_SUPERVISOR_BACB_ID') || '',
                supervisorEmail: '',
                draftPdfPath: storagePath,
                draftPdfUrl: downloadUrl,
                draftPdfName: filename,
                traineeSigned: hasTraineeSignature,
                traineeSignatureDataUrl: traineeSignatureDataUrl || '',
                formData: {
                    state: fieldVal('TRAINEE_FIELDWORK_STATE'),
                    country: fieldVal('TRAINEE_FIELDWORK_COUNTRY') || 'United States',
                    independentHours: indepH + indepM / 60,
                    supervisedHours: supervisedDecimal,
                    totalHours: totalDecimal,
                    observationMinutes: obsH * 60 + obsM,
                    supervisionPercentage: pctValue
                },
                entryCount: monthEntries.length,
                savedAt: now,
                updatedAt: now
            }, { merge: true });

            showPdfSendToast('Saved to M-FVF Center ✓');
        } catch (err) {
            console.error('M-FVF editor save failed:', err);
            await CustomModal.alert(
                'Could not save your M-FVF. Please check your connection and try again.\n\n' + (err?.message || err),
                'Save Failed'
            );
            throw err;
        }
    }

    function openPdfViewer() {
        if (!pdfPreviewModal) return;

        // Populate month picker & auto-fill panel
        populatePdfMonthSelector();
        const month = pdfMonthSelector.value || monthSelector.value;
        renderAutofillPanel(month);
        renderPdfSupervisorSendMenu();
        setPdfSupervisorSendVisible(true);
        if (pdfSendSupervisorMenu) pdfSendSupervisorMenu.classList.add('hidden');
        if (pdfSendToast) pdfSendToast.classList.add('hidden');

        // Show modal first so the editor can measure its container width
        pdfPreviewModal.classList.remove('hidden');
        pdfPreviewModal.classList.add('flex');
        document.body.style.overflow = 'hidden';

        // Render the interactive editor
        renderMfvfEditor(month);
    }
    window.openMfvfPdfViewer = openPdfViewer;
    window.openMfvfRequestPdfViewer = openMfvfRequestPdfViewer;

    function closePdfViewer() {
        if (!pdfPreviewModal) return;
        pdfPreviewModal.classList.add('hidden');
        pdfPreviewModal.classList.remove('flex');
        document.body.style.overflow = '';
        if (pdfIframe) pdfIframe.src = '';
        const overlay = document.getElementById('pdf-overlay-layer');
        if (overlay) overlay.innerHTML = '';
        const stage = document.getElementById('pdf-editor-stage');
        if (stage) stage.style.display = 'none';
    }

    // Signature modal button wiring
    document.getElementById('signature-clear-btn')?.addEventListener('click', () => { signaturePadInstance?.clear(); });
    document.getElementById('signature-cancel-btn')?.addEventListener('click', closeSignaturePad);
    document.getElementById('signature-apply-btn')?.addEventListener('click', applySignature);

    // Month change → re-render panel + editor
    if (pdfMonthSelector) {
        pdfMonthSelector.addEventListener('change', () => {
            renderAutofillPanel(pdfMonthSelector.value);
            renderPdfSupervisorSendMenu();
            renderMfvfEditor(pdfMonthSelector.value);
        });
    }

    if (generateMfvfBtn) generateMfvfBtn.addEventListener('click', openPdfViewer);
    if (pdfCloseBtn) pdfCloseBtn.addEventListener('click', closePdfViewer);
    if (pdfSendSupervisorBtn) {
        pdfSendSupervisorBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            renderPdfSupervisorSendMenu();
            if (pdfSendSupervisorMenu) pdfSendSupervisorMenu.classList.toggle('hidden');
        });
    }
    if (pdfSendSupervisorMenu) {
        pdfSendSupervisorMenu.addEventListener('click', (event) => event.stopPropagation());
    }
    document.addEventListener('click', () => {
        if (pdfSendSupervisorMenu) pdfSendSupervisorMenu.classList.add('hidden');
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pdfPreviewModal && !pdfPreviewModal.classList.contains('hidden')) {
            closePdfViewer();
        }
    });


    if (exportMonthlyCsvBtn) exportMonthlyCsvBtn.addEventListener('click', () => {
        const selectedMonth = monthSelector.value;
        const [year, month] = selectedMonth.split('-');
        const monthData = allEntries.filter(e => {
            const d = dayjs(e.date);
            return d.year() == year && (d.month() + 1) == month;
        });
        exportToCsv(monthData, calculateSummaryData(monthData), `Fieldwork_${selectedMonth}.csv`);
    });

    if (exportYearlyPdfBtn) exportYearlyPdfBtn.addEventListener('click', async () => await CustomModal.alert("Yearly PDF coming soon!", "Feature Coming Soon"));
    if (exportYearlyCsvBtn) exportYearlyCsvBtn.addEventListener('click', () => {
        const year = yearSelector.value;
        const yearData = allEntries.filter(e => dayjs(e.date).year() == year);
        exportToCsv(yearData, calculateSummaryData(yearData), `Fieldwork_${year}.csv`);
    });

    if (exportAllTimePdfBtn) exportAllTimePdfBtn.addEventListener('click', async () => await CustomModal.alert("Career PDF coming soon!", "Feature Coming Soon"));
    if (exportAllTimeCsvBtn) exportAllTimeCsvBtn.addEventListener('click', () => {
        exportToCsv(allEntries, calculateSummaryData(allEntries), `Fieldwork_AllTime.csv`);
    });

    document.getElementById('pdf-local-download-btn')?.addEventListener('click', downloadMfvfEditor);

    const pdfDownloadBtnEl = document.getElementById('pdf-download-btn');
    if (pdfDownloadBtnEl) {
        pdfDownloadBtnEl.addEventListener('click', async () => {
            pdfDownloadBtnEl.disabled = true;
            const origHtml = pdfDownloadBtnEl.innerHTML;
            pdfDownloadBtnEl.innerHTML = '<i class="ph-fill ph-spinner-gap animate-spin text-sm"></i> Saving...';
            try {
                await saveMfvfEditor();
            } finally {
                pdfDownloadBtnEl.disabled = false;
                pdfDownloadBtnEl.innerHTML = origHtml;
            }
        });
    }

    if (pdfCloseBtn) {
        pdfCloseBtn.addEventListener('click', () => {
            pdfPreviewModal.classList.add('hidden');
            pdfIframe.src = '';
        });
    }

    if (logTableBody) logTableBody.addEventListener('click', handleTableClick);
    if (yearlyLogTableBody) yearlyLogTableBody.addEventListener('click', handleTableClick);
    if (allTimeLogTableBody) allTimeLogTableBody.addEventListener('click', handleTableClick);

    // Role Selection
    if (selectTraineeBtn) selectTraineeBtn.addEventListener('click', () => handleRoleSelection('trainee'));
    if (selectSupervisorBtn) selectSupervisorBtn.addEventListener('click', () => handleRoleSelection('supervisor'));

    // Auth State
    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            if (loginView) loginView.classList.add('hidden');
            if (userDisplay) userDisplay.textContent = user.displayName || user.email;

            // Show admin link only for authorized admin
            const adminNavSection = document.getElementById('admin-nav-section');
            if (adminNavSection && user.email === 'nana.behesht@gmail.com') {
                adminNavSection.classList.remove('hidden');
            }

            if (unsubscribeProfile) unsubscribeProfile();
            const profileRef = doc(db, `users/${userId}`);
            unsubscribeProfile = onSnapshot(profileRef, (docSnap) => {
                if (docSnap.exists()) {
                    profileData = docSnap.data();
                    console.log("[DEBUG] Profile Loaded. Role:", profileData.role);

                    if (isUserAccessBlocked(profileData)) {
                        if (appContainer) appContainer.classList.add('hidden');
                        if (roleSelectionView) roleSelectionView.classList.add('hidden');
                        if (!accessBlockedAlertShown) {
                            accessBlockedAlertShown = true;
                            CustomModal.alert("Your account access is currently deactivated. Please contact the FieldlyGo admin team if you believe this is a mistake.", "Account Access Deactivated", "ph-lock-key")
                                .finally(() => signOut(auth));
                        } else {
                            signOut(auth);
                        }
                        return;
                    }

                    accessBlockedAlertShown = false;
                    
                    // Update user display text to username or display name
                    if (userDisplay) userDisplay.textContent = profileData.username || user.displayName || user.email;

                    // Warning banner check for placeholder emails
                    const isPlaceholderEmail = user.email && user.email.endsWith('@fieldlygo.com');
                    const hasRealEmail = profileData.email && !profileData.email.endsWith('@fieldlygo.com');
                    
                    if (isPlaceholderEmail && !hasRealEmail) {
                        if (emailLinkBanner) emailLinkBanner.classList.remove('hidden');
                        if (accountSecuritySection) accountSecuritySection.classList.remove('hidden');
                        if (accountRealEmail) accountRealEmail.value = '';
                        if (emailLinkStatus) {
                            emailLinkStatus.textContent = 'Please link a real email address to secure your account.';
                            emailLinkStatus.className = 'text-xs text-amber-400 mt-1 leading-relaxed';
                        }
                    } else {
                        if (emailLinkBanner) emailLinkBanner.classList.add('hidden');
                        if (accountSecuritySection) accountSecuritySection.classList.remove('hidden');
                        if (accountRealEmail) accountRealEmail.value = profileData.email || user.email || '';
                        if (emailLinkStatus) {
                            emailLinkStatus.textContent = 'Your account is linked to your email address. You can update it here.';
                            emailLinkStatus.className = 'text-xs text-emerald-400 mt-1 leading-relaxed';
                        }
                    }

                    if (!profileData.role) {
                        if (appContainer) appContainer.classList.add('hidden');
                        if (roleSelectionView) roleSelectionView.classList.remove('hidden');
                    } else {
                        if (roleSelectionView) roleSelectionView.classList.add('hidden');
                        if (appContainer) appContainer.classList.remove('hidden');
                        setupUIByRole(profileData.role);
                        if (profileData.role === 'trainee' || profileData.role === 'admin') {
                            setupTraineeListeners();
                            initializeNotifications();
                        } else {
                            setupSupervisorListeners();
                        }
                    }
                    if (document.getElementById('trainee-name')) document.getElementById('trainee-name').value = profileData.name || '';
                    if (document.getElementById('rbt-number')) document.getElementById('rbt-number').value = profileData.rbtNumber || '';
                    if (document.getElementById('fieldwork-type')) document.getElementById('fieldwork-type').value = profileData.fieldworkType || 'Supervised';
                    if (userRoleDisplay) userRoleDisplay.textContent = profileData.role === 'supervisor' ? 'Supervisor' : 'Trainee';
                    renderSupervisors();
                } else {
                    if (appContainer) appContainer.classList.add('hidden');
                    if (roleSelectionView) roleSelectionView.classList.remove('hidden');
                }
            }, (error) => {
                console.error("App.js: Firestore permission error:", error.message);
                // Handle permission denied - show role selection to create profile
                if (error.code === 'permission-denied') {
                    console.log("App.js: Permission denied, showing role selection for new profile setup");
                    if (appContainer) appContainer.classList.add('hidden');
                    if (roleSelectionView) roleSelectionView.classList.remove('hidden');
                }
            });

        } else {
            // Clean up active listeners on sign out to prevent race conditions
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }
            if (unsubscribeEntries) {
                unsubscribeEntries();
                unsubscribeEntries = null;
            }
            if (unsubscribeChats) {
                unsubscribeChats();
                unsubscribeChats = null;
            }
            if (unsubscribeChatMessages) {
                unsubscribeChatMessages();
                unsubscribeChatMessages = null;
            }
            if (supervisorChatsUnsubscribes && supervisorChatsUnsubscribes.length > 0) {
                supervisorChatsUnsubscribes.forEach(unsub => { try { unsub(); } catch (e) {} });
                supervisorChatsUnsubscribes = [];
            }
            if (unsubscribeGlobalChats) {
                unsubscribeGlobalChats();
                unsubscribeGlobalChats = null;
            }
            if (supervisorNotificationUnsubscribes && supervisorNotificationUnsubscribes.length > 0) {
                supervisorNotificationUnsubscribes.forEach(unsub => { try { unsub(); } catch (e) {} });
                supervisorNotificationUnsubscribes = [];
            }

            activeNotifications = [];
            globalChatsData = {};

            // Clear and hide notification badges/dropdowns
            const badges = document.querySelectorAll('.notification-badge');
            badges.forEach(badge => {
                badge.textContent = '0';
                badge.classList.add('hidden');
            });
            const messageBadges = document.querySelectorAll('.message-unread-badge');
            messageBadges.forEach(badge => {
                badge.textContent = '0';
                badge.classList.add('hidden');
            });
            if (desktopNotificationDropdown) desktopNotificationDropdown.classList.add('hidden');
            if (mobileNotificationDropdown) mobileNotificationDropdown.classList.add('hidden');

            userId = null;
            allEntries = [];
            profileData = { name: '', rbtNumber: '', supervisors: [], fieldworkType: 'Supervised' };

            if (appContainer) appContainer.classList.add('hidden');
            if (roleSelectionView) roleSelectionView.classList.add('hidden');
            if (loginView) loginView.classList.remove('hidden');
            if (emailLinkBanner) emailLinkBanner.classList.add('hidden');
            if (accountSecuritySection) accountSecuritySection.classList.add('hidden');
        }
    });

    // Initialize Notification System Toggles
    setupNotificationToggles();

    console.log("App.js: Initialization complete");
}

// --- 3D Interactive Particle Engine ---
function initInteractiveParticles(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn(`[Particles] Canvas not found: #${canvasId}`);
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;

    function resize() {
        const rect = canvas.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    const mouse = { x: null, y: null, targetX: null, targetY: null, radius: 180, active: false };

    // Capture mouse/touch positions
    const container = canvas.parentElement || window;

    container.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.targetX = e.clientX - rect.left;
        mouse.targetY = e.clientY - rect.top;
        mouse.active = true;
    });

    container.addEventListener('mouseleave', () => {
        mouse.targetX = null;
        mouse.targetY = null;
        mouse.active = false;
    });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            const rect = canvas.getBoundingClientRect();
            mouse.targetX = e.touches[0].clientX - rect.left;
            mouse.targetY = e.touches[0].clientY - rect.top;
            mouse.active = true;
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        mouse.targetX = null;
        mouse.targetY = null;
        mouse.active = false;
    });

    // Create particles centered asymmetrically
    const particles = [];
    const isRoleSelection = canvasId === 'role-particles-canvas';
    
    // Scale count by screen area for perfect density
    const baseCount = isRoleSelection ? 160 : 190;
    const particleCount = Math.min(220, Math.max(70, Math.floor((width * height) / 7500) + baseCount));

    for (let i = 0; i < particleCount; i++) {
        // Spiral vortex in 3D
        const ratio = i / particleCount;
        const angle = ratio * Math.PI * 18; // Swirling spiral wraps
        const orbitRadius = 60 + ratio * 480; // Distance from orbit center
        
        // 3D coordinates
        const x3d = Math.cos(angle) * orbitRadius;
        const z3d = Math.sin(angle) * orbitRadius;
        // Curved elevation grid pattern with random scatter
        const y3d = (Math.sin(orbitRadius * 0.02) * 55) + (Math.random() - 0.5) * 12;

        const colorVal = Math.random();
        let hue = 330;
        if (colorVal < 0.25) hue = 330; // Pink
        else if (colorVal < 0.5) hue = 270; // Purple
        else if (colorVal < 0.75) hue = 210; // Blue
        else hue = 175; // Teal

        particles.push({
            x3d: x3d,
            y3d: y3d,
            z3d: z3d,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 1.0 + Math.random() * 2.5,
            hue: hue,
            alpha: 0.25 + Math.random() * 0.55
        });
    }

    const parentView = canvas.closest('#login-view, #role-selection-view');
    function isViewVisible() {
        if (!parentView) return true;
        return !parentView.classList.contains('hidden') && parentView.style.display !== 'none';
    }

    const fov = 450;
    const rotationSpeedY = 0.0012;
    const rotationSpeedX = 0.0004;

    const cosY = Math.cos(rotationSpeedY);
    const sinY = Math.sin(rotationSpeedY);
    const cosX = Math.cos(rotationSpeedX);
    const sinX = Math.sin(rotationSpeedX);

    function tick() {
        const isLight = document.body.classList.contains('light-mode');

        // Interpolate mouse coordinates smoothly
        if (mouse.targetX !== null && mouse.targetY !== null) {
            if (mouse.x === null) {
                mouse.x = mouse.targetX;
                mouse.y = mouse.targetY;
            } else {
                mouse.x += (mouse.targetX - mouse.x) * 0.12;
                mouse.y += (mouse.targetY - mouse.y) * 0.12;
            }
        } else {
            mouse.x = null;
            mouse.y = null;
        }

        const centerX = isRoleSelection ? width * 0.5 : width * 0.72;
        const centerY = height * 0.45;

        ctx.clearRect(0, 0, width, height);

        // Update, project and sort particles by 3D depth (z3d)
        particles.forEach(p => {
            // Apply slow 3D rotation
            // Rotate around Y-axis
            const x1 = p.x3d * cosY - p.z3d * sinY;
            const z1 = p.z3d * cosY + p.x3d * sinY;
            
            // Rotate around X-axis
            const y2 = p.y3d * cosX - z1 * sinX;
            const z2 = z1 * cosX + p.y3d * sinX;

            p.x3d = x1;
            p.y3d = y2;
            p.z3d = z2;

            // Project onto 2D viewport
            const scale = fov / (fov + p.z3d + 200);
            const target2dX = centerX + p.x3d * scale;
            const target2dY = centerY + p.y3d * scale;

            if (p.x === 0 && p.y === 0) {
                p.x = target2dX;
                p.y = target2dY;
            }

            // Mouse interaction forces
            let forceX = 0;
            let forceY = 0;

            if (mouse.x !== null && mouse.y !== null) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < mouse.radius) {
                    const strength = (mouse.radius - dist) / mouse.radius;
                    
                    // Repel force
                    const repForce = 4.2;
                    const pushX = (dx / (dist || 1)) * strength * repForce;
                    const pushY = (dy / (dist || 1)) * strength * repForce;

                    // Swirling fluid flow force
                    const swirlForce = 3.6;
                    const swirlX = (-dy / (dist || 1)) * strength * swirlForce;
                    const swirlY = (dx / (dist || 1)) * strength * swirlForce;

                    forceX += pushX + swirlX;
                    forceY += pushY + swirlY;
                }
            }

            // Return-to-home spring physics
            const spring = 0.04;
            const friction = 0.88;

            const ax = (target2dX - p.x) * spring;
            const ay = (target2dY - p.y) * spring;

            p.vx = (p.vx + ax + forceX) * friction;
            p.vy = (p.vy + ay + forceY) * friction;

            p.x += p.vx;
            p.y += p.vy;
        });

        // Depth sorting
        const sorted = [...particles].sort((a, b) => b.z3d - a.z3d);

        // Draw particles
        sorted.forEach(p => {
            const scale = fov / (fov + p.z3d + 200);
            const drawRadius = p.radius * scale * (isLight ? 0.9 : 1.2);

            let alpha = p.alpha;
            let lightness = 65;
            let saturation = 90;

            if (isLight) {
                alpha = p.alpha * 0.4;
                lightness = 55;
                saturation = 75;
            } else {
                alpha = p.alpha * 0.8;
                lightness = 65;
                saturation = 95;
            }

            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0.35, drawRadius), 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, ${saturation}%, ${lightness}%, ${alpha})`;

            if (!isLight) {
                ctx.shadowColor = `hsla(${p.hue}, ${saturation}%, ${lightness}%, ${alpha * 0.45})`;
                ctx.shadowBlur = drawRadius * 2.2;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fill();
        });

        ctx.shadowBlur = 0;
    }

    function animate() {
        requestAnimationFrame(animate);
        if (!isViewVisible()) return;
        tick();
    }
    animate();
}

// --- Notification System Engine ---
const initializeNotifications = () => {
    if (!userId || userId === 'guest') return;

    if (unsubscribeGlobalChats) {
        unsubscribeGlobalChats();
        unsubscribeGlobalChats = null;
    }
    if (supervisorNotificationUnsubscribes && supervisorNotificationUnsubscribes.length > 0) {
        supervisorNotificationUnsubscribes.forEach(unsub => { try { unsub(); } catch (e) {} });
        supervisorNotificationUnsubscribes = [];
    }

    globalChatsData = {};
    activeNotifications = [];

    if (profileData.role === 'trainee' || profileData.role === 'admin') {
        const chatsRef = collection(db, `users/${userId}/chats`);
        unsubscribeGlobalChats = onSnapshot(chatsRef, (snapshot) => {
            const nextChatsData = {};
            snapshot.forEach(docSnap => {
                nextChatsData[docSnap.id] = {
                    supervisorName: docSnap.data().supervisorName || 'Supervisor',
                    supervisorEmail: docSnap.data().supervisorEmail || '',
                    ...docSnap.data()
                };
            });
            globalChatsData = nextChatsData;
            updateNotificationsUI();
        }, (error) => {
            console.error("Error listening to global trainee chats:", error);
        });
    } else if (profileData.role === 'supervisor') {
        if (myTrainees && myTrainees.length > 0) {
            myTrainees.forEach(trainee => {
                const chatDocRef = doc(db, `users/${trainee.id}/chats/${userId}`);
                const unsub = onSnapshot(chatDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        globalChatsData[trainee.id] = {
                            traineeName: trainee.name || 'Trainee',
                            traineeEmail: trainee.email || '',
                            ...docSnap.data()
                        };
                    } else {
                        delete globalChatsData[trainee.id];
                    }
                    updateNotificationsUI();
                }, (error) => {
                    console.error("Error listening to trainee chat document:", trainee.id, error);
                });
                supervisorNotificationUnsubscribes.push(unsub);
            });
        }
    }
};

const updateNotificationsUI = () => {
    if (!userId || userId === 'guest') return;

    activeNotifications = [];

    // 1. Process Messages
    Object.entries(globalChatsData).forEach(([contactId, chatSummary]) => {
        if (chatSummary.lastSenderId && chatSummary.lastSenderId !== userId) {
            const lastRead = parseInt(localStorage.getItem(`chat_read_${userId}_${contactId}`) || '0', 10);
            const lastMessageTime = chatSummary.lastMessageAt ? (chatSummary.lastMessageAt.toDate ? chatSummary.lastMessageAt.toDate().getTime() : new Date(chatSummary.lastMessageAt).getTime()) : 0;

            if (lastMessageTime > lastRead) {
                const senderName = chatSummary.traineeName || chatSummary.supervisorName || 'User';
                activeNotifications.push({
                    id: `msg_${contactId}`,
                    type: 'message',
                    title: 'New Message',
                    body: `${senderName}: "${chatSummary.lastMessageText || 'No messages'}"`,
                    timestamp: lastMessageTime,
                    senderId: contactId,
                    senderName: senderName,
                    senderEmail: chatSummary.traineeEmail || chatSummary.supervisorEmail || ''
                });
            }
        }
    });

    // 2. Process Comments (Trainees only)
    if (profileData.role === 'trainee' || profileData.role === 'admin') {
        if (allEntries && allEntries.length > 0) {
            allEntries.forEach(entry => {
                if (hasFeedback(entry)) {
                    const readCommentText = localStorage.getItem(`comment_read_${userId}_${entry.id}`);
                    const feedbackFingerprint = JSON.stringify({ note: entry.supervisorNote || '', areas: entry.feedbackIssueAreas || [] });
                    if (readCommentText !== feedbackFingerprint) {
                        const supervisorName = entry.supervisorName || 'Supervisor';
                        activeNotifications.push({
                            id: `comment_${entry.id}`,
                            type: 'comment',
                            title: 'New Feedback',
                            body: `${supervisorName} flagged ${entry.date}${entry.feedbackIssueAreas?.length ? ' (' + entry.feedbackIssueAreas.slice(0,2).map(getFeedbackIssueLabel).join(', ') + ')' : ''}: "${entry.supervisorNote || ''}"`,
                            timestamp: entry.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now(),
                            entryId: entry.id,
                            noteText: JSON.stringify({ note: entry.supervisorNote || '', areas: entry.feedbackIssueAreas || [] })
                        });
                    }
                }
            });
        }
    }

    const unreadCount = activeNotifications.length;
    const unreadMessageCount = activeNotifications.filter(n => n.type === 'message').length;

    // 3. Update Badges
    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => {
        badge.textContent = unreadCount;
        if (unreadCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    const messageBadges = document.querySelectorAll('.message-unread-badge');
    messageBadges.forEach(badge => {
        badge.textContent = unreadMessageCount > 99 ? '99+' : unreadMessageCount.toString();
        if (unreadMessageCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    const unreadMessageIds = new Set(activeNotifications.filter(n => n.type === 'message').map(n => n.senderId));
    document.querySelectorAll('.chat-contact-item[data-id]').forEach(item => {
        const isUnread = unreadMessageIds.has(item.dataset.id) && item.dataset.id !== activeChatContactId;
        item.classList.toggle('unread', isUnread);
        const hasPill = !!item.querySelector('.chat-unread-pill');
        const timeWrap = item.querySelector('.flex.items-center.gap-2.flex-shrink-0');
        if (isUnread && !hasPill && timeWrap) {
            timeWrap.insertAdjacentHTML('afterbegin', '<span class="chat-unread-pill">New</span>');
        } else if (!isUnread && hasPill) {
            item.querySelector('.chat-unread-pill')?.remove();
        }
    });

    // 4. Render Dropdowns
    const renderList = (listEl, emptyEl) => {
        if (!listEl) return;
        listEl.innerHTML = '';
        
        if (unreadCount === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }

        if (emptyEl) emptyEl.classList.add('hidden');

        activeNotifications.sort((a, b) => b.timestamp - a.timestamp);

        const itemsHtml = activeNotifications.map(n => {
            const timeStr = dayjs(n.timestamp).format('MMM D, h:mm A');
            const iconClass = n.type === 'message' ? 'ph-fill ph-chat-circle-text text-indigo-400' : 'ph-fill ph-envelope-open text-pink-500';
            return `
                <div class="notification-item p-3 hover:bg-white/5 transition-colors cursor-pointer flex gap-3 items-start" data-id="${n.id}">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start gap-1">
                            <span class="text-xs font-semibold text-white truncate">${n.title}</span>
                            <span class="text-[9px] text-text-muted flex-shrink-0 mt-0.5">${timeStr}</span>
                        </div>
                        <p class="text-[11px] text-text-muted mt-0.5 line-clamp-2 leading-relaxed">${n.body}</p>
                    </div>
                </div>
            `;
        }).join('');

        listEl.innerHTML = itemsHtml;

        const items = listEl.querySelectorAll('.notification-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const notifId = item.dataset.id;
                handleNotificationClick(notifId);
            });
        });
    };

    renderList(desktopNotificationList, desktopNotificationEmpty);
    renderList(mobileNotificationList, mobileNotificationEmpty);
};

const handleNotificationClick = async (notifId) => {
    const n = activeNotifications.find(x => x.id === notifId);
    if (!n) return;

    if (n.type === 'message') {
        localStorage.setItem(`chat_read_${userId}_${n.senderId}`, Date.now().toString());
    } else if (n.type === 'comment') {
        localStorage.setItem(`comment_read_${userId}_${n.entryId}`, n.noteText);
    }

    updateNotificationsUI();

    if (desktopNotificationDropdown) desktopNotificationDropdown.classList.add('hidden');
    if (mobileNotificationDropdown) mobileNotificationDropdown.classList.add('hidden');

    if (n.type === 'message') {
        switchView('chat');
        setTimeout(() => {
            const contactItem = document.querySelector(`.chat-contact-item[data-id="${n.senderId}"]`);
            if (contactItem) {
                contactItem.click();
            } else {
                selectChatContact(n.senderId, n.senderName, n.senderEmail);
            }
        }, 300);
    } else if (n.type === 'comment') {
        switchView('monthly');
        setTimeout(() => {
            const cell = document.querySelector(`.feedback-cell[data-id="${n.entryId}"]`);
            const row = cell ? cell.closest('tr') : null;
            if (row) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('bg-primary/20');
                setTimeout(() => {
                    row.classList.remove('bg-primary/20');
                }, 3000);
            }
            showFeedbackForEntry(n.entryId);
        }, 300);
    }
};


const openSupervisorFeedbackModal = (existing = {}) => {
    return new Promise((resolve) => {
        const isLight = document.body.classList.contains('light-mode');
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-md modal-fade-in p-4';

        const cardBg = isLight ? 'bg-white' : 'rgba(15, 23, 42, 0.85)';
        const borderCol = isLight ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.1)';
        const shadow = isLight ? 'box-shadow: 0 25px 50px -12px rgba(99,102,241,0.1)' : 'box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5)';
        const textCol = isLight ? 'text-slate-800' : 'text-white';
        const mutedCol = isLight ? 'text-slate-500' : 'text-slate-400';
        const inputBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white';

        const selectedAreas = new Set(existing.issueAreas || []);

        const areasHtml = FEEDBACK_ISSUE_AREAS.map(a => {
            const sel = selectedAreas.has(a.id);
            return `<button type="button" class="fb-area-btn px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${sel ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-text-muted hover:text-white hover:border-white/20'}" data-area="${a.id}">${a.label}</button>`;
        }).join('');

        modal.innerHTML = `
            <div class="p-6 rounded-2xl max-w-md w-full border transform modal-scale-up"
                 style="background: ${cardBg}; border-color: ${borderCol}; ${shadow}; backdrop-filter: blur(25px);">
                <div class="flex items-center gap-3 mb-5">
                    <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg"><i class="ph-fill ph-note-pencil"></i></div>
                    <h3 class="text-lg font-bold ${textCol}">Supervisor Feedback</h3>
                </div>
                <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div>
                        <label class="block text-[11px] font-semibold ${mutedCol} uppercase tracking-wider mb-2">Flagged Issue Area(s) <span class="text-pink-400">*</span></label>
                        <div class="flex flex-wrap gap-1.5" id="fb-area-grid">${areasHtml}</div>
                        <div id="fb-other-wrap" class="${selectedAreas.has('other') ? '' : 'hidden'} mt-2">
                            <input type="text" id="fb-other-text" class="w-full px-3 py-2 rounded-lg ${inputBg} text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="Describe the issue..." value="${(existing.otherText || '').replace(/"/g, '&quot;')}">
                        </div>
                    </div>
                    <div>
                        <label class="block text-[11px] font-semibold ${mutedCol} uppercase tracking-wider mb-2">Feedback Note <span class="text-pink-400">*</span></label>
                        <textarea id="fb-note" rows="3" class="w-full px-3 py-2 rounded-lg ${inputBg} text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="What is wrong and what should the trainee fix...">${existing.note || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-[11px] font-semibold ${mutedCol} uppercase tracking-wider mb-2">Requested Action <span class="text-text-muted/40">(optional)</span></label>
                        <input type="text" id="fb-action" class="w-full px-3 py-2 rounded-lg ${inputBg} text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50" placeholder="e.g. Correct the hours, change supervisor..." value="${(existing.requestedAction || '').replace(/"/g, '&quot;')}">
                    </div>
                </div>
                <p id="fb-error" class="text-xs text-red-400 mt-2 hidden"></p>
                <div class="flex gap-3 mt-5">
                    <button class="fb-cancel-btn flex-1 py-2.5 px-4 rounded-xl border border-white/10 ${mutedCol} text-sm font-semibold hover:bg-white/5 transition-all">Cancel</button>
                    <button class="fb-submit-btn flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-all shadow-lg">Submit Feedback</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const areaGrid = modal.querySelector('#fb-area-grid');
        const otherWrap = modal.querySelector('#fb-other-wrap');

        areaGrid.querySelectorAll('.fb-area-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const areaId = btn.dataset.area;
                if (selectedAreas.has(areaId)) {
                    selectedAreas.delete(areaId);
                    btn.className = btn.className.replace('bg-primary/20 border-primary/40 text-primary', 'bg-white/5 border-white/10 text-text-muted hover:text-white hover:border-white/20');
                } else {
                    selectedAreas.add(areaId);
                    btn.className = btn.className.replace('bg-white/5 border-white/10 text-text-muted hover:text-white hover:border-white/20', 'bg-primary/20 border-primary/40 text-primary');
                }
                if (areaId === 'other') otherWrap.classList.toggle('hidden', !selectedAreas.has('other'));
            });
        });

        const closeModal = (result) => {
            modal.classList.replace('modal-fade-in', 'modal-fade-out');
            modal.querySelector('.transform').classList.replace('modal-scale-up', 'modal-scale-down');
            setTimeout(() => { modal.remove(); resolve(result); }, 200);
        };

        modal.querySelector('.fb-cancel-btn').addEventListener('click', () => closeModal(null));
        modal.querySelector('.fb-submit-btn').addEventListener('click', () => {
            const errEl = modal.querySelector('#fb-error');
            const note = modal.querySelector('#fb-note').value.trim();
            const action = modal.querySelector('#fb-action').value.trim();
            const otherText = modal.querySelector('#fb-other-text')?.value.trim() || '';

            if (selectedAreas.size === 0) { errEl.textContent = 'Select at least one issue area.'; errEl.classList.remove('hidden'); return; }
            if (!note) { errEl.textContent = 'Feedback note is required.'; errEl.classList.remove('hidden'); return; }
            if (selectedAreas.has('other') && !otherText) { errEl.textContent = 'Please describe the "Other" issue.'; errEl.classList.remove('hidden'); return; }

            closeModal({ issueAreas: [...selectedAreas], note, requestedAction: action, otherText });
        });
    });
};

const openFeedbackDetailModal = (entry, isTrainee = false) => {
    const isLight = document.body.classList.contains('light-mode');
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 backdrop-blur-md modal-fade-in p-4';

    const cardBg = isLight ? 'bg-white' : 'rgba(15, 23, 42, 0.85)';
    const borderCol = isLight ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.1)';
    const shadow = isLight ? 'box-shadow:0 25px 50px -12px rgba(99,102,241,0.1)' : 'box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)';
    const textCol = isLight ? 'text-slate-800' : 'text-white';
    const mutedCol = isLight ? 'text-slate-500' : 'text-slate-400';
    const inputBg = isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white';
    const fbStatus = getFeedbackStatus(entry);
    const fbConf = getFeedbackStatusConfig(fbStatus);
    const areas = entry.feedbackIssueAreas || [];
    const isResolved = fbStatus === 'resolved';
    const isDeleted = fbStatus === 'entry_deleted' || fbStatus === 'deleted';

    // Mark as read if trainee viewing for first time
    if (isTrainee && fbStatus === 'pending' && entry.id) {
        const entryRef = doc(db, `users/${userId}/entries/${entry.id}`);
        updateDoc(entryRef, { feedbackStatus: 'read', feedbackReadAt: new Date().toISOString() }).catch(() => {});
        localStorage.setItem(`comment_read_${userId}_${entry.id}`, JSON.stringify({ note: entry.supervisorNote || '', areas: entry.feedbackIssueAreas || [] }));
    }

    let traineeSection = '';
    if (isTrainee && !isDeleted) {
        traineeSection = `
            <div class="mt-4 pt-4 border-t border-white/8">
                <label class="block text-[11px] font-semibold ${mutedCol} uppercase tracking-wider mb-2">Your Response</label>
                <textarea id="fb-trainee-response" rows="2" class="w-full px-3 py-2 rounded-lg ${inputBg} text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" placeholder="Explain what you fixed or changed...">${entry.traineeResponse || ''}</textarea>
                <div class="flex items-center gap-4 mt-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="fb-mark-resolved" class="rounded border-white/10 text-green-500 focus:ring-0 focus:ring-offset-0 bg-surface/50 h-4 w-4" ${isResolved ? 'checked' : ''}>
                        <span class="text-xs font-semibold ${mutedCol}">Mark as Resolved / Fixed</span>
                    </label>
                    <button class="fb-save-response-btn px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-all">Save Response</button>
                </div>
            </div>`;
    }

    modal.innerHTML = `
        <div class="p-6 rounded-2xl max-w-md w-full border transform modal-scale-up"
             style="background:${cardBg};border-color:${borderCol};${shadow};backdrop-filter:blur(25px);">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full ${fbConf.bg} flex items-center justify-center ${fbConf.text} text-lg"><i class="ph-fill ph-${fbConf.icon}"></i></div>
                <div>
                    <h3 class="text-base font-bold ${textCol}">Supervisor Feedback</h3>
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${fbConf.bg} ${fbConf.text}"><i class="ph-fill ph-${fbConf.icon}"></i> ${fbConf.label}</span>
                </div>
            </div>
            <div class="max-h-[55vh] overflow-y-auto pr-1 space-y-3">
                ${isDeleted ? '<div class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-500/10 border border-slate-500/15"><i class="ph-fill ph-trash text-slate-400 text-xs"></i><span class="text-[11px] text-slate-400 font-medium">This entry was deleted by trainee.</span></div>' : ''}
                <div class="flex items-center gap-3 text-xs ${mutedCol}">
                    <span>${dayjs(entry.date).format('MMM D, YYYY')}</span>
                    <span>${entry.startTime} - ${entry.endTime}</span>
                    <span>${calculateHours(entry.startTime, entry.endTime).toFixed(2)} hrs</span>
                    ${entry.clientName ? `<span>${entry.clientName}</span>` : ''}
                </div>
                ${areas.length > 0 ? `<div><span class="text-[10px] ${mutedCol} uppercase tracking-wider font-semibold block mb-1">Issue</span><div class="flex flex-wrap gap-1">${renderFeedbackIssueBadges(areas)}</div></div>` : ''}
                ${entry.supervisorNote ? `<div><span class="text-[10px] ${mutedCol} uppercase tracking-wider font-semibold block mb-1">Supervisor Feedback</span><p class="text-sm ${textCol} whitespace-pre-line leading-relaxed">${entry.supervisorNote}</p></div>` : ''}
                ${entry.feedbackRequestedAction ? `<div><span class="text-[10px] ${mutedCol} uppercase tracking-wider font-semibold block mb-1">Requested Action</span><p class="text-xs text-amber-300">${entry.feedbackRequestedAction}</p></div>` : ''}
                ${entry.traineeResponse ? `<div class="pl-3 border-l-2 border-teal-500/30"><span class="text-[10px] text-teal-400/80 uppercase tracking-wider font-semibold block mb-1">Trainee Response</span><p class="text-xs text-teal-200/80 whitespace-pre-line">${entry.traineeResponse}</p></div>` : ''}
                <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${mutedCol} pt-2 border-t border-white/5">
                    ${entry.feedbackSentAt ? `<span><i class="ph ph-paper-plane-tilt"></i> Sent ${dayjs(entry.feedbackSentAt).format('MMM D, h:mm A')}</span>` : ''}
                    ${entry.feedbackReadAt ? `<span><i class="ph ph-eye"></i> Read ${dayjs(entry.feedbackReadAt).format('MMM D, h:mm A')}</span>` : ''}
                    ${entry.feedbackResolvedAt ? `<span><i class="ph-fill ph-check-circle"></i> Resolved ${dayjs(entry.feedbackResolvedAt).format('MMM D, h:mm A')}</span>` : ''}
                </div>
                <div>
                    <button class="fb-modal-toggle-details text-[10px] ${mutedCol} opacity-50 hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer"><i class="ph ph-caret-right text-[8px] fb-modal-caret"></i> View entry details</button>
                    <div id="fb-modal-details" class="hidden mt-1.5 pl-3 border-l border-white/5 text-[11px] ${mutedCol} opacity-60 space-y-0.5">
                        ${entry.activityType ? `<p><span class="opacity-60">Type:</span> ${entry.activityType}${entry.unrestrictedActivityType ? ' / ' + entry.unrestrictedActivityType : ''}</p>` : ''}
                        ${entry.supervisionType ? `<p><span class="opacity-60">Supervision:</span> ${entry.supervisionType}</p>` : ''}
                        ${entry.supervisorName ? `<p><span class="opacity-60">Supervisor:</span> ${entry.supervisorName}</p>` : ''}
                        ${entry.notes ? `<p><span class="opacity-60">Note:</span> ${entry.notes}</p>` : ''}
                    </div>
                </div>
            </div>
            ${traineeSection}
            <button class="fb-dismiss-btn w-full mt-4 py-2.5 px-4 rounded-xl border border-white/10 ${mutedCol} text-sm font-semibold hover:bg-white/5 transition-all">Dismiss</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.fb-modal-toggle-details')?.addEventListener('click', () => {
        const details = modal.querySelector('#fb-modal-details');
        if (!details) return;
        const hidden = details.classList.toggle('hidden');
        const caret = modal.querySelector('.fb-modal-caret');
        if (caret) caret.style.transform = hidden ? '' : 'rotate(90deg)';
        const btn = modal.querySelector('.fb-modal-toggle-details');
        if (btn) btn.lastChild.textContent = hidden ? ' View entry details' : ' Hide entry details';
    });

    const closeModal = () => {
        modal.classList.replace('modal-fade-in', 'modal-fade-out');
        modal.querySelector('.transform').classList.replace('modal-scale-up', 'modal-scale-down');
        setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('.fb-dismiss-btn').addEventListener('click', closeModal);

    if (isTrainee && !isDeleted) {
        modal.querySelector('.fb-save-response-btn')?.addEventListener('click', async () => {
            const response = modal.querySelector('#fb-trainee-response').value.trim();
            const markResolved = modal.querySelector('#fb-mark-resolved').checked;
            const entryRef = doc(db, `users/${userId}/entries/${entry.id}`);
            try {
                const updateData = {
                    traineeResponse: response,
                    feedbackFixed: markResolved,
                    feedbackStatus: markResolved ? 'resolved' : 'read',
                    updatedAt: new Date().toISOString()
                };
                if (markResolved && !entry.feedbackResolvedAt) updateData.feedbackResolvedAt = new Date().toISOString();
                await updateDoc(entryRef, updateData);
                entry.traineeResponse = response;
                entry.feedbackFixed = markResolved;
                entry.feedbackStatus = updateData.feedbackStatus;
                if (updateData.feedbackResolvedAt) entry.feedbackResolvedAt = updateData.feedbackResolvedAt;
                const cell = document.querySelector(`.feedback-cell[data-id="${entry.id}"]`);
                if (cell) cell.dataset.fixed = markResolved ? 'true' : 'false';
                closeModal();
                await CustomModal.alert(markResolved ? 'Marked as resolved.' : 'Response saved.', 'Feedback Updated');
            } catch (error) {
                console.error("Error saving trainee response:", error);
                await CustomModal.alert("Failed to save: " + error.message, "Error");
            }
        });
    }
};

const showFeedbackForEntry = async (entryId) => {
    const entry = allEntries.find(e => e.id === entryId);
    if (!entry || !hasFeedback(entry)) return;

    if (profileData.role === 'supervisor') {
        openFeedbackDetailModal(entry, false);
    } else {
        openFeedbackDetailModal(entry, true);
    }
};

const setupNotificationToggles = () => {
    const toggleDropdown = (btn, dropdown) => {
        if (!btn || !dropdown) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            if (btn === desktopNotificationBtn && mobileNotificationDropdown) mobileNotificationDropdown.classList.add('hidden');
            if (btn === mobileNotificationBtn && desktopNotificationDropdown) desktopNotificationDropdown.classList.add('hidden');
        });
    };

    toggleDropdown(desktopNotificationBtn, desktopNotificationDropdown);
    toggleDropdown(mobileNotificationBtn, mobileNotificationDropdown);

    document.addEventListener('click', () => {
        if (desktopNotificationDropdown) desktopNotificationDropdown.classList.add('hidden');
        if (mobileNotificationDropdown) mobileNotificationDropdown.classList.add('hidden');
    });

    if (desktopNotificationDropdown) desktopNotificationDropdown.addEventListener('click', (e) => e.stopPropagation());
    if (mobileNotificationDropdown) mobileNotificationDropdown.addEventListener('click', (e) => e.stopPropagation());

    const markAllReadAction = () => {
        activeNotifications.forEach(n => {
            if (n.type === 'message') {
                localStorage.setItem(`chat_read_${userId}_${n.senderId}`, Date.now().toString());
            } else if (n.type === 'comment') {
                localStorage.setItem(`comment_read_${userId}_${n.entryId}`, n.noteText);
            }
        });
        updateNotificationsUI();
    };

    if (desktopMarkAllRead) desktopMarkAllRead.addEventListener('click', markAllReadAction);
    if (mobileMarkAllRead) mobileMarkAllRead.addEventListener('click', markAllReadAction);
};

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
