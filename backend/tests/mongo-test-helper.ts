/**
 * Test-Only MongoDB Connection & Cleanup Helper
 * Follows Rules/PipeBot_Build_Rulebook.md § 16.1, 16.4
 *
 * CRITICAL TEST CONSTRAINTS:
 * 1. Strictly connects to local test database: 'mongodb://127.0.0.1:27017/pipebot_test'.
 * 2. Never connects to cloud/Atlas or non-local hosts.
 * 3. Never touches any production database.
 * 4. Cleans up collections before/after test suites.
 * 5. Cleanly terminates connections after test execution.
 */

import mongoose from 'mongoose';
import {
  DefectModel,
  InspectionModel,
  ReportModel,
  SystemEventModel,
  TelemetrySampleModel,
} from '../src/models';

export const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/pipebot_test';
export const TEST_DB_NAME = 'pipebot_test';

/**
 * Validates that target connection URI is strictly localhost/127.0.0.1
 */
function assertLocalhostUri(uri: string): void {
  const parsed = new URL(uri);
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error(
      `SECURITY VIOLATION: Test database must connect strictly to localhost/127.0.0.1. Attempted: ${parsed.hostname}`
    );
  }
  if (!parsed.pathname.includes(TEST_DB_NAME)) {
    throw new Error(
      `DATABASE ISOLATION VIOLATION: Test database name must be '${TEST_DB_NAME}'. Attempted: ${parsed.pathname}`
    );
  }
}

/**
 * Connects Mongoose to the dedicated local test database.
 */
export async function connectTestMongo(): Promise<typeof mongoose> {
  assertLocalhostUri(TEST_MONGO_URI);

  if (mongoose.connection.readyState === 1) {
    // Already connected
    if (mongoose.connection.name !== TEST_DB_NAME) {
      throw new Error(
        `Active Mongoose connection is to '${mongoose.connection.name}', not '${TEST_DB_NAME}'. Aborting.`
      );
    }
    return mongoose;
  }

  await mongoose.connect(TEST_MONGO_URI, {
    serverSelectionTimeoutMS: 3000,
  });

  return mongoose;
}

/**
 * Deletes all documents in test collections without dropping the database.
 */
export async function cleanTestCollections(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  if (mongoose.connection.name !== TEST_DB_NAME) {
    throw new Error(
      `Refusing to clean collections: active database '${mongoose.connection.name}' is not '${TEST_DB_NAME}'!`
    );
  }

  await Promise.all([
    InspectionModel.deleteMany({}),
    DefectModel.deleteMany({}),
    ReportModel.deleteMany({}),
    SystemEventModel.deleteMany({}),
    TelemetrySampleModel.deleteMany({}),
  ]);
}

/**
 * Cleans collections and closes the Mongoose test connection.
 */
export async function disconnectTestMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await cleanTestCollections();
    await mongoose.disconnect();
  }
}

