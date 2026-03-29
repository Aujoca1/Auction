const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

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

// Конфигурация
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const POLLINATIONS_IMAGE_URL = process.env.POLLINATIONS_IMAGE_URL || 'https://pollinations.ai/p';
const FALLBACK_LOTS = [
  { id: 1, name: "Редкий винтажный фотоаппарат", realPrice: 450 },
  { id: 2, name: "Коллекционная настольная игра", realPrice: 89 },
  { id: 3, name: "Оригинальная гитара", realPrice: 320 },
  { id: 4, name: "Старинные часы", realPrice: 1200 },
  { id: 5, name: "Коллекционный комикс", realPrice: 250 },
  { id: 6, name: "Антикварная книга", realPrice: 180 },
  { id: 7, name: "Спортивный велосипед", realPrice: 650 },
  { id: 8, name: "Портативная колонка", realPrice: 120 }
];

// Игровое состояние
let gameState = {
  roomCreated: false,
  players: {},
  socketToNick: {},
  currentLot: null,
  currentLotRealPrice: null, // Скрытая цена на сервере
  auctionActive: false,
  timer: null,
  auctionEndTime: null,
  round: 1,
  settings: {
    initialCapital: 1000,
    roundDuration: 15000,
    totalRounds: 5,
    preRoundDelay: 3000,
    revealDelay: 0
  },
  status: 'lobby',
  lotPool: [],
  aiInitialized: false
};

function resetGameState() {
  gameState.roomCreated = false;
  gameState.players = {};
  gameState.socketToNick = {};
  gameState.currentLot = null;
  gameState.currentLotRealPrice = null;
  gameState.auctionActive = false;
  if (gameState.timer) clearTimeout(gameState.timer);
  gameState.timer = null;
  gameState.round = 1;
  gameState.status = 'lobby';
}

async function generateLotWithOllama() {
  try {
    const prompt = `Придумай случайный предмет для антикварного аукциона, его легенду (2-3 предложения) и секретную цену (100-10000). Верни строго JSON в формате: {"title": "...", "description": "...", "realPrice": 1234}`;

    const apiUrl = `${OLLAMA_BASE_URL}/api/generate`;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3.5:9b',
        prompt: prompt,
        format: 'json',
        stream: false,
        options: {
          keep_alive: "5m"
        }
      })
    };

    const response = await fetch(apiUrl, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Оллма ответ (сырой):', data);
    
    // Пытаемся извлечь контент из response или thinking
    const content = data.response || data.thinking || "";
    let result;
    
    try {
      // Ищем JSON в строке (поддержка markdown и лишнего текста)
      const jsonMatch = content.match(/\{[\s\S]*\}/g);
      if (jsonMatch) {
        // Берем последний найденный JSON на случай если их несколько
        result = JSON.parse(jsonMatch[jsonMatch.length - 1]);
      } else {
        throw new Error('JSON not found in content');
      }
    } catch (parseErr) {
      console.error('Ошибка парсинга JSON от Ollama, пробуем regex fallback:', parseErr.message);
      
      const titleMatch = content.match(/"title":\s*"([^"]+)"/);
      const descMatch = content.match(/"description":\s*"([^"]+)"/);
      const priceMatch = content.match(/"realPrice":\s*(\d+)/);

      result = {
        title: titleMatch ? titleMatch[1] : getRandomLotName(),
        description: descMatch ? descMatch[1] : "Этот уникальный предмет хранит в себе тайну веков. Его истинная ценность скрыта от глаз обывателей.",
        realPrice: priceMatch ? parseInt(priceMatch[1]) : Math.floor(Math.random() * 9900) + 100
      };
    }

    // Генерируем картинку на полученное описание
    const lotWithImage = await generateLotImage(result.description, result.title);
    return {
      ...lotWithImage,
      realPrice: result.realPrice
    };

  } catch (error) {
    console.error('Ошибка в generateLotWithOllama:', error.message);
    return getRandomLot();
  }
}

