const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbw8JrweFOEtM01HA1pwbn-Wmj9HoFZfqchJN5fiKGNsJ69YHYJzqG3_hj2EAf6cCO4D/exec'
};

class AppManager {
    constructor() {
        this.currentSection = 'content-planner';
        this.currentView = 'list';
        this.currentDate = new Date();
        this.data = { tasks: [], prestasi: [], media: [], dropdowns: { assignedTo: [], format: [] } };
        this.filteredData = { tasks: [], prestasi: [], media: [] };
        this.userName = sessionStorage.getItem('himagro_user') || null;
        this.init();
    }

    async init() {
        if (!this.userName) {
            this.showLoginModal();
            return;
        }
        this.proceedWithInit();
    }

    async proceedWithInit() {
        const hasSeenGuide = localStorage.getItem('himagro_seen_guide');
        if (!hasSeenGuide) {
            setTimeout(() => window.openGuide(), 1500);
            localStorage.setItem('himagro_seen_guide', 'true');
        }

        this.setupEventListeners();
        await this.loadAllData(true);
        this.switchSection('content-planner', document.querySelector('.nav-item.active'));

        // Auto-sync background setiap 20 detik (Sangat Realtime)
        setInterval(() => {
            this.loadAllData(false, true);
        }, 20 * 1000);
    }

    showLoginModal() {
        document.getElementById('loginModal').style.display = 'flex';
        this.hideLoading();
    }

    handleLogin() {
        const nameInput = document.getElementById('loginUserName');
        const name = nameInput.value.trim();
        if (name) {
            this.userName = name;
            sessionStorage.setItem('himagro_user', this.userName);
            document.getElementById('loginModal').style.display = 'none';
            this.showLoading();
            this.proceedWithInit();
        }
    }

