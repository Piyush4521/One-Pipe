/**
 * Production MongoDB Connection Manager
 * Follows Rules/PipeBot_Build_Rulebook.md § 7, 16.1, 16.4
 *
 * Provides robust connection lifecycle management for Mongoose:
 * - Connection pooling (minPoolSize: 2, maxPoolSize: 10)
 * - Controlled indexing (autoIndex: false)
 * - Immediate failure on disconnect (bufferCommands: false)
 * - Connection event observation and truthful state reporting
 * - Redacted URI logging (zero credentials leaked)
 * - Safe asynchronous disconnect
 */

import mongoose, { ConnectOptions } from 'mongoose';
import { env, getRedactedMongoUri } from '../config/env';
import { logger } from '../utils/logger';

export type MongoConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export interface MongoHealthSnapshot {
  isAvailable: boolean;
  state: MongoConnectionState;
  readyState: number;
  host: string | null;
  port: number | null;
  databaseName: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
}

/**
 * Sensible, documented Mongoose connection options.
 * Does not invent hardware-related timing values.
 */
export const MONGO_CONNECTION_OPTIONS: ConnectOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000,
  autoIndex: false, // Controlled indexing; do not build indexes on query execution
  bufferCommands: false, // Fail fast on disconnect rather than silently hanging
};

export class MongoConnectionManager {
  private state: MongoConnectionState = 'disconnected';
  private lastConnectedAt: Date | null = null;
  private lastDisconnectedAt: Date | null = null;
  private lastError: Error | null = null;
  private connectingPromise: Promise<typeof mongoose> | null = null;
  private listenersAttached = false;

  constructor() {
    this.attachEventListeners();
  }

  /**
   * Attaches one-time event listeners to the Mongoose connection to track lifecycle state.
   */
  private attachEventListeners(): void {
    if (this.listenersAttached) {
      return;
    }

    const conn = mongoose.connection;

    conn.on('connected', () => {
      this.state = 'connected';
      this.lastConnectedAt = new Date();
      this.lastError = null;
      logger.info(
        {
          host: conn.host,
          port: conn.port,
          dbName: conn.name,
        },
        'MongoDB connection established successfully'
      );
    });

    conn.on('error', (err) => {
      this.state = 'error';
      this.lastError = err;
      logger.error(
        {
          errorMessage: err.message,
          errorCode: (err as any).code,
        },
        'MongoDB connection encountered an error'
      );
    });

    conn.on('disconnected', () => {
      this.state = 'disconnected';
      this.lastDisconnectedAt = new Date();
      logger.warn('MongoDB connection disconnected');
    });

    conn.on('reconnected', () => {
      this.state = 'connected';
      this.lastConnectedAt = new Date();
      this.lastError = null;
      logger.info('MongoDB connection reconnected successfully');
    });

    this.listenersAttached = true;
  }

  /**
   * Connects to local MongoDB using validated environment configuration.
   * Prevents competing connection attempts through promise memoization.
   */
  public async connect(
    uri: string = env.MONGODB_URI,
    dbName: string = env.MONGODB_DB_NAME,
    overrideOptions: ConnectOptions = {}
  ): Promise<typeof mongoose> {
    // If already connected, return existing instance
    if (mongoose.connection.readyState === 1) {
      this.state = 'connected';
      return mongoose;
    }

    // If currently connecting, await existing promise
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.state = 'connecting';
    const redactedUri = getRedactedMongoUri(uri);
    logger.info({ uri: redactedUri, dbName }, 'Initiating MongoDB connection...');

    this.connectingPromise = (async () => {
      try {
        const instance = await mongoose.connect(uri, {
          ...MONGO_CONNECTION_OPTIONS,
          ...overrideOptions,
          dbName,
        });
        this.state = 'connected';
        this.lastConnectedAt = new Date();
        this.lastError = null;
        return instance;
      } catch (err: any) {
        this.state = 'error';
        this.lastError = err;
        logger.error(
          {
            errorMessage: err.message,
            errorCode: err.code,
            uri: redactedUri,
          },
          'Failed to establish initial MongoDB connection'
        );
        throw err;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Gracefully closes the Mongoose connection.
   */
  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState === 0) {
      this.state = 'disconnected';
      return;
    }

    this.state = 'disconnecting';
    try {
      await mongoose.disconnect();
      this.state = 'disconnected';
      this.lastDisconnectedAt = new Date();
      logger.info('MongoDB connection closed gracefully');
    } catch (err: any) {
      this.state = 'error';
      this.lastError = err;
      logger.error({ err }, 'Error during MongoDB disconnect');
      throw err;
    }
  }

  /**
   * Returns whether the database connection is currently active and ready.
   */
  public isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Pings the active MongoDB database and measures round-trip time in milliseconds.
   */
  public async ping(): Promise<number | null> {
    if (!this.isConnected()) {
      return null;
    }
    const start = Date.now();
    try {
      await mongoose.connection.db?.admin().ping();
      return Date.now() - start;
    } catch {
      return null;
    }
  }

  /**
   * Returns current lifecycle connection state.
   */
  public getConnectionState(): MongoConnectionState {
    // Sync with readyState if inconsistent
    const readyState = mongoose.connection.readyState;
    if (readyState === 1) return 'connected';
    if (readyState === 2) return 'connecting';
    if (readyState === 3) return 'disconnecting';
    if (readyState === 0 && this.state !== 'error') return 'disconnected';
    return this.state;
  }

  /**
   * Exposes sanitized, truthful health snapshot for diagnostic endpoints.
   */
  public getHealthSnapshot(): MongoHealthSnapshot {
    const conn = mongoose.connection;
    const currentState = this.getConnectionState();

    return {
      isAvailable: currentState === 'connected',
      state: currentState,
      readyState: conn.readyState,
      host: currentState === 'connected' ? conn.host : null,
      port: currentState === 'connected' ? conn.port : null,
      databaseName: currentState === 'connected' ? conn.name : null,
      lastConnectedAt: this.lastConnectedAt ? this.lastConnectedAt.toISOString() : null,
      lastDisconnectedAt: this.lastDisconnectedAt
        ? this.lastDisconnectedAt.toISOString()
        : null,
      lastError: this.lastError ? this.lastError.message : null,
    };
  }
}

export const mongoConnectionManager = new MongoConnectionManager();
