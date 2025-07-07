// index.js – ThinkAI Nexus (Finale Version mit asynchronem Index-Start)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const axios = require("axios");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");
const { HierarchicalNSW } = require("hnswlib-node");

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

// === KONFIGURATION =================================================
const PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.3.txt");
const KNOWLEDGE_PATH = path.join(__dirname, "knowledge");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_CONTENT_LENGTH = 8000;
const EMBEDDING_MODEL = "text-embedding-3-small";
const COMPLETION_MODEL = "gpt-4o";
// ===================================================================

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
let knowledgeIndex = null;
let knowledgeData = [];
let isIndexReady = false; // NEU: Status-Flag für den Index

// --- Funktion zum Initialisieren des Wissens-Index ---
async function initializeIndex() {
    console.log("Initialisiere Wissens-Index im Hintergrund...");
    try {
        const files = await fs.readdir(KNOWLEDGE_PATH);
        const mdFiles = files.filter(file => file.endsWith('.nexus.md'));

        if (mdFiles.length === 0) {
            console.log("Keine .nexus.md Dateien im 'knowledge' Ordner gefunden.");
            return;
        }

        console.log(`Lese ${mdFiles.length} Wissens-Dateien...`);
        for (const file of mdFiles) {
            const content = await fs.readFile(path.join(KNOWLEDGE_PATH, file), 'utf8');
            knowledgeData.push({ source: file, content: content });
        }

        console.log("Erstelle Vektor-Embeddings für das Wissen (dies kann dauern)...");
        const embeddingsResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: knowledgeData.map(d => d.content),
        });

        const numDimensions = embeddingsResponse.data[0].embedding.length;
        knowledgeIndex = new HierarchicalNSW('l2', numDimensions);
        knowledgeIndex.initIndex(knowledgeData.length);

        embeddingsResponse.data.forEach((embeddingObj, i) => {
            knowledgeIndex.addPoint(embeddingObj.embedding, i);
        });

        isIndexReady = true; // NEU: Index ist jetzt bereit
        console.log(`✅ Wissens-Index mit ${knowledgeData.length} Dokumenten erfolgreich initialisiert!`);

    } catch (error) {
        console.error("Fehler bei der Initialisierung des Wissens-Index:", error);
    }
}

