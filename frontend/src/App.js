import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ChatBot from './ChatBot';

function App() {
  const [tours, setTours] = useState([]);
  const [filters, setFilters] = useState({ country: '', price: '', dates: '' });
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    fetchTours();
  }, [filters]);

  const fetchTours = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/tours', { params: filters });
      setTours(response.data);
    } catch (error) {
      console.error('Error fetching tours:', error);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="App" style={styles.app}>
      <header style={styles.header}>
        <h1>🌍 Туры Online</h1>
        <button 
          onClick={() => setShowChat(!showChat)}
          style={styles.chatToggle}
        >
          {showChat ? 'Закрыть чат 📋' : 'Открыть AI чат 🤖'}
        </button>
      </header>

      <div style={styles.container}>
        <div style={showChat ? styles.tourListCollapsed : styles.tourList}>
          <h2>Список туров</h2>
          <div style={styles.filters}>
            <input 
              name="country" 
              placeholder="Страна" 
              onChange={handleFilterChange}
              style={styles.filterInput}
            />
            <input 
              name="price" 
              placeholder="Макс. цена (руб)" 
              onChange={handleFilterChange}
              style={styles.filterInput}
            />
            <input 
              name="dates" 
              placeholder="Даты" 
              onChange={handleFilterChange}
              style={styles.filterInput}
            />
          </div>
          <div style={styles.toursGrid}>
            {tours.map(tour => (
              <div key={tour._id} style={styles.tourCard}>
                <h3>{tour.name}</h3>
                <p><strong>Страна:</strong> {tour.country}</p>
                <p><strong>Цена:</strong> {tour.price} руб.</p>
                <p><strong>Описание:</strong> {tour.description}</p>
                <p><strong>Дата:</strong> {tour.dates}</p>
                <button style={styles.bookButton}>Посмотреть тур</button>
              </div>
            ))}
          </div>
        </div>

        {showChat && (
          <div style={styles.chatSection}>
            <ChatBot />
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  app: {
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f5f5',
    minHeight: '100vh'
  },
  header: {
    backgroundColor: '#2196F3',
    color: 'white',
    padding: '20px',
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chatToggle: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  container: {
    display: 'flex',
    gap: '20px',
    padding: '20px'
  },
  tourList: {
    flex: 1
  },
  tourListCollapsed: {
    display: 'none'
  },
  filters: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  filterInput: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    fontSize: '14px'
  },
  toursGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  tourCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  bookButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '10px',
    fontSize: '14px'
  },
  chatSection: {
    flex: 0.5,
    minWidth: '400px'
  }
};

export default App;