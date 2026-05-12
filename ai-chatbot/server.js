const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_PORT || 5002;

app.use(cors());
app.use(express.json());

// Tours from backend
const TOURS = [
  { _id: '1', name: 'Тур в Париж', description: 'Романтический тур', country: 'Франция', price: 50000, dates: '2024-06-01' },
  { _id: '2', name: 'Тур в Токио', description: 'Культурный тур', country: 'Япония', price: 80000, dates: '2024-07-01' },
  { _id: '3', name: 'Тур в Нью-Йорк', description: 'Городской тур', country: 'США', price: 70000, dates: '2024-08-01' },
  { _id: '4', name: 'Тур в Барселону', description: 'Архитектурный тур', country: 'Испания', price: 45000, dates: '2024-06-15' }
];

// AI Logic for tour recommendation
function recommendTours(userMessage) {
  const message = userMessage.toLowerCase();
  let recommendations = [];
  let response = '';

  // Extract budget
  const budgetMatch = message.match(/(\d+)\s*(тыс|руб|рублей|тысяч)?/);
  let maxBudget = Infinity;
  if (budgetMatch) {
    maxBudget = parseInt(budgetMatch[1]);
    if (budgetMatch[2] === 'тыс' || !budgetMatch[2]) {
      maxBudget *= 1000;
    }
  }

  // Extract country preferences
  const countries = {
    'париж': 'Франция',
    'франция': 'Франция',
    'токио': 'Япония',
    'япония': 'Япония',
    'нью-йорк': 'США',
    'америка': 'США',
    'сша': 'США',
    'барселона': 'Испания',
    'испания': 'Испания'
  };

  let preferredCountries = [];
  for (const [key, country] of Object.entries(countries)) {
    if (message.includes(key)) {
      preferredCountries.push(country);
    }
  }

  // Extract dates
  const datesMatch = message.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\s*(июня|июля|августа)/);
  let preferredDates = null;
  if (datesMatch) {
    preferredDates = datesMatch[0];
  }

  // Filter tours
  recommendations = TOURS.filter(tour => {
    if (tour.price > maxBudget) return false;
    if (preferredCountries.length > 0 && !preferredCountries.includes(tour.country)) return false;
    return true;
  });

  // Generate response
  if (recommendations.length === 0) {
    response = `К сожалению, я не нашел туры, соответствующие вашим критериям. Попробуйте:
- увеличить бюджет
- выбрать другую страну
- посмотреть все доступные туры`;
  } else if (recommendations.length === 1) {
    response = `Отлично! Я рекомендую вам "${recommendations[0].name}" за ${recommendations[0].price} рублей. ${recommendations[0].description}`;
  } else {
    response = `Я нашел ${recommendations.length} подходящих вам тура:\n`;
    recommendations.forEach((tour, index) => {
      response += `${index + 1}. ${tour.name} - ${tour.price} руб. (${tour.country})\n`;
    });
    response += `\nКакой тур вас интересует больше всего?`;
  }

  return {
    response,
    recommendations,
    filters: {
      maxBudget,
      countries: preferredCountries,
      dates: preferredDates
    }
  };
}

// Chat endpoint
app.post('/api/chat', (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const result = recommendTours(message);
  res.json({
    id: Date.now(),
    timestamp: new Date(),
    userMessage: message,
    aiResponse: result.response,
    recommendations: result.recommendations,
    filters: result.filters
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'AI Chatbot running' });
});

app.listen(PORT, () => {
  console.log(`AI Chatbot running on port ${PORT}`);
});
