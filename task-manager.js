// Task Manager JavaScript
class TaskManager {
    constructor() {
        this.tasks = [];
        this.phases = [];
        this.originalMarkdown = '';
        this.init();
    }

    async init() {
        await this.loadTasks();
        this.loadSavedProgress();
        this.setupEventListeners();
        this.render();
    }

    async loadTasks() {
        // First try to load from localStorage if available
        const savedMarkdown = localStorage.getItem('tasksMarkdown');
        if (savedMarkdown) {
            this.originalMarkdown = savedMarkdown;
            this.parseTasks(this.originalMarkdown);
            return;
        }

        try {
            // Try to fetch the tasks.md file (works when served via HTTP)
            const response = await fetch('tasks.md');
            if (!response.ok) {
                throw new Error('Failed to load tasks.md');
            }
            this.originalMarkdown = await response.text();
            this.parseTasks(this.originalMarkdown);
            localStorage.setItem('tasksMarkdown', this.originalMarkdown);
        } catch (error) {
            console.log('Loading embedded tasks (CORS prevented loading tasks.md directly)');
            // Use embedded tasks data as fallback
            this.loadEmbeddedTasks();
        }
    }

    loadEmbeddedTasks() {
        // Load the full tasks from embedded data
        const tasksMarkdown = `# Day Dream Dictionary - Development Tasks

Generated from PRD: 2025-09-02T18:19:06.890Z

## Summary
- Total Phases: 10
- Total Tasks: 49
- Estimated Effort: 150 hours (19 days)

## Task Breakdown

### Phase 1: Setup & Infrastructure
Priority: High

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| SETUP-001 | Initialize React + Next.js project | Set up the base React application with Next.js framework, Tailwind CSS | 2h | todo |
| SETUP-002 | Configure development environment | Set up ESLint, Prettier, TypeScript configuration | 1h | todo |
| SETUP-003 | Set up Supabase project | Create Supabase project, configure Auth, set up database schema | 3h | todo |
| SETUP-004 | Configure MongoDB Atlas | Set up MongoDB cluster for dream documents storage | 2h | todo |
| SETUP-005 | Set up backend server | Initialize Node.js backend with Express/Fastify on Render | 3h | todo |
| SETUP-006 | Configure environment variables | Set up .env files for all API keys and configurations | 1h | todo |

### Phase 2: Authentication & User Management
Priority: High

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| AUTH-001 | Implement Supabase Auth integration | Set up sign up, login, logout, password reset flows | 4h | todo |
| AUTH-002 | Create user profile system | Implement user profiles with display_name, locale, preferences | 3h | todo |
| AUTH-003 | Implement RBAC system | Set up role-based access control for users and admins | 3h | todo |
| AUTH-004 | Create protected routes | Implement middleware for protecting API and frontend routes | 2h | todo |

### Phase 3: Payment & Billing System
Priority: High

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| PAY-001 | Integrate Stripe | Set up Stripe account, configure products and prices | 3h | todo |
| PAY-002 | Implement subscription management | Create subscription flows for Basic and Pro tiers | 5h | todo |
| PAY-003 | Build credit system | Implement credit purchase and consumption logic | 4h | todo |
| PAY-004 | Create Stripe webhook handler | Handle payment events, update subscriptions and credits | 3h | todo |
| PAY-005 | Implement payment UI | Build pricing page, checkout flow, payment management | 4h | todo |

### Phase 4: Core Dream Interpretation
Priority: High

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| DREAM-001 | Integrate OpenRouter API | Set up OpenRouter with Claude 3.5 Sonnet model | 2h | todo |
| DREAM-002 | Create interpretation prompt system | Implement structured prompt for dream analysis | 3h | todo |
| DREAM-003 | Build dream submission API | Create POST /api/dreams/interpret endpoint | 3h | todo |
| DREAM-004 | Implement JSON schema validation | Validate and repair AI responses | 2h | todo |
| DREAM-005 | Create dream submission UI | Build form for dream text input with character limits | 3h | todo |
| DREAM-006 | Build interpretation display | Create UI for showing themes, symbols, insights, guidance | 4h | todo |

### Phase 5: Quota & Paywall System
Priority: High

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| QUOTA-001 | Implement server-side quota tracking | Track free interpretations per user | 3h | todo |
| QUOTA-002 | Create paywall triggers | Show paywall after quota exhaustion | 2h | todo |
| QUOTA-003 | Build upgrade prompts | Create UI for subscription and credit purchase prompts | 3h | todo |
| QUOTA-004 | Implement credit consumption | Deduct credits for premium features | 2h | todo |

### Phase 6: Data Storage & History
Priority: Medium

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| DATA-001 | Implement dream storage | Store dreams in MongoDB with user association | 3h | todo |
| DATA-002 | Create history API | Build GET /api/dreams endpoint for user history | 2h | todo |
| DATA-003 | Build history UI | Create page to view past interpretations | 3h | todo |
| DATA-004 | Implement data deletion | Allow users to delete individual dreams or all data | 2h | todo |
| DATA-005 | Add privacy controls | Implement opt-in/opt-out for data storage | 2h | todo |

### Phase 7: Admin Dashboard
Priority: Medium

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| ADMIN-001 | Create admin layout | Build admin dashboard structure and navigation | 3h | todo |
| ADMIN-002 | Build user management | View users, roles, subscription status | 4h | todo |
| ADMIN-003 | Implement payment management | View payments, process refunds, add credits | 4h | todo |
| ADMIN-004 | Create analytics dashboard | Show KPIs: DAU, MRR, conversion rates | 5h | todo |
| ADMIN-005 | Add dream moderation tools | Optional viewing and management of submissions | 3h | todo |

### Phase 8: Premium Features
Priority: Medium

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| PREM-001 | Implement PDF export | Generate PDF reports for interpretations | 4h | todo |
| PREM-002 | Build email delivery | Send interpretation results via email | 3h | todo |
| PREM-003 | Create symbol encyclopedia | Build searchable dream symbol database | 5h | todo |
| PREM-004 | Add deeper analysis mode | Enhanced interpretation for premium users | 3h | todo |

### Phase 9: Internationalization
Priority: Medium

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| I18N-001 | Set up i18n framework | Configure next-i18next for translations | 2h | todo |
| I18N-002 | Create English translations | Extract and organize all UI strings | 3h | todo |
| I18N-003 | Add Spanish translations | Translate all UI strings to Spanish | 4h | todo |
| I18N-004 | Implement language switcher | Add UI for changing language preference | 2h | todo |

### Phase 10: Testing & Deployment
Priority: High

| ID | Task | Description | Effort | Status |
|----|------|-------------|--------|--------|
| TEST-001 | Write unit tests | Test core business logic and utilities | 6h | todo |
| TEST-002 | Create integration tests | Test API endpoints and database operations | 5h | todo |
| TEST-003 | Perform security audit | Check for vulnerabilities, implement rate limiting | 4h | todo |
| TEST-004 | Set up CI/CD pipeline | Configure automated testing and deployment | 3h | todo |
| TEST-005 | Deploy to production | Deploy frontend to Vercel, backend to Render | 3h | todo |
| TEST-006 | Configure monitoring | Set up error tracking and performance monitoring | 2h | todo |`;
        
        this.parseTasks(tasksMarkdown);
    }

