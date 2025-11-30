# E-commerce Microservices Architecture

Este projeto representa a quebra do monolito de e-commerce em uma arquitetura de microsserviços, seguindo os princípios de comunicação síncrona e containerização com Docker.

## Arquitetura

### Serviços

1. **Products Service** (Porta 3001)
   - Gerenciamento de produtos e estoque
   - Endpoint específico para atualização de estoque
   - Validação e reserva de estoque para pedidos

2. **Clients Service** (Porta 3002)
   - Cadastro e gerenciamento de clientes
   - Validação de clientes para pedidos

3. **Orders Service** (Porta 3003)
   - Gerenciamento de pedidos
   - Integração com Products e Clients Service
   - Controle de status de pedidos

4. **Payments Service** (Porta 3004)
   - Processamento de pagamentos
   - Simulação de pagamento com Math.random()
   - Notificação de confirmação de pagamento

### Status de Pedidos
- `AGUARDANDO PAGAMENTO` (padrão)
- `FALHA NO PAGAMENTO`
- `PAGO`
- `CANCELADO`

## Executando a Aplicação

### Pré-requisitos
- Docker
- Docker Compose

### Inicialização
```bash
# Clone o repositório
cd API_Ecommerce-services

# Suba toda a infraestrutura
docker-compose up -d

# Verificar status dos serviços
docker-compose ps
```

### Verificar Saúde dos Serviços
```bash
# Verificar serviços individuais
curl http://localhost:3001/health  # Products
curl http://localhost:3002/health  # Clients  
curl http://localhost:3003/health  # Orders
curl http://localhost:3004/health  # Payments
```

## Endpoints da API

### Acesso Direto aos Serviços

#### Products Service (Porta 3001)
- `GET /v1/products` - Listar produtos
- `GET /v1/products/:id` - Buscar produto
- `POST /v1/products` - Criar produto
- `PUT /v1/products/:id` - Atualizar produto (sem estoque)
- `DELETE /v1/products/:id` - Deletar produto
- `PUT /v1/products/:id/stock` - **Atualizar estoque (suporta incremento/decremento)**

#### Clients Service (Porta 3002)
- `GET /v1/clients` - Listar clientes
- `GET /v1/clients/:id` - Buscar cliente
- `POST /v1/clients` - Criar cliente
- `PUT /v1/clients/:id` - Atualizar cliente
- `DELETE /v1/clients/:id` - Deletar cliente

#### Orders Service (Porta 3003)
- `GET /v1/orders` - Listar pedidos
- `GET /v1/orders/:id` - Buscar pedido
- `POST /v1/orders` - Criar pedido
- `GET /v1/orders/client/:clientId` - Pedidos por cliente

#### Payments Service (Porta 3004)
- `POST /v1/payments/process/:orderId` - **Processar pagamento (suporta múltiplos métodos)**
- `GET /v1/payments/orders/:orderId` - Buscar pagamentos do pedido
- `GET /v1/payments/types` - Listar tipos de pagamento
- `POST /v1/payments/types` - Criar tipo de pagamento

## Funcionalidades Avançadas

### 🔄 Gestão Inteligente de Estoque
O endpoint `PUT /v1/products/:id/stock` agora suporta incremento e decremento:

```bash
# Incrementar estoque (+10 unidades)
curl -X PUT http://localhost:3001/v1/products/123/stock \
  -H "Content-Type: application/json" \
  -d '{"stock": 10}'

# Decrementar estoque (-5 unidades)  
curl -X PUT http://localhost:3001/v1/products/123/stock \
  -H "Content-Type: application/json" \
  -d '{"stock": -5}'
```

**Resposta com detalhes:**
```json
{
  "id": "123",
  "name": "Produto",
  "price": 100.00,
  "stock": 15,
  "previousStock": 10,
  "stockChange": 5,
  "newStock": 15
}
```

### 💳 Pagamentos Múltiplos
O sistema suporta múltiplos métodos de pagamento em uma única transação:

```bash
curl -X POST http://localhost:3004/v1/payments/process/order-123 \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [
      {
        "typePaymentId": "cartao-credito-id",
        "amount": 500.00
      },
      {
        "typePaymentId": "pix-id", 
        "amount": 300.00
      },
      {
        "typePaymentId": "boleto-id",
        "amount": 200.00
      }
    ]
  }'
```

**Características:**
- ✅ Múltiplos métodos por transação
- ✅ Validação de valor total vs. valor do pedido
- ✅ Processamento independente de cada método
- ✅ Histórico completo de pagamentos

## Exemplos de Uso

