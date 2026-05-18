const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.AI_PORT || 5002;

app.use(cors());
app.use(express.json());

// Load AI rules from ai-rules folder (if present)
let AI_RULES_TEXT = '';
try {
    const rulesDir = path.join(__dirname, '..', 'ai-rules');
    if (fs.existsSync(rulesDir)) {
        const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
        AI_RULES_TEXT = files.map(f => `--- ${f} ---\n` + fs.readFileSync(path.join(rulesDir, f), 'utf8')).join('\n\n');
    }
} catch (e) {
    AI_RULES_TEXT = '';
}

// Tours from backend
const TOURS = [
    { _id: '1', name: 'Тур в Париж', description: 'Романтический тур', country: 'Франция', price: 50000, dates: '2024-06-01' },
    { _id: '2', name: 'Тур в Токио', description: 'Культурный тур', country: 'Япония', price: 80000, dates: '2024-07-01' },
    { _id: '3', name: 'Тур в Нью-Йорк', description: 'Городской тур', country: 'США', price: 70000, dates: '2024-08-01' },
    { _id: '4', name: 'Тур в Барселону', description: 'Архитектурный тур', country: 'Испания', price: 45000, dates: '2024-06-15' }
];

const sessions = {};

function normalizeMessage(text) {
    return text.toLowerCase().trim();
}

function parseRequest(message) {
    const text = normalizeMessage(message);
    const intent = {
        greeting: /\b(привет|здравствуйте|добрый день|добрый вечер|хай|hello)\b/.test(text),
        farewell: /\b(пока|до свидания|спасибо|благодарю|спасибо большое)\b/.test(text),
        showAll: /\b(показать все|все туры|покажи все|давай все)\b/.test(text),
        booking: /\b(забронировать|купить|зарезервировать|оформить|брониру)\b/.test(text),
        detail: /\b(подробнее|расскажи|что включает|что входит|какие условия)\b/.test(text),
        preference: /\b(хочу|ищу|нужно|интересует|люблю|нравится|не хочу)\b/.test(text)
    };

    const budgetRegex = /(до|от)?\s*([0-9\s,\.]+)\s*(k|к|тыс|тысяч|руб|рублей)?/i;
    const budgetMatch = text.match(budgetRegex);
    let minBudget = 0;
    let maxBudget = Infinity;
    if (budgetMatch) {
        const raw = budgetMatch[2].replace(/[ ,\.]/g, '');
        const value = parseInt(raw, 10);
        const unit = (budgetMatch[3] || '').toLowerCase();
        const normalized = unit.match(/k|к|тыс|тысяч/) ? value * 1000 : value;
        if (budgetMatch[1] && budgetMatch[1].toLowerCase() === 'до') {
            maxBudget = normalized;
        } else if (budgetMatch[1] && budgetMatch[1].toLowerCase() === 'от') {
            minBudget = normalized;
        } else {
            maxBudget = normalized;
        }
    }

    const countriesMap = {
        'париж': 'Франция',
        'франция': 'Франция',
        'токио': 'Япония',
        'япония': 'Япония',
        'нью-йорк': 'США',
        'нью йорк': 'США',
        'америка': 'США',
        'соединенные штаты': 'США',
        'сша': 'США',
        'барселона': 'Испания',
        'испания': 'Испания'
    };
    const countries = Object.entries(countriesMap)
        .filter(([key]) => text.includes(key))
        .map(([, value]) => value);

    const datesMatch = text.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
    const dates = datesMatch ? datesMatch[0] : null;

    return { text, intent, budget: { minBudget, maxBudget }, countries, dates };
}

function mergePreferences(session, parsed) {
    if (parsed.budget.maxBudget !== Infinity) {
        session.preferences.maxBudget = parsed.budget.maxBudget;
    }
    if (parsed.budget.minBudget > 0) {
        session.preferences.minBudget = parsed.budget.minBudget;
    }
    if (parsed.countries.length > 0) {
        session.preferences.countries = Array.from(new Set([...session.preferences.countries, ...parsed.countries]));
    }
    if (parsed.dates) {
        session.preferences.dates = parsed.dates;
    }
}

function scoreTour(tour, preferences) {
    let score = 0;
    if (!preferences.countries.length || preferences.countries.includes(tour.country)) score += 40;
    else score -= 15;
    if (tour.price <= preferences.maxBudget && tour.price >= preferences.minBudget) score += 35;
    else if (tour.price <= preferences.maxBudget) score += 15;
    if (preferences.dates && tour.dates && tour.dates.includes(preferences.dates)) score += 10;
    score += Math.max(0, 10 - Math.floor(tour.price / 20000));
    return score;
}

function buildRecommendationText(recommendations, showAll = false) {
    if (!recommendations.length) return '';
    if (showAll || recommendations.length <= 3) {
        return recommendations.map((tour, index) => `${index + 1}. ${tour.name} — ${tour.price} руб. (${tour.country}), ${tour.description}, отправление ${tour.dates}`).join('\n');
    }
    return recommendations.slice(0, 3).map((tour, index) => `${index + 1}. ${tour.name} — ${tour.price} руб. (${tour.country})`).join('\n');
}

