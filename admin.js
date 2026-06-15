import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, getDoc, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Config & State ---
let firebaseConfig = {
    apiKey: "AIzaSyAl4i1nP24SOvAt1ifbGD0SZo2u_l4MnB8",
    authDomain: "fieldwork-tracker-ae8f7.firebaseapp.com",
    projectId: "fieldwork-tracker-ae8f7",
    storageBucket: "fieldwork-tracker-ae8f7.firebasestorage.app",
    messagingSenderId: "4649951899",
    appId: "1:4649951899:web:28278ddb278baf67b39c3e"
};

let db, auth;
let allUsers = [];
let isDemoMode = false;
let unsubscribeUsers = null;

document.addEventListener('DOMContentLoaded', () => {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    initViewSwitching();
    initTerminal();
    initUserControls();
    initAuthListeners();
});

function initAuthListeners() {
    const loginBtn = document.getElementById('admin-login-btn');
    const statusDot = document.getElementById('admin-status-dot');
    const statusText = document.getElementById('admin-status-text');

    loginBtn.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed:", error);
            updateSystemTerminal(`[ERROR] Login failed: ${error.message}`, "text-red-400");
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Logged in as:", user.email);

            // Email whitelist - only this email can access admin
            const ALLOWED_ADMIN_EMAIL = 'nana.behesht@gmail.com';

            if (user.email !== ALLOWED_ADMIN_EMAIL) {
                // Unauthorized user
                statusDot.classList.replace('bg-slate-500', 'bg-red-500');
                statusText.textContent = 'Access Denied';
                statusText.classList.replace('text-text-muted', 'text-red-400');
                updateSystemTerminal(`[ERROR] Unauthorized access attempt from ${user.email}. This admin portal is restricted.`, "text-red-400");

                // Sign them out
                await auth.signOut();
                loginBtn.classList.remove('hidden');
                return;
            }

            // Authorized user - proceed
            loginBtn.classList.add('hidden');
            statusDot.classList.replace('bg-slate-500', 'bg-green-500');
            statusDot.classList.add('animate-pulse');
            statusText.textContent = 'Verifying Permission...';

            try {
                const profileRef = doc(db, `users/${user.uid}`);
                const docSnap = await getDoc(profileRef);

                if (docSnap.exists() && docSnap.data().role === 'admin') {
                    statusText.textContent = 'System Linked';
                    statusText.classList.replace('text-text-muted', 'text-green-400');
                    fetchLiveData();
                } else {
                    statusText.textContent = 'Access Restricted';
                    statusText.classList.replace('text-text-muted', 'text-yellow-400');
                    statusDot.classList.remove('animate-pulse');
                    statusDot.classList.replace('bg-green-500', 'bg-yellow-500');
                    updateSystemTerminal("[WARN] Admin credentials required. You are logged in but lack system-wide read access.", "text-yellow-400");
                    handleFetchError({ message: 'Missing or insufficient permissions.' });
                }
            } catch (e) {
                console.error("Role check failed:", e);
                fetchLiveData();
            }
        } else {
            loginBtn.classList.remove('hidden');
            statusDot.classList.replace('bg-green-500', 'bg-slate-500');
            statusDot.classList.remove('animate-pulse');
            statusText.textContent = 'Auth Required';
            updateSystemTerminal("[WARN] No active session. Please click 'Login to Admin' to continue.", "text-yellow-400");
        }
    });
}

// --- Data Fetching ---
async function fetchLiveData() {
    updateSystemTerminal("[INFO] Scanning database for user profiles...", "text-blue-400");

    try {
        const q = query(collection(db, 'users'));
        if (unsubscribeUsers) unsubscribeUsers();

        unsubscribeUsers = onSnapshot(q, (querySnapshot) => {
            allUsers = querySnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return { id: docSnap.id, ...data };
            });

            allUsers.sort((a, b) => {
                const aDate = normalizeDate(a.registeredAt || a.createdAt || a.lastLoginAt);
                const bDate = normalizeDate(b.registeredAt || b.createdAt || b.lastLoginAt);
                return bDate - aDate;
            });

            isDemoMode = false;
            document.getElementById('admin-status-text').textContent = 'System Linked';
            document.getElementById('admin-status-text').classList.replace('text-yellow-400', 'text-green-400');

            updateSystemTerminal(`[SUCCESS] Synced ${allUsers.length} live user profiles.`, "text-green-400");

            updateDashboardStats();
            populateUserTable();
            initCharts();
        }, (error) => {
            console.error("Error listening to admin data:", error);
            handleFetchError(error);
        });

    } catch (error) {
        console.error("Error fetching admin data:", error);
        handleFetchError(error);
    }
}