    setupEventListeners() {
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => this.handleTaskSubmit(e));
        }

        const menuToggle = document.getElementById('menuToggle');
        const navContainer = document.getElementById('navContainer');
        if (menuToggle && navContainer) {
            menuToggle.addEventListener('click', () => {
                navContainer.classList.toggle('active');
                const icon = menuToggle.querySelector('i');
                if (icon) {
                    icon.className = navContainer.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
                }
            });
        }

        // PWA Install Logic
        const installBtn = document.getElementById('installBtn');
        let deferredPrompt;

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

        if (isIOS && !isStandalone) {
            if (installBtn) {
                installBtn.style.display = 'flex';
                installBtn.addEventListener('click', () => {
                    this.showToast('Safari iPhone: Klik Share > Add to Home Screen', 'info');
                });
            }
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) {
                installBtn.style.display = 'flex';
                installBtn.onclick = async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') installBtn.style.display = 'none';
                        deferredPrompt = null;
                    }
                };
            }
        });

        window.addEventListener('appinstalled', () => {
            if (installBtn) installBtn.style.display = 'none';
            deferredPrompt = null;
        });
    }

    async loadAllData(isInitial = false, isSilent = false) {
        if (!isSilent) {
            this.showLoading(isInitial ? 'Sedang Menyiapkan System...' : 'Merefresh Data...', isInitial);
        }

        try {
            const result = await this.callAPI('getAllData');
            if (result.success) {
                // --- VERSION CHECK: Deteksi Update Fitur/UI ---
                const APP_VERSION = '1.2.0';
                if (result.version && result.version !== APP_VERSION) {
                    this.showToast('🚀 Versi Baru Tersedia! Klik untuk Update Fitur.', 'info', () => {
                        location.reload(true);
                    });
                }

                // --- DATA SYNC: Deteksi Perubahan Isi Spreadsheet (Task & Dropdown) ---
                const oldHash = JSON.stringify({ t: this.data.tasks, d: this.data.dropdowns });
                const newHash = JSON.stringify({ t: result.tasks, d: result.dropdowns });

                if (oldHash !== newHash || isInitial) {
                    this.data = result;
                    this.populateDropdowns();
                    this.applyFilters();

                    if (!isInitial) {
                        this.showToast(isSilent ? '🔔 Ada update data baru!' : 'Data diperbarui', 'success');
                    }
                }
            } else {
                throw new Error(result.error || 'Server error');
            }
        } catch (error) {
            if (!isSilent) {
                console.error('Data load failed:', error);
                this.showToast('Gagal memuat data!', 'error');
            }
        } finally {
            if (!isSilent) this.hideLoading();
        }
    }

    async callAPI(action, params = {}) {
        const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const url = `${CONFIG.API_URL}?action=${action}${query ? '&' + query : ''}&_cache=${Date.now()}`;

        return new Promise((resolve, reject) => {
            const callbackName = 'jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Koneksi timeout (30s)'));
            }, 30000);

            const cleanup = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                const script = document.getElementById(callbackName);
                if (script) script.remove();
            };

            window[callbackName] = (data) => {
                cleanup();
                resolve(data);
            };

            const script = document.createElement('script');
            script.id = callbackName;
            script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName;
            script.onerror = () => {
                cleanup();
                // Fallback attempt for non-JSONP if it's a mutation
                if (action !== 'getAllData') {
                    fetch(url, { mode: 'no-cors' }).then(() => resolve({ success: true, fallback: true }));
                } else {
                    reject(new Error('Gagal memuat script API'));
                }
            };
            document.body.appendChild(script);
        });
    }

    populateDropdowns() {
        const { assignedTo, format } = this.data.dropdowns;
        if (!assignedTo || !format) return;

        const setOptions = (id, options, defaultText) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<option value="">${defaultText}</option>` + options.map(o => `<option value="${o}">${o}</option>`).join('');
        };

        setOptions('filterAssignee', assignedTo, 'Assigned To');
        setOptions('filterFormat', format, 'Format');

        document.querySelectorAll('select[name="assignedTo"]').forEach(s => {
            s.innerHTML = assignedTo.map(o => `<option value="${o}">${o}</option>`).join('');
        });
        document.querySelectorAll('select[name="format"]').forEach(s => {
            s.innerHTML = format.map(o => `<option value="${o}">${o}</option>`).join('');
        });
    }

    async logActivity(action, targetId, details) {
        try {
            const logData = { user: this.userName, action, targetId, details };
            await fetch(`${CONFIG.API_URL}?action=logActivity&data=${encodeURIComponent(JSON.stringify(logData))}`, { mode: 'no-cors' });
        } catch (e) { }
    }

    async clearCache() {
        localStorage.clear();
        this.showToast('Cache & Session dihapus', 'success');
        setTimeout(() => location.reload(), 500);
    }

    logout() {
        this.showConfirmNotification('Logout dari sistem?', () => {
            sessionStorage.removeItem('himagro_user');
            location.reload();
        }, 'Ya, Logout', 'Batal');
    }

    async switchSection(sectionId, element) {
        if (!element) return;
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');
        this.currentSection = sectionId;

        const titles = {
            'content-planner': ['Content Planner', 'Modul pusat pengaturan konten.'],
            'prestasi': ['Prestasi Mahasiswa', 'Arsip pencapaian mahasiswa.'],
            'media-partner': ['Media Partner', 'Manajemen kolaborasi eksternal.']
        };

        const [t, s] = titles[sectionId];
        document.getElementById('pageTitle').textContent = t;
        document.getElementById('pageSubtitle').textContent = s;

        if (sectionId === 'content-planner') this.renderTasks();
        else if (sectionId === 'prestasi') this.renderPrestasi();
        else if (sectionId === 'media-partner') this.renderMediaPartner();

        // Close menu
        document.getElementById('navContainer').classList.remove('active');
        const icon = document.getElementById('menuToggle')?.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
    }

    switchView(view, element) {
        document.querySelectorAll('.view-btn').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        this.currentView = view;
        document.getElementById('monthNavigation').style.display = (view === 'list') ? 'none' : 'flex';
        this.renderTasks();
    }

    handleSearch() {
        // Redundant with renderTasks unification
        this.renderTasks();
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderTasks();
    }

    applyFilters() {
        if (this.currentSection !== 'content-planner') return;
        this.renderTasks();
        this.updateStats();
    }

    renderTasks() {
        const cont = document.getElementById('contentPlannerList');
        if (!cont) return;
        cont.className = this.currentView === 'calendar' ? '' : 'data-grid';
        cont.innerHTML = '';

        document.getElementById('currentMonthDisplay').textContent = this.currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        if (this.currentView === 'calendar') return this.renderCalendar(cont);

        // --- UNIFIED FILTERING ---
        const platform = document.getElementById('filterPlatform')?.value || '';
        const assignee = document.getElementById('filterAssignee')?.value || '';
        const format = document.getElementById('filterFormat')?.value || '';
        const searchTerm = document.getElementById('searchBox')?.value.toLowerCase() || '';

        let tasks = this.data.tasks.filter(t => {
            const matchesFilter = (!platform || t.platform === platform) &&
                (!assignee || t.assignedTo === assignee) &&
                (!format || t.format === format);
            const matchesSearch = t.task.toLowerCase().includes(searchTerm) ||
                t.assignedTo.toLowerCase().includes(searchTerm);
            return matchesFilter && matchesSearch;
        });

        if (this.currentView === 'monthly') {
            const y = this.currentDate.getFullYear(), m = this.currentDate.getMonth();
            tasks = tasks.filter(t => {
                const d = new Date(t.dueDate);
                return d.getFullYear() === y && d.getMonth() === m;
            });
        }

        // --- SORT: Closest deadline first ---
        tasks.sort((a, b) => {
            const da = new Date(a.dueDate), db = new Date(b.dueDate);
            if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
            return da - db;
        });

        tasks.forEach(t => cont.appendChild(this.createTaskCard(t)));
    }

    createTaskCard(t) {
        const div = document.createElement('div');
        div.className = 'grid-card';
        div.innerHTML = `
            <div class="grid-card-header">
                <input type="checkbox" class="task-checkbox" data-task-id="${t.no}" onclick="event.stopPropagation(); toggleTaskSelection(${t.no})">
                <h3 style="flex: 1;">${t.task}</h3>
                <select class="status-dropdown" onchange="app.quickUpdateStatus(${t.no}, this.value)" onclick="event.stopPropagation()">
                    <option value="Not Done" ${t.inProgress === 'Not Done' ? 'selected' : ''}>Not Done</option>
                    <option value="On Progress" ${t.inProgress === 'On Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Ready To Upload" ${t.inProgress === 'Ready To Upload' ? 'selected' : ''}>Ready</option>
                    <option value="Done" ${t.inProgress === 'Done' ? 'selected' : ''}>Selesai</option>
                </select>
            </div>
            <div class="grid-info-row"><i class="fas fa-user"></i> ${t.assignedTo}</div>
            <div class="grid-info-row"><i class="fas fa-calendar"></i> ${t.dueDate}</div>
            <div class="grid-info-row"><i class="fas fa-bullseye"></i> ${t.platform} - ${t.format}</div>
            <div style="margin-top:auto; display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn-text btn-edit" onclick="event.stopPropagation(); app.editTask(${t.no})">Edit</button>
                <button class="btn-text btn-delete" onclick="event.stopPropagation(); app.deleteTask(${t.no})">Hapus</button>
            </div>
        `;
        div.onclick = () => this.showTaskDetail(t);
        return div;
    }

    renderCalendar(cont) {
        cont.innerHTML = `<div class="calendar-container"><div class="calendar-grid" id="calGrid"></div></div>`;
        const grid = document.getElementById('calGrid');
        ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].forEach(l => grid.innerHTML += `<div class="calendar-day-label">${l}</div>`);

        const y = this.currentDate.getFullYear(), m = this.currentDate.getMonth();
        const first = new Date(y, m, 1).getDay(), last = new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < first; i++) grid.innerHTML += `<div class="calendar-cell"></div>`;

        const nowStr = new Date().toISOString().split('T')[0];
        for (let d = 1; d <= last; d++) {
            const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const tasks = this.filteredData.tasks.filter(t => t.dueDate === dStr);
            grid.innerHTML += `
                <div class="calendar-cell ${dStr === nowStr ? 'today' : ''}">
                    <div class="calendar-date">${d}</div>
                    ${tasks.map(t => `<div class="calendar-task" onclick="event.stopPropagation(); app.showTaskDetail(${JSON.stringify(t).replace(/"/g, '&quot;')})">${t.task}</div>`).join('')}
                </div>`;
        }
    }

    renderPrestasi() {
        const grid = document.getElementById('prestasiGrid');
        if (!grid) return;
        grid.innerHTML = '';
        const term = document.getElementById('searchBox')?.value.toLowerCase() || '';

        const filtered = this.data.prestasi.filter(item =>
            item.nama.toLowerCase().includes(term) ||
            item.kegiatan.toLowerCase().includes(term)
        );

        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'grid-card';
            div.innerHTML = `<h3>${item.nama}</h3><div class="grid-info-row"><i class="fas fa-id-card"></i> ${item.npm}</div><div class="grid-info-row"><i class="fas fa-trophy"></i> ${item.kegiatan}</div><div class="grid-info-row"><i class="fas fa-clock"></i> ${formatRelativeTime(item.timestamp)}</div>`;
            div.onclick = () => this.showPrestasiDetail(item);
            grid.appendChild(div);
        });
    }

    renderMediaPartner() {
        const grid = document.getElementById('mediaPartnerGrid');
        if (!grid) return;
        grid.innerHTML = '';
        const term = document.getElementById('searchBox')?.value.toLowerCase() || '';

        const filtered = this.data.media.filter(item =>
            item.instansi.toLowerCase().includes(term) ||
            item.kegiatan.toLowerCase().includes(term)
        );

        filtered.forEach(item => {
            const created = item.taskCreated === 'TRUE';
            const div = document.createElement('div');
            div.className = 'grid-card';
            div.innerHTML = `
                <h3>${item.kegiatan} ${created ? '<span class="badge-created">✓</span>' : ''}</h3>
                <div class="grid-info-row"><i class="fas fa-building"></i> ${item.instansi}</div>
                <div style="margin-top:auto; display:flex; gap:8px; padding-top:10px;">
                    <button class="btn btn-primary" style="flex:1; font-size:0.75rem" onclick="event.stopPropagation(); app.automateTask(${JSON.stringify(item).replace(/"/g, '&quot;')})" ${created ? 'disabled' : ''}>
                        ${created ? 'Ditambahkan' : 'Auto Plan'}
                    </button>
                    <a href="https://wa.me/${item.wa?.replace(/\D/g, '')}" target="_blank" class="btn" style="background:#25D366; width:40px;"><i class="fab fa-whatsapp"></i></a>
                </div>`;
            div.onclick = () => this.showMediaDetail(item);
            grid.appendChild(div);
        });
    }

    updateStats() {
        const t = this.data.tasks;
        const sets = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        sets('totalTasks', t.length);
        sets('completedTasks', t.filter(x => x.inProgress === 'Done').length);
        sets('inProgressTasks', t.filter(x => x.inProgress === 'On Progress' || x.inProgress === 'Ready To Upload').length);

        const urgent = t.filter(x => {
            const isNotDone = x.inProgress !== 'Done';
            const days = parseInt(x.dateLeft);
            return isNotDone && !isNaN(days) && days <= 3;
        }).length;
        sets('urgentTasks', urgent);
    }

    async handleTaskSubmit(e) {
        e.preventDefault();
        const form = e.target, id = form.dataset.taskId, data = Object.fromEntries(new FormData(form).entries());
        if (!data.assignedTo || !data.dueDate) return this.showToast('Data belum lengkap!', 'error');

        this.showLoading('Menyimpan...');
        // Optimistic UI
        if (id) {
            const t = this.data.tasks.find(x => x.no == id);
            if (t) Object.assign(t, data);
        }
        this.applyFilters();
        this.closeModal();

        try {
            const res = await this.callAPI(id ? 'updateTask' : 'createTask', { id: id || '', data: JSON.stringify(data) });
            if (res.success) {
                this.showToast('Berhasil disimpan', 'success');
                await this.loadAllData();
            } else throw new Error(res.error);
        } catch (err) {
            this.showToast('Error: ' + err.message, 'error');
            await this.loadAllData();
        } finally { this.hideLoading(); }
    }

    editTask(id) {
        const t = this.data.tasks.find(x => x.no == id);
        if (!t) return;
        const form = document.getElementById('taskForm');
        form.dataset.taskId = id;
        document.getElementById('modalTitle').textContent = 'Edit Task';
        Object.keys(t).forEach(k => { if (form[k]) form[k].value = t[k]; });
        this.openModal();
    }

    async deleteTask(id) {
        this.showConfirmNotification('Hapus task ini?', async () => {
            this.data.tasks = this.data.tasks.filter(x => x.no != id);
            this.applyFilters();
            try {
                await this.callAPI('deleteTask', { id });
                this.showToast('Terhapus', 'success');
                setTimeout(() => this.loadAllData(), 2000);
            } catch (e) { this.showToast('Gagal hapus', 'error'); await this.loadAllData(); }
        });
    }

    async quickUpdateStatus(no, status) {
        const t = this.data.tasks.find(x => x.no == no);
        if (t) { t.inProgress = status; this.updateStats(); }
        try {
            await this.callAPI('updateTask', { id: no, data: JSON.stringify({ inProgress: status }) });
            this.showToast('Status Update', 'success');
        } catch (e) { this.showToast('Gagal update', 'error'); }
    }

    async automateTask(item) {
        const task = { task: `Media Partner (${item.kegiatan})`, platform: 'Instagram', format: 'Feeds', assignedTo: 'Design Creator', dueDate: item.publikasi || '', inProgress: 'Not Done', notes: `Instansi: ${item.instansi}` };
        this.showLoading('Otomatisasi...');
        try {
            const res = await this.callAPI('processMedia', { data: JSON.stringify({ rowIdx: item.rowIdx, taskData: task }) });
            if (res.success) { this.showToast('Auto Plan Berhasil!', 'success'); await this.loadAllData(); }
        } catch (e) { this.showToast('Gagal otomasi', 'error'); }
        finally { this.hideLoading(); }
    }

    showTaskDetail(t) { this.showModalDetail('Detail Task', `<div class="detail-row"><span class="detail-label">Task</span><div class="detail-content">${t.task}</div></div><div class="detail-row"><span class="detail-label">Ref</span><div class="detail-content">${t.reference || '-'}</div></div><div class="detail-row"><span class="detail-label">Notes</span><div class="detail-content">${t.notes || '-'}</div></div>`); }
    showPrestasiDetail(i) { const body = Object.entries(i).map(([k, v]) => `<div class="detail-row"><span class="detail-label">${k}</span><div class="detail-content">${v}</div></div>`).join(''); this.showModalDetail('Detail Prestasi', body); }
    showMediaDetail(i) {
        const body = [`instansi`, 'kegiatan', 'publikasi', 'wa', 'drive'].map(k => `<div class="detail-row"><span class="detail-label">${k}</span><div class="detail-content">${i[k] || '-'}</div></div>`).join('');
        this.showModalDetail('Detail Media Partner', body);
    }
    showModalDetail(title, body) {
        document.getElementById('detailModalTitle').textContent = title;
        document.getElementById('detailModalBody').innerHTML = body;
        document.getElementById('detailModal').style.display = 'flex';
    }

    openModal() { document.getElementById('taskModal').style.display = 'flex'; }
    closeModal() { document.getElementById('taskModal').style.display = 'none'; document.getElementById('taskForm').reset(); delete document.getElementById('taskForm').dataset.taskId; }
    showLoading(msg, isInitial) {
        const o = document.getElementById('loadingStateContent');
        if (o) o.style.display = 'flex';
        document.getElementById('loadingTitle').textContent = msg;
        document.getElementById('loadingLogoContainer').style.display = isInitial ? 'block' : 'none';
        document.getElementById('loadingSpinner').style.display = isInitial ? 'none' : 'block';
    }
    hideLoading() { document.getElementById('loadingStateContent').style.display = 'none'; }
    showToast(m, t, callback) {
        const c = document.getElementById('toastContainer');
        const d = document.createElement('div');
        d.className = `toast ${t}`;
        d.textContent = m;

        if (callback) {
            d.style.cursor = 'pointer';
            d.onclick = callback;
        }

        c.appendChild(d);
        setTimeout(() => d.remove(), 6000); // 6 Sec for version notice
    }
}

// Global UI Helper
AppManager.prototype.showConfirmNotification = function (msg, onOk, okT = 'Ya', canT = 'Batal') {
    const d = document.createElement('div');
    d.className = 'confirm-notification show';
    d.innerHTML = `<div class="confirm-content"><p>${msg}</p><div class="confirm-buttons"><button class="btn-confirm-cancel">${canT}</button><button class="btn-confirm-ok">${okT}</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector('.btn-confirm-cancel').onclick = () => d.remove();
    d.querySelector('.btn-confirm-ok').onclick = () => { d.remove(); onOk(); };
};