### 1. Criar Cliente
```bash
curl -X POST http://localhost:3002/v1/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@email.com"
  }'
```

### 2. Criar Produto
```bash
curl -X POST http://localhost:3001/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Notebook",
    "price": 2500.00,
    "stock": 10
  }'
```

### 3. Criar Pedido
```bash
curl -X POST http://localhost:3003/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "uuid-do-cliente",
    "items": [{
      "productId": "uuid-do-produto",
      "productName": "Notebook",
      "quantity": 1,
      "unitPrice": 2500.00
    }]
  }'
```

### 4. Processar Pagamento
```bash
curl -X POST http://localhost:3004/v1/payments/process/uuid-do-pedido \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [{
      "typePaymentId": "uuid-do-tipo-pagamento",
      "amount": 2500.00
    }]
  }'
```

## Acesso via Kong Gateway

Todos os endpoints públicos devem ser acessados via Kong na porta 8000:

```
http://localhost:8000/v1/...
```

- **Rate Limit:** 10 req/min
- **Max Request Size:** 200KB
- **Cache:** Redis para rotas /users/:id, /products, /orders/:id, /payments/types
- **Acesso direto aos serviços é bloqueado (exceto notification-service, que é interno)**

### Exemplo de fluxo completo via Kong

#### 1. Criar Pedido
```bash
curl -X POST http://localhost:8000/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "uuid-do-cliente",
    "items": [{ "productId": "uuid-do-produto", "quantity": 1 }]
  }'
```

#### 2. Listar Tipos de Pagamento
```bash
curl http://localhost:8000/v1/payments/types
```

#### 3. Processar Pagamento (corpo correto)
```bash
curl -X POST http://localhost:8000/v1/payments/process/uuid-do-pedido \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [
      { "typePaymentId": "uuid-do-tipo-pagamento", "amount": 1200 }
    ]
  }'
```

- O campo `payments` deve ser um array de objetos `{typePaymentId, amount}`.
- O endpoint só aceita IDs válidos (ObjectId ou UUID) conforme regex da rota Kong.

#### 4. Verificar Notificação
- O notification-service consome eventos de pagamento via RabbitMQ e loga:
  - `{nomeCliente}, seu pedido foi PAGO com sucesso e será despachado em breve.`
- Verifique os logs com:
```bash
docker compose logs notification-service --tail=60
```

#### Observação sobre rotas Kong
- O regex das rotas de pagamento no Kong deve usar prefixo `~` para regex:
  - `~/v1/payments/process/[a-fA-F0-9\-]{24,36}`
  - `~/v1/payments/process/\d+`
- Se receber "no Route matched with those values", revise o regex e reinicie o Kong.

## Características Técnicas

### Comunicação Síncrona
- Requisições HTTP entre serviços
- Timeout de 10 segundos (padrão Axios)
- Tratamento de erros e fallbacks
- Health checks para monitoramento

### Banco de Dados
- PostgreSQL compartilhado entre serviços
- Schema isolado por contexto de domínio
- Migrações automáticas na inicialização

### Containerização
- Cada serviço em container Docker separado
- Multi-stage builds para otimização
- Networks isoladas para comunicação interna
- Health checks para orquestração

### Observabilidade
- Logs estruturados em cada serviço
- Health checks em todos os componentes
- Interceptors HTTP para debugging

## Configuração de Desenvolvimento

### Executar Serviço Individual
```bash
# Exemplo: Products Service
cd products-service
npm install
npm run prisma:generate
npm run dev
```

### Executar Migrações
```bash
# Dentro do container do serviço
docker exec -it products_service npx prisma migrate dev
```

### Logs dos Serviços
```bash
# Ver logs de todos os serviços
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f products-service
```

## Monitoramento

### Verificar Status
- Products Service: http://localhost:3001/health
- Clients Service: http://localhost:3002/health
- Orders Service: http://localhost:3003/health
- Payments Service: http://localhost:3004/health

### Métricas Básicas
Cada serviço expõe informações básicas de saúde incluindo uptime e status.

## Tratamento de Erros

### Cenários Implementados
1. **Cliente não encontrado** - Orders Service valida cliente antes de criar pedido
2. **Estoque insuficiente** - Products Service valida e reserva estoque
3. **Falha no pagamento** - Payments Service simula falhas e cancela pedido
4. **Timeout de comunicação** - Axios configurado com timeout de 10s
5. **Serviço indisponível** - Health checks e retry logic

### Status HTTP
- 200: Sucesso
- 201: Criado com sucesso
- 400: Erro de validação
- 404: Recurso não encontrado
- 500: Erro interno do servidor

