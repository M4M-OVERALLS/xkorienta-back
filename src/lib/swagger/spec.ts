/**
 * OpenAPI 3.0 specification for Xkorienta API
 * Served at /api/swagger and displayed at /swagger
 */
export const swaggerSpec = {
    openapi: "3.0.0",
    info: {
        title: "Xkorienta API",
        version: "1.0.0",
        description: "API backend de la plateforme Xkorienta — gestion des examens, utilisateurs et établissements scolaires.",
        contact: {
            name: "Équipe Xkorienta",
            url: "https://xkorienta.com",
        },
    },
    servers: [
        {
            url: "https://xkorienta.com/xkorienta/backend",
            description: "Production",
        },
        {
            url: "http://localhost:3001",
            description: "Développement local",
        },
    ],
    tags: [
        { name: "Auth", description: "Authentification et gestion de session" },
        { name: "Register", description: "Inscription des utilisateurs" },
        { name: "Schools", description: "Gestion des établissements" },
        { name: "Classes", description: "Gestion des classes" },
        { name: "Exams", description: "Gestion des examens" },
    ],
    paths: {
        // ─────────────────────────────────────────────────────────────
        // AUTH
        // ─────────────────────────────────────────────────────────────
        "/api/auth/csrf": {
            get: {
                tags: ["Auth"],
                summary: "Obtenir le token CSRF",
                description: "Étape 1 obligatoire avant tout POST vers NextAuth. Retourne un token CSRF et définit le cookie correspondant.",
                operationId: "getCsrfToken",
                responses: {
                    "200": {
                        description: "Token CSRF généré avec succès",
                        headers: {
                            "Set-Cookie": {
                                description: "Cookie CSRF (`next-auth.csrf-token`)",
                                schema: { type: "string" },
                            },
                        },
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        csrfToken: {
                                            type: "string",
                                            example: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
                                            description: "Token à inclure dans le body de la requête login",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },

        "/api/auth/callback/credentials": {
            post: {
                tags: ["Auth"],
                summary: "Login avec identifiants (email/téléphone + mot de passe)",
                description: "Étape 2 du flux login. Nécessite le token CSRF obtenu à l'étape précédente. Utiliser `json=true` pour obtenir JSON au lieu d'un redirect.",
                operationId: "loginCredentials",
                requestBody: {
                    required: true,
                    content: {
                        "application/x-www-form-urlencoded": {
                            schema: {
                                type: "object",
                                required: ["csrfToken", "identifier", "password"],
                                properties: {
                                    csrfToken: {
                                        type: "string",
                                        description: "Token CSRF obtenu via GET /api/auth/csrf",
                                        example: "a1b2c3d4e5f6...",
                                    },
                                    identifier: {
                                        type: "string",
                                        description: "Email ou numéro de téléphone (+237691234567)",
                                        example: "prof@exemple.com",
                                    },
                                    password: {
                                        type: "string",
                                        description: "Mot de passe",
                                        example: "MonMotDePasse123",
                                    },
                                    callbackUrl: {
                                        type: "string",
                                        description: "URL de redirection après succès",
                                        example: "/dashboard",
                                    },
                                    json: {
                                        type: "string",
                                        description: "Mettre 'true' pour recevoir JSON au lieu d'un redirect",
                                        example: "true",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Login réussi — session créée via cookie",
                        headers: {
                            "Set-Cookie": {
                                description: "Cookie de session JWT (`next-auth.session-token`)",
                                schema: { type: "string" },
                            },
                        },
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        url: {
                                            type: "string",
                                            example: "https://xkorienta.com/dashboard",
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "302": {
                        description: "Redirect vers callbackUrl ou vers /login?error=CredentialsSignin en cas d'échec",
                    },
                },
            },
        },

        "/api/auth/session": {
            get: {
                tags: ["Auth"],
                summary: "Récupérer la session active",
                description: "Étape 3 : vérifier que la session est valide et obtenir les données de l'utilisateur connecté.",
                operationId: "getSession",
                security: [{ cookieAuth: [] }],
                responses: {
                    "200": {
                        description: "Session active",
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        {
                                            type: "object",
                                            description: "Utilisateur connecté",
                                            properties: {
                                                user: {
                                                    $ref: "#/components/schemas/SessionUser",
                                                },
                                                expires: {
                                                    type: "string",
                                                    format: "date-time",
                                                    example: "2026-05-08T14:00:00.000Z",
                                                },
                                            },
                                        },
                                        {
                                            type: "object",
                                            description: "Non connecté (objet vide)",
                                            example: {},
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            },
        },

        "/api/auth/providers-info": {
            get: {
                tags: ["Auth"],
                summary: "Lister les providers OAuth disponibles",
                description: "Retourne la liste des providers d'authentification activés (Google, GitHub, etc.).",
                operationId: "getProviders",
                responses: {
                    "200": {
                        description: "Liste des providers",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        providers: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    id: { type: "string", example: "google" },
                                                    name: { type: "string", example: "Google" },
                                                    icon: { type: "string", example: "google" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },

        // ─────────────────────────────────────────────────────────────
        // REGISTER
        // ─────────────────────────────────────────────────────────────
        "/api/register/v2": {
            post: {
                tags: ["Register"],
                summary: "Inscrire un nouvel utilisateur",
                description: `Inscription d'un professeur, étudiant ou administrateur d'école.

**Après inscription, il faut effectuer le flux login pour créer la session.**

**3 options école pour un professeur :**
- \`schoolId\` : rejoindre une école existante
- \`declaredSchoolData\` : déclarer une école non répertoriée (statut PENDING)
- \`skipSchool: true\` : mode Classe Libre, sans école

**Rate limit :** 5 tentatives / IP / 15 minutes`,
                operationId: "registerUser",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/RegisterRequest",
                            },
                            examples: {
                                teacherFreeMode: {
                                    summary: "Professeur — Mode Classe Libre",
                                    value: {
                                        name: "Jean Dupont",
                                        email: "prof@exemple.com",
                                        password: "MonMotDePasse123",
                                        role: "TEACHER",
                                        skipSchool: true,
                                    },
                                },
                                teacherExistingSchool: {
                                    summary: "Professeur — École existante",
                                    value: {
                                        name: "Jean Dupont",
                                        email: "prof@exemple.com",
                                        password: "MonMotDePasse123",
                                        role: "TEACHER",
                                        schoolId: "507f191e810c19729de860ea",
                                    },
                                },
                                teacherNewSchool: {
                                    summary: "Professeur — Nouvelle école (non répertoriée)",
                                    value: {
                                        name: "Jean Dupont",
                                        email: "prof@exemple.com",
                                        password: "MonMotDePasse123",
                                        role: "TEACHER",
                                        declaredSchoolData: {
                                            name: "Lycée Bilingue de Yaoundé",
                                            city: "Yaoundé",
                                            country: "Cameroun",
                                            type: "SECONDARY",
                                        },
                                    },
                                },
                                teacherPhone: {
                                    summary: "Professeur — Avec téléphone",
                                    value: {
                                        name: "Jean Dupont",
                                        phone: "+237691234567",
                                        password: "MonMotDePasse123",
                                        role: "TEACHER",
                                        skipSchool: true,
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Inscription réussie",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/RegisterResponse",
                                },
                            },
                        },
                    },
                    "400": {
                        description: "Données invalides ou compte existant",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                                examples: {
                                    emailExists: {
                                        value: { success: false, message: "Un compte existe déjà avec cet email" },
                                    },
                                    phoneExists: {
                                        value: { success: false, message: "Ce numéro de téléphone est déjà utilisé" },
                                    },
                                    missingIdentifier: {
                                        value: { success: false, message: "Email ou numéro de téléphone requis" },
                                    },
                                },
                            },
                        },
                    },
                    "429": {
                        description: "Trop de tentatives — Rate limit atteint",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        error: { type: "string", example: "Too many requests" },
                                        retryAfter: { type: "number", example: 900 },
                                    },
                                },
                            },
                        },
                    },
                    "500": {
                        description: "Erreur interne du serveur",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                            },
                        },
                    },
                },
            },
        },
    },

    components: {
        securitySchemes: {
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "next-auth.session-token",
                description: "Cookie de session JWT créé par NextAuth après login",
            },
        },
        schemas: {
            SessionUser: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "507f1f77bcf86cd799439011",
                        description: "ID MongoDB de l'utilisateur",
                    },
                    name: { type: "string", example: "Jean Dupont" },
                    email: {
                        type: "string",
                        example: "prof@exemple.com",
                        description: "Email ou numéro de téléphone selon le mode d'inscription",
                    },
                    role: {
                        type: "string",
                        enum: ["TEACHER", "STUDENT", "SCHOOL_ADMIN"],
                        example: "TEACHER",
                    },
                    image: { type: "string", nullable: true, example: null },
                    schools: {
                        type: "array",
                        items: { type: "string" },
                        example: ["507f191e810c19729de860ea"],
                        description: "IDs des écoles associées",
                    },
                },
            },

            RegisterRequest: {
                type: "object",
                required: ["name", "password", "role"],
                properties: {
                    name: {
                        type: "string",
                        minLength: 2,
                        maxLength: 100,
                        example: "Jean Dupont",
                    },
                    email: {
                        type: "string",
                        format: "email",
                        example: "prof@exemple.com",
                        description: "Obligatoire si pas de phone",
                    },
                    phone: {
                        type: "string",
                        pattern: "^\\+?[0-9]{8,15}$",
                        example: "+237691234567",
                        description: "Obligatoire si pas d'email",
                    },
                    password: {
                        type: "string",
                        minLength: 6,
                        maxLength: 128,
                        example: "MonMotDePasse123",
                    },
                    role: {
                        type: "string",
                        enum: ["TEACHER", "STUDENT", "SCHOOL_ADMIN"],
                        example: "TEACHER",
                    },
                    schoolId: {
                        type: "string",
                        example: "507f191e810c19729de860ea",
                        description: "ID d'une école existante (optionnel)",
                    },
                    declaredSchoolData: {
                        type: "object",
                        description: "École non répertoriée déclarée par l'utilisateur",
                        properties: {
                            name: { type: "string", minLength: 2, maxLength: 200 },
                            city: { type: "string", maxLength: 100 },
                            country: { type: "string", maxLength: 100 },
                            type: {
                                type: "string",
                                enum: ["PRIMARY", "SECONDARY", "HIGHER_ED"],
                            },
                        },
                        required: ["name"],
                    },
                    skipSchool: {
                        type: "boolean",
                        example: true,
                        description: "true = mode Classe Libre, sans école",
                    },
                },
            },

            RegisterResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean", example: true },
                    message: { type: "string", example: "Inscription réussie" },
                    user: {
                        type: "object",
                        properties: {
                            id: { type: "string", example: "507f1f77bcf86cd799439011" },
                            name: { type: "string", example: "Jean Dupont" },
                            email: { type: "string", example: "prof@exemple.com" },
                            phone: { type: "string", nullable: true, example: null },
                            role: { type: "string", example: "TEACHER" },
                            awaitingSchoolValidation: { type: "boolean", example: false },
                        },
                    },
                    createdSchool: {
                        type: "object",
                        nullable: true,
                        description: "Présent uniquement si une nouvelle école a été créée",
                        properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            status: { type: "string", example: "PENDING" },
                        },
                    },
                },
            },

            ErrorResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean", example: false },
                    message: { type: "string", example: "Un compte existe déjà avec cet email" },
                },
            },
        },
    },
}
