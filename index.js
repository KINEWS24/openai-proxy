// index.js – ThinkAI Nexus (Version mit intelligentem Link-Fallback)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const { OpenAI } = require("openai");
const { google } = require("googleapis");
const cheerio = require("cheerio");
const axios = require("axios");

// === KONFIGURATION =================================================
const CAPTURE_PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.3.txt");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_CONTENT_LENGTH = 8000;
const COMPLETION_MODEL = "gpt-4o";
// ===================================================================

const app = express();
let openai;

if (OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
    console.error("FATALER FEHLER: OPENAI_API_KEY ist in der Umgebung nicht gesetzt.");
    process.exit(1);
}

async function checkPromptFile() {
    try {
        await fs.access(CAPTURE_PROMPT_PATH);
        console.log("Prompt-Datei 'nexus_prompt_v5.3.txt' erfolgreich gefunden.");
    } catch (error) {
        console.error("FATALER FEHLER: Die Prompt-Datei 'nexus_prompt_v5.3.txt' konnte nicht gefunden werden.");
        process.exit(1);
    }
}

app.use(bodyParser.json({ limit: "15mb" }));

// --- Analyse-Funktion für die Ersterfassung ---
async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) {
    const uuid = uuidv7();
    const timestamp = new Date().toISOString();
    const promptTemplate = await fs.readFile(CAPTURE_PROMPT_PATH, "utf8");
    const finalPrompt = promptTemplate.replace("{CONTENT}", contentRaw).replace("{SOURCEURL}", sourceUrl || "N/A").replace("{UUID}", uuid).replace("{TIMESTAMP_ISO}", timestamp);
    
    let gptResponse;
    try {
        gptResponse = await openai.chat.completions.create({
            model: COMPLETION_MODEL,
            messages: [{ role: "user", content: finalPrompt }]
        });
    } catch (e) {
        throw new Error(`OpenAI API-Fehler: ${e.message}`);
    }

    const analysisResultText = gptResponse.choices[0]?.message?.content;
    if (!analysisResultText) { throw new Error("Keine valide Antwort vom OpenAI API erhalten."); }
    
    const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/);
    let top3Tags = [];
    if (tagsHeaderMatch && tagsHeaderMatch[1]) {
        top3Tags = tagsHeaderMatch[1].split(',').slice(0, 3).map(tag => tag.replace(/#/g, '').toLowerCase().trim());
    }
    
    const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
    const baseName = [contextUUID, uuid, archetype.toLowerCase(), tsForName, ...top3Tags].filter(Boolean).join("_");
    const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/);
    const tagsJsonContent = jsonBlockMatch ? jsonBlockMatch[0] : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." });
    
    return { nexusMd: { filename: `${baseName}.nexus.md`, content: analysisResultText }, tagsJson: { filename: `${baseName}.tags.json`, content: tagsJsonContent }, originalFilenameBase: baseName };
}

// --- API Endpunkte ---

app.get("/", (req, res) => res.json({ status: "OK", message: `Nexus Heartbeat v18 (Intelligent Link Fallback)` }));

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
    try {
        const { context_uuid } = req.body;
        const output = await generateNexusObject({ archetype, contextUUID: context_uuid || "default-nexus-context", contentRaw, sourceUrl });
        
        // Wichtig: 'originalContent' wird hier gesetzt, damit der Client weiß, was er speichern soll
        output.originalContent = contentRaw;
        output.originalFilename = `${output.originalFilenameBase}.original.${extension}`;
        delete output.originalFilenameBase;

        res.json({ success: true, ...output });
    } catch (err) {
        console.error(`Fehler bei /analyze-${archetype}:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

app.post("/analyze-text", (req, res) => {
    const htmlContent = req.body.content;
    const $ = cheerio.load(htmlContent || '');
    $('script, style, noscript, iframe, footer, header, nav').remove();
    const cleanText = $.text().replace(/\s\s+/g, ' ').trim();
    const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH);
    handleAnalysisRequest(req, res, "text", truncatedText, req.body.source_url, "html");
});

// GEÄNDERT: Logik für Link-Analyse mit intelligentem Fallback
app.post("/analyze-link", async (req, res) => {
    const { url, context_uuid } = req.body;
    if (!url) {
        return res.status(400).json({ success: false, error: "Keine URL angegeben." });
    }

    let scrapedText = '';
    try {
        // VERSUCH 1: Den Inhalt der Seite zu laden
        console.log(`Versuche, Inhalt von ${url} zu scrapen...`);
        const response = await axios.get(url, {
            timeout: 10000, // 10 Sekunden Timeout
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const htmlContent = response.data;
        const $ = cheerio.load(htmlContent);
        $('script, style, noscript, iframe, footer, header, nav').remove();
        scrapedText = $('body').text().replace(/\s\s+/g, ' ').trim();
        
        if (!scrapedText) throw new Error("Kein sinnvoller Text gefunden.");
        
        console.log(`Scraping erfolgreich für ${url}.`);
        const truncatedText = scrapedText.substring(0, MAX_CONTENT_LENGTH);
        await handleAnalysisRequest(req, res, "link", truncatedText, url, "url");

    } catch (err) {
        // FALLBACK: Wenn das Laden fehlschlägt, wird ein reines Link-Objekt erstellt
        console.warn(`Scraping für ${url} fehlgeschlagen: ${err.message}. Erstelle Fallback-Link-Objekt.`);
        
        const fallbackContent = `Link: ${url}\n\nHinweis: Der Inhalt dieser Webseite konnte nicht automatisch analysiert werden. Der Link wurde stattdessen als Referenz gespeichert.`;
        const fallbackArchetype = "link-fallback"; // Eigener Archetyp zur Unterscheidung
        
        await handleAnalysisRequest(req, res, fallbackArchetype, fallbackContent, url, "url");
    }
});


app.post("/analyze-image", (req, res) => {
    // Für Bilder ist der "Inhalt" einfach die URL selbst.
    handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

// Chat-Endpunkt (unverändert)
app.post("/chat", async (req, res) => { /* ... unveränderter Code ... */ });

// --- Server-Start ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
    await checkPromptFile();
    console.log(`Nexus-Server v18 (Intelligent Link Fallback) läuft auf Port ${PORT}`);
});