// index.js – ThinkAI Nexus (v24 - Robuste Architektur)

// --- SCHRITT 1: IMPORTS & KONSTANTEN ---
// Alle benötigten Pakete werden hier geladen.
const express = require("express");
const cors = require("cors"); // Wichtig für die sichere Kommunikation mit der Extension
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const { OpenAI } = require("openai");
const { google } = require("googleapis");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fetch = require('node-fetch');

// Globale Konfigurationen
const CAPTURE_PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.3.txt");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const MAX_CONTENT_LENGTH = 8000;
const COMPLETION_MODEL = "gpt-4o";
const PORT = process.env.PORT || 10000;

// Globale Instanzen
let openai;

// --- SCHRITT 2: EXPRESS APP & MIDDLEWARE INITIALISIERUNG ---
// Dies ist die korrekte und sichere Reihenfolge.
const app = express();

// 2a. CORS Middleware: Erlaubt Anfragen von deiner Chrome Extension.
app.use(cors());

// 2b. JSON Body Parser Middleware: Wandelt eingehende Anfragen in lesbares JSON um.
// Ersetzt das alte 'body-parser'-Paket durch die moderne, eingebaute Express-Funktion.
app.use(express.json({ limit: "15mb" }));

// 2c. Diagnose-Middleware: Protokolliert JEDE eingehende Anfrage.
// Das ist unsere "Spionage-Funktion", um zu sehen, was genau ankommt.
app.use((req, res, next) => {
    console.log(`[DIAGNOSE] Eingehende Anfrage: ${req.method} ${req.path}`);
    next(); // Wichtig: Leitet die Anfrage an die nächste Funktion weiter.
});


// --- SCHRITT 3: HILFSFUNKTIONEN ---
// Alle unsere Logik-Funktionen sind hier gekapselt.

async function initializeApp() {
    if (!OPENAI_API_KEY) {
        console.error("FATALER FEHLER: OPENAI_API_KEY ist in der Umgebung nicht gesetzt.");
        process.exit(1);
    }
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    try {
        await fs.access(CAPTURE_PROMPT_PATH);
        console.log("✅ Prompt-Datei 'nexus_prompt_v5.3.txt' erfolgreich gefunden.");
    } catch (error) {
        console.error("FATALER FEHLER: Die Prompt-Datei 'nexus_prompt_v5.3.txt' konnte nicht gefunden werden.");
        process.exit(1);
    }

    if (!SCRAPER_API_KEY) {
        console.warn("WARNUNG: SCRAPER_API_KEY ist nicht gesetzt. Link-Analyse wird auf die unzuverlässige Puppeteer-Methode zurückfallen.");
    } else {
        console.log("✅ ScraperAPI Key erfolgreich gefunden und wird für die Link-Analyse verwendet.");
    }
}

