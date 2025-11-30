const { Order, Status } = require('../models/Order');
const { validateOrderPayload } = require('../utils/validators');
const { createError } = require('../utils/errors');
const axios = require('../utils/axios-config');
const eventPublisher = require('../utils/eventPublisher');
const kafkaProducer = require('../utils/kafkaProducer');

const CLIENTS_SERVICE_URL = process.env.CLIENTS_SERVICE_URL || 'http://localhost:3002';
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3001';

module.exports = {
  list: () => Order.find({ isDeleted: false }),
  obtain: (id) => Order.findOne({ _id: id, isDeleted: false }),
  create: async (payload, payments) => {
    validateOrderPayload(payload);

    // 1. Validar cliente
    try {
      const clientResponse = await axios.get(`${CLIENTS_SERVICE_URL}/v1/clients/${payload.clientId}/validate`);
      if (!clientResponse.data.valid) {
        throw createError(404, 'Client not found');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        throw createError(404, 'Client not found');
      }
      throw createError(500, 'Error validating client');
    }

    // 2. Buscar informações dos produtos e validar estoque
    const enrichedItems = [];
    let total = 0;

    try {
      for (const item of payload.items) {
        // Buscar informações do produto
        const productResponse = await axios.get(`${PRODUCTS_SERVICE_URL}/v1/products/${item.productId}`);
        const product = productResponse.data;

        if (!product) {
          throw createError(404, `Product ${item.productId} not found`);
        }

        // Verificar estoque
        if (product.stock < item.quantity) {
          throw createError(400, `Insufficient stock for product ${product.name}. Available: ${product.stock}, Required: ${item.quantity}`);
        }
        // Criar item enriquecido com informações do produto
        const enrichedItem = {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          subtotal: product.price * item.quantity
        };
        enrichedItems.push(enrichedItem);
        total += enrichedItem.subtotal;
      }
    } catch (error) {
      if (error.status) throw error; // Re-throw our custom errors
      if (error.response?.status === 404) {
        throw createError(404, 'Product not found');
      }
      throw createError(500, 'Error fetching product information');
    }
    // 3. Reservar estoque dos produtos
    try {
      const stockCheckPayload = {
        products: enrichedItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      };

      const stockResponse = await axios.post(`${PRODUCTS_SERVICE_URL}/v1/products/check-stock`, stockCheckPayload);

      if (!stockResponse.data.success) {
        throw createError(400, stockResponse.data.erro || 'Error reserving stock');
      }
    } catch (error) {
      if (error.status) throw error; // Re-throw our custom errors
      if (error.response?.status === 400) {
        throw createError(400, error.response.data.erro || 'Insufficient stock');
      }
      throw createError(500, 'Error checking stock');
    }
    // 4. Criar o pedido com os itens enriquecidos
    const orderData = {
      clientId: payload.clientId,
      status: 'AGUARDANDO PAGAMENTO',
      total,
      items: enrichedItems
    };

    const order = new Order(orderData);
    const savedOrder = await order.save();

    // 5. Se houver pagamentos, enviar para Kafka (desacoplado)
    if (payments && Array.isArray(payments) && payments.length > 0) {
      try {
        await kafkaProducer.publishOrder('payment.requested', {
          orderId: savedOrder._id.toString(),
          clientId: savedOrder.clientId,
          items: savedOrder.items,
          total: savedOrder.total,
          payments: payments
        });
        console.log(`✓ Payment request sent to Kafka for order ${savedOrder._id}`);
      } catch (error) {
        // Não impede a criação do pedido, mas loga o erro
        console.error('✗ Failed to send payment request to Kafka:', error.message);
        // Aqui poderíamos implementar uma fila de retry ou dead letter queue
      }
    }

    return savedOrder;
  },
  
  getOrdersByClient: async (clientId) => {
    // Validar se o cliente existe
    try {
      const clientResponse = await axios.get(`${CLIENTS_SERVICE_URL}/v1/clients/${clientId}/validate`);
      if (!clientResponse.data.valid) {
        throw createError(404, 'Client not found');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        throw createError(404, 'Client not found');
      }
      throw createError(500, 'Error validating client');
    }
    
    return await Order.find({ 
      clientId,
      isDeleted: false 
    });
  },
  
  updateStatus: async (orderId, statusName) => {
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, isDeleted: false },
      { status: statusName },
      { new: true }
    );
    
    if (!updated) throw createError(404, 'Order not found');
    
    // 🔥 PUBLICAR EVENTO: Status do pedido alterado
    await eventPublisher.publish('order.status.changed', {
      orderId: updated._id.toString(),
      clientId: updated.clientId,
      oldStatus: updated.status, // Obs: aqui já está atualizado, idealmente guardaria o antigo
      newStatus: statusName,
      total: updated.total,
      items: updated.items
    });
    
    console.log(`[ORDER] Status alterado: ${orderId} -> ${statusName}`);
    
    return updated;
  }
};