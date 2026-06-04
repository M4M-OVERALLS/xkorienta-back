import admin from 'firebase-admin'

/**
 * Retourne l'instance Firebase Admin initialisée (singleton).
 * Lit les credentials depuis la variable d'environnement FIREBASE_SERVICE_ACCOUNT_JSON.
 *
 * @throws {Error} si FIREBASE_SERVICE_ACCOUNT_JSON n'est pas défini ou n'est pas du JSON valide
 */
export function getFirebaseAdmin(): admin.app.App {
    if (admin.apps.length === 0) {
        if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            throw new Error(
                '[Firebase] La variable d\'environnement FIREBASE_SERVICE_ACCOUNT_JSON n\'est pas définie'
            )
        }

        let serviceAccount: admin.ServiceAccount
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
        } catch {
            throw new Error('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON n\'est pas un JSON valide')
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        })
    }

    return admin.app()
}