function buildAIAnswer(session, parsed) {
    const preferences = session.preferences;
    const allTours = TOURS.map(tour => ({ ...tour, score: scoreTour(tour, preferences) }));
    const validTours = allTours
        .filter(tour => isFinite(preferences.maxBudget) ? tour.price <= Math.max(preferences.maxBudget * 1.8, tour.price) : true)
        .sort((a, b) => b.score - a.score);
    const recommendations = validTours.filter(tour => tour.score > 10);
    session.lastRecommendations = recommendations;

    const hasPrefs = preferences.countries.length || preferences.maxBudget < Infinity || preferences.dates;
    const greeting = parsed.intent.greeting;
    const showAll = parsed.intent.showAll;
    const bookingIntent = parsed.intent.booking;
    const detailIntent = parsed.intent.detail;
    const farewell = parsed.intent.farewell;

    if (greeting && !hasPrefs) {
        return {
            response: 'Здравствуйте! Я ваш персональный туроператор. Расскажите, пожалуйста, ваш бюджет, интересующие страны или даты, и я подберу лучшие варианты.',
            recommendations: []
        };
    }

    if (farewell) {
        return {
            response: 'Спасибо за обращение! Если захотите, я могу подобрать новые туры или помочь с бронированием.',
            recommendations: []
        };
    }

    if (!hasPrefs) {
        return {
            response: 'Пока я знаю только, что вы хотите путешествие. Уточните, пожалуйста, бюджет, направление или даты поездки.',
            recommendations: []
        };
    }

    if (!recommendations.length) {
        let response = 'Я посмотрел доступные туры и пока не нашёл подходящих с вашими текущими предпочтениями.';
        if (preferences.maxBudget < Infinity) {
            response += ` Возможно, стоит увеличить бюджет выше ${preferences.maxBudget} руб.`;
        }
        if (preferences.countries.length) {
            response += ` Или выберите другую страну вместо ${preferences.countries.join(', ')}.`;
        }
        response += ' Напишите, пожалуйста, если хотите, чтобы я предложил другие варианты.';
        return { response, recommendations: [] };
    }

    if (bookingIntent) {
        return {
            response: 'Отлично! Я могу оформить бронирование. Пожалуйста, напишите ваши данные (имя, телефон и дату), и я подготовлю подтверждение.',
            recommendations: recommendations.slice(0, 3)
        };
    }

    const recommendationText = buildRecommendationText(recommendations, showAll);
    let response = 'Я подобрал несколько выгодных вариантов как ваш туроператор:';
    response += '\n' + recommendationText;

    if (showAll) {
        response += '\n\nЕсли хотите, могу оставить только самые подходящие варианты или подобрать по более точным датам.';
    } else if (recommendations.length > 3) {
        response += '\n\nСкажите, какой вариант вам нравится больше, или напишите "показать все", чтобы увидеть полный список.';
    } else {
        response += '\n\nЕсли хотите, я могу рассказать подробнее про любой из этих туров.';
    }

    if (detailIntent && recommendations.length) {
        response = `Хорошо, вот подробности по лучшим вариантам:\n${buildRecommendationText(recommendations, true)}`;
    }

    return { response, recommendations: recommendations.slice(0, 5) };
}

function getSession(sessionId) {
    if (!sessionId) return null;
    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            preferences: { minBudget: 0, maxBudget: Infinity, countries: [], dates: null },
            history: [],
            lastRecommendations: []
        };
    }
    return sessions[sessionId];
}

function recommendTours(userMessage, sessionId) {
    const parsed = parseRequest(userMessage);
    const session = getSession(sessionId) || { preferences: { minBudget: 0, maxBudget: Infinity, countries: [], dates: null }, history: [], lastRecommendations: [] };
    session.history.push({ role: 'user', text: userMessage });
    mergePreferences(session, parsed);
    const result = buildAIAnswer(session, parsed);
    session.history.push({ role: 'ai', text: result.response });

    return {
        response: result.response,
        recommendations: result.recommendations,
        filters: {
            minBudget: session.preferences.minBudget,
            maxBudget: session.preferences.maxBudget,
            countries: session.preferences.countries,
            dates: session.preferences.dates,
            historyLength: session.history.length,
            rulesSummary: AI_RULES_TEXT ? AI_RULES_TEXT.substring(0, 1500) : ''
        }
    };
}

// Chat endpoint
app.post('/api/chat', (req, res) => {
    const { message, sessionId } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const result = recommendTours(message, sessionId);
    res.json({
        id: Date.now(),
        timestamp: new Date(),
        userMessage: message,
        aiResponse: result.response,
        recommendations: result.recommendations,
        filters: result.filters,
        sessionId: sessionId || null
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'AI Chatbot running' });
});

app.listen(PORT, () => {
    console.log(`AI Chatbot running on port ${PORT}`);
});
