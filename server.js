// server.js


const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 1. Config Endpoint
app.get('/config', (req, res) => {
    res.json({ 
        appId: process.env.AGORA_APPID,
        token: null // Force App ID Only mode
    });
});

// 2. Start AI Agent
app.post('/api/start-ai', async (req, res) => {
    const { channel, uid, mode } = req.body;
    const appId = process.env.AGORA_APPID;
    
    // Create Basic Auth Header
    const basicAuth = Buffer.from(`${process.env.AGORA_REST_KEY}:${process.env.AGORA_REST_SECRET}`).toString("base64");

    // Determine if we need video (Avatar)
    const isVideoMode = (mode === 'video');

    const agentConfig = {
        name: channel,
        properties: {
            channel: channel,
            agent_rtc_uid: "10001", // The AI's User ID
            // We must tell the AI exactly who to listen/look at
            remote_rtc_uids: [String(uid)], 
            
            idle_timeout: 120,
            
            advanced_features: { 
                // SET TO FALSE TO FORCE AI TO SPEAK FIRST (Fixes "Silence" bug)
                enable_aivad: false 
            },

            asr: { language: "en-US" },
            
            llm: {
                url: "https://api.groq.com/openai/v1/chat/completions",
                api_key: process.env.GROQ_KEY,
                system_messages: [{
                    role: "system",
                    content: `You are a supportive, empathetic mental health companion. 
                              - Keep answers short (1-2 sentences).
                              - Be warm and soothing.
                              - Ask gentle questions.`
                }],
                greeting_message: "Hello, I am connected. I am listening.",
                failure_message: "System error.",
                params: { model: "llama-3.3-70b-versatile" }
            },
            
            tts: {
                vendor: "minimax",
                params: {
                    url: "wss://api.minimax.io/ws/v1/t2a_v2",
                    group_id: process.env.TTS_MINIMAX_GROUPID,
                    key: process.env.TTS_MINIMAX_KEY,
                    model: "speech-2.6-turbo",
                    voice_setting: {
                        voice_id: "English_Lively_Male_11", 
                        speed: 1.0, vol: 1.0, pitch: 0, emotion: "happy"
                    },
                    audio_setting: { sample_rate: 16000 }
                }
            },
            
            avatar: {
                vendor: "akool",
                enable: isVideoMode, // Only enable Akool if in Video Mode
                params: {
                    api_key: process.env.AVATAR_AKOOL_KEY,
                    agora_uid: "10002", // The UID the Avatar Video comes from
                    avatar_id: "dvp_Sean_agora"
                }
            }
        }
    };

    try {
        console.log(`[Server] Starting AI in ${mode} mode for channel ${channel}...`);
        
        const url = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/join`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Basic ${basicAuth}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(agentConfig),
        });

        const data = await response.json();
        console.log("[Server] Agora Response:", JSON.stringify(data));

        if (response.ok) {
            res.json(data);
        } else {
            res.status(500).json(data);
        }
    } catch (error) {
        console.error("[Server] Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Stop AI Endpoint
app.post('/api/stop-ai', async (req, res) => {
    const { agentId } = req.body;
    const appId = process.env.AGORA_APPID;
    const basicAuth = Buffer.from(`${process.env.AGORA_REST_KEY}:${process.env.AGORA_REST_SECRET}`).toString("base64");

    try {
        const url = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${appId}/agents/${agentId}/leave`;
        await fetch(url, {
            method: "POST",
            headers: { Authorization: `Basic ${basicAuth}` }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Text Chat Endpoint
app.post('/api/text-chat', async (req, res) => {
    const { message, history } = req.body;
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a mental health support chatbot. Be kind and concise." },
                    ...history,
                    { role: "user", content: message }
                ]
            })
        });
        const data = await response.json();
        if (data.choices && data.choices[0]) {
            res.json({ reply: data.choices[0].message.content });
        } else {
            throw new Error("Groq API Error");
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});