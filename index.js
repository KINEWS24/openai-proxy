// index.js – ThinkAI Nexus Herzstück-Server (Architektur nach Plan v3)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises; // Nur noch zum Lesen des Prompts
const path = require("path");
const { uuidv7 } = require("uuidv7");
const axios = require("axios");

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

// === KONFIGURATION =================================================
const PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.3.txt");
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 
// ===================================================================


// --- Hilfsfunktionen -----------------------------------------------
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

// --- Herzstück: Objekt generieren ----------------------------------
async function generateNexusObject({
    archetype,
    contextUUID,
    contentRaw,
    sourceUrl
}) {
    // 1. Logische Werte im Code erzeugen (NEUE ARBEITSTEILUNG)
    const uuid = uuidv7();
    const timestamp = new Date().toISOString();

    // 2. Prompt laden und mit ALLEN Werten (logisch & inhaltlich) befüllen
    let promptTemplate = await loadPrompt();
    const finalPrompt = promptTemplate
        .replace("{ARCHETYPE}", archetype)
        .replace("{CONTENT}", contentRaw)
        .replace("{SOURCEURL}", sourceUrl || "N/A")
        .replace("{UUID}", uuid) // NEU
        .replace("{TIMESTAMP_ISO}", timestamp); // NEU

    // 3. GPT-Analyse durchführen
    if (!OPENAI_API_KEY) {
        throw new Error("OpenAI API Key ist nicht konfiguriert auf dem Server.");
    }

    const gptResponse = await axios.post(OPENAI_API_ENDPOINT, {
        model: "gpt-4o",
        messages: [{
            role: "user",
            content: finalPrompt,
        }, ],
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
    
    // 4. Tags aus der KI-Antwort extrahieren für den Dateinamen
    const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/);
    let top3Tags = [];
    if (tagsHeaderMatch && tagsHeaderMatch[1]) {
        top3Tags = tagsHeaderMatch[1].split(',').slice(0, 3).map(tag => slugify(tag.replace(/#/g, '')));
    }
    
    // 5. Finalen Dateinamen-Stamm konstruieren (mit den in Schritt 1 erzeugten Werten)
    const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
    const baseName = [
        contextUUID,
        uuid,
        archetype.toLowerCase(),
        tsForName,
        ...top3Tags
    ].filter(Boolean).join("_");
    
    // 6. JSON-Block aus der KI-Antwort extrahieren
    const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/);
    const tagsJsonContent = jsonBlockMatch ? jsonBlockMatch[0] : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." });

    // 7. Das finale Objekt für die Rückgabe an die Extension zusammenbauen
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

app.get("/", (req, res) => res.json({ status: "OK", message: "Nexus Heartbeat v3" }));

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
     try {
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
    handleAnalysisRequest(req, res, "text", req.body.content, req.body.source_url, "html");
});

app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url, context_uuid } = req.body;
    try {
        // NEU: Robusterer Request mit User-Agent
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const htmlContent = response.data;
        // Rufe die Standard-Behandlung auf, nachdem der Inhalt erfolgreich geholt wurde
        await handleAnalysisRequest(req, res, "link", htmlContent, url, "html");
    } catch(err) {
        console.error(`Fehler beim Scrapen der URL ${url}:`, err.message);
        res.status(500).json({ success: false, error: "URL-Inhalt konnte nicht abgerufen oder verarbeitet werden." });
    }
});

app.post("/analyze-image", (req, res) => {
    handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Nexus-Server v3 läuft auf Port ${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn("WARNUNG: OPENAI_API_KEY ist nicht gesetzt. API-Aufrufe werden fehlschlagen.");
    }
});