const { Kafka } = require('kafkajs');

class KafkaProducer {
  constructor() {
    this.kafka = null;
    this.producer = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const brokers = (process.env.KAFKA_BROKERS || 'localhost:9093').split(',');
      
      console.log('[Kafka] Conectando ao Kafka...', brokers);
      
      this.kafka = new Kafka({
        clientId: 'orders-service',
        brokers,
        retry: {
          retries: 8,
          initialRetryTime: 300,
          maxRetryTime: 30000
        }
      });

      this.producer = this.kafka.producer();
      await this.producer.connect();
      
      this.isConnected = true;
      console.log('[Kafka] Producer conectado com sucesso!');

      // Handlers para eventos
      this.producer.on('producer.disconnect', () => {
        console.log('[Kafka] Producer desconectado. Tentando reconectar...');
        this.isConnected = false;
        setTimeout(() => this.connect(), 5000);
      });

    } catch (error) {
      console.error('[Kafka] Erro ao conectar:', error.message);
      this.isConnected = false;
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publishOrder(eventType, orderData) {
    if (!this.isConnected || !this.producer) {
      console.warn('[Kafka] Producer não conectado. Tentando conectar...');
      await this.connect();
    }

    try {
      const message = {
        eventType,
        orderId: orderData.orderId,
        clientId: orderData.clientId,
        items: orderData.items,
        total: orderData.total,
        timestamp: new Date().toISOString(),
        payments: orderData.payments || []
      };

      await this.producer.send({
        topic: 'orders',
        messages: [
          {
            key: orderData.orderId,
            value: JSON.stringify(message),
            headers: {
              'event-type': eventType
            }
          }
        ]
      });

      console.log(`[Kafka] Evento publicado no tópico 'orders':`, {
        eventType,
        orderId: orderData.orderId,
        total: orderData.total
      });
      
      return true;
    } catch (error) {
      console.error(`[Kafka] Erro ao publicar evento ${eventType}:`, error.message);
      return false;
    }
  }

  async close() {
    try {
      await this.producer?.disconnect();
      this.isConnected = false;
      console.log('[Kafka] Producer desconectado');
    } catch (error) {
      console.error('[Kafka] Erro ao desconectar producer:', error.message);
    }
  }
}

// Singleton
const producer = new KafkaProducer();

module.exports = producer;
