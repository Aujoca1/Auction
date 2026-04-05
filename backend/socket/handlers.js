const {
  gameState,
  resetGameState,
  startNewRound,
  resetAuctionTimer,
  endGame,
  checkEarlyEnd
} = require('../services/gameService');

function registerHandlers(io, socket) {
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
    const nick = gameState.socketToNick[socket.id];
    const player = gameState.players[nick];
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
      resetAuctionTimer(io);

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

    checkEarlyEnd(io);
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
        startNewRound(io);
      } else {
        endGame(io);
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

      console.log('🎯 Начинаем первый раунд...');
      startNewRound(io);
    }
  });

  socket.on('next_round', () => {
    const nick = gameState.socketToNick[socket.id];
    const player = gameState.players[nick];
    if (player && player.isHost && gameState.status === 'result') {
      if (gameState.round < gameState.settings.totalRounds) {
        gameState.round++;
        startNewRound(io);
      } else {
        endGame(io);
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
}

module.exports = registerHandlers;
