        const webApp = window.Telegram.WebApp;
        webApp.expand();

        // Constants
        const CIRCUMFERENCE = 2 * Math.PI * 90;

        // State
        let tasks = [];
        let timers = {};
        let activeTaskId = null;
        let ticker = null;
        let subtasks = JSON.parse(localStorage.getItem('focus_timer_subtasks') || '{}');

        // DOM Elements
        const timerDisplay = document.getElementById('timer-display');
        const ringProgress = document.getElementById('ring-progress');
        const activeTitle = document.getElementById('active-title');
        const activeSchedule = document.getElementById('active-schedule');
        const btnToggle = document.getElementById('btn-toggle');
        const listContainer = document.getElementById('list-container');
        const subtasksSection = document.getElementById('subtasks-section');
        const subtaskListEl = document.getElementById('subtask-list');
        const subtaskInput = document.getElementById('subtask-input');
        const modalOverlay = document.getElementById('modal-overlay');
        const actionSheet = document.getElementById('action-sheet');
        const loading = document.getElementById('loading');

        // Initialization
        ringProgress.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;

        async function init() {
            try {
                // Fetch Timer State
                const stateRes = await fetch('/api/timer-state');
                const state = await stateRes.json();
                activeTaskId = state.activeTaskId;
                timers = state.timers;

                // Fetch Tasks
                const taskRes = await fetch('/api/tasks');
                tasks = await taskRes.json();

                // If active task is missing (maybe deleted), reset
                if (activeTaskId && !tasks.find(t => t.id === activeTaskId)) {
                    activeTaskId = null;
                }

                // Ensure all tasks have a timer entry
                tasks.forEach(t => {
                    if (!timers[t.id]) {
                        timers[t.id] = { seconds: 0, isRunning: false };
                    }
                });

                renderUI();
                startTicker();
                loading.style.display = 'none';
                document.getElementById('app').style.display = 'flex';
                setTimeout(() => document.getElementById('app').classList.add('visible'), 10);
            } catch (e) {
                console.error('Init error:', e);
                alert('Failed to load data. Please refresh.');
            }
        }

        async function saveTimerState() {
            if (!activeTaskId) return;
            try {
                await fetch('/api/timer-state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activeTaskId, timers })
                });
            } catch (e) { console.error('Save error:', e); }
        }

        function formatTime(s) {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        }

        function formatSchedule(dateStr) {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        function setActiveTask(id) {
            if (activeTaskId === id) return;
            if (activeTaskId && timers[activeTaskId].isRunning) {
                if (!confirm('Switch task? Current timer will stop.')) return;
                timers[activeTaskId].isRunning = false;
            }
            activeTaskId = id;
            saveTimerState();
            renderUI();
        }

        function toggleTimer(auto = false) {
            if (!activeTaskId) return;
            const tState = timers[activeTaskId];
            tState.isRunning = !tState.isRunning;

            if (tState.isRunning) {
                if (webApp.HapticFeedback) webApp.HapticFeedback.impactOccurred('medium');
            }

            if (!auto) saveTimerState();
            renderUI();
        }

        function renewTask() {
            showActionSheet();
        }

        function showActionSheet() { actionSheet.classList.add('visible'); }
        function hideActionSheet() { actionSheet.classList.remove('visible'); }

        function executeRenewNow() {
            const task = tasks.find(t => t.id === activeTaskId);
            const now = new Date();
            const end = new Date(now.getTime() + 60 * 60 * 1000);

            // Re-book for 1 hour from now
            document.getElementById('input-title').value = task.title;
            document.getElementById('input-start').value = toLocalISO(now);
            document.getElementById('input-end').value = toLocalISO(end);

            hideActionSheet();
            createEvent();
        }

        function executeRenewCustom() {
            hideActionSheet();
            if (!activeTaskId) return;
            const oldTask = tasks.find(t => t.id === activeTaskId);
            if (!oldTask) return;

            showModal({ title: oldTask.title });
        }

        function renderUI() {
            if (!activeTaskId && tasks.length > 0) {
                 // Auto select first if none
                 activeTaskId = tasks[0].id;
            }

            if (!activeTaskId) {
                activeTitle.innerText = "No Tasks Today";
                activeSchedule.innerText = "Click + to book a session";
                timerDisplay.innerText = "00:00";
                btnToggle.style.display = 'none';
                subtasksSection.style.display = 'none';
            } else {
                const task = tasks.find(t => t.id === activeTaskId);
                const timer = timers[activeTaskId];
                const isExpired = new Date(task.end) < new Date();

                activeTitle.innerText = task.title;
                activeSchedule.innerText = `${formatSchedule(task.start)} - ${formatSchedule(task.end)}`;
                timerDisplay.innerText = formatTime(timer.seconds);
                btnToggle.style.display = 'block';

                // Button Logic
                btnToggle.onclick = isExpired ? renewTask : () => toggleTimer();
                if (isExpired) {
                    btnToggle.innerText = "RENEW SESSION";
                    btnToggle.classList.remove('active');
                    btnToggle.style.background = 'var(--text-secondary)';
                } else if (timer.isRunning) {
                    btnToggle.innerText = "PAUSE";
                    btnToggle.classList.add('active');
                    btnToggle.style.background = '';
                } else {
                    btnToggle.innerText = "START FOCUS";
                    btnToggle.classList.remove('active');
                    btnToggle.style.background = '';
                }

                renderSubtasks(activeTaskId);
            }

            // Render Task List
            listContainer.innerHTML = tasks.map(t => `
                <div class="list-item ${t.id === activeTaskId ? 'selected' : ''}">
                    <div class="item-content-wrapper" onclick="setActiveTask('${t.id}')">
                        <div class="item-title">${t.title}</div>
                        <div class="item-time">${formatSchedule(t.start)}</div>
                    </div>
                    <button class="btn-delete-event" onclick="deleteEvent(event, '${t.id}')">×</button>
                </div>
            `).join('');

            if (activeTaskId) updateRing(tasks.find(t => t.id === activeTaskId));
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
                await init();
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

                // 1. Auto-Start Logic
                tasks.forEach(task => {
                    const tState = timers[task.id];
                    const start = new Date(task.start);
                    const diff = now - start;
                    if (diff >= 0 && diff < 2000 && !tState.autoStarted) {
                        tState.autoStarted = true;
                        if (activeTaskId !== task.id) setActiveTask(task.id);
                        toggleTimer(true);
                    }
                });

                // 2. Increment active
                if (activeTaskId && timers[activeTaskId].isRunning) {
                    timers[activeTaskId].seconds++;
                    timerDisplay.innerText = formatTime(timers[activeTaskId].seconds);
                }

                // 3. Update ring
                if (activeTaskId) updateRing(tasks.find(t => t.id === activeTaskId));

            }, 1000);

            setInterval(saveTimerState, 10000);
        }

        // --- Modal Logic ---
        function showModal(overrides = {}) {
            const now = new Date();
            const titleInput = document.getElementById('input-title');
            titleInput.value = overrides.title || '';
            document.getElementById('modal-title').innerText = overrides.title ? "Renew Session" : "New Focus Session";

            let start, end;
            if (overrides.start) {
                start = new Date(overrides.start);
            } else {
                start = new Date(now);
                start.setMinutes(0, 0, 0);
                start.setHours(start.getHours() + 1);
            }

            if (overrides.end) {
                end = new Date(overrides.end);
            } else {
                end = new Date(start);
                end.setHours(end.getHours() + 1);
            }

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
                await init();
                hideModal();
            } catch (e) {
                alert('Error: ' + e.message);
            } finally {
                const btn = document.getElementById('btn-book');
                btn.innerText = 'Book';
                btn.disabled = false;
            }
        }

        document.getElementById('btn-book').addEventListener('click', createEvent);

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
                    <span class="subtask-text">${item.text}</span>
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
