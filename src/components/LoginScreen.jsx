import React, { useState, useEffect } from 'react';
import { socket } from '../context/socket';

const LoginScreen = ({ onLogin }) => {
  const [nick, setNick] = useState(localStorage.getItem('auction_nick') || '');
  const [step, setStep] = useState('nick'); // 'nick', 'action'
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState({ roomCreated: false, players: [] });

  useEffect(() => {
    const handleStateUpdate = (state) => {
      console.log('🔄 Обновление состояния в лобби:', state);
      setGameState(prev => ({
        ...prev,
        roomCreated: state.roomCreated !== undefined ? state.roomCreated : prev.roomCreated,
        players: state.players || prev.players
      }));
    };

    socket.on('game_state_update', handleStateUpdate);
    
    // Запрашиваем состояние принудительно при монтировании
    socket.emit('get_initial_state');

    return () => socket.off('game_state_update', handleStateUpdate);
  }, []);

  const handleSetNick = (e) => {
    e.preventDefault();
    if (!nick.trim()) return setError('Введите никнейм');
    localStorage.setItem('auction_nick', nick.trim());
    setStep('action');
    setError('');
  };

  const handleCreate = () => {
    socket.emit('create_game', nick);
  };

  const handleJoin = () => {
    socket.emit('join_game', nick);
  };

  useEffect(() => {
    const handleError = (msg) => {
      // Игнорируем ошибку "Игра еще не создана", если мы просто пытались восстановить сессию
      if (msg === 'Игра еще не создана хостом' && !nick) return;
      setError(msg);
    };

    socket.on('join_error', handleError);

    return () => {
      socket.off('join_error', handleError);
    };
  }, [nick]);

  const isPlayerInGame = gameState.players.some(p => p.name.trim().toLowerCase() === nick.trim().toLowerCase());

  return (
    <div className="login-screen">
      <h1>Аукцион Провидца</h1>

      {step === 'nick' && (
        <form onSubmit={handleSetNick} className="login-form">
          <input
            type="text"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            placeholder="Ваше имя"
            maxLength="20"
            className="player-name-input"
            autoFocus
          />
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="join-game-btn">Продолжить</button>
        </form>
      )}

      {step === 'action' && (
        <div className="menu-buttons">
          <p className="welcome-msg">Привет, <strong>{nick}</strong>!</p>

          {!gameState.roomCreated ? (
            <button className="menu-btn create" onClick={handleCreate}>Создать игру</button>
          ) : (
            <>
              {isPlayerInGame ? (
                <button className="menu-btn join" onClick={handleJoin}>Вернуться в игру</button>
              ) : (
                <button className="menu-btn join" onClick={handleJoin}>Присоединиться</button>
              )}
            </>
          )}

          <button className="back-btn" onClick={() => setStep('nick')}>Сменить имя</button>
          {error && <div className="error-message">{error}</div>}
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
