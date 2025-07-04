const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");

const app = express();

// CORS Middleware - WICHTIG für externe Clients wie Hoppscotch!
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
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

// Test-Endpoint um zu sehen ob der Server läuft
app.get("/", (req, res) => {
    res.json({ 
        message: "OpenAI Proxy Server läuft!",
        timestamp: new Date().toISOString(),
        endpoints: {
            "GET /": "Server Status",
            "POST /scrape-and-analyze-url": "URL Analyse mit OpenAI"
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

// Haupt-Endpoint für Scraping und Analyse
app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    
    console.log(`Neue Anfrage erhalten für URL: ${url}`);
    
    if (!url) {
        return res.status(400).json({ 
            error: "No URL provided",
            example: { "url": "https://example.com" }
        });
    }
    
    // URL Validierung
    try {
        new URL(url);
    } catch (e) {
        return res.status(400).json({ 
            error: "Invalid URL format",
            provided: url
        });
    }
    
    try {
        console.log(`Scraping URL: ${url}`);
        
        // Website laden mit Timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 Sekunden Timeout
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // HTML parsen
        const $ = cheerio.load(html);
        const title = $("title").text().trim() || "Kein Titel gefunden";
        const article = $("article").text() || $("main").text() || $("body").text();
        const shortText = article.substring(0, 3000);
        
        console.log(`Titel gefunden: ${title}`);
        console.log(`Text-Länge: ${shortText.length} Zeichen`);
        
        if (shortText.length < 100) {
            return res.status(400).json({
                error: "Zu wenig Text auf der Seite gefunden",
                title: title,
                textLength: shortText.length
            });
        }
        
        // OpenAI API Key prüfen
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({
                error: "OpenAI API Key nicht konfiguriert"
            });
        }
        
        // OpenAI Analyse
        console.log("Starte OpenAI Analyse...");
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
                { 
                    role: "system", 
                    content: "Du bist ein deutschsprachiger Webartikel-Analyst. Antworte strukturiert und präzise auf Deutsch." 
                },
                { role: "user", content: prompt }
            ],
            max_tokens: 1000,
            temperature: 0.7
        });
        
        const result = completion.choices[0].message.content;
        console.log("OpenAI Analyse abgeschlossen");
        
        res.json({
            success: true,
            url,
            title,
            textLength: shortText.length,
            summary: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Fehler:", error);
        
        let errorMessage = "Unbekannter Fehler";
        let statusCode = 500;
        
        if (error.name === 'AbortError') {
            errorMessage = "Timeout: Website antwortet nicht";
            statusCode = 408;
        } else if (error.message.includes('fetch')) {
            errorMessage = "Website nicht erreichbar";
            statusCode = 502;
        } else if (error.message.includes('OpenAI')) {
            errorMessage = "OpenAI API Fehler";
            statusCode = 503;
        }
        
        res.status(statusCode).json({ 
            error: errorMessage,
            details: error.message,
            url: url,
            timestamp: new Date().toISOString()
        });
    }
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: "Endpoint nicht gefunden",
        availableEndpoints: [
            "GET /",
            "GET /health",
            "POST /scrape-and-analyze-url"
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