// (Die Analyse-Funktionen bleiben unverändert)
function slugify(str) { if (!str) return ''; return str.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, ""); }
async function loadPrompt() { try { return await fs.readFile(PROMPT_PATH, "utf8"); } catch (error) { console.error("FATAL: Konnte Prompt-Datei nicht laden!", error); return "Analysiere den folgenden Inhalt: {CONTENT}"; } }
async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) { const uuid = uuidv7(); const timestamp = new Date().toISOString(); let promptTemplate = await loadPrompt(); const finalPrompt = promptTemplate.replace("{ARCHETYPE}", archetype).replace("{CONTENT}", contentRaw).replace("{SOURCEURL}", sourceUrl || "N/A").replace("{UUID}", uuid).replace("{TIMESTAMP_ISO}", timestamp); if (!OPENAI_API_KEY) { throw new Error("OpenAI API Key ist nicht konfiguriert."); } const gptResponse = await openai.chat.completions.create({ model: COMPLETION_MODEL, messages: [{ role: "user", content: finalPrompt }], }); const analysisResultText = gptResponse.choices[0]?.message?.content; if (!analysisResultText) { throw new Error("Keine valide Antwort vom OpenAI API erhalten."); } const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/); let top3Tags = []; if (tagsHeaderMatch && tagsHeaderMatch[1]) { top3Tags = tagsHeaderMatch[1].split(',').slice(0, 3).map(tag => slugify(tag.replace(/#/g, ''))); } const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z"; const baseName = [contextUUID, uuid, archetype.toLowerCase(), tsForName, ...top3Tags].filter(Boolean).join("_"); const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/); const tagsJsonContent = jsonBlockMatch ? jsonBlockMatch[0] : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." }); return { nexusMd: { filename: `${baseName}.nexus.md`, content: analysisResultText }, tagsJson: { filename: `${baseName}.tags.json`, content: tagsJsonContent }, originalFilenameBase: baseName }; }

// ===============================
// API Endpunkte
// ===============================

app.get("/", (req, res) => res.json({ status: "OK", message: `Nexus Heartbeat v6. Index-Status: ${isIndexReady ? 'Bereit' : 'Initialisiere...'}` }));

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) { try { if (!contentRaw || typeof contentRaw !== 'string' || contentRaw.trim() === '') { return res.status(400).json({ success: false, error: "Fehlender oder leerer Inhalt für die Analyse." }); } const { context_uuid } = req.body; const output = await generateNexusObject({ archetype: archetype, contextUUID: context_uuid || "default-nexus-context", contentRaw: contentRaw, sourceUrl: sourceUrl }); output.originalFilename = `${output.originalFilenameBase}.original.${extension}`; delete output.originalFilenameBase; res.json({ success: true, ...output }); } catch (err) { console.error(`Fehler bei /analyze-${archetype}:`, err); res.status(500).json({ success: false, error: err.message }); } }
app.post("/analyze-text", (req, res) => { const htmlContent = req.body.content; const $ = cheerio.load(htmlContent || ''); const cleanText = $.text().replace(/\s\s+/g, ' ').trim(); const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH); handleAnalysisRequest(req, res, "text", truncatedText, req.body.source_url, "html"); });
app.post("/scrape-and-analyze-url", async (req, res) => { const { url } = req.body; let cleanText = ''; try { const response = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } }); const htmlContent = response.data; const $ = cheerio.load(htmlContent); cleanText = $('body').text().replace(/\s\s+/g, ' ').trim(); } catch(err) { console.error(`Fehler beim Scrapen der URL ${url}:`, err.message); } const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH); await handleAnalysisRequest(req, res, "link", truncatedText, url, "html"); });
app.post("/analyze-image", (req, res) => { handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url"); });


// --- CHAT-ENDPUNKT ---
app.post("/chat", async (req, res) => {
    const { query } = req.body;

    // Nutzt jetzt das Status-Flag
    if (!isIndexReady) {
        return res.status(503).json({ answer: "Entschuldigung, die Wissensbasis wird gerade noch initialisiert. Bitte versuche es in einem Moment erneut." });
    }
    if (!query) { return res.status(400).json({ answer: "Bitte gib eine Frage ein." }); }

    try {
        const queryEmbeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: query });
        const queryVector = queryEmbeddingResponse.data[0].embedding;
        
        const searchResults = knowledgeIndex.searchKnn(queryVector, 3);
        const contextSnippets = searchResults.neighbors.map(index => knowledgeData[index].content);
        const contextSources = searchResults.neighbors.map(index => knowledgeData[index].source);

        const chatPrompt = `Beantworte die folgende Frage des Nutzers basierend ausschließlich auf dem bereitgestellten Kontext. Gib an, aus welchen Quellen (Dateinamen) die Informationen stammen. Wenn die Antwort nicht im Kontext enthalten ist, sage, dass du keine Informationen dazu hast.\n\nKontext:\n---\n${contextSnippets.join("\n---\n")}\n---\n\nFrage des Nutzers:\n${query}\n\nAntwort:`;

        const completionResponse = await openai.chat.completions.create({ model: COMPLETION_MODEL, messages: [{ role: "user", content: chatPrompt }], temperature: 0.2 });
        
        const answer = completionResponse.choices[0].message.content;
        res.json({ answer: answer, sources: contextSources });

    } catch (error) {
        console.error("Fehler im Chat-Endpunkt:", error);
        res.status(500).json({ answer: "Ein Fehler ist bei der Bearbeitung deiner Anfrage aufgetreten." });
    }
});


// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Nexus-Server v6 (asynchroner Start) läuft auf Port ${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn("WARNUNG: OPENAI_API_KEY ist nicht gesetzt.");
    }
    // Starte die Initialisierung, aber warte nicht darauf.
    // Der Server ist sofort "live".
    initializeIndex();
});