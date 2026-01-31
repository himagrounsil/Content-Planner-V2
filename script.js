const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbz_aR8K15x7glFS2tgthNrsBScUw_1TqHPveG_AQraOAuAEsp21eDVGg-_KjiOvTRxf/exec',
};

class AppManager {
    constructor() {
        this.currentSection = 'content-planner';
        this.currentView = 'list';
        this.currentDate = new Date();
        this.data = { tasks: [], prestasi: [], media: [], dropdowns: { assignedTo: [], format: [] } };
        this.filteredData = { tasks: [], prestasi: [], media: [] };
        this.userName = localStorage.getItem('himagro_user') || null;
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
        // First visit check for Guide
        const hasSeenGuide = localStorage.getItem('himagro_seen_guide');
        if (!hasSeenGuide) {
            setTimeout(() => window.openGuide(), 1500);
            localStorage.setItem('himagro_seen_guide', 'true');
        }

        this.setupEventListeners();
        await this.loadAllData(true); // Pass true for initial load
        this.switchSection('content-planner', document.querySelector('.nav-item.active'));
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
            localStorage.setItem('himagro_user', this.userName);
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
    }

    async loadAllData(isInitial = false) {
        this.showLoading(isInitial ? 'Sedang Menyiapkan System...' : 'Merefresh Data...', isInitial);
        try {
            // SINGLE CALL to speed up loading
            const response = await fetch(`${CONFIG.API_URL}?action=getAllData`);
            const allData = await response.json();

            if (allData.error) throw new Error(allData.error);

            this.data = allData;
            this.populateDropdowns();
            this.applyFilters();
            if (!isInitial) this.showToast('Data berhasil diperbarui', 'success');
        } catch (error) {
            console.error('Initial load failed:', error);
            this.showToast('Gagal memuat data! Periksa koneksi internet.', 'error');
        } finally {
            this.hideLoading();
        }
    }

    populateDropdowns() {
        const { assignedTo, format } = this.data.dropdowns;

        // Update Filters
        const filterAssignee = document.getElementById('filterAssignee');
        const filterFormat = document.getElementById('filterFormat');

        if (filterAssignee) {
            filterAssignee.innerHTML = '<option value="">Assigned To</option>' +
                assignedTo.map(a => `<option value="${a}">${a}</option>`).join('');
        }
        if (filterFormat) {
            filterFormat.innerHTML = '<option value="">Format</option>' +
                format.map(f => `<option value="${f}">${f}</option>`).join('');
        }

        // Update Modal Forms (Normal & Bulk)
        const modalAssignees = document.querySelectorAll('select[name="assignedTo"]');
        const modalFormats = document.querySelectorAll('select[name="format"]');

        modalAssignees.forEach(select => {
            select.innerHTML = assignedTo.map(a => `<option value="${a}">${a}</option>`).join('');
        });
        modalFormats.forEach(select => {
            select.innerHTML = format.map(f => `<option value="${f}">${f}</option>`).join('');
        });
    }

    async logActivity(action, targetId, details) {
        try {
            const logData = {
                user: this.userName,
                action: action,
                targetId: targetId,
                details: details
            };
            await fetch(`${CONFIG.API_URL}?action=logActivity&data=${encodeURIComponent(JSON.stringify(logData))}`);
        } catch (e) {
            console.error('Log failed', e);
        }
    }

    async clearCache() {
        this.showLoading('Membersihkan Cache...');
        this.data = { tasks: [], prestasi: [], media: [] };
        this.filteredData = { tasks: [], prestasi: [], media: [] };
        // If there were any localStorage keys, clear them here
        await this.loadAllData();
        this.showToast('Cache dibersihkan', 'success');
    }

    logout() {
        this.showConfirmNotification(
            'Apakah Anda yakin ingin logout? Nama Anda akan dihapus dari sistem ini.',
            () => {
                localStorage.removeItem('himagro_user');
                this.showToast('Logout berhasil, mengalihkan...', 'success');
                setTimeout(() => location.reload(), 1000);
            },
            'Ya, Logout',
            'Batal'
        );
    }

    async switchSection(sectionId, element) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');
        this.currentSection = sectionId;

        // Update Dynamic Titles & Subtitles
        const sectionInfo = {
            'content-planner': {
                title: 'Content Planner',
                subtitle: 'Modul untuk mengatur, menjadwalkan, dan memantau konten agar pengelolaan informasi berjalan terstruktur dan terkoordinasi.'
            },
            'prestasi': {
                title: 'Prestasi Mahasiswa',
                subtitle: 'Fitur pengelolaan data prestasi mahasiswa sebagai arsip internal dan bahan publikasi resmi.'
            },
            'media-partner': {
                title: 'Media Partner',
                subtitle: 'Menu pengelolaan data dan kerja sama media partner untuk mendukung kebutuhan publikasi dan kolaborasi.'
            }
        };

        const info = sectionInfo[sectionId];
        document.getElementById('pageTitle').textContent = info.title;
        document.getElementById('pageSubtitle').textContent = info.subtitle;

        // Close mobile menu if open
        const navContainer = document.getElementById('navContainer');
        const menuToggle = document.getElementById('menuToggle');
        if (navContainer && navContainer.classList.contains('active')) {
            navContainer.classList.remove('active');
            const icon = menuToggle?.querySelector('i');
            if (icon) icon.className = 'fas fa-bars';
        }

        if (sectionId === 'content-planner') {
            this.applyFilters();
        } else if (sectionId === 'prestasi') {
            this.renderPrestasi();
        } else if (sectionId === 'media-partner') {
            this.renderMediaPartner();
        }
    }

    switchView(view, element) {
        document.querySelectorAll('.view-btn').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        this.currentView = view;

        const monthNav = document.getElementById('monthNavigation');
        monthNav.style.display = (view === 'monthly' || view === 'calendar') ? 'flex' : 'none';

        if (window.clearSelection) window.clearSelection(); // Clear select state on view change
        this.renderTasks();
    }

    handleSearch(val) {
        const term = val.toLowerCase();
        if (this.currentSection === 'content-planner') {
            this.filteredData.tasks = this.data.tasks.filter(t =>
                t.task.toLowerCase().includes(term) ||
                t.assignedTo.toLowerCase().includes(term)
            );
            this.renderTasks();
        } else if (this.currentSection === 'prestasi') {
            const filtered = this.data.prestasi.filter(t =>
                t.nama.toLowerCase().includes(term) ||
                t.kegiatan.toLowerCase().includes(term)
            );
            this.renderPrestasi(filtered);
        } else if (this.currentSection === 'media-partner') {
            const filtered = this.data.media.filter(t =>
                t.instansi.toLowerCase().includes(term) ||
                t.kegiatan.toLowerCase().includes(term)
            );
            this.renderMediaPartner(filtered);
        }
    }

    changeMonth(delta) {
        this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        this.renderTasks();
    }

    applyFilters() {
        if (this.currentSection !== 'content-planner') return;

        const platform = document.getElementById('filterPlatform').value;
        const assignee = document.getElementById('filterAssignee').value;
        const format = document.getElementById('filterFormat').value;

        this.filteredData.tasks = this.data.tasks.filter(t => {
            return (!platform || t.platform === platform) &&
                (!assignee || t.assignedTo === assignee) &&
                (!format || t.format === format);
        });

        this.renderTasks();
        this.updateStats();
    }

    renderTasks() {
        const container = document.getElementById('contentPlannerList');
        container.className = this.currentView === 'calendar' ? '' : 'data-grid';
        container.innerHTML = '';

        const monthStr = this.currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        document.getElementById('currentMonthDisplay').textContent = monthStr;

        if (this.currentView === 'calendar') {
            this.renderCalendar(container);
            return;
        }

        let tasksToRender = [...this.filteredData.tasks];

        if (this.currentView === 'monthly') {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth();
            tasksToRender = tasksToRender.filter(t => {
                const d = new Date(t.dueDate);
                return d.getFullYear() === year && d.getMonth() === month;
            });
        }

        tasksToRender.forEach(task => {
            container.appendChild(this.createTaskCard(task));
        });
    }

    createTaskCard(task) {
        const div = document.createElement('div');
        div.className = 'grid-card';
        const isDone = task.inProgress === 'Done';

        div.innerHTML = `
            <div class="grid-card-header">
                <input type="checkbox" class="task-checkbox" 
                       data-task-id="${task.no}" 
                       onclick="event.stopPropagation(); toggleTaskSelection(${task.no})"
                       style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <h3 style="flex: 1;">${task.task}</h3>
                <select class="status-dropdown" onchange="app.quickUpdateStatus(${task.no}, this.value)" onclick="event.stopPropagation()">
                    <option value="Not Done" ${task.inProgress === 'Not Done' ? 'selected' : ''}>Not Done</option>
                    <option value="On Progress" ${task.inProgress === 'On Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Ready To Upload" ${task.inProgress === 'Ready To Upload' ? 'selected' : ''}>Ready</option>
                    <option value="Done" ${task.inProgress === 'Done' ? 'selected' : ''}>Selesai</option>
                </select>
            </div>
            <div class="grid-info-row"><i class="fas fa-user"></i> ${task.assignedTo}</div>
            <div class="grid-info-row"><i class="fas fa-calendar"></i> ${task.dueDate}</div>
            <div class="grid-info-row"><i class="fas fa-bullseye"></i> ${task.platform} - ${task.format}</div>
            <div style="margin-top:auto; display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn-text btn-edit" onclick="event.stopPropagation(); app.editTask(${task.no})">Edit</button>
                <button class="btn-text btn-delete" onclick="event.stopPropagation(); app.deleteTask(${task.no})">Hapus</button>
            </div>
        `;
        div.onclick = () => this.showTaskDetail(task);
        return div;
    }

    renderCalendar(container) {
        container.innerHTML = `<div class="calendar-container">
            <div class="calendar-grid" id="calendarGridMain"></div>
        </div>`;

        const grid = document.getElementById('calendarGridMain');
        const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        labels.forEach(l => grid.innerHTML += `<div class="calendar-day-label">${l}</div>`);

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div class="calendar-cell"></div>`;

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let d = 1; d <= lastDate; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const tasks = this.filteredData.tasks.filter(t => t.dueDate === dateStr);
            let tasksHtml = tasks.map(t => `<div class="calendar-task" onclick="event.stopPropagation(); app.showTaskDetail(${JSON.stringify(t).replace(/"/g, '&quot;')})">${t.task}</div>`).join('');

            grid.innerHTML += `<div class="calendar-cell ${isCurrentMonth && d === today.getDate() ? 'today' : ''}">
                <div class="calendar-date">${d}</div>
                ${tasksHtml}
            </div>`;
        }
    }

    renderPrestasi(prestasiToRender = null) {
        const grid = document.getElementById('prestasiGrid');
        grid.innerHTML = '';
        const items = prestasiToRender || this.data.prestasi;
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'grid-card';
            const timeDisplay = window.formatRelativeTime ? window.formatRelativeTime(item.timestamp) : item.timestamp;
            card.innerHTML = `
                <h3>${item.nama}</h3>
                <div class="grid-info-row"><i class="fas fa-id-card"></i> ${item.npm}</div>
                <div class="grid-info-row"><i class="fas fa-trophy"></i> ${item.kegiatan}</div>
                <div class="grid-info-row"><i class="fas fa-layer-group"></i> ${item.tingkat}</div>
                <div class="grid-info-row"><i class="fas fa-clock"></i> ${timeDisplay}</div>
            `;
            card.onclick = () => this.showPrestasiDetail(item);
            grid.appendChild(card);
        });
    }

    renderMediaPartner(mediaToRender = null) {
        const grid = document.getElementById('mediaPartnerGrid');
        grid.innerHTML = '';
        const items = mediaToRender || this.data.media;
        items.forEach(item => {
            const hasProposal = (item.proposal && item.proposal.length > 5) || item.proposal === 'Ya';
            const hasSurat = (item.surat && item.surat.length > 5) || item.surat === 'Ya';
            const hasPoster = item.poster === 'Ya';
            const hasCaption = item.caption === 'Ya';
            const taskCreated = item.taskCreated === 'TRUE';

            const card = document.createElement('div');
            card.className = 'grid-card';
            card.innerHTML = `
                <h3>
                    ${item.kegiatan}
                    ${taskCreated ? '<span class="badge-created">✓ Task Dibuat</span>' : ''}
                </h3>
                <div class="grid-info-row"><i class="fas fa-building"></i> ${item.instansi}</div>
                <div class="grid-info-row" style="margin-top: 8px; flex-wrap: wrap; gap: 12px;">
                    <span><i class="fas fa-check-circle" style="color: ${hasProposal ? 'var(--primary)' : 'var(--text-muted)'}"></i> Prop</span>
                    <span><i class="fas fa-check-circle" style="color: ${hasSurat ? 'var(--primary)' : 'var(--text-muted)'}"></i> Surat</span>
                    <span><i class="fas fa-check-circle" style="color: ${hasPoster ? 'var(--primary)' : 'var(--text-muted)'}"></i> Poster</span>
                    <span><i class="fas fa-check-circle" style="color: ${hasCaption ? 'var(--primary)' : 'var(--text-muted)'}"></i> Cap</span>
                </div>
                <div style="margin-top:auto; display:flex; gap:10px; padding-top: 12px;">
                    <button class="btn btn-primary" style="font-size:0.75rem; flex:1" 
                            onclick="event.stopPropagation(); app.automateTask(${JSON.stringify(item).replace(/"/g, '&quot;')})"
                            ${taskCreated ? 'disabled' : ''}>
                        <i class="fas fa-magic"></i> ${taskCreated ? 'Sudah Ditambahkan' : 'Auto Planner'}
                    </button>
                    <a href="https://wa.me/${item.wa?.replace(/\D/g, '')}" target="_blank" class="btn" 
                       style="padding: 0 12px; background: #25D366; color: white;" onclick="event.stopPropagation()">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                </div>
            `;
            card.onclick = () => this.showMediaDetail(item);
            grid.appendChild(card);
        });
    }

    updateStats() {
        const tasks = this.filteredData.tasks;
        document.getElementById('totalTasks').textContent = tasks.length;
        document.getElementById('completedTasks').textContent = tasks.filter(t => t.inProgress === 'Done').length;
        document.getElementById('inProgressTasks').textContent = tasks.filter(t => t.inProgress === 'On Progress' || t.inProgress === 'Ready To Upload').length;

        const urgent = tasks.filter(t => t.inProgress !== 'Done' && t.dateLeft !== undefined && t.dateLeft <= 3).length;
        document.getElementById('urgentTasks').textContent = urgent;
    }

    // --- ACTIONS ---
    async handleTaskSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const taskData = Object.fromEntries(formData.entries());
        const taskId = e.target.dataset.taskId;

        this.showLoading(taskId ? 'Memperbarui Task...' : 'Menambahkan Task Baru...');
        try {
            const action = taskId ? `updateTask&id=${taskId}` : 'createTask';
            await fetch(`${CONFIG.API_URL}?action=${action}&data=${encodeURIComponent(JSON.stringify(taskData))}`);

            // Log the activity
            await this.logActivity(taskId ? 'UPDATE' : 'CREATE', taskId || 'NEW', `Task: ${taskData.task}`);

            this.showToast('Berhasil disimpan!', 'success');
            this.closeModal();
            await this.loadAllData();
        } catch (error) {
            this.showToast('Gagal menyimpan!', 'error');
        } finally {
            this.hideLoading();
        }
    }

    editTask(id) {
        const task = this.data.tasks.find(t => t.no == id);
        if (!task) return;

        const form = document.getElementById('taskForm');
        form.dataset.taskId = id;
        document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Task';

        // Fill form
        Object.keys(task).forEach(key => {
            const input = form.querySelector(`[name="${key}"]`);
            if (input) input.value = task[key];
        });

        this.openModal();
    }

    async deleteTask(id) {
        // Show custom confirmation notification
        this.showConfirmNotification('Apakah Anda yakin ingin menghapus task ini?', async () => {
            this.showLoading('Menghapus Task...');
            try {
                await fetch(`${CONFIG.API_URL}?action=deleteTask&id=${id}`);
                await this.logActivity('DELETE', id, 'Deleted content planner task');
                this.showToast('Berhasil dihapus', 'success');
                await this.loadAllData();
            } catch (error) {
                this.showToast('Gagal menghapus', 'error');
            } finally {
                this.hideLoading();
            }
        });
    }

    async quickUpdateStatus(no, status) {
        this.showToast('Mengupdate status...', 'info');
        try {
            await fetch(`${CONFIG.API_URL}?action=updateTask&id=${no}&data=${encodeURIComponent(JSON.stringify({ inProgress: status }))}`);
            await this.logActivity('STATUS_CHANGE', no, `Quick status update to: ${status}`);
            this.showToast('Status diperbarui!', 'success');
            const task = this.data.tasks.find(t => t.no == no);
            if (task) task.inProgress = status;
            this.updateStats();
        } catch (e) {
            this.showToast('Gagal update status', 'error');
        }
    }

    async automateTask(item) {
        const taskData = {
            task: `Media Partner (${item.kegiatan})`,
            platform: 'Instagram',
            format: 'Feeds',
            assignedTo: 'Design Creator',
            dueDate: item.publikasi || '',
            inProgress: 'Not Done',
            notes: `Kegiatan: ${item.kegiatan}\nInstansi: ${item.instansi}`
        };

        this.showToast('Menambah ke Content Planner...', 'info');
        try {
            const data = {
                rowIdx: item.rowIdx,
                taskData: taskData
            };
            await fetch(`${CONFIG.API_URL}?action=processMedia&data=${encodeURIComponent(JSON.stringify(data))}`);
            await this.logActivity('AUTO_PLANNER', 'NEW', `Media Partner: ${item.kegiatan}`);
            this.showToast('Berhasil ditambahkan ke Planner!', 'success');
            await this.loadAllData();
        } catch (e) {
            this.showToast('Gagal otomasi!', 'error');
        }
    }

    // --- POPUPS ---
    showTaskDetail(task) {
        const body = `
            <div class="detail-row"><span class="detail-label">Task</span><div class="detail-content">${task.task}</div></div>
            <div class="detail-row"><span class="detail-label">Platform/Format</span><div class="detail-content">${task.platform} - ${task.format}</div></div>
            <div class="detail-row"><span class="detail-label">Reference</span><div class="detail-content">${task.reference || '-'}</div></div>
            <div class="detail-row"><span class="detail-label">Result</span><div class="detail-content">${task.result || '-'}</div></div>
            <div class="detail-row"><span class="detail-label">Notes</span><div class="detail-content">${task.notes || '-'}</div></div>
        `;
        this.showModalDetail('Detail Task', body);
    }

    showPrestasiDetail(item) {
        const body = Object.entries(item).map(([k, v]) => `
            <div class="detail-row"><span class="detail-label">${k.toUpperCase()}</span><div class="detail-content">${v || '-'}</div></div>
        `).join('');
        this.showModalDetail('Detail Prestasi', body);
    }

    showMediaDetail(item) {
        const labels = {
            timestamp: 'Timestamp',
            nama: 'Nama CP',
            wa: 'WhatsApp',
            instansi: 'Nama Instansi',
            kegiatan: 'Nama Kegiatan',
            proposal: 'Proposal',
            surat: 'Surat Pengajuan',
            publikasi: 'Rencana Publikasi',
            email: 'Email',
            jenis: 'Jenis Kegiatan',
            poster: 'Poster Tersedia',
            caption: 'Caption Tersedia',
            drive: 'Link Drive Aset'
        };

        const body = Object.entries(labels).map(([key, label]) => {
            let val = item[key] || '-';

            // Format indicators
            if (['proposal', 'surat', 'poster', 'caption'].includes(key)) {
                const isOk = val.length > 5 || val === 'Ya';
                val = `<i class="fas fa-check-circle" style="color: ${isOk ? 'var(--primary)' : 'var(--text-muted)'}"></i> ${isOk ? 'Tersedia' : 'Tidak Ada'}`;
            }

            // Add WhatsApp Button next to number
            if (key === 'wa' && item.wa) {
                const cleanWa = item.wa.replace(/\D/g, '');
                val = `${item.wa} <a href="https://wa.me/${cleanWa}" target="_blank" class="btn" style="padding: 4px 8px; font-size: 0.7rem; background: #25D366; color: white; display: inline-flex; margin-left: 8px;"><i class="fab fa-whatsapp"></i> Hubungi</a>`;
            }

            // Linkify Drive
            if (key === 'drive' && item.drive && item.drive.startsWith('http')) {
                val = `<a href="${item.drive}" target="_blank" style="color: var(--primary); text-decoration: underline; word-break: break-all;">${item.drive}</a>`;
            }

            return `
                <div class="detail-row">
                    <span class="detail-label">${label}</span>
                    <div class="detail-content">${val}</div>
                </div>
            `;
        }).join('');

        this.showModalDetail('Detail Media Partner', body);
    }

    showModalDetail(title, body) {
        document.getElementById('detailModalTitle').textContent = title;
        document.getElementById('detailModalBody').innerHTML = body;
        document.getElementById('detailModal').style.display = 'flex';
    }

    // --- UI TOOLS ---
    openModal() {
        document.getElementById('taskModal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('taskModal').style.display = 'none';
        document.getElementById('taskForm').reset();
        delete document.getElementById('taskForm').dataset.taskId;
    }

    showLoading(message = 'Memproses...', isInitial = false) {
        const overlay = document.getElementById('loadingStateContent');
        const logo = document.getElementById('loadingLogoContainer');
        const spinner = document.getElementById('loadingSpinner');
        const title = document.getElementById('loadingTitle');
        const subtitle = document.getElementById('loadingSubtitle');

        if (overlay) overlay.style.display = 'flex';
        if (title) title.textContent = message;
        if (subtitle) subtitle.textContent = isInitial ? 'Mohon Tunggu Sebentar' : 'Sistem sedang bekerja';

        if (isInitial) {
            if (logo) logo.style.display = 'block';
            if (spinner) spinner.style.display = 'none';
        } else {
            if (logo) logo.style.display = 'none';
            if (spinner) spinner.style.display = 'block';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingStateContent');
        if (overlay) overlay.style.display = 'none';
    }

    showToast(m, t) {
        const cont = document.getElementById('toastContainer');
        if (!cont) return; // Fix appendChild error
        const d = document.createElement('div');
        d.className = `toast ${t}`;
        d.textContent = m;
        cont.appendChild(d);
        setTimeout(() => d.remove(), 4000);
    }
}

// Global scope initialization
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AppManager();
});

// Helper functions for HTML
window.switchSection = (id, el) => app.switchSection(id, el);
window.openModal = () => app.openModal();
window.closeModal = () => app.closeModal();
window.handleSearch = (val) => app.handleSearch(val);

// Add showConfirmNotification method to AppManager
AppManager.prototype.showConfirmNotification = function (message, onConfirm, okText = 'Ya, Hapus', cancelText = 'Batal') {
    const notification = document.createElement('div');
    notification.className = 'confirm-notification';
    notification.innerHTML = `
        <div class="confirm-content">
            <p>${message}</p>
            <div class="confirm-buttons">
                <button class="btn-confirm-cancel">${cancelText}</button>
                <button class="btn-confirm-ok">${okText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Handle buttons
    notification.querySelector('.btn-confirm-cancel').onclick = () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    };

    notification.querySelector('.btn-confirm-ok').onclick = () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
        onConfirm();
    };
};

// Bulk Task Management
let bulkTasksArray = [];

window.openBulkModal = () => {
    document.getElementById('bulkModal').style.display = 'flex';
    bulkTasksArray = [];
    document.getElementById('bulkTaskList').style.display = 'none';
    document.getElementById('bulkTaskItems').innerHTML = '';
    document.getElementById('bulkCount').textContent = '0';
    document.getElementById('saveBulkBtn').disabled = true;
    document.getElementById('bulkTaskForm').reset();
};

window.closeBulkModal = () => {
    document.getElementById('bulkModal').style.display = 'none';
    bulkTasksArray = [];
};

window.addTaskToBulkList = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const taskData = Object.fromEntries(formData.entries());

    // Add to array
    bulkTasksArray.push(taskData);

    // Update UI
    updateBulkTaskList();

    // Reset form
    e.target.reset();

    // Show success feedback
    app.showToast(`Task "${taskData.task}" ditambahkan ke daftar`, 'success');
};

function updateBulkTaskList() {
    const listContainer = document.getElementById('bulkTaskList');
    const itemsContainer = document.getElementById('bulkTaskItems');
    const countSpan = document.getElementById('bulkCount');
    const saveBtn = document.getElementById('saveBulkBtn');

    if (bulkTasksArray.length > 0) {
        listContainer.style.display = 'block';
        saveBtn.disabled = false;
        countSpan.textContent = bulkTasksArray.length;

        itemsContainer.innerHTML = bulkTasksArray.map((task, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${task.task}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${task.platform} • ${task.format} • ${task.assignedTo} • ${task.dueDate}
                    </div>
                </div>
                <button onclick="removeBulkTask(${index})" class="btn-text btn-delete" style="padding: 6px 12px; font-size: 0.8rem;">
                    Hapus
                </button>
            </div>
        `).join('');
    } else {
        listContainer.style.display = 'none';
        saveBtn.disabled = true;
    }
}

