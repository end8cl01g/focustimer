
        const webApp = window.Telegram.WebApp;
        webApp.ready();
        webApp.expand();

        const R = 90;
        const CIRCUMFERENCE = 2 * Math.PI * R;

        let tasks = [];
        let activeTaskId = null;
        let timers = {};
        let ticker = null;

        const appEl = document.getElementById('app');
        const loadingEl = document.getElementById('loading');
        const ringProgress = document.getElementById('ring-progress');
        const timerDisplay = document.getElementById('timer-display');
        const activeTitle = document.getElementById('active-title');
        const activeSchedule = document.getElementById('active-schedule');
        const btnToggle = document.getElementById('btn-toggle');
        const listContainer = document.getElementById('list-container');
        const modalOverlay = document.getElementById('modal-overlay');

        // State Persistence
        const TODAY = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        let completedState = JSON.parse(localStorage.getItem('focus_completed_tasks')) || { date: TODAY, ids: [] };

        // Reset if new day
        if (completedState.date !== TODAY) {
            completedState = { date: TODAY, ids: [] };
            localStorage.setItem('focus_completed_tasks', JSON.stringify(completedState));
        }

        // Subtasks State
        let subtasks = JSON.parse(localStorage.getItem('focus_timer_subtasks')) || {}; // { taskId: [ {id, text, completed} ] }
        const subtasksSection = document.getElementById('subtasks-section');
        const subtaskListEl = document.getElementById('subtask-list');
        const subtaskInput = document.getElementById('subtask-input');

        // Initial
        ringProgress.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
        ringProgress.style.strokeDashoffset = 0;

        // --- Helpers ---
        function nowTaipei() {
            return new Date();
        }

        // --- Server-side timer state ---
        let _saveTimeout = null;
        function saveTimerState() {
            // Debounce: save at most once per 2s
            if (_saveTimeout) return;
            _saveTimeout = setTimeout(() => { _saveTimeout = null; }, 2000);
            fetch('/api/timer-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activeTaskId, timers })
            }).catch(e => console.error('Save state error:', e));
        }

        async function loadTimerState() {
            try {
                const res = await fetch('/api/timer-state');
                if (!res.ok) return;
                const state = await res.json();
                if (state.activeTaskId) activeTaskId = state.activeTaskId;
                if (state.timers) {
                    // Merge: server state wins for existing timers
                    for (const id of Object.keys(state.timers)) {
                        timers[id] = state.timers[id];
                    }
                }
            } catch (e) { console.error('Load state error:', e); }
        }

        async function init() {
            try {
                const res = await fetch('/api/tasks');
                if (!res.ok) throw new Error('API Failed');
                const allTasks = await res.json();

                // Filter out completed tasks for today
                tasks = allTasks.filter(t => !completedState.ids.includes(t.id));

                // Initialize timer entries for new tasks
                tasks.forEach(t => {
                    if (!timers[t.id]) timers[t.id] = { seconds: 0, isRunning: false, autoStarted: false };
                });

                // Load server-side state (overwrites in-memory with persisted values)
                await loadTimerState();

                // Validate activeTaskId still exists in today's tasks
                if (activeTaskId && !tasks.find(t => t.id === activeTaskId)) {
                    activeTaskId = null;
                }

                if (!activeTaskId) decideActiveTask();
                renderUI();

                loadingEl.style.opacity = 0;
                setTimeout(() => { loadingEl.style.display = 'none'; appEl.classList.add('visible'); }, 500);

                startTicker();
            } catch (e) {
                console.error(e);
                loadingEl.innerHTML = `<p style="color:var(--danger-color)">Error: ${e.message}</p>`;
            }
        }

        function decideActiveTask() {
            if (tasks.length === 0) return;
            const now = new Date();
            // 1. Ongoing
            const current = tasks.find(t => new Date(t.start) <= now && new Date(t.end) > now);
            if (current) { activeTaskId = current.id; return; }
            // 2. Next
            const next = tasks.find(t => new Date(t.start) > now);
            if (next) { activeTaskId = next.id; return; }
            // 3. Fallback
            activeTaskId = tasks[0].id;
        }

        function setActiveTask(id) {
            if (activeTaskId && timers[activeTaskId].isRunning) {
                timers[activeTaskId].isRunning = false; // Pause old
            }
            activeTaskId = id;
            saveTimerState();
            renderUI();
        }

        function formatTime(s) {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            const h = Math.floor(m / 60);
            if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        }

        function formatSchedule(iso) {
            return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        function toggleTimer(forceStart = false) {
            if (!activeTaskId) return;
            const t = timers[activeTaskId];
            if (forceStart) {
                if (!t.isRunning) {
                    t.isRunning = true;
                    saveTimerState();
                    renderUI();
                    if (webApp.HapticFeedback) webApp.HapticFeedback.notificationOccurred('success');
                }
            } else {
                t.isRunning = !t.isRunning;
                saveTimerState();
                renderUI();
                if (webApp.HapticFeedback) webApp.HapticFeedback.impactOccurred('medium');
            }
        }

        function completeTask() {
            if (!activeTaskId) return;
            const task = tasks.find(t => t.id === activeTaskId);
            const duration = timers[activeTaskId].seconds;
            if (webApp.HapticFeedback) webApp.HapticFeedback.notificationOccurred('success');

            // Mark locally as completed
            completedState.ids.push(activeTaskId);
            localStorage.setItem('focus_completed_tasks', JSON.stringify(completedState));

            webApp.sendData(JSON.stringify({
                action: 'complete_task', taskId: task.id, title: task.title, duration: duration
            }));

            // Refresh to hide
            init();
        }

        function renewTask() {
            if (!activeTaskId) return;
            const sheet = document.getElementById('action-sheet-overlay');
            sheet.classList.add('visible');
        }

        function hideActionSheet() {
            document.getElementById('action-sheet-overlay').classList.remove('visible');
        }

        async function executeRenewNow() {
            hideActionSheet();
            if (!activeTaskId) return;
            const oldTask = tasks.find(t => t.id === activeTaskId);
            if (!oldTask) return;

            const btn = document.getElementById('btn-toggle');
            const originalText = btn.innerText;
            btn.innerText = "RENEWING...";

            const now = new Date();
            const start = now.toISOString();
            const endObj = new Date(now.getTime() + 30 * 60000);
            const end = endObj.toISOString();

            try {
                const res = await fetch('/api/events', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: oldTask.title, start, end })
                });
                if (!res.ok) throw new Error('Renew failed');
                await init();
            } catch (e) {
                alert(e.message);
                renderUI();
            }
        }

        function executeRenewCustom() {
            hideActionSheet();
            if (!activeTaskId) return;
            const oldTask = tasks.find(t => t.id === activeTaskId);
            if (!oldTask) return;

            showModal({ title: oldTask.title });
        }

        function renderUI() {
            if (!activeTaskId) {
                activeTitle.innerText = "No Tasks"; activeSchedule.innerText = "";
                return;
            }
            const task = tasks.find(t => t.id === activeTaskId);
            const timer = timers[activeTaskId];

            const isExpired = new Date(task.end) < new Date();

            activeTitle.innerText = task.title;
            activeSchedule.innerText = `${formatSchedule(task.start)} - ${formatSchedule(task.end)}`;
            timerDisplay.innerText = formatTime(timer.seconds);

            // Button Logic
            btnToggle.onclick = isExpired ? renewTask : () => toggleTimer();
            if (isExpired) {
                btnToggle.innerText = "RENEW SESSION";
                btnToggle.classList.remove('active');
                btnToggle.style.background = 'var(--text-secondary)'; // Visual cue
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

            const others = tasks.filter(t => t.id !== activeTaskId);
            listContainer.innerHTML = others.map(t => `
                <div class="list-item" onclick="setActiveTask('${t.id}')">
                    <div class="item-title">${t.title}</div>
                    <div class="item-time">${formatSchedule(t.start)}</div>
                </div>
            `).join('');

            updateRing(task);
        }

        function updateRing(task) {
            if (!task) return;
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
                    // If time reached start, and we haven't auto-started yet
                    // Tolerance: within last 2 seconds to avoid old tasks starting
                    const start = new Date(task.start);
                    const diff = now - start;
                    if (diff >= 0 && diff < 2000 && !tState.autoStarted) {
                        console.log('Auto-starting task:', task.title);
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

            // Periodic server save every 10 seconds
            setInterval(saveTimerState, 10000);
        }

        // --- Modal Logic ---
        function showModal(overrides = {}) {
            const now = new Date();

            // Set Title
            const titleInput = document.getElementById('input-title');
            titleInput.value = overrides.title || '';
            document.getElementById('modal-title').innerText = overrides.title ? "Renew Session" : "New Focus Session";

            // Default Schedule: Next hour or Overrides
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
            // Debug alert to confirm function call
            // alert('Debug: Create Event Triggered');

            try {
                const titleInput = document.getElementById('input-title');
                const startInput = document.getElementById('input-start');
                const endInput = document.getElementById('input-end');

                const title = titleInput.value;
                const start = startInput.value;
                const end = endInput.value;

                if (!title) { alert('Missing Title'); return; }
                if (!start) { alert('Missing Start Time'); return; }
                if (!end) { alert('Missing End Time'); return; }

                const btn = document.getElementById('btn-book');
                const originalText = btn.innerText;
                btn.innerText = 'Boo...';
                btn.disabled = true;

                // Validate dates
                const startDate = new Date(start);
                const endDate = new Date(end);

                if (isNaN(startDate.getTime())) throw new Error('Invalid Start Date: ' + start);
                if (isNaN(endDate.getTime())) throw new Error('Invalid End Date: ' + end);

                const res = await fetch('/api/events', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title,
                        start: startDate.toISOString(),
                        end: endDate.toISOString()
                    })
                });

                if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.details || errorData.error || 'Booking failed'); }

                // Refresh list
                await init();
                hideModal();
                btn.innerText = 'Book';
                btn.disabled = false;
            } catch (e) {
                alert('Error: ' + e.message);
                const btn = document.getElementById('btn-book');
                if (btn) {
                    btn.innerText = 'Book';
                    btn.disabled = false;
                }
                console.error(e);
            }
        }

        // Bind events
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

            subtasks[activeTaskId].push({
                id: Date.now().toString(),
                text: text,
                completed: false
            });

            saveSubtasks();
            subtaskInput.value = '';
            renderSubtasks(activeTaskId);
        }

        function handleSubtaskInput(e) {
            if (e.key === 'Enter') addSubtask();
        }

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

        function saveSubtasks() {
            localStorage.setItem('focus_timer_subtasks', JSON.stringify(subtasks));
        }

        init();
