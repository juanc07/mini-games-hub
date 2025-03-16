// src/lib/mongodb.ts
import mongoose from 'mongoose';

// Extend the global interface to include mongoose
declare global {
  // eslint-disable-next-line no-var
  var mongoose: {
    conn: mongoose.Mongoose | null;
    promise: Promise<mongoose.Mongoose> | null;
  };
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gameDB';

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI in .env.local');
}

// Type the cached variable
let cached: { conn: mongoose.Mongoose | null; promise: Promise<mongoose.Mongoose> | null } = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB(): Promise<mongoose.Mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then(mongooseInstance => mongooseInstance);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;