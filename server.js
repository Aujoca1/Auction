const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const { OLLAMA_BASE_URL } = require('./backend/config/constants');
const registerHandlers = require('./backend/socket/handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  },
  transports: ['websocket']
});

// Middleware для обслуживания статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Инициализация Socket.io
io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

// Запуск сервера
const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  
  // Проверка доступности Ollama
  fetch(`${OLLAMA_BASE_URL}/api/tags`)
    .then(response => {
      if (response.ok) {
        response.json().then(tags => {
          const ollamaModels = (tags.models || tags.data || []).map(t => t.name || t);
          console.log('📦 Доступные модели Ollama:', ollamaModels.join(', '));
          
          if (!ollamaModels.includes('qwen3.5:9b')) {
            console.warn('⚠️  Модель qwen3.5:9b не найдена, используем fallback');
          }
        });
      }
    })
    .catch(err => {
      console.log('Ollama недоступен, используем fallback лоты');
    });
});

module.exports = { app, server, io };
