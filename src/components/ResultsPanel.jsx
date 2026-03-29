import React from 'react';

const ResultsPanel = ({ results, onNextRound, isHost, currentPlayer }) => {
  if (!results) return null;

  return (
    <div className="results-overlay">
      <div className="results-modal">
        <h3>Результаты раунда</h3>
        <div className="winner-announcement">
          {results.winner ? (
            <>
              <p className="winner-name">Победитель: <span>{results.winner.name}</span></p>
              <p className="winner-bid">Ставка: {results.highestBid} монет</p>
            </>
          ) : (
            <p className="no-winner">Лот не был продан</p>
          )}
        </div>
        
        <div className="lot-info-reveal">
          <p><strong>Лот:</strong> {results.lot.name}</p>
          {results.lot.aiDescription && (
            <p className="ai-result-desc">
              💡 ИИ: <em>{results.lot.aiDescription}</em>
            </p>
          )}
          <p className="real-price-display">
            Реальная цена: <strong>{results.lot.realPrice} монет</strong>
          </p>
          {results.winner && (
            <p className={`profit-display ${results.profit >= 0 ? 'profit-plus' : 'profit-minus'}`}>
              {results.profit >= 0 ? 'Прибыль' : 'Убыток'}: {Math.abs(results.profit)} монет
            </p>
          )}
          {results.winner && results.lot.aiEstimatedValue && (
            <p className="ai-accuracy">
              🤖 ИИ оценка: {results.lot.aiEstimatedValue} монет
              {results.lot.aiEstimatedValue < results.lot.realPrice && <span className="low-ball"> (низкая оценка)</span>}
              {results.lot.aiEstimatedValue > results.lot.realPrice && <span className="high-ball"> (высокая оценка)</span>}
            </p>
          )}
        </div>
        
        <button 
          onClick={onNextRound} 
          disabled={currentPlayer?.votedForNext}
          className={`vote-btn ${currentPlayer?.votedForNext ? 'voted' : ''}`}
        >
          {currentPlayer?.votedForNext ? 'Ожидание игроков...' : 'Следующий раунд'}
        </button>
      </div>
    </div>
  );
};

export default ResultsPanel;