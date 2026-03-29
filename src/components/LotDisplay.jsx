import React, { useState, useEffect } from 'react';

const LotDisplay = ({ lot, status, endTime, preRoundEndTime }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const [preTimeLeft, setPreTimeLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (preRoundEndTime && status === 'reveal') {
      const timer = setInterval(() => {
        const diff = Math.max(0, Math.floor((preRoundEndTime - Date.now()) / 1000));
        setPreTimeLeft(diff);
        if (diff <= 0) clearInterval(timer);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [preRoundEndTime, status]);

  useEffect(() => {
    if (endTime && status === 'bidding') {
      const timer = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        setTimeLeft(diff);
        if (diff <= 0) clearInterval(timer);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [endTime, status]);

  // Устанавливаем состояние загрузки
  useEffect(() => {
    if (status === 'generating' || status === 'reveal') {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [status]);

  if (!lot && !isLoading) return null;

  return (
    <div className="lot-display">
      <div className="lot-image-container">
        {isLoading && status !== 'result' && status !== 'bidding' ? (
          <div className="image-placeholder">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <span className="loading-text">Загрузка лота...</span>
            </div>
          </div>
        ) : (status === 'result' || status === 'bidding' || status === 'reveal') ? (
          <div className="image-stack">
            {lot?.image && (
              <img 
                src={lot.image} 
                alt={lot.name} 
                className="lot-image fade-in show"
                onError={(e) => {
                  console.error('Ошибка загрузки изображения:', e);
                }}
              />
            )}
          </div>
        ) : (
          <div className="image-placeholder">
            <div className="question-mark">?</div>
          </div>
        )}
      </div>
      
      <h2 className="lot-name-title">{lot?.name}</h2>
      
      {/* Рамка с описанием */}
      {lot?.description && (
        <div className="description-frame" style={{ maxHeight: '150px', overflowY: 'auto' }}>
          <div className="description-content">
            <span className="description-text">{lot.description}</span>
          </div>
        </div>
      )}
      
      {status === 'bidding' && (
        <div className={`timer-display ${timeLeft < 5 ? 'timer-urgent' : ''}`}>
          Осталось: {timeLeft}с
        </div>
      )}
      {status === 'reveal' && !isLoading && (
        <div className="reveal-area">
          <div className="reveal-msg">Осмотр лота: {preTimeLeft}с</div>
          <p className="hint-msg">Решайте, стоит ли этот предмет ваших денег...</p>
        </div>
      )}
    </div>
  );
};

export default LotDisplay;
