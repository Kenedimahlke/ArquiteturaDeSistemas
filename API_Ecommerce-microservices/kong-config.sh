#!/bin/sh

# Wait for Kong to be fully ready
echo "Waiting for Kong to be ready..."
sleep 10

KONG_ADMIN="http://kong:8001"

echo "======================================"
echo "Configuring Kong API Gateway"
echo "======================================"

# ========================================
# PRODUCTS SERVICE
# ========================================
echo "Creating Products Service..."
curl -i -X POST ${KONG_ADMIN}/services/ \
  --data "name=products-service" \
  --data "url=http://products-service:3001"

echo "Creating Products Routes..."
# GET /v1/products
curl -i -X POST ${KONG_ADMIN}/services/products-service/routes \
  --data "name=get-products" \
  --data "paths[]=/v1/products" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# GET /products/:id
curl -i -X POST ${KONG_ADMIN}/services/products-service/routes \
  --data "name=get-product-by-id" \
  --data "paths[]=/v1/products/~" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# POST /products
curl -i -X POST ${KONG_ADMIN}/services/products-service/routes \
  --data "name=create-product" \
  --data "paths[]=/v1/products" \
  --data "methods[]=POST" \
  --data "strip_path=false"

# PUT /products/:id
curl -i -X POST ${KONG_ADMIN}/services/products-service/routes \
  --data "name=update-product" \
  --data "paths[]=/v1/products/~" \
  --data "methods[]=PUT" \
  --data "strip_path=false"

# DELETE /products/:id
curl -i -X POST ${KONG_ADMIN}/services/products-service/routes \
  --data "name=delete-product" \
  --data "paths[]=/v1/products/~" \
  --data "methods[]=DELETE" \
  --data "strip_path=false"

# PUT /products/:id/stock
curl -i -X POST ${KONG_ADMIN}/services/products-service/routes \
  --data "name=update-product-stock" \
  --data "paths[]=/v1/products/~/stock" \
  --data "methods[]=PUT" \
  --data "strip_path=false"

# ========================================
# CLIENTS SERVICE
# ========================================
echo "Creating Clients Service..."
curl -i -X POST ${KONG_ADMIN}/services/ \
  --data "name=clients-service" \
  --data "url=http://clients-service:3002"

echo "Creating Clients Routes..."
# GET /clients
curl -i -X POST ${KONG_ADMIN}/services/clients-service/routes \
  --data "name=get-clients" \
  --data "paths[]=/v1/clients" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# GET /clients/:id (users/:id for cache)
curl -i -X POST ${KONG_ADMIN}/services/clients-service/routes \
  --data "name=get-client-by-id" \
  --data "paths[]=/v1/clients/~" \
  --data "paths[]=/v1/users/~" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# POST /clients
curl -i -X POST ${KONG_ADMIN}/services/clients-service/routes \
  --data "name=create-client" \
  --data "paths[]=/v1/clients" \
  --data "methods[]=POST" \
  --data "strip_path=false"

# PUT /clients/:id
curl -i -X POST ${KONG_ADMIN}/services/clients-service/routes \
  --data "name=update-client" \
  --data "paths[]=/v1/clients/~" \
  --data "methods[]=PUT" \
  --data "strip_path=false"

# DELETE /clients/:id
curl -i -X POST ${KONG_ADMIN}/services/clients-service/routes \
  --data "name=delete-client" \
  --data "paths[]=/v1/clients/~" \
  --data "methods[]=DELETE" \
  --data "strip_path=false"

# ========================================
# ORDERS SERVICE
# ========================================
echo "Creating Orders Service..."
curl -i -X POST ${KONG_ADMIN}/services/ \
  --data "name=orders-service" \
  --data "url=http://orders-service:3003"

echo "Creating Orders Routes..."
# GET /orders
curl -i -X POST ${KONG_ADMIN}/services/orders-service/routes \
  --data "name=get-orders" \
  --data "paths[]=/v1/orders" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# GET /orders/:id
curl -i -X POST ${KONG_ADMIN}/services/orders-service/routes \
  --data "name=get-order-by-id" \
  --data "paths[]=/v1/orders/~" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# POST /orders
curl -i -X POST ${KONG_ADMIN}/services/orders-service/routes \
  --data "name=create-order" \
  --data "paths[]=/v1/orders" \
  --data "methods[]=POST" \
  --data "strip_path=false"

# GET /orders/client/:clientId
curl -i -X POST ${KONG_ADMIN}/services/orders-service/routes \
  --data "name=get-orders-by-client" \
  --data "paths[]=/v1/orders/client/~" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# ========================================
