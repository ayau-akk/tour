const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tourdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Tour Schema
const tourSchema = new mongoose.Schema({
  name: String,
  description: String,
  country: String,
  price: Number,
  dates: String
});

const Tour = mongoose.model('Tour', tourSchema);

// Routes
app.get('/api/tours', async (req, res) => {
  const { country, price, dates } = req.query;
  let query = {};
  if (country) query.country = country;
  if (price) query.price = { $lte: price };
  if (dates) query.dates = dates;
  const tours = await Tour.find(query);
  res.json(tours);
});

app.get('/api/tours/:id', async (req, res) => {
  const tour = await Tour.findById(req.params.id);
  res.json(tour);
});

app.post('/api/bookings', async (req, res) => {
  // Mock booking without payment
  res.json({ message: 'Бронирование успешно (без оплаты)' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});