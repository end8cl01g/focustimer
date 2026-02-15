const webApp = window.Telegram.WebApp;
webApp.expand();

// State
let tasks = [];
let timers = {};
let activeTaskId = null;
let subtasks = JSON.parse(localStorage.getItem('focus_timer_subtasks') || '{}');
let ticker = null;

// DOM
const timerDisplay = document.getElementById('timer-display');
const activeTitle = document.getElementById('active-title');
const activeSchedule = document.getElementById('active-schedule');
const btnToggle = document.getElementById('btn-toggle');
const listContainer = document.getElementById('list-container');
const ringProgress = document.getElementById('ring-progress');
const modalOverlay = document.getElementById('modal-overlay');
const subtasksSection = document.getElementById('subtasks-section');
const subtaskListEl = document.getElementById('subtask-list');
const subtaskInput = document.getElementById('subtask-input');

const CIRCUMFERENCE = 2 * Math.PI * 90;
ringProgress.style.strokeDasharray = CIRCUMFERENCE;

async function init() {
    try {
        // Show loading if app not visible
        if (!document.getElementById('app').classList.contains('visible')) {
            document.getElementById('loading').style.display = 'flex';
        }

        const [tasksRes, stateRes] = await Promise.all([
            fetch('/api/tasks'),
            fetch('/api/timer-state')
        ]);

        if (!tasksRes.ok || !stateRes.ok) throw new Error('Failed to load data');

        tasks = await tasksRes.json();
        // Sort tasks by start time
        tasks.sort((a, b) => new Date(a.start) - new Date(b.start));

        const state = await stateRes.json();
        activeTaskId = state.activeTaskId;
        timers = state.timers || {};

        // Initialize timers for any new tasks
        tasks.forEach(t => {
            if (!timers[t.id]) {
                timers[t.id] = { seconds: 0, isRunning: false, autoStarted: false };
            }
        });

        renderUI();
        startTicker();

        // Reveal app
        document.getElementById('loading').style.display = 'none';
        const app = document.getElementById('app');
        app.style.display = 'flex';
        app.classList.add('visible');

    } catch (e) {
        console.error('Init error:', e);
        alert('Error: ' + e.message);
    }
}

function renderUI() {
    if (!activeTaskId && tasks.length > 0) {
        // Try to find a task that is currently happening or upcoming
        const now = new Date();
        const currentTask = tasks.find(t => new Date(t.start) <= now && new Date(t.end) > now);
        const upcomingTask = tasks.find(t => new Date(t.start) > now);
        activeTaskId = (currentTask || upcomingTask || tasks[0]).id;
    }

    if (!activeTaskId || tasks.length === 0) {
        activeTitle.innerText = "No Tasks Today";
        activeSchedule.innerText = "Click + to book a session";
        timerDisplay.innerText = "00:00";
        btnToggle.style.display = 'none';
        subtasksSection.style.display = 'none';
        updateRing(null);
    } else {
        const task = tasks.find(t => t.id === activeTaskId);
        if (!task) {
            activeTaskId = tasks[0].id;
            renderUI();
            return;
        }

        const timer = timers[activeTaskId];
        const isExpired = new Date(task.end) < new Date();

        activeTitle.innerText = task.title;
        activeSchedule.innerText = `${formatSchedule(task.start)} - ${formatSchedule(task.end)}`;
        timerDisplay.innerText = formatTime(timer.seconds);
        btnToggle.style.display = 'block';

        if (isExpired) {
            btnToggle.innerText = "SESSION OVER";
            btnToggle.classList.remove('active');
            btnToggle.disabled = true;
            btnToggle.style.opacity = '0.5';
        } else if (timer.isRunning) {
            btnToggle.innerText = "PAUSE";
            btnToggle.classList.add('active');
            btnToggle.disabled = false;
            btnToggle.style.opacity = '1';
        } else {
            btnToggle.innerText = "START FOCUS";
            btnToggle.classList.remove('active');
            btnToggle.disabled = false;
            btnToggle.style.opacity = '1';
        }

        renderSubtasks(activeTaskId);
        updateRing(task);
    }

    // Render Task List
    listContainer.innerHTML = tasks.length === 0
        ? '<div class="empty-state">No scheduled tasks today.</div>'
        : tasks.map(t => `
            <div class="list-item ${t.id === activeTaskId ? 'selected' : ''}">
                <div class="item-content-wrapper" onclick="setActiveTask('${t.id}')">
                    <div class="item-title">${t.title}</div>
                    <div class="item-time">${formatSchedule(t.start)}</div>
                </div>
                <button class="btn-delete-event" onclick="deleteEvent(event, '${t.id}')">×</button>
            </div>
        `).join('');
}

function setActiveTask(id) {
    if (activeTaskId === id) return;
    activeTaskId = id;
    if (webApp.HapticFeedback) webApp.HapticFeedback.selectionChanged();
    renderUI();
}

function formatSchedule(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function toggleTimer(forceStart = false) {
    if (!activeTaskId) return;
    const timer = timers[activeTaskId];

    if (forceStart) timer.isRunning = true;
    else timer.isRunning = !timer.isRunning;

    if (webApp.HapticFeedback) webApp.HapticFeedback.impactOccurred('medium');

    renderUI();
    saveTimerState();
}

async function saveTimerState() {
    try {
        await fetch('/api/timer-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activeTaskId, timers })
        });
    } catch (e) { console.error('Save state error:', e); }
}

