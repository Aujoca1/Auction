import React from 'react';

const PlayersList = ({ players, currentPlayerId, isHost, onKick }) => {
  return (
    <div className="players-list">
      <ul className="players-container">
        {players.map((player) => (
          <li 
            key={player.name} 
            className={`player-item ${player.socketId === currentPlayerId ? 'current-player' : ''} ${!player.online ? 'offline' : ''}`}
          >
            <div className="player-main-info">
              <span className={`status-indicator ${player.online ? 'online' : 'offline'}`}></span>
              <span className="player-name">
                {player.name} {player.isHost && <span className="host-tag">HOST</span>}
              </span>
            </div>
            
            <div className="player-stats">
              <div className="stats-row">
                <span className="player-balance">{player.balance} монет</span>
                {player.currentBid > 0 && (
                  <span className="player-bid">Ставка: {player.currentBid}</span>
                )}
              </div>
              <div className="status-row">
                {player.isPassed && <span className="pass-label">ПАС</span>}
                {player.votedForNext && <span className="voted-label">ГОТОВ</span>}
                {isHost && !player.isHost && (
                  <button className="kick-btn" onClick={() => onKick(player.name)}>Котроль ❌</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlayersList;
