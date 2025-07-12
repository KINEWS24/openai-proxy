// index.js – ThinkAI Nexus (v27 – mit ICS-Export)

// --- SCHRITT 1: IMPORTS & KONSTANTEN ---
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const { OpenAI } = require("openai");
const { google } = require("googleapis");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

// Nexus-Helpers
const {
  classifyContent,
  generateNexusObject,
  handleAnalysisRequest
} = require("./utils/nexusHelpers");

// Router
const nexusRouter    = require("./modules/nexus");
const exportIcsRouter= require("./modules/exportIcs");

// --- SCHRITT 2: GLOBALE KONFIGURATION ---
const SCRAPER_API_KEY    = process.env.SCRAPER_API_KEY;
const MAX_CONTENT_LENGTH = 8000;
const PORT               = process.env.PORT || 10000;

// --- SCHRITT 3: EXPRESS APP INITIALISIEREN ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => {
  console.log(`[DIAGNOSE] ${req.method} ${req.path}`);
  next();
});

// --- SCHRITT 4: ICS-EXPORT ROUTER EINBINDEN ---
// exportIcsRouter definiert POST /export-ics
app.use("/", exportIcsRouter);

// --- SCHRITT 5: HEALTH CHECK ---
app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Nexus Heartbeat v27" });
});

// --- SCHRITT 6: ANALYSE-ENDPUNKTE ---

// Text-Analyse
app.post("/analyze-text", (req, res) => {
  const html = req.body.content || "";
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, footer, header, nav").remove();
  const text = $.text()
                .replace(/\s\s+/g, ' ')
                .trim()
                .substring(0, MAX_CONTENT_LENGTH);
  handleAnalysisRequest(req, res, "text", text, req.body.source_url, "html");
});

// Bild-Analyse
app.post("/analyze-image", (req, res) => {
  handleAnalysisRequest(
    req, res,
    "image",
    req.body.image_url,
    req.body.source_url || req.body.image_url,
    "url"
  );
});

// Link-Analyse
app.post("/analyze-link", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "Keine URL angegeben." });

  if (SCRAPER_API_KEY) {
    try {
      const apiUrl   = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl, { timeout: 45000 });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const html = await response.text();
      const $    = cheerio.load(html);
      $("script, style, noscript, iframe, footer, header, nav, aside, form").remove();
      const text = $("body").text()
                    .replace(/\s\s+/g, ' ')
                    .trim()
                    .substring(0, MAX_CONTENT_LENGTH);
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
    const $    = cheerio.load(html);
    $("script, style, noscript, iframe, footer, header, nav, aside, form").remove();
    const text = $("body").text()
                  .replace(/\s\s+/g, ' ')
                  .trim()
                  .substring(0, MAX_CONTENT_LENGTH);
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
    const meta   = await classifyContent(content, source_url);
    const uid    = meta.UID;
    const outDir = path.join(__dirname, "classifier-output");
    const outPath= path.join(outDir, `classification_${uid}.txt`);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(outPath, JSON.stringify(meta, null, 2), "utf8");
    res.json({ success: true, meta });
  } catch (err) {
    console.error("Fehler im Klassifizierer:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Nexus-All-in-One-Endpoint
app.use("/nexus", nexusRouter);

// --- SCHRITT 7: SERVER STARTEN ---
app.listen(PORT, () => {
  console.log(`Nexus v27 running on port ${PORT}`);
});