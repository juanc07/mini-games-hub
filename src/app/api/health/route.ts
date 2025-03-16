// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function GET() {
  try {
    // Get MongoDB URI from environment variables
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      return NextResponse.json(
        { status: 'error', message: 'MongoDB URI not configured' },
        { status: 500 }
      );
    }

    // Create MongoDB client and connect
    const client = new MongoClient(mongoUri);
    
    try {
      // Connect to MongoDB
      await client.connect();
      
      // Optionally ping the database to ensure it's responsive
      await client.db('gameDB').command({ ping: 1 });
      
      return NextResponse.json(
        { 
          status: 'ok', 
          mongodb: 'connected',
          timestamp: new Date().toISOString()
        },
        { status: 200 }
      );
    } catch (dbError) {
      console.error('MongoDB connection error:', dbError);
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Database connection failed',
          error: dbError instanceof Error ? dbError.message : 'Unknown error'
        },
        { status: 503 }
      );
    } finally {
      // Close the connection
      await client.close();
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Server health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: Configure route options
export const dynamic = 'force-dynamic'; // Ensures the route is not statically generated