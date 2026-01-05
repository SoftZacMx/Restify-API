import { Request, Response } from 'express';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * Converts Express Request to APIGatewayProxyEvent for Lambda handlers
 */
export class HttpToLambdaAdapter {
  static convertRequest(req: Request, pathParameters?: Record<string, string>): APIGatewayProxyEvent {
    return {
      httpMethod: req.method,
      path: req.path,
      pathParameters: pathParameters || this.extractPathParameters(req),
      queryStringParameters: this.convertQueryParams(req.query),
      headers: this.convertHeaders(req.headers),
      multiValueHeaders: {},
      body: req.body ? JSON.stringify(req.body) : null,
      isBase64Encoded: false,
      requestContext: {
        accountId: 'local',
        apiId: 'local',
        protocol: req.protocol,
        httpMethod: req.method,
        path: req.path,
        stage: 'local',
        requestId: `local-${Date.now()}`,
        requestTime: new Date().toISOString(),
        requestTimeEpoch: Date.now(),
        resourceId: 'local',
        resourcePath: req.path,
        authorizer: {},
        identity: {
          accessKey: null,
          accountId: null,
          apiKey: null,
          apiKeyId: null,
          caller: null,
          clientCert: null,
          cognitoAuthenticationProvider: null,
          cognitoAuthenticationType: null,
          cognitoIdentityId: null,
          cognitoIdentityPoolId: null,
          principalOrgId: null,
          sourceIp: req.ip || '127.0.0.1',
          user: null,
          userAgent: req.get('user-agent') || '',
          userArn: null,
        },
      },
      resource: req.path,
      multiValueQueryStringParameters: null,
      stageVariables: null,
    };
  }

  static convertResponse(lambdaResponse: any, res: Response): void {
    if (!lambdaResponse) {
      res.status(500).json({ error: 'No response from handler' });
      return;
    }

    // Set status code
    res.status(lambdaResponse.statusCode || 200);

    // Set headers
    if (lambdaResponse.headers) {
      Object.keys(lambdaResponse.headers).forEach((key) => {
        res.setHeader(key, lambdaResponse.headers[key]);
      });
    }

    // Set body
    if (lambdaResponse.body) {
      try {
        const body = JSON.parse(lambdaResponse.body);
        res.json(body);
      } catch {
        res.send(lambdaResponse.body);
      }
    } else {
      res.end();
    }
  }

  static createContext(): Context {
    return {
      callbackWaitsForEmptyEventLoop: false,
      functionName: 'local-function',
      functionVersion: '$LATEST',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:local-function',
      memoryLimitInMB: '128',
      awsRequestId: `local-${Date.now()}`,
      logGroupName: '/aws/lambda/local-function',
      logStreamName: `local/${new Date().toISOString()}`,
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
    };
  }

  private static extractPathParameters(req: Request): Record<string, string> | null {
    // Extract path parameters from Express route params
    return req.params && Object.keys(req.params).length > 0 ? req.params : null;
  }

  private static convertQueryParams(
    query: any
  ): Record<string, string> | null {
    if (!query || Object.keys(query).length === 0) {
      return null;
    }

    const params: Record<string, string> = {};
    Object.keys(query).forEach((key) => {
      const value = query[key];
      params[key] = Array.isArray(value) ? value[0] : String(value);
    });

    return params;
  }

  private static convertHeaders(headers: any): Record<string, string> {
    const converted: Record<string, string> = {};

    Object.keys(headers).forEach((key) => {
      const value = headers[key];
      converted[key] = Array.isArray(value) ? value[0] : String(value);
    });

    return converted;
  }
}

