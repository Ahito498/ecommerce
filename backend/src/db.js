import mongoose from 'mongoose';

let memoryServer = null;

/**
 * Connect to MongoDB.
 *
 * If MONGODB_URI is set we use it (local server or Atlas). Otherwise we fall
 * back to an ephemeral in-memory MongoDB so the project runs with zero setup —
 * handy for a quick demo. Set MONGODB_URI for a persistent database.
 */
export async function connectDB() {
  let uri = process.env.MONGODB_URI;

  if (!uri) {
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
      console.log('⚠  No MONGODB_URI set — started an in-memory MongoDB (data is ephemeral).');
      console.log('   Set MONGODB_URI in backend/.env for a persistent database.');
    } catch (err) {
      console.error('No MONGODB_URI set and the in-memory fallback is unavailable.');
      console.error('Set MONGODB_URI in backend/.env, or run "docker compose up -d mongo".');
      throw err;
    }
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || 'ecommerce' });

  const where = memoryServer ? 'in-memory' : uri.replace(/\/\/[^@]*@/, '//***@');
  console.log(`✓  MongoDB connected (${where})`);
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
