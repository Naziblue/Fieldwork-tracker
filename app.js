import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc, query, where, getDocs, collectionGroup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

let db, auth;
let userId = null;
let allEntries = [];
let profileData = { name: '', rbtNumber: '', supervisors: [], fieldworkType: 'Supervised' }; // Default to Supervised
let unsubscribeEntries = null;
let unsubscribeProfile = null;
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
let pdfPreviewModal, pdfIframe, pdfDownloadBtn, pdfCloseBtn;

let chartContexts = {};
let tableHeaders = {};

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
        <th class="px-4 py-3 font-medium text-text-muted">Supervision</th>
        <th class="px-4 py-3 font-medium text-text-muted">Supervisor</th>
        <th class="px-4 py-3 font-medium text-text-muted hidden md:table-cell">Notes</th>
        <th class="px-4 py-3 font-medium text-text-muted text-right">Actions</th>
    `;
    if (tableHeaders.monthly) tableHeaders.monthly.innerHTML = tableHeaderHTML;
    if (tableHeaders.yearly) tableHeaders.yearly.innerHTML = tableHeaderHTML;
    if (tableHeaders.allTime) tableHeaders.allTime.innerHTML = tableHeaderHTML;
    if (tableHeaders.review) tableHeaders.review.innerHTML = tableHeaderHTML;
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

// --- UI Logic: Modal ---
const openSlideOver = (mode = 'add', entry = null) => {
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
            document.getElementById('unrestricted-explanation').value = entry.unrestrictedExplanation || '';
        }

        document.getElementById('supervision-type').value = entry.supervisionType;
        document.getElementById('supervisor-select').value = entry.supervisorName || '';
        document.getElementById('client-present').value = entry.clientPresent;
        document.getElementById('client-name').value = entry.clientName || '';
        document.getElementById('notes').value = entry.notes || '';
    }
};

const closeSlideOver = () => {
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
    supervisorDropdowns.forEach(sel => sel.innerHTML = '<option value="">Select a supervisor...</option>');

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
            supervisorDropdowns.forEach(sel => sel.add(new Option(`${s.name}`, s.name)));
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
                    const supervisorEmails = profileData.supervisors.map(s => s.email).filter(e => e);
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

// --- Local Storage Functions ---
const loadDataFromLocalStorage = () => {
    allEntries = JSON.parse(localStorage.getItem('fieldwork_entries')) || [];
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
const switchView = (viewId) => {
    console.log("App.js: switching view to variables", viewId);
    try {
        views.forEach(view => view.classList.add('hidden'));
        const targetView = document.getElementById(`${viewId}-view`);
        if (targetView) targetView.classList.remove('hidden');
        else console.error(`View element ${viewId}-view not found`);

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

        switch (viewId) {
            case 'monthly': updateMonthlyView(); break;
            case 'yearly': updateYearlyView(); break;
            case 'all-time': updateAllTimeView(); break;
        }
    } catch (e) {
        console.error("Error in switchView:", e);
        alert("Error rendering view: " + e.message);
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
        tableBodyElement.innerHTML = `<tr><td colspan="9" class="text-center py-12 text-text-muted">No activities logged for this period.</td></tr>`;
        return;
    }
    const sortedEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)); // Descending
    sortedEntries.forEach(entry => {
        const totalHours = calculateHours(entry.startTime, entry.endTime);
        const row = document.createElement('tr');
        row.className = 'hover:bg-surface-hover transition-colors group';

        let notesDisplay = entry.notes || '';
        if (entry.unrestrictedActivityType) {
            notesDisplay = `[${entry.unrestrictedActivityType}] ${entry.unrestrictedExplanation || notesDisplay}`;
        }

        const typeBadgeClass = entry.activityType === 'Unrestricted' ? 'badge-purple' : 'badge-danger';

        row.innerHTML = `
            <td class="px-4 py-3 font-medium text-text">${dayjs(entry.date).format('MMM D, YYYY')}</td>
            <td class="px-4 py-3 text-text-muted text-xs">${dayjs('1970-01-01T' + entry.startTime).format('h:mm A')} - ${dayjs('1970-01-01T' + entry.endTime).format('h:mm A')}</td>
            <td class="px-4 py-3 font-bold text-text">${totalHours.toFixed(2)}</td>
            <td class="px-4 py-3 text-text-muted">${entry.clientName || '-'}</td>
            <td class="px-4 py-3"><span class="badge ${typeBadgeClass}">${entry.activityType}</span></td>
            <td class="px-4 py-3 text-text-muted text-xs max-w-[150px] truncate" title="${entry.supervisionType}">${entry.supervisionType}</td>
            <td class="px-4 py-3 text-text-muted">${entry.supervisorName || '-'}</td>
            <td class="px-4 py-3 text-text-muted text-xs hidden md:table-cell max-w-xs truncate" title="${notesDisplay}">${notesDisplay}</td>
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
        unrestrictedExplanation: document.getElementById('unrestricted-explanation').value,
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
    if (!entryId || !confirm("Delete this entry permanently?")) return;

    if (userId === 'guest') {
        allEntries = allEntries.filter(e => e.id !== entryId);
        saveEntriesToLocalStorage();
        switchView(document.querySelector('.view-btn.bg-white\\/10').dataset.view);
    } else {
        try {
            await deleteDoc(doc(db, `users/${userId}/entries`, entryId));
        } catch (error) { console.error("Error deleting doc:", error); }
    }
    closeSlideOver();
};

const handleTableClick = (e) => {
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

const handleGuestLogin = () => {
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

        // 2. Show App
        console.log("App.js: Showing app container");
        appContainer.classList.remove('hidden');

        // 3. Update UI
        userDisplay.textContent = 'Guest User';

        // 4. Load Data
        console.log("App.js: Loading local storage data");
        loadDataFromLocalStorage();

        // 5. Switch View
        console.log("App.js: Switching to monthly view");
        switchView('monthly');

        console.log("App.js: Guest login complete");
    } catch (e) {
        console.error("App.js: Guest login failed:", e);
        alert("Login Error: " + e.message);
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
        // Combine session notes with unrestricted explanation if applicable
        let notesColumn = e.notes || '';
        if (e.unrestrictedActivityType && e.unrestrictedExplanation) {
            notesColumn = `[${e.unrestrictedActivityType}] ${e.unrestrictedExplanation}`;
        } else if (e.unrestrictedExplanation) {
            notesColumn = e.unrestrictedExplanation;
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

        // Combine session notes with unrestricted explanation if applicable
        let notesColumn = entry.notes || '';
        if (entry.unrestrictedActivityType && entry.unrestrictedExplanation) {
            notesColumn = `[${entry.unrestrictedActivityType}] ${entry.unrestrictedExplanation}`;
        } else if (entry.unrestrictedExplanation) {
            notesColumn = entry.unrestrictedExplanation;
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
    const profileRef = doc(db, `users/${userId}`);
    const user = auth.currentUser;

    try {
        // Create professional user profile
        const profileData = {
            // Core Identity
            role: role,
            email: user.email,
            name: user.displayName || 'New User',
            photoURL: user.photoURL || null,

            // Business Logic (Free vs VIP)
            planType: 'free',       // Default to Free entry level
            isVip: false,           // Boolean for easy checks
            status: 'active',       // active, suspended, pending

            // Timestamps
            registeredAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),

            // Metadata
            version: '1.0'
        };

        await setDoc(profileRef, profileData, { merge: true });

        if (roleSelectionView) roleSelectionView.classList.add('hidden');
        if (appContainer) appContainer.classList.remove('hidden');
    } catch (error) {
        console.error("Error saving role and profile:", error);
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
        allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[DEBUG] Loaded ${allEntries.length} entries. First entry:`, allEntries[0]);
        const activeView = document.querySelector('.view-btn.bg-white\\/10')?.dataset.view || 'monthly';
        if (activeView !== 'supervisor-dashboard') switchView(activeView);
    });
};

// --- Supervisor Dashboard Logic ---
let myTrainees = [];
let selectedTraineeId = null;

const updateSupervisorDashboard = async () => {
    const traineesList = document.getElementById('trainees-list');
    if (!userId || profileData.role !== 'supervisor' || !traineesList) return;

    const userEmail = auth.currentUser.email;
    traineesList.innerHTML = '<div class="p-4 text-center text-text-muted"><i class="ph ph-circle-notch animate-spin"></i> Loading...</div>';

    try {
        const q = query(collection(db, 'users'), where('supervisorEmails', 'array-contains', userEmail));
        const querySnapshot = await getDocs(q);

        myTrainees = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            // In the new schema, the document itself is the user profile, so ID is doc.id
            return { id: docSnap.id, ...data };
        });

        renderTraineesList();
    } catch (error) {
        console.error("Error updating supervisor dashboard:", error);
        traineesList.innerHTML = '<div class="p-4 text-center text-red-400">Error loading trainees.</div>';
    }
};

const renderTraineesList = () => {
    const traineesList = document.getElementById('trainees-list');
    if (!traineesList) return;

    if (myTrainees.length === 0) {
        traineesList.innerHTML = `
            <div class="p-4 rounded-xl bg-white/5 border border-white/5 text-center py-10">
                <i class="ph ph-users text-3xl text-text-muted mb-2"></i>
                <p class="text-sm text-text-muted">No trainees linked yet.</p>
            </div>`;
        return;
    }

    traineesList.innerHTML = myTrainees.map(trainee => `
        <button class="trainee-item w-full p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-primary/5 transition-all text-left flex items-center gap-3 group" data-id="${trainee.id}">
            <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <i class="ph-fill ph-user"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-white truncate">${trainee.name || 'Unknown Trainee'}</p>
                <p class="text-xs text-text-muted truncate">${trainee.email}</p>
            </div>
            <i class="ph ph-caret-right text-text-muted"></i>
        </button>
    `).join('');

    document.querySelectorAll('.trainee-item').forEach(btn => {
        btn.addEventListener('click', () => selectTrainee(btn.dataset.id));
    });
};

const selectTrainee = async (traineeId) => {
    const traineeReviewPlaceholder = document.getElementById('trainee-review-placeholder');
    const traineeReviewContent = document.getElementById('trainee-review-content');
    const reviewTraineeName = document.getElementById('review-trainee-name');
    const reviewTraineeEmail = document.getElementById('review-trainee-email');

    selectedTraineeId = traineeId;
    const trainee = myTrainees.find(t => t.id === traineeId);
    if (!trainee) return;

    if (traineeReviewPlaceholder) traineeReviewPlaceholder.classList.add('hidden');
    if (traineeReviewContent) traineeReviewContent.classList.remove('hidden');
    if (reviewTraineeName) reviewTraineeName.textContent = trainee.name || 'Unknown Trainee';
    if (reviewTraineeEmail) reviewTraineeEmail.textContent = trainee.email;

    const entriesRef = collection(db, `users/${traineeId}/entries`);
    const snapshot = await getDocs(entriesRef);
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderTraineeReview(entries);
};

const renderTraineeReview = async (entries) => {
    const reviewMonthSelector = document.getElementById('review-month-selector');
    const reviewStatsGrid = document.getElementById('review-stats-grid');
    const reviewTableBody = document.getElementById('review-table-body');
    const signMonthBtn = document.getElementById('sign-month-btn');

    if (!reviewMonthSelector) return;

    const months = [...new Set(entries.map(e => dayjs(e.date).format('YYYY-MM')))].sort().reverse();
    reviewMonthSelector.innerHTML = months.map(m => `<option value="${m}">${dayjs(m).format('MMMM YYYY')}</option>`).join('');

    const updateReviewTable = async () => {
        const selectedMonth = reviewMonthSelector.value;
        if (!selectedMonth) return;

        const [year, month] = selectedMonth.split('-');
        const filtered = entries.filter(e => {
            const d = dayjs(e.date);
            return d.year() == year && (d.month() + 1) == month;
        });

        const verificationRef = doc(db, `users/${selectedTraineeId}/verifications/${selectedMonth}`);
        const verifSnap = await getDoc(verificationRef);
        const isSigned = verifSnap.exists() && verifSnap.data().status === 'signed';

        if (signMonthBtn) {
            if (isSigned) {
                signMonthBtn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Digitally Signed';
                signMonthBtn.classList.add('bg-green-500');
                signMonthBtn.classList.remove('bg-primary');
                signMonthBtn.disabled = true;
            } else {
                signMonthBtn.innerHTML = '<i class="ph-fill ph-pencil-line"></i> Digitally Sign Month';
                signMonthBtn.classList.add('bg-primary');
                signMonthBtn.classList.remove('bg-green-500');
                signMonthBtn.disabled = false;
            }
        }

        const data = calculateSummaryData(filtered);
        if (reviewStatsGrid) {
            reviewStatsGrid.innerHTML = `
                ${createStatCard('Total', data.total.toFixed(2), null, 'ph ph-clock', 'bg-blue-500 text-blue-400')}
                ${createStatCard('Restricted', data.restricted.toFixed(2), null, 'ph ph-hand-heart', 'bg-pink-500 text-pink-400')}
                ${createStatCard('Unrestricted', data.unrestricted.toFixed(2), null, 'ph ph-brain', 'bg-purple-500 text-purple-400')}
                ${createStatCard('Supervised', data.supervised.toFixed(2), `${data.percentage.toFixed(1)}%`, 'ph ph-users-three', 'bg-teal-500 text-teal-400')}
            `;
        }

        if (reviewTableBody) {
            reviewTableBody.innerHTML = filtered.map(entry => `
                <tr>
                    <td class="px-4 py-3 text-white">${dayjs(entry.date).format('MMM D')}</td>
                    <td class="px-4 py-3 text-text-muted text-xs">${entry.startTime} - ${entry.endTime}</td>
                    <td class="px-4 py-3 text-white font-medium">${calculateHours(entry.startTime, entry.endTime).toFixed(2)}</td>
                    <td class="px-4 py-3 text-text-muted">${entry.clientName || '-'}</td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${entry.activityType === 'Restricted' ? 'bg-pink-500/10 text-pink-400' : 'bg-purple-500/10 text-purple-400'}">
                            ${entry.activityType}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-xs ${entry.supervisionType === 'No Supervision' ? 'text-text-muted' : 'text-teal-400 font-medium'}">
                        ${entry.supervisionType}
                    </td>
                    <td class="px-4 py-3 text-text-muted text-xs">${entry.supervisorName || '-'}</td>
                </tr>
            `).join('');
        }
    };

    reviewMonthSelector.onchange = updateReviewTable;
    updateReviewTable();
};

const setupSupervisorListeners = () => {
    updateSupervisorDashboard();

    const addTraineeBtn = document.getElementById('add-trainee-btn');
    const signMonthBtn = document.getElementById('sign-month-btn');

    if (addTraineeBtn) {
        addTraineeBtn.addEventListener('click', () => {
            alert("Trainees must add your email in their Settings > Profile to link with you.");
            updateSupervisorDashboard();
        });
    }

    if (signMonthBtn) {
        signMonthBtn.addEventListener('click', async () => {
            const reviewMonthSelector = document.getElementById('review-month-selector');
            if (!selectedTraineeId || !reviewMonthSelector || !reviewMonthSelector.value) return;

            const month = reviewMonthSelector.value;
            const supervisorId = userId;
            const supervisorName = profileData.name;

            const verificationRef = doc(db, `users/${selectedTraineeId}/verifications/${month}`);
            try {
                await setDoc(verificationRef, {
                    status: 'signed',
                    signedAt: new Date().toISOString(),
                    supervisorId,
                    supervisorName,
                    month
                }, { merge: true });
                alert("Month digitally signed!");
                selectTrainee(selectedTraineeId);
            } catch (error) {
                console.error("Error signing month:", error);
            }
        });
    }
};

// --- Initialization ---


// --- Initialization ---
// --- Initialization ---
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
    setupTableHeaders();

    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

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

    if (supervisorsList) {
        supervisorsList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-supervisor-btn');
            if (removeBtn) removeSupervisor(removeBtn.dataset.name);
            const editBtn = e.target.closest('.edit-supervisor-btn');
            if (editBtn) handleEditSupervisor(editBtn.dataset.name);
        });
    }

    // Exports & PDF
    if (generateMfvfBtn) generateMfvfBtn.addEventListener('click', () => {
        if (profileData.supervisors && profileData.supervisors.length > 0) {
            mfvfModal.classList.remove('hidden');
        } else {
            alert("Please add at least one supervisor in Settings first.");
            openSettingsPanel();
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

    if (exportYearlyPdfBtn) exportYearlyPdfBtn.addEventListener('click', () => alert("Yearly PDF coming soon!"));
    if (exportYearlyCsvBtn) exportYearlyCsvBtn.addEventListener('click', () => {
        const year = yearSelector.value;
        const yearData = allEntries.filter(e => dayjs(e.date).year() == year);
        exportToCsv(yearData, calculateSummaryData(yearData), `Fieldwork_${year}.csv`);
    });

    if (exportAllTimePdfBtn) exportAllTimePdfBtn.addEventListener('click', () => alert("Career PDF coming soon!"));
    if (exportAllTimeCsvBtn) exportAllTimeCsvBtn.addEventListener('click', () => {
        exportToCsv(allEntries, calculateSummaryData(allEntries), `Fieldwork_AllTime.csv`);
    });

    if (mfvfCancel) mfvfCancel.addEventListener('click', () => mfvfModal.classList.add('hidden'));

    if (mfvfGenerateConfirm) mfvfGenerateConfirm.addEventListener('click', async () => {
        const selectedMonth = monthSelector.value;
        const supName = mfvfSupervisorSelect.value;
        const supervisor = profileData.supervisors.find(s => s.name === supName);

        if (!supervisor) return alert("Please select a supervisor");

        const [year, month] = selectedMonth.split('-');
        const entries = allEntries.filter(e => {
            const d = dayjs(e.date);
            return d.year() == year && (d.month() + 1) == month;
        });

        let isSigned = false;
        if (userId !== 'guest') {
            const verificationRef = doc(db, `users/${userId}/verifications/${selectedMonth}`);
            const verifSnap = await getDoc(verificationRef);
            isSigned = verifSnap.exists() && verifSnap.data().status === 'signed';
        }

        generateMfvfPdf(entries, supervisor, selectedMonth, isSigned);
        mfvfModal.classList.add('hidden');
    });

    if (pdfDownloadBtn) {
        pdfDownloadBtn.addEventListener('click', () => {
            if (currentPdfDoc) currentPdfDoc.save(currentPdfFilename);
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
                    if (!profileData.role) {
                        if (appContainer) appContainer.classList.add('hidden');
                        if (roleSelectionView) roleSelectionView.classList.remove('hidden');
                    } else {
                        if (roleSelectionView) roleSelectionView.classList.add('hidden');
                        if (appContainer) appContainer.classList.remove('hidden');
                        setupUIByRole(profileData.role);
                        if (profileData.role === 'trainee' || profileData.role === 'admin') setupTraineeListeners();
                        else setupSupervisorListeners();
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

        } else if (userId !== 'guest') {
            if (appContainer) appContainer.classList.add('hidden');
            if (roleSelectionView) roleSelectionView.classList.add('hidden');
            if (loginView) loginView.classList.remove('hidden');
        }
    });

    console.log("App.js: Initialization complete");
}

// Start the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
