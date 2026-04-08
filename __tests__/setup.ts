/**
 * Configuration globale des tests
 * Exécuté avant tous les tests
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongoServer: MongoMemoryServer

/**
 * Setup global avant tous les tests
 */
beforeAll(async () => {
    // Créer un serveur MongoDB en mémoire
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()

    // Se connecter à MongoDB
    await mongoose.connect(mongoUri)
})

/**
 * Cleanup après chaque test
 */
afterEach(async () => {
    // Nettoyer toutes les collections
    const collections = mongoose.connection.collections
    for (const key in collections) {
        await collections[key].deleteMany({})
    }
})

/**
 * Cleanup global après tous les tests
 */
afterAll(async () => {
    // Fermer la connexion
    await mongoose.disconnect()

    // Arrêter le serveur MongoDB en mémoire
    await mongoServer.stop()
})

/**
 * Timeout par défaut pour les tests
 */
jest.setTimeout(30000)