# PAYMENTS SERVICE
# ========================================
echo "Creating Payments Service..."
curl -i -X POST ${KONG_ADMIN}/services/ \
  --data "name=payments-service" \
  --data "url=http://payments-service:3004"

echo "Creating Payments Routes..."
# GET /payments/types
curl -i -X POST ${KONG_ADMIN}/services/payments-service/routes \
  --data "name=get-payment-types" \
  --data "paths[]=/v1/payments/types" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# POST /payments/types
curl -i -X POST ${KONG_ADMIN}/services/payments-service/routes \
  --data "name=create-payment-type" \
  --data "paths[]=/v1/payments/types" \
  --data "methods[]=POST" \
  --data "strip_path=false"

# POST /payments/process/:orderId
curl -i -X POST ${KONG_ADMIN}/services/payments-service/routes \
  --data "name=process-payment" \
  --data "paths[]=/v1/payments/process/~" \
  --data "methods[]=POST" \
  --data "strip_path=false"

# GET /payments/orders/:orderId
curl -i -X POST ${KONG_ADMIN}/services/payments-service/routes \
  --data "name=get-order-payments" \
  --data "paths[]=/v1/payments/orders/~" \
  --data "methods[]=GET" \
  --data "strip_path=false"

# ========================================
# GLOBAL PLUGINS
# ========================================
echo "Configuring Global Plugins..."

# Rate Limiting - 10 requests per minute
echo "Setting up Rate Limiting (10 req/min)..."
curl -i -X POST ${KONG_ADMIN}/plugins/ \
  --data "name=rate-limiting" \
  --data "config.minute=10" \
  --data "config.policy=local"

# Request Size Limiting - 200KB
echo "Setting up Request Size Limiting (200KB)..."
curl -i -X POST ${KONG_ADMIN}/plugins/ \
  --data "name=request-size-limiting" \
  --data "config.allowed_payload_size=200"

# Response Transformer for consistent API responses
echo "Setting up Response Transformer..."
curl -i -X POST ${KONG_ADMIN}/plugins/ \
  --data "name=correlation-id" \
  --data "config.header_name=X-Request-ID" \
  --data "config.generator=uuid"

# CORS
echo "Setting up CORS..."
curl -i -X POST ${KONG_ADMIN}/plugins/ \
  --data "name=cors" \
  --data "config.origins=*" \
  --data "config.methods=GET,POST,PUT,DELETE,OPTIONS" \
  --data "config.headers=Accept,Authorization,Content-Type,X-Request-ID" \
  --data "config.exposed_headers=X-Request-ID" \
  --data "config.credentials=true" \
  --data "config.max_age=3600"

# ========================================
# PROXY CACHE FOR SPECIFIC ROUTES
# ========================================
echo "Configuring Proxy Cache..."

# Cache for GET /products - 4 hours (14400 seconds)
echo "Setting cache for /products (4 hours)..."
ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/get-products | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -i -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins \
  --data "name=proxy-cache" \
  --data "config.strategy=memory" \
  --data "config.content_type[]=application/json" \
  --data "config.cache_ttl=14400" \
  --data "config.response_code[]=200" \
  --data "config.memory.dictionary_name=kong_cache"

# Cache for GET /users/:id - 1 day (86400 seconds)
echo "Setting cache for /users/:id (1 day)..."
ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/get-client-by-id | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -i -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins \
  --data "name=proxy-cache" \
  --data "config.strategy=memory" \
  --data "config.content_type[]=application/json" \
  --data "config.cache_ttl=86400" \
  --data "config.response_code[]=200" \
  --data "config.memory.dictionary_name=kong_cache"

# Cache for GET /orders/:id - 30 days (2592000 seconds)
echo "Setting cache for /orders/:id (30 days)..."
ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/get-order-by-id | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -i -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins \
  --data "name=proxy-cache" \
  --data "config.strategy=memory" \
  --data "config.content_type[]=application/json" \
  --data "config.cache_ttl=2592000" \
  --data "config.response_code[]=200" \
  --data "config.memory.dictionary_name=kong_cache"

# Cache for GET /payments/types - infinite (10 years = 315360000 seconds)
echo "Setting cache for /payments/types (infinite)..."
ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/get-payment-types | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
curl -i -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins \
  --data "name=proxy-cache" \
  --data "config.strategy=memory" \
  --data "config.content_type[]=application/json" \
  --data "config.cache_ttl=315360000" \
  --data "config.response_code[]=200" \
  --data "config.memory.dictionary_name=kong_cache"

echo "======================================"
echo "Kong Configuration Completed!"
echo "======================================"
echo "API Gateway available at: http://localhost:8000"
echo "Kong Admin API: http://localhost:8001"
echo "Kong Admin GUI: http://localhost:8002"
echo "======================================"
