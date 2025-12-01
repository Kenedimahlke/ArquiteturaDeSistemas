# ========================================
# E-COMMERCE API - Testes via Kong Gateway
# ========================================
# Base URL: http://localhost:8000
# Todas as requisições passam pelo Kong
# Rate Limit: 10 requests/minuto
# Max Request Size: 200KB
# ========================================

# ========================================
# PRODUCTS SERVICE
# ========================================

# Listar todos os produtos
curl --request GET \
  --url http://localhost:8000/v1/products

# Buscar produto por ID
curl --request GET \
  --url http://localhost:8000/v1/products/1

# Criar novo produto
curl --request POST \
  --url http://localhost:8000/v1/products \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Notebook Dell",
    "price": 3500.00,
    "stock": 10
  }'

# Atualizar produto
curl --request PUT \
  --url http://localhost:8000/v1/products/1 \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Notebook Dell Updated",
    "price": 3200.00,
    "stock": 15
  }'

# Atualizar estoque do produto
curl --request PUT \
  --url http://localhost:8000/v1/products/1/stock \
  --header 'Content-Type: application/json' \
  --data '{
    "quantity": 20
  }'

# Deletar produto
curl --request DELETE \
  --url http://localhost:8000/v1/products/1

# ========================================
# CLIENTS SERVICE (USERS)
# ========================================

# Listar todos os clientes
curl --request GET \
  --url http://localhost:8000/v1/clients

# Buscar cliente por ID (CACHED - TTL: 1 dia)
curl --request GET \
  --url http://localhost:8000/v1/users/1

# Buscar cliente por ID (via /clients)
curl --request GET \
  --url http://localhost:8000/v1/clients/1

# Criar novo cliente
curl --request POST \
  --url http://localhost:8000/v1/clients \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "João Silva",
    "email": "joao.silva@email.com"
  }'

# Atualizar cliente
curl --request PUT \
  --url http://localhost:8000/v1/clients/1 \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "João Silva Updated",
    "email": "joao.silva.updated@email.com"
  }'

# Deletar cliente
curl --request DELETE \
  --url http://localhost:8000/v1/clients/1

# Validar cliente (endpoint interno usado por outros serviços)
curl --request GET \
  --url http://localhost:8000/v1/clients/1/validate

# ========================================
# ORDERS SERVICE
# ========================================

# Listar todos os pedidos
curl --request GET \
  --url http://localhost:8000/v1/orders

# Buscar pedido por ID (CACHED - TTL: 30 dias)
curl --request GET \
  --url http://localhost:8000/v1/orders/1

# Criar novo pedido
curl --request POST \
  --url http://localhost:8000/v1/orders \
  --header 'Content-Type: application/json' \
  --data '{
    "clientId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2
      },
      {
        "productId": 2,
        "quantity": 1
      }
    ]
  }'

# Buscar pedidos por cliente
curl --request GET \
  --url http://localhost:8000/v1/orders/client/1

# Atualizar status do pedido (endpoint interno)
curl --request PUT \
  --url http://localhost:8000/v1/orders/1/status \
  --header 'Content-Type: application/json' \
  --data '{
    "status": "paid"
  }'

# ========================================
# PAYMENTS SERVICE
# ========================================

# Listar tipos de pagamento (CACHED - TTL: infinito)
curl --request GET \
  --url http://localhost:8000/v1/payments/types

# Criar novo tipo de pagamento
curl --request POST \
  --url http://localhost:8000/v1/payments/types \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Cartão de Crédito",
    "description": "Pagamento via cartão de crédito"
  }'

# Processar pagamento para um pedido
curl --request POST \
  --url http://localhost:8000/v1/payments/process/1 \
  --header 'Content-Type: application/json' \
  --data '{
    "payment_method": "Cartão de Crédito"
  }'

# Buscar pagamentos de um pedido
curl --request GET \
  --url http://localhost:8000/v1/payments/orders/1