    parseTasks(markdown) {
        const lines = markdown.split('\n');
        let currentPhase = null;
        let inTable = false;
        let tableHeaders = [];
        
        this.phases = [];
        this.tasks = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Parse phase headers
            if (line.startsWith('### Phase')) {
                const phaseMatch = line.match(/### Phase (\d+): (.+)/);
                if (phaseMatch) {
                    const phaseNum = parseInt(phaseMatch[1]);
                    const phaseName = phaseMatch[2];
                    
                    // Look for priority on next line
                    let priority = 'Medium';
                    if (i + 1 < lines.length) {
                        const nextLine = lines[i + 1].trim();
                        const priorityMatch = nextLine.match(/Priority: (\w+)/i);
                        if (priorityMatch) {
                            priority = priorityMatch[1];
                        }
                    }
                    
                    currentPhase = {
                        id: phaseNum,
                        name: phaseName,
                        priority: priority.toLowerCase(),
                        tasks: []
                    };
                    this.phases.push(currentPhase);
                    inTable = false;
                }
            }
            
            // Detect table headers
            if (line.startsWith('| ID') && line.includes('Task') && line.includes('Status')) {
                inTable = true;
                tableHeaders = line.split('|').map(h => h.trim()).filter(h => h);
                continue;
            }
            
            // Skip table separator line
            if (line.startsWith('|---') || line.startsWith('| ---')) {
                continue;
            }
            
            // Parse table rows
            if (inTable && line.startsWith('|') && currentPhase) {
                const cells = line.split('|').map(c => c.trim()).filter(c => c);
                
                if (cells.length >= 5) {
                    const task = {
                        id: cells[0],
                        name: cells[1],
                        description: cells[2],
                        effort: cells[3],
                        status: cells[4] || 'todo',
                        phaseId: currentPhase.id,
                        phaseName: currentPhase.name
                    };
                    
                    this.tasks.push(task);
                    currentPhase.tasks.push(task);
                }
            }
            
            // End table when we hit an empty line or new section
            if (inTable && (line === '' || line.startsWith('#'))) {
                inTable = false;
            }
        }
    }

