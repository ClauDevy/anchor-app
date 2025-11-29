// public/script.js

let client;
let localAudioTrack;
let localVideoTrack;
let appId = "";
let token = null;
let currentAgentId = null;
let currentMode = 'video';
let currentChannel = ""; 
let currentSessionId = ""; 
let videoLoadTimeout;

let callHistoryList = []; 
let textChatList = []; 
let streamBuffer = {};

// 1. Mute State Variable
let isMicMuted = false; 

const myUid = Math.floor(Math.random() * 100000);

// UI ELEMENTS
const statusBadge = document.getElementById("connection-status");
const statusDot = document.getElementById("connection-dot");
const callBtn = document.getElementById("call-btn");
const hangupBtn = document.getElementById("hangup-btn");
const spinner = document.getElementById("loading-spinner");
const placeholderMsg = document.getElementById("placeholder-msg");
const errorMsgDiv = document.getElementById("error-msg");
const remotePlayerWrapper = document.getElementById("remote-player-wrapper");
const aiPlaceholder = document.getElementById("ai-placeholder");
const aiVideoPlayer = document.getElementById("ai-video-player");
const phoneUi = document.getElementById("phone-ui");
const localPlayer = document.getElementById("local-player");

// Controls
const toggleMicBtn = document.getElementById("toggle-mic-btn");
const toggleCamBtn = document.getElementById("toggle-cam-btn");
const fullscreenBtn = document.getElementById("fullscreen-btn");
const toggleChatBtn = document.getElementById("toggle-chat-btn");

const chatInput = document.getElementById("chat-input");
const sendChatBtn = document.getElementById("send-chat-btn");
const videoInterface = document.getElementById("video-interface");
const chatInterface = document.getElementById("chat-interface");
const callHistoryBox = document.getElementById("call-history");
const textHistoryBox = document.getElementById("text-history");
const overlayChatBox = document.getElementById("overlay-chat-history");
const overlayChatContainer = document.getElementById("overlay-chat");

const audioResponseToggle = document.getElementById("audio-response-toggle");

// --- LANDING PAGE ELEMENTS ---
const landingContainer = document.getElementById("landing-container");
const appContainer = document.getElementById("app-container");
const screenLoading = document.getElementById("screen-loading");
const screenWelcome = document.getElementById("screen-welcome");
const screenSelection = document.getElementById("screen-selection");

function log(msg) {
    console.log(`[Anchor System] ${msg}`);
}

function cleanText(text) {
    if (!text) return "";
    return text.replace(/([.,;?!])(?=[a-zA-Z0-9])/g, "$1 ");
}

// --- LANDING PAGE LOGIC ---
document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        if(screenLoading && screenWelcome) {
            screenLoading.classList.add('d-none');
            screenWelcome.classList.remove('d-none');
            screenWelcome.classList.add('fade-in');
        }
    }, 2500);
});

window.showSelectionScreen = function() {
    screenWelcome.classList.add('d-none');
    screenSelection.classList.remove('d-none');
    screenSelection.classList.add('fade-in');
};

window.enterApp = function(mode) {
    landingContainer.style.opacity = '0';
    landingContainer.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        landingContainer.classList.add('d-none');
        appContainer.classList.remove('d-none');
        setMode(mode);
    }, 500);
};

// --- 2. FIXED MUTE TOGGLE LOGIC ---
toggleMicBtn.addEventListener("click", () => {
    // Toggle state immediately
    isMicMuted = !isMicMuted;

    // Update UI immediately
    if (isMicMuted) {
        toggleMicBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
        toggleMicBtn.style.background = '#ef4444'; 
        toggleMicBtn.style.color = 'white';
    } else {
        toggleMicBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        toggleMicBtn.style.background = 'rgba(255,255,255,0.15)'; 
        toggleMicBtn.style.color = 'white';
    }

    // Apply to actual track if it exists
    if (localAudioTrack) {
        localAudioTrack.setEnabled(!isMicMuted);
    }
});