// Global Initialization
let app;
document.addEventListener('DOMContentLoaded', () => { app = new AppManager(); });
window.switchSection = (id, el) => app.switchSection(id, el);
window.handleSearch = (v) => app.handleSearch(v);
window.openModal = () => app.openModal();
window.closeModal = () => app.closeModal();
window.openGuide = () => document.getElementById('guideModal').style.display = 'flex';
window.closeGuide = () => document.getElementById('guideModal').style.display = 'none';
window.handleLogin = () => app.handleLogin();
window.closeDetailModal = () => document.getElementById('detailModal').style.display = 'none';

// --- BULK OPERATIONS ---
let bulkArray = [];
window.openBulkModal = () => { document.getElementById('bulkModal').style.display = 'flex'; bulkArray = []; updateBulkUI(); };
window.closeBulkModal = () => document.getElementById('bulkModal').style.display = 'none';
window.addTaskToBulkList = (e) => {
    e.preventDefault();
    bulkArray.push(Object.fromEntries(new FormData(e.target).entries()));
    updateBulkUI();
    e.target.reset();
};
function updateBulkUI() {
    const list = document.getElementById('bulkTaskList'), items = document.getElementById('bulkTaskItems');
    list.style.display = bulkArray.length ? 'block' : 'none';
    document.getElementById('bulkCount').textContent = bulkArray.length;
    document.getElementById('saveBulkBtn').disabled = !bulkArray.length;
    items.innerHTML = bulkArray.map((t, i) => `<div class="bulk-item">${t.task} <button onclick="bulkArray.splice(${i},1);updateBulkUI()">X</button></div>`).join('');
}
window.saveBulkTasks = async () => {
    app.showLoading('Saving bulk...');
    try {
        await Promise.all(bulkArray.map(t => app.callAPI('createTask', { data: JSON.stringify(t) })));
        app.showToast('Bulk success!', 'success');
        closeBulkModal();
        await app.loadAllData();
    } catch (e) { app.showToast('Bulk failed', 'error'); }
    finally { app.hideLoading(); }
};