    loadSavedProgress() {
        const saved = localStorage.getItem('taskProgress');
        if (saved) {
            try {
                const savedData = JSON.parse(saved);
                // Merge saved status with parsed tasks
                savedData.forEach(savedTask => {
                    const task = this.tasks.find(t => t.id === savedTask.id);
                    if (task) {
                        task.status = savedTask.status;
                    }
                });
            } catch (error) {
                console.error('Error loading saved progress:', error);
            }
        }
    }

    saveProgress() {
        const progressData = this.tasks.map(task => ({
            id: task.id,
            status: task.status
        }));
        localStorage.setItem('taskProgress', JSON.stringify(progressData));
        // Also save the current markdown if we have it
        if (this.originalMarkdown) {
            localStorage.setItem('tasksMarkdown', this.originalMarkdown);
        }
        this.showNotification('Progress saved successfully!');
    }

    setupEventListeners() {
        // Filter controls
        document.getElementById('phaseFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('priorityFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
    }

    render() {
        this.updateStats();
        this.renderPhaseFilter();
        this.renderPhases();
    }

    updateStats() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.status === 'done').length;
        const inProgressTasks = this.tasks.filter(t => t.status === 'in-progress').length;
        
        // Calculate total hours
        let totalHours = 0;
        this.tasks.forEach(task => {
            const match = task.effort.match(/(\d+)h/);
            if (match) {
                totalHours += parseInt(match[1]);
            }
        });
        
