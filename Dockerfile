FROM node:20-slim

WORKDIR /app

COPY backend/package.json ./backend/package.json
COPY backend/package-lock.json ./backend/package-lock.json

WORKDIR /app/backend
RUN npm install --omit=dev

WORKDIR /app

COPY backend ./backend
COPY *.html ./
COPY js ./js
COPY css ./css
COPY assets ./assets
COPY images ./images
COPY fonts ./fonts
COPY data ./data
COPY src ./src

EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "server.js"]