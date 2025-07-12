// index.js – ThinkAI Nexus (v25 - Integrierter Nexus-Endpoint)

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
const CAPTURE_PROMPT_PATH    = path.join(__dirname, "nexus_prompt_v5.3.txt");
const CLASSIFIER_PROMPT_PATH = path.join(__dirname, "nexus_prompt_classifier_v1.0.txt");
const CLASSIFIER_OUTPUT_DIR  = path.join(__dirname, "classifier-output");
const OPENAI_API_KEY         = process.env.OPENAI_API_KEY;
const SCRAPER_API_KEY        = process.env.SCRAPER_API_KEY;
const MAX_CONTENT_LENGTH     = 8000;
const COMPLETION_MODEL       = "gpt-4o";
const PORT                   = process.env.PORT || 10000;

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
    console.log("✅ Found capture prompt");
    await fs.access(CLASSIFIER_PROMPT_PATH);
    console.log("✅ Found classifier prompt");
  } catch (err) {
    console.error("FATAL: Eine Prompt-Datei fehlt.", err);
    process.exit(1);
  }

  // Ordner für Klassifizierer-Ausgabe
  try {
    await fs.mkdir(CLASSIFIER_OUTPUT_DIR, { recursive: true });
    console.log("✅ Classifier output dir ready");
  } catch (err) {
    console.error("FATAL: Konnte classifier-output-Verzeichnis nicht anlegen.", err);
    process.exit(1);
  }

  if (!SCRAPER_API_KEY) {
    console.warn("WARN: SCRAPER_API_KEY nicht gesetzt, nutze Puppeteer-Fallback");
  }
}

// --- SCHRITT 3: HILFSFUNKTIONEN ---

/**
 * Klassifiziert den Input und liefert Metadaten als JSON-Objekt.
 */
async function classifyContent(contentRaw, sourceUrl) {
  const promptTpl = await fs.readFile(CLASSIFIER_PROMPT_PATH, "utf8");
  const finalPrompt = promptTpl
    .replace("{CONTENT}", contentRaw)
    .replace("{SOURCEURL}", sourceUrl || "N/A");
  const response = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    messages: [{ role: "user", content: finalPrompt }]
  });
  const jsonString = response.choices[0]?.message?.content;
  if (!jsonString) throw new Error("Keine valide Antwort vom Klassifizierer erhalten.");
  return JSON.parse(jsonString);
}

/**
 * Generiert die Nexus-Objekte (Markdown und JSON-Tags) basierend auf Prompt v5.3
 */
async function generateNexusObject({ archetype, contextUUID, contentRaw, sourceUrl }) {
  const uuid = uuidv7();
  const timestamp = new Date().toISOString();
  const promptTemplate = await fs.readFile(CAPTURE_PROMPT_PATH, "utf8");
  const finalPrompt = promptTemplate
    .replace("{CONTENT}", contentRaw)
    .replace("{SOURCEURL}", sourceUrl || "N/A")
    .replace("{UUID}", uuid)
    .replace("{TIMESTAMP_ISO}", timestamp);

  const gptResponse = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    messages: [{ role: "user", content: finalPrompt }]
  });
  const analysisText = gptResponse.choices[0]?.message?.content;
  if (!analysisText) throw new Error("Keine valide Antwort vom OpenAI API erhalten.");

  const tagsMatch = analysisText.match(/{[\s\S]*?}/);
  const tagsJson = tagsMatch ? tagsMatch[0] : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." });

  const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
  const baseName = [
    contextUUID,
    uuid,
    archetype.toLowerCase(),
    tsForName
  ].filter(Boolean).join("_");

  return {
    nexusMd: { filename: `${baseName}.nexus.md`, content: analysisText },
    tagsJson: { filename: `${baseName}.tags.json`, content: tagsJson }
  };
}

/**
 * Wrapper für Analyse-Anfragen (Text, Bild, Link)
 */
async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
  try {
    const { context_uuid } = req.body;
    const output = await generateNexusObject({
      archetype,
      contextUUID: context_uuid || "default-nexus-context",
      contentRaw,
      sourceUrl
    });
    output.originalFilename = `${output.nexusMd.filename.replace(/\.nexus\.md$/, '')}.original.${extension}`;
    res.json({ success: true, ...output });
  } catch (err) {
    console.error(`Fehler bei /analyze-${archetype}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// --- SCHRITT 4: EXPRESS APP & MIDDLEWARE ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => { console.log(`[DIAGNOSE] ${req.method} ${req.path}`); next(); });

// Health Check
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Nexus Heartbeat v25" });
});

// Text-Analyse
app.post("/analyze-text", (req, res) => {
  const html = req.body.content || "";
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, footer, header, nav").remove();
  const text = $.text().replace(/\s\s+/g, ' ').trim().substring(0, MAX_CONTENT_LENGTH);
  handleAnalysisRequest(req, res, "text", text, req.body.source_url, "html");
});

// Bild-Analyse
app.post("/analyze-image", (req, res) => {
  handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

// Link-Analyse
app.post("/analyze-link", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "Keine URL angegeben." });
  if (SCRAPER_API_KEY) {
    try {
      const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
      const response = await fetch(scraperUrl, { timeout: 45000 });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const html = await response.text();
      const $ = cheers.load(html);
      $("script, style, noscript, iframe, footer, header, nav, aside, form").remove();
      const text = $("body").text().replace(/\s\s+/g, ' ').trim().substring(0, MAX_CONTENT_LENGTH);
      return handleAnalysisRequest(req, res, "link", text, url, "url");
    } catch (err) {
      console.warn("ScraperAPI fehlgeschlagen, Fallback-Link.", err);
      const fallback = `Link: ${url}`;
      return handleAnalysisRequest(req, res, "link-fallback", fallback, url, "url");
    }
  }
  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    const html = await page.content();
    const $ = cheers.load(html);
    $("script, style, noscript, iframe, footer, header, nav, aside, form").remove();
    const text = $("body").text().replace(/\s\s+/g, ' ').trim().substring(0, MAX_CONTENT_LENGTH);
    return handleAnalysisRequest(req, res, "link", text, url, "url");
  } catch (err) {
    console.warn("Puppeteer-Fallback fehlgeschlagen, Fallback-Link.", err);
    const fallback = `Link: ${url}`;
    return handleAnalysisRequest(req, res, "link-fallback", fallback, url, "url");
  } finally {
    if (browser) await browser.close();
  }
});

// Klassifizierer-Endpoint
app.post("/classify", async (req, res) => {
  const { content, source_url } = req.body;
  if (!content) return res.status(400).json({ success: false, error: "Kein Content zum Klassifizieren." });
  try {
    const meta = await classifyContent(content, source_url);
    const uid = meta.UID;
    const outPath = path.join(CLASSIFIER_OUTPUT_DIR, `classification_${uid}.txt`);
    await fs.writeFile(outPath, JSON.stringify(meta, null, 2), "utf8");
    res.json({ success: true, meta });
  } catch (err) {
    console.error("Fehler im Klassifizierer:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Nexus-All-in-One-Endpoint
app.use("/nexus", nexusRouter);

// --- SCHRITT 5: SERVER START ---
initializeApp()
  .then(() => app.listen(PORT, () => console.log(`Nexus v25 running on port ${PORT}`)))
  .catch(err => { console.error(err); process.exit(1); });

// Exporte für modules/nexus
module.exports = { classifyContent, generateNexusObject, handleAnalysisRequest };