window.removeBulkTask = (index) => {
    bulkTasksArray.splice(index, 1);
    updateBulkTaskList();
    app.showToast('Task dihapus dari daftar', 'info');
};

window.saveBulkTasks = async () => {
    if (bulkTasksArray.length === 0) {
        app.showToast('Tidak ada task untuk disimpan', 'error');
        return;
    }

    app.showLoading(`Menyimpan ${bulkTasksArray.length} Task...`);

    try {
        // Save all tasks
        const promises = bulkTasksArray.map(taskData =>
            fetch(`${CONFIG.API_URL}?action=createTask&data=${encodeURIComponent(JSON.stringify(taskData))}`)
        );

        await Promise.all(promises);

        await app.logActivity('BULK_CREATE', 'MULTIPLE', `Created ${bulkTasksArray.length} tasks via bulk add`);

        app.showToast(`Berhasil menyimpan ${bulkTasksArray.length} task!`, 'success');
        closeBulkModal();
        await app.loadAllData();
    } catch (error) {
        app.showToast('Gagal menyimpan beberapa task', 'error');
    } finally {
        app.hideLoading();
    }
};

// Bulk Selection Management
let selectedTasks = new Set();

window.toggleTaskSelection = (taskId) => {
    if (selectedTasks.has(taskId)) {
        selectedTasks.delete(taskId);
    } else {
        selectedTasks.add(taskId);
    }
    updateBulkActionBar();
};

