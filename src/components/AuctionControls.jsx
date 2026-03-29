import React, { useState, useEffect } from 'react';

const AuctionControls = ({ 
  gameState, 
  bidAmount, 
  setBidAmount, 
  onPlaceBid, 
  onNextRound,
  isHost,
  onPass,
  currentPlayer
}) => {
  const [passCooldown, setPassCooldown] = useState(false);
  
  const highestBid = gameState.players.reduce((max, player) => {
    return player.currentBid > max ? player.currentBid : max;
  }, 0);

  const minBid = highestBid === 0 ? 20 : highestBid + 1;
  const isLeading = currentPlayer.currentBid === highestBid && highestBid > 0;

  const handlePassClick = () => {
    if (currentPlayer.isPassed) {
      onPass(false); // Отмена паса
    } else {
      onPass(true);
      setPassCooldown(true);
      setTimeout(() => setPassCooldown(false), 2000);
    }
  };

  if (gameState.status !== 'bidding') return null;

  return (
    <div className="auction-controls">
      <div className="bid-section">
        <div className="current-bid">
          Текущая ставка: <span>{highestBid === 0 ? 'Нет ставок (мин. 20)' : highestBid}</span>
          {isLeading && <span className="leading-tag">Твоя ставка!</span>}
        </div>
        
        <div className="bid-input">
          <input
            type="number"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`Мин. ставка: ${minBid}`}
            min={minBid}
            disabled={currentPlayer.isPassed}
          />
          <button 
            onClick={onPlaceBid} 
            disabled={!bidAmount || parseInt(bidAmount) < minBid || currentPlayer.isPassed}
            className="place-bid-btn"
          >
            Ставка
          </button>
          
          <button 
            onClick={handlePassClick}
            disabled={isLeading || (passCooldown && currentPlayer.isPassed)}
            className={`pass-btn ${currentPlayer.isPassed ? 'passed' : ''}`}
          >
            {currentPlayer.isPassed ? 'ОТМЕНА (2с)' : 'ПАС'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuctionControls;
