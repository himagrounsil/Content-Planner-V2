// Modern Task Management System
class TaskManager {
    constructor() {
        this.config = {
            API_BASE_URL: 'https://script.google.com/macros/s/AKfycbxmk_WEgXSPN9OzFQyPAgmcNZTACH1sa69V5wZbngXz0kvjpIiqe5jLcGI1kx4a_0-6/exec',
            CACHE_DURATION: 10000, // 10 seconds (reduced for faster updates)
            DEBOUNCE_DELAY: 200 // 200ms for faster search response
        };
        
        this.tasks = [];
        this.filteredTasks = [];
        this.isLoading = false;
        this.cache = { data: null, timestamp: 0 };
        this.searchTerm = '';
        this.filters = { assignedTo: '', format: '' };
        this.searchTimeout = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.setupScrollButton();
        this.loadTasks();
    }

    setupEventListeners() {
        // Search with debouncing
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.debounceSearch();
            });
        }

        // Filters
        const assignedToFilter = document.getElementById('assignedToFilter');
        const formatFilter = document.getElementById('formatFilter');
        
        if (assignedToFilter) {
            assignedToFilter.addEventListener('change', (e) => {
                this.filters.assignedTo = e.target.value;
                this.applyFiltersAndSearch();
            });
        }
        
        if (formatFilter) {
            formatFilter.addEventListener('change', (e) => {
                this.filters.format = e.target.value;
                this.applyFiltersAndSearch();
            });
        }

        // Form submission
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => this.handleSubmitTask(e));
        }

        // Close form on outside click
        document.addEventListener('click', (e) => {
            const addTaskForm = document.getElementById('addTaskForm');
            if (e.target === addTaskForm) {
                this.closeAddTaskForm();
            }
        });

        // Escape key to close form
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAddTaskForm();
            }
        });
    }

    setupTheme() {
        const themeBtn = document.getElementById('toggleThemeBtn');
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        // Apply saved theme
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const mode = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        localStorage.setItem('theme', mode);
                this.updateThemeIcon(themeBtn, mode);
            });
            this.updateThemeIcon(themeBtn, savedTheme);
        }
    }

    updateThemeIcon(btn, mode) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    setupScrollButton() {
        const scrollBtn = document.getElementById('scrollTopBtn');
        if (scrollBtn) {
            // Show/hide button based on scroll position
            window.addEventListener('scroll', () => {
                if (window.scrollY > 300) {
                    scrollBtn.classList.add('show');
                } else {
                    scrollBtn.classList.remove('show');
                }
            });

            // Scroll to top when clicked
            scrollBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }

    // Performance optimizations
    debounceSearch() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        this.searchTimeout = setTimeout(() => {
            this.applyFiltersAndSearch();
        }, this.config.DEBOUNCE_DELAY);
    }

    // API Methods
    async makeRequest(action, data = {}) {
        const params = new URLSearchParams({
            action,
            ...data,
            _ts: Date.now()
        });

        try {
            const response = await fetch(`${this.config.API_BASE_URL}?${params}`, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('API Response:', action, result);
            return result;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async loadTasks(forceRefresh = false) {
        if (this.isLoading) return;
        
        // Check cache
    const now = Date.now();
        if (!forceRefresh && this.cache.data && (now - this.cache.timestamp) < this.config.CACHE_DURATION) {
            this.tasks = this.cache.data;
            this.applyFiltersAndSearch();
            this.updateStats();
        return;
    }
    
    try {
            this.isLoading = true;
            this.showLoading();
            
            const response = await this.makeRequest('getTasks');
            this.tasks = (response || []).filter(task => 
                task && (task.task || task.platform || task.assignedTo)
            );
        
        // Update cache
            this.cache.data = this.tasks;
            this.cache.timestamp = now;
            
            this.applyFiltersAndSearch();
            this.updateStats();
            this.hideLoading();
        
    } catch (error) {
        console.error('Failed to load tasks:', error);
            this.showError('Gagal memuat data tasks');
    } finally {
            this.isLoading = false;
        }
    }

    async createTask(taskData) {
        try {
            // Show minimal loading for faster UX
            this.showToast('Menyimpan task...', 'info');
            const response = await this.makeRequest('createTask', { data: JSON.stringify(taskData) });
            
            console.log('Create task response:', response);
            
            // Check if response exists and has success indicator
            if (response && (response.message || response.success || response.no)) {
                this.showToast('Task berhasil ditambahkan', 'success');
                this.closeAddTaskForm();
                // Load tasks without showing loading overlay
                await this.loadTasks(true);
            } else if (response && response.error) {
                this.showToast(response.error, 'error');
            } else {
                // If no error but also no clear success, assume success if we got a response
                this.showToast('Task berhasil ditambahkan', 'success');
                this.closeAddTaskForm();
                await this.loadTasks(true);
            }
        } catch (error) {
            console.error('Failed to create task:', error);
            this.showToast('Gagal menambahkan task', 'error');
        }
    }

    async updateTask(taskId, taskData) {
        try {
            // Show minimal loading for faster UX
            this.showToast('Menyimpan perubahan...', 'info');
            
            // Clear cache first
            this.cache.data = null;
            this.cache.timestamp = 0;
            
            const response = await this.makeRequest('updateTask', { 
                id: String(taskId), 
                data: JSON.stringify(taskData) 
            });
            
            console.log('Update response:', response);
            
            if (response && (response.message || response.success || response.no)) {
                this.showToast('Task berhasil diupdate', 'success');
                this.closeAddTaskForm();
                // Force refresh to get latest data
                await this.loadTasks(true);
            } else {
                throw new Error(response?.error || 'Gagal mengupdate task');
            }
        } catch (error) {
            console.error('Failed to update task:', error);
            this.showToast('Gagal mengupdate task', 'error');
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Apakah Anda yakin ingin menghapus task ini?')) {
        return;
    }
    
        try {
            this.showLoading('Menghapus task...');
            const response = await this.makeRequest('deleteTask', { id: String(taskId) });
            
            if (response && (response.message || response.success)) {
                this.showToast('Task berhasil dihapus', 'success');
                await this.loadTasks(true);
        } else {
                throw new Error(response?.error || 'Gagal menghapus task');
            }
        } catch (error) {
            console.error('Failed to delete task:', error);
            this.showToast('Gagal menghapus task', 'error');
        } finally {
            this.hideLoading();
        }
    }

    // UI Methods
    applyFiltersAndSearch() {
        let result = [...this.tasks];
        
        // Hide done tasks older than 30 days
        result = result.filter(task => {
            const isDone = (task.inProgress || '').toLowerCase() === 'done';
            if (!isDone) return true;
            
            // Check if done task is older than 30 days
            if (task.dueDate) {
                const dueDate = new Date(task.dueDate);
                const today = new Date();
                const daysDiff = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                return daysDiff <= 30; // Show done tasks only if they're within 30 days
            }
            return true;
        });
        
        // Apply search
        if (this.searchTerm) {
            result = result.filter(task => {
                const searchableText = [
                    task.task || '',
                    task.platform || '',
                    task.format || '',
                    task.assignedTo || '',
                    task.inProgress || '',
                    task.reference || '',
                    task.result || '',
                    task.notes || ''
                ].join(' ').toLowerCase();
                
                return searchableText.includes(this.searchTerm);
            });
        }
        
        // Apply filters
        if (this.filters.assignedTo) {
            result = result.filter(task => 
                (task.assignedTo || '').toLowerCase().includes(this.filters.assignedTo.toLowerCase())
            );
        }
        
        if (this.filters.format) {
            result = result.filter(task => 
                (task.format || '').toLowerCase().includes(this.filters.format.toLowerCase())
            );
        }
        
        this.filteredTasks = result;
        this.renderTasks();
        this.updateStats();
    }

    renderTasks() {
        const tasksList = document.getElementById('tasksList');
        if (!tasksList) return;
        
        if (this.filteredTasks.length === 0) {
            this.showEmpty();
            return;
        }
    
    // Use document fragment for better performance
    const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        
        this.filteredTasks.forEach(task => {
            tempDiv.innerHTML = this.createTaskHTML(task);
            fragment.appendChild(tempDiv.firstElementChild);
        });
        
        tasksList.innerHTML = '';
        tasksList.appendChild(fragment);
        this.hideAllStates();
    }

    createTaskHTML(task) {
        const statusClass = this.getStatusClass(task.inProgress);
        const deadlineClass = this.getDeadlineClass(task.dateLeft);
        const isCompleted = (task.inProgress || '').toLowerCase() === 'done';
        
        // Override deadline class if task is completed
        const finalDeadlineClass = isCompleted ? '' : deadlineClass;
        
        return `
            <div class="task-item ${isCompleted ? 'completed' : ''} ${finalDeadlineClass}" data-task-id="${task.no}">
                <div class="task-header">
                    <div class="task-title">${this.escapeHtml(task.task || '')}</div>
                    <div class="task-actions">
                        <select class="status-quick-update" onchange="quickUpdateStatus(${task.no}, this.value)" title="Ubah Status">
                            <option value="Not Done" ${task.inProgress === 'Not Done' ? 'selected' : ''}>Belum Dimulai</option>
                            <option value="On Progress" ${task.inProgress === 'On Progress' ? 'selected' : ''}>Dalam Proses</option>
                            <option value="Ready To Upload" ${task.inProgress === 'Ready To Upload' ? 'selected' : ''}>Siap Upload</option>
                            <option value="Done" ${task.inProgress === 'Done' ? 'selected' : ''}>Selesai</option>
                        </select>
                        <button class="btn btn-icon" onclick="taskManager.editTask(${task.no})" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon btn-danger" onclick="taskManager.deleteTask(${task.no})" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
        </div>
        </div>
                
                <div class="task-meta">
                    ${task.platform ? `<span><i class="fas fa-globe"></i> ${this.escapeHtml(task.platform)}</span>` : ''}
                    ${task.format ? `<span><i class="fas fa-file"></i> ${this.escapeHtml(task.format)}</span>` : ''}
                    ${task.assignedTo ? `<span><i class="fas fa-user"></i> ${this.escapeHtml(task.assignedTo)}</span>` : ''}
        </div>
                
                <div class="task-status ${statusClass}">
                    <i class="fas fa-circle"></i>
                    ${this.escapeHtml(task.inProgress || 'Not Done')}
        </div>
                
                <div class="task-deadline ${deadlineClass}">
                    <i class="fas fa-calendar"></i>
                    Due: ${this.formatDate(task.dueDate)}
                    ${!isCompleted && task.dateLeft !== undefined ? `(${this.getDeadlineText(task.dateLeft)})` : ''}
                </div>
            </div>
        `;
    }

    getStatusClass(status) {
        const s = (status || '').toLowerCase();
        if (s === 'done') return 'done';
        if (s === 'on progress') return 'on-progress';
        if (s === 'ready to upload') return 'ready';
        return 'not-done';
    }

    getDeadlineClass(dateLeft) {
        if (dateLeft < 0) return 'overdue';
        if (dateLeft <= 3) return 'urgent';
        return '';
    }

    getDeadlineText(dateLeft) {
        if (dateLeft < 0) return `${Math.abs(dateLeft)} hari terlambat`;
        if (dateLeft === 0) return 'Hari ini';
        if (dateLeft <= 3) return `${dateLeft} hari lagi`;
        return `${dateLeft} hari lagi`;
    }

    updateStats() {
        // Always count from all tasks, not filtered tasks
        const allTasks = this.tasks;
        const displayedTasks = this.filteredTasks.length > 0 ? this.filteredTasks : this.tasks;
        
        // Count all tasks for statistics
        const total = allTasks.length;
        const completed = allTasks.filter(task => (task.inProgress || '').toLowerCase() === 'done').length;
        const inProgress = allTasks.filter(task => (task.inProgress || '').toLowerCase() === 'on progress').length;
        
        // Hanya hitung urgent untuk task yang belum done dan yang ditampilkan
        const urgent = displayedTasks.filter(task => {
            const isDone = (task.inProgress || '').toLowerCase() === 'done';
            const isUrgent = task.dateLeft !== undefined && task.dateLeft <= 3 && task.dateLeft >= 0;
            return !isDone && isUrgent;
        }).length;
        
        this.updateElement('totalTasks', total);
        this.updateElement('completedTasks', completed);
        this.updateElement('inProgressTasks', inProgress);
        this.updateElement('urgentTasks', urgent);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    // Form Methods
    openAddTaskForm() {
        const form = document.getElementById('addTaskForm');
        if (form) {
            form.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            this.resetForm();
        }
    }

    closeAddTaskForm() {
        const form = document.getElementById('addTaskForm');
        if (form) {
            form.style.display = 'none';
            document.body.style.overflow = '';
            this.resetForm();
            
            // Reset form header
            const formHeader = document.querySelector('.form-header h3');
            if (formHeader) {
                formHeader.innerHTML = '<i class="fas fa-plus"></i> Tambah Task Baru';
            }
        }
    }

    resetForm() {
        const form = document.getElementById('taskForm');
        if (form) {
            form.reset();
            this.clearFormErrors();
        }
    }

    async handleSubmitTask(e) {
    e.preventDefault();
        
        const formData = new FormData(e.target);
        const taskData = {
            task: formData.get('task'),
            platform: formData.get('platform'),
            format: formData.get('format'),
            assignedTo: formData.get('assignedTo'),
            dueDate: formData.get('dueDate'),
            inProgress: formData.get('inProgress'),
            reference: formData.get('reference'),
            result: formData.get('result'),
            notes: formData.get('notes')
        };
        
        if (!this.validateTask(taskData)) {
        return;
    }
    
        // Check if this is an edit operation
        const taskId = e.target.dataset.taskId;
        if (taskId) {
            await this.updateTask(taskId, taskData);
        } else {
            await this.createTask(taskData);
        }
    }

    validateTask(data) {
        this.clearFormErrors();
    let isValid = true;
    
    const requiredFields = ['task', 'assignedTo', 'dueDate', 'inProgress'];
    
    requiredFields.forEach(field => {
        if (!data[field] || String(data[field]).trim() === '') {
                this.showFieldError(field, `${field} harus diisi`);
            isValid = false;
        }
    });
    
    // Date validation - only validate if date is provided and not empty
    if (data.dueDate && data.dueDate.trim() !== '') {
            const selectedDate = new Date(data.dueDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
                this.showFieldError('dueDate', 'Due date tidak boleh di masa lalu');
            isValid = false;
        }
    }
    
    return isValid;
}

    showFieldError(field, message) {
        const errorElement = document.getElementById(`${field}Error`);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

    clearFormErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
    });
}

// Task Actions
    async editTask(taskId) {
        const task = this.tasks.find(t => t.no == taskId);
        if (!task) return;
        
        // Open the form with pre-filled data
        this.openAddTaskForm();
        this.populateForm(task);
        
        // Update form header to indicate edit mode
        const formHeader = document.querySelector('.form-header h3');
        if (formHeader) {
            formHeader.innerHTML = '<i class="fas fa-edit"></i> Edit Task';
        }
    }

    async quickUpdateStatus(taskId, newStatus) {
        try {
            // Show minimal loading for faster UX
            this.showToast('Mengupdate status...', 'info');
            
            // Clear cache first
            this.cache.data = null;
            this.cache.timestamp = 0;
            
            const response = await this.makeRequest('updateTask', { 
                id: String(taskId), 
                data: JSON.stringify({ inProgress: newStatus }) 
            });
            
            console.log('Quick update response:', response);
            
            if (response && (response.message || response.success || response.no)) {
                this.showToast('Status berhasil diupdate', 'success');
                // Force refresh to get latest data
                await this.loadTasks(true);
            } else {
                throw new Error(response?.error || 'Gagal mengupdate status');
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            this.showToast('Gagal mengupdate status', 'error');
        }
    }

    populateForm(task) {
        const fields = ['task', 'platform', 'format', 'assignedTo', 'dueDate', 'inProgress', 'reference', 'result', 'notes'];
        fields.forEach(field => {
            const element = document.getElementById(`${field}Input`);
            if (element) {
                element.value = task[field] || '';
            }
        });
        
        // Store task ID for update
        const form = document.getElementById('taskForm');
        if (form) {
            form.dataset.taskId = task.no;
        }
    }

    // State Management
    showLoading(message = 'Memuat data...') {
        this.hideAllStates();
        const loadingState = document.getElementById('loadingState');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingMessage = document.getElementById('loadingMessage');
        
        if (loadingState) {
            loadingState.style.display = 'flex';
        }
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
    }

    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        const loadingOverlay = document.getElementById('loadingOverlay');
        
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    showError(message) {
        this.hideAllStates();
        const errorState = document.getElementById('errorState');
        const errorMessage = document.getElementById('errorMessage');
        if (errorState) {
            errorState.style.display = 'flex';
        }
        if (errorMessage) {
            errorMessage.textContent = message;
        }
    }

    showEmpty() {
        this.hideAllStates();
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
    }

    hideAllStates() {
        const states = ['loadingState', 'errorState', 'emptyState'];
        states.forEach(state => {
            const element = document.getElementById(state);
            if (element) {
                element.style.display = 'none';
            }
        });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fas fa-check-circle' :
                 type === 'error' ? 'fas fa-exclamation-circle' :
                 type === 'warning' ? 'fas fa-exclamation-triangle' :
                 'fas fa-info-circle';
    
    toast.innerHTML = `
            <i class="toast-icon ${icon}"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
    `;
    
        container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

    // Utility Methods
    formatDate(dateString) {
        if (!dateString) return '-';
        
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = dateString.split('-');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
        }
        
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions for HTML onclick handlers
function openAddTaskForm() {
    taskManager.openAddTaskForm();
}

function closeAddTaskForm() {
    taskManager.closeAddTaskForm();
}

function refreshTasks() {
    taskManager.loadTasks(true);
}

function handleSearch() {
    // Handled by event listener
}

function applyFilters() {
    // Handled by event listener
}

// Global function for quick status update
window.quickUpdateStatus = function(taskId, newStatus) {
    taskManager.quickUpdateStatus(taskId, newStatus);
};

// Initialize the application
let taskManager;

document.addEventListener('DOMContentLoaded', function() {
    taskManager = new TaskManager();
});