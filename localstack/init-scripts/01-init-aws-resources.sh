#!/bin/bash

# Script de inicialización de recursos AWS en LocalStack
# Este script se ejecuta automáticamente cuando LocalStack está listo

set -e

echo "🔧 Configurando recursos AWS en LocalStack..."

# Esperar a que LocalStack esté completamente listo
until curl -s http://localhost:4566/_localstack/health | grep -q "\"sqs\": \"available\""; do
    echo "⏳ Esperando a que LocalStack esté listo..."
    sleep 2
done

# Configurar variables de entorno para AWS CLI
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
export AWS_ENDPOINT_URL=http://localhost:4566

# Verificar si aws CLI está disponible, si no, usar curl
if command -v aws &> /dev/null; then
    echo "📬 Creando colas SQS..."
    aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
        --queue-name payment-processing-queue \
        --region $AWS_DEFAULT_REGION 2>/dev/null || echo "Cola payment-processing-queue ya existe"
    
    aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
        --queue-name payment-notifications-queue \
        --region $AWS_DEFAULT_REGION 2>/dev/null || echo "Cola payment-notifications-queue ya existe"
    
    aws --endpoint-url=$AWS_ENDPOINT_URL sqs create-queue \
        --queue-name order-notifications-queue \
        --region $AWS_DEFAULT_REGION 2>/dev/null || echo "Cola order-notifications-queue ya existe"
    
    echo "💾 Creando tablas DynamoDB..."
    # Create websocket-connections table with GSI indexes using JSON file
    GSI_JSON=$(cat <<EOF
[
  {
    "IndexName": "customConnectionId-index",
    "KeySchema": [
      {
        "AttributeName": "customConnectionId",
        "KeyType": "HASH"
      }
    ],
    "Projection": {
      "ProjectionType": "ALL"
    }
  },
  {
    "IndexName": "userId-index",
    "KeySchema": [
      {
        "AttributeName": "userId",
        "KeyType": "HASH"
      }
    ],
    "Projection": {
      "ProjectionType": "ALL"
    }
  },
  {
    "IndexName": "paymentId-index",
    "KeySchema": [
      {
        "AttributeName": "paymentId",
        "KeyType": "HASH"
      }
    ],
    "Projection": {
      "ProjectionType": "ALL"
    }
  }
]
EOF
)
    echo "$GSI_JSON" > /tmp/websocket-gsi.json
    
    aws --endpoint-url=$AWS_ENDPOINT_URL dynamodb create-table \
        --table-name websocket-connections \
        --attribute-definitions \
            AttributeName=connectionId,AttributeType=S \
            AttributeName=customConnectionId,AttributeType=S \
            AttributeName=userId,AttributeType=S \
            AttributeName=paymentId,AttributeType=S \
        --key-schema AttributeName=connectionId,KeyType=HASH \
        --global-secondary-indexes file:///tmp/websocket-gsi.json \
        --billing-mode PAY_PER_REQUEST \
        --region $AWS_DEFAULT_REGION 2>/dev/null || echo "Tabla websocket-connections ya existe"
    
    rm -f /tmp/websocket-gsi.json
    
    aws --endpoint-url=$AWS_ENDPOINT_URL dynamodb create-table \
        --table-name payment-sessions \
        --attribute-definitions AttributeName=sessionId,AttributeType=S \
        --key-schema AttributeName=sessionId,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region $AWS_DEFAULT_REGION 2>/dev/null || echo "Tabla payment-sessions ya existe"
    
    echo "📡 Creando EventBridge Bus..."
    aws --endpoint-url=$AWS_ENDPOINT_URL events create-event-bus \
        --name payment-events \
        --region $AWS_DEFAULT_REGION 2>/dev/null || echo "EventBus payment-events ya existe"
else
    echo "⚠️  AWS CLI no está disponible. Los recursos se crearán bajo demanda cuando la aplicación los necesite."
    echo "💡 Para crear recursos manualmente, instala AWS CLI y ejecuta los comandos desde tu máquina local."
    echo "💡 O ejecuta: npm run localstack:init"
fi

echo "✅ Inicialización completada!"

