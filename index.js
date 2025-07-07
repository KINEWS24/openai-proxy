// index.js – ThinkAI Nexus (Finale Version mit intelligenter Daten-Extraktion für den Index)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const axios = require("axios");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");
const { HierarchicalNSW } = require("hnswlib-node");

// === KONFIGURATION =================================================
const PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.3.txt");
const KNOWLEDGE_PATH = path.join(__dirname, "knowledge");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_CONTENT_LENGTH = 8000;
const EMBEDDING_MODEL = "text-embedding-3-small";
const COMPLETION_MODEL = "gpt-4o";
// ===================================================================

const app = express();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
let knowledgeIndex = null;
let knowledgeData = [];
let isIndexReady = false;

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

// --- NEU: Überarbeitete Funktion zum Initialisieren des Wissens-Index ---
async function initializeIndex() {
    console.log("Initialisiere Wissens-Index im Hintergrund...");
    try {
        const files = await fs.readdir(KNOWLEDGE_PATH);
        const mdFiles = files.filter(file => file.endsWith('.nexus.md'));
        if (mdFiles.length === 0) {
            console.log("Keine .nexus.md Dateien gefunden.");
            isIndexReady = true;
            return;
        }

        console.log(`Lese und parse ${mdFiles.length} Wissens-Dateien...`);
        let documentsForEmbedding = [];

        for (const file of mdFiles) {
            const fileContent = await fs.readFile(path.join(KNOWLEDGE_PATH, file), 'utf8');
            
            const titleMatch = fileContent.match(/\*\*(.*?)\*\*/);
            const title = titleMatch ? titleMatch[1] : '';

            // Extrahiert den Summary-Text aus dem JSON-Block
            const summaryMatch = fileContent.match(/"Summary":\s*"(.*?)"/);
            const summary = summaryMatch ? summaryMatch[1] : '';
            
            const tagsMatch = fileContent.match(/Schlagwörter: (.*)/);
            const tagsText = tagsMatch ? tagsMatch[1] : '';

            const urlMatch = fileContent.match(/Quelle: (https?:\/\/[^\s]+)/);
            const url = urlMatch ? urlMatch[1] : null;

            // Kombiniere die relevantesten Textteile für eine präzise Suche
            const cleanTextForIndexing = [title, summary, tagsText].join(' ').trim();
            
            knowledgeData.push({ 
                sourceFile: file, 
                contentForEmbedding: cleanTextForIndexing.toLowerCase(),
                fullContent: fileContent,
                title: title || file,
                url: url,
                tags: tagsText ? tagsText.split(',').map(t => t.trim()) : []
            });
            documentsForEmbedding.push(cleanTextForIndexing.toLowerCase());
        }

        console.log("Erstelle Vektor-Embeddings für das bereinigte Wissen...");
        const embeddingsResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: documentsForEmbedding,
        });

        const numDimensions = embeddingsResponse.data[0].embedding.length;
        knowledgeIndex = new HierarchicalNSW('l2', numDimensions);
        knowledgeIndex.initIndex(knowledgeData.length);

        embeddingsResponse.data.forEach((embeddingObj, i) => {
            knowledgeIndex.addPoint(embeddingObj.embedding, i);
        });

        isIndexReady = true;
        console.log(`✅ Wissens-Index mit ${knowledgeData.length} Dokumenten erfolgreich initialisiert!`);

    } catch (error) {
        console.error("Fehler bei der Initialisierung des Wissens-Index:", error);
    }
}

