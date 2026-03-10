let peer = null;
let connection = null;

// App State
let tasks = [];
let announcements = [];

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const targetIdInput = document.getElementById('target-id');
const statusMsg = document.getElementById('connection-status');
const connectPanel = document.getElementById('connect-panel');
const controlPanel = document.getElementById('control-panel');

// Tab System Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Announcement Elements
const announcementEditor = document.getElementById('announcement-editor');
const alignSelect = document.getElementById('align-select');
const fontSelect = document.getElementById('font-select');
const sizeSlider = document.getElementById('size-slider');
const sendAnnouncementsBtn = document.getElementById('send-announcements');
const addAnnouncementBtn = document.getElementById('add-announcement-btn');
const announcementList = document.getElementById('announcement-list');
const formatBtns = document.querySelectorAll('.format-btn');

// Task Elements
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');
const mobileTasksContainer = document.getElementById('mobile-tasks');
const syncTasksBtn = document.getElementById('sync-tasks-btn');

// Initialize Controller App
function initController() {
    // Check URL parameters for auto-connect (scanned from QR)
    const urlParams = new URLSearchParams(window.location.search);
    const idFromUrl = urlParams.get('id');
    if(idFromUrl) {
        targetIdInput.value = idFromUrl;
    }

    // Connect logic
    connectBtn.addEventListener('click', () => {
        const targetId = targetIdInput.value.trim().toUpperCase();
        if (!targetId) {
            statusMsg.innerText = "Por favor ingresa un ID válido.";
            statusMsg.style.color = "#ff3333";
            return;
        }

        connectToTV(targetId);
    });

    disconnectBtn.addEventListener('click', disconnect);

    // Tab Navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            
            // Add active to current
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.remove('hidden');
        });
    });

    // Content Sends
    sendAnnouncementsBtn.addEventListener('click', sendAnnouncements);
    addAnnouncementBtn.addEventListener('click', addAnnouncement);
    syncTasksBtn.addEventListener('click', sendTasks);

    // Rich text formatting actions
    formatBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            announcementEditor.focus();
            document.execCommand(btn.dataset.cmd, false, null);
        });
    });

    // Task Interactions
    addTaskBtn.addEventListener('click', addTask);
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    renderMobileTasks();
    renderAnnouncementQueue();
}

function connectToTV(tvId) {
    statusMsg.innerText = "Conectando...";
    statusMsg.style.color = "var(--neon-blue)";
    
    // Create new peer if not exists
    if (!peer) {
        peer = new Peer();
    }

    // Disconnect existing before making new
    if (connection) {
        connection.close();
    }

    peer.on('open', (id) => {
        // Now that we have our own logic ready, connect to TV
        connection = peer.connect(tvId);

        connection.on('open', () => {
            statusMsg.innerText = "¡Conectado!";
            statusMsg.style.color = "var(--neon-green)";

            connection.on('data', handleIncomingData);
            
            setTimeout(() => {
                connectPanel.classList.add('hidden');
                controlPanel.classList.remove('hidden');
            }, 500);
        });

        connection.on('close', () => {
            handleDisconnect();
        });

        connection.on('error', (err) => {
            console.error(err);
            statusMsg.innerText = "Error de conexión. Verifica el ID.";
            statusMsg.style.color = "#ff3333";
        });
    });

    peer.on('error', (err) => {
        console.error("PeerJS error:", err);
        statusMsg.innerText = "Error: " + err.type;
        statusMsg.style.color = "#ff3333";
    });
}

function handleIncomingData(data) {
    if (!data || !data.type) return;

    if (data.type === 'sync_state') {
        tasks = Array.isArray(data.tasks) ? data.tasks : [];
        announcements = Array.isArray(data.announcements) ? data.announcements : [];
        renderMobileTasks();
        renderAnnouncementQueue();
    }
}

function handleDisconnect() {
    connectPanel.classList.remove('hidden');
    controlPanel.classList.add('hidden');
    statusMsg.innerText = "Desconectado. Ingresa un ID.";
    statusMsg.style.color = "#aaa";
}

function disconnect() {
    if (connection) {
        connection.close();
    }
    handleDisconnect();
}

// ------ SENDING LOGIC ------

function sendData(data) {
    if (connection && connection.open) {
        connection.send(data);
    } else {
        alert("Sin conexión a la TV. Reconecta.");
    }
}

function sendAnnouncements() {
    sendData({
        type: 'announcements',
        announcements: announcements
    });
}

function sendTasks() {
    sendData({
        type: 'tasks',
        tasks: tasks
    });
}

// ------ ANNOUNCEMENTS LOGIC ------

function addAnnouncement() {
    const html = sanitizeRichHtml(announcementEditor.innerHTML);
    const plainText = stripHtml(html).trim();

    if (!plainText) return;

    announcements.push({
        id: Date.now().toString(),
        html: html,
        align: alignSelect.value,
        size: Number(sizeSlider.value),
        fontFamily: fontSelect.value
    });

    announcementEditor.innerHTML = '';
    renderAnnouncementQueue();
    sendAnnouncements();
}

function deleteAnnouncement(id) {
    announcements = announcements.filter((item) => item.id !== id);
    renderAnnouncementQueue();
    sendAnnouncements();
}

function renderAnnouncementQueue() {
    announcementList.innerHTML = '';

    if (announcements.length === 0) {
        announcementList.innerHTML = '<p style="color:#666;text-align:center;padding:8px;">No hay anuncios en cola.</p>';
        return;
    }

    announcements.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'announcement-item';

        const preview = document.createElement('div');
        preview.className = 'announcement-preview';
        preview.innerText = stripHtml(item.html).trim();

        const meta = document.createElement('div');
        meta.className = 'announcement-meta';
        meta.innerText = `#${index + 1} | ${item.fontFamily} | ${item.size}rem | ${item.align}`;

        const infoWrap = document.createElement('div');
        infoWrap.style.flex = '1';
        infoWrap.appendChild(preview);
        infoWrap.appendChild(meta);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'announcement-remove-btn';
        removeBtn.type = 'button';
        removeBtn.innerText = '✗';
        removeBtn.addEventListener('click', () => deleteAnnouncement(item.id));

        row.appendChild(infoWrap);
        row.appendChild(removeBtn);
        announcementList.appendChild(row);
    });
}

function sanitizeRichHtml(input) {
    const template = document.createElement('template');
    template.innerHTML = input || '';

    const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'SPAN']);

    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return;
        if (node.nodeType !== Node.ELEMENT_NODE) {
            node.remove();
            return;
        }

        if (!allowed.has(node.tagName)) {
            const parent = node.parentNode;
            while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
            return;
        }

        Array.from(node.attributes).forEach((attr) => node.removeAttribute(attr.name));
        Array.from(node.childNodes).forEach(cleanNode);
    }

    Array.from(template.content.childNodes).forEach(cleanNode);
    return template.innerHTML.trim();
}

function stripHtml(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';
    return temp.textContent || temp.innerText || '';
}

// ------ TASKS LOGIC ------

function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    tasks.push({
        id: Date.now().toString(),
        text: text,
        completed: false
    });

    newTaskInput.value = '';
    renderMobileTasks();
    sendTasks(); // Auto-sync
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        renderMobileTasks();
        sendTasks(); // Auto-sync
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    renderMobileTasks();
    sendTasks(); // Auto-sync
}

function renderMobileTasks() {
    mobileTasksContainer.innerHTML = '';
    
    if (tasks.length === 0) {
        mobileTasksContainer.innerHTML = '<p style="color: #666; text-align: center; margin-top: 20px;">No hay tareas. Agrégalas arriba.</p>';
        return;
    }

    tasks.forEach(task => {
        const item = document.createElement('div');
        item.className = 'mobile-task-item' + (task.completed ? ' completed' : '');
        
        item.innerHTML = `
            <span>${task.text}</span>
            <div class="task-actions">
                <button class="check-btn" onclick="toggleTask('${task.id}')">✓</button>
                <button class="del-btn" onclick="deleteTask('${task.id}')">✗</button>
            </div>
        `;
        
        mobileTasksContainer.appendChild(item);
    });
}

// Initialize on load
window.onload = initController;