        const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        document.getElementById('totalTasks').textContent = totalTasks;
        document.getElementById('completedTasks').textContent = completedTasks;
        document.getElementById('inProgressTasks').textContent = inProgressTasks;
        document.getElementById('totalHours').textContent = totalHours + 'h';
        document.getElementById('progressPercent').textContent = progressPercent + '%';
    }

    renderPhaseFilter() {
        const select = document.getElementById('phaseFilter');
        select.innerHTML = '<option value="all">All Phases</option>';
        
        this.phases.forEach(phase => {
            const option = document.createElement('option');
            option.value = phase.id;
            option.textContent = `Phase ${phase.id}: ${phase.name}`;
            select.appendChild(option);
        });
    }

    renderPhases() {
        const container = document.getElementById('phasesContainer');
        container.innerHTML = '';
        
        if (this.phases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div>No tasks found. Please check if tasks.md file exists.</div>
                </div>
            `;
            return;
        }
        
        this.phases.forEach(phase => {
            const phaseElement = this.createPhaseElement(phase);
            container.appendChild(phaseElement);
        });
    }

    createPhaseElement(phase) {
        const phaseDiv = document.createElement('div');
        phaseDiv.className = 'phase';
        phaseDiv.dataset.phaseId = phase.id;
        phaseDiv.dataset.priority = phase.priority;
        
        const completedTasks = phase.tasks.filter(t => t.status === 'done').length;
        const progressPercent = phase.tasks.length > 0 ? Math.round((completedTasks / phase.tasks.length) * 100) : 0;
        
        phaseDiv.innerHTML = `
            <div class="phase-header" onclick="togglePhase(${phase.id})">
                <div class="phase-title">
                    <span class="toggle-icon">▼</span>
                    <h2>Phase ${phase.id}: ${phase.name}</h2>
                    <span class="priority-badge priority-${phase.priority}">${phase.priority.toUpperCase()}</span>
                </div>
                <div class="phase-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-text">${completedTasks}/${phase.tasks.length}</div>
                </div>
            </div>
            <div class="phase-content">
                <table class="tasks-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Task</th>
                            <th>Description</th>
                            <th>Effort</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${phase.tasks.map(task => this.createTaskRow(task)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        return phaseDiv;
    }

    createTaskRow(task) {
        return `
            <tr data-task-id="${task.id}">
                <td><span class="task-id">${task.id}</span></td>
                <td>${task.name}</td>
                <td><span class="task-description">${task.description}</span></td>
                <td><span class="effort-badge">${task.effort}</span></td>
                <td>
                    <select class="status-select status-${task.status}" 
                            onchange="updateTaskStatus('${task.id}', this.value)">
                        <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
                        <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
                        <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                    </select>
                </td>
            </tr>
        `;
    }

    updateTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = newStatus;
            
            // Update the select element's class immediately
            const select = document.querySelector(`tr[data-task-id="${taskId}"] .status-select`);
            if (select) {
                select.className = `status-select status-${newStatus}`;
            }
            
            // Save and update stats
            this.saveProgress();
            this.updateStats();
            this.updatePhaseProgress(task.phaseId);
        }
    }

    updatePhaseProgress(phaseId) {
        const phase = this.phases.find(p => p.id === phaseId);
        if (!phase) return;
        
        const completedTasks = phase.tasks.filter(t => t.status === 'done').length;
        const progressPercent = phase.tasks.length > 0 ? Math.round((completedTasks / phase.tasks.length) * 100) : 0;
        
        const phaseElement = document.querySelector(`.phase[data-phase-id="${phaseId}"]`);
        if (phaseElement) {
            const progressFill = phaseElement.querySelector('.progress-fill');
            const progressText = phaseElement.querySelector('.progress-text');
            
            if (progressFill) progressFill.style.width = progressPercent + '%';
            if (progressText) progressText.textContent = `${completedTasks}/${phase.tasks.length}`;
        }
    }

    applyFilters() {
        const phaseFilter = document.getElementById('phaseFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const priorityFilter = document.getElementById('priorityFilter').value;
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        
        // Filter phases
        document.querySelectorAll('.phase').forEach(phaseElement => {
            const phaseId = phaseElement.dataset.phaseId;
            const priority = phaseElement.dataset.priority;
            
            let showPhase = true;
            
            if (phaseFilter !== 'all' && phaseId !== phaseFilter) {
                showPhase = false;
            }
            
            if (priorityFilter !== 'all' && priority !== priorityFilter) {
                showPhase = false;
            }
            
            phaseElement.style.display = showPhase ? 'block' : 'none';
            
            // Filter tasks within visible phases
            if (showPhase) {
                const rows = phaseElement.querySelectorAll('tbody tr');
                let visibleTasks = 0;
                
                rows.forEach(row => {
                    const taskId = row.dataset.taskId;
                    const task = this.tasks.find(t => t.id === taskId);
                    
                    if (!task) return;
                    
                    let showTask = true;
                    
                    if (statusFilter !== 'all' && task.status !== statusFilter) {
                        showTask = false;
                    }
                    
                    if (searchTerm && !this.taskMatchesSearch(task, searchTerm)) {
                        showTask = false;
                    }
                    
                    row.style.display = showTask ? '' : 'none';
                    if (showTask) visibleTasks++;
                });
                
                // Hide phase if no tasks are visible
                if (visibleTasks === 0 && (statusFilter !== 'all' || searchTerm)) {
                    phaseElement.style.display = 'none';
                }
            }
        });
    }

    taskMatchesSearch(task, searchTerm) {
        return task.id.toLowerCase().includes(searchTerm) ||
               task.name.toLowerCase().includes(searchTerm) ||
               task.description.toLowerCase().includes(searchTerm);
    }

    exportToMarkdown() {
        let markdown = '# Day Dream Dictionary - Development Tasks\n\n';
        markdown += `Generated: ${new Date().toISOString()}\n\n`;
        markdown += '## Summary\n';
        markdown += `- Total Phases: ${this.phases.length}\n`;
        markdown += `- Total Tasks: ${this.tasks.length}\n`;
        
        const completedTasks = this.tasks.filter(t => t.status === 'done').length;
        markdown += `- Completed Tasks: ${completedTasks}\n`;
        markdown += `- Progress: ${Math.round((completedTasks / this.tasks.length) * 100)}%\n\n`;
        
        markdown += '## Task Breakdown\n\n';
        
        this.phases.forEach(phase => {
            markdown += `### Phase ${phase.id}: ${phase.name}\n`;
            markdown += `Priority: ${phase.priority.charAt(0).toUpperCase() + phase.priority.slice(1)}\n\n`;
            markdown += '| ID | Task | Description | Effort | Status |\n';
            markdown += '|----|------|-------------|--------|--------|\n';
            
            phase.tasks.forEach(task => {
                markdown += `| ${task.id} | ${task.name} | ${task.description} | ${task.effort} | ${task.status} |\n`;
            });
            
            markdown += '\n';
        });
        
        this.downloadFile('tasks-export.md', markdown, 'text/markdown');
    }

    exportToJSON() {
        const exportData = {
            generated: new Date().toISOString(),
            summary: {
                totalPhases: this.phases.length,
                totalTasks: this.tasks.length,
                completedTasks: this.tasks.filter(t => t.status === 'done').length,
                inProgressTasks: this.tasks.filter(t => t.status === 'in-progress').length,
                todoTasks: this.tasks.filter(t => t.status === 'todo').length,
                blockedTasks: this.tasks.filter(t => t.status === 'blocked').length
            },
            phases: this.phases.map(phase => ({
                id: phase.id,
                name: phase.name,
                priority: phase.priority,
                tasks: phase.tasks
            }))
        };
        
        const json = JSON.stringify(exportData, null, 2);
        this.downloadFile('tasks-export.json', json, 'application/json');
    }

    downloadFile(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`Exported to ${filename}`);
    }

    resetAllTasks() {
        if (confirm('Are you sure you want to reset all task statuses to "todo"? This will also clear saved data.')) {
            this.tasks.forEach(task => {
                task.status = 'todo';
            });
            localStorage.removeItem('taskProgress');
            localStorage.removeItem('tasksMarkdown');
            this.render();
            this.showNotification('All tasks have been reset');
        }
    }

    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Global functions for event handlers
let taskManager;

function togglePhase(phaseId) {
    const phaseElement = document.querySelector(`.phase[data-phase-id="${phaseId}"]`);
    if (phaseElement) {
        phaseElement.classList.toggle('collapsed');
    }
}

function expandAll() {
    document.querySelectorAll('.phase').forEach(phase => {
        phase.classList.remove('collapsed');
    });
}

function collapseAll() {
    document.querySelectorAll('.phase').forEach(phase => {
        phase.classList.add('collapsed');
    });
}

function updateTaskStatus(taskId, newStatus) {
    if (taskManager) {
        taskManager.updateTaskStatus(taskId, newStatus);
    }
}

function saveProgress() {
    if (taskManager) {
        taskManager.saveProgress();
    }
}

function exportToMarkdown() {
    if (taskManager) {
        taskManager.exportToMarkdown();
    }
}

function exportToJSON() {
    if (taskManager) {
        taskManager.exportToJSON();
    }
}

function resetAllTasks() {
    if (taskManager) {
        taskManager.resetAllTasks();
    }
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize the task manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    taskManager = new TaskManager();
});