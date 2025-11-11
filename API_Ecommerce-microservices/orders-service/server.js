const express = require('express');
const mongoose = require('mongoose');
const ordersRoutes = require('./routes/ordersRoutes');
const eventPublisher = require('./utils/eventPublisher');

const app = express();
app.use(express.json());

// Connect to MongoDB
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://admin:password@localhost:27017/orders_db?authSource=admin';

mongoose.connect(MONGODB_URL)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

// Connect to RabbitMQ
eventPublisher.connect().catch(err => {
  console.error('Failed to connect to RabbitMQ:', err);
  // N�o mata o processo, permite reconex�o
});

app.use('/v1/orders', ordersRoutes);

app.get('/health', (req, res) => res.json({ 
  service: 'orders-service',
  status: 'ok', 
  uptime: process.uptime(),
  database: 'MongoDB'
}));

app.get('/', (req, res) => res.send('Orders Service - Use /v1/orders to interact with orders.'));

app.use((err, req, res, next) => {
  console.error(err);
  
  // Trata erros de JSON malformado
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ erro: 'Dados JSON inv�lidos' });
  }
  
  res.status(err.status || 500).json({ erro: err.message || 'Internal Error!' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Orders Service running on http://localhost:${PORT}`));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await eventPublisher.close();
  await mongoose.connection.close();
  process.exit(0);
});
