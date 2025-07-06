// index.js – ThinkAI Nexus Herzstück-Server (Architektur nach Plan)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises; // Nur noch zum Lesen des Prompts
const path = require("path");
const { v7: uuidv7 } = require("uuidv7");
const axios = require("axios");

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

// === KONFIGURATION =================================================
// Der Pfad zur Prompt-Datei, die sicher auf dem Server liegt.
const PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.2.txt");

// Der Endpunkt der ECHTEN OpenAI API.
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";

// WICHTIG: Dein geheimer OpenAI API Key.
// Lade diesen aus einer .env-Datei oder den Umgebungsvariablen deines Hosters!
// Gib ihn NIEMALS direkt in den Code ein.
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
        // Im Fehlerfall wird ein einfacher Standard-Prompt verwendet, um einen Totalausfall zu verhindern.
        return "Analysiere den folgenden Inhalt und gib eine Zusammenfassung und drei relevante Hashtags im JSON-Format zurück: {CONTENT}";
    }
}

// --- Herzstück: Objekt generieren (speichert nichts mehr!) ----------
async function generateNexusObject({
    archetype,
    contextUUID,
    contentRaw,
    sourceUrl
}) {
    // 1. UUID v7 und ISO8601 Timestamp generieren
    const uuid = uuidv7();
    const timestamp = new Date().toISOString();

    // 2. Prompt laden und mit den Rohdaten befüllen
    let promptTemplate = await loadPrompt();
    const finalPrompt = promptTemplate
        .replace("{ARCTYPE}", archetype)
        .replace("{CONTENT}", contentRaw)
        .replace("{SOURCEURL}", sourceUrl || "N/A");

    // 3. ECHTE GPT-Analyse durchführen
    if (!OPENAI_API_KEY) {
        throw new Error("OpenAI API Key ist nicht konfiguriert auf dem Server.");
    }

    const gptResponse = await axios.post(OPENAI_API_ENDPOINT, {
        // Wähle das passende Modell. Für den komplexen Prompt ist gpt-4o oder gpt-4-turbo empfohlen.
        model: "gpt-4o", 
        messages: [{
            role: "user",
            content: finalPrompt,
        }, ],
        // Ggf. weitere Parameter wie temperature, max_tokens etc. hier anpassen.
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
    
    // 4. Tags und Titel aus dem Analyseergebnis extrahieren für den Dateinamen
    const titleMatch = analysisResultText.match(/\*\*([^*]+)\*\*/);
    const title = titleMatch ? titleMatch[1] : 'Unbenanntes-Objekt';

    const tagsHeaderMatch = analysisResultText.match(/Tags:(#\w+,?)+/);
    let top3Tags = [];
    if (tagsHeaderMatch) {
        top3Tags = tagsHeaderMatch[0].replace('Tags:', '').split(',').slice(0, 3).map(slugify);
    }
    
    // 5. Finalen Dateinamen-Stamm konstruieren
    const tsForName = timestamp.replace(/[:.]/g, "").replace("T", "T");
    const baseName = [
        contextUUID,
        uuid,
        archetype.toLowerCase(),
        tsForName,
        ...top3Tags
    ].filter(Boolean).join("_");
    
    // 6. Finales JSON-Objekt für die .tags.json Datei erstellen
    // Dieses JSON wird direkt aus der Analyse extrahiert, um Konsistenz zu gewährleisten.
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
        // Der Dateiname für die Original-Datei wird hier ebenfalls generiert,
        // damit die Extension einen konsistenten Namen verwenden kann.
        originalFilenameBase: baseName
    };
}


// ===============================
// API Endpunkte
// ===============================

// Health-Check für den Server
app.get("/", (req, res) => res.json({ status: "OK", message: "Nexus Heartbeat v2" }));

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
     try {
        const { context_uuid } = req.body;
        
        const output = await generateNexusObject({
            archetype: archetype,
            contextUUID: context_uuid || "default-nexus-context",
            contentRaw: contentRaw,
            sourceUrl: sourceUrl
        });

        // Hängt die Dateiendung für die Originaldatei an den Basisnamen an
        output.originalFilename = `${output.originalFilenameBase}.original.${extension}`;
        delete output.originalFilenameBase; // Aufräumen

        res.json({ success: true, ...output });
    } catch (err) {
        console.error(`Fehler bei /analyze-${archetype}:`, err.message);
        res.status(500).json({ success: false, error: err.message, details: err.stack });
    }
}

app.post("/analyze-text", (req, res) => {
    handleAnalysisRequest(req, res, "text", req.body.content, req.body.source_url, "html"); // Annahme: Textauswahl ist HTML
});

app.post("/scrape-and-analyze-url", async (req, res) => {
    try {
        const { url } = req.body;
        // Scrapen der URL für den Inhalt
        const response = await axios.get(url, { timeout: 15000 });
        const htmlContent = response.data;
        await handleAnalysisRequest(req, res, "link", htmlContent, url, "html");
    } catch(err) {
        console.error(`Fehler beim Scrapen der URL ${req.body.url}:`, err.message);
        res.status(500).json({ success: false, error: "URL konnte nicht abgerufen oder verarbeitet werden.", details: err.message });
    }
});

app.post("/analyze-image", (req, res) => {
    // Für die Bildanalyse wird die Bild-URL als "contentRaw" direkt weitergegeben.
    // GPT-4o/Vision kann die URL direkt verarbeiten.
    handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Nexus-Server v2 (stateless) läuft auf Port ${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn("WARNUNG: OPENAI_API_KEY ist nicht gesetzt. API-Aufrufe werden fehlschlagen.");
    }
});