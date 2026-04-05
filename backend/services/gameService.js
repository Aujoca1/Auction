const { DEFAULT_SETTINGS } = require('../config/constants');
const { generateLotWithOllama, getRandomLot } = require('./aiService');

let gameState = {
  roomCreated: false,
  players: {},
  socketToNick: {},
  currentLot: null,
  currentLotRealPrice: null,
  auctionActive: false,
  timer: null,
  auctionEndTime: null,
  round: 1,
  settings: { ...DEFAULT_SETTINGS },
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

async function startNewRound(io) {
  gameState.currentLot = null;
  gameState.currentLotRealPrice = null;
  gameState.status = 'generating';
  
  io.emit('game_state_update', {
    status: gameState.status,
    currentLot: null
  });

  try {
    const generatedLot = await generateLotWithOllama();
    
    console.log('🎯 Новый лот полностью готов:', generatedLot.title);
    gameState.currentLot = generatedLot;
    gameState.currentLotRealPrice = generatedLot.realPrice;
    gameState.status = 'reveal';
    
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

    setTimeout(() => {
      gameState.status = 'bidding';
      gameState.auctionEndTime = Date.now() + gameState.settings.roundDuration;
      
      io.emit('game_state_update', {
        status: gameState.status,
        auctionEndTime: gameState.auctionEndTime
      });

      gameState.timer = setTimeout(() => endAuctionRound(io), gameState.settings.roundDuration);
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

      gameState.timer = setTimeout(() => endAuctionRound(io), gameState.settings.roundDuration);
    }, gameState.settings.preRoundDelay);
  }
}

function resetAuctionTimer(io) {
  if (gameState.timer) clearTimeout(gameState.timer);
  
  gameState.auctionEndTime = Date.now() + gameState.settings.roundDuration;
  gameState.timer = setTimeout(() => endAuctionRound(io), gameState.settings.roundDuration);
}

function endAuctionRound(io) {
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
    const profit = gameState.currentLotRealPrice - highestBid;
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

function endGame(io) {
  gameState.status = 'gameOver';
  const leaderboard = Object.values(gameState.players)
    .sort((a, b) => b.balance - a.balance);

  io.emit('game_state_update', {
    status: gameState.status,
    players: Object.values(gameState.players),
    leaderboard: leaderboard
  });
}

function checkEarlyEnd(io) {
  const onlinePlayers = Object.values(gameState.players).filter(p => p.online);
  const highestBid = onlinePlayers.reduce((max, p) => Math.max(max, p.currentBid), 0);
  const highestBidder = onlinePlayers.find(p => p.currentBid === highestBid && highestBid > 0);

  const activeCompetitors = onlinePlayers.filter(p => !p.isPassed && (!highestBidder || p.name !== highestBidder.name));

  if (activeCompetitors.length === 0 && highestBidder) {
    if (gameState.timer) clearTimeout(gameState.timer);
    gameState.timer = setTimeout(() => endAuctionRound(io), 2000);
    
    io.emit('game_state_update', {
      auctionEndTime: Date.now() + 2000
    });
  }
}

module.exports = {
  gameState,
  resetGameState,
  startNewRound,
  resetAuctionTimer,
  endAuctionRound,
  endGame,
  checkEarlyEnd
};
