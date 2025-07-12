# Stufe 1: Basis-Image
# Wir nutzen eine 'slim' Debian-Variante von Node.js für beste Kompatibilität.
FROM node:20-slim

# Stufe 2: Arbeitsverzeichnis setzen
# Hier wird unsere Anwendung leben.
WORKDIR /usr/src/app

# Stufe 3: System-Abhängigkeiten und Google Chrome nach modernem, sicherem Standard installieren
# Dies ist der entscheidende Schritt, um sicherzustellen, dass alle für Puppeteer benötigten
# Systembibliotheken (wie libnss3.so) vorhanden sind.
RUN apt-get update \
    # SCHRITT A: Installiere ZUERST die Basis-Werkzeuge für sichere Verbindungen.
    && apt-get install -y \
    curl \
    gnupg \
    ca-certificates \
    --no-install-recommends \
    \
    # SCHRITT B: Füge jetzt die Google-Paketquelle hinzu, da die Werkzeuge vorhanden sind.
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome-stable.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-stable.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    \
    # SCHRITT C: Aktualisiere die Paketliste erneut, damit die neue Quelle bekannt ist.
    && apt-get update \
    \
    # SCHRITT D: Installiere jetzt den Browser. Alle weiteren Abhängigkeiten werden automatisch mitgezogen.
    && apt-get install -y \
    google-chrome-stable \
    --no-install-recommends \
    \
    # SCHRITT E: Bereinigung, um das Image klein zu halten.
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove curl gnupg

# Stufe 4: Paket-Dateien kopieren und NPM-Abhängigkeiten installieren
# Wir kopieren zuerst nur die package.json, um den Docker-Cache zu nutzen.
COPY package*.json ./
# Jetzt installieren wir die Node.js-Abhängigkeiten unserer App.
RUN npm install

# Stufe 5: Einen neuen .puppeteerrc.cjs Konfigurationsfile erstellen,
# um Puppeteer explizit anzuweisen, den system-installierten Chrome zu verwenden.
# Das verhindert, dass Puppeteer versucht, eine eigene, inkompatible Version herunterzuladen.
RUN echo "/** @type {import('puppeteer').Configuration} */ module.exports = { executablePath: '/usr/bin/google-chrome-stable' };" > .puppeteerrc.cjs

# Stufe 6: Restlichen Anwendungs-Code kopieren
# Erst jetzt kopieren wir unseren eigentlichen Server-Code (index.js etc.).
COPY . .

# Stufe 7: Port freigeben
# Wir informieren Docker, dass unser Server auf Port 10000 lauschen wird.
EXPOSE 10000

# Stufe 8: Start-Befehl
# Dies ist der Befehl, der ausgeführt wird, wenn der Container startet.
CMD [ "node", "index.js" ]