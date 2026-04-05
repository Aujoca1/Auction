const { OLLAMA_BASE_URL, POLLINATIONS_IMAGE_URL, FALLBACK_LOTS } = require('../config/constants');

async function generateLotWithOllama() {
  try {
    const prompt = `Придумай случайный предмет для антикварного аукциона, его легенду (2-3 предложения) и секретную цену (100-10000). Верни строго JSON в формате: {"title": "...", "description": "...", "realPrice": 1234}`;

    const apiUrl = `${OLLAMA_BASE_URL}/api/generate`;
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen3.5:9b',
        prompt: prompt,
        format: 'json',
        stream: false,
        options: {
          keep_alive: "5m"
        }
      })
    };

    const response = await fetch(apiUrl, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Оллма ответ (сырой):', data);
    
    const content = data.response || data.thinking || "";
    let result;
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/g);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[jsonMatch.length - 1]);
      } else {
        throw new Error('JSON not found in content');
      }
    } catch (parseErr) {
      console.error('Ошибка парсинга JSON от Ollama, пробуем regex fallback:', parseErr.message);
      
      const titleMatch = content.match(/"title":\s*"([^"]+)"/);
      const descMatch = content.match(/"description":\s*"([^"]+)"/);
      const priceMatch = content.match(/"realPrice":\s*(\d+)/);

      result = {
        title: titleMatch ? titleMatch[1] : getRandomLotName(),
        description: descMatch ? descMatch[1] : "Этот уникальный предмет хранит в себе тайну веков. Его истинная ценность скрыта от глаз обывателей.",
        realPrice: priceMatch ? parseInt(priceMatch[1]) : Math.floor(Math.random() * 9900) + 100
      };
    }

    const lotWithImage = await generateLotImage(result.description, result.title);
    return {
      ...lotWithImage,
      realPrice: result.realPrice
    };

  } catch (error) {
    console.error('Ошибка в generateLotWithOllama:', error.message);
    return getRandomLot();
  }
}

async function generateLotImage(description, title) {
  try {
    const safeDescription = encodeURIComponent(`${description}, high quality, detailed, antique, museum quality, photorealistic, 4k`);
    const imageUrl = `${POLLINATIONS_IMAGE_URL}?prompt=${safeDescription}&seed=${Math.floor(Math.random() * 10000)}`;
    
    console.log('Запрос к Pollinations:', imageUrl);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Pollinations API error: ${response.status}`);
    }
    
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');
    const base64Image = `data:image/png;base64,${base64Data}`;
    
    console.log('Картинка сгенерирована успешно');
    return { title, description, image: base64Image };

  } catch (error) {
    console.error('Ошибка Pollinations (используем фоллбэк):', error.message);
    const fallbackImage = getRandomPlaceholderImage(title);
    return { title, description, image: fallbackImage };
  }
}

function getRandomLotName() {
  const adjectives = ['Редкий', 'Антикварный', 'Коллекционный', 'Исторический', 'Эксклюзивный', 'Древний', 'Уникальный', 'Раритетный'];
  const objects = ['фотоаппарат', 'часы', 'гитара', 'часы', 'комикс', 'книга', 'велосипед', 'колонка', 'лампа', 'скульптура', 'картина', 'рубрикатор', 'сейф', 'браслет'];
  const random = () => adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' + objects[Math.floor(Math.random() * objects.length)];
  return random();
}

function getRandomPlaceholderImage(title) {
  return `https://placehold.co/400x400/2d1b69/ffffff?text=${encodeURIComponent(title)}&font=playfair-display`;
}

function getRandomLot() {
  const randomLot = FALLBACK_LOTS[Math.floor(Math.random() * FALLBACK_LOTS.length)];
  return {
    ...randomLot,
    image: `https://placehold.co/400x400/2d1b69/ffffff?text=${encodeURIComponent(randomLot.name)}&font=playfair-display`,
    description: "Этот уникальный предмет хранит в себе тайну веков. Каждый исторический артефакт требует особого подхода к оценке и сохранению.",
    aiGenerated: false
  };
}

module.exports = {
  generateLotWithOllama,
  getRandomLot
};
