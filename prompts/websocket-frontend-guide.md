# Guía Frontend - WebSocket para Notificaciones en Tiempo Real

Este documento describe cómo el frontend debe conectarse y consumir las notificaciones en tiempo real via WebSocket usando Socket.IO.

## Índice

1. [Resumen](#resumen)
2. [Preguntas frecuentes: URL, path, auth y register_connection](#preguntas-frecuentes-url-path-auth-y-register_connection)
3. [Configuración Inicial](#configuración-inicial)
4. [Conexión al WebSocket](#conexión-al-websocket)
5. [Registro de Conexión](#registro-de-conexión)
6. [Eventos Disponibles](#eventos-disponibles)
7. [Notificaciones de Órdenes](#notificaciones-de-órdenes)
8. [Notificaciones de Pagos](#notificaciones-de-pagos)
9. [Manejo de Errores](#manejo-de-errores)
10. [Reconexión Automática](#reconexión-automática)
11. [Ejemplos Completos](#ejemplos-completos)
12. [Debugging](#debugging)

---

## Resumen

El sistema usa **Socket.IO** para enviar notificaciones en tiempo real al frontend. Esto permite:

- Recibir alertas de **nuevas órdenes** en cocina/caja
- Notificar cuando una **orden fue actualizada**
- Informar cuando una **orden fue entregada**
- Confirmar **pagos exitosos o fallidos** (Stripe)

**URL WebSocket:** `ws://localhost:3000` (o la URL de tu API, sin path)
**Path:** `/socket.io`

---

## Preguntas frecuentes: URL, path, auth y register_connection

Respuestas exactas según el backend (para conectar desde el front con Socket.IO):

### ¿Cuál es la URL y el path?

- **URL:** La misma base que tu API, por ejemplo `http://localhost:3000` (Socket.IO usa esa URL; el upgrade a WebSocket lo hace el cliente).
- **Path:** **Sí, es `/socket.io`.** El servidor está configurado con `path: '/socket.io'`. En el cliente debes usar la misma: `io(URL, { path: '/socket.io' })`.

### ¿La autenticación es solo por cookie de sesión o necesitan token en auth?

- **No se usa cookie de sesión** para el WebSocket. La autenticación es por **token JWT**.
- **Si envías `userId`** en el registro (staff), el backend **exige token**. Sin token recibirás: `"Authentication token is required when userId is provided"`.
- El token se puede enviar por **cualquiera** de estas vías (el backend las revisa en este orden):
  1. En el **payload** de `register_connection`: `{ connectionId, userId, token: 'JWT...' }`
  2. En el **handshake**: `auth: { token: 'JWT...' }` (y opcionalmente `userId` en auth)
  3. En el **header** HTTP del handshake: `Authorization: Bearer JWT...`

Recomendación: usar `transports: ['websocket']`, `withCredentials: true` y en el handshake `auth: { userId, token }`. Tras conectar, emitir `register_connection` con al menos `connectionId` (y `userId` + `token` si es staff).

### ¿Qué evento y payload exactos esperan en register_connection?

- **Evento:** `register_connection` (string exacto).
- **Payload esperado:**

| Campo          | Tipo    | Requerido | Descripción |
|----------------|---------|-----------|-------------|
| `connectionId` | string  | **Sí**    | Identificador único de esta conexión (ej. `conn_${Date.now()}_${random}`). |
| `userId`       | string  | No        | UUID del usuario (staff). Si se envía, **token es obligatorio**. |
| `token`        | string  | No*       | JWT. *Obligatorio si envías `userId`.* Puede ir también en handshake o header. |
| `paymentId`    | string  | No        | UUID del pago (para notificaciones de pago Stripe por conexión). |

Ejemplo staff:

```typescript
socket.emit('register_connection', {
  connectionId: connectionId,
  userId: userId,
  token: token
});
```

Ejemplo solo conexión (sin userId): `connectionId` es suficiente; no hace falta token.

### ¿Qué evento devuelven para confirmar (p. ej. connection_ack)?

- **Evento de confirmación:** `connection_ack` (string exacto; valor del enum en backend: `WebSocketEventType.CONNECTION_ACK`).
- **Payload que envía el servidor:**

```typescript
{
  type: 'connection_ack',
  data: {
    connectionId: string,   // El mismo que enviaste
    message: 'Connection registered successfully'
  },
  timestamp: Date,
  connectionId: string
}
```

En el front debes escuchar:

```typescript
socket.on('connection_ack', (message) => {
  console.log('Conectado y registrado:', message.data.connectionId);
  // message.data.connectionId, message.data.message
});
```

Si hay error (token inválido, userId sin token, etc.), el servidor emite el evento **`error`** con `data: { message: '...' }`. Escucha también `socket.on('error', ...)` para mostrar mensaje o reconectar con token nuevo.

### ¿Por qué aparece "Staff not connected" en el backend y no llegan notificaciones de órdenes?

El worker que consume la cola SQS **sí recibe** los mensajes. Si en los logs del servidor ves **"Staff not connected, will retry: &lt;orderId&gt;"**, significa que **no hay ninguna conexión WebSocket registrada como staff** (con `userId` y rol ADMIN/MANAGER/WAITER/CHEF).

**Causa:** El front conecta (`connect`) pero **no** completa un `register_connection` exitoso con **`userId`** y **`token`**. Sin eso, el backend no guarda la conexión como staff y las notificaciones de órdenes no se envían a nadie.

**Qué hacer en el front:**

1. Tras `socket.on('connect')`, emitir **`register_connection`** con **`connectionId`**, **`userId`** (del usuario logueado) y **`token`** (JWT).
2. Escuchar **`connection_ack`** para confirmar que el registro fue correcto.
3. Escuchar **`error`** para detectar fallos (token inválido, userId incorrecto, etc.) y mostrar mensaje o re-login.

Si al menos una conexión se registra como staff, las notificaciones se entregarán y dejarás de ver "Staff not connected" para esos mensajes.

---

## Configuración Inicial

### Instalar Socket.IO Client

```bash
# npm
npm install socket.io-client

# yarn
yarn add socket.io-client

# pnpm
pnpm add socket.io-client
```

### Tipos TypeScript

```typescript
// types/websocket.ts

// Tipos de eventos
export enum WebSocketEventType {
  // Conexión
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECTION_ACK = 'connection_ack',

  // Pagos
  PAYMENT_CONFIRMED = 'payment_confirmed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_PENDING = 'payment_pending',

  // Órdenes
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_DELIVERED = 'order_delivered',
  ORDER_CANCELED = 'order_canceled',

  // Errores
  ERROR = 'error',
}

// Estructura de mensaje
export interface WebSocketMessage<T = any> {
  type: WebSocketEventType;
  data: T;
  timestamp: string;
  connectionId?: string;
}

// Datos de orden en notificación
export interface OrderNotificationData {
  orderId: string;
  status: 'created' | 'updated' | 'delivered' | 'canceled';
  message: string;
  order: {
    id: string;
    date: string;
    status: boolean;
    total: number;
    subtotal: number;
    delivered: boolean;
    tableId: string | null;
    origin: string;
    client: string | null;
  };
}

// Datos de pago en notificación
export interface PaymentNotificationData {
  paymentId: string;
  status: 'confirmed' | 'failed' | 'pending';
  message: string;
  payment?: {
    id: string;
    orderId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
  };
}

// Datos de error
export interface ErrorData {
  message: string;
  error?: string;
}

// Datos de ACK de conexión
export interface ConnectionAckData {
  connectionId: string;
  message: string;
}
```

---

## Conexión al WebSocket

### Conexión Básica

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000', {
  path: '/socket.io',
  transports: ['websocket'],  // Usar solo WebSocket (más eficiente)
  autoConnect: false,         // Conectar manualmente
  auth: {
    token: 'jwt-token-aqui'   // Token JWT para autenticación
  }
});

// Conectar
socket.connect();

// Escuchar conexión exitosa
socket.on('connect', () => {
  console.log('Conectado al WebSocket');
  console.log('Socket ID:', socket.id);
});

// Escuchar desconexión
socket.on('disconnect', (reason) => {
  console.log('Desconectado:', reason);
});
```

### Conexión con Autenticación

```typescript
import { io, Socket } from 'socket.io-client';

function createWebSocketConnection(token: string): Socket {
  const socket = io('http://localhost:3000', {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    auth: {
      token: token  // JWT token del usuario logueado
    },
    // Opciones de reconexión
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

// Uso
const token = localStorage.getItem('token');
const socket = createWebSocketConnection(token);
socket.connect();
```

---

## Registro de Conexión

**IMPORTANTE:** Después de conectar, debes **registrar** la conexión para recibir notificaciones.

### Para Staff (Meseros, Cocineros, Admins, Managers)

```typescript
// Después de que el socket conecte
socket.on('connect', () => {
  // Generar un ID único para esta conexión
  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Registrar conexión como staff
  socket.emit('register_connection', {
    connectionId: connectionId,
    userId: 'uuid-del-usuario-logueado',  // REQUERIDO para staff
    token: 'jwt-token'                     // REQUERIDO para staff
  });
});

// Escuchar confirmación de registro
socket.on('connection_ack', (message: WebSocketMessage<ConnectionAckData>) => {
  console.log('Conexión registrada:', message.data.connectionId);
  // Guardar connectionId si es necesario
});

// Escuchar errores de registro
socket.on('error', (message: WebSocketMessage<ErrorData>) => {
  console.error('Error de WebSocket:', message.data.message);
});
```

### Para Clientes (Pagos con Stripe)

```typescript
// Registrar conexión para recibir notificaciones de pago
socket.emit('register_connection', {
  connectionId: 'conn_' + Date.now(),
  paymentId: 'uuid-del-pago'  // ID del pago pendiente
});
```

---

## Eventos Disponibles

### Eventos del Sistema

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `connect` | Server → Client | Conexión establecida |
| `disconnect` | Server → Client | Conexión cerrada |
| `connection_ack` | Server → Client | Registro de conexión confirmado |
| `error` | Server → Client | Error en el WebSocket |
| `ping` | Client → Server | Keep-alive |
| `pong` | Server → Client | Respuesta a ping |

### Eventos de Órdenes

| Evento | Descripción | Destinatarios |
|--------|-------------|---------------|
| `order_created` | Nueva orden creada | ADMIN, MANAGER, WAITER, CHEF |
| `order_updated` | Orden actualizada | ADMIN, MANAGER, WAITER, CHEF |
| `order_delivered` | Orden entregada | ADMIN, MANAGER, WAITER, CHEF |
| `order_canceled` | Orden cancelada | ADMIN, MANAGER, WAITER, CHEF |

### Eventos de Pagos

| Evento | Descripción | Destinatarios |
|--------|-------------|---------------|
| `payment_confirmed` | Pago exitoso (Stripe) | Cliente específico |
| `payment_failed` | Pago fallido | Cliente específico |
| `payment_pending` | Pago pendiente | Cliente específico |

---

## Notificaciones de Órdenes

### Escuchar Todas las Notificaciones de Órdenes

```typescript
// Nueva orden creada
socket.on('order_created', (message: WebSocketMessage<OrderNotificationData>) => {
  console.log('Nueva orden:', message.data);
  
  const { orderId, order } = message.data;
  
  // Mostrar notificación
  showNotification({
    title: 'Nueva Orden',
    body: `Orden para ${order.client || 'Cliente'} - Mesa ${order.tableId || 'N/A'}`,
    data: { orderId }
  });
  
  // Reproducir sonido
  playNotificationSound();
  
  // Actualizar lista de órdenes
  addOrderToList(order);
});

// Orden actualizada
socket.on('order_updated', (message: WebSocketMessage<OrderNotificationData>) => {
  console.log('Orden actualizada:', message.data);
  
  const { orderId, order } = message.data;
  
  // Actualizar orden en la lista
  updateOrderInList(orderId, order);
});

// Orden entregada
socket.on('order_delivered', (message: WebSocketMessage<OrderNotificationData>) => {
  console.log('Orden entregada:', message.data);
  
  const { orderId, order } = message.data;
  
  // Mover orden a completadas
  markOrderAsDelivered(orderId);
  
  showNotification({
    title: 'Orden Entregada',
    body: `Orden ${orderId.slice(-8)} fue entregada`,
  });
});

// Orden cancelada
socket.on('order_canceled', (message: WebSocketMessage<OrderNotificationData>) => {
  console.log('Orden cancelada:', message.data);
  
  const { orderId } = message.data;
  
  // Remover orden de la lista
  removeOrderFromList(orderId);
  
  showNotification({
    title: 'Orden Cancelada',
    body: `Orden ${orderId.slice(-8)} fue cancelada`,
    type: 'warning'
  });
});
```

### Estructura de Datos de Orden

```typescript
interface OrderNotificationData {
  orderId: string;
  status: 'created' | 'updated' | 'delivered' | 'canceled';
  message: string;
  order: {
    id: string;              // UUID de la orden
    date: string;            // ISO 8601
    status: boolean;         // true = pagada
    total: number;           // Total con IVA
    subtotal: number;        // Subtotal sin IVA
    delivered: boolean;      // true = entregada
    tableId: string | null;  // UUID de mesa
    origin: string;          // 'Local', 'Delivery', etc.
    client: string | null;   // Nombre del cliente
  };
}
```

---

## Notificaciones de Pagos

### Escuchar Notificaciones de Pago (Stripe)

```typescript
// Pago confirmado exitosamente
socket.on('payment_confirmed', (message: WebSocketMessage<PaymentNotificationData>) => {
  console.log('Pago confirmado:', message.data);
  
  const { paymentId, payment } = message.data;
  
  // Mostrar éxito al usuario
  showSuccessMessage('¡Pago realizado con éxito!');
  
  // Redirigir a confirmación
  navigateTo(`/order-confirmation/${payment.orderId}`);
});

// Pago fallido
socket.on('payment_failed', (message: WebSocketMessage<PaymentNotificationData>) => {
  console.log('Pago fallido:', message.data);
  
  const { message: errorMessage } = message.data;
  
  // Mostrar error al usuario
  showErrorMessage(errorMessage || 'El pago no pudo ser procesado');
  
  // Habilitar botón de reintentar
  enableRetryButton();
});

// Pago pendiente (requiere acción - 3D Secure)
socket.on('payment_pending', (message: WebSocketMessage<PaymentNotificationData>) => {
  console.log('Pago pendiente:', message.data);
  
  // Mostrar indicador de carga
  showLoadingIndicator('Procesando pago...');
});
```

---

## Manejo de Errores

### Errores de Conexión

```typescript
// Error de conexión
socket.on('connect_error', (error) => {
  console.error('Error de conexión:', error.message);
  
  if (error.message === 'Authentication error') {
    // Token inválido o expirado
    handleAuthError();
  }
});

// Error del servidor
socket.on('error', (message: WebSocketMessage<ErrorData>) => {
  console.error('Error del WebSocket:', message.data);
  
  const { message: errorMessage } = message.data;
  
  switch (errorMessage) {
    case 'connectionId is required':
      // No se envió connectionId en register_connection
      break;
    case 'Authentication token is required when userId is provided':
      // Falta token para staff
      handleAuthError();
      break;
    case 'Invalid or expired authentication token':
      // Token expirado
      refreshTokenAndReconnect();
      break;
    case 'User not found':
      // Usuario no existe
      handleUserNotFound();
      break;
    case 'User account is inactive':
      // Usuario desactivado
      handleInactiveUser();
      break;
    default:
      showErrorNotification(errorMessage);
  }
});
```

### Lista de Errores Posibles

| Error | Causa | Solución |
|-------|-------|----------|
| `connectionId is required` | No se envió connectionId | Incluir connectionId en register_connection |
| `Authentication token is required` | Staff sin token | Incluir token JWT |
| `Invalid or expired authentication token` | Token inválido | Hacer login de nuevo |
| `UserId mismatch` | userId no coincide con token | Verificar userId |
| `User not found` | Usuario no existe | Verificar userId |
| `User account is inactive` | Usuario desactivado | Contactar administrador |
| `User role mismatch` | Rol no coincide | Re-autenticar |
| `Invalid connectionId for this payment` | connectionId incorrecto | Verificar paymentId |

---

## Reconexión Automática

### Configuración de Reconexión

```typescript
const socket = io('http://localhost:3000', {
  path: '/socket.io',
  transports: ['websocket'],
  
  // Opciones de reconexión
  reconnection: true,           // Habilitar reconexión automática
  reconnectionAttempts: 10,     // Máximo de intentos
  reconnectionDelay: 1000,      // Delay inicial (1 segundo)
  reconnectionDelayMax: 10000,  // Delay máximo (10 segundos)
  randomizationFactor: 0.5,     // Factor de aleatorización
  
  auth: {
    token: getToken()
  }
});

// Eventos de reconexión
socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconectado después de ${attemptNumber} intentos`);
  
  // Re-registrar conexión después de reconectar
  registerConnection();
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Intento de reconexión #${attemptNumber}`);
  
  // Actualizar token antes de reconectar (si es necesario)
  socket.auth = { token: getToken() };
});

socket.on('reconnect_error', (error) => {
  console.error('Error de reconexión:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Reconexión falló después de todos los intentos');
  showOfflineMessage();
});
```

### Keep-Alive Manual

```typescript
// Enviar ping cada 30 segundos para mantener conexión activa
let pingInterval: NodeJS.Timeout;

socket.on('connect', () => {
  // Iniciar ping interval
  pingInterval = setInterval(() => {
    socket.emit('ping');
  }, 30000);
});

socket.on('pong', (data) => {
  console.log('Pong recibido:', data.timestamp);
});

socket.on('disconnect', () => {
  // Limpiar interval al desconectar
  if (pingInterval) {
    clearInterval(pingInterval);
  }
});
```

---

## Ejemplos Completos

### Hook de React para WebSocket

```typescript
// hooks/useWebSocket.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  userId: string;
  token: string;
  onOrderCreated?: (data: OrderNotificationData) => void;
  onOrderUpdated?: (data: OrderNotificationData) => void;
  onOrderDelivered?: (data: OrderNotificationData) => void;
  onOrderCanceled?: (data: OrderNotificationData) => void;
  onPaymentConfirmed?: (data: PaymentNotificationData) => void;
  onPaymentFailed?: (data: PaymentNotificationData) => void;
  onError?: (error: ErrorData) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  connectionId: string | null;
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    userId,
    token,
    onOrderCreated,
    onOrderUpdated,
    onOrderDelivered,
    onOrderCanceled,
    onPaymentConfirmed,
    onPaymentFailed,
    onError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Generar connectionId único
  const generateConnectionId = useCallback(() => {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Registrar conexión
  const registerConnection = useCallback(() => {
    if (!socketRef.current) return;

    const connId = generateConnectionId();

    socketRef.current.emit('register_connection', {
      connectionId: connId,
      userId: userId,
      token: token,
    });
  }, [userId, token, generateConnectionId]);

  // Conectar
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io('http://localhost:3000', {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: { token },
    });

    // Eventos de conexión
    socket.on('connect', () => {
      console.log('[WebSocket] Conectado');
      setIsConnected(true);
      registerConnection();
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Desconectado:', reason);
      setIsConnected(false);
      setConnectionId(null);
    });

    socket.on('connection_ack', (message) => {
      console.log('[WebSocket] Conexión registrada:', message.data.connectionId);
      setConnectionId(message.data.connectionId);
    });

    // Eventos de órdenes
    socket.on('order_created', (message) => {
      onOrderCreated?.(message.data);
    });

    socket.on('order_updated', (message) => {
      onOrderUpdated?.(message.data);
    });

    socket.on('order_delivered', (message) => {
      onOrderDelivered?.(message.data);
    });

    socket.on('order_canceled', (message) => {
      onOrderCanceled?.(message.data);
    });

    // Eventos de pagos
    socket.on('payment_confirmed', (message) => {
      onPaymentConfirmed?.(message.data);
    });

    socket.on('payment_failed', (message) => {
      onPaymentFailed?.(message.data);
    });

    // Eventos de error
    socket.on('error', (message) => {
      console.error('[WebSocket] Error:', message.data);
      onError?.(message.data);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Error de conexión:', error);
      onError?.({ message: error.message });
    });

    // Reconexión
    socket.on('reconnect', () => {
      console.log('[WebSocket] Reconectado');
      registerConnection();
    });

    socketRef.current = socket;
    socket.connect();
  }, [token, registerConnection, onOrderCreated, onOrderUpdated, onOrderDelivered, onOrderCanceled, onPaymentConfirmed, onPaymentFailed, onError]);

  // Desconectar
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setConnectionId(null);
    }
  }, []);

  // Conectar al montar, desconectar al desmontar
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    connectionId,
    socket: socketRef.current,
    connect,
    disconnect,
  };
}
```

### Uso del Hook en Componente

```typescript
// components/OrdersPage.tsx

import React, { useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';

export function OrdersPage() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  // Handlers de notificaciones
  const handleOrderCreated = useCallback((data: OrderNotificationData) => {
    console.log('Nueva orden:', data);
    
    // Agregar orden a la lista
    setOrders(prev => [data.order, ...prev]);
    
    // Mostrar toast
    toast.info(`Nueva orden de ${data.order.client || 'Cliente'}`, {
      position: 'top-right',
      autoClose: 5000,
    });
    
    // Reproducir sonido
    const audio = new Audio('/sounds/new-order.mp3');
    audio.play();
  }, []);

  const handleOrderUpdated = useCallback((data: OrderNotificationData) => {
    setOrders(prev => prev.map(order => 
      order.id === data.orderId ? { ...order, ...data.order } : order
    ));
    
    toast.info(`Orden actualizada`, { autoClose: 3000 });
  }, []);

  const handleOrderDelivered = useCallback((data: OrderNotificationData) => {
    setOrders(prev => prev.map(order => 
      order.id === data.orderId ? { ...order, delivered: true } : order
    ));
    
    toast.success(`Orden entregada`, { autoClose: 3000 });
  }, []);

  const handleOrderCanceled = useCallback((data: OrderNotificationData) => {
    setOrders(prev => prev.filter(order => order.id !== data.orderId));
    
    toast.warning(`Orden cancelada`, { autoClose: 3000 });
  }, []);

  const handleError = useCallback((error: ErrorData) => {
    toast.error(error.message, { autoClose: 5000 });
  }, []);

  // Conectar WebSocket
  const { isConnected, connectionId } = useWebSocket({
    userId: user.id,
    token: token,
    onOrderCreated: handleOrderCreated,
    onOrderUpdated: handleOrderUpdated,
    onOrderDelivered: handleOrderDelivered,
    onOrderCanceled: handleOrderCanceled,
    onError: handleError,
  });

  return (
    <div className="orders-page">
      {/* Indicador de conexión */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
      </div>

      {/* Lista de órdenes */}
      <div className="orders-list">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
```

### Provider de WebSocket (Context)

```typescript
// context/WebSocketContext.tsx

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket, UseWebSocketReturn } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';

interface WebSocketContextValue extends UseWebSocketReturn {
  // Métodos adicionales si es necesario
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();

  const websocket = useWebSocket({
    userId: user?.id || '',
    token: token || '',
    onOrderCreated: (data) => {
      // Dispatch a global state manager (Redux, Zustand, etc.)
      console.log('Order created globally:', data);
    },
    // ... otros handlers
  });

  // No conectar si no hay usuario autenticado
  if (!user || !token) {
    return <>{children}</>;
  }

  return (
    <WebSocketContext.Provider value={websocket}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}
```

---

## Debugging

### Habilitar Logs de Socket.IO

```typescript
// En desarrollo, habilitar debug
localStorage.setItem('debug', 'socket.io-client:*');

// O solo ciertos namespaces
localStorage.setItem('debug', 'socket.io-client:socket');
```

### Verificar Estado de Conexión

```typescript
// Estado actual
console.log('Connected:', socket.connected);
console.log('Socket ID:', socket.id);

// Listeners activos
console.log('Listeners:', socket.listeners('order_created'));
```

### Testing Manual con DevTools

```javascript
// En la consola del navegador
const socket = io('http://localhost:3000', {
  path: '/socket.io',
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Conectado:', socket.id);
  
  // Registrar como staff
  socket.emit('register_connection', {
    connectionId: 'test_' + Date.now(),
    userId: 'tu-user-id',
    token: 'tu-jwt-token'
  });
});

socket.on('connection_ack', (msg) => console.log('ACK:', msg));
socket.on('order_created', (msg) => console.log('ORDEN:', msg));
socket.on('error', (msg) => console.log('ERROR:', msg));
```

### Verificar Cola SQS (Backend)

```bash
# Ver mensajes pendientes en cola
./scripts/localstack-cli.sh queue-status

# Si hay muchos mensajes "Staff not connected", ver la sección
# "¿Por qué aparece Staff not connected?" en esta guía: el front
# debe emitir register_connection con userId + token tras connect.
```

---

## Checklist de Implementación

### Conexión
- [ ] Instalar `socket.io-client`
- [ ] Crear conexión con URL y path correctos
- [ ] Configurar autenticación con token JWT
- [ ] Implementar registro de conexión (`register_connection`)
- [ ] Escuchar `connection_ack` para confirmar registro

### Eventos de Órdenes
- [ ] Escuchar `order_created`
- [ ] Escuchar `order_updated`
- [ ] Escuchar `order_delivered`
- [ ] Escuchar `order_canceled`
- [ ] Actualizar UI cuando llegan eventos

### Eventos de Pagos (si aplica)
- [ ] Escuchar `payment_confirmed`
- [ ] Escuchar `payment_failed`
- [ ] Escuchar `payment_pending`

### Manejo de Errores
- [ ] Escuchar `error` y `connect_error`
- [ ] Mostrar mensajes de error al usuario
- [ ] Manejar token expirado

### Reconexión
- [ ] Configurar reconexión automática
- [ ] Re-registrar conexión después de reconectar
- [ ] Mostrar estado de conexión al usuario

### UX
- [ ] Mostrar indicador de conexión (online/offline)
- [ ] Notificaciones visuales para nuevas órdenes
- [ ] Sonido para alertas importantes
- [ ] Toast/snackbar para actualizaciones
