// index.js – ThinkAI Nexus Herzstück-Server (Stand 07/2025)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const { v7: uuidv7 } = require("uuidv7");
const axios = require("axios");

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

// === KONFIGURATION ==================
const STORAGE_BASE = path.join(__dirname, "storage"); // Output-Ordner für alle Dateien
const PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.2.txt"); // Prompt-Textdatei
const OPENAI_PROXY = "https://openai-proxy-qd96.onrender.com/openai";
// =====================================

// --- Hilfsfunktionen -----------------------------------------

function slugify(str) {
    return str
        .toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

// --- Prompt einlesen ----------------------------------------

async function loadPrompt() {
    return fs.readFile(PROMPT_PATH, "utf8");
}

// --- Herzstück: Objekt speichern ----------------------------

async function saveNexusObject({
    archetype,
    contextUUID,
    contentRaw,      // Originaldaten (Text, HTML, URL, Bild etc.)
    sourceUrl,       // Quelle, falls vorhanden
    extension,       // .txt, .html, .url, .jpg etc.
    promptOverride,  // Optional: Prompt als String (sonst .txt)
}) {
    // 1. UUID v7
    const uuid = uuidv7();

    // 2. ISO8601 Timestamp (z. B. 2025-07-06T14:32:13Z)
    const timestamp = new Date().toISOString();

    // 3. Prompt laden und Variablen einsetzen
    let gptPrompt;
    if (promptOverride) {
        gptPrompt = promptOverride;
    } else {
        let promptText = await loadPrompt();
        promptText = promptText
            .replace("{ARCTYPE}", archetype)
            .replace("{CONTENT}", contentRaw)
            .replace("{SOURCEURL}", sourceUrl || "");
        gptPrompt = promptText;
    }

    // 4. GPT-Analyse (Proxy)
    const gptResponse = await axios.post(OPENAI_PROXY, {
        model: "gpt-4o",
        messages: [{ role: "user", content: gptPrompt }]
    });
    const resultText = gptResponse.data.choices[0].message.content;

    // 5. Tags extrahieren (aus JSON-Block!)
    const tagMatch = resultText.match(/"Tags":\s*\[(.*?)\]/s);
    let tags = [];
    if (tagMatch) {
        tags = tagMatch[1]
            .split(",")
            .map(t => t.replace(/["'# ]/g, '').trim())
            .filter(Boolean);
    }
    const top3Tags = tags.slice(0, 3).map(slugify);

    // 6. Titel extrahieren
    let title = "";
    const titleMatch = resultText.match(/"Title":\s*"([^"]+)"/);
    if (titleMatch) title = titleMatch[1];

    // 7. Kontext-UUID sichern (wenn nicht übergeben)
    contextUUID = contextUUID || "default-nexus-context";

    // 8. Dateinamen-Logik
    //   kontextuuid_uuid_archetyp_timestamp_tag1_tag2_tag3.*
    //   Timestamp für Dateiname: ISO8601 ohne Doppelpunkte/Punkte
    const tsForName = timestamp.replace(/[:.]/g, "").replace(/T/, "T").replace(/Z/, "Z");
    const baseName = [
        contextUUID,
        uuid,
        archetype.toLowerCase(),
        tsForName,
        ...top3Tags
    ].join("_");

    // --- Ordner anlegen
    await fs.mkdir(STORAGE_BASE, { recursive: true });

    // 1. Original-Datei (RAW)
    const originalPath = path.join(STORAGE_BASE, `${baseName}.original.${extension}`);
    await fs.writeFile(originalPath, contentRaw, "utf8");

    // 2. Analyse-Datei (Markdown)
    const mdPath = path.join(STORAGE_BASE, `${baseName}.nexus.md`);
    await fs.writeFile(mdPath, resultText, "utf8");

    // 3. Tags-JSON-Datei (schnell durchsuchbar)
    const tagsJsonPath = path.join(STORAGE_BASE, `${baseName}.tags.json`);
    const tagsJson = {
        uuid,
        contextUUID,
        archetype,
        timestamp,
        top3Tags: tags.slice(0,3),
        title,
        allTags: tags,
        sourceUrl: sourceUrl || null
    };
    await fs.writeFile(tagsJsonPath, JSON.stringify(tagsJson, null, 2), "utf8");

    // Logging/Debug
    return { baseName, originalPath, mdPath, tagsJsonPath };
}

// ===============================
// Endpunkte (Text, Link, Bild etc.)
// ===============================

app.post("/analyze-text", async (req, res) => {
    try {
        const { content, context_uuid, source_url } = req.body;
        const output = await saveNexusObject({
            archetype: "text",
            contextUUID: context_uuid || "default-nexus-context",
            contentRaw: content,
            sourceUrl: source_url || "",
            extension: "txt"
        });
        res.json({ success: true, ...output });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post("/scrape-and-analyze-url", async (req, res) => {
    try {
        const { url, context_uuid } = req.body;
        // Fetch Website
        const response = await axios.get(url);
        const html = response.data;
        const output = await saveNexusObject({
            archetype: "link",
            contextUUID: context_uuid || "default-nexus-context",
            contentRaw: html,
            sourceUrl: url,
            extension: "html"
        });
        res.json({ success: true, ...output });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Analog für weitere Formate (z.B. /analyze-image, /analyze-pdf, /analyze-audio...)

// Root: Health-Check
app.get("/", (req, res) => res.json({ status: "OK", message: "Nexus Heartbeat" }));

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Nexus-Server läuft auf Port ${PORT}`);
});