window.selectAllTasks = () => {
    const checkboxes = document.querySelectorAll('.task-checkbox');
    checkboxes.forEach(cb => {
        const taskId = parseInt(cb.dataset.taskId);
        selectedTasks.add(taskId);
        cb.checked = true;
    });
    updateBulkActionBar();
};

window.clearSelection = () => {
    selectedTasks.clear();
    document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
    updateBulkActionBar();
};

function updateBulkActionBar() {
    const bar = document.getElementById('bulkActionBar');
    const count = document.getElementById('selectedCount');

    if (selectedTasks.size > 0) {
        bar.style.display = 'block';
        count.textContent = `${selectedTasks.size} task dipilih`;
    } else {
        bar.style.display = 'none';
    }
}

window.applyBulkStatusChange = async () => {
    const status = document.getElementById('bulkStatusChange').value;
    if (!status || selectedTasks.size === 0) {
        app.showToast('Pilih status terlebih dahulu', 'error');
        return;
    }

    app.showLoading(`Memperbarui ${selectedTasks.size} Status...`);

    try {
        const promises = Array.from(selectedTasks).map(taskId =>
            fetch(`${CONFIG.API_URL}?action=updateTask&id=${taskId}&data=${encodeURIComponent(JSON.stringify({ inProgress: status }))}`)
        );
        await Promise.all(promises);
        await app.logActivity('BULK_STATUS_CHANGE', 'MULTIPLE', `Changed status of ${selectedTasks.size} tasks to ${status}`);
        app.showToast(`${selectedTasks.size} task berhasil diupdate`, 'success');
        clearSelection();
        await app.loadAllData();
    } catch (error) {
        app.showToast('Gagal update beberapa task', 'error');
    } finally {
        app.hideLoading();
    }
};

