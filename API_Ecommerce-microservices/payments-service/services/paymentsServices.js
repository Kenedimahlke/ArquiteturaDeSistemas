const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createError } = require('../utils/errors');

const axios = require('../utils/axios-config');
const NotificationProducer = require('../utils/notificationProducer');

const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL || 'http://localhost:3003';
const CLIENTS_SERVICE_URL = process.env.CLIENTS_SERVICE_URL || 'http://localhost:3002';

// Simula processamento de pagamento usando Math.random()
function simulatePayment() {
  return Math.random() > 0.3; // 70% de chance de sucesso
}

module.exports = {
  processPayment: async (orderId, payments) => {
    // 1. Validar se o pedido existe e está no status correto
    let order;
    try {
      const orderResponse = await axios.get(`${ORDERS_SERVICE_URL}/v1/orders/${orderId}`);
      order = orderResponse.data;
      
      if (!order) {
        throw createError(404, 'Order not found');
      }
      
      console.log('Order status:', order.status, 'Type:', typeof order.status);
      if (order.status !== 'AGUARDANDO PAGAMENTO') {
        throw createError(400, `Cannot process payment for order with status: '${order.status}'`);
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        throw createError(404, 'Order not found');
      }
      if (error.status) throw error; // Re-throw our custom errors
      throw createError(500, 'Error validating order');
    }

    // Validar se o valor total dos pagamentos não excede o total do pedido
    const existingPayments = await prisma.orderPayment.findMany({
      where: { orderId: orderId }
    });
    
    const totalExistingPayments = existingPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalNewPayments = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalAllPayments = totalExistingPayments + totalNewPayments;
    
    if (totalAllPayments > order.total) {
      throw createError(400, `Total payment amount (${totalAllPayments}) exceeds order total (${order.total})`);
    }
    
    // 2. Validar pagamentos antes de processar
    for (const payment of payments) {
      if (!payment.amount || payment.amount <= 0) {
        throw createError(400, 'Payment amount must be greater than zero');
      }
      
      if (!payment.typePaymentId) {
        throw createError(400, 'Payment type is required');
      }
    }

    // 3. Processar cada pagamento
    const paymentResults = [];
    let allPaymentsSuccessful = true;
    
    for (const payment of payments) {
      // Validar se o tipo de pagamento existe
      const paymentType = await prisma.typePayment.findUnique({
        where: { id: payment.typePaymentId }
      });
      
      if (!paymentType) {
        throw createError(400, `Payment type ${payment.typePaymentId} not found`);
      }
      
      // Simular processamento do pagamento
      const success = simulatePayment();
      const status = success ? 'SUCCESS' : 'FAILED';
      
      if (!success) {
        allPaymentsSuccessful = false;
      }
      
      // Salvar registro do pagamento
      const orderPayment = await prisma.orderPayment.create({
        data: {
          orderId,
          typePaymentId: payment.typePaymentId,
          amount: payment.amount,
          status
        },
        include: {
          typePayment: true
        }
      });
      
      paymentResults.push({
        paymentType: paymentType.name,
        amount: payment.amount,
        status,
        success
      });
    }
    
    // 3. Atualizar status do pedido baseado no resultado dos pagamentos
    let newOrderStatus;
    if (allPaymentsSuccessful) {
      // Verificar se o total pago cobre o valor do pedido
      if (totalAllPayments >= order.total) {
        newOrderStatus = 'PAGO';
      } else {
        newOrderStatus = 'AGUARDANDO PAGAMENTO'; // Pagamento parcial bem-sucedido
      }
    } else {
      newOrderStatus = 'CANCELADO';
    }
    
    try {
      await axios.put(`${ORDERS_SERVICE_URL}/v1/orders/${orderId}/status`, {
        status: newOrderStatus
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw createError(500, 'Payment processed but failed to update order status');
    }
    

    // 4. Se o pagamento foi aprovado e o pedido está totalmente pago, notificar o cliente via RabbitMQ
    if (allPaymentsSuccessful && totalAllPayments >= order.total) {
      try {
        // Buscar informações do pedido novamente para pegar dados do cliente
        const orderResponse = await axios.get(`${ORDERS_SERVICE_URL}/v1/orders/${orderId}`);
        const order = orderResponse.data;

        // Buscar nome do cliente
        let clientName = '';
        try {
          const clientResponse = await axios.get(`${CLIENTS_SERVICE_URL}/v1/clients/${order.clientId}`);
          clientName = clientResponse.data?.name || '';
        } catch (err) {
          console.error('Erro ao buscar nome do cliente:', err.response?.data || err.message);
        }

        // Publicar evento no RabbitMQ
        const notificationProducer = new NotificationProducer();
        await notificationProducer.connect();
        await notificationProducer.publishNotification({
          orderId,
          clientId: order.clientId,
          clientName,
          total: order.total,
          newStatus: 'PAGO',
        });
        await notificationProducer.close();
      } catch (error) {
        console.error('Error sending notification event to RabbitMQ:', error.response?.data || error.message);
        // Não falhar o pagamento por conta da notificação
      }
    }
    
    // Determinar mensagem baseada no status
    let message;
    if (!allPaymentsSuccessful) {
      message = 'Payment failed - order has been cancelled';
    } else if (totalAllPayments >= order.total) {
      message = 'Payment processed successfully and order confirmed';
    } else {
      message = `Partial payment processed. Paid: ${totalAllPayments}, Remaining: ${order.total - totalAllPayments}`;
    }
    
    return {
      orderId,
      status: newOrderStatus,
      payments: paymentResults,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      totalPaid: totalAllPayments,
      orderTotal: order.total,
      remainingAmount: order.total - totalAllPayments,
      success: allPaymentsSuccessful && totalAllPayments >= order.total,
      message
    };
  },
  
  getOrderPayments: async (orderId) => {
    // Validar se o pedido existe
    try {
      const orderResponse = await axios.get(`${ORDERS_SERVICE_URL}/v1/orders/${orderId}`);
    } catch (error) {
      if (error.response?.status === 404) {
        throw createError(404, 'Order not found');
      }
      if (error.response?.status === 500 && error.response?.data?.erro && error.response.data.erro.includes('Cast to ObjectId failed')) {
        throw createError(404, 'Order not found');
      }
      if (error.status) throw error; // Re-throw our custom errors
      console.error('Error details:', error.response?.data);
      throw createError(500, 'Error validating order');
    }
    
    return await prisma.orderPayment.findMany({
      where: { orderId },
      include: {
        typePayment: true
      }
    });
  },
  
  listPaymentTypes: () => prisma.typePayment.findMany(),
  
  createPaymentType: async (payload) => {
    const { name } = payload;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw createError(400, 'Payment type name is required');
    }
    
    try {
      return await prisma.typePayment.create({
        data: { name: name.trim() }
      });
    } catch (error) {
      // Verifica se é erro de constraint unique
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0];
        if (field === 'name') {
          throw createError(409, 'Já existe um tipo de pagamento com esse nome');
        }
        throw createError(409, 'Dados duplicados encontrados');
      }
      // Re-lança outros erros
      throw error;
    }
  }
};