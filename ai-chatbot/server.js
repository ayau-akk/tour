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

// Tours from backend - with extended metadata
const TOURS = [
    { _id: '1', name: 'Тур в Париж', description: 'Романтический тур на неделю', country: 'Франция', price: 50000, dates: '2024-06-01', tags: ['романтический', 'город', 'культура'], nights: 7, includes: 'отель 4*, завтрак, экскурсии' },
    { _id: '2', name: 'Тур в Токио', description: 'Культурный тур с посещением храмов и музеев', country: 'Япония', price: 80000, dates: '2024-07-01', tags: ['культура', 'город', 'экзотика'], nights: 10, includes: 'отель 4*, завтрак, гид на русском' },
    { _id: '3', name: 'Тур в Нью-Йорк', description: 'Городской тур с посещением Бродвея и музеев', country: 'США', price: 70000, dates: '2024-08-01', tags: ['город', 'развлечения', 'шопинг'], nights: 5, includes: 'отель 5*, билеты в театры' },
    { _id: '4', name: 'Тур в Барселону', description: 'Архитектурный тур с произведениями Гауди', country: 'Испания', price: 45000, dates: '2024-06-15', tags: ['архитектура', 'город', 'культура', 'бюджетный'], nights: 5, includes: 'отель 3*, завтрак, пляж' }
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
        detail: /\b(подробнее|расскажи|что включает|что входит|какие условия|сколько дней|ночей)\b/.test(text),
        preference: /\b(хочу|ищу|нужно|интересует|люблю|нравится|не хочу)\b/.test(text),
        objection: /\b(дорого|слишком|дешевле|скидка|выплата|рассрочка)\b/.test(text),
        tooExpensive: /\b(дорого|слишком дорого|не тяну|не потяну)\b/.test(text),
        changePreference: /\b(другой|иной|еще|еще вариант|попробуй другой)\b/.test(text)
    };

    let maxBudget = Infinity;
    let minBudget = 0;
    const budgetRegex = /(до|от)?\s*([0-9][0-9\s,\.]*)\s*(k|к|тыс|тысяч|руб|рублей)?/i;
    const budgetMatch = text.match(budgetRegex);
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

    // Detect tour type preferences
    const tourTypes = [];
    if (/\b(романтичес|любовн|пара|молодож)\b/.test(text)) tourTypes.push('романтический');
    if (/\b(семей|дети|ребенок|малыш)\b/.test(text)) tourTypes.push('семейный');
    if (/\b(приключ|актив|экстрим|трек|поход)\b/.test(text)) tourTypes.push('приключенческий');
    if (/\b(релакс|отдых|спа|пляж|бассейн)\b/.test(text)) tourTypes.push('релаксирующий');
    if (/\b(культур|музей|достоприм|архитектур|искусство)\b/.test(text)) tourTypes.push('культурный');

    const countriesMap = {
        'париж': 'Франция',
        'францию': 'Франция',
        'франция': 'Франция',
        'токио': 'Япония',
        'японию': 'Япония',
        'япония': 'Япония',
        'нью-йорк': 'США',
        'нью йорк': 'США',
        'америка': 'США',
        'соединенные штаты': 'США',
        'сша': 'США',
        'барселона': 'Испания',
        'барселону': 'Испания',
        'испания': 'Испания',
        'испанию': 'Испания'
    };
    const countries = Object.entries(countriesMap)
        .filter(([key]) => text.includes(key))
        .map(([, value]) => value);

    const datesMatch = text.match(/\d{4}-\d{2}-\d{2}|\d{1,2}\s*(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i);
    const dates = datesMatch ? datesMatch[0] : null;

    return { text, intent, budget: { minBudget, maxBudget }, countries, dates, tourTypes };
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
    if (parsed.tourTypes.length > 0) {
        session.preferences.tourTypes = Array.from(new Set([...session.preferences.tourTypes, ...parsed.tourTypes]));
    }
}

function scoreTour(tour, preferences) {
    let score = 0;
    
    // Country match (high weight)
    if (!preferences.countries.length || preferences.countries.includes(tour.country)) {
        score += 40;
    } else {
        score -= 15;
    }
    
    // Budget fit (high weight)
    if (tour.price <= preferences.maxBudget && tour.price >= preferences.minBudget) {
        score += 35;
    } else if (tour.price <= preferences.maxBudget) {
        score += 15;
    }
    
    // Prefer cheaper tours slightly
    score += Math.max(0, 10 - Math.floor(tour.price / 20000));
    
    // Date match
    if (preferences.dates && tour.dates && tour.dates.includes(preferences.dates)) {
        score += 10;
    }
    
    // Tour type match
    if (preferences.tourTypes.length > 0 && tour.tags) {
        const matchedTags = tour.tags.filter(tag => preferences.tourTypes.includes(tag));
        score += matchedTags.length * 15;
    }
    
    return score;
}

function buildRecommendationText(recommendations, showAll = false) {
    if (!recommendations.length) return '';
    if (showAll || recommendations.length <= 3) {
        return recommendations.map((tour, index) => 
            `${index + 1}. ${tour.name} — ${tour.price} руб. (${tour.nights} ночей, ${tour.country})\n   ${tour.description}\n   Включено: ${tour.includes}`
        ).join('\n\n');
    }
    return recommendations.slice(0, 3).map((tour, index) => 
        `${index + 1}. ${tour.name} — ${tour.price} руб. (${tour.country}, ${tour.nights} ночей)`
    ).join('\n');
}

function buildAIAnswer(session, parsed) {
    const preferences = session.preferences;
    const allTours = TOURS.map(tour => ({ ...tour, score: scoreTour(tour, preferences) }));
    const validTours = allTours
        .filter(tour => isFinite(preferences.maxBudget) ? tour.price <= Math.max(preferences.maxBudget * 1.8, tour.price) : true)
        .sort((a, b) => b.score - a.score);
    const recommendations = validTours.filter(tour => tour.score > 10);
    session.lastRecommendations = recommendations;

    const hasPrefs = preferences.countries.length || preferences.maxBudget < Infinity || preferences.dates || preferences.tourTypes.length;
    const greeting = parsed.intent.greeting;
    const showAll = parsed.intent.showAll;
    const bookingIntent = parsed.intent.booking;
    const detailIntent = parsed.intent.detail;
    const farewell = parsed.intent.farewell;
    const tooExpensive = parsed.intent.tooExpensive;
    const changePreference = parsed.intent.changePreference;
    const objection = parsed.intent.objection;

    // Handle objections about price
    if (tooExpensive && recommendations.length) {
        const cheapest = validTours.filter(t => t.price < preferences.maxBudget).sort((a, b) => a.price - b.price)[0];
        if (cheapest && cheapest.price < preferences.maxBudget * 0.8) {
            let response = `Понимаю, может цена выше ожиданий. 💰 Предлагаю вариант дешевле:\n"${cheapest.name}" всего за ${cheapest.price} руб., ${cheapest.description}`;
            response += `\n\nЭто включает: ${cheapest.includes}`;
            return { response, recommendations: [cheapest] };
        }
        
        if (preferences.maxBudget < Infinity && preferences.maxBudget > 20000) {
            const newBudget = Math.floor(preferences.maxBudget * 0.7);
            preferences.maxBudget = newBudget;
            const cheaper = validTours.filter(t => t.price <= newBudget).sort((a, b) => b.score - a.score)[0];
            if (cheaper) {
                return {
                    response: `Спасибо за уточнение! 👍 Тогда предлагаю туры до ${newBudget} руб.:\n"${cheaper.name}" — ${cheaper.price} руб.\n\nМожно ещё поискать в этом диапазоне?`,
                    recommendations: validTours.filter(t => t.price <= newBudget).slice(0, 3)
                };
            }
        }
    }

    if (greeting && !hasPrefs && session.history.length === 0) {
        return {
            response: 'Здравствуйте! 👋 Я ваш персональный туроператор. Расскажите о мечте вашего путешествия — бюджет, страна, тип отдыха (романтика, семья, приключение, культура), и я подберу идеальный тур!',
            recommendations: []
        };
    }

    if (greeting && hasPrefs) {
        return {
            response: `Спасибо за контакт! 😊 Помню ваши предпочтения. Давайте уточним деталь: вы ещё ищете подходящий вариант или хотите что-то изменить?`,
            recommendations: []
        };
    }

    if (farewell) {
        return {
            response: 'Спасибо за внимание! 🙏 Если захотите позже, я помогу вам найти идеальный тур. Звоните, пишите — я здесь!',
            recommendations: []
        };
    }

    if (!hasPrefs) {
        return {
            response: 'Я хотел бы помочь, но пока знаю только, что вы хотите путешествие. Подскажите, пожалуйста:\n• Ваш бюджет?\n• Какие страны интересуют?\n• Тип отдыха (спокойный, активный, культурный)?',
            recommendations: []
        };
    }

    if (!recommendations.length) {
        let response = 'Я посмотрел доступные туры... к сожалению, подходящих вариантов пока нет.';
        if (preferences.maxBudget < Infinity) {
            response += ` Возможно, стоит увеличить бюджет выше ${preferences.maxBudget} руб.`;
        }
        if (preferences.countries.length) {
            response += ` Или попробуем ${preferences.countries.length === 1 ? 'другую' : 'другие'} страны?`;
        }
        response += '\n\nЧто вы предлагаете?';
        return { response, recommendations: [] };
    }

    if (bookingIntent) {
        const top3 = recommendations.slice(0, 3);
        let response = 'Отлично! 🎉 Я готов помочь с бронированием. Выберите подходящий тур и напишите:\n• Фамилию и имя\n• Номер телефона\n• Количество человек\n\nВот мои ТОП рекомендации:';
        return { response, recommendations: top3 };
    }

    const recommendationText = buildRecommendationText(recommendations, showAll);
    let response = `Отлично! 🎯 Я подобрал для вас лучшие варианты:\n\n${recommendationText}`;

    if (showAll) {
        response += '\n\n📋 Все варианты перед вами. Какой привлекает больше?';
    } else if (recommendations.length > 3) {
        response += '\n\n✨ Это топ-3 по релевантности. Хотите увидеть остальные — напишите "показать все"?';
    } else {
        response += '\n\n📞 Интересует один из этих туров? Спросите подробнее, и я расскажу о сроках вылета, визах, страховке.';
    }

    if (detailIntent && recommendations.length) {
        const top = recommendations[0];
        response = `Подробнее о "${top.name}":\n\n📍 Страна: ${top.country}\n💰 Цена: ${top.price} руб.\n🌙 Количество ночей: ${top.nights}\n📝 Описание: ${top.description}\n✓ Включено: ${top.includes}\n\n📅 Отправление: ${top.dates}\n\nХотите забронировать или посмотреть альтернативы?`;
    }

    return { response, recommendations: recommendations.slice(0, 5) };
}

function getSession(sessionId) {
    if (!sessionId) return null;
    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            preferences: { minBudget: 0, maxBudget: Infinity, countries: [], dates: null, tourTypes: [] },
            history: [],
            lastRecommendations: []
        };
    }
    return sessions[sessionId];
}

function recommendTours(userMessage, sessionId) {
    const parsed = parseRequest(userMessage);
    const session = getSession(sessionId) || { preferences: { minBudget: 0, maxBudget: Infinity, countries: [], dates: null, tourTypes: [] }, history: [], lastRecommendations: [] };
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
            tourTypes: session.preferences.tourTypes,
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
