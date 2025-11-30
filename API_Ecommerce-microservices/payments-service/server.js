const express = require('express');
const { PrismaClient } = require('@prisma/client');
const paymentsRoutes = require('./routes/paymentsRoutes');
const consumer = require('./utils/kafkaConsumer');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

app.use('/v1/payments', paymentsRoutes);

app.get('/health', (req, res) => res.json({ 
  service: 'payments-service',
  status: 'ok', 
  uptime: process.uptime() 
}));

app.get('/', (req, res) => res.send('Payments Service - Use /v1/payments to interact with payments.'));

app.use((err, req, res, next) => {
  console.error(err);
  
  // Trata erros de JSON malformado
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ erro: 'Dados JSON inválidos' });
  }
  
  res.status(err.status || 500).json({ erro: err.message || 'Internal Error!' });
});

const PORT = process.env.PORT || 3004;

// Iniciar servidor HTTP
app.listen(PORT, () => {
  console.log(`Payments Service running on http://localhost:${PORT}`);
  
  // Iniciar Kafka Consumer após o servidor estar rodando
  if (process.env.KAFKA_BROKER) {
    consumer.connect().catch(err => {
      console.error('Failed to start Kafka Consumer:', err);
    });
    // Graceful shutdown
    process.on('SIGTERM', () => consumer.close());
    process.on('SIGINT', () => consumer.close());
  } else {
    console.log('⚠ Kafka Consumer disabled (KAFKA_BROKER not configured)');
  }
});