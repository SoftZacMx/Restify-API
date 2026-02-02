#!/bin/bash
# LocalStack CLI Helper
# Uso: ./scripts/localstack-cli.sh [comando]

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
ENDPOINT="http://localhost:4566"

case "$1" in
  "queues"|"sqs")
    echo "📬 SQS Queues:"
    aws --endpoint-url=$ENDPOINT sqs list-queues --output table
    ;;
  
  "queue-status")
    echo "📊 Queue Status:"
    echo ""
    for queue in payment-processing-queue payment-notifications-queue order-notifications-queue; do
      count=$(aws --endpoint-url=$ENDPOINT sqs get-queue-attributes \
        --queue-url $ENDPOINT/000000000000/$queue \
        --attribute-names ApproximateNumberOfMessages \
        --query 'Attributes.ApproximateNumberOfMessages' --output text 2>/dev/null)
      echo "  $queue: $count messages"
    done
    ;;

  "tables"|"dynamodb")
    echo "📦 DynamoDB Tables:"
    aws --endpoint-url=$ENDPOINT dynamodb list-tables --output table
    ;;

  "peek")
    queue=${2:-payment-notifications-queue}
    echo "👀 Peeking at queue: $queue"
    aws --endpoint-url=$ENDPOINT sqs receive-message \
      --queue-url $ENDPOINT/000000000000/$queue \
      --max-number-of-messages 5 \
      --visibility-timeout 0
    ;;

  "health")
    echo "🏥 LocalStack Health:"
    curl -s $ENDPOINT/_localstack/health | python3 -m json.tool
    ;;

  *)
    echo "LocalStack CLI Helper"
    echo ""
    echo "Uso: ./scripts/localstack-cli.sh [comando]"
    echo ""
    echo "Comandos disponibles:"
    echo "  queues, sqs      - Listar colas SQS"
    echo "  queue-status     - Ver cantidad de mensajes en cada cola"
    echo "  tables, dynamodb - Listar tablas DynamoDB"
    echo "  peek [queue]     - Ver mensajes en una cola (sin eliminarlos)"
    echo "  health           - Ver estado de LocalStack"
    echo ""
    echo "Ejemplos:"
    echo "  ./scripts/localstack-cli.sh queues"
    echo "  ./scripts/localstack-cli.sh queue-status"
    echo "  ./scripts/localstack-cli.sh peek order-notifications-queue"
    ;;
esac