async function generateLotImage(description, title) {
  try {
    const safeDescription = encodeURIComponent(`${description}, high quality, detailed, antique, museum quality, photorealistic, 4k`);
    const imageUrl = `${POLLINATIONS_IMAGE_URL}?prompt=${safeDescription}&seed=${Math.floor(Math.random() * 10000)}`;
    
    console.log('Запрос к Pollinations:', imageUrl);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Pollinations API error: ${response.status}`);
    }
    
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const base64Image = `data:image/png;base64,${base64Data}`;
    
    console.log('Картинка сгенерирована успешно');
    return { title, description, image: base64Image };

  } catch (error) {
    console.error('Ошибка Pollinations (используем фоллбэк):', error.message);
    const fallbackImage = getRandomPlaceholderImage(title);
    return { title, description, image: fallbackImage };
  }
}

function getRandomLotName() {
  const adjectives = ['Редкий', 'Антикварный', 'Коллекционный', 'Исторический', 'Эксклюзивный', 'Древний', 'Уникальный', 'Раритетный'];
  const objects = ['фотоаппарат', 'часы', 'гитара', 'часы', 'комикс', 'книга', 'велосипед', 'колонка', 'лампа', 'скульптура', 'картина', 'рубрикатор', 'сейф', 'браслет'];
  const random = () => adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' + objects[Math.floor(Math.random() * objects.length)];
  return random();
}

function getRandomPlaceholderImage(title) {
  // Используем placeholder с тематикой
  return `https://placehold.co/400x400/2d1b69/ffffff?text=${encodeURIComponent(title)}&font=playfair-display`;
}

function getRandomLot() {
  const randomLot = FALLBACK_LOTS[Math.floor(Math.random() * FALLBACK_LOTS.length)];
  return {
    ...randomLot,
    image: `https://placehold.co/400x400/2d1b69/ffffff?text=${encodeURIComponent(randomLot.name)}&font=playfair-display`,
    description: "Этот уникальный предмет хранит в себе тайну веков. Каждый исторический артефакт требует особого подхода к оценке и сохранению.",
    aiGenerated: false
  };
}

async function startNewRound() {
  gameState.currentLot = null;
  gameState.currentLotRealPrice = null;
  gameState.status = 'generating';
  
  // Оповещаем фронтенд о начале генерации
  io.emit('game_state_update', {
    status: gameState.status,
    currentLot: null
  });

  try {
    // Генерируем новый лот с помощью Ollama (внутри также идет запрос к Pollinations)
    const generatedLot = await generateLotWithOllama();
    
    console.log('🎯 Новый лот полностью готов:', generatedLot.title);
    gameState.currentLot = generatedLot;
    gameState.currentLotRealPrice = generatedLot.realPrice; // Сохраняем скрытую цену
    gameState.status = 'reveal';
    
    // Только теперь отправляем событие игрокам
    io.emit('game_state_update', {
      status: gameState.status,
      currentLot: { 
        name: gameState.currentLot.title || gameState.currentLot.name,
        description: gameState.currentLot.description,
        image: gameState.currentLot.image
      },
      round: gameState.round,
      players: Object.values(gameState.players),
      preRoundEndTime: Date.now() + gameState.settings.preRoundDelay
    });

    // После задержки осмотра переходим к торгам
    setTimeout(() => {
      gameState.status = 'bidding';
      gameState.auctionEndTime = Date.now() + gameState.settings.roundDuration;
      
      io.emit('game_state_update', {
        status: gameState.status,
        auctionEndTime: gameState.auctionEndTime
      });

      gameState.timer = setTimeout(endAuctionRound, gameState.settings.roundDuration);
    }, gameState.settings.preRoundDelay);

  } catch (error) {
    console.error('❌ Критическая ошибка в startNewRound:', error.message);
    const fallbackLot = getRandomLot();
    gameState.currentLot = fallbackLot;
    gameState.currentLotRealPrice = fallbackLot.realPrice;
    gameState.status = 'reveal';
    
    io.emit('game_state_update', {
      status: gameState.status,
      currentLot: { 
        name: gameState.currentLot.name,
        description: gameState.currentLot.description,
        image: gameState.currentLot.image
      },
      round: gameState.round,
      players: Object.values(gameState.players),
      preRoundEndTime: Date.now() + gameState.settings.preRoundDelay
    });

    setTimeout(() => {
      gameState.status = 'bidding';
      gameState.auctionEndTime = Date.now() + gameState.settings.roundDuration;
      
      io.emit('game_state_update', {
        status: gameState.status,
        auctionEndTime: gameState.auctionEndTime
      });

      gameState.timer = setTimeout(endAuctionRound, gameState.settings.roundDuration);
    }, gameState.settings.preRoundDelay);
  }
}

function resetAuctionTimer() {
  if (gameState.timer) clearTimeout(gameState.timer);
  
  gameState.auctionEndTime = Date.now() + gameState.settings.roundDuration;
  gameState.timer = setTimeout(endAuctionRound, gameState.settings.roundDuration);
}

function endAuctionRound() {
  gameState.status = 'result';
  
  let highestBidder = null;
  let highestBid = 0;
  
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    if (player.currentBid > highestBid) {
      highestBid = player.currentBid;
      highestBidder = player;
    }
  }
  
  let resultData = {
    winner: null,
    lot: gameState.currentLot,
    highestBid: 0,
    profit: 0
  };

  if (highestBidder) {
    const profit = gameState.currentLotRealPrice - highestBid; // Используем серверное значение
    highestBidder.balance += profit;
    
    resultData = {
      winner: { name: highestBidder.name },
      lot: gameState.currentLot,
      highestBid: highestBid,
      profit: profit
    };
  }

  io.emit('auction_result', resultData);
  io.emit('game_state_update', {
    status: gameState.status,
    players: Object.values(gameState.players)
  });
}