async function deleteEvent(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;
    try {
        const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.details || data.error || 'Delete failed');
        }
        if (webApp.HapticFeedback) webApp.HapticFeedback.notificationOccurred('success');

        // Remove from local state
        tasks = tasks.filter(t => t.id !== id);
        if (activeTaskId === id) activeTaskId = null;

        renderUI();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function updateRing(task) {
    if (!task) {
        ringProgress.style.strokeDashoffset = CIRCUMFERENCE;
        return;
    }
    const now = new Date();
    const start = new Date(task.start);
    const end = new Date(task.end);
    const total = end - start;
    const elapsed = now - start;
    let p = 1 - (elapsed / total);
    p = Math.max(0, Math.min(1, p));
    ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - p);
}

function startTicker() {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => {
        const now = new Date();

        // 1. Auto-Start Logic for events starting now
        tasks.forEach(task => {
            const tState = timers[task.id];
            const start = new Date(task.start);
            const diff = now - start;
            // If event started in last 2 seconds and not autostarted
            if (diff >= 0 && diff < 2000 && !tState.autoStarted) {
                tState.autoStarted = true;
                if (activeTaskId !== task.id) setActiveTask(task.id);
                toggleTimer(true);
            }
        });

        // 2. Increment active timer
        if (activeTaskId && timers[activeTaskId] && timers[activeTaskId].isRunning) {
            timers[activeTaskId].seconds++;
            timerDisplay.innerText = formatTime(timers[activeTaskId].seconds);
        }

        // 3. Update ring
        if (activeTaskId) {
            const task = tasks.find(t => t.id === activeTaskId);
            if (task) updateRing(task);
        }

    }, 1000);

    // Persist state periodically
    setInterval(saveTimerState, 15000);
}

// --- Modal Logic ---
function showModal() {
    const now = new Date();
    const titleInput = document.getElementById('input-title');
    titleInput.value = '';

    // Default: Next full hour
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    if (now.getMinutes() > 0) start.setHours(start.getHours() + 1);

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    document.getElementById('input-start').value = toLocalISO(start);
    document.getElementById('input-end').value = toLocalISO(end);
    modalOverlay.classList.add('visible');
}

function hideModal() { modalOverlay.classList.remove('visible'); }

function toLocalISO(date) {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
    return localISOTime;
}

async function createEvent() {
    try {
        const title = document.getElementById('input-title').value;
        const start = document.getElementById('input-start').value;
        const end = document.getElementById('input-end').value;

        if (!title || !start || !end) { alert('Missing fields'); return; }

        const btn = document.getElementById('btn-book');
        const originalText = btn.innerText;
        btn.innerText = 'Booking...';
        btn.disabled = true;

        const res = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                start: new Date(start).toISOString(),
                end: new Date(end).toISOString()
            })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.details || data.error || 'Booking failed');
        }

        if (webApp.HapticFeedback) webApp.HapticFeedback.notificationOccurred('success');
        hideModal();
        await init(); // Reload all
    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        const btn = document.getElementById('btn-book');
        btn.innerText = 'Book';
        btn.disabled = false;
    }
}

document.getElementById('btn-book').addEventListener('click', createEvent);
btnToggle.addEventListener('click', () => toggleTimer());

// --- Subtasks Logic ---
function renderSubtasks(taskId) {
    if (!taskId) {
        subtasksSection.style.display = 'none';
        return;
    }
    subtasksSection.style.display = 'flex';
    const list = subtasks[taskId] || [];

    subtaskListEl.innerHTML = list.map(item => `
        <li class="subtask-item ${item.completed ? 'completed' : ''}">
            <input type="checkbox" class="subtask-checkbox"
                onclick="toggleSubtask('${item.id}')" ${item.completed ? 'checked' : ''}>
            <span class="subtask-text" onclick="toggleSubtask('${item.id}')">${item.text}</span>
            <span class="subtask-delete" onclick="deleteSubtask('${item.id}')">×</span>
        </li>
    `).join('');
}

function addSubtask() {
    const text = subtaskInput.value.trim();
    if (!text || !activeTaskId) return;
    if (!subtasks[activeTaskId]) subtasks[activeTaskId] = [];
    subtasks[activeTaskId].push({ id: Date.now().toString(), text, completed: false });
    saveSubtasks();
    subtaskInput.value = '';
    renderSubtasks(activeTaskId);
}

function handleSubtaskInput(e) { if (e.key === 'Enter') addSubtask(); }

function toggleSubtask(id) {
    if (!activeTaskId || !subtasks[activeTaskId]) return;
    const item = subtasks[activeTaskId].find(i => i.id === id);
    if (item) {
        item.completed = !item.completed;
        saveSubtasks();
        renderSubtasks(activeTaskId);
        if (webApp.HapticFeedback) webApp.HapticFeedback.selectionChanged();
    }
}

function deleteSubtask(id) {
    if (!activeTaskId || !subtasks[activeTaskId]) return;
    subtasks[activeTaskId] = subtasks[activeTaskId].filter(i => i.id !== id);
    saveSubtasks();
    renderSubtasks(activeTaskId);
}

function saveSubtasks() { localStorage.setItem('focus_timer_subtasks', JSON.stringify(subtasks)); }

init();
