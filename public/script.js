// Подключение к серверу
const socket = io();

// DOM элементы
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const joinGameBtn = document.getElementById('join-game-btn');
const playerNameDisplay = document.getElementById('player-name-display');
const playerBalance = document.getElementById('player-balance');
const roundNumber = document.getElementById('round-number');
const lotName = document.getElementById('lot-name');
const lotImage = document.getElementById('lot-image');
const lotQuestionMark = document.getElementById('lot-question-mark');
const timerDisplay = document.getElementById('timer');
const currentHighestBid = document.getElementById('current-highest-bid');
const bidAmountInput = document.getElementById('bid-amount');
const placeBidBtn = document.getElementById('place-bid-btn');
const playersContainer = document.getElementById('players-container');
const resultsPanel = document.querySelector('.results-panel');
const roundResults = document.getElementById('round-results');
const nextRoundBtn = document.getElementById('next-round-btn');

// Переменные игры
let currentPlayerId = null;
let auctionEndTime = null;
let timerInterval = null;

// Подключение к игре
joinGameBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
        socket.emit('join_game', playerName);
    }
});

// Обработка события присоединения к игре
socket.on('player_joined', (data) => {
    currentPlayerId = data.playerId;
    playerNameDisplay.textContent = data.playerInfo.name;
    playerBalance.textContent = data.playerInfo.balance;
    
    // Переключение экранов
    loginScreen.classList.remove('active');
    gameScreen.classList.add('active');
});

// Обновление списка игроков
socket.on('player_list_update', (players) => {
    playersContainer.innerHTML = '';
    players.forEach(player => {
        const playerElement = document.createElement('li');
        playerElement.className = 'player-item';
        if (player.id === currentPlayerId) {
            playerElement.classList.add('current-player');
        }
        
        playerElement.innerHTML = `
            <span>${player.name}</span>
            <span>${player.balance} монет | Ставка: ${player.currentBid || 0}</span>
        `;
        playersContainer.appendChild(playerElement);
    });
});

// Обновление информации о лоте
socket.on('lot_info', (data) => {
    lotName.textContent = data.name;
    lotImage.classList.add('hidden');
    lotQuestionMark.style.display = 'block';
    currentHighestBid.textContent = '0';
    
    // Установка таймера
    auctionEndTime = data.endTime;
    startTimer();
    
    // Скрытие результатов и кнопки следующего раунда
    resultsPanel.classList.add('hidden');
    nextRoundBtn.classList.add('hidden');
});

// Обновление ставки
socket.on('bid_update', (data) => {
    currentHighestBid.textContent = data.bidAmount;
    
    // Если это наша ставка, обновляем баланс
    if (data.playerId === currentPlayerId) {
        const newBalance = parseInt(playerBalance.textContent) - data.bidAmount;
        playerBalance.textContent = newBalance;
    }
});

// Результаты аукциона
socket.on('auction_result', (data) => {
    // Показываем изображение лота
    lotImage.src = `images/${data.lot.image}`;
    lotImage.classList.remove('hidden');
    lotQuestionMark.style.display = 'none';
    
    // Отображение результатов
    roundResults.innerHTML = `
        <p><strong>Победитель:</strong> ${data.winner.name}</p>
        <p><strong>Лот:</strong> ${data.lot.name}</p>
        <p><strong>Реальная цена:</strong> ${data.lot.realPrice} монет</p>
        <p><strong>Выигрыш/Проигрыш:</strong> ${data.profit > 0 ? '+' : ''}${data.profit} монет</p>
    `;
    
    // Обновляем информацию о текущем игроке
    if (data.winner.id === currentPlayerId) {
        playerBalance.textContent = data.winner.balance;
    }
    
    // Показываем результаты
    resultsPanel.classList.remove('hidden');
    nextRoundBtn.classList.remove('hidden');
    
    // Останавливаем таймер
    stopTimer();
});

// Обработка кнопки "Сделать ставку"
placeBidBtn.addEventListener('click', () => {
    const bidAmount = parseInt(bidAmountInput.value);
    if (bidAmount && bidAmount > 0) {
        socket.emit('make_bid', { bidAmount });
        bidAmountInput.value = '';
    }
});

// Обработка кнопки "Следующий раунд"
nextRoundBtn.addEventListener('click', () => {
    socket.emit('start_auction');
});

// Функция запуска таймера
function startTimer() {
    stopTimer(); // Останавливаем предыдущий таймер
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const timeLeft = Math.max(0, Math.floor((auctionEndTime - now) / 1000));
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            stopTimer();
        }
    }, 1000);
}

// Функция остановки таймера
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Обработка отключения игрока
socket.on('player_left', (playerId) => {
    if (playerId === currentPlayerId) {
        alert('Вы были отключены от игры');
        window.location.reload();
    }
});