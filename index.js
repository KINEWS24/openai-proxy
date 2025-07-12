// index.js – ThinkAI Nexus (v24 - Robuste Architektur)

// --- SCHRITT 1: IMPORTS & KONSTANTEN ---
const express = require("express");
const cors = require("cors"); // Wichtig für die sichere Kommunikation mit der Extension
const fs = require("fs").promises;
const path = require("path");
const { uuidv7 } = require("uuidv7");
const { OpenAI } = require("openai");
const { google } = require("googleapis");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

// Globale Konfigurationen
const CAPTURE_PROMPT_PATH      = path.join(__dirname, "nexus_prompt_v5.3.txt");
const CLASSIFIER_PROMPT_PATH   = path.join(__dirname, "nexus_prompt_classifier_v1.0.txt");
const CLASSIFIER_OUTPUT_DIR    = path.join(__dirname, "classifier-output");
const OPENAI_API_KEY           = process.env.OPENAI_API_KEY;
const SCRAPER_API_KEY          = process.env.SCRAPER_API_KEY;
const MAX_CONTENT_LENGTH       = 8000;
const COMPLETION_MODEL         = "gpt-4o";
const PORT                     = process.env.PORT || 10000;

// Globale Instanzen
let openai;

// --- SCHRITT 2: EXPRESS APP & MIDDLEWARE INITIALISIERUNG ---
const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => {
  console.log(`[DIAGNOSE] Eingehende Anfrage: ${req.method} ${req.path}`);
  next();
});

// --- SCHRITT 3: HILFSFUNKTIONEN ---
async function initializeApp() {
  if (!OPENAI_API_KEY) {
    console.error("FATALER FEHLER: OPENAI_API_KEY ist in der Umgebung nicht gesetzt.");
    process.exit(1);
  }
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Existenz der Prompt-Dateien prüfen
  try {
    await fs.access(CAPTURE_PROMPT_PATH);
    console.log("✅ Prompt-Datei 'nexus_prompt_v5.3.txt' erfolgreich gefunden.");
  } catch {
    console.error("FATALER FEHLER: Die Prompt-Datei 'nexus_prompt_v5.3.txt' konnte nicht gefunden werden.");
    process.exit(1);
  }
  try {
    await fs.access(CLASSIFIER_PROMPT_PATH);
    console.log("✅ Prompt-Datei 'nexus_prompt_classifier_v1.0.txt' erfolgreich gefunden.");
  } catch {
    console.error("FATALER FEHLER: Die Prompt-Datei 'nexus_prompt_classifier_v1.0.txt' konnte nicht gefunden werden.");
    process.exit(1);
  }

  // Output-Ordner für Klassifizierer anlegen, falls nicht vorhanden
  try {
    await fs.mkdir(CLASSIFIER_OUTPUT_DIR, { recursive: true });
    console.log(`✅ Ordner '${CLASSIFIER_OUTPUT_DIR}' vorhanden.`);
  } catch (err) {
    console.error(`FATALER FEHLER: Ordner '${CLASSIFIER_OUTPUT_DIR}' konnte nicht erstellt werden.`, err);
    process.exit(1);
  }

  if (!SCRAPER_API_KEY) {
    console.warn("WARNUNG: SCRAPER_API_KEY ist nicht gesetzt. Fallback auf Puppeteer wird verwendet.");
  } else {
    console.log("✅ ScraperAPI Key erfolgreich gefunden und wird für die Link-Analyse verwendet.");
  }
}

// Generischer Klassifizierer
async function classifyContent(contentRaw, sourceUrl) {
  // 1. Prompt laden
  const promptTpl = await fs.readFile(CLASSIFIER_PROMPT_PATH, "utf8");
  // 2. Platzhalter ersetzen
  const finalPrompt = promptTpl
    .replace("{CONTENT}", contentRaw)
    .replace("{SOURCEURL}", sourceUrl || "N/A");
  // 3. Anfrage an OpenAI
  const response = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    messages: [{ role: "user", content: finalPrompt }]
  });
  // 4. Antwort auslesen und als JSON parsen
  const jsonString = response.choices[0]?.message?.content;
  if (!jsonString) {
    throw new Error("Keine valide Antwort vom Klassifizierer erhalten.");
  }
  return JSON.parse(jsonString);
}

// Bestehender Nexus-Generator (unverändert)
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

  const analysisResultText = gptResponse.choices[0]?.message?.content;
  if (!analysisResultText) throw new Error("Keine valide Antwort vom OpenAI API erhalten.");

  const tagsHeaderMatch = analysisResultText.match(/Schlagwörter: (.*)/);
  const top3Tags = tagsHeaderMatch?.[1]
    ?.split(',')
    .slice(0, 3)
    .map(tag => tag.replace(/#/g, '').toLowerCase().trim()) || [];
  const tsForName = timestamp.replace(/[:.]/g, "").substring(0, 15) + "Z";
  const baseName = [
    contextUUID,
    uuid,
    archetype.toLowerCase(),
    tsForName,
    ...top3Tags
  ].filter(Boolean).join("_");

  const jsonBlockMatch = analysisResultText.match(/{\s*"OwnerUserID":[\s\S]*?}/);
  const tagsJsonContent = jsonBlockMatch
    ? jsonBlockMatch[0]
    : JSON.stringify({ error: "Konnte JSON-Block nicht extrahieren." });

  return {
    nexusMd: {
      filename: `${baseName}.nexus.md`,
      content: analysisResultText
    },
    tagsJson: {
      filename: `${baseName}.tags.json`,
      content: tagsJsonContent
    },
    originalFilenameBase: baseName
  };
}

async function handleAnalysisRequest(req, res, archetype, contentRaw, sourceUrl, extension) {
  try {
    const { context_uuid } = req.body;
    const output = await generateNexusObject({
      archetype,
      contextUUID: context_uuid || "default-nexus-context",
      contentRaw,
      sourceUrl
    });
    output.originalContent = contentRaw;
    output.originalFilename = `${output.originalFilenameBase}.original.${extension}`;
    delete output.originalFilenameBase;
    res.json({ success: true, ...output });
  } catch (err) {
    console.error(`Fehler bei /analyze-${archetype}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// --- SCHRITT 4: Routen-Definition ---

app.get("/", (req, res) => {
  res.json({ status: "OK", message: `Nexus Heartbeat v24 (Robuste Architektur)` });
});

// Text-Analyse
app.post("/analyze-text", (req, res) => {
  const htmlContent = req.body.content || "";
  const $ = cheerio.load(htmlContent);
  $('script, style, noscript, iframe, footer, header, nav').remove();
  const cleanText = $.text().replace(/\s\s+/g, ' ').trim();
  const truncatedText = cleanText.substring(0, MAX_CONTENT_LENGTH);
  handleAnalysisRequest(req, res, "text", truncatedText, req.body.source_url, "html");
});

// Link-Analyse
app.post("/analyze-link", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: "Keine URL angegeben." });

  // ScraperAPI-Fallback
  if (SCRAPER_API_KEY) {
    try {
      console.log(`Versuche Scraping für ${url} über ScraperAPI...`);
      const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
      const response = await fetch(scraperUrl, { timeout: 45000 });
      if (!response.ok) throw new Error(`ScraperAPI antwortete mit Status ${response.status}.`);
      const htmlContent = await response.text();
      console.log(`Scraping mit ScraperAPI erfolgreich für ${url}.`);
      const $ = cheerio.load(htmlContent);
      $('script, style, noscript, iframe, footer, header, nav, aside, form').remove();
      let scrapedText = $('body').text().replace(/\s\s+/g, ' ').trim();
      if (!scrapedText) throw new Error("Kein sinnvoller Text nach dem Scraping gefunden.");
      const truncatedText = scrapedText.substring(0, MAX_CONTENT_LENGTH);
      return handleAnalysisRequest(req, res, "link", truncatedText, url, "url");
    } catch (err) {
      console.warn(`ScraperAPI-Analyse fehlgeschlagen: ${err.message}. Fallback-Link-Objekt.`);
      const fallbackContent = `Link: ${url}\n\nHinweis: Der Link wurde als Referenz gespeichert.`;
      return handleAnalysisRequest(req, res, "link-fallback", fallbackContent, url, "url");
    }
  }

  // On-Demand Puppeteer-Fallback
  console.warn("Kein SCRAPER_API_KEY, nutze Puppeteer-Fallback.");
  let browser = null;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    const htmlContent = await page.content();
    const $ = cheerio.load(htmlContent);
    $('script, style, noscript, iframe, footer, header, nav, aside, form').remove();
    let scrapedText = $('body').text().replace(/\s\s+/g, ' ').trim();
    if (!scrapedText) throw new Error("Kein sinnvoller Text gefunden.");
    const truncatedText = scrapedText.substring(0, MAX_CONTENT_LENGTH);
    await handleAnalysisRequest(req, res, "link", truncatedText, url, "url");
  } catch (err) {
    console.warn(`Puppeteer-Fallback fehlgeschlagen: ${err.message}. Fallback-Link-Objekt.`);
    const fallbackContent = `Link: ${url}\n\nHinweis: Der Link wurde als Referenz gespeichert.`;
    await handleAnalysisRequest(req, res, "link-fallback", fallbackContent, url, "url");
  } finally {
    if (browser) await browser.close();
    console.log("Puppeteer-Browser geschlossen.");
  }
});

// Bild-Analyse
app.post("/analyze-image", (req, res) => {
  handleAnalysisRequest(req, res, "image", req.body.image_url, req.body.source_url || req.body.image_url, "url");
});

// **Neuer** Klassifizierer-Endpoint
app.post("/classify", async (req, res) => {
  const { content, source_url } = req.body;
  if (!content) {
    return res.status(400).json({ success: false, error: "Kein Content zum Klassifizieren übermittelt." });
  }
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

// Chat-Funktion (Drive-Zugriff)
app.post("/chat", async (req, res) => {
  const { query, token, folderId } = req.body;
  if (!token || !query || !folderId) {
    return res.status(400).json({ success: false, answer: "Fehlende Anfrage-Parameter." });
  }
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and name contains '.nexus.md' and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 200,
      orderBy: 'createdTime desc'
    });
    const files = listRes.data.files;
    if (!files || files.length === 0) {
      return res.json({ success: false, answer: "Ich konnte noch keine Wissens-Dateien in Ihrem Nexus-Ordner finden." });
    }

    const queryKeywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
    const relevant = files.filter(f => queryKeywords.every(kw => f.name.toLowerCase().includes(kw))).slice(0, 5);
    const filesToRead = relevant.length ? relevant : files.slice(0, 5);

    const contents = await Promise.all(
      filesToRead.map(f =>
        drive.files.get({ fileId: f.id, alt: 'media' })
          .then(r => `Quelle: ${f.name}\nInhalt:\n${r.data}`)
      )
    );
    const context = contents.join("\n\n---\n\n").substring(0, MAX_CONTENT_LENGTH * 2);

    const chatPrompt = `Beantworte die Frage des Nutzers präzise und bündig anhand der folgenden Dokumente, ohne sie zu zitieren:\n\n---\n${context}\n---\n\nFrage des Nutzers:\n${query}\n\nAntwort:`;
    const completionResponse = await openai.chat.completions.create({
      model: COMPLETION_MODEL,
      messages: [{ role: "user", content: chatPrompt }],
      temperature: 0.2
    });
    const answer = completionResponse.choices[0]?.message?.content;
    if (!answer) throw new Error("Die KI hat keine Antwort generiert.");
    res.json({ success: true, answer });
  } catch (error) {
    console.error("Fehler im /chat Endpunkt:", error.response?.data || error.message);
    const status = error.response?.status === 401 ? 401 : 500;
    const message = status === 401
      ? "Ihr Google-Zugang ist abgelaufen oder ungültig. Bitte neu authentifizieren."
      : `Ein interner Serverfehler ist aufgetreten. Details: ${error.message}`;
    res.status(status).json({ success: false, answer: message });
  }
});

// --- SCHRITT 5: SERVER-START ---
initializeApp()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Nexus-Server v24 (Robuste Architektur) läuft auf Port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Fehler bei der App-Initialisierung:", err);
    process.exit(1);
  });