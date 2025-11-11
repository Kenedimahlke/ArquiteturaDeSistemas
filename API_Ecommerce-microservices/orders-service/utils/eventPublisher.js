const amqp = require('amqplib');

class EventPublisher {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
      
      console.log('[RabbitMQ] Conectando ao RabbitMQ...');
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      
      // Declarar exchange para eventos de pedidos
      await this.channel.assertExchange('order.events', 'topic', { durable: true });
      
      this.isConnected = true;
      console.log('[RabbitMQ] ✓ Conectado com sucesso!');

      // Handlers para reconexão
      this.connection.on('error', (err) => {
        console.error('[RabbitMQ] Erro na conexão:', err);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        console.log('[RabbitMQ] Conexão fechada. Tentando reconectar em 5s...');
        this.isConnected = false;
        setTimeout(() => this.connect(), 5000);
      });

    } catch (error) {
      console.error('[RabbitMQ] Erro ao conectar:', error.message);
      this.isConnected = false;
      // Tentar reconectar
      setTimeout(() => this.connect(), 5000);
    }
  }

  async publish(eventType, data) {
    if (!this.isConnected || !this.channel) {
      console.warn('[RabbitMQ] Não conectado. Tentando conectar...');
      await this.connect();
    }

    try {
      const message = JSON.stringify({
        eventType,
        data,
        timestamp: new Date().toISOString()
      });

      this.channel.publish(
        'order.events',
        eventType,
        Buffer.from(message),
        { persistent: true }
      );

      console.log(`[RabbitMQ] ✓ Evento publicado: ${eventType}`, data);
      return true;
    } catch (error) {
      console.error(`[RabbitMQ] Erro ao publicar evento ${eventType}:`, error.message);
      return false;
    }
  }

  async close() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.isConnected = false;
      console.log('[RabbitMQ] Conexão fechada');
    } catch (error) {
      console.error('[RabbitMQ] Erro ao fechar conexão:', error.message);
    }
  }
}

// Singleton
const publisher = new EventPublisher();

module.exports = publisher;
