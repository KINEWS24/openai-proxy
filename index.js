// index.js – ThinkAI Nexus (Finale Version mit Themen-Extraktion im Chat)
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
let isIndexReady = false;

async function initializeIndex() {
    console.log("Initialisiere Wissens-Index im Hintergrund...");
    try {
        const files = await fs.readdir(KNOWLEDGE_PATH);
        const mdFiles = files.filter(file => file.endsWith('.nexus.md'));

        if (mdFiles.length === 0) {
            console.log("Keine .nexus.md Dateien im 'knowledge' Ordner gefunden.");
            return;
        }

        console.log(`Lese und parse ${mdFiles.length} Wissens-Dateien...`);
        for (const file of mdFiles) {
            const fileContent = await fs.readFile(path.join(KNOWLEDGE_PATH, file), 'utf8');
            const titleMatch = fileContent.match(/\*\*(.*?)\*\*/);
            const title = titleMatch ? titleMatch[1] : file;
            const tagsMatch = fileContent.match(/Schlagwörter: (.*)/);
            const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
            const urlMatch = fileContent.match(/Quelle: (https?:\/\/[^\s]+)/);
            const url = urlMatch ? urlMatch[1] : null;

            knowledgeData.push({ 
                sourceFile: file, 
                content: fileContent.toLowerCase(),
                title: title,
                url: url,
                tags: tags
            });
        }

        console.log("Erstelle Vektor-Embeddings für das Wissen...");
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

        isIndexReady = true;
        console.log(`✅ Wissens-Index mit ${knowledgeData.length} Dokumenten erfolgreich initialisiert!`);

    } catch (error) {
        console.error("Fehler bei der Initialisierung des Wissens-Index:", error);
    }
}

// (Die Analyse-Funktionen bleiben unverändert)
// ...

// --- CHAT-ENDPUNKT (Überarbeitet für strukturierte Antwort mit Thema) ---
app.post("/chat", async (req, res) => {
    const { query } = req.body;

    if (!isIndexReady) {
        return res.status(503).json({ answer: "Entschuldigung, die Wissensbasis wird gerade noch initialisiert. Bitte versuche es in einem Moment erneut." });
    }
    if (!query) { return res.status(400).json({ answer: "Bitte gib eine Frage ein." }); }

    try {
        const normalizedQuery = query.toLowerCase();
        const queryEmbeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: normalizedQuery });
        const queryVector = queryEmbeddingResponse.data[0].embedding;
        
        const searchResults = knowledgeIndex.searchKnn(queryVector, 3);
        const contextSnippets = searchResults.neighbors.map(index => knowledgeData[index].content);
        const sourceMetadata = searchResults.neighbors.map(index => ({
            filename: knowledgeData[index].sourceFile,
            title: knowledgeData[index].title,
            url: knowledgeData[index].url,
            tags: knowledgeData[index].tags
        }));

        // NEU: Erweiterter Prompt, der explizit nach einem Thema fragt
        const chatPrompt = `Du bist ein hilfreicher Assistent. Beantworte die Frage des Nutzers präzise und ausschließlich basierend auf dem bereitgestellten Kontext.
1. Fasse den Kern der Antwort in einem kurzen, prägnanten Thema zusammen und schreibe es in die erste Zeile im Format "Thema: [Dein gefundenes Thema]".
2. Formuliere darunter eine hilfreiche, zusammenfassende Antwort in ganzen Sätzen.
3. Gib keine Dateinamen oder URLs in deiner Fließtext-Antwort an, fasse nur den Inhalt zusammen.
4. Wenn die Antwort nicht im Kontext enthalten ist, sage, dass du keine Informationen dazu hast und gib kein Thema an.

Kontext:
---
${contextSnippets.join("\n---\n")}
---

Frage des Nutzers:
${query}

Antwort:`;

        const completionResponse = await openai.chat.completions.create({ model: COMPLETION_MODEL, messages: [{ role: "user", content: chatPrompt }], temperature: 0.2 });
        let rawAnswer = completionResponse.choices[0].message.content;
        
        // NEU: Extrahiere Thema und reine Antwort aus dem KI-Output
        let topic = null;
        let finalAnswer = rawAnswer;

        const topicMatch = rawAnswer.match(/^Thema: (.*)/i);
        if (topicMatch && topicMatch[1]) {
            topic = topicMatch[1].trim();
            finalAnswer = rawAnswer.substring(topicMatch[0].length).trim(); // Der Rest ist die Antwort
        }
        
        res.json({ success: true, topic: topic, answer: finalAnswer, sources: sourceMetadata });

    } catch (error) {
        console.error("Fehler im Chat-Endpunkt:", error);
        res.status(500).json({ success: false, answer: "Ein Fehler ist bei der Bearbeitung deiner Anfrage aufgetreten." });
    }
});

// (Restliche Endpunkte und Server-Start bleiben gleich)
// ...
// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, async () => {
    console.log(`Nexus-Server v7 (Chat mit Thema) läuft auf Port ${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn("WARNUNG: OPENAI_API_KEY ist nicht gesetzt.");
    }
    initializeIndex();
});