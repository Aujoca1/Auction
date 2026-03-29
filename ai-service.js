require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// API Pollinations.ai (бесплатный, не требует ключа для базового использования)
const POLLINATIONS_API = 'https://pollinations.ai/api/v1/generate';

// Оценка стоимости предмета (имитация + анализ текста)
async function evaluateItem(itemName, description = '') {
  // Простая эвристика для оценки стоимости
  const nameLower = itemName.toLowerCase();
  
  let basePrice = 100;
  
  // Ключевые слова для повышения стоимости
  const keywords = {
    'редкий': 1.5,
    'антикварный': 2,
    'старинный': 1.5,
    'оригинальный': 1.3,
    'винтажный': 1.4,
    'коллекционный': 1.8,
    'уникальный': 2,
    'редкий': 1.5
  };
  
  for (const [keyword, multiplier] of Object.entries(keywords)) {
    if (nameLower.includes(keyword)) {
      basePrice *= multiplier;
      break;
    }
  }
  
  // Добавим случайный фактор для реалистичности
  const variance = 0.8 + Math.random() * 0.4;
  const finalPrice = Math.floor(basePrice * variance);
  
  return {
    item: itemName,
    estimatedValue: finalPrice,
    confidence: 'medium',
    analysis: `Оценка предмета "${itemName}" (${description || ''})`
  };
}

// Генерация изображения предмета
app.post('/generate', async (req, res) => {
  try {
    const { item, description } = req.body;
    
    // Формируем промпт для генерации
    const prompt = `photorealistic image of ${item} on a wooden table, cinematic lighting, highly detailed, 8k`;
    
    // Использование Pollinations AI
    // Бесплатный API, не требует ключа для базового использования
    const response = await axios.get(
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`,
      {
        responseType: 'stream'
      }
    );
    
    // Получаем URL изображения из заголовков
    const imageUrl = response.headers['location'] || `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    
    // Также генерируем промпт для оценки
    const evaluationPrompts = await axios.get(
      `https://text.pollinations.ai/${encodeURIComponent(`analyze and estimate value of: ${item} ${description || ''}`)}`,
      { responseType: 'text' }
    ).then(r => r.data);
    
    res.json({
      success: true,
      imageUrl: imageUrl,
      prompt: prompt,
      evaluationPrompt: evaluationPrompts
    });
    
  } catch (error) {
    console.error('Ошибка генерации:', error.message);
    res.status(500).json({ 
      error: 'Ошибка генерации изображения',
      message: error.message 
    });
  }
});

// Оценка стоимости предмета по описанию
app.post('/evaluate', async (req, res) => {
  try {
    const { item, description } = req.body;
    
    const result = await evaluateItem(item, description);
    
    res.json(result);
    
  } catch (error) {
    console.error('Ошибка оценки:', error.message);
    res.status(500).json({ 
      error: 'Ошибка оценки предмета',
      message: error.message 
    });
  }
});

// Массовая оценка нескольких предметов
app.post('/evaluate-multiple', async (req, res) => {
  try {
    const { items } = req.body;
    
    const results = [];
    
    for (const item of items) {
      results.push(await evaluateItem(item.item, item.description || ''));
    }
    
    const totalValue = results.reduce((sum, r) => sum + r.estimatedValue, 0);
    
    res.json({
      items: results,
      totalEstimatedValue: Math.floor(totalValue)
    });
    
  } catch (error) {
    console.error('Ошибка массовой оценки:', error.message);
    res.status(500).json({ 
      error: 'Ошибка массовой оценки',
      message: error.message 
    });
  }
});

// Зона API для теста (открытый доступ для отладки)
app.get('/api-status', (req, res) => {
  res.json({
    service: 'AI Service',
    api: 'Pollinations.ai',
    status: 'operational',
    endpoints: [
      'POST /generate - Генерация изображения',
      'POST /evaluate - Оценка одного предмета',
      'POST /evaluate-multiple - Массовая оценка',
      'GET /api-status - Статус'
    ]
  });
});

const PORT = process.env.AI_SERVICE_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ ИИ-сервис запущен на порту ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api-status`);
});