// --- Analyse-Funktion für neue Objekte ---
async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) {
    const uuid = uuidv7();
    const timestamp = new Date().toISOString();
    let promptTemplate = await loadPrompt();
    const finalPrompt = promptTemplate
        .replace("{ARCHETYPE}", archetype)
        .replace("{CONTENT}", contentRaw)
        .replace("{SOURCEURL}", sourceUrl || "N/A")
        .replace("{UUID}", uuid)
        .replace("{TIMESTAMP_ISO}", timestamp);
    
    if (!OPENAI_API_KEY) { throw new Error("OpenAI API Key ist nicht konfiguriert."); }
    
    const gptResponse = await openai.chat.completions.create({ model: COMPLETION_MODEL, messages: [{ role: "user", content: finalPrompt }] });
    const analysisResultText = gptResponse.choices[0]?.message?.content;
    
    if (!analysisResultText) { throw new Error("Keine valide Antwort vom OpenAI API erhalten."); }
    
    const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/);
    let top3Tags = [];
    if (tagsHeaderMatch && tagsHeaderMatch[1]) {
        top3Tags = tagsHeaderMatch[1].split(',').slice(0, 3).map(tag => slugify(tag.replace(/#/g, '')));
    }
    
    const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
    const baseName = [contextUUID, uuid, archetype.toLowerCase(), tsForName, ...top3Tags].filter(Boolean).join("_");
    const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/);
    const tagsJsonContent = jsonBlockMatch ? jsonBlockMatch[0] : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." });
    
    return { nexusMd: { filename: `${baseName}.nexus.md`, content: analysisResultText }, tagsJson: { filename: `${baseName}.tags.json`, content: tagsJsonContent }, originalFilenameBase: baseName };
}

// --- Middleware und Routen-Definition ---
app.use(bodyParser.json({ limit: "15mb" }));

app.get("/", (req, res) => res.json({ status: "OK", message: `Nexus Heartbeat v8. Index-Status: ${isIndexReady ? 'Bereit' : 'Initialisiere...'}` }));

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
    try {
        if (!contentRaw || typeof contentRaw !== 'string' || contentRaw.trim() === '') {
            return res.status(400).json({ success: false, error: "Fehlender oder leerer Inhalt für die Analyse." });
        }
        const { context_uuid } = req.body;
        const output = await generateNexusObject({ archetype, contextUUID: context_uuid || "default-nexus-context", contentRaw, sourceUrl });
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
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const htmlContent = response.data;
        const $ = cheerio.load(htmlContent);
        cleanText = $('body').text().replace(/\s\s+/g, ' ').trim();
    } catch (err) {
        console.error(`Fehler beim Scrapen der URL ${url}:`, err.message);
    }
    const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH);
    await handleAnalysisRequest(req, res, "link", truncatedText, url, "html");
});

app.post("/analyze-image", (req, res) => {
    handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

app.post("/chat", async (req, res) => {
    const { query } = req.body;
    if (!isIndexReady) { return res.status(503).json({ success: false, summaries: [] }); }
    if (!query) { return res.status(400).json({ success: false, summaries: [] }); }

    try {
        const normalizedQuery = query.toLowerCase();
        const queryEmbeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: normalizedQuery });
        const queryVector = queryEmbeddingResponse.data[0].embedding;
        
        const searchResults = knowledgeIndex.searchKnn(queryVector, 3);
        const uniqueIndices = [...new Set(searchResults.neighbors)];

        const analysisPromises = uniqueIndices.map(async (index) => {
            const document = knowledgeData[index];
            const analysisPrompt = `Du bist ein Analyse-Assistent. Fasse den folgenden Text zusammen und gib ein kurzes, prägnantes Thema an. Antworte ausschließlich im Format: "Thema: [Dein gefundenes Thema]\nZusammenfassung: [Deine Zusammenfassung]".\n\nText:\n---\n${document.fullContent}`;
            
            const completionResponse = await openai.chat.completions.create({
                model: COMPLETION_MODEL,
                messages: [{ role: "user", content: analysisPrompt }],
                temperature: 0.1,
            });

            let rawAnswer = completionResponse.choices[0].message.content || "";
            let topic = "Unbekanntes Thema";
            let summaryText = "Konnte keine Zusammenfassung erstellen.";
            const topicMatch = rawAnswer.match(/^Thema: (.*)/im);
            if (topicMatch && topicMatch[1]) {
                topic = topicMatch[1].trim();
                summaryText = rawAnswer.substring(topicMatch[0].length).replace(/^Zusammenfassung: /im, '').trim();
            }
            return { topic, summary: summaryText, source: { title: document.title, url: document.url, tags: document.tags } };
        });

        const summaries = await Promise.all(analysisPromises);
        res.json({ success: true, summaries: summaries });

    } catch (error) {
        console.error("Fehler im Chat-Endpunkt:", error);
        res.status(500).json({ success: false, summaries: [], error: "Ein Fehler ist aufgetreten." });
    }
});


// --- Server-Start ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Nexus-Server v8 (Intelligenter Index) läuft auf Port ${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn("WARNUNG: OPENAI_API_KEY ist nicht gesetzt.");
    }
    initializeIndex();
});