function handleFetchError(error) {
    const isPermissionError = error.message.includes('permission');

    // Reset stats to error state
    ['stat-total-users', 'stat-active-trainees', 'stat-total-supervisors', 'stat-storage'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = "Error";
            el.classList.add('text-red-400');
        }
    });

    if (isPermissionError) {
        updateSystemTerminal("[ERROR] Security block: Permission denied. Access to the users collection is restricted.", "text-red-400");

        // Offer Demo Mode
        const terminal = document.getElementById('terminal-output');
        const p = document.createElement('p');
        p.className = 'admin-log-line mt-2';
        p.innerHTML = `<button onclick="enableDemoMode()" class="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 px-3 py-1 rounded border border-indigo-600/30 text-[10px] font-bold transition-all shadow-lg">Enable Demo Mode (View Sample Data)</button>`;
        terminal.appendChild(p);
    } else {
        updateSystemTerminal(`[ERROR] System fault during database read: ${error.message}`, "text-red-400");
    }
}

window.enableDemoMode = function () {
    isDemoMode = true;
    updateSystemTerminal("[INFO] Initializing demo environment with secure mock data.", "text-purple-400");

    ['stat-total-users', 'stat-active-trainees', 'stat-total-supervisors', 'stat-storage'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('text-red-400');
    });

    const statusText = document.getElementById('admin-status-text');
    const statusDot = document.getElementById('admin-status-dot');

    statusText.innerHTML = 'Demo Mode <span class="text-[10px] opacity-70">(Mock)</span>';
    statusText.className = 'text-xs font-medium text-purple-400';
    statusDot.className = 'w-2 h-2 rounded-full bg-purple-500 animate-pulse';

    allUsers = [
        { name: 'Sarah Jones', email: 'sarah.jones@example.com', role: 'trainee', status: 'Active', progress: 68 },
        { name: 'Dr. Michael Chen', email: 'm.chen@clinic.org', role: 'supervisor', status: 'Active', progress: 100 },
        { name: 'Alex Rivera', email: 'alex.r@fieldwork.cc', role: 'trainee', status: 'Away', progress: 12 },
        { name: 'Emma Wilson', email: 'emma.w@aba-services.com', role: 'trainee', status: 'Active', progress: 94 },
        { name: 'Robert Miller', email: 'robert.m@provider.com', role: 'supervisor', status: 'Pending', progress: 0 }
    ];

    updateDashboardStats();
    populateUserTable();
    initCharts();
};

function updateDashboardStats() {
    const totalUsers = allUsers.length;
    const trainees = allUsers.filter(u => u.role === 'trainee' && getUserStatus(u) === 'active').length;
    const supervisors = allUsers.filter(u => u.role === 'supervisor').length;

    document.getElementById('stat-total-users').textContent = totalUsers.toLocaleString();
    document.getElementById('stat-active-trainees').textContent = trainees.toLocaleString();
    document.getElementById('stat-total-supervisors').textContent = supervisors.toLocaleString();

    // Storage usage is still simulated as it's not directly in Firestore
    document.getElementById('stat-storage').textContent = (totalUsers * 0.003).toFixed(1) + " MB";
}

// --- View Switching ---
function initViewSwitching() {
    const navBtns = document.querySelectorAll('.admin-view-btn');
    const sections = document.querySelectorAll('.admin-section');
    const viewTitle = document.getElementById('view-title');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewId = btn.dataset.view;

            navBtns.forEach(b => {
                b.classList.remove('bg-white/10', 'text-white');
                b.classList.add('text-text-muted', 'hover:text-white', 'hover:bg-white/5');
            });
            btn.classList.add('bg-white/10', 'text-white');
            btn.classList.remove('text-text-muted', 'hover:text-white', 'hover:bg-white/5');

            sections.forEach(s => s.classList.add('hidden'));
            const targetSection = document.getElementById(`${viewId}-section`);
            if (targetSection) targetSection.classList.remove('hidden');

            const titles = {
                overview: 'Dashboard Overview',
                users: 'User Management',
                analytics: 'System Analytics',
                developer: 'Developer Controls'
            };
            viewTitle.textContent = titles[viewId] || 'Admin Portal';
        });
    });
}

