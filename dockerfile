# Stufe 1: Basis-Image
# Wir nutzen eine 'slim' Debian-Variante von Node.js, die eine bessere Kompatibilität für Browser-Abhängigkeiten bietet.
FROM node:20-slim

# Stufe 2: Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# Stufe 3: Installation der System-Abhängigkeiten
# Dies ist der entscheidende Block, der die fehlenden Bibliotheken für Puppeteer/Chromium installiert.
# 'wget' und 'gnupg' werden nur temporär für die Installation benötigt und danach wieder entfernt, um das Image klein zu halten.
RUN apt-get update \
    && apt-get install -y \
    wget \
    gnupg \
    # === Essenzielle Chromium Abhängigkeiten ===
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    # =======================================
    --no-install-recommends \
    && apt-get purge -y --auto-remove wget gnupg \
    && rm -rf /var/lib/apt/lists/*

# Stufe 4: Paket-Dateien kopieren und Abhängigkeiten installieren
COPY package*.json ./
RUN npm install

# Stufe 5: Restlichen Anwendungs-Code kopieren
COPY . .

# Stufe 6: Port freigeben
EXPOSE 10000

# Stufe 7: Start-Befehl
CMD [ "node", "index.js" ]