toggleCamBtn.addEventListener("click", () => {
    if (localVideoTrack) {
        const isEnabled = localVideoTrack.isPlaying;
        localVideoTrack.setEnabled(!isEnabled);
        toggleCamBtn.innerHTML = isEnabled ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
        toggleCamBtn.style.color = isEnabled ? '#ff6b6b' : '#333';
    }
});

toggleChatBtn.addEventListener("click", () => {
    if (overlayChatContainer.classList.contains('d-none')) {
        overlayChatContainer.classList.remove('d-none');
        toggleChatBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        toggleChatBtn.title = "Hide Chat";
    } else {
        overlayChatContainer.classList.add('d-none');
        toggleChatBtn.innerHTML = '<i class="fas fa-eye"></i>';
        toggleChatBtn.title = "Show Chat";
    }
});

function toggleFullscreen() {
    const stage = document.getElementById("stage-container");
    
    if (!document.fullscreenElement) {
        stage.requestFullscreen().catch(err => log(`Error: ${err.message}`));
        
        overlayChatContainer.classList.remove('d-none');
        toggleChatBtn.classList.remove('d-none'); 
        toggleChatBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        
    } else {
        document.exitFullscreen();
        overlayChatContainer.classList.add('d-none');
        toggleChatBtn.classList.add('d-none'); 
        toggleChatBtn.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        overlayChatContainer.classList.add('d-none');
        toggleChatBtn.classList.add('d-none'); 
    }
});

function addToHistory(role, text, uniqueId = null, targetType = 'call') {
    if (!text || text.trim() === "") return;
    const displayText = cleanText(text);
    
    const targetBox = targetType === 'chat' ? textHistoryBox : callHistoryBox;
    const targetList = targetType === 'chat' ? textChatList : callHistoryList;
    const isAtBottom = (targetBox.scrollHeight - targetBox.scrollTop - targetBox.clientHeight) < 100;

    if (uniqueId) {
        const existingMsg = targetBox.querySelector(`#msg-${uniqueId}`);
        if (existingMsg) {
            existingMsg.innerHTML = displayText;
            if (isAtBottom) targetBox.scrollTop = targetBox.scrollHeight;
        } else {
            const div = document.createElement("div");
            div.className = "history-msg " + (role === "user" ? "history-user" : (role === "system" ? "sys-msg" : "history-ai"));
            div.id = `msg-${uniqueId}`;
            div.innerText = displayText;
            targetBox.appendChild(div);
            if (isAtBottom) targetBox.scrollTop = targetBox.scrollHeight;
        }
    } else {
        const div = document.createElement("div");
        div.className = "history-msg " + (role === "user" ? "history-user" : (role === "system" ? "sys-msg" : "history-ai"));
        div.innerText = displayText;
        targetBox.appendChild(div);
        targetBox.scrollTop = targetBox.scrollHeight;
    }

    if(targetType === 'call' && role !== 'system') {
        const overlayId = `overlay-${uniqueId}`;
        const existingOverlay = document.getElementById(overlayId);

        if (existingOverlay) {
            existingOverlay.innerHTML = `<strong>${role === 'user' ? 'You' : 'Anchor'}:</strong> ${displayText}`;
        } else {
            const overlayDiv = document.createElement("div");
            overlayDiv.className = "overlay-msg";
            overlayDiv.id = overlayId;
            overlayDiv.innerHTML = `<strong>${role === 'user' ? 'You' : 'Anchor'}:</strong> ${displayText}`;
            overlayChatBox.appendChild(overlayDiv);
        }
        overlayChatBox.scrollTop = overlayChatBox.scrollHeight;
        if (overlayChatBox.childElementCount > 50) overlayChatBox.removeChild(overlayChatBox.firstChild);
    }

    if (role !== "system") {
        targetList.push({ role: role === "user" ? "user" : "assistant", content: text });
    }
}

async function init() {
    try {
        const res = await fetch("/config");
        const data = await res.json();
        appId = data.appId;
        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        setupClientListeners();
        log("Anchor System Ready.");
    } catch (e) {
        log("Error loading config: " + e.message);
    }
}

