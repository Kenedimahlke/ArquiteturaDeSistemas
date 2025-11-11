const express = require('express');
const EventConsumer = require('./utils/eventConsumer');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

// Criar consumer para fila de notificações
const consumer = new EventConsumer('notification_queue');

// Conectar ao RabbitMQ
consumer.connect().then(() => {
  // Inscrever-se no evento de mudança de status
  consumer.subscribe('order.status.changed', async (eventData, eventType) => {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🔔 NOVA NOTIFICAÇÃO');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📱 Cliente ID: ${eventData.clientId}`);
    console.log(`📦 Pedido ID: ${eventData.orderId}`);
    console.log(`📊 Novo Status: ${eventData.newStatus}`);
    console.log(`💰 Valor Total: R$ ${eventData.total?.toFixed(2) || '0.00'}`);
    console.log(`⏰ Timestamp: ${new Date().toLocaleString('pt-BR')}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    
    // Aqui você pode adicionar lógica real de envio:
    // - Push notification
    // - SMS
    // - Email
    // - WhatsApp
    
    // Simular envio de notificação push
    await sendPushNotification(eventData);
  });
  
  console.log('✓ Notification Service pronto para receber eventos!');
}).catch(err => {
  console.error('Erro ao conectar consumer:', err);
});

// Função simulada de envio de notificação
async function sendPushNotification(data) {
  // Simula delay de envio
  return new Promise(resolve => {
    setTimeout(() => {
      console.log(`✉️  [PUSH] Notificação enviada ao cliente ${data.clientId}`);
      resolve();
    }, 500);
  });
}

// Endpoint para receber notificações push (mantido para compatibilidade)
app.post('/v1/notifications', (req, res) => {
  const { clientId, title, message } = req.body;
  console.log(`[HTTP PUSH] Notificação para cliente ${clientId}: ${title} - ${message}`);
  res.json({ success: true, message: 'Notificação enviada (simulada)' });
});

app.get('/health', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`Notification Service rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down notification service...');
  await consumer.close();
  process.exit(0);
});
