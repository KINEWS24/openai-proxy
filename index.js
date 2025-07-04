const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");

const app = express();

// CORS Middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());

// OpenAI Konfiguration
const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

// Test-Endpoint
app.get("/", (req, res) => {
    res.json({ 
        message: "OpenAI Proxy Server läuft!",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /": "Server Status",
            "POST /openai": "Reine Text-Analyse mit OpenAI",
            "POST /scrape-and-analyze-url": "URL-Analyse mit OpenAI",
            "POST /analyze-image-url": "Bild-Analyse mit OpenAI"
        }
    });
});

// Health Check Endpoint
app.get("/health", (req, res) => {
    res.json({ 
        status: "OK", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Endpunkt für reine Text-Analyse
app.post("/openai", async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: "OpenAI API Key nicht konfiguriert" });
        }
        
        const completion = await openai.chat.completions.create({
            model: req.body.model || "gpt-4o",
            messages: req.body.messages,
        });
        
        res.json(completion);

    } catch (error) {
        console.error("Fehler im /openai Endpunkt:", error);
        res.status(500).json({ error: "Fehler bei der OpenAI-Anfrage" });
    }
});

// Endpunkt für Scraping und Link-Analyse
app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: "No URL provided" });
    }
    
    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ error: "Invalid URL format", provided: url });
    }
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $("title").text().trim() || "Kein Titel gefunden";
        const article = $("article").text() || $("main").text() || $("body").text();
        const shortText = article.substring(0, 4000);
        
        if (shortText.length < 100) {
            return res.status(400).json({ error: "Zu wenig Text auf der Seite gefunden" });
        }
        
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: "OpenAI API Key nicht konfiguriert" });
        }
        
        const prompt = `
Analysiere diesen Webartikel und fasse ihn als strukturierte Bulletpoints zusammen.

Titel: ${title}
Text: ${shortText}
Original-URL: ${url}

Bitte erstelle:
1. Eine prägnante Überschrift (max. 10 Wörter)
2. 3-7 wichtige Kernpunkte als Bulletpoints
3. Eine kurze Einschätzung der Relevanz

Format: Markdown mit Überschriften und Bulletpoints.
`;
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Du bist ein deutschsprachiger Webartikel-Analyst. Antworte strukturiert und präzise auf Deutsch." },
                { role: "user", content: prompt }
            ],
            max_tokens: 1000,
            temperature: 0.7
        });
        
        const result = completion.choices[0].message.content;
        
        res.json({
            success: true,
            title,
            summary: result,
        });
        
    } catch (error) {
        console.error("Fehler bei Link-Analyse:", error);
        let errorMessage = "Unbekannter Fehler";
        if (error.name === 'AbortError') errorMessage = "Timeout: Website antwortet nicht";
        else if (error.message.includes('fetch')) errorMessage = "Website nicht erreichbar";
        
        res.status(500).json({ error: errorMessage, details: error.message });
    }
});

// NEU: Endpunkt für die Bild-Analyse
app.post("/analyze-image-url", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "No image URL provided" });
    }

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OpenAI API Key nicht konfiguriert");
        }

        console.log(`Analysiere Bild von URL: ${url}`);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { 
                            type: "text", 
                            text: "Beschreibe dieses Bild detailliert auf Deutsch. Was ist zu sehen? Was ist der Kontext? Welche Stimmung vermittelt es? Erstelle eine prägnante Bildunterschrift und eine Liste von relevanten Tags." 
                        },
                        {
                            type: "image_url",
                            image_url: { "url": url },
                        },
                    ],
                },
            ],
            max_tokens: 500,
        });

        const description = completion.choices[0].message.content;
        res.json({ description: description });

    } catch (error) {
        console.error("Fehler bei der Bild-Analyse:", error);
        res.status(500).json({ error: "Fehler bei der OpenAI Vision-Anfrage" });
    }
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: "Endpoint nicht gefunden",
        availableEndpoints: [
            "GET /",
            "GET /health",
            "POST /openai",
            "POST /scrape-and-analyze-url",
            "POST /analyze-image-url"
        ]
    });
});

// Port-Konfiguration für Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy läuft auf Port ${PORT}`);
    console.log(`CORS aktiviert für alle Domains`);
    console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Gesetzt' : 'FEHLT!'}`);
});
