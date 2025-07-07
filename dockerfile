# Dockerfile

# Nutze ein minimales Node.js Image als Basis
FROM node:20-alpine

# Setze das Arbeitsverzeichnis in dem Container
WORKDIR /usr/src/app

# NEU: Installiere die Werkzeuge, die für das Kompilieren von 'hnswlib-node' benötigt werden
RUN apk add --no-cache python3 make g++

# Kopiere die Paket-Dateien und installiere die Abhängigkeiten
COPY package*.json ./
RUN npm install

# Kopiere den Rest des Anwendungs-Codes
COPY . .

# Gib den Port frei, auf dem die App läuft
EXPOSE 10000

# Der Befehl, um die App zu starten
CMD ["npm", "start"]