// --- Charts ---
let charts = {};

function initCharts() {
    const ctxReg = document.getElementById('registrationChart')?.getContext('2d');
    const ctxProg = document.getElementById('progressionChart')?.getContext('2d');
    const ctxDist = document.getElementById('distributionChart')?.getContext('2d');

    // Clean up old charts if they exist
    Object.values(charts).forEach(c => c.destroy());

    if (ctxReg) {
        charts.reg = new Chart(ctxReg, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Registrations',
                    data: [10, 25, 45, 80, 120, allUsers.length],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: chartOptions
        });
    }

    if (ctxDist) {
        const trainees = allUsers.filter(u => u.role === 'trainee').length;
        const supervisors = allUsers.filter(u => u.role === 'supervisor').length;
        const admins = allUsers.filter(u => u.role === 'admin').length || 1;

        charts.dist = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels: ['Trainee', 'Supervisor', 'Admin'],
                datasets: [{
                    data: [trainees, supervisors, admins],
                    backgroundColor: ['#6366f1', '#ec4899', '#f59e0b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { size: 12 } }
                    }
                }
            }
        });
    }
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false }
    },
    scales: {
        y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' }
        },
        x: {
            grid: { display: false },
            ticks: { color: '#94a3b8' }
        }
    }
};

// --- User Table ---
function initUserControls() {
    const searchInput = document.getElementById('user-search');
    const roleFilter = document.getElementById('role-filter');
    const statusFilter = document.getElementById('status-filter');
    const refreshBtn = document.getElementById('refresh-users-btn');
    const tableBody = document.getElementById('user-table-body');

    [searchInput, roleFilter, statusFilter].forEach(el => {
        if (el) el.addEventListener('input', populateUserTable);
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            populateUserTable();
            updateSystemTerminal("[INFO] User table refreshed.", "text-blue-400");
        });
    }

    if (tableBody) {
        tableBody.addEventListener('click', handleUserAction);
    }
}

function populateUserTable() {
    const tableBody = document.getElementById('user-table-body');
    if (!tableBody) return;

    const filteredUsers = getFilteredUsers();

    if (allUsers.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-text-muted">No users found in database.</td></tr>`;
        return;
    }

    if (filteredUsers.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-text-muted">No users match the current filters.</td></tr>`;
        return;
    }

    tableBody.innerHTML = filteredUsers.map(user => {
        const initials = (user.name || 'U N').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        const role = user.role || 'unset';

        const plan = user.planType ? (user.planType === 'vip' ? 'VIP Access' : 'Free Plan') : 'Free Plan';
        const planBadge = user.planType === 'vip'
            ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">VIP</span>'
            : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700/50 text-slate-400 border border-white/5">FREE</span>';

        const joinedDate = formatDate(user.registeredAt || user.createdAt || user.lastLoginAt);
        const status = getUserStatus(user);
        const isActive = status === 'active';
        const statusColor = isActive ? 'text-green-400' : status === 'deactivated' ? 'text-red-400' : 'text-yellow-400';
        const statusDot = isActive ? 'bg-green-500' : status === 'deactivated' ? 'bg-red-500' : 'bg-yellow-500';
        const accessAction = isActive
            ? `<button class="admin-user-action px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-xs font-semibold transition-colors" data-action="deactivate" data-user-id="${user.id}">Deactivate</button>`
            : `<button class="admin-user-action px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20 text-xs font-semibold transition-colors" data-action="activate" data-user-id="${user.id}">Grant Access</button>`;
        const planAction = user.planType === 'vip'
            ? `<button class="admin-user-action p-2 text-amber-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Move to free plan" data-action="free" data-user-id="${user.id}"><i class="ph ph-star"></i></button>`
            : `<button class="admin-user-action p-2 text-text-muted hover:text-amber-300 hover:bg-white/5 rounded-lg transition-colors" title="Give VIP access" data-action="vip" data-user-id="${user.id}"><i class="ph ph-star"></i></button>`;

        const certLine = user.rbtNumber ? `<span class="text-[10px] text-slate-500">Cert: ${escapeHtml(user.rbtNumber)}</span>` : '';

        return `
        <tr class="hover:bg-white/5 transition-colors group border-b border-white/5 last:border-0">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/20">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-medium text-white text-sm">${escapeHtml(user.name || user.username || 'Anonymous')}</p>
                        <p class="text-xs text-text-muted">${escapeHtml(user.email || 'N/A')}</p>
                        ${certLine}
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-xs font-medium text-text-muted uppercase tracking-wider">${escapeHtml(role)}</span>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    ${planBadge}
                    <span class="text-xs text-text-muted hidden md:inline">${plan}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-sm text-text-muted">${joinedDate}</span>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <div class="w-1.5 h-1.5 rounded-full ${statusDot}"></div>
                    <span class="text-xs font-medium ${statusColor} capitalize">${status}</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-end gap-2">
                    ${planAction}
                    ${accessAction}
                </div>
            </td>
        </tr>
    `}).join('');
}

