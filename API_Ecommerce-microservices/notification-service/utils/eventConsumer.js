const amqp = require('amqplib');

class EventConsumer {
  constructor(queueName) {
    this.queueName = queueName;
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
      
      console.log('[RabbitMQ Consumer] Conectando ao RabbitMQ...');
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();
      
      // Criar fila durável
      await this.channel.assertQueue(this.queueName, { durable: true });
      
      // Declarar exchange (mesmo que o publisher)
      await this.channel.assertExchange('order.events', 'topic', { durable: true });
      
      this.isConnected = true;
      console.log(`[RabbitMQ Consumer] ✓ Conectado! Fila: ${this.queueName}`);

      // Handlers para reconexão
      this.connection.on('error', (err) => {
        console.error('[RabbitMQ Consumer] Erro na conexão:', err);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        console.log('[RabbitMQ Consumer] Conexão fechada. Tentando reconectar em 5s...');
        this.isConnected = false;
        setTimeout(() => this.connect(), 5000);
      });

    } catch (error) {
      console.error('[RabbitMQ Consumer] Erro ao conectar:', error.message);
      this.isConnected = false;
      setTimeout(() => this.connect(), 5000);
    }
  }

  async subscribe(eventPattern, handler) {
    if (!this.isConnected || !this.channel) {
      console.warn('[RabbitMQ Consumer] Não conectado. Tentando conectar...');
      await this.connect();
    }

    try {
      // Fazer bind da fila ao exchange com o padrão do evento
      await this.channel.bindQueue(this.queueName, 'order.events', eventPattern);
      
      console.log(`[RabbitMQ Consumer] ✓ Inscrito no evento: ${eventPattern}`);

      // Configurar consumer
      this.channel.consume(this.queueName, async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          console.log(`[RabbitMQ Consumer] ← Evento recebido: ${content.eventType}`);
          
          // Executar handler
          await handler(content.data, content.eventType);
          
          // Confirmar processamento (ACK)
          this.channel.ack(msg);
          console.log(`[RabbitMQ Consumer] ✓ Evento processado com sucesso`);
          
        } catch (error) {
          console.error('[RabbitMQ Consumer] ✗ Erro ao processar mensagem:', error);
          
          // Rejeitar e NÃO recolocar na fila (evita loop infinito)
          // Se quiser reprocessar, use: this.channel.nack(msg, false, true);
          this.channel.nack(msg, false, false);
        }
      }, {
        noAck: false // Requer confirmação manual
      });

    } catch (error) {
      console.error(`[RabbitMQ Consumer] Erro ao se inscrever em ${eventPattern}:`, error.message);
    }
  }

  async close() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.isConnected = false;
      console.log('[RabbitMQ Consumer] Conexão fechada');
    } catch (error) {
      console.error('[RabbitMQ Consumer] Erro ao fechar conexão:', error.message);
    }
  }
}

module.exports = EventConsumer;
