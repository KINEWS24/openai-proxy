// index.js – ThinkAI Nexus (v28 inkl. repariertem Chat)

// --- SCHRITT 1: IMPORTS & KONSTANTEN ---
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const { OpenAI } = require("openai");
const { google } = require("googleapis");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

// Nexus-All-in-One-Router
const nexusRouter = require("./modules/nexus");

// Globale Konfigurationen
const KNOWLEDGE_DIR         = path.join(__dirname, "knowledge");
const CAPTURE_PROMPT_PATH   = path.join(__dirname, "nexus_prompt_v5.3.txt");
const CLASSIFIER_PROMPT_PATH= path.join(__dirname, "nexus_prompt_classifier_v1.0.txt");
const CLASSIFIER_OUTPUT_DIR = path.join(__dirname, "classifier-output");
const OPENAI_API_KEY        = process.env.OPENAI_API_KEY;
const SCRAPER_API_KEY       = process.env.SCRAPER_API_KEY;
const MAX_CONTENT_LENGTH    = 8000;
const COMPLETION_MODEL      = "gpt-4o";
const PORT                  = process.env.PORT || 10000;

// Default-Optionen für Chat
const defaultChatOptions = {
  topK: 10,
  sortBy: "relevance",
  includeHighlights: true
};

// Globale Instanzen
let openai;

// --- SCHRITT 2: INITIALISIERUNG ---
async function initializeApp() {
  if (!OPENAI_API_KEY) {
    console.error("FATAL: OPENAI_API_KEY ist nicht gesetzt.");
    process.exit(1);
  }
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Prüfe Prompt-Dateien
  try {
    await fs.access(CAPTURE_PROMPT_PATH);
    await fs.access(CLASSIFIER_PROMPT_PATH);
  } catch (err) {
    console.error("FATAL: Eine Prompt-Datei fehlt.", err);
    process.exit(1);
  }

  // Ordner für Klassifizierer-Ausgabe
  try {
    await fs.mkdir(CLASSIFIER_OUTPUT_DIR, { recursive: true });
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  } catch (err) {
    console.error("FATAL: Konnte Verzeichnisse nicht anlegen.", err);
    process.exit(1);
  }

  if (!SCRAPER_API_KEY) {
    console.warn("WARN: SCRAPER_API_KEY nicht gesetzt, nutze Puppeteer-Fallback");
  }
}

// --- SCHRITT 3: HILFSFUNKTIONEN ---

// Klassifiziert Content mit OpenAI
async function classifyContent(content, sourceUrl = null) {
  try {
    const classifierPrompt = await fs.readFile(CLASSIFIER_PROMPT_PATH, 'utf8');
    const prompt = `${classifierPrompt}\n\nContent:\n${content.substring(0, 2000)}`;
    
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    });
    
    const result = response.choices[0]?.message?.content || "";
    
    // Speichere Klassifizierer-Output
    const outputId = uuidv7();
    await fs.writeFile(
      path.join(CLASSIFIER_OUTPUT_DIR, `classification_${outputId}.txt`),
      result
    );
    
    return { success: true, classification: result, outputId };
  } catch (error) {
    console.error("Fehler bei classifyContent:", error);
    return { success: false, error: error.message };
  }
}

// Generiert Nexus-Objekt mit OpenAI
async function generateNexusObject(content, sourceUrl = null, contextUuid = null) {
  try {
    const capturePrompt = await fs.readFile(CAPTURE_PROMPT_PATH, 'utf8');
    const prompt = `${capturePrompt}\n\nContent:\n${content}\n\nSource URL: ${sourceUrl || 'N/A'}`;
    
    const response = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 2000
    });
    
    const nexusContent = response.choices[0]?.message?.content || "";
    return { success: true, content: nexusContent };
  } catch (error) {
    console.error("Fehler bei generateNexusObject:", error);
    return { success: false, error: error.message };
  }
}

