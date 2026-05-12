import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function ChatBot() {
  const [messages, setMessages] = useState([
    { type: 'ai', text: 'Привет! 👋 Я AI-помощник для подбора туров. Расскажи о своем бюджете, интересующих странах или датах путешествия, и я помогу тебе найти идеальный тур!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;

    // Add user message to chat
    const userMessage = { type: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5002/api/chat', {
        message: input
      });

      const aiMessage = { 
        type: 'ai', 
        text: response.data.aiResponse,
        recommendations: response.data.recommendations 
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        type: 'ai', 
        text: 'Извини, произошла ошибка при подключении к AI. Убедись, что AI-сервер запущен на порту 5002.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2>🤖 AI Помощник по турам</h2>
      </div>
      
      <div style={styles.messagesContainer}>
        {messages.map((msg, index) => (
          <div key={index} style={msg.type === 'user' ? styles.userMessageWrapper : styles.aiMessageWrapper}>
            <div style={msg.type === 'user' ? styles.userMessage : styles.aiMessage}>
              <p>{msg.text}</p>
              
              {msg.recommendations && msg.recommendations.length > 0 && (
                <div style={styles.recommendations}>
                  {msg.recommendations.map(tour => (
                    <div key={tour._id} style={styles.tourCard}>
                      <h4>{tour.name}</h4>
                      <p><strong>Страна:</strong> {tour.country}</p>
                      <p><strong>Цена:</strong> {tour.price} руб.</p>
                      <p><strong>Описание:</strong> {tour.description}</p>
                      <p><strong>Дата:</strong> {tour.dates}</p>
                      <button style={styles.bookButton}>Забронировать</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={styles.aiMessageWrapper}>
            <div style={styles.aiMessage}>
              <p>Думаю... ⏳</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напиши о своем путешествии..."
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" style={styles.sendButton} disabled={loading}>
          Отправить
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '600px',
    margin: '20px auto',
    border: '1px solid #ddd',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    height: '600px',
    backgroundColor: '#f9f9f9',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
  },
  header: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '15px',
    borderRadius: '10px 10px 0 0',
    textAlign: 'center'
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '15px',
    backgroundColor: '#fff'
  },
  userMessageWrapper: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '10px'
  },
  aiMessageWrapper: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginBottom: '10px'
  },
  userMessage: {
    backgroundColor: '#4CAF50',
    color: 'white',
    padding: '10px 15px',
    borderRadius: '15px',
    maxWidth: '70%',
    wordWrap: 'break-word'
  },
  aiMessage: {
    backgroundColor: '#f0f0f0',
    color: '#333',
    padding: '10px 15px',
    borderRadius: '15px',
    maxWidth: '70%',
    wordWrap: 'break-word'
  },
  recommendations: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  tourCard: {
    backgroundColor: 'white',
    border: '1px solid #ddd',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '12px'
  },
  bookButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '5px'
  },
  inputForm: {
    display: 'flex',
    gap: '10px',
    padding: '15px',
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #ddd',
    borderRadius: '0 0 10px 10px'
  },
  input: {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px'
  },
  sendButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  }
};

export default ChatBot;