window.bulkDeleteTasks = () => {
    if (selectedTasks.size === 0) return;

    app.showConfirmNotification(
        `Hapus ${selectedTasks.size} task yang dipilih?`,
        async () => {
            app.showLoading();
            try {
                const promises = Array.from(selectedTasks).map(taskId =>
                    fetch(`${CONFIG.API_URL}?action=deleteTask&id=${taskId}`)
                );
                await Promise.all(promises);
                await app.logActivity('BULK_DELETE', 'MULTIPLE', `Deleted ${selectedTasks.size} tasks via bulk selection`);
                app.showToast(`${selectedTasks.size} task berhasil dihapus`, 'success');
                clearSelection();
                await app.loadAllData();
            } catch (error) {
                app.showToast('Gagal hapus beberapa task', 'error');
            } finally {
                app.hideLoading();
            }
        }
    );
};

// Relative Time Formatting
window.formatRelativeTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 15) {
        if (diffDays === 0) return 'Hari ini';
        if (diffDays === 1) return 'Kemarin';
        return `${diffDays} hari yang lalu`;
    } else {
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
};

window.closeDetailModal = () => document.getElementById('detailModal').style.display = 'none';
window.switchView = (view, el) => app.switchView(view, el);
window.applyFilters = () => app.applyFilters();

// Guide Handlers
window.openGuide = () => {
    document.getElementById('guideModal').style.display = 'flex';
};

window.closeGuide = () => {
    document.getElementById('guideModal').style.display = 'none';
};

window.handleLogin = () => app.handleLogin();
