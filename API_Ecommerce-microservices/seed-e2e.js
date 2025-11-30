#!/usr/bin/env node

/**
 * SEED END-TO-END - E-commerce Microservices
 * 
 * Este script cria dados de teste em todos os serviços, garantindo
 * a consistência de IDs e um fluxo completo de pedidos e pagamentos.
 * 
 * Ordem de execução:
 * 1. Products Service - Cria produtos
 * 2. Clients Service - Cria clientes
 * 3. Payments Service - Cria tipos de pagamento
 * 4. Orders Service - Cria pedidos com os IDs dos clientes/produtos
 * 5. Payments Service - Processa pagamentos dos pedidos via Kafka
 */

const axios = require('axios');

// URLs dos serviços (Kong Gateway)
const BASE_URL = process.env.KONG_URL || 'http://localhost:8000';
const PRODUCTS_URL = `${BASE_URL}/v1/products`;
const CLIENTS_URL = `${BASE_URL}/v1/clients`;
const ORDERS_URL = `${BASE_URL}/v1/orders`;
const PAYMENTS_URL = `${BASE_URL}/v1/payments`;

// Dados em memória para garantir consistência
const createdData = {
  products: [],
  clients: [],
  paymentTypes: [],
  orders: []
};

// Utilitário para aguardar
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utilitário para log colorido
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`)
};

// 1. Criar Produtos
async function seedProducts() {
  log.info('Criando produtos...');
  
  const products = [
    { name: 'Notebook Dell Inspiron 15', price: 3500, stock: 25 },
    { name: 'Mouse Logitech MX Master 3', price: 450, stock: 50 },
    { name: 'Teclado Mecânico Keychron K2', price: 680, stock: 30 },
    { name: 'Monitor LG UltraWide 29"', price: 1800, stock: 15 },
    { name: 'Webcam Logitech C920', price: 550, stock: 40 },
    { name: 'Headset HyperX Cloud II', price: 520, stock: 35 },
    { name: 'SSD Samsung 1TB', price: 650, stock: 60 },
    { name: 'Cadeira Gamer ThunderX3', price: 1200, stock: 20 }
  ];

  for (const product of products) {
    try {
      const response = await axios.post(PRODUCTS_URL, product);
      createdData.products.push(response.data);
      log.success(`  ✓ Produto criado: ${product.name} (ID: ${response.data.id})`);
    } catch (error) {
      log.error(`  ✗ Erro ao criar produto ${product.name}: ${error.response?.data?.erro || error.message}`);
    }
  }
  
  log.success(`Total de ${createdData.products.length} produtos criados\n`);
}

// 2. Criar Clientes
async function seedClients() {
  log.info('Criando clientes...');
  
  const clients = [
    { name: 'João Silva', email: 'joao.silva@email.com' },
    { name: 'Maria Santos', email: 'maria.santos@email.com' },
    { name: 'Pedro Oliveira', email: 'pedro.oliveira@email.com' },
    { name: 'Ana Costa', email: 'ana.costa@email.com' },
    { name: 'Carlos Souza', email: 'carlos.souza@email.com' }
  ];

  for (const client of clients) {
    try {
      const response = await axios.post(CLIENTS_URL, client);
      createdData.clients.push(response.data);
      log.success(`  ✓ Cliente criado: ${client.name} (ID: ${response.data.id})`);
    } catch (error) {
      log.error(`  ✗ Erro ao criar cliente ${client.name}: ${error.response?.data?.erro || error.message}`);
    }
  }
  
  log.success(`Total de ${createdData.clients.length} clientes criados\n`);
}

// 3. Criar Tipos de Pagamento
async function seedPaymentTypes() {
  log.info('Criando tipos de pagamento...');
  
  try {
    // Buscar tipos existentes
    const existing = await axios.get(`${PAYMENTS_URL}/types`);
    createdData.paymentTypes = existing.data;
    log.success(`  ✓ ${existing.data.length} tipos de pagamento já existentes`);
    
    existing.data.forEach(type => {
      log.info(`    - ${type.name} (ID: ${type.id})`);
    });
  } catch (error) {
    log.error(`  ✗ Erro ao buscar tipos de pagamento: ${error.response?.data?.erro || error.message}`);
  }
  
  console.log('');
}

// 4. Criar Pedidos (End-to-End)
async function seedOrders() {
  log.info('Criando pedidos end-to-end...');
  
  if (createdData.clients.length === 0 || createdData.products.length === 0) {
    log.error('  ✗ Não há clientes ou produtos para criar pedidos!');
    return;
  }

  const orders = [
    {
      client: createdData.clients[0],
      items: [
        { product: createdData.products[0], quantity: 1 }, // Notebook
        { product: createdData.products[1], quantity: 2 }  // Mouse
      ]
    },
    {
      client: createdData.clients[1],
      items: [
        { product: createdData.products[2], quantity: 1 }, // Teclado
        { product: createdData.products[3], quantity: 1 }  // Monitor
      ]
    },
    {
      client: createdData.clients[2],
      items: [
        { product: createdData.products[4], quantity: 3 }  // Webcam
      ]
    },
    {
      client: createdData.clients[3],
      items: [
        { product: createdData.products[5], quantity: 1 }, // Headset
        { product: createdData.products[6], quantity: 2 }  // SSD
      ]
    },
    {
      client: createdData.clients[4],
      items: [
        { product: createdData.products[7], quantity: 1 }  // Cadeira
      ]
    }
  ];

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    
    try {
      // Calcular total do pedido
      let total = 0;
      const items = order.items.map(item => {
        const subtotal = item.product.price * item.quantity;
        total += subtotal;
        return {
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price
        };
      });

      // Selecionar tipo de pagamento aleatório
      const paymentType = createdData.paymentTypes[Math.floor(Math.random() * createdData.paymentTypes.length)];
      
      // Criar pedido COM pagamento (será enviado via Kafka)
      const orderPayload = {
        clientId: order.client.id,
        items: items,
        payments: [
          {
            typePaymentId: paymentType.id,
            amount: total
          }
        ]
      };

      const response = await axios.post(ORDERS_URL, orderPayload);
      createdData.orders.push(response.data);
      
      log.success(`  ✓ Pedido #${i + 1} criado: Cliente ${order.client.name}`);
      log.info(`    Total: R$ ${total.toFixed(2)} | Items: ${items.length} | Status: ${response.data.status}`);
      log.info(`    Pagamento enviado para Kafka: ${paymentType.name}`);
      
      // Aguardar um pouco para não sobrecarregar
      await sleep(500);
      
    } catch (error) {
      log.error(`  ✗ Erro ao criar pedido #${i + 1}: ${error.response?.data?.erro || error.message}`);
    }
  }
  
  log.success(`Total de ${createdData.orders.length} pedidos criados\n`);
}

