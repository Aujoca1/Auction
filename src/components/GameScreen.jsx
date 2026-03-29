import React, { useState, useEffect, useContext } from 'react';
import { SocketContext, socket } from '../context/socket';
import LotDisplay from './LotDisplay';
import AuctionControls from './AuctionControls';
import PlayersList from './PlayersList';
import ResultsPanel from './ResultsPanel';

const GameScreen = ({ player, onLogout }) => {
  const [gameState, setGameState] = useState(player?.initialGameState ? {
    ...player.initialGameState,
    bidHistory: [] // Сбрасываем историю при заходе, она подгрузится сокетом
  } : {
    players: [],
    currentLot: null,
    status: 'lobby',
    round: 1,
    settings: {
      initialCapital: 1000,
      roundDuration: 15000,
      totalRounds: 5
    },
    bidHistory: [],
    auctionEndTime: null
  });
  const [bidAmount, setBidAmount] = useState('');
  const [auctionResults, setAuctionResults] = useState(null);

  const currentPlayerFromList = gameState.players.find(p => p.name === (player?.name || localStorage.getItem('auction_nick')));
  const currentPlayer = currentPlayerFromList || player;

  // Обработка подключения к сокету
  useEffect(() => {
    socket.on('game_state_update', (update) => {
      setGameState(prev => ({
        ...prev,
        ...update
      }));
    });

    // Обновление ставки
    socket.on('bid_update', (data) => {
      setGameState(prev => ({
        ...prev,
        auctionEndTime: data.auctionEndTime,
        bidHistory: [data, ...(prev.bidHistory || [])].slice(0, 10)
      }));
    });

    // Результаты аукциона
    socket.on('auction_result', (data) => {
      setAuctionResults(data);
    });

    // Обработка отключения
    socket.on('player_left', (playerId) => {
      if (playerId === socket.id) {
        onLogout();
      }
    });

    // Очистка при выходе
    return () => {
      socket.off('player_list_update');
      socket.off('lot_info');
      socket.off('bid_update');
      socket.off('auction_result');
      socket.off('player_left');
    };
  }, []);

  const handlePlaceBid = () => {
    const amount = parseInt(bidAmount);
    if (amount > 0) {
      socket.emit('make_bid', { bidAmount: amount });
      setBidAmount('');
    }
  };

  const handleStartGame = () => {
    socket.emit('start_game');
  };

  const handleNextRound = () => {
    socket.emit('vote_next');
  };

  const handleResetToLobby = () => {
    socket.emit('reset_to_lobby');
  };

  const handleKick = (nick) => {
    socket.emit('kick_player', nick);
  };

  const handleUpdateSettings = (newSettings) => {
    const updatedSettings = { ...gameState.settings, ...newSettings };
    setGameState(prev => ({
      ...prev,
      settings: updatedSettings
    }));
    socket.emit('update_settings', updatedSettings);
  };

  const handleDissolveRoom = () => {
    if (window.confirm('Вы уверены, что хотите распустить комнату? Все данные будут удалены.')) {
      socket.emit('dissolve_room');
    }
  };

  const handlePass = (isPassed) => {
    socket.emit('player_pass', isPassed);
  };

  if (gameState.status === 'gameOver') {
    return (
      <div className="game-screen game-over">
        <h1>Игра окончена!</h1>
        <div className="leaderboard-container">
          <h2>Таблица лидеров</h2>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Место</th>
                <th>Игрок</th>
                <th>Баланс</th>
              </tr>
            </thead>
            <tbody>
              {gameState.leaderboard?.map((p, index) => (
                <tr key={index} className={p.name === currentPlayer.name ? 'highlight' : ''}>
                  <td>{index + 1}</td>
                  <td>{p.name} {p.name === currentPlayer.name && '(Вы)'}</td>
                  <td>{p.balance} монет</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {currentPlayer.isHost ? (
          <button className="restart-btn" onClick={handleResetToLobby}>Вернуться в лобби</button>
        ) : (
          <p className="restart-msg">Ожидание хоста для новой игры...</p>
        )}
      </div>
    );
  }

  return (
    <div className="game-screen">
      <div className="header">
        <div className="round-info">
          {gameState.status === 'lobby' ? 'Лобби' : `Раунд: ${gameState.round} / ${gameState.settings.totalRounds}`}
        </div>
        <div className="player-info">
          Игрок: <span>{currentPlayer?.name}</span> |
          Баланс: <span className="balance-highlight">{currentPlayer?.balance}</span> монет
          {currentPlayer.isHost && (
            <button className="dissolve-btn" onClick={handleDissolveRoom} title="Распустить комнату">
              🚪
            </button>
          )}
        </div>
      </div>

      <div className="main-content">
        {gameState.status === 'lobby' ? (
          <div className="lobby-layout">
            <div className="lobby-settings">
              <h2>Настройки игры</h2>
              <div className="settings-grid">
                <div className="setting-item">
                  <label>Начальный капитал:</label>
                  <input 
                    type="number" 
                    value={gameState.settings.initialCapital} 
                    disabled={!currentPlayer.isHost}
                    onChange={(e) => handleUpdateSettings({ initialCapital: parseInt(e.target.value) })}
                  />
                </div>
                <div className="setting-item">
                  <label>Время на ставку (сек):</label>
                  <input 
                    type="number" 
                    value={gameState.settings.roundDuration / 1000} 
                    disabled={!currentPlayer.isHost}
                    onChange={(e) => handleUpdateSettings({ roundDuration: parseInt(e.target.value) * 1000 })}
                  />
                </div>
                <div className="setting-item">
                  <label>Всего раундов:</label>
                  <input 
                    type="number" 
                    value={gameState.settings.totalRounds} 
                    disabled={!currentPlayer.isHost}
                    onChange={(e) => handleUpdateSettings({ totalRounds: parseInt(e.target.value) })}
                  />
                </div>
                <div className="setting-item">
                  <label>Время раздумья (сек):</label>
                  <input 
                    type="number" 
                    value={gameState.settings.preRoundDelay / 1000} 
                    disabled={!currentPlayer.isHost}
                    onChange={(e) => handleUpdateSettings({ preRoundDelay: parseInt(e.target.value) * 1000 })}
                  />
                </div>
              </div>
              {currentPlayer.isHost ? (
                <button className="start-game-btn" onClick={handleStartGame}>Начать игру</button>
              ) : (
                <p className="waiting-msg">Ожидание, пока хост начнет игру...</p>
              )}
            </div>
            <div className="lobby-players">
              <h3>Игроки в комнате:</h3>
              <PlayersList 
                players={gameState.players} 
                currentPlayerId={socket.id} 
                isHost={currentPlayer.isHost}
                onKick={handleKick}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="auction-area">
              <LotDisplay 
                lot={gameState.currentLot} 
                status={gameState.status}
                endTime={gameState.auctionEndTime}
                preRoundEndTime={gameState.preRoundEndTime}
              />
              
              <AuctionControls 
                gameState={gameState}
                bidAmount={bidAmount}
                setBidAmount={setBidAmount}
                onPlaceBid={handlePlaceBid}
                onNextRound={handleNextRound}
                isHost={currentPlayer.isHost}
                onPass={handlePass}
                currentPlayer={currentPlayer}
              />
            </div>

            <div className="auction-layout">
              <PlayersList 
                players={gameState.players} 
                currentPlayerId={socket.id}
              />
              
              <div className="bid-history">
                <h3>История ставок:</h3>
                <ul>
                  {gameState.bidHistory.map((bid, index) => (
                    <li key={index} className={index === 0 ? 'latest-bid pulse' : ''}>
                      <strong>{bid.playerName}</strong>: {bid.bidAmount} монет
                    </li>
                  ))}
                  {gameState.bidHistory.length === 0 && <li>Ставок пока нет</li>}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>

      {gameState.status === 'result' && auctionResults && (
        <ResultsPanel 
          results={auctionResults} 
          onNextRound={handleNextRound}
          isHost={currentPlayer.isHost}
        />
      )}
    </div>
  );
};

export default GameScreen;