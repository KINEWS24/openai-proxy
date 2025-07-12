# Stufe 1: Basis-Image
# Wir nutzen eine 'slim' Debian-Variante von Node.js für beste Kompatibilität.
FROM node:20-slim

# Stufe 2: Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# Stufe 3: System-Abhängigkeiten und Google Chrome nach modernem, sicherem Standard installieren
RUN apt-get update \
    && apt-get install -y curl gnupg --no-install-recommends \
    # Google Chrome GPG-Schlüssel mit der neuen, sicheren Methode hinzufügen
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    # Google Chrome Repository zur Source-Liste hinzufügen und auf den neuen Schlüssel verweisen
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    # Paketliste erneut aktualisieren, damit die neue Quelle bekannt ist
    && apt-get update \
    # Jetzt den Browser installieren; alle Abhängigkeiten werden automatisch mitgezogen
    && apt-get install -y google-chrome-stable --no-install-recommends \
    # Temporäre Dateien und Caches aufräumen, um das Image klein zu halten
    && rm -rf /var/lib/apt/lists/* \
    && apt-get purge -y --auto-remove curl gnupg

# Stufe 4: Paket-Dateien kopieren und NPM-Abhängigkeiten installieren
COPY package*.json ./
# Wir überspringen den optionalen Puppeteer-Download, da wir den system-installierten Browser nutzen
RUN npm install --no-optional

# Stufe 5: Restlichen Anwendungs-Code kopieren
COPY . .

# Stufe 6: Port freigeben
EXPOSE 10000

# Stufe 7: Start-Befehl
CMD [ "node", "index.js" ]