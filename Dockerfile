FROM node:20-slim

WORKDIR /app

COPY backend/package.json ./backend/package.json
COPY backend/package-lock.json ./backend/package-lock.json

WORKDIR /app/backend
RUN npm install --omit=dev

WORKDIR /app

COPY backend ./backend

COPY *.html ./
COPY css ./css
COPY js ./js
COPY assets ./assets
COPY data ./data

EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "server.js"]