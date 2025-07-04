const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");

const app = express();
app.use(express.json());

// OpenAI Konfiguration - neue Syntax
const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

// Test-Endpoint um zu sehen ob der Server läuft
app.get("/", (req, res) => {
    res.json({ message: "OpenAI Proxy Server läuft!" });
});

// Haupt-Endpoint für Scraping und Analyse
app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: "No URL provided" });
    }
    
    try {
        console.log(`Scraping URL: ${url}`);
        
        // Website laden
        const response = await fetch(url);
        const html = await response.text();
        
        // HTML parsen
        const $ = cheerio.load(html);
        const title = $("title").text() || "";
        const article = $("article").text() || $("body").text();
        const shortText = article.substring(0, 3000);
        
        console.log(`Titel gefunden: ${title}`);
        console.log(`Text-Länge: ${shortText.length}`);
        
        // OpenAI Analyse
        const prompt = `
Analysiere diesen Webartikel und fasse ihn als Bulletpoints zusammen. Gib eine Überschrift und die wichtigsten Punkte (3-7) an.

Titel: ${title}
Text: ${shortText}
Original-URL: ${url}
`;
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Du bist ein deutschsprachiger Webartikel-Analyst." },
                { role: "user", content: prompt }
            ]
        });
        
        const result = completion.choices[0].message.content;
        
        res.json({
            url,
            title,
            summary: result
        });
        
    } catch (error) {
        console.error("Fehler:", error);
        res.status(500).json({ 
            error: "Fehler beim Scraping oder bei der Analyse.",
            details: error.message 
        });
    }
});

// Port-Konfiguration für Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy läuft auf Port ${PORT}`);
});