async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) {
    // Diese Funktion bleibt logisch unverändert.
    const uuid = uuidv7();
    const timestamp = new Date().toISOString();
    const promptTemplate = await fs.readFile(CAPTURE_PROMPT_PATH, "utf8");
    const finalPrompt = promptTemplate.replace("{CONTENT}", contentRaw).replace("{SOURCEURL}", sourceUrl || "N/A").replace("{UUID}", uuid).replace("{TIMESTAMP_ISO}", timestamp);
    
    const gptResponse = await openai.chat.completions.create({
        model: COMPLETION_MODEL,
        messages: [{ role: "user", content: finalPrompt }]
    });

    const analysisResultText = gptResponse.choices[0]?.message?.content;
    if (!analysisResultText) throw new Error("Keine valide Antwort vom OpenAI API erhalten.");
    
    const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/);
    const top3Tags = tagsHeaderMatch?.[1]?.split(',').slice(0, 3).map(tag => tag.replace(/#/g, '').toLowerCase().trim()) || [];
    const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
    const baseName = [contextUUID, uuid, archetype.toLowerCase(), tsForName, ...top3Tags].filter(Boolean).join("_");
    const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/);
    const tagsJsonContent = jsonBlockMatch ? jsonBlockMatch[0] : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." });
    
    return { nexusMd: { filename: `${baseName}.nexus.md`, content: analysisResultText }, tagsJson: { filename: `${baseName}.tags.json`, content: tagsJsonContent }, originalFilenameBase: baseName };
}

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
    // Diese Funktion bleibt logisch unverändert.
    try {
        const { context_uuid } = req.body;
        const output = await generateNexusObject({ archetype, contextUUID: context_uuid || "default-nexus-context", contentRaw, sourceUrl });
        output.originalContent = contentRaw;
        output.originalFilename = `${output.originalFilenameBase}.original.${extension}`;
        delete output.originalFilenameBase;
        res.json({ success: true, ...output });
    } catch (err) {
        console.error(`Fehler bei /analyze-${archetype}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

// --- SCHRITT 4: ROUTEN-DEFINITION ---
// Alle API-Endpunkte werden hier definiert.

app.get("/", (req, res) => {
    res.json({ status: "OK", message: `Nexus Heartbeat v24 (Robuste Architektur)` });
});

app.post("/analyze-text", (req, res) => {
    const htmlContent = req.body.content || '';
    const $ = cheerio.load(htmlContent);
    $('script, style, noscript, iframe, footer, header, nav').remove();
    const cleanText = $.text().replace(/\s\s+/g, ' ').trim();
    const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH);
    handleAnalysisRequest(req, res, "text", truncatedText, req.body.source_url, "html");
});

app.post("/analyze-link", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: "Keine URL angegeben." });

    if (SCRAPER_API_KEY) {
        try {
            console.log(`Versuche Scraping für ${url} über ScraperAPI...`);
            const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
            const response = await fetch(scraperUrl, { timeout: 45000 });
            if (!response.ok) throw new Error(`ScraperAPI hat mit Status ${response.status} geantwortet.`);
            
            const htmlContent = await response.text();
            console.log(`Scraping mit ScraperAPI erfolgreich für ${url}.`);
            const $ = cheerio.load(htmlContent);
            $('script, style, noscript, iframe, footer, header, nav, aside, form').remove();
            let scrapedText = $('body').text().replace(/\s\s+/g, ' ').trim();
            if (!scrapedText) throw new Error("Kein sinnvoller Text auf der Seite gefunden nach dem Scraping.");
            
            const truncatedText = scrapedText.substring(0, MAX_CONTENT_LENGTH);
            await handleAnalysisRequest(req, res, "link", truncatedText, url, "url");
            return;
        } catch (err) {
            console.warn(`ScraperAPI-Analyse für ${url} fehlgeschlagen: ${err.message}. Erstelle Fallback-Link-Objekt.`);
            const fallbackContent = `Link: ${url}\n\nHinweis: Der Inhalt dieser Webseite konnte nicht automatisch analysiert werden. Der Link wurde stattdessen als Referenz gespeichert.`;
            await handleAnalysisRequest(req, res, "link-fallback", fallbackContent, url, "url");
            return;
        }
    }

    // Fallback-Methode mit On-Demand Puppeteer
    console.warn("Kein ScraperAPI Key gefunden, nutze die unzuverlässige Puppeteer-Methode.");
    let browser = null;
    try {
        console.log("🔄 Initialisiere Puppeteer-Browser on-demand...");
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
        const htmlContent = await page.content();
        const $ = cheerio.load(htmlContent);
        $('script, style, noscript, iframe, footer, header, nav, aside, form').remove();
        let scrapedText = $('body').text().replace(/\s\s+/g, ' ').trim();
        if (!scrapedText) throw new Error("Kein sinnvoller Text auf der Seite gefunden.");
        const truncatedText = scrapedText.substring(0, MAX_CONTENT_LENGTH);
        await handleAnalysisRequest(req, res, "link", truncatedText, url, "url");
    } catch (err) {
        console.warn(`Puppeteer-Scraping für ${url} fehlgeschlagen: ${err.message}. Erstelle Fallback-Link-Objekt.`);
        const fallbackContent = `Link: ${url}\n\nHinweis: Der Inhalt dieser Webseite konnte nicht automatisch analysiert werden. Der Link wurde stattdessen als Referenz gespeichert.`;
        await handleAnalysisRequest(req, res, "link-fallback", fallbackContent, url, "url");
    } finally {
        if (browser) await browser.close();
        console.log("On-Demand Puppeteer-Browser geschlossen.");
    }
});

app.post("/analyze-image", (req, res) => {
    handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

app.post("/chat", async (req, res) => {
    // Diese Funktion bleibt logisch unverändert.
    const { query, token, folderId } = req.body;
    if (!token || !query || !folderId) return res.status(400).json({ success: false, answer: "Fehlende Anfrage-Parameter." });

    try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: token });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const listRes = await drive.files.list({
            q: `'${folderId}' in parents and name contains '.nexus.md' and trashed=false`,
            fields: 'files(id, name)',
            pageSize: 200,
            orderBy: 'createdTime desc'
        });
        const files = listRes.data.files;
        if (!files || files.length === 0) return res.json({ success: true, answer: "Ich konnte noch keine Wissens-Dateien in Ihrem Nexus-Ordner finden." });
        
        const queryKeywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        const relevantFiles = files.filter(file => file.name.toLowerCase().includes(queryKeywords.join(' '))).slice(0, 5);
        let filesToRead = relevantFiles.length > 0 ? relevantFiles : files.slice(0, 5);
        if (filesToRead.length === 0) return res.json({ success: true, answer: "Ich konnte keine Dokumente finden, die zu Ihrer Frage passen." });
        
        const contentPromises = filesToRead.map(file => drive.files.get({ fileId: file.id, alt: 'media' }).then(res => `Quelle: ${file.name}\nInhalt:\n${res.data}`));
        const contents = await Promise.all(contentPromises);
        const context = contents.join("\n\n---\n\n").substring(0, MAX_CONTENT_LENGTH * 2);
        const chatPrompt = `Beantworte die Frage des Nutzers präzise und ausschließlich basierend auf dem bereitgestellten Kontext. Fasse die Informationen aus den verschiedenen Quellen zu einer einzigen, gut lesbaren Antwort zusammen. Zitiere deine Quellen nicht direkt, sondern nutze die Informationen, um die Frage zu beantworten.\n\nKontext:\n---\n${context}\n---\n\nFrage des Nutzers:\n${query}\n\nAntwort:`;
        
        const completionResponse = await openai.chat.completions.create({ model: COMPLETION_MODEL, messages: [{ role: "user", content: chatPrompt }], temperature: 0.2 });
        const answer = completionResponse.choices[0]?.message?.content;
        if (!answer) throw new Error("Die KI hat keine Antwort generiert.");
        res.json({ success: true, answer: answer });
    } catch (error) {
        console.error("Fehler im /chat Endpunkt:", error.response ? error.response.data : error.message);
        const status = (error.response && error.response.status === 401) ? 401 : 500;
        const message = status === 401 ? "Ihr Google-Zugang ist abgelaufen. Bitte verbinden Sie sich in den Optionen neu." : `Ein interner Serverfehler ist aufgetreten. Details: ${error.message}`;
        res.status(status).json({ success: false, answer: message });
    }
});

// --- SCHRITT 5: SERVER-START ---
// Der Server wird erst gestartet, nachdem die App initialisiert wurde.
initializeApp().then(() => {
    app.listen(PORT, () => {
        console.log(`Nexus-Server v24 (Robuste Architektur) läuft auf Port ${PORT}`);
    });
}).catch(err => {
    console.error("Fehler bei der App-Initialisierung:", err);
    process.exit(1);
});