import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Log } from './logs.entity';

/**
 * Subscription data from client
 */
interface SubscribeData {
  tenantId: string;
  severity?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

/**
 * WebSocket gateway for real-time log streaming with multi-tenant isolation
 *
 * CRITICAL: Uses Socket.IO (NOT native WebSocket)
 * - Frontend MUST use socket.io-client library
 * - Native WebSocket clients will NOT work with this gateway
 *
 * GOOD: Room-based tenant isolation prevents cross-tenant data leaks
 * - Each tenant has dedicated room: logs:tenant_abc
 * - Broadcasts only reach clients in same room
 * BAD: Broadcasting to all clients (this.server.emit) leaks data
 *
 * @WebSocketGateway enables CORS for frontend integration
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})
export class LogsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LogsGateway.name);

  /**
   * Handle client connection
   * GOOD: Log connection for debugging (no sensitive data)
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnection
   * GOOD: Clean up resources (socket.io auto-leaves rooms on disconnect)
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Handle subscription to tenant logs
   *
   * CRITICAL: Room-based tenant isolation
   * - Client joins room: `logs:${tenantId}`
   * - Only clients in same room receive broadcasts
   * - Prevents cross-tenant data leaks
   *
   * GOOD: Store filter preferences on socket for potential filtering
   * BAD: Trusting client-provided tenantId without authentication
   * TODO: Add authentication middleware to validate tenantId against user claims
   *
   * @param data - Subscription data { tenantId, severity? }
   * @param client - Socket.IO client socket
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() data: SubscribeData,
    @ConnectedSocket() client: Socket,
  ) {
    // GOOD: Validate subscription data
    if (!data.tenantId || typeof data.tenantId !== 'string') {
      client.emit('error', {
        code: 'INVALID_SUBSCRIPTION',
        message: 'tenantId is required and must be a string',
      });
      return;
    }

    // CRITICAL: Join tenant-specific room for isolated broadcasts
    // Room naming convention: logs:${tenantId}
    const roomName = `logs:${data.tenantId}`;
    client.join(roomName);

    // GOOD: Store filter preferences on socket for potential server-side filtering
    // Can be used to filter logs by severity before broadcasting
    client.data.tenantId = data.tenantId;
    client.data.severity = data.severity;

    this.logger.log(
      `Client ${client.id} subscribed to ${roomName}${data.severity ? ` (severity: ${data.severity})` : ''}`,
    );

    // GOOD: Acknowledge subscription
    client.emit('subscribed', {
      tenantId: data.tenantId,
      severity: data.severity,
      room: roomName,
    });
  }

  /**
   * Handle unsubscribe from tenant logs
   *
   * GOOD: Allow clients to explicitly leave rooms
   * Socket.IO auto-leaves on disconnect, but explicit unsubscribe is cleaner
   *
   * @param data - Unsubscription data { tenantId }
   * @param client - Socket.IO client socket
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @MessageBody() data: SubscribeData,
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.tenantId) {
      return;
    }

    const roomName = `logs:${data.tenantId}`;
    client.leave(roomName);

    this.logger.log(`Client ${client.id} unsubscribed from ${roomName}`);

    client.emit('unsubscribed', {
      tenantId: data.tenantId,
    });
  }

  /**
   * Broadcast new log to all subscribed clients in tenant room
   *
   * CRITICAL: Room-based broadcast ensures tenant isolation
   * - Uses this.server.to(room) to emit only to specific room
   * - Clients in other tenant rooms do NOT receive this log
   *
   * GOOD: Server-side severity filtering respects client preferences
   * - Only emits to clients who subscribed to this severity (or no filter)
   * - Reduces unnecessary network traffic to clients
   * BAD: Using this.server.emit('log', log) broadcasts to ALL clients (data leak)
   *
   * @param log - Log entity to broadcast
   */
  async broadcastLog(log: Log) {
    const roomName = `logs:${log.tenantId}`;

    // GOOD: Get all sockets in the tenant room
    const sockets = await this.server.in(roomName).fetchSockets();

    // GOOD: Filter by severity preference before emitting
    // Only send to clients with no severity filter OR matching severity
    for (const socket of sockets) {
      const clientSeverity = socket.data.severity;

      // GOOD: No filter (undefined) means client receives all severities
      // GOOD: Matching severity means client receives this log
      if (!clientSeverity || clientSeverity === log.severity) {
        socket.emit('log', log);
      }
    }

    this.logger.debug(
      `Broadcasted log ${log.id} (${log.severity}) to ${sockets.length} clients in room ${roomName}`,
    );
  }

  /**
   * Get count of clients in a tenant room
   * Useful for monitoring and debugging
   *
   * @param tenantId - Tenant ID
   * @returns Number of connected clients in tenant room
   */
  async getSubscriberCount(tenantId: string): Promise<number> {
    const roomName = `logs:${tenantId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }
}
