/**
 * WebSocket connection stored in DynamoDB
 */
export interface WebSocketConnectionRecord {
  connectionId: string; // API Gateway connection ID
  customConnectionId?: string; // Custom connection ID from PaymentSession
  userId?: string;
  paymentId?: string;
  domainName?: string;
  stage?: string;
  connectedAt: string; // ISO string
  ttl?: number; // Time to live in seconds (optional, for auto-cleanup)
}

/**
 * Repository interface for WebSocket connections in DynamoDB
 */
export interface IWebSocketConnectionRepository {
  /**
   * Save a WebSocket connection
   */
  save(connection: WebSocketConnectionRecord): Promise<void>;

  /**
   * Get a connection by API Gateway connection ID
   */
  getByConnectionId(connectionId: string): Promise<WebSocketConnectionRecord | null>;

  /**
   * Get connections by custom connection ID (from PaymentSession)
   */
  getByCustomConnectionId(customConnectionId: string): Promise<WebSocketConnectionRecord[]>;

  /**
   * Get connections by user ID
   */
  getByUserId(userId: string): Promise<WebSocketConnectionRecord[]>;

  /**
   * Get connections by payment ID
   */
  getByPaymentId(paymentId: string): Promise<WebSocketConnectionRecord[]>;

  /**
   * Delete a connection by API Gateway connection ID
   */
  delete(connectionId: string): Promise<void>;

  /**
   * Delete all connections for a custom connection ID
   */
  deleteByCustomConnectionId(customConnectionId: string): Promise<void>;
}