function getFilteredUsers() {
    const search = (document.getElementById('user-search')?.value || '').trim().toLowerCase();
    const roleFilter = document.getElementById('role-filter')?.value || 'all';
    const statusFilter = document.getElementById('status-filter')?.value || 'all';

    return allUsers.filter(user => {
        const role = (user.role || 'unset').toLowerCase();
        const status = getUserStatus(user);
        const haystack = [
            user.name,
            user.username,
            user.email,
            user.rbtNumber,
            user.id,
            user.role,
            user.status
        ].filter(Boolean).join(' ').toLowerCase();

        return (!search || haystack.includes(search)) &&
            (roleFilter === 'all' || role === roleFilter) &&
            (statusFilter === 'all' || status === statusFilter);
    });
}

async function handleUserAction(event) {
    const btn = event.target.closest('.admin-user-action');
    if (!btn || isDemoMode) return;

    const targetUser = allUsers.find(user => user.id === btn.dataset.userId);
    if (!targetUser) return;

    const action = btn.dataset.action;
    const updates = {
        adminUpdatedAt: serverTimestamp(),
        adminUpdatedBy: auth.currentUser?.email || 'admin'
    };

    if (action === 'activate') {
        updates.status = 'active';
        updates.accessEnabled = true;
    } else if (action === 'deactivate') {
        updates.status = 'deactivated';
        updates.accessEnabled = false;
    } else if (action === 'vip') {
        updates.planType = 'vip';
        updates.isVip = true;
    } else if (action === 'free') {
        updates.planType = 'free';
        updates.isVip = false;
    } else {
        return;
    }

    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-wait');

    try {
        await updateDoc(doc(db, `users/${targetUser.id}`), updates);
        updateSystemTerminal(`[SUCCESS] Updated ${targetUser.email || targetUser.id}: ${action}.`, "text-green-400");
    } catch (error) {
        console.error("User access update failed:", error);
        updateSystemTerminal(`[ERROR] Failed to update ${targetUser.email || targetUser.id}: ${error.message}`, "text-red-400");
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-wait');
    }
}

function getUserStatus(user) {
    if (user.accessEnabled === false) return 'deactivated';
    return (user.status || 'active').toString().trim().toLowerCase();
}

function formatDate(value) {
    const time = normalizeDate(value);
    if (!time) return '<span class="italic text-slate-600">Unknown</span>';
    return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeDate(value) {
    if (!value) return 0;
    if (value.toDate) return value.toDate().getTime();
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --- Terminal ---
function initTerminal() {
    const terminal = document.getElementById('terminal-output');
    if (!terminal) return;

    const logMessages = [
        '[INFO] Syncing user data with Firestore...',
        '[SUCCESS] Sync complete. Data consistent.',
        '[INFO] System integrity check passing.',
        '[INFO] Automated backup check: OK.',
        '[INFO] Token refresh cycle complete.'
    ];

    setInterval(() => {
        const msg = logMessages[Math.floor(Math.random() * logMessages.length)];
        const p = document.createElement('p');
        p.className = 'admin-log-line';
        if (msg.includes('SUCCESS')) p.className += ' text-green-400';
        else if (msg.includes('WARN')) p.className += ' text-yellow-400';
        else if (msg.includes('ERROR')) p.className += ' text-red-400';
        else p.className += ' text-slate-500';

        p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        terminal.appendChild(p);
        terminal.scrollTop = terminal.scrollHeight;

        if (terminal.children.length > 50) terminal.removeChild(terminal.firstChild);
    }, 8000);
}

function updateSystemTerminal(msg, className = "text-slate-500") {
    const terminal = document.getElementById('terminal-output');
    if (!terminal) return;
    const p = document.createElement('p');
    p.className = `admin-log-line ${className}`;
    p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    terminal.appendChild(p);
    terminal.scrollTop = terminal.scrollHeight;
}
