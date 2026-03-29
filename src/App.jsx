import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import GameScreen from './components/GameScreen';
import { SocketContext, socket } from './context/socket';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [player, setPlayer] = useState(null);

  useEffect(() => {
    // Проверка сохраненной сессии при загрузке
    const savedNick = localStorage.getItem('auction_nick');
    if (savedNick) {
      socket.emit('join_game', savedNick);
    }

    socket.on('connect', () => {
      console.log('✅ Сокет подключен:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Ошибка подключения сокета:', error);
    });

    socket.on('player_joined', (data) => {
      console.log('👤 Игрок вошел:', data);
      setPlayer({
        ...data.playerInfo,
        initialGameState: data.gameState
      });
      setIsLoggedIn(true);
    });

    socket.on('room_dissolved', () => {
      alert('Комната была распущена хостом');
      setIsLoggedIn(false);
      setPlayer(null);
      localStorage.removeItem('auction_nick');
    });

    socket.on('kicked', () => {
      alert('Вы были удалены из комнаты хостом');
      setIsLoggedIn(false);
      setPlayer(null);
      localStorage.removeItem('auction_nick');
    });

    return () => {
      socket.off('player_joined');
      socket.off('room_dissolved');
      socket.off('kicked');
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {!isLoggedIn ? (
        <LoginScreen onLogin={(playerData) => {
          setIsLoggedIn(true);
          setPlayer(playerData);
        }} />
      ) : (
        <GameScreen player={player} onLogout={() => {
          setIsLoggedIn(false);
          setPlayer(null);
        }} />
      )}
    </SocketContext.Provider>
  );
}

export default App;