// 5. Verificar Processamento dos Pagamentos
async function verifyPayments() {
  log.info('Aguardando processamento dos pagamentos via Kafka...');
  await sleep(5000); // Aguardar 5 segundos para Kafka processar
  
  log.info('Verificando status dos pedidos...');
  
  for (const order of createdData.orders) {
    try {
      const response = await axios.get(`${ORDERS_URL}/${order.id}`);
      const status = response.data.status;
      
      if (status === 'PAGO') {
        log.success(`  ✓ Pedido ${order.id}: ${status}`);
      } else if (status === 'FALHA NO PAGAMENTO') {
        log.warn(`  ⚠ Pedido ${order.id}: ${status}`);
      } else {
        log.info(`  ℹ Pedido ${order.id}: ${status}`);
      }
    } catch (error) {
      log.error(`  ✗ Erro ao verificar pedido ${order.id}: ${error.message}`);
    }
  }
  
  console.log('');
}

// Função principal
async function main() {
  console.log('\n==============================================');
  console.log('  E-COMMERCE SEED END-TO-END');
  console.log('  Criando dados em todos os serviços');
  console.log('==============================================\n');

  try {
    await seedProducts();
    await seedClients();
    await seedPaymentTypes();
    await seedOrders();
    await verifyPayments();
    
    console.log('==============================================');
    console.log('  RESUMO FINAL');
    console.log('==============================================');
    log.success(`✓ ${createdData.products.length} produtos criados`);
    log.success(`✓ ${createdData.clients.length} clientes criados`);
    log.success(`✓ ${createdData.paymentTypes.length} tipos de pagamento disponíveis`);
    log.success(`✓ ${createdData.orders.length} pedidos criados`);
    console.log('==============================================\n');
    
  } catch (error) {
    log.error(`Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executar
main();
