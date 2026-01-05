#!/usr/bin/env ts-node

/**
 * Script to initialize LocalStack resources (SQS, DynamoDB, EventBridge)
 * Run this after LocalStack is up and running
 */

import {
  SQSClient,
  CreateQueueCommand,
  GetQueueUrlCommand,
} from '@aws-sdk/client-sqs';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  EventBridgeClient,
  CreateEventBusCommand,
  DescribeEventBusCommand,
} from '@aws-sdk/client-eventbridge';

const AWS_ENDPOINT = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const sqsClient = new SQSClient({
  endpoint: AWS_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const dynamoDBClient = new DynamoDBClient({
  endpoint: AWS_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const eventBridgeClient = new EventBridgeClient({
  endpoint: AWS_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

async function waitForLocalStack(): Promise<void> {
  console.log('⏳ Waiting for LocalStack to be ready...');
  
  let retries = 60; // Aumentar a 60 intentos (60 segundos)
  while (retries > 0) {
    try {
      const response = await fetch(`${AWS_ENDPOINT}/_localstack/health`);
      const health = await response.json() as { services?: { sqs?: string; dynamodb?: string } };
      
      // Verificar que SQS o DynamoDB estén disponibles
      if (health.services?.sqs === 'running' || health.services?.sqs === 'available' || 
          health.services?.dynamodb === 'running' || health.services?.dynamodb === 'available') {
        console.log('✅ LocalStack is ready!');
        return;
      }
    } catch (error) {
      // Ignore errors, keep retrying
    }
    
    retries--;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  throw new Error('LocalStack did not become available in time');
}

async function createSQSQueue(queueName: string): Promise<void> {
  try {
    // Check if queue already exists
    try {
      await sqsClient.send(
        new GetQueueUrlCommand({ QueueName: queueName })
      );
      console.log(`✅ SQS Queue "${queueName}" already exists`);
      return;
    } catch {
      // Queue doesn't exist, create it
    }

    await sqsClient.send(
      new CreateQueueCommand({
        QueueName: queueName,
      })
    );
    console.log(`✅ Created SQS Queue: ${queueName}`);
  } catch (error: any) {
    if (error.name === 'QueueAlreadyExists') {
      console.log(`✅ SQS Queue "${queueName}" already exists`);
    } else {
      console.error(`❌ Error creating SQS Queue "${queueName}":`, error.message);
    }
  }
}

async function createDynamoDBTable(
  tableName: string,
  keyName: string
): Promise<void> {
  try {
    // Check if table already exists
    try {
      await dynamoDBClient.send(
        new DescribeTableCommand({ TableName: tableName })
      );
      console.log(`✅ DynamoDB Table "${tableName}" already exists`);
      return;
    } catch {
      // Table doesn't exist, create it
    }

    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [
          {
            AttributeName: keyName,
            AttributeType: 'S',
          },
        ],
        KeySchema: [
          {
            AttributeName: keyName,
            KeyType: 'HASH',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      })
    );
    console.log(`✅ Created DynamoDB Table: ${tableName}`);
  } catch (error: any) {
    if (error.name === 'ResourceInUseException') {
      console.log(`✅ DynamoDB Table "${tableName}" already exists`);
    } else {
      console.error(`❌ Error creating DynamoDB Table "${tableName}":`, error.message);
    }
  }
}

async function createWebSocketConnectionsTable(): Promise<void> {
  try {
    // Check if table already exists
    try {
      await dynamoDBClient.send(
        new DescribeTableCommand({ TableName: 'websocket-connections' })
      );
      console.log(`✅ DynamoDB Table "websocket-connections" already exists`);
      return;
    } catch {
      // Table doesn't exist, create it
    }

    await dynamoDBClient.send(
      new CreateTableCommand({
        TableName: 'websocket-connections',
        AttributeDefinitions: [
          {
            AttributeName: 'connectionId',
            AttributeType: 'S',
          },
          {
            AttributeName: 'customConnectionId',
            AttributeType: 'S',
          },
          {
            AttributeName: 'userId',
            AttributeType: 'S',
          },
          {
            AttributeName: 'paymentId',
            AttributeType: 'S',
          },
        ],
        KeySchema: [
          {
            AttributeName: 'connectionId',
            KeyType: 'HASH',
          },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'customConnectionId-index',
            KeySchema: [
              {
                AttributeName: 'customConnectionId',
                KeyType: 'HASH',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
          {
            IndexName: 'userId-index',
            KeySchema: [
              {
                AttributeName: 'userId',
                KeyType: 'HASH',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
          {
            IndexName: 'paymentId-index',
            KeySchema: [
              {
                AttributeName: 'paymentId',
                KeyType: 'HASH',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      })
    );
    console.log(`✅ Created DynamoDB Table: websocket-connections (with GSI indexes)`);
  } catch (error: any) {
    if (error.name === 'ResourceInUseException') {
      console.log(`✅ DynamoDB Table "websocket-connections" already exists`);
    } else {
      console.error(`❌ Error creating DynamoDB Table "websocket-connections":`, error.message);
    }
  }
}

async function createEventBus(busName: string): Promise<void> {
  try {
    // Check if bus already exists
    try {
      await eventBridgeClient.send(
        new DescribeEventBusCommand({ Name: busName })
      );
      console.log(`✅ EventBridge Bus "${busName}" already exists`);
      return;
    } catch {
      // Bus doesn't exist, create it
    }

    await eventBridgeClient.send(
      new CreateEventBusCommand({
        Name: busName,
      })
    );
    console.log(`✅ Created EventBridge Bus: ${busName}`);
  } catch (error: any) {
    if (error.name === 'ResourceAlreadyExistsException') {
      console.log(`✅ EventBridge Bus "${busName}" already exists`);
    } else {
      console.error(`❌ Error creating EventBridge Bus "${busName}":`, error.message);
    }
  }
}

async function main(): Promise<void> {
  console.log('🚀 Initializing LocalStack resources...\n');

  try {
    // Wait for LocalStack
    await waitForLocalStack();

    // Create SQS Queues
    console.log('\n📬 Creating SQS Queues...');
    await createSQSQueue('payment-processing-queue');
    await createSQSQueue('payment-notifications-queue');
    await createSQSQueue('order-notifications-queue');

    // Create DynamoDB Tables
    console.log('\n💾 Creating DynamoDB Tables...');
    await createWebSocketConnectionsTable(); // Create with GSI indexes
    await createDynamoDBTable('payment-sessions', 'sessionId');

    // Create EventBridge Bus
    console.log('\n📡 Creating EventBridge Bus...');
    await createEventBus('payment-events');

    console.log('\n✨ LocalStack resources initialized successfully!');
  } catch (error: any) {
    console.error('\n❌ Error initializing LocalStack resources:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

