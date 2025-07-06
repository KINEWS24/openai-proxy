// index.js – ThinkAI Nexus Herzstück-Server (Version 2.1 - Final)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

// === KONFIGURATION =================================================
const PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.3.txt");
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_CONTENT_LENGTH = 8000; // Maximale Zeichenlänge für die Analyse
// ===================================================================

// --- Hilfsfunktionen ---
function slugify(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

async function loadPrompt() {
    try {
        return await fs.readFile(PROMPT_PATH, "utf8");
    } catch (error) {
        console.error("FATAL: Konnte Prompt-Datei nicht laden!", error);
        return "Analysiere den folgenden Inhalt und gib eine Zusammenfassung zurück: {CONTENT}";
    }
}

// --- Herzstück: Objekt generieren ---
async function generateNexusObject({
    archetype,
    contextUUID,
    contentRaw,
    sourceUrl
}) {
    const uuid = uuidv7();
    const timestamp = new Date().toISOString();

    let promptTemplate = await loadPrompt();
    const finalPrompt = promptTemplate
        .replace("{ARCHETYPE}", archetype)
        .replace("{CONTENT}", contentRaw)
        .replace("{SOURCEURL}", sourceUrl || "N/A")
        .replace("{UUID}", uuid)
        .replace("{TIMESTAMP_ISO}", timestamp);

    if (!OPENAI_API_KEY) {
        throw new Error("OpenAI API Key ist nicht konfiguriert auf dem Server.");
    }

    const gptResponse = await axios.post(OPENAI_API_ENDPOINT, {
        model: "gpt-4o",
        messages: [{ role: "user", content: finalPrompt }],
    }, {
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const analysisResultText = gptResponse.data.choices[0]?.message?.content;
    if (!analysisResultText) {
        throw new Error("Keine valide Antwort vom OpenAI API erhalten.");
    }
    
    const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/);
    let top3Tags = [];
    if (tagsHeaderMatch && tagsHeaderMatch[1]) {
        top3Tags = tagsHeaderMatch[1].split(',').slice(0, 3).map(tag => slugify(tag.replace(/#/g, '')));
    }
    
    const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
    const baseName = [
        contextUUID,
        uuid,
        archetype.toLowerCase(),
        tsForName,
        ...top3Tags
    ].filter(Boolean).join("_");
    
    const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/);
    const tagsJsonContent = jsonBlockMatch ? jsonBlockMatch[0] : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." });

    return {
        nexusMd: {
            filename: `${baseName}.nexus.md`,
            content: analysisResultText
        },
        tagsJson: {
            filename: `${baseName}.tags.json`,
            content: tagsJsonContent
        },
        originalFilenameBase: baseName
    };
}

// ===============================
// API Endpunkte
// ===============================

app.get("/", (req, res) => res.json({ status: "OK", message: "Nexus Heartbeat v5 (final)" }));

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
     try {
        if (!contentRaw || typeof contentRaw !== 'string' || contentRaw.trim() === '') {
            return res.status(400).json({
                success: false,
                error: "Fehlender oder leerer Inhalt für die Analyse."
            });
        }
        
        const { context_uuid } = req.body;
        
        const output = await generateNexusObject({
            archetype: archetype,
            contextUUID: context_uuid || "default-nexus-context",
            contentRaw: contentRaw,
            sourceUrl: sourceUrl
        });

        output.originalFilename = `${output.originalFilenameBase}.original.${extension}`;
        delete output.originalFilenameBase;

        res.json({ success: true, ...output });
    } catch (err) {
        console.error(`Fehler bei /analyze-${archetype}:`, err);
        res.status(500).json({ success: false, error: err.message });
    }
}

app.post("/analyze-text", (req, res) => {
    const htmlContent = req.body.content;
    const $ = cheerio.load(htmlContent || '');
    const cleanText = $.text().replace(/\s\s+/g, ' ').trim();
    const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH);
    
    handleAnalysisRequest(req, res, "text", truncatedText, req.body.source_url, "html");
});

app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    let cleanText = '';
    
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const htmlContent = response.data;
        const $ = cheerio.load(htmlContent);
        cleanText = $('body').text().replace(/\s\s+/g, ' ').trim();
    } catch(err) {
        console.error(`Fehler beim Scrapen der URL ${url}:`, err.message);
    }
    
    const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH);
    await handleAnalysisRequest(req, res, "link", truncatedText, url, "html");
});

app.post("/analyze-image", (req, res) => {
    handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Nexus-Server v5 (final) läuft auf Port ${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn("WARNUNG: OPENAI_API_KEY ist nicht gesetzt. API-Aufrufe werden fehlschlagen.");
    }
});