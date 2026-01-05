import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { injectable } from 'tsyringe';
import {
  IWebSocketConnectionRepository,
  WebSocketConnectionRecord,
} from '../../../domain/interfaces/websocket-connection-repository.interface';

@injectable()
export class WebSocketConnectionRepository implements IWebSocketConnectionRepository {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor() {
    const endpoint = process.env.AWS_ENDPOINT_URL;
    const region = process.env.AWS_REGION || 'us-east-1';

    const dynamoDBClient = new DynamoDBClient({
      region,
      endpoint: endpoint || undefined, // Use endpoint for LocalStack, undefined for AWS
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
    });

    this.client = DynamoDBDocumentClient.from(dynamoDBClient);
    this.tableName = process.env.WEBSOCKET_CONNECTIONS_TABLE || 'websocket-connections';
  }

  async save(connection: WebSocketConnectionRecord): Promise<void> {
    try {
      // Set TTL to 24 hours from now if not provided
      const ttl = connection.ttl || Math.floor(Date.now() / 1000) + 24 * 60 * 60;

      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            ...connection,
            ttl,
          },
        })
      );
    } catch (error) {
      console.error('[WebSocketConnectionRepository] Error saving connection:', error);
      throw error;
    }
  }

  async getByConnectionId(connectionId: string): Promise<WebSocketConnectionRecord | null> {
    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { connectionId },
        })
      );

      if (!result.Item) {
        return null;
      }

      return result.Item as WebSocketConnectionRecord;
    } catch (error) {
      console.error('[WebSocketConnectionRepository] Error getting connection:', error);
      throw error;
    }
  }

  async getByCustomConnectionId(
    customConnectionId: string
  ): Promise<WebSocketConnectionRecord[]> {
    try {
      // Use GSI for efficient querying
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'customConnectionId-index',
          KeyConditionExpression: 'customConnectionId = :customConnectionId',
          ExpressionAttributeValues: {
            ':customConnectionId': customConnectionId,
          },
        })
      );

      return (result.Items || []) as WebSocketConnectionRecord[];
    } catch (error) {
      console.error('[WebSocketConnectionRepository] Error getting connections by custom ID:', error);
      // Fallback to scan if GSI doesn't exist (for backwards compatibility)
      try {
        const result = await this.client.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'customConnectionId = :customConnectionId',
            ExpressionAttributeValues: {
              ':customConnectionId': customConnectionId,
            },
          })
        );
        return (result.Items || []) as WebSocketConnectionRecord[];
      } catch (scanError) {
        throw error; // Throw original error
      }
    }
  }

  async getByUserId(userId: string): Promise<WebSocketConnectionRecord[]> {
    try {
      // Use GSI for efficient querying
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        })
      );

      return (result.Items || []) as WebSocketConnectionRecord[];
    } catch (error) {
      console.error('[WebSocketConnectionRepository] Error getting connections by user ID:', error);
      // Fallback to scan if GSI doesn't exist
      try {
        const result = await this.client.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: {
              ':userId': userId,
            },
          })
        );
        return (result.Items || []) as WebSocketConnectionRecord[];
      } catch (scanError) {
        throw error;
      }
    }
  }

  async getByPaymentId(paymentId: string): Promise<WebSocketConnectionRecord[]> {
    try {
      // Use GSI for efficient querying
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'paymentId-index',
          KeyConditionExpression: 'paymentId = :paymentId',
          ExpressionAttributeValues: {
            ':paymentId': paymentId,
          },
        })
      );

      return (result.Items || []) as WebSocketConnectionRecord[];
    } catch (error) {
      console.error('[WebSocketConnectionRepository] Error getting connections by payment ID:', error);
      // Fallback to scan if GSI doesn't exist
      try {
        const result = await this.client.send(
          new ScanCommand({
            TableName: this.tableName,
            FilterExpression: 'paymentId = :paymentId',
            ExpressionAttributeValues: {
              ':paymentId': paymentId,
            },
          })
        );
        return (result.Items || []) as WebSocketConnectionRecord[];
      } catch (scanError) {
        throw error;
      }
    }
  }

  async delete(connectionId: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { connectionId },
        })
      );
    } catch (error) {
      console.error('[WebSocketConnectionRepository] Error deleting connection:', error);
      throw error;
    }
  }

  async deleteByCustomConnectionId(customConnectionId: string): Promise<void> {
    try {
      const connections = await this.getByCustomConnectionId(customConnectionId);
      await Promise.all(connections.map((conn) => this.delete(conn.connectionId)));
    } catch (error) {
      console.error('[WebSocketConnectionRepository] Error deleting connections by custom ID:', error);
      throw error;
    }
  }
}

