#!/bin/bash
set -e

KONG_ADMIN="http://kong:8001"
echo "Configuring Kong Gateway..."

# Delete all existing routes
echo "Cleaning up existing routes..."
curl -s ${KONG_ADMIN}/routes | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | while read route_id; do
  curl -s -X DELETE ${KONG_ADMIN}/routes/${route_id} || true
done

# Products Service Routes
echo "Creating Products routes..."
curl -s -X POST ${KONG_ADMIN}/services/products-service/routes -d "name=products-list" -d "paths[]=/v1/products" -d "methods[]=GET"
curl -s -X POST ${KONG_ADMIN}/services/products-service/routes -d "name=products-get" -d "paths[]=/v1/products/\d+" -d "methods[]=GET" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/products-service/routes -d "name=products-create" -d "paths[]=/v1/products" -d "methods[]=POST"
curl -s -X POST ${KONG_ADMIN}/services/products-service/routes -d "name=products-update" -d "paths[]=/v1/products/\d+" -d "methods[]=PUT" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/products-service/routes -d "name=products-delete" -d "paths[]=/v1/products/\d+" -d "methods[]=DELETE" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/products-service/routes -d "name=products-stock" -d "paths[]=/v1/products/\d+/stock" -d "methods[]=PUT" -d "strip_path=false"

# Clients Service Routes
echo "Creating Clients routes..."
curl -s -X POST ${KONG_ADMIN}/services/clients-service/routes -d "name=clients-list" -d "paths[]=/v1/clients" -d "methods[]=GET"
curl -s -X POST ${KONG_ADMIN}/services/clients-service/routes -d "name=clients-get" -d "paths[]=/v1/clients/\d+" -d "paths[]=/v1/users/\d+" -d "methods[]=GET" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/clients-service/routes -d "name=clients-create" -d "paths[]=/v1/clients" -d "methods[]=POST"
curl -s -X POST ${KONG_ADMIN}/services/clients-service/routes -d "name=clients-update" -d "paths[]=/v1/clients/\d+" -d "methods[]=PUT" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/clients-service/routes -d "name=clients-delete" -d "paths[]=/v1/clients/\d+" -d "methods[]=DELETE" -d "strip_path=false"

# Orders Service Routes
echo "Creating Orders routes..."
curl -s -X POST ${KONG_ADMIN}/services/orders-service/routes -d "name=orders-list" -d "paths[]=/v1/orders" -d "methods[]=GET" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/orders-service/routes -d "name=orders-get" -d "paths[]=/v1/orders/[a-f0-9]+" -d "methods[]=GET" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/orders-service/routes -d "name=orders-create" -d "paths[]=/v1/orders" -d "methods[]=POST" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/orders-service/routes -d "name=orders-by-client" -d "paths[]=/v1/orders/client/\d+" -d "methods[]=GET" -d "strip_path=false"

# Payments Service Routes
echo "Creating Payments routes..."
curl -s -X POST ${KONG_ADMIN}/services/payments-service/routes -d "name=payment-types-list" -d "paths[]=/v1/payments/types" -d "methods[]=GET" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/payments-service/routes -d "name=payment-types-create" -d "paths[]=/v1/payments/types" -d "methods[]=POST" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/payments-service/routes -d "name=payment-process" -d "paths[]=/v1/payments/process/\d+" -d "methods[]=POST" -d "strip_path=false"
curl -s -X POST ${KONG_ADMIN}/services/payments-service/routes -d "name=payment-orders" -d "paths[]=/v1/payments/orders/\d+" -d "methods[]=GET" -d "strip_path=false"

# Add cache plugins with correct content types
echo "Adding cache plugins..."
ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/products-list | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ ! -z "$ROUTE_ID" ] && curl -s -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins -d "name=proxy-cache" -d "config.strategy=memory" -d "config.cache_ttl=14400" -d "config.response_code[]=200" -d "config.content_type[]=text/html; charset=utf-8" -d "config.content_type[]=application/json"

ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/clients-get | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ ! -z "$ROUTE_ID" ] && curl -s -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins -d "name=proxy-cache" -d "config.strategy=memory" -d "config.cache_ttl=86400" -d "config.response_code[]=200" -d "config.content_type[]=text/html; charset=utf-8" -d "config.content_type[]=application/json"

ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/orders-get | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ ! -z "$ROUTE_ID" ] && curl -s -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins -d "name=proxy-cache" -d "config.strategy=memory" -d "config.cache_ttl=2592000" -d "config.response_code[]=200" -d "config.content_type[]=text/html; charset=utf-8" -d "config.content_type[]=application/json"

ROUTE_ID=$(curl -s ${KONG_ADMIN}/routes/payment-types-list | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ ! -z "$ROUTE_ID" ] && curl -s -X POST ${KONG_ADMIN}/routes/${ROUTE_ID}/plugins -d "name=proxy-cache" -d "config.strategy=memory" -d "config.cache_ttl=315360000" -d "config.response_code[]=200" -d "config.content_type[]=text/html; charset=utf-8" -d "config.content_type[]=application/json"

echo "Kong configuration completed!"
