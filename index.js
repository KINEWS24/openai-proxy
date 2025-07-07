// index.js – ThinkAI Nexus (Final Version with Correct Prompt Assignment)
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const axios = require("axios");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");
const { HierarchicalNSW } = require("hnswlib-node");

// === CONFIGURATION =================================================
const CAPTURE_PROMPT_PATH = path.join(__dirname, "nexus_prompt_v5.3.txt"); // The "Architect" for capturing
const CHAT_PROMPT_PATH = path.join(__dirname, "chat_summary_prompt.txt");   // The "Analyst" for chat
const KNOWLEDGE_PATH = path.join(__dirname, "knowledge");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_CONTENT_LENGTH = 8000;
const EMBEDDING_MODEL = "text-embedding-3-small";
const COMPLETION_MODEL = "gpt-4o";
const SIMILARITY_THRESHOLD = 0.5;
// ===================================================================

const app = express();
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
let knowledgeIndex = null;
let knowledgeData = [];
let isIndexReady = false;

// --- Knowledge Index Initialization ---
async function initializeIndex() {
    console.log("Initializing knowledge index in the background...");
    try {
        const files = await fs.readdir(KNOWLEDGE_PATH);
        const mdFiles = files.filter(file => file.endsWith('.nexus.md'));
        if (mdFiles.length === 0) {
            console.log("No .nexus.md files found in 'knowledge' folder.");
            isIndexReady = true;
            return;
        }

        console.log(`Reading and parsing ${mdFiles.length} knowledge files...`);
        let validDocuments = [];

        for (const file of mdFiles) {
            const fileContent = await fs.readFile(path.join(KNOWLEDGE_PATH, file), 'utf8');
            
            const titleMatch = fileContent.match(/\*\*(.*?)\*\*/);
            const title = titleMatch ? titleMatch[1] : '';
            const summaryMatch = fileContent.match(/"Summary":\s*"(.*?)"/);
            const summary = summaryMatch ? summaryMatch[1] : '';
            const tagsMatch = fileContent.match(/Schlagwörter: (.*)/);
            const tagsText = tagsMatch ? tagsMatch[1] : '';
            const urlMatch = fileContent.match(/Quelle: (https?:\/\/[^\s]+)/);
            const url = urlMatch ? urlMatch[1] : null;

            const cleanTextForIndexing = [title, summary, tagsText].join(' ').trim();
            
            if (cleanTextForIndexing) {
                validDocuments.push({ 
                    sourceFile: file, 
                    contentForEmbedding: cleanTextForIndexing.toLowerCase(),
                    fullContent: fileContent,
                    title: title || file,
                    url: url,
                    tags: tagsText ? tagsText.split(',').map(t => t.trim()) : []
                });
            } else {
                console.warn(`File ${file} has no extractable content and will be ignored.`);
            }
        }

        if (validDocuments.length === 0) {
            console.log("No valid documents found to index.");
            isIndexReady = true;
            return;
        }
        
        knowledgeData = validDocuments;
        const documentsForEmbedding = knowledgeData.map(d => d.contentForEmbedding);

        console.log(`Creating vector embeddings for ${knowledgeData.length} valid documents...`);
        const embeddingsResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: documentsForEmbedding });

        const numDimensions = embeddingsResponse.data[0].embedding.length;
        knowledgeIndex = new HierarchicalNSW('l2', numDimensions);
        knowledgeIndex.initIndex(knowledgeData.length);
        embeddingsResponse.data.forEach((embeddingObj, i) => { knowledgeIndex.addPoint(embeddingObj.embedding, i); });

        isIndexReady = true;
        console.log(`✅ Knowledge index with ${knowledgeData.length} documents successfully initialized!`);
    } catch (error) {
        console.error("Error during knowledge index initialization:", error);
    }
}

// --- Analysis function for new objects ---
async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) {
    const uuid = uuidv7();
    const timestamp = new Date().toISOString();
    const promptTemplate = await fs.readFile(CAPTURE_PROMPT_PATH, "utf8");
    const finalPrompt = promptTemplate.replace("{CONTENT}", contentRaw).replace("{SOURCEURL}", sourceUrl || "N/A").replace("{UUID}", uuid).replace("{TIMESTAMP_ISO}", timestamp);
    
    if (!OPENAI_API_KEY) { throw new Error("OpenAI API Key is not configured."); }
    
    const gptResponse = await openai.chat.completions.create({ model: COMPLETION_MODEL, messages: [{ role: "user", content: finalPrompt }] });
    const analysisResultText = gptResponse.choices[0]?.message?.content;
    
    if (!analysisResultText) { throw new Error("Invalid response from OpenAI API."); }
    
    const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/);
    let top3Tags = [];
    if (tagsHeaderMatch && tagsHeaderMatch[1]) {
        top3Tags = tagsHeaderMatch[1].split(',').slice(0, 3).map(tag => slugify(tag.replace(/#/g, '')));
    }
    
    const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
    const baseName = [contextUUID, uuid, archetype.toLowerCase(), tsForName, ...top3Tags].filter(Boolean).join("_");
    const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/);
    const tagsJsonContent = jsonBlockMatch ? jsonBlockMatch[0] : JSON.stringify({ error: "Could not extract JSON block." });
    
    return { nexusMd: { filename: `${baseName}.nexus.md`, content: analysisResultText }, tagsJson: { filename: `${baseName}.tags.json`, content: tagsJsonContent }, originalFilenameBase: baseName };
}

// --- Middleware and API Endpoints ---
app.use(bodyParser.json({ limit: "15mb" }));

app.get("/", (req, res) => res.json({ status: "OK", message: `Nexus Heartbeat v13. Index Status: ${isIndexReady ? 'Ready' : 'Initializing...'}` }));

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
    try {
        if (!contentRaw || typeof contentRaw !== 'string' || contentRaw.trim() === '') {
            return res.status(400).json({ success: false, error: "Missing or empty content for analysis." });
        }
        const { context_uuid } = req.body;
        const output = await generateNexusObject({ archetype, contextUUID: context_uuid || "default-nexus-context", contentRaw, sourceUrl });
        output.originalFilename = `${output.originalFilenameBase}.original.${extension}`;
        delete output.originalFilenameBase;
        res.json({ success: true, ...output });
    } catch (err) {
        console.error(`Error in /analyze-${archetype}:`, err);
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
        console.error(`Error scraping URL ${url}:`, err.message);
    }
    const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH);
    await handleAnalysisRequest(req, res, "link", truncatedText, url, "html");
});

app.post("/analyze-image", (req, res) => {
    handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

app.post("/chat", async (req, res) => {
    const { query } = req.body;
    if (!isIndexReady) { return res.status(503).json({ success: false, summaries: [], error: "Knowledge base is still initializing." }); }
    if (!query) { return res.status(400).json({ success: false, summaries: [] }); }

    try {
        const normalizedQuery = query.toLowerCase();
        const queryEmbeddingResponse = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: normalizedQuery });
        const queryVector = queryEmbeddingResponse.data[0].embedding;
        
        const searchResults = knowledgeIndex.searchKnn(queryVector, 5);

        let qualifiedIndices = [];
        for (let i = 0; i < searchResults.neighbors.length; i++) {
            if (searchResults.distances[i] < SIMILARITY_THRESHOLD) {
                qualifiedIndices.push(searchResults.neighbors[i]);
            }
        }
        
        const uniqueIndices = [...new Set(qualifiedIndices)];
        if (uniqueIndices.length === 0) {
            return res.json({ success: true, summaries: [] });
        }
        
        const chatPromptTemplate = await fs.readFile(CHAT_PROMPT_PATH, "utf8");

        const analysisPromises = uniqueIndices.slice(0, 3).map(async (index) => {
            const document = knowledgeData[index];
            const analysisPrompt = chatPromptTemplate.replace("{fullContent}", document.fullContent);
            
            const completionResponse = await openai.chat.completions.create({ model: COMPLETION_MODEL, messages: [{ role: "user", content: analysisPrompt }], temperature: 0.1 });
            let rawAnswer = completionResponse.choices[0].message.content || "";
            let topic = "Unknown Topic";
            let summaryText = "Could not generate summary.";
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
        console.error("Error in /chat endpoint:", error);
        res.status(500).json({ success: false, summaries: [], error: "An error occurred." });
    }
});


// --- Server Start ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Nexus Server v13 (final logic) is running on Port ${PORT}`);
    if (!OPENAI_API_KEY) {
        console.warn("WARNING: OPENAI_API_KEY is not set.");
    }
    initializeIndex();
});