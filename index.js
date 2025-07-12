// index.js – ThinkAI Nexus (v27 inkl. Chat-MVP)

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
  } catch (err) {
    console.error("FATAL: Konnte classifier-output-Verzeichnis nicht anlegen.", err);
    process.exit(1);
  }

  if (!SCRAPER_API_KEY) {
    console.warn("WARN: SCRAPER_API_KEY nicht gesetzt, nutze Puppeteer-Fallback");
  }
}

// --- SCHRITT 3: HILFSFUNKTIONEN ---
// classifyContent, generateNexusObject, handleAnalysisRequest hier unverändert...

/* … [Hier kommen deine bestehenden Hilfsfunktionen aus v25 unverändert hin] … */

// --- SCHRITT 4: EXPRESS APP & MIDDLEWARE ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => { console.log(`[DIAGNOSE] ${req.method} ${req.path}`); next(); });

// Health Check
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Nexus Heartbeat v27" });
});

// … Deine analyze-text, analyze-image, analyze-link, classify-Endpoints hier unverändert …

// --- NEUER SCHRITT: Chat-MVP-Endpoint ---
app.post("/chat", async (req, res) => {
  try {
    // 1) Header-Auth prüfen
    const auth = req.header("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header", details: {} }
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
      const content = await fs.readFile(path.join(KNOWLEDGE_DIR, file), "utf8");
      let meta;
      try { meta = JSON.parse(content); } catch { continue; }
      docs.push({
        id:   file.replace(".tags.json",""),
        json: meta,
        text: JSON.stringify(meta) // für einfache Volltext-Suche
      });
    }

    // 5) Naive Volltext-Suche & Scoring
    const queryLower = query.toLowerCase();
    const scored = docs.map(doc => {
      const hits = (doc.text.toLowerCase().match(new RegExp(queryLower, "g")) || []).length;
      return { ...doc, score: hits };
    }).filter(d => d.score > 0);

    // 6) Sortierung nach score (Fallback: 0)
    scored.sort((a,b) => b.score - a.score);
    const totalMatches = scored.length;
    const topDocs = scored.slice(0, chatOpts.topK);

    // 7) Exzerpte & Highlights erzeugen
    const results = topDocs.map(d => ({
      id:             d.id,
      archetype:      d.json.archetype || "unknown",
      excerpt:        d.text.substring(0, 120) + "...",
      highlights:     [/* für MVP leer oder aus RegEx ableiten */],
      relevanceScore: d.score,
      tags:           d.json.Tags || [],
      timestamp:      d.json.TimestampISO || null
    }));

    // 8) GPT-Antwort generieren
    const prompt = [
      `Beantworte die Frage basierend auf den folgenden Dokumenten:`,
      `Query: ${query}`,
      `Dokumente:`,
      ...results.map(r => `- ${r.id}: ${r.excerpt}`),
      `Antwort:`
    ].join("\n");

    const gptRes = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });
    const answerText = gptRes.choices[0]?.message?.content || "";

    // 9) Response zusammenstellen
    return res.json({
      success: true,
      meta: {
        query,
        totalMatches,
        hasMore: totalMatches > chatOpts.topK,
        processingTime: `${gptRes.created - Math.floor(gptRes.created/1000)*1000}ms`
      },
      results,
      answer: {
        text: answerText.trim(),
        sources: results.map(r => r.id),
        confidence: null  // später aus GPT-Metadaten ableiten
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
    app.listen(PORT, () => console.log(`Nexus v27 running on port ${PORT}`));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });