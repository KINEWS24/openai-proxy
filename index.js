const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");

const app = express();
app.use(express.json({ limit: '10mb' })); // Wichtig: Limit für Base64-Daten erhöhen

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/", (req, res) => res.json({ message: "ThinkAI Nexus Proxy v1.3" }));

// Endpunkt für reine Text-Analyse (wird vom background-script direkt aufgerufen)
app.post("/openai", async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "OpenAI API Key nicht konfiguriert" });
        const completion = await openai.chat.completions.create({ model: "gpt-4o", messages: req.body.messages });
        res.json(completion);
    } catch (error) {
        res.status(500).json({ error: "Fehler bei der OpenAI-Anfrage" });
    }
});

// Endpunkt für Scraping und Link-Analyse
app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $("title").text().trim() || "Kein Titel gefunden";
        const article = ($("article").text() || $("main").text() || $("body").text()).substring(0, 8000); // Mehr Text für besseren Kontext
        if (article.length < 100) return res.status(400).json({ error: "Zu wenig Text auf der Seite gefunden" });
        
        const prompt = getNexusPrompt("Text", article, { sourceUrl: url, title: title });
        const completion = await openai.chat.completions.create({ model: "gpt-4o", messages: [{ role: "user", content: prompt }] });
        const analysis = completion.choices[0].message.content;
        
        res.json({ success: true, title: title, analysis: analysis });
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Verarbeiten des Links", details: error.message });
    }
});

// Endpunkt für Base64-Bilddaten
app.post("/analyze-image-data", async (req, res) => {
    const { imageData, originalUrl } = req.body;
    if (!imageData) return res.status(400).json({ error: "No image data provided" });

    try {
        if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API Key nicht konfiguriert");

        const prompt = getNexusPrompt("Bild", `Bild von der URL: ${originalUrl}`);
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { "url": imageData } },
                ],
            }],
            max_tokens: 1500,
        });

        const analysis = completion.choices[0].message.content;
        const titleMatch = analysis.match(/\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[1] : "Bildanalyse";

        res.json({ title: title, analysis: analysis });
    } catch (error) {
        res.status(500).json({ error: "Fehler bei der OpenAI Vision-Anfrage" });
    }
});

// ZENTRALE PROMPT-FUNKTION
function getNexusPrompt(archetype, content, metadata = {}) {
    const inputSection = `Input-Objekt:\n- Archetyp (vorgegeben): ${archetype}\n- Inhalt: ${content}\n- Zusatz-Metadaten: ${JSON.stringify(metadata)}`;
    const promptCore = `\n\nGPT-PROMPT SYNAPSEFLOW OBJEKTGENERIERUNG V5.2\n... (Dein vollständiger V5.2 Prompt hier) ...`;
    return inputSection + promptCore;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));