// Wrapper für Analyse-Requests
async function handleAnalysisRequest(analysisFunction, req, res) {
  try {
    const result = await analysisFunction(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Fehler in handleAnalysisRequest:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Text-Content bereinigen
function cleanTextContent(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside').remove();
  return $.text().replace(/\s+/g, ' ').trim();
}

// Web-Scraping mit ScraperAPI oder Puppeteer
async function scrapeUrl(url) {
  try {
    if (SCRAPER_API_KEY) {
      const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
      const response = await fetch(scraperUrl);
      return await response.text();
    } else {
      // Puppeteer Fallback
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
      const content = await page.content();
      await browser.close();
      return content;
    }
  } catch (error) {
    console.error("Scraping-Fehler:", error);
    throw error;
  }
}

// --- SCHRITT 4: EXPRESS APP & MIDDLEWARE ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => { 
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`); 
  next(); 
});

// Health Check
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Nexus Heartbeat v28" });
});

// --- ANALYSE-ENDPOINTS ---

// Text-Analyse
app.post("/analyze-text", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { content, source_url } = body;
    if (!content) {
      return { success: false, error: "Content ist erforderlich" };
    }
    
    const cleanContent = cleanTextContent(content);
    if (cleanContent.length > MAX_CONTENT_LENGTH) {
      cleanContent = cleanContent.substring(0, MAX_CONTENT_LENGTH);
    }
    
    const result = await generateNexusObject(cleanContent, source_url);
    return result;
  }, req, res);
});

// Bild-Analyse
app.post("/analyze-image", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { image_url, source_url } = body;
    if (!image_url) {
      return { success: false, error: "image_url ist erforderlich" };
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Analysiere dieses Bild und erstelle eine Nexus-Objekt-Beschreibung:" },
            { type: "image_url", image_url: { url: image_url } }
          ]
        }],
        max_tokens: 1000
      });
      
      const analysis = response.choices[0]?.message?.content || "";
      const result = await generateNexusObject(analysis, source_url);
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, req, res);
});

// Link-Analyse
app.post("/analyze-link", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { url } = body;
    if (!url) {
      return { success: false, error: "URL ist erforderlich" };
    }
    
    try {
      const html = await scrapeUrl(url);
      const cleanContent = cleanTextContent(html);
      const limitedContent = cleanContent.substring(0, MAX_CONTENT_LENGTH);
      
      const result = await generateNexusObject(limitedContent, url);
      return result;
    } catch (error) {
      return { success: false, error: `Scraping-Fehler: ${error.message}` };
    }
  }, req, res);
});

// Klassifizierungs-Endpoint
app.post("/classify", async (req, res) => {
  await handleAnalysisRequest(async (body) => {
    const { content, source_url } = body;
    if (!content) {
      return { success: false, error: "Content ist erforderlich" };
    }
    
    const result = await classifyContent(content, source_url);
    return result;
  }, req, res);
});

// --- REPARIERTER CHAT-ENDPOINT ---
app.post("/chat", async (req, res) => {
  try {
    // 1) Header-Auth prüfen
    const auth = req.header("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing Authorization header", details: {} }
      });
    }

    // 2) Body-Validation
    const { query, context, options = {} } = req.body;
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_QUERY", message: "query darf nicht leer sein", details: {} }
      });
    }
    if (!context || !context.folderId) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_CONTEXT", message: "context.folderId ist erforderlich", details: {} }
      });
    }

    // 3) Optionen mit Defaults mergen
    const chatOpts = { ...defaultChatOptions, ...options };

    // 4) Knowledge-Dateien laden
    const allFiles = await fs.readdir(KNOWLEDGE_DIR);
    const jsonFiles = allFiles.filter(f => f.endsWith(".tags.json"));
    const docs = [];
    
    for (const file of jsonFiles) {
      try {
        const content = await fs.readFile(path.join(KNOWLEDGE_DIR, file), "utf8");
        const meta = JSON.parse(content);
        
        // Durchsuchbaren Text zusammenbauen
        const searchableText = [
          meta.Title || "",
          meta.Summary || "",
          (meta.KeyPoints || []).join(" "),
          (meta.Tags || []).join(" "),
          meta.Subject || ""
        ].join(" ").toLowerCase();
        
        docs.push({
          id: file.replace(".tags.json", ""),
          json: meta,
          searchableText: searchableText,
          filename: file
        });
      } catch (err) {
        console.warn(`Fehler beim Laden von ${file}:`, err.message);
        continue;
      }
    }

    // 5) Volltext-Suche & Scoring
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    const scored = docs.map(doc => {
      let score = 0;
      
      // Einfaches Scoring: Anzahl gefundener Query-Wörter
      for (const word of queryWords) {
        const matches = (doc.searchableText.match(new RegExp(word, "g")) || []).length;
        score += matches;
      }
      
      return { ...doc, score };
    }).filter(d => d.score > 0);

    // 6) Nach Score sortieren
    scored.sort((a, b) => b.score - a.score);
    const totalMatches = scored.length;
    const topDocs = scored.slice(0, chatOpts.topK);

    // 7) Results für Response aufbereiten
    const results = topDocs.map(d => ({
      id: d.id,
      archetype: d.json.Archetype || "unknown", 
      excerpt: (d.json.Summary || "").substring(0, 150) + "...",
      highlights: queryWords, // Einfach: zeige Suchwörter
      relevanceScore: d.score,
      tags: d.json.Tags || [],
      timestamp: d.json.UZT_ISO8601 || null,
      title: d.json.Title || "Ohne Titel"
    }));

    // 8) GPT-Antwort generieren
    const context_for_gpt = results.map(r => 
      `${r.title}: ${r.excerpt.replace("...", "")} (Tags: ${r.tags.join(", ")})`
    ).join("\n");
    
    const prompt = `Beantworte die Frage basierend auf diesen Dokumenten:

Frage: ${query}

Verfügbare Dokumente:
${context_for_gpt}

Antwort auf Deutsch:`;

    const gptRes = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    });
    
    const answerText = gptRes.choices[0]?.message?.content || "Keine Antwort generiert.";

    // 9) Response zusammenstellen
    return res.json({
      success: true,
      meta: {
        query,
        totalMatches,
        hasMore: totalMatches > chatOpts.topK,
        processingTime: "~200ms"
      },
      results,
      answer: {
        text: answerText.trim(),
        sources: results.map(r => r.id),
        confidence: null
      }
    });

  } catch (err) {
    console.error("Fehler im /chat-Endpoint:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: err.message, details: {} }
    });
  }
});

// Nexus-All-in-One-Endpoint
app.use("/nexus", nexusRouter);

// --- SCHRITT 5: SERVER START ---
initializeApp()
  .then(() => {
    app.listen(PORT, () => console.log(`Nexus v28 running on port ${PORT}`));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });