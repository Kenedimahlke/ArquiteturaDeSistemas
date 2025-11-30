const amqp = require('amqplib');

class NotificationProducer {
  constructor() {
    this.exchange = 'order.events';
    this.exchangeType = 'topic';
    this.routingKey = 'order.status.changed';
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;
    const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
    this.connection = await amqp.connect(RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, this.exchangeType, { durable: true });
    this.isConnected = true;
  }

  async publishNotification(event) {
    if (!this.isConnected) await this.connect();
    const payload = Buffer.from(JSON.stringify(event));
    this.channel.publish(this.exchange, this.routingKey, payload, { persistent: true });
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    this.isConnected = false;
  }
}

module.exports = NotificationProducer;