# ========================================
# TESTES DE CACHE
# ========================================

# Testar cache de produtos (4 horas)
# Execute duas vezes e verifique o header X-Cache-Status: Hit
curl --request GET \
  --url http://localhost:8000/v1/products \
  --verbose

# Testar cache de usuário (1 dia)
curl --request GET \
  --url http://localhost:8000/v1/users/1 \
  --verbose

# Testar cache de pedido (30 dias)
curl --request GET \
  --url http://localhost:8000/v1/orders/1 \
  --verbose

# Testar cache de tipos de pagamento (infinito)
curl --request GET \
  --url http://localhost:8000/v1/payments/types \
  --verbose

# ========================================
# TESTES DE RATE LIMITING
# ========================================

# Execute este comando 11 vezes rapidamente para testar o rate limit
for i in {1..11}; do
  echo "Request $i:"
  curl --request GET \
    --url http://localhost:8000/v1/products \
    --write-out "\nHTTP Status: %{http_code}\n" \
    --silent --output /dev/null
  sleep 0.5
done

# ========================================
# TESTE DE REQUEST SIZE LIMIT (200KB)
# ========================================

# Este comando deve FALHAR por exceder 200KB
# Gera um payload de aproximadamente 250KB
curl --request POST \
  --url http://localhost:8000/v1/products \
  --header 'Content-Type: application/json' \
  --data "{
    \"name\": \"$(head -c 250000 </dev/urandom | base64)\",
    \"description\": \"Test\",
    \"price\": 100,
    \"stock\": 10
  }"

# ========================================
# HEALTH CHECKS
# ========================================

# Verificar status do Kong
curl --request GET \
  --url http://localhost:8001/status

# Listar todos os serviços configurados
curl --request GET \
  --url http://localhost:8001/services

# Listar todas as rotas configuradas
curl --request GET \
  --url http://localhost:8001/routes

# Listar plugins globais
curl --request GET \
  --url http://localhost:8001/plugins

# ========================================
# SEQUÊNCIA COMPLETA DE TESTES
# ========================================

echo "==================================="
echo "TESTE COMPLETO DO E-COMMERCE"
echo "==================================="

# 1. Criar produto
echo "\n1. Criando produto..."
PRODUCT_RESPONSE=$(curl --request POST \
  --url http://localhost:8000/v1/products \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Mouse Gamer",
    "description": "Mouse RGB 16000 DPI",
    "price": 150.00,
    "stock": 50,
    "category": "Periféricos"
  }' --silent)
echo $PRODUCT_RESPONSE

# 2. Criar cliente
echo "\n2. Criando cliente..."
CLIENT_RESPONSE=$(curl --request POST \
  --url http://localhost:8000/v1/clients \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "Maria Santos",
    "email": "maria.santos@email.com",
    "cpf": "98765432100",
    "phone": "(11) 99999-8888",
    "address": "Av. Principal, 1000"
  }' --silent)
echo $CLIENT_RESPONSE

# 3. Criar pedido
echo "\n3. Criando pedido..."
ORDER_RESPONSE=$(curl --request POST \
  --url http://localhost:8000/v1/orders \
  --header 'Content-Type: application/json' \
  --data '{
    "clientId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ]
  }' --silent)
echo $ORDER_RESPONSE

# 4. Processar pagamento
echo "\n4. Processando pagamento..."
PAYMENT_RESPONSE=$(curl --request POST \
  --url http://localhost:8000/v1/payments/process/1 \
  --header 'Content-Type: application/json' \
  --data '{
    "payment_method": "PIX"
  }' --silent)
echo $PAYMENT_RESPONSE

# 5. Verificar pedido (deve estar em cache)
echo "\n5. Verificando pedido (cache)..."
curl --request GET \
  --url http://localhost:8000/v1/orders/1 \
  --verbose

echo "\n==================================="
echo "TESTE COMPLETO FINALIZADO!"
echo "==================================="
