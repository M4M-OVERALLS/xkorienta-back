/**
 * Connexion MongoDB en mémoire pour les tests (mongodb-memory-server).
 * Évite la dépendance à un MongoDB local sur localhost:27017.
 */
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer | null = null;

/** Démarre MongoMemoryServer et connecte Mongoose. */
export async function connectMongoMemory(): Promise<MongoMemoryServer> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  return mongoServer;
}

/** Vide toutes les collections de la base courante. */
export async function clearMongoCollections(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
}

/** Ferme Mongoose et arrête le serveur en mémoire. */
export async function disconnectMongoMemory(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}