let selectedTasks = new Set();
window.toggleTaskSelection = (id) => {
    if (selectedTasks.has(id)) selectedTasks.delete(id); else selectedTasks.add(id);
    document.getElementById('bulkActionBar').style.display = selectedTasks.size ? 'block' : 'none';
    document.getElementById('selectedCount').textContent = `${selectedTasks.size} terpilih`;
};
window.selectAllTasks = () => {
    document.querySelectorAll('.task-checkbox').forEach(c => { selectedTasks.add(parseInt(c.dataset.taskId)); c.checked = true; });
    window.toggleTaskSelection();
};
window.clearSelection = () => {
    selectedTasks.clear();
    document.querySelectorAll('.task-checkbox').forEach(c => c.checked = false);
    window.toggleTaskSelection();
};
window.applyBulkStatusChange = async () => {
    const s = document.getElementById('bulkStatusChange').value;
    if (!s) return;
    app.showLoading('Bulk Change...');
    try {
        await Promise.all(Array.from(selectedTasks).map(id => app.callAPI('updateTask', { id, data: JSON.stringify({ inProgress: s }) })));
        app.showToast('Success!', 'success');
        window.clearSelection();
        await app.loadAllData();
    } finally { app.hideLoading(); }
};
window.bulkDeleteTasks = () => {
    app.showConfirmNotification(`Hapus ${selectedTasks.size} task?`, async () => {
        app.showLoading('Deleting...');
        try {
            await Promise.all(Array.from(selectedTasks).map(id => app.callAPI('deleteTask', { id })));
            window.clearSelection();
            await app.loadAllData();
        } finally { app.hideLoading(); }
    });
};

function formatRelativeTime(ts) {
    const d = new Date(ts), diff = Math.floor((new Date() - d) / 864e5);
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin';
    if (diff < 7) return `${diff} hari lalu`;
    return d.toLocaleDateString('id-ID');
}
