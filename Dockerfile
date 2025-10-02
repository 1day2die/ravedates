# Lightweight Node Image
FROM node:20-alpine

# Arbeitsverzeichnis
WORKDIR /app

# Nur package.json zuerst kopieren für besseren Build-Cache
COPY package.json ./

# Prod Dependencies installieren
RUN npm install --only=production

# Restliche Dateien kopieren
COPY . .

# Port
EXPOSE 3000

# Start
CMD ["node", "server.js"]

