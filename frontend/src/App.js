import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [tours, setTours] = useState([]);
  const [filters, setFilters] = useState({ country: '', price: '', dates: '' });

  useEffect(() => {
    fetchTours();
  }, [filters]);

  const fetchTours = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/tours', { params: filters });
      setTours(response.data);
    } catch (error) {
      console.error('Error fetching tours:', error);
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="App">
      <h1>Список туров</h1>
      <div>
        <input name="country" placeholder="Страна" onChange={handleFilterChange} />
        <input name="price" placeholder="Цена" onChange={handleFilterChange} />
        <input name="dates" placeholder="Даты" onChange={handleFilterChange} />
      </div>
      <ul>
        {tours.map(tour => (
          <li key={tour._id}>
            <h2>{tour.name}</h2>
            <p>{tour.description}</p>
            <p>Цена: {tour.price}</p>
            <button>Посмотреть тур</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;