function endGame() {
  gameState.status = 'gameOver';
  const leaderboard = Object.values(gameState.players)
    .sort((a, b) => b.balance - a.balance);

  io.emit('game_state_update', {
    status: gameState.status,
    players: Object.values(gameState.players),
    leaderboard: leaderboard
  });
}

function checkEarlyEnd() {
  const onlinePlayers = Object.values(gameState.players).filter(p => p.online);
  const highestBid = onlinePlayers.reduce((max, p) => Math.max(max, p.currentBid), 0);
  const highestBidder = onlinePlayers.find(p => p.currentBid === highestBid && highestBid > 0);

  const activeCompetitors = onlinePlayers.filter(p => !p.isPassed && (!highestBidder || p.name !== highestBidder.name));

  if (activeCompetitors.length === 0 && highestBidder) {
    if (gameState.timer) clearTimeout(gameState.timer);
    gameState.timer = setTimeout(endAuctionRound, 2000);
    
    io.emit('game_state_update', {
      auctionEndTime: Date.now() + 2000
    });
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Инициализация
io.on('connection', (socket) => {
  console.log('Новый игрок подключился:', socket.id);

  // Отправляем текущее состояние при подключении
  socket.emit('game_state_update', {
    roomCreated: gameState.roomCreated,
    players: Object.values(gameState.players),
    status: gameState.status
  });

  socket.on('get_initial_state', () => {
    socket.emit('game_state_update', {
      roomCreated: gameState.roomCreated,
      players: Object.values(gameState.players),
      status: gameState.status
    });
  });

  // Создание комнаты
  socket.on('create_game', (playerName) => {
    const nick = playerName.trim();
    if (gameState.roomCreated) {
      return socket.emit('join_error', 'Комната уже существует');
    }

    resetGameState();
    gameState.roomCreated = true;

    const player = {
      socketId: socket.id,
      name: nick,
      balance: gameState.settings.initialCapital,
      currentBid: 0,
      isHost: true,
      online: true,
      isPassed: false,
      votedForNext: false
    };

    gameState.players[nick] = player;
    gameState.socketToNick[socket.id] = nick;

    socket.emit('player_joined', {
      playerId: socket.id,
      playerInfo: player,
      gameState: { ...gameState, players: Object.values(gameState.players) }
    });

    io.emit('game_state_update', {
      roomCreated: true,
      players: Object.values(gameState.players),
      status: gameState.status
    });
  });

  // Присоединение к комнате
  socket.on('join_game', (playerName) => {
    const nick = playerName.trim();
    if (!gameState.roomCreated) {
      return socket.emit('join_error', 'Игра еще не создана хостом');
    }

    let player = gameState.players[nick];

    if (player) {
      player.socketId = socket.id;
      player.online = true;
    } else {
      if (gameState.status !== 'lobby') {
        return socket.emit('join_error', 'Игра уже идет, нельзя присоединиться');
      }

      player = {
        socketId: socket.id,
        name: nick,
        balance: gameState.settings.initialCapital,
        currentBid: 0,
        isHost: false,
        online: true,
        isPassed: false,
        votedForNext: false
      };
      gameState.players[nick] = player;
    }

    gameState.socketToNick[socket.id] = nick;

    socket.emit('player_joined', {
      playerId: socket.id,
      playerInfo: player,
      gameState: { ...gameState, players: Object.values(gameState.players) }
    });

    io.emit('game_state_update', {
      players: Object.values(gameState.players)
    });
  });

  // Обновление настроек хостом
  socket.on('update_settings', (newSettings) => {
    const player = gameState.players[socket.id];
    if (player && player.isHost && gameState.status === 'lobby') {
      gameState.settings = { ...gameState.settings, ...newSettings };
      for (let id in gameState.players) {
        gameState.players[id].balance = gameState.settings.initialCapital;
      }
      io.emit('game_state_update', {
        settings: gameState.settings,
        players: Object.values(gameState.players)
      });
    }
  });

  // Удаление игрока хостом
  socket.on('kick_player', (playerNick) => {
    const nick = gameState.socketToNick[socket.id];
    const host = gameState.players[nick];
    if (host && host.isHost && gameState.players[playerNick]) {
      const kickedSocketId = gameState.players[playerNick].socketId;
      delete gameState.players[playerNick];
      if (io.sockets.sockets.get(kickedSocketId)) {
        io.sockets.sockets.get(kickedSocketId).emit('kicked');
      }
      io.emit('game_state_update', { players: Object.values(gameState.players) });
    }
  });

  // Возврат в лобби из финала
  socket.on('reset_to_lobby', () => {
    const nick = gameState.socketToNick[socket.id];
    const host = gameState.players[nick];
    if (host && host.isHost) {
      gameState.status = 'lobby';
      gameState.round = 1;
      for (let n in gameState.players) {
        gameState.players[n].balance = gameState.settings.initialCapital;
        gameState.players[n].currentBid = 0;
        gameState.players[n].isPassed = false;
        gameState.players[n].votedForNext = false;
      }
      io.emit('game_state_update', {
        status: 'lobby',
        round: 1,
        players: Object.values(gameState.players)
      });
    }
  });

  // Полный роспуск комнаты
  socket.on('dissolve_room', () => {
    const nick = gameState.socketToNick[socket.id];
    const host = gameState.players[nick];
    if (host && host.isHost) {
      resetGameState();
      io.emit('room_dissolved');
    }
  });

  // Обработка ставок
  socket.on('make_bid', (data) => {
    const { bidAmount } = data;
    const nick = gameState.socketToNick[socket.id];
    const player = gameState.players[nick];

    if (!player || gameState.status !== 'bidding') return;

    const currentMaxBid = Object.values(gameState.players).reduce((max, p) => Math.max(max, p.currentBid), 0);
    const minBidRequired = currentMaxBid === 0 ? 20 : currentMaxBid + 1;

    if (bidAmount >= minBidRequired && bidAmount <= player.balance) {
      player.currentBid = bidAmount;
      player.isPassed = false;
      resetAuctionTimer();

      io.emit('bid_update', {
        playerId: socket.id,
        playerName: player.name,
        bidAmount: bidAmount,
        auctionEndTime: gameState.auctionEndTime
      });
      
      io.emit('game_state_update', {
        players: Object.values(gameState.players)
      });
    }
  });

  // Обработка нажатия ПАС
  socket.on('player_pass', (isPassed) => {
    const nick = gameState.socketToNick[socket.id];
    const player = gameState.players[nick];
    if (!player || gameState.status !== 'bidding') return;

    const currentMaxBid = Object.values(gameState.players).reduce((max, p) => Math.max(max, p.currentBid), 0);
    if (isPassed && player.currentBid === currentMaxBid && currentMaxBid > 0) {
      return;
    }

    player.isPassed = isPassed;
    io.emit('game_state_update', { players: Object.values(gameState.players) });

    checkEarlyEnd();
  });

  // Голосование за следующий раунд
  socket.on('vote_next', () => {
    const nick = gameState.socketToNick[socket.id];
    const player = gameState.players[nick];
    if (!player || gameState.status !== 'result') return;

    player.votedForNext = true;
    const onlinePlayers = Object.values(gameState.players).filter(p => p.online);
    
    io.emit('game_state_update', { players: Object.values(gameState.players) });

    if (onlinePlayers.every(p => p.votedForNext)) {
      if (gameState.round < gameState.settings.totalRounds) {
        gameState.round++;
        startNewRound();
      } else {
        endGame();
      }
    }
  });

  // Обработка начала аукциона
  socket.on('start_game', () => {
    const nick = gameState.socketToNick[socket.id];
    const player = gameState.players[nick];
    if (player && player.isHost && gameState.status === 'lobby') {
      gameState.round = 1;
      
      for (let id in gameState.players) {
        gameState.players[id].balance = gameState.settings.initialCapital;
        gameState.players[id].currentBid = 0;
      }

      // Генерируем первый раунд напрямую
      console.log('🎯 Начинаем первый раунд...');
      startNewRound();
    }
  });

  socket.on('next_round', () => {
    const nick = gameState.socketToNick[socket.id];
    const player = gameState.players[nick];
    if (player && player.isHost && gameState.status === 'result') {
      if (gameState.round < gameState.settings.totalRounds) {
        gameState.round++;
        startNewRound();
      } else {
        endGame();
      }
    }
  });

  // Обработка отключения игрока
  socket.on('disconnect', () => {
    const nick = gameState.socketToNick[socket.id];
    if (nick && gameState.players[nick]) {
      console.log(`Игрок ${nick} временно отключился`);
      gameState.players[nick].online = false;
      delete gameState.socketToNick[socket.id];
      
      if (gameState.players[nick].isHost) {
        console.log('Хост отключился, распускаем комнату');
        resetGameState();
        io.emit('room_dissolved');
      } else {
        io.emit('game_state_update', {
          players: Object.values(gameState.players)
        });
      }
    }
  });
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

module.exports = { app, server, io, gameState };