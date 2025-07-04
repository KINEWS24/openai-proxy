const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { OpenAI } = require("openai");

const app = express();
app.use(express.json());

// OpenAI-API initialisieren
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Beispiel-Endpunkt: Standard-Proxy für OpenAI (nur falls benötigt) ---
// app.post("/openai", async (req, res) => {
//     // Dein Standard-Proxy-Handling, falls gebraucht
// });

// --- NEUER ENDPOINT: scrape-and-analyze-url ---
app.post("/scrape-and-analyze-url", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL provided" });

    try {
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = $("title").text() || "";
        // Einfacher Artikeltext-Extractor:
        const article = $("article").text() || $("body").text();
        const shortText = article.substring(0, 3000); // OpenAI-Input begrenzen

        // Prompt an OpenAI
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
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Fehler beim Scraping oder bei der Analyse." });
    }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy läuft auf Port ${PORT}`);
});
