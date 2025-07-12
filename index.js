// index.js – ThinkAI Nexus (v28 inkl. DEBUG Chat)

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
  res.json({ status: "OK", message: "Nexus Heartbeat v28 DEBUG" });
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

// --- DEBUG CHAT-ENDPOINT ---
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

    // DEBUG: Dateien auflisten
    console.log("=== CHAT DEBUG START ===");
    console.log("KNOWLEDGE_DIR:", KNOWLEDGE_DIR);
    
    const allFiles = await fs.readdir(KNOWLEDGE_DIR);
    const jsonFiles = allFiles.filter(f => f.endsWith(".tags.json"));
    
    console.log("Gefundene Dateien:", allFiles.length);
    console.log("JSON-Dateien:", jsonFiles.length);
    console.log("Erste 5 JSON-Dateien:", jsonFiles.slice(0, 5));
    
    // Erste JSON-Datei testen
    if (jsonFiles.length > 0) {
      try {
        const testFile = jsonFiles[0];
        const testContent = await fs.readFile(path.join(KNOWLEDGE_DIR, testFile), "utf8");
        const testMeta = JSON.parse(testContent);
        console.log("Test-Datei:", testFile);
        console.log("Test-Inhalt Titel:", testMeta.Title);
        console.log("Test-Inhalt Tags:", testMeta.Tags);
        
        // Suchtext erstellen
        const searchableText = [
          testMeta.Title || "",
          testMeta.Summary || "",
          (testMeta.KeyPoints || []).join(" "),
          (testMeta.Tags || []).join(" "),
          testMeta.Subject || ""
        ].join(" ").toLowerCase();
        
        console.log("Suchbarer Text (erste 100 Zeichen):", searchableText.substring(0, 100));
        console.log("Query:", query.toLowerCase());
        console.log("Workshop in suchbarem Text?", searchableText.includes("workshop"));
        
      } catch (fileErr) {
        console.log("Fehler beim Testen einer Datei:", fileErr.message);
      }
    }
    
    console.log("=== CHAT DEBUG END ===");

    // Debug-Antwort
    return res.json({
      debug: true,
      query: query,
      knowledgeDir: KNOWLEDGE_DIR,
      totalFiles: allFiles.length,
      jsonFiles: jsonFiles.length,
      firstFiveFiles: jsonFiles.slice(0, 5),
      message: "Debug-Modus aktiv - siehe Server-Logs für Details"
    });

  } catch (err) {
    console.error("Debug-Fehler:", err);
    return res.status(500).json({
      debug: true,
      error: err.message,
      stack: err.stack
    });
  }
});

// Nexus-All-in-One-Endpoint
app.use("/nexus", nexusRouter);

// --- SCHRITT 5: SERVER START ---
initializeApp()
  .then(() => {
    app.listen(PORT, () => console.log(`Nexus v28 DEBUG running on port ${PORT}`));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });