module.exports = {
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  POLLINATIONS_IMAGE_URL: process.env.POLLINATIONS_IMAGE_URL || 'https://pollinations.ai/p',
  FALLBACK_LOTS: [
    { id: 1, name: "Редкий винтажный фотоаппарат", realPrice: 450 },
    { id: 2, name: "Коллекционная настольная игра", realPrice: 89 },
    { id: 3, name: "Оригинальная гитара", realPrice: 320 },
    { id: 4, name: "Старинные часы", realPrice: 1200 },
    { id: 5, name: "Коллекционный комикс", realPrice: 250 },
    { id: 6, name: "Антикварная книга", realPrice: 180 },
    { id: 7, name: "Спортивный велосипед", realPrice: 650 },
    { id: 8, name: "Портативная колонка", realPrice: 120 }
  ],
  DEFAULT_SETTINGS: {
    initialCapital: 1000,
    roundDuration: 15000,
    totalRounds: 5,
    preRoundDelay: 3000,
    revealDelay: 0
  }
};