function setupClientListeners() {
    client.on("stream-message", (uid, payload) => {
        try {
            const rawString = new TextDecoder().decode(payload);
            const parts = rawString.split('|');
            
            if (parts.length === 4) {
                const msgId = parts[0];
                const index = parseInt(parts[1]);
                const total = parseInt(parts[2]);
                const b64Data = parts[3];

                if (!streamBuffer[msgId]) streamBuffer[msgId] = new Array(total).fill(null);
                streamBuffer[msgId][index - 1] = b64Data;

                if (streamBuffer[msgId].every(part => part !== null)) {
                    const fullBase64 = streamBuffer[msgId].join('');
                    const decodedString = atob(fullBase64);
                    const json = JSON.parse(decodedString);

                    let transcript = json.text || json.content;

                    if (transcript) {
                        const prefix = json.object === "assistant.transcription" ? "ai" : "user";
                        const baseId = json.turn_id ? `turn-${json.turn_id}` : `msg-${json.message_id}`;
                        const uniqueKey = `${prefix}-${baseId}-${currentSessionId}`;

                        if (json.object === "assistant.transcription") {
                            addToHistory("assistant", transcript, uniqueKey, 'call');
                        } else if (json.object === "user.transcription") {
                            addToHistory("user", transcript, uniqueKey, 'call');
                        }
                    }
                    delete streamBuffer[msgId];
                }
            } 
        } catch (e) { console.error(e); }
    });

    client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        
        if (mediaType === "video" && currentMode === 'video') {
            log("Video Received");
            clearTimeout(videoLoadTimeout);
            aiPlaceholder.classList.add('d-none');
            phoneUi.classList.add('d-none');
            user.videoTrack.play(aiVideoPlayer);
        }

        if (mediaType === "audio") {
            log("Audio Received");
            user.audioTrack.play();
            
            if (currentMode === 'voice') {
                aiPlaceholder.classList.add('d-none');
                phoneUi.classList.remove('d-none'); 
                spinner.style.display = "none";
            } else {
                placeholderMsg.innerText = "Audio Connected. Video sync...";
                clearTimeout(videoLoadTimeout);
                videoLoadTimeout = setTimeout(() => {
                    if (!aiPlaceholder.classList.contains('d-none')) {
                        aiPlaceholder.classList.add('d-none');
                        phoneUi.classList.remove('d-none');
                        addToHistory("system", "Video unavailable. Switched to Voice.", null, 'call');
                    }
                }, 8000);
            }
        }
    });
}

window.setMode = async function(mode) {
    if (currentAgentId || (client && client.connectionState === 'CONNECTED')) {
        await stopCall();
    }

    currentMode = mode;
    
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${mode}`).classList.add('active');

    if (mode === 'chat') {
        videoInterface.classList.add('d-none');
        chatInterface.classList.remove('d-none');
    } else {
        videoInterface.classList.remove('d-none');
        chatInterface.classList.add('d-none');
        
        aiPlaceholder.classList.remove('d-none');
        aiVideoPlayer.innerHTML = "";
        phoneUi.classList.add('d-none');
        
        if (mode === 'voice') {
            remotePlayerWrapper.style.display = 'block'; 
            toggleCamBtn.classList.add('d-none');
            fullscreenBtn.classList.add('d-none');
            toggleChatBtn.classList.add('d-none'); 
        } else {
            // Video Mode
        }
    }
}

async function startCall() {
    if (!appId || !client) return;

    callBtn.classList.add("d-none");
    spinner.style.display = "block";
    placeholderMsg.innerText = "Connecting you to Anchor...";
    errorMsgDiv.innerText = "";
    statusDot.className = "status-dot active"; 
    statusBadge.innerText = "Connecting...";
    
    aiPlaceholder.classList.remove('d-none');
    phoneUi.classList.add('d-none');
    aiVideoPlayer.innerHTML = "";
    
    currentChannel = "session_" + Math.floor(Math.random() * 1000000);
    currentSessionId = Date.now().toString();
    streamBuffer = {}; 

    addToHistory("system", `--- ${currentMode.toUpperCase()} SESSION STARTED ---`, null, 'call');

    try {
        await client.join(appId, currentChannel, token, myUid);

        const tracksToPublish = [];
        localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        
        // 3. APPLY MUTE STATE ON CALL START
        if (isMicMuted) {
            localAudioTrack.setEnabled(false);
        }
        
        tracksToPublish.push(localAudioTrack);

        if (currentMode === 'video') {
            try {
                localVideoTrack = await AgoraRTC.createCameraVideoTrack();
                tracksToPublish.push(localVideoTrack);
                localPlayer.classList.remove('d-none');
                localVideoTrack.play('local-player');
                toggleCamBtn.classList.remove('d-none');
                fullscreenBtn.classList.remove('d-none');
                toggleChatBtn.classList.remove('d-none'); 
            } catch (e) { errorMsgDiv.innerText = "Camera access denied."; }
        }
        
        await client.publish(tracksToPublish);

        const response = await fetch("/api/start-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                channel: currentChannel, 
                uid: myUid, 
                mode: currentMode 
            })
        });

        if (!response.ok) throw new Error("Server rejected request");

        const aiData = await response.json();
        
        if (aiData.agent_id) {
            currentAgentId = aiData.agent_id;
            statusBadge.innerText = "Connected";
            hangupBtn.classList.remove("d-none");
            if (currentMode === 'voice') spinner.style.display = "none";
        } else {
            throw new Error("Invalid AI Agent ID");
        }

    } catch (e) {
        placeholderMsg.innerText = "Connection Failed";
        errorMsgDiv.innerText = e.message;
        spinner.style.display = "none";
        cleanup();
        callBtn.classList.remove("d-none");
    }
}

async function stopCall() {
    clearTimeout(videoLoadTimeout);
    if (document.fullscreenElement) document.exitFullscreen().catch(e=>{});

    if (currentAgentId) {
        fetch("/api/stop-ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agentId: currentAgentId })
        });
        currentAgentId = null;
    }
    if (client) await client.leave();
    cleanup(); 
    addToHistory("system", "--- SESSION ENDED ---", null, 'call');
}

function cleanup() {
    if (localAudioTrack) { localAudioTrack.close(); localAudioTrack = null; }
    if (localVideoTrack) { localVideoTrack.close(); localVideoTrack = null; }
    client.leave();

    aiPlaceholder.classList.remove('d-none');
    phoneUi.classList.add('d-none');
    spinner.style.display = "none";
    placeholderMsg.innerText = "Ready to Connect"; 
    errorMsgDiv.innerText = "";
    aiVideoPlayer.innerHTML = ""; 
    localPlayer.innerHTML = ""; 
    localPlayer.classList.add('d-none'); 
    
    toggleCamBtn.classList.add('d-none'); 
    fullscreenBtn.classList.add('d-none');
    toggleChatBtn.classList.add('d-none');

    overlayChatContainer.classList.add('d-none');
    overlayChatBox.innerHTML = ""; 

    callBtn.classList.remove("d-none");
    hangupBtn.classList.add("d-none");
    statusBadge.innerText = "Disconnected";
    statusDot.className = "status-dot"; 
}

async function sendChatMessage() {
    const text = chatInput.value;
    if (!text) return;
    
    addToHistory("user", text, "user-" + Date.now(), 'chat');
    chatInput.value = '';

    try {
        const res = await fetch('/api/text-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, history: textChatList })
        });
        const data = await res.json();
        
        if (data.reply) {
            addToHistory("assistant", data.reply, "ai-" + Date.now(), 'chat');
            if (audioResponseToggle && audioResponseToggle.checked) {
                const utterance = new SpeechSynthesisUtterance(data.reply);
                const voices = window.speechSynthesis.getVoices();
                const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha"));
                if (preferredVoice) utterance.voice = preferredVoice;
                window.speechSynthesis.speak(utterance);
            }
        }
    } catch (e) {
        addToHistory("system", "Error connecting to AI", null, 'chat');
    }
}

callBtn.addEventListener("click", startCall);
hangupBtn.addEventListener("click", stopCall);
sendChatBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendChatMessage(); });

init();