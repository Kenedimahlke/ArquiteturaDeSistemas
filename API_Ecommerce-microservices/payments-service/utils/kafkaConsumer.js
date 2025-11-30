const { Kafka } = require('kafkajs');
const axios = require('axios');

const PAYMENTS_SERVICE_URL = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3004';

class KafkaConsumer {
  constructor() {
    this.kafka = null;
    this.consumer = null;
    this.isConnected = false;
  }

  async connect() {
    try {

      const brokers = (process.env.KAFKA_BROKERS || process.env.KAFKA_BROKER || 'localhost:9093').split(',');
      
      console.log('[Kafka Consumer] Conectando ao Kafka...', brokers);
      
      this.kafka = new Kafka({
        clientId: 'payments-service',
        brokers,
        retry: {
          retries: 8,
          initialRetryTime: 300,
          maxRetryTime: 30000
        }
      });

      this.consumer = this.kafka.consumer({ 
        groupId: 'payments-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000
      });
      
      await this.consumer.connect();
      
      // Subscrever ao tópico 'orders'
      await this.consumer.subscribe({ 
        topic: 'orders', 
        fromBeginning: false 
      });
      
      this.isConnected = true;
      console.log('[Kafka Consumer] Consumer conectado e subscrito ao tópico "orders"!');

      // Processar mensagens
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const value = JSON.parse(message.value.toString());
            const eventType = message.headers['event-type']?.toString() || value.eventType;
            
            console.log(`[Kafka Consumer] Mensagem recebida do tópico "${topic}":`, {
              eventType,
              orderId: value.orderId,
              total: value.total,
              paymentsLength: value.payments?.length || 0
            });

            // Processar evento de requisição de pagamento
            if ((eventType === 'order.created' || eventType === 'payment.requested') && value.payments && value.payments.length > 0) {
              console.log(`[Kafka Consumer] Processando pagamentos do pedido ${value.orderId}...`);
              
              // Chamar o endpoint REST de processamento de pagamento
              try {
                const response = await axios.post(
                  `${PAYMENTS_SERVICE_URL}/v1/payments/process/${value.orderId}`,
                  { payments: value.payments }
                );
                console.log(`[Kafka Consumer] ✓ Pagamentos processados com sucesso:`, response.data);
              } catch (error) {
                console.error('[Kafka Consumer] ✗ Erro ao processar pagamento:', error.response?.data || error.message);
                // TODO: Implementar retry ou dead letter queue
              }
            } else {
              console.log('[Kafka Consumer] Evento ignorado (type: ${eventType}, has payments: ${!!value.payments})');
            }

          } catch (error) {
            console.error('[Kafka Consumer] Erro ao processar mensagem:', error.message);
            // Não lançar erro para não parar o consumer
          }
        }
      });

    } catch (error) {
      console.error('[Kafka Consumer] Erro ao conectar:', error.message);
      this.isConnected = false;
      setTimeout(() => this.connect(), 5000);
    }
  }

  async close() {
    try {
      await this.consumer?.disconnect();
      this.isConnected = false;
      console.log('[Kafka Consumer] Consumer desconectado');
    } catch (error) {
      console.error('[Kafka Consumer] Erro ao desconectar consumer:', error.message);
    }
  }
}

// Singleton
const consumer = new KafkaConsumer();

module.exports = consumer;
