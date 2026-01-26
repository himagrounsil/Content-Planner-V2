const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbwpWA1XYxZpRauGGI-t_qm1Onq7cC0BGh8j7qglV1MyQFu6_ULxavMjorQ1ooZM0xLV/exec',
};

class AppManager {
    constructor() {
        this.currentSection = 'content-planner';
        this.currentView = 'list';
        this.currentDate = new Date(); // For month navigation
        this.data = { tasks: [], prestasi: [], media: [] };
        this.filteredData = { tasks: [], prestasi: [], media: [] };
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadAllData();
        this.switchSection('content-planner', document.querySelector('.nav-item.active'));
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

    async loadAllData() {
        this.showLoading();
        try {
            const actions = ['getTasks', 'getPrestasi', 'getMediaPartner'];
            const promises = actions.map(action => fetch(`${CONFIG.API_URL}?action=${action}`).then(r => r.json()));
            const [tasks, prestasi, media] = await Promise.all(promises);

            this.data = { tasks, prestasi, media };
            this.applyFilters();
            this.showToast('Data berhasil diperbarui', 'success');
        } catch (error) {
            this.showToast('Gagal memuat data!', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async clearCache() {
        this.showLoading();
        this.data = { tasks: [], prestasi: [], media: [] };
        this.filteredData = { tasks: [], prestasi: [], media: [] };
        // If there were any localStorage keys, clear them here
        await this.loadAllData();
        this.showToast('Cache dibersihkan', 'success');
    }

    async switchSection(sectionId, element) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        element.classList.add('active');
        document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
        document.getElementById(`${sectionId}-section`).classList.add('active');
        this.currentSection = sectionId;

        // Update Dynamic Titles
        const sectionNames = {
            'content-planner': 'Content Planner',
            'prestasi': 'Prestasi Mahasiswa',
            'media-partner': 'Media Partner'
        };
        document.getElementById('pageTitle').textContent = sectionNames[sectionId];

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
            const hasProposal = item.proposal && item.proposal.length > 5;
            const hasSurat = item.surat && item.surat.length > 5;
            const taskCreated = item.taskCreated === 'TRUE';

            const card = document.createElement('div');
            card.className = 'grid-card';
            card.innerHTML = `
                <h3>
                    ${item.kegiatan}
                    ${taskCreated ? '<span class="badge-created">✓ Task Dibuat</span>' : ''}
                </h3>
                <div class="grid-info-row"><i class="fas fa-building"></i> ${item.instansi}</div>
                <div class="grid-info-row">
                    <i class="fas fa-check-circle" style="color: ${hasProposal ? 'var(--primary)' : 'var(--text-muted)'}"></i> Proposal
                    <i class="fas fa-check-circle" style="color: ${hasSurat ? 'var(--primary)' : 'var(--text-muted)'}" style="margin-left:10px"></i> Surat
                </div>
                <div style="margin-top:auto; display:flex; gap:10px;">
                    <button class="btn btn-primary" style="font-size:0.75rem; flex:1" 
                            onclick="event.stopPropagation(); app.automateTask(${JSON.stringify(item).replace(/"/g, '&quot;')})"
                            ${taskCreated ? 'disabled' : ''}>
                        <i class="fas fa-magic"></i> ${taskCreated ? 'Sudah Ditambahkan' : 'Auto Planner'}
                    </button>
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

        this.showLoading();
        this.showToast('Sedang menyimpan...', 'info');
        try {
            const action = taskId ? `updateTask&id=${taskId}` : 'createTask';
            await fetch(`${CONFIG.API_URL}?action=${action}&data=${encodeURIComponent(JSON.stringify(taskData))}`);
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
            this.showLoading();
            this.showToast('Menghapus...', 'info');
            try {
                await fetch(`${CONFIG.API_URL}?action=deleteTask&id=${id}`);
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
            await fetch(`${CONFIG.API_URL}?action=createTask&data=${encodeURIComponent(JSON.stringify(taskData))}`);
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
        const body = Object.entries(item).map(([k, v]) => `
            <div class="detail-row"><span class="detail-label">${k.toUpperCase()}</span><div class="detail-content">${v || '-'}</div></div>
        `).join('');
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

    showLoading() { document.getElementById('loadingStateContent').style.display = 'flex'; }
    hideLoading() { document.getElementById('loadingStateContent').style.display = 'none'; }

    showToast(m, t) {
        const cont = document.getElementById('toastContainer');
        const d = document.createElement('div'); d.className = `toast ${t}`; d.textContent = m;
        cont.appendChild(d); setTimeout(() => d.remove(), 4000);
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
AppManager.prototype.showConfirmNotification = function (message, onConfirm) {
    const notification = document.createElement('div');
    notification.className = 'confirm-notification';
    notification.innerHTML = `
        <div class="confirm-content">
            <p>${message}</p>
            <div class="confirm-buttons">
                <button class="btn-confirm-cancel">Batal</button>
                <button class="btn-confirm-ok">Ya, Hapus</button>
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

    app.showLoading();
    app.showToast(`Menyimpan ${bulkTasksArray.length} task...`, 'info');

    try {
        // Save all tasks
        const promises = bulkTasksArray.map(taskData =>
            fetch(`${CONFIG.API_URL}?action=createTask&data=${encodeURIComponent(JSON.stringify(taskData))}`)
        );

        await Promise.all(promises);

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

    app.showLoading();
    app.showToast(`Mengubah status ${selectedTasks.size} task...`, 'info');

    try {
        const promises = Array.from(selectedTasks).map(taskId =>
            fetch(`${CONFIG.API_URL}?action=updateTask&id=${taskId}&data=${encodeURIComponent(JSON.stringify({ inProgress: status }))}`)
        );
        await Promise.all(promises);
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
