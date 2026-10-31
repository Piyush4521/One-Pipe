/**
 * WebSocket Inbound & Outbound Message Validators
 * Follows Rules/PipeBot_Build_Rulebook.md § 6.2, 10.1, 16.2
 */

import crypto from 'crypto';
import { z } from 'zod';
import { WS_PROTOCOL_VERSION } from '../config/constants';
import { WsMessageEnvelope, WsProtocolVersion } from '../interfaces/websocket.interface';

/**
 * Protocol version schema. Rejects any unsupported protocol versions.
 */
export const wsProtocolVersionSchema = z.literal('1.0.0', {
  message: `Unsupported protocol version. Only '${WS_PROTOCOL_VERSION}' is supported.`,
});

/**
 * Inbound base envelope validator
 */
export const wsInboundBaseSchema = z
  .object({
    protocolVersion: wsProtocolVersionSchema,
    messageId: z.string().optional(),
    type: z.string().min(1, 'Message type is required'),
    timestamp: z.string().optional(),
    payload: z.unknown().optional(),
  })
  .strict();

/**
 * Inbound 'subscribe' payload schema
 */
export const wsSubscribePayloadSchema = z
  .object({
    channels: z
      .array(z.enum(['monitoring', 'operator_control']))
      .min(1, 'At least one channel must be specified')
      .max(10),
  })
  .strict();

/**
 * Inbound 'unsubscribe' payload schema
 */
export const wsUnsubscribePayloadSchema = z
  .object({
    channels: z
      .array(z.enum(['monitoring', 'operator_control']))
      .min(1, 'At least one channel must be specified')
      .max(10),
  })
  .strict();

/**
 * Inbound 'ping' payload schema
 */
export const wsPingPayloadSchema = z
  .object({
    clientTimestamp: z.string().optional(),
  })
  .strict()
  .optional();

/**
 * Helper to construct a strictly formatted, versioned server-to-client envelope
 */
export function createWsEnvelope<T>(
  type: string,
  payload: T,
  messageId: string = crypto.randomUUID()
): WsMessageEnvelope<T> {
  return {
    protocolVersion: WS_PROTOCOL_VERSION as WsProtocolVersion,
    messageId,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
}
