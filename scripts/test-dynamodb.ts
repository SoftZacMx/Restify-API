#!/usr/bin/env ts-node

/**
 * Script to test DynamoDB connection and operations
 * Run this to verify DynamoDB is working correctly with LocalStack
 */

import {
  DynamoDBClient,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const AWS_ENDPOINT = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const dynamoDBClient = new DynamoDBClient({
  endpoint: AWS_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

const client = DynamoDBDocumentClient.from(dynamoDBClient);

async function testDynamoDB(): Promise<void> {
  console.log('🧪 Testing DynamoDB connection...\n');
  console.log(`📍 Endpoint: ${AWS_ENDPOINT}`);
  console.log(`🌍 Region: ${AWS_REGION}\n`);

  try {
    // Test 1: List tables
    console.log('1️⃣  Listing tables...');
    const listResult = await dynamoDBClient.send(new ListTablesCommand({}));
    const tableNames = listResult.TableNames || [];
    console.log(`   ✅ Found ${tableNames.length} tables:`);
    tableNames.forEach((table: string) => console.log(`      - ${table}`));
    console.log('');

    // Test 2: Check if websocket-connections table exists
    const tableName = process.env.WEBSOCKET_CONNECTIONS_TABLE || 'websocket-connections';
    const tableExists = tableNames.includes(tableName);

    if (!tableExists) {
      console.log(`⚠️  Table "${tableName}" does not exist.`);
      console.log(`   💡 Run: npm run localstack:init`);
      console.log('');
      return;
    }

    console.log(`2️⃣  Testing operations on "${tableName}" table...\n`);

    // Test 3: Put item
    const testItem = {
      connectionId: 'test-connection-123',
      customConnectionId: 'test-custom-123',
      userId: 'test-user-123',
      paymentId: 'test-payment-123',
      domainName: 'localhost',
      stage: 'dev',
      connectedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    console.log('   📝 Putting test item...');
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: testItem,
      })
    );
    console.log('   ✅ Item saved successfully\n');

    // Test 4: Get item
    console.log('   📖 Getting test item...');
    const getResult = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { connectionId: testItem.connectionId },
      })
    );
    console.log('   ✅ Item retrieved successfully:');
    console.log(`      Connection ID: ${getResult.Item?.connectionId}`);
    console.log(`      Custom Connection ID: ${getResult.Item?.customConnectionId}`);
    console.log(`      User ID: ${getResult.Item?.userId}`);
    console.log('');

    // Test 5: Delete item
    console.log('   🗑️  Deleting test item...');
    await client.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { connectionId: testItem.connectionId },
      })
    );
    console.log('   ✅ Item deleted successfully\n');

    console.log('✨ All DynamoDB tests passed!');
  } catch (error: any) {
    console.error('\n❌ Error testing DynamoDB:');
    console.error(`   ${error.message}`);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure LocalStack is running: docker-compose up -d');
    console.error('   2. Check LocalStack health: curl http://localhost:4566/_localstack/health');
    console.error('   3. Initialize resources: npm run localstack:init');
    console.error('   4. Check AWS_ENDPOINT_URL in your .env file');
    process.exit(1);
  }
}

if (require.main === module) {
  testDynamoDB();
}

