# Cahier Technique d'Infrastructure — Xkorienta

> **Projet :** Xkorienta — Plateforme d'évaluation et d'orientation scolaire
> **Version :** 1.0
> **Date :** Mai 2026
> **Destinataire :** Camtel (Cameroon Telecommunications)
> **Objet :** Présentation de l'architecture technique et analyse de la charge applicative

---

## Table des matières

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Architecture globale d'infrastructure](#2-architecture-globale-dinfrastructure)
3. [Spécifications des serveurs](#3-spécifications-des-serveurs)
4. [Architecture de déploiement Docker](#4-architecture-de-déploiement-docker)
5. [Architecture réseau et flux de données](#5-architecture-réseau-et-flux-de-données)
6. [Architecture applicative](#6-architecture-applicative)
7. [Base de données](#7-base-de-données)
8. [Services externes](#8-services-externes)
9. [Sécurité de l'infrastructure](#9-sécurité-de-linfrastructure)
10. [Analyse de charge et capacité](#10-analyse-de-charge-et-capacité)
11. [Estimation des besoins en bande passante](#11-estimation-des-besoins-en-bande-passante)
12. [Points d'évolution et plan de croissance](#12-points-dévolution-et-plan-de-croissance)
13. [Recommandations pour le partenariat Camtel](#13-recommandations-pour-le-partenariat-camtel)

---

## 1. Synthèse exécutive

Xkorienta est une plateforme éducative numérique conçue pour le système scolaire camerounais. Elle cible les établissements secondaires et supérieurs, avec un objectif de **100 000 utilisateurs** (enseignants et étudiants).

L'infrastructure actuelle repose sur **trois serveurs VPS** hébergés en France chez **LWS** :
- Un serveur de **production applicatif** — 8 vCPUs, 22 Go RAM, 200 Go HDD
- Un serveur de **base de données dédié** — 6 vCPUs, 11 Go RAM, 100 Go HDD *(serveur séparé)*
- Un serveur de **développement** — architecture identique au prod applicatif, 8 Go RAM, 200 Go SSD

Les applications sont entièrement conteneurisées via **Docker**, exposées derrière un reverse proxy **Nginx** avec chiffrement **TLS 1.2/1.3** (Let's Encrypt). Deux applications cohabitent sur le serveur de production applicatif : **Xkorienta** (plateforme pédagogique) et **Xkorin** (application complémentaire). La base de données MongoDB tourne dans un **conteneur Docker** sur un **serveur VPS dédié** (`vps-5e2088d6`), partagé par les deux applications (Xkorienta et Xkorin), accessible depuis le serveur applicatif via le réseau interne LWS. Le serveur de développement intègre quant à lui son propre conteneur MongoDB en local.

Ce document a pour but de décrire l'architecture technique complète, d'analyser la capacité de la plateforme à supporter la charge cible, et d'identifier les besoins en connectivité pour un partenariat avec Camtel.

---

## 2. Architecture globale d'infrastructure

### 2.1 Vue d'ensemble

```plantuml
@startuml INFRA_Global
skinparam backgroundColor #FAFAFA
skinparam nodeBorderColor #555555
skinparam componentBorderColor #888888
skinparam ArrowColor #444444
skinparam roundcorner 10
skinparam defaultFontSize 11

title Architecture Globale d'Infrastructure — Xkorienta

cloud "Utilisateurs Cameroun\n(Internet / Camtel)" as Cameroun #ABEBC6 {
  component "Etudiants\nEnseignants" as Users
}

cloud "Utilisateurs Diaspora / Monde" as World #D6EAF8 {
  component "Autres utilisateurs" as WorldUsers
}

node "Camtel Network\n(Cameroun)" as CamtelNet #A9DFBF {
  component "Bande passante\nInternationale" as Bandwidth
}

cloud "Internet (Backbone)" as Internet #EAEDED

node "Datacenter LWS\n(France)" as LWSCloud #EBF5FB {

  node "Serveur PRODUCTION Applicatif\n(LWS)" as ProdServer #D6EAF8 {
    component "Nginx 1.25\n(Reverse Proxy + TLS)" as Nginx
    component "xkorienta-frontend\n(Next.js :3000)" as FE
    component "xkorienta-api\n(Next.js :3001)" as API
    component "Xkorin Application\n(backend :4005 + frontend :8080)" as XkorinApp
    component "Keycloak\n(:8080 — auth Xkorin)" as KC
  }

  node "Serveur BASE DE DONNEES Dedie\n(LWS — vps-5e2088d6)" as DBServer #E8DAEF {
    database "MongoDB\n(Docker container :27017)" as MongoDB
  }

  node "Serveur DEVELOPPEMENT\n(LWS — meme architecture)" as DevServer #FEF9E7 {
    component "Nginx\n(Reverse Proxy + TLS)" as DevNginx
    component "xkorienta-frontend\n(dev :3000)" as DevFE
    component "xkorienta-api\n(dev :3001)" as DevAPI
    database "MongoDB\n(Docker :27017 — integre)" as DevMongo
    component "Xkorin Application\n(dev — meme stack)" as DevXkorin
  }
}

cloud "Services Tiers" as ExternalSvcs #F9EBEA {
  component "Pusher Channels\n(WebSocket temps reel)" as Pusher
  component "HuggingFace API\n(Generation IA)" as HF
  component "Outlook SMTP\n(smtp.office365.com:587)" as SMTP
  component "Let's Encrypt\n(Certificats SSL)" as LE
}

Users --> CamtelNet : HTTP/HTTPS
WorldUsers --> Internet
CamtelNet --> Internet
Internet --> LWSCloud : HTTPS :443

Nginx --> FE : HTTP :3000
Nginx --> API : HTTP :3001
FE --> API : REST API calls
API --> MongoDB : Mongoose ODM\nTCP :27017 (reseau LWS interne)
XkorinApp --> MongoDB : TCP :27017\n(reseau LWS interne)
Nginx --> XkorinApp : HTTP :4005 / :8080
XkorinApp --> KC : OIDC

API --> Pusher : HTTPS\n(publish events)
Users --> Pusher : WSS :443\n(WebSocket temps reel)
API --> HF : HTTPS\n(inference IA)
API --> SMTP : STARTTLS :587\n(emails transactionnels)

note right of ProdServer
  OS : Ubuntu 25.04
  CPU : 8 vCPUs (Intel Haswell)
  RAM : 22 Go
  Disque : 200 Go HDD
  Docker : 28.5.0
  SSL : TLS 1.2 / 1.3
end note

note right of DBServer
  CPU : 6 vCPUs (Intel Haswell)
  RAM : 11 Go
  Disque : 100 Go HDD
  Sert Xkorienta + Xkorin
  Uptime : 229 jours
end note

note right of DevServer
  Architecture identique au PROD
  RAM : 8 Go
  Disque : 200 Go SSD
  MongoDB integre (conteneur local)
  Usage : dev, tests, staging
end note

note right of ExternalSvcs
  Pusher : Plan Spark (gratuit)
  100 connexions WebSocket max
  Point d'evolution prioritaire
end note

@enduml
```

### 2.2 Environnements

| Environnement | Rôle | Hébergeur | Domaines actifs |
|---------------|------|-----------|-----------------|
| **Production** | Application live, utilisateurs réels | LWS — France | xkorienta.com, gradeforcast.com, xkorin.com |
| **Développement** | Tests, intégration continue, staging | LWS — France | (domaine de dev) |

> Les deux environnements partagent la même architecture Docker (infrastructure dupliquée). Le serveur de développement dispose d'un SSD là où la production utilise un HDD.

---

## 3. Spécifications des serveurs

### 3.1 Serveur Production

```plantuml
@startuml SPEC_Prod
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Specifications — Serveur Production (LWS)

rectangle "Serveur Production — LWS France" as PROD #D6EAF8 {

  rectangle "Compute" as Compute #EBF5FB {
    card "CPU\nIntel Core (Haswell)\n8 vCPUs (x86-64)" as CPU
    card "RAM\n22 Go DDR4\n2.3 Go utilises (10%)\n20 Go disponibles" as RAM
    card "SWAP\nNon configure\n(a configurer : 4 Go)" as SWAP
  }

  rectangle "Stockage" as Storage #EAFAF1 {
    card "Disque\n200 Go HDD\n(rotatif — ROTA=1)\n13 Go utilises (7%)" as Disk
    card "Partition principale\n/dev/sda1 — 193 Go\nSysteme de fichiers ext4" as Part
    card "Boot EFI\n/dev/sda15 — 105 Mo\nBoot — /dev/sda13 — 989 Mo" as Boot
  }

  rectangle "Systeme" as OS_Block #FEF9E7 {
    card "OS\nUbuntu 25.04\n(Plucky Puffin)" as OS
    card "Noyau\nLinux 6.14.0-15-generic\nx86-64" as Kernel
    card "Virtualisation\nKVM / OpenStack Nova" as Virt
  }

  rectangle "Reseau" as Net #F9EBEA {
    card "IP Publique\n137.74.46.148" as IP
    card "Hebergeur\nLWS\n(France)" as Loc
    card "SSL\nLet's Encrypt\nTLS 1.2 / 1.3" as SSL
  }
}

@enduml
```

| Paramètre | Valeur |
|-----------|--------|
| **Hébergeur** | LWS — France |
| **Type** | VPS KVM |
| **CPU** | Intel Core (Haswell) — **8 vCPUs** |
| **RAM** | **22 Go** — 2,3 Go utilisés / 20 Go disponibles |
| **Swap** | Non configuré (à configurer) |
| **Stockage** | **200 Go HDD** (rotatif) — 13 Go utilisés (7%) |
| **OS** | Ubuntu 25.04 (Plucky Puffin) |
| **Noyau** | Linux 6.14.0-15-generic |
| **Virtualisation** | KVM |
| **IP publique** | 137.74.46.148 |
| **Runtime conteneurs** | Docker 28.5.0 |
| **Protocoles TLS** | 1.2 et 1.3 |
| **Certificats SSL** | Let's Encrypt (renouvellement automatique) |

### 3.2 Serveur Base de Données (dédié)

| Paramètre | Valeur |
|-----------|--------|
| **Hébergeur** | LWS — France |
| **Hostname** | vps-5e2088d6 |
| **Type** | VPS KVM |
| **CPU** | Intel Core (Haswell, no TSX) — **6 vCPUs** |
| **RAM** | **11 Go** — 1 Go utilisé / 10 Go disponible (buff/cache inclus) |
| **Swap** | Non configuré |
| **Stockage** | **100 Go HDD** (rotatif, ROTA=1) — 19 Go utilisés (20%) |
| **OS** | Ubuntu 25.04 (Plucky Puffin) |
| **Noyau** | Linux 6.14.0-15-generic |
| **Runtime** | Docker — conteneur `mongodb-server` (mongo:latest) |
| **Port** | 27017 (accessible depuis le serveur applicatif via réseau interne LWS) |
| **Applications servies** | Xkorienta et Xkorin |
| **Uptime** | 229 jours (stable) |
| **Charge CPU** | ~0 % au repos |

### 3.3 Serveur Développement

| Paramètre | Valeur |
|-----------|--------|
| **Hébergeur** | LWS — France |
| **Architecture** | Identique au serveur de production applicatif |
| **RAM** | **8 Go** |
| **Stockage** | **200 Go SSD** |
| **MongoDB** | Conteneur Docker intégré au serveur (pas de serveur BD séparé) |
| **Usage** | Intégration continue, tests, staging |

---

## 4. Architecture de déploiement Docker

### 4.1 Vue des conteneurs

```plantuml
@startuml DOCKER_Containers
skinparam backgroundColor #FAFAFA
skinparam componentBorderColor #888888
skinparam packageBorderColor #AAAAAA
skinparam ArrowColor #555555
skinparam roundcorner 10

title Architecture Docker — Production (LWS)

node "Serveur Applicatif (Host Ubuntu 25.04 — LWS)" as Host {

  node "Docker Engine 28.5.0" as DockerEngine {

    package "Reseau Docker Interne\n(bridge network)" as DockerNet #EBF5FB {

      package "Application Xkorienta" as XkorientaStack #EAFAF1 {
        component "xkorienta-frontend\nnkot20/xkorienta-front:main\nPort host: 3000" as FrontNew #A9DFBF
        component "xkorienta-api\nnkot20/xkorienta-api:main\nPort host: 3001" as APINew #A9DFBF
      }

      package "Application Xkorin" as XkorinStack #FEF9E7 {
        component "xkorin-frontend-prod\nnkot20/xkorin-frontend-2.0.0:latest\nPort host: 8080" as FrontOld #A9DFBF
        component "xkorin-backend\nnkot20/xkorin-backend-2.0.0:main\nPort host: 4005" as BackOld #A9DFBF
        component "keycloak\nquay.io/keycloak:25.0.6\nPort: 8080 (interne)" as KC #A9DFBF
        database "keycloak-db\npostgres:16\nPort: 5432 (interne)" as PG #A9DFBF
      }

      package "Couche Reseau" as NetLayer #F4ECF7 {
        component "xkorin-nginx\nnginx:1.25-alpine\nPorts: 80, 443" as Nginx #A9DFBF
      }
    }
  }

  rectangle "Ports exposes vers Internet" as Ports #EAEDED {
    card ":80 HTTP" as P80
    card ":443 HTTPS" as P443
    card ":3000 Xkorienta Frontend" as P3000
    card ":3001 Xkorienta API" as P3001
    card ":8080 Xkorin UI" as P8080
    card ":4005 Xkorin API" as P4005
  }
}

node "Serveur BD Dedie (LWS — vps-5e2088d6)" as DBHost #FEF9E7 {
  node "Docker Engine" as DockerDB {
    database "mongodb-server\nmongo:latest\nPort: 27017" as MongoDB #E8DAEF
  }
}

Nginx --> FrontNew : proxy_pass :3000
Nginx --> APINew : proxy_pass :3001
Nginx --> FrontOld : proxy_pass :8080
Nginx --> BackOld : proxy_pass :4005
Nginx --> KC : proxy_pass (keycloak)
APINew --> MongoDB : Mongoose ODM\nTCP :27017 (reseau LWS)
BackOld --> MongoDB : TCP :27017\n(reseau LWS)
BackOld --> KC : OIDC
KC --> PG : JDBC :5432
FrontNew --> APINew : REST fetch()

P80 --> Nginx
P443 --> Nginx
P3000 --> FrontNew
P3001 --> APINew
P8080 --> FrontOld
P4005 --> BackOld

note bottom of MongoDB
  Serveur BD dedie (vps-5e2088d6)
  Accessible depuis le serveur applicatif
  via le reseau interne LWS.
  Sert Xkorienta et Xkorin.
end note

@enduml
```

### 4.2 Matrice des conteneurs

**Serveur applicatif (production) :**

| Conteneur | Application | Image | Port hôte | Port interne |
|-----------|------------|-------|-----------|--------------|
| `xkorienta-frontend` | Xkorienta | nkot20/xkorienta-front:main | 3000 | 3000 |
| `xkorienta-api` | Xkorienta | nkot20/xkorienta-api:main | 3001 | 3001 |
| `xkorin-nginx` | Les deux | nginx:1.25-alpine | 80, 443 | 80, 443 |
| `xkorin-frontend-prod` | Xkorin | nkot20/xkorin-frontend-2.0.0:latest | 8080 | 80 |
| `xkorin-backend` | Xkorin | nkot20/xkorin-backend-2.0.0:main | 4005 | 4005 |
| `keycloak` | Xkorin | quay.io/keycloak:25.0.6 | — (interne) | 8080 |
| `keycloak-db` | Xkorin | postgres:16 | — (interne) | 5432 |

**Serveur base de données dédié (`vps-5e2088d6`) :**

| Conteneur | Application | Image | Port hôte | Port interne |
|-----------|------------|-------|-----------|--------------|
| `mongodb-server` | Xkorienta + Xkorin | mongo:latest | 27017 | 27017 |

### 4.3 Architecture réseau — MongoDB sur serveur dédié

MongoDB est déployé sur un **serveur VPS séparé** (`vps-5e2088d6`). Le serveur applicatif communique avec le serveur de base de données via le réseau interne LWS.

```plantuml
@startuml DB_Isolation
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Architecture Reseau — MongoDB sur Serveur Dedie

package "Serveur Applicatif (LWS — 137.74.46.148)" as AppServer #EBF5FB {
  component "xkorienta-api\n:3001" as API
  component "xkorin-backend\n:4005" as XkorinAPI
  component "Nginx :443\n(point d'entree public)" as Nginx
}

package "Serveur BD Dedie (LWS — vps-5e2088d6)" as DBServer #FEF9E7 {
  database "mongodb-server\n:27017" as DB
}

Nginx --> API : proxy interne
Nginx --> XkorinAPI : proxy interne
API --> DB : Mongoose ODM\nTCP :27017 (reseau LWS interne)
XkorinAPI --> DB : TCP :27017\n(reseau LWS interne)

note right of DB
  Serveur dedie a la base de donnees
  MongoDB sert les deux applications :
  - Xkorienta (plateforme pedagogique)
  - Xkorin (application complementaire)
  Connexion via reseau interne LWS
end note

@enduml
```

---

## 5. Architecture réseau et flux de données

### 5.1 Flux réseau complet

```plantuml
@startuml NET_Flow
skinparam backgroundColor #FAFAFA
skinparam sequenceArrowThickness 2
skinparam roundcorner 10

title Flux Reseau — Requete utilisateur Cameroun vers Xkorienta

actor "Utilisateur\n(Cameroun)" as User
participant "Reseau Camtel\n(Cameroun)" as Camtel
participant "Backbone\nInternet" as Backbone
participant "LWS Network\n(France)" as LWS
participant "Nginx\n(TLS termination)" as Nginx
participant "xkorienta-frontend\n(:3000)" as FE
participant "xkorienta-api\n(:3001)" as API
database "MongoDB\n(:27017)" as DB

User -> Camtel : Requete DNS\n(resolution xkorienta.com)
Camtel -> Backbone : DNS query
Backbone -> Backbone : Resolution -> 137.74.46.148
Backbone --> User : IP resolue

User -> Camtel : HTTPS GET xkorienta.com
Camtel -> Backbone : Transit international\n(~150-200ms latence)
Backbone -> LWS : Routage vers LWS
LWS -> Nginx : TCP :443

Nginx -> Nginx : TLS handshake\n(Let's Encrypt cert)
Nginx -> Nginx : Dechiffrement TLS\nVerification Host header
Nginx -> FE : HTTP proxy_pass :3000\n(reseau Docker interne)
FE -> FE : Next.js SSR\ngetServerSession()
FE -> API : API call interne\n(NEXT_PUBLIC_API_URL)
API -> API : Middleware JWT\nwithRole() validation
API -> DB : Requete MongoDB\n(reseau Docker)
DB --> API : Documents JSON
API --> FE : Reponse JSON
FE --> Nginx : HTML/JSON rendu
Nginx --> User : Reponse HTTPS chiffree

note over Camtel, LWS
  Latence aller-retour estimee : 150-200 ms
  (Cameroun -> France via cables sous-marins SAT-3/WASC/SAFE)
end note

@enduml
```

### 5.2 Configuration Nginx — Routage par domaine

```plantuml
@startuml NGINX_Routing
skinparam backgroundColor #FAFAFA
skinparam componentBorderColor #888888
skinparam ArrowColor #555555
skinparam roundcorner 10

title Nginx — Routage par Virtual Host

rectangle "Nginx 1.25-alpine" as NginxBox #EBF5FB {

  package "xkorienta.com / gradeforcast.com" as XkorientaDomain #EAFAF1 {
    component "/ -> frontend\n(proxy_pass :3000)" as Route1
    component "/xkorienta/backend/api/ -> API\n(proxy_pass :3001/api/)" as Route2
    component "/xkorienta/backend/swagger -> API Swagger\n(proxy_pass :3001/swagger)" as Route3
    component "/xkorienta/backend/_next/ -> Assets Next.js\n(cache immutable 1 an)" as Route4
  }

  package "xkorin.com — Application Xkorin" as XkorinDomain #FEF9E7 {
    component "/ -> xkorin-frontend\n(proxy_pass :8080)" as LRoute1
    component "/xkorin/backend/api/v2/ -> xkorin-backend\n(proxy_pass :4005)" as LRoute2
    component "/keycloak/auth/ -> Keycloak\n(proxy_pass keycloak:8080)" as LRoute3
    component "/socket.io/ -> WebSocket\n(upgrade connection)" as LRoute4
  }

  package "Securite globale" as Security #F4ECF7 {
    component "HTTP -> HTTPS redirect\n(return 301)" as SEC1
    component "Catch-all : reject unknown hosts\n(return 444)" as SEC2
    component "TLS 1.2 / 1.3\n(ssl_protocols)" as SEC3
    component "gzip compression\n(text, json, js, css, svg)" as GZIP
    component "Headers de securite\n(HSTS, X-Frame, nosniff, CSP)" as HDRS
  }
}

Internet --> NginxBox : HTTPS :443 / HTTP :80
NginxBox --> Route1
NginxBox --> LRoute1

note bottom of Security
  server_tokens off (version cachee)
  client_max_body_size 150m (uploads API)
  gzip active sur tous les types MIME
end note

@enduml
```

---

## 6. Architecture applicative

### 6.1 Stack technique complète

```plantuml
@startuml TECH_Stack
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10
skinparam componentBorderColor #888888

title Stack Technique — Xkorienta

package "Couche Presentation (Frontend)" as Frontend #EBF5FB {
  component "Next.js 16\n(App Router, SSR/SSG)" as NextFE
  component "Tailwind CSS v4\n(UI styling)" as Tailwind
  component "shadcn/ui + Radix\n(composants)" as ShadCN
  component "Framer Motion\n(animations)" as Framer
  component "Recharts\n(graphiques analytics)" as Charts
  component "pusher-js\n(WebSocket client)" as PusherClient
  component "NextAuth v4\n(sessions JWT)" as NextAuth
  component "next-intl\n(FR / EN)" as Intl
}

package "Couche API (Backend)" as Backend #EAFAF1 {
  component "Next.js 16\n(API Routes / Route Handlers)" as NextAPI
  component "Mongoose ODM\n(MongoDB)" as Mongoose
  component "Zod\n(validation des entrees)" as Zod
  component "mongoose-sanitize\n(NoSQL injection)" as Sanitize
  component "bcrypt (salt=12)\n(hachage MDP)" as Bcrypt
  component "Pusher SDK\n(publish events)" as PusherSDK
  component "Nodemailer\n(SMTP Outlook)" as Nodemailer
  component "HuggingFace.js\n(generation IA)" as HFClient
}

package "Couche Donnees" as Data #FEF9E7 {
  database "MongoDB\n(Docker container)" as Mongo
  component "Indexes composes\n(performances requetes)" as Indexes
  component "Mongoose Schemas\n(validation + hooks)" as Schemas
}

package "Couche Middleware" as Middleware #F4ECF7 {
  component "withRole()\n(controle d'acces JWT)" as WithRole
  component "rateLimiter\n(protection brute force)" as RateLimit
  component "sanitize()\n(assainissement entrees)" as San
  component "Helmet.js\n(headers HTTP)" as Helmet
}

Frontend --> Backend : HTTPS REST\n(NEXT_PUBLIC_API_URL)
Backend --> Data : Mongoose ODM
Middleware -up-> Backend : intercepte toutes les routes

@enduml
```

### 6.2 Architecture en couches — Backend

```plantuml
@startuml LAYERS_Backend
skinparam backgroundColor #FAFAFA
skinparam packageBorderColor #888888
skinparam ArrowColor #555555
skinparam roundcorner 10

title Architecture en Couches — Backend Xkorienta

package "Layer 1 — HTTP (Route Handlers)" as L1 #EBF5FB {
  component "Route Handler\nsrc/app/api/**\n(extraction req, appel service, reponse)" as RH
}

package "Layer 2 — Middleware" as L2 #F4ECF7 {
  component "withRole() — JWT + role\nrateLimiter — anti brute force\nsanitize() — NoSQL injection\nHelmet — headers securite" as MW
}

package "Layer 3 — Services (Logique metier)" as L3 #EAFAF1 {
  component "ExamServiceV4 · AttemptService\nAuthService · ClassService\nSchoolService · GamificationService\nNotificationService · ForumService" as SVC
}

package "Layer 4 — Repositories (Acces donnees)" as L4 #FEF9E7 {
  component "ExamRepository · AttemptRepository\nUserRepository · ClassRepository\nSchoolRepository · ForumRepository" as REPO
}

package "Layer 5 — Modeles Mongoose" as L5 #F9EBEA {
  component "User · Exam · Attempt · Class\nSchool · Question · LearnerProfile\nForum · Notification · LateCode" as MODELS
}

database "MongoDB (Docker)" as DB #E8DAEF

L2 --> L1 : middleware chain
L1 --> L3 : appel service
L3 --> L4 : appel repository
L4 --> L5 : modeles Mongoose
L5 --> DB : CRUD MongoDB

@enduml
```

---

## 7. Base de données

### 7.1 Déploiement MongoDB

MongoDB est déployé en tant que **conteneur Docker** (`mongodb-server`) sur un **serveur VPS dédié** (`vps-5e2088d6`), distinct du serveur applicatif. Ce serveur héberge la base de données partagée par les deux applications (Xkorienta et Xkorin). Le serveur applicatif y accède via le réseau interne LWS sur le port 27017.

**Spécifications du serveur MongoDB dédié (relevées en production) :**

| Paramètre | Valeur |
|-----------|--------|
| Hostname | vps-5e2088d6 |
| CPU | 6 vCPUs Intel Haswell |
| RAM | 11 GiB (1 GiB utilisé, 10 GiB disponible) |
| Disque | 100 Go HDD (ROTA=1) — 19 Go utilisés |
| Swap | Non configuré |
| Uptime | 229 jours |
| Image Docker | mongo:latest |
| Conteneur | mongodb-server |
| Port | 27017 |
| Applications servies | Xkorienta + Xkorin |

```plantuml
@startuml DB_Deploy
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Deploiement MongoDB — Configuration Production (Mai 2026)

package "Serveur Applicatif LWS\n(137.74.46.148)" as AppServer #EBF5FB {
  component "xkorienta-api\n(:3001)" as API
  component "xkorin-backend\n(:4005)" as XkorinAPI
}

package "Serveur BD Dedie LWS\n(vps-5e2088d6)" as DBServer #FEF9E7 {

  package "Docker Engine" as DockerDB #EAFAF1 {
    database "mongodb-server\nmongo:latest\nPort: 27017" as MongoDB #E8DAEF
  }

  component "Collections : users, exams,\nattempts, classes, schools,\nforums, notifications, latecodes" as Collections

  component "Index : email (unique, sparse)\nphone (unique, sparse)\nclassId, status, createdBy\nexamId + studentId\nschoolId, isActive" as Indexes
}

API --> MongoDB : Mongoose ODM\nTCP :27017 (reseau LWS interne)
XkorinAPI --> MongoDB : TCP :27017\n(reseau LWS interne)

note right of MongoDB
  DATABASE_URL (variable d'env)
  Connection pooling active
  Indexes crees au demarrage
  Sert Xkorienta et Xkorin
end note

@enduml
```

### 7.2 Modèle de données — Entités principales

| Collection | Rôle | Cardinalité clé |
|------------|------|-----------------|
| `users` | Tous les comptes (étudiant, enseignant, admin) | N |
| `learnerprofiles` | Profil gamification et progression | 1:1 avec users |
| `schools` | Établissements scolaires | N |
| `classes` | Classes dans une école | N:1 avec schools |
| `exams` | Examens créés par les enseignants | N:1 avec classes |
| `questions` | Questions d'un examen | N:1 avec exams |
| `attempts` | Tentatives de passage d'examen | N:1 avec exams, N:1 avec users |
| `forums` | Forums de classe | N:1 avec classes |
| `notifications` | Notifications utilisateur | N:1 avec users |
| `latecodes` | Codes d'accès retardataire | N:1 avec exams |

---

## 8. Services externes

### 8.1 Carte des intégrations

```plantuml
@startuml EXT_Services
skinparam backgroundColor #FAFAFA
skinparam componentBorderColor #888888
skinparam ArrowColor #555555
skinparam roundcorner 10

title Integrations — Services Externes

component "xkorienta-api\n(Backend)" as API #A9DFBF
component "xkorienta-frontend\n(Frontend)" as FE #AED6F1
component "Utilisateur\n(Browser)" as User

cloud "Services Tiers" {

  package "Temps reel" #EBF5FB {
    component "Pusher Channels\nPlan : Spark (gratuit)\n100 connexions max\n200k messages/jour" as Pusher #F9E79F
  }

  package "Authentification" #EAFAF1 {
    component "Google OAuth 2.0\n(connexion compte Google)" as Google #EA4335
    component "NextAuth v4\n(JWT sessions 30j)" as NextAuth #4285F4
  }

  package "Email" #FEF9E7 {
    component "Outlook SMTP\nsmtp.office365.com:587\nSTARTTLS\n(emails transactionnels)" as Outlook #0078D4
  }

  package "Intelligence Artificielle" #F4ECF7 {
    component "HuggingFace Inference API\nPlan : Gratuit\n(generation de questions)" as HF #FFD600
  }

  package "Certificats SSL" #F9EBEA {
    component "Let's Encrypt\n(renouvellement auto 90j)\nCertbot" as LE #003A70
  }
}

API --> Pusher : HTTPS — publication evenements\n(exam.start, answer, submit)
User --> Pusher : WSS :443 — WebSocket\n(surveillance temps reel)
FE --> Google : OAuth flow
API --> Google : Verification id_token
API --> Outlook : STARTTLS :587\n(reset MDP, notifications)
API --> HF : HTTPS — inference IA\n(generation questions)
API --> LE : Renouvellement cert\nacme-challenge

note bottom of Pusher
  POINT D'EVOLUTION pour 100 000 utilisateurs :
  Plan actuel = 100 connexions WebSocket simultanees
  Upgrade recommande : Pusher Pro ($49/mois)
  10 000 connexions simultanees
end note

@enduml
```

### 8.2 Tableau des services externes

| Service | Protocole | Port | Plan actuel | Limite actuelle | Plan cible (100k users) |
|---------|-----------|------|-------------|-----------------|------------------------|
| **Pusher Channels** | WSS / HTTPS | 443 | Spark (gratuit) | **100 connexions** | Pro ($49/mois) = 10 000 |
| **Google OAuth** | HTTPS | 443 | Gratuit | 1M req/jour | — |
| **Outlook SMTP** | STARTTLS | 587 | Outlook.com | 300 mails/jour | Microsoft 365 Business |
| **HuggingFace** | HTTPS | 443 | Gratuit | 30K tokens/mois | Pro ($9/mois) |
| **Let's Encrypt** | HTTPS/ACME | 443 | Gratuit | ∞ | — |

---

## 9. Sécurité de l'infrastructure

### 9.1 Matrice de sécurité

```plantuml
@startuml SEC_Matrix
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Couches de Securite — Xkorienta

rectangle "Niveau 1 — Reseau" as L1 #EBF5FB {
  card "TLS 1.2/1.3\n(chiffrement transport)" as TLS
  card "HTTPS force\n(HTTP -> 301 redirect)" as HTTPS
  card "Rejection hotes inconnus\n(return 444 catch-all)" as Reject
  card "MongoDB sur serveur dedie\n(reseau interne LWS)" as MongoNet
}

rectangle "Niveau 2 — Application Nginx" as L2 #EAFAF1 {
  card "HSTS\n(max-age=31536000)" as HSTS
  card "X-Frame-Options: SAMEORIGIN\n(anti clickjacking)" as XFO
  card "X-Content-Type-Options: nosniff\n(anti MIME sniffing)" as XCTO
  card "Referrer-Policy\n(strict-origin-when-cross-origin)" as RP
  card "server_tokens off\n(version cachee)" as ST
  card "Permissions-Policy\n(desactive camera, micro, geoloc)" as PP
}

rectangle "Niveau 3 — API Backend" as L3 #FEF9E7 {
  card "JWT (NEXTAUTH_SECRET)\n(sessions stateless 30j)" as JWT
  card "bcrypt salt=12\n(hachage MDP)" as BCRYPT
  card "withRole() middleware\n(controle acces par role)" as ROLE
  card "rateLimiter\n(anti brute force login)" as RL
  card "Zod + mongoose-sanitize\n(validation + NoSQL injection)" as VAL
  card "sanitize-html\n(protection XSS)" as XSS
}

rectangle "Niveau 4 — Donnees" as L4 #F4ECF7 {
  card "SELECT explicite\n(.select() — jamais *)" as SEL
  card "Requetes parametrees\n(Mongoose — jamais interpolation)" as PARAM
  card "Pas de donnees sensibles\ndans les reponses API" as NODUMP
  card "Pas de stack trace\nen production" as NOSTACK
}

@enduml
```

### 9.2 Flux d'authentification

```plantuml
@startuml SEC_AuthFlow
skinparam backgroundColor #FAFAFA
skinparam sequenceArrowThickness 2
skinparam roundcorner 10

title Flux d'Authentification — JWT via NextAuth

actor "Utilisateur" as U
participant "Frontend\n(Next.js)" as FE
participant "NextAuth v4" as NA
participant "API Backend\n(:3001)" as API
database "MongoDB" as DB

U -> FE : POST /api/auth/signin\n(email + mot de passe)
FE -> NA : signIn("credentials", credentials)
NA -> API : POST /api/auth/verify\n{ identifier, password }
API -> DB : User.findOne({ email | phone })
DB --> API : document utilisateur
API -> API : bcrypt.compare(password, hash)
alt Authentification reussie
  API --> NA : { id, name, email, role, schoolId }
  NA -> NA : Genere JWT signe\n(NEXTAUTH_SECRET)\nExpiration : 30 jours
  NA --> FE : Session cookie\n(httpOnly, secure, sameSite)
  FE --> U : Redirection dashboard\n(selon role)
else Echec
  API --> NA : null
  NA --> FE : Erreur 401
  FE --> U : "Identifiants invalides"
end

note over NA
  Token JWT contient :
  id, name, email, role, schoolId
  image EXCLUE (evite cookie overflow)
end note

@enduml
```

---

## 10. Analyse de charge et capacité

### 10.1 Objectif de charge

| Métrique | Valeur cible |
|----------|--------------|
| Utilisateurs totaux | **100 000** |
| Utilisateurs simultanés (pic examens) | **5 000 – 10 000** |
| Requêtes API par utilisateur actif (exam) | **~10 req/min** |
| Débit pic | **~1 000 – 1 500 req/sec** |
| Durée pic de charge | **2h** (matin 8h–10h) |
| Disponibilité cible | **≥ 99,5 %** |

### 10.2 Capacité du serveur actuel

```plantuml
@startuml LOAD_Capacity
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Analyse de Capacite — Serveur Production (LWS)

rectangle "Ressources disponibles" as Resources #EBF5FB {

  rectangle "CPU — 8 vCPUs (Serveur Applicatif)" as CPU_Block {
    card "Node.js xkorienta-api\n1-2 vCPUs en charge normale\n4-5 vCPUs en pic d'examens" as CPU1
    card "Node.js xkorienta-frontend\n1 vCPU" as CPU2
    card "Nginx\n<0.5 vCPU" as CPU4
    card "Stack Xkorin\n1-2 vCPUs" as CPU3
    card "Marge libre\n~2-4 vCPUs" as CPU5
  }

  rectangle "RAM — 22 Go (Serveur Applicatif)" as RAM_Block {
    card "OS + Docker engine\n~1 Go" as RAM1
    card "Nginx\n~100 Mo" as RAM2
    card "xkorienta-api (Node.js)\n~512 Mo - 2 Go" as RAM3
    card "xkorienta-frontend (Node.js)\n~512 Mo - 1 Go" as RAM4
    card "Stack Xkorin (keycloak, backend, frontend)\n~2 Go" as RAM6
    card "Marge libre\n~16 - 18 Go" as RAM7
  }

  rectangle "Serveur BD Dedie — 6 vCPUs / 11 Go RAM" as DB_Block {
    card "MongoDB\n1-2 vCPUs / 2-4 Go RAM\n(donnees + index)" as DBRes
    card "Marge libre\n~4 vCPUs / ~7 Go RAM" as DBMargin
  }
}

rectangle "Capacite de traitement estimee" as Capacity #EAFAF1 {
  card "Node.js API (8 vCPUs)\n500 - 1 500 req/sec\n(avec replicas Docker)" as ReqSec
  card "MongoDB\n10 000 - 20 000 ops/sec\n(lecture avec index)" as DBOps
  card "Connexions WebSocket (Pusher)\n100 max (plan Spark)\nUpgrade requis avant mise en prod a grande echelle" as WS
  card "Bande passante LWS\n1 Gbit/s (uplink datacenter)" as BW
}

@enduml
```

### 10.3 Modélisation des scénarios de charge

```plantuml
@startuml LOAD_Scenarios
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Scenarios de Charge — Periode d'Examens

rectangle "Scenario 1 — Charge normale\n(hors periode examens)" as S1 #A9DFBF {
  card "500 - 1 000 utilisateurs actifs\n50 - 100 requetes/sec\nRAM utilisee : ~6 Go\nCPU utilise : ~20-30%\nServeur actuel suffisant" as S1Detail
}

rectangle "Scenario 2 — Pic modere\n(quelques examens simultanees)" as S2 #F9E79F {
  card "2 000 - 3 000 utilisateurs simultanes\n300 - 500 requetes/sec\nRAM utilisee : ~10 Go\nCPU utilise : ~50-60%\nServeur actuel suffisant\nUpgrade Pusher recommande" as S2Detail
}

rectangle "Scenario 3 — Charge maximale\n(100 etablissements — examens simultanes)" as S3 #F1948A {
  card "5 000 - 10 000 utilisateurs simultanes\n800 - 1 500 requetes/sec\nRAM utilisee : ~16 - 18 Go\nCPU utilise : ~80-100%\nMarge CPU faible\nUpgrade Pusher indispensable\nUpgrade serveur recommande" as S3Detail
}

S1 -[hidden]-> S2
S2 -[hidden]-> S3

@enduml
```

### 10.4 Répartition mémoire estimée en charge maximale

**Serveur applicatif (22 Go RAM) :**

| Composant | RAM estimée (charge max) |
|-----------|--------------------------|
| OS Ubuntu + noyau | 1,0 Go |
| Docker Engine | 0,5 Go |
| Nginx | 0,1 Go |
| xkorienta-api (Node.js) | 2,0 – 4,0 Go |
| xkorienta-frontend (Node.js) | 1,0 – 2,0 Go |
| Stack Xkorin (keycloak, backend, frontend) | 2,0 Go |
| **Total estimé** | **~7 – 10 Go** |
| **Marge disponible** | **~12 – 15 Go** |

**Serveur base de données dédié (11 Go RAM) :**

| Composant | RAM estimée (charge max) |
|-----------|--------------------------|
| OS Ubuntu + noyau | 0,5 Go |
| Docker Engine | 0,3 Go |
| MongoDB (données + cache + index) | 4,0 – 6,0 Go |
| **Total estimé** | **~5 – 7 Go** |
| **Marge disponible** | **~4 – 6 Go** |

---

## 11. Estimation des besoins en bande passante

### 11.1 Modèle de trafic par utilisateur

| Action | Volume de données | Fréquence |
|--------|------------------|-----------|
| Chargement page (1ère visite) | 500 Ko – 1 Mo | 1 fois (puis cache) |
| Requête API (exam question) | 5 – 20 Ko | ~10/min par étudiant |
| Soumission d'une réponse | 1 – 3 Ko | ~10/min par étudiant |
| Événement Pusher (temps réel) | < 1 Ko | ~2–5/min |
| Upload fichier (avatar, doc) | 0 – 5 Mo | Occasionnel |

### 11.2 Calcul de bande passante

```plantuml
@startuml BW_Calc
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Estimation Bande Passante — Scenarios

rectangle "Charge normale\n1 000 utilisateurs actifs" as BW1 #A9DFBF {
  card "API calls : 1000 x 10 req/min x 10 Ko\n= 100 Mo/min = 1,7 Mo/s\n= ~14 Mbit/s\n\nTres confortable" as BW1D
}

rectangle "Pic examens\n5 000 utilisateurs simultanes" as BW2 #F9E79F {
  card "API calls : 5000 x 10 req/min x 10 Ko\n= 500 Mo/min = 8,3 Mo/s\n= ~66 Mbit/s\n\nAssets statiques (caches) : negligeable\nWebSocket Pusher : ~5 Mo/min\n\nLWS 1 Gbit/s — confortable" as BW2D
}

rectangle "Charge maximale\n10 000 utilisateurs simultanes" as BW3 #F1948A {
  card "API calls : 10000 x 10 req/min x 10 Ko\n= 1 000 Mo/min = 16,7 Mo/s\n= ~133 Mbit/s\n\n+ assets, WebSocket, uploads\n= ~200 - 300 Mbit/s total estime\n\nLWS 1 Gbit/s — suffisant\nBande passante Camtel necessaire :\nminimum 500 Mbit/s dedies" as BW3D
}

BW1 -[hidden]-> BW2
BW2 -[hidden]-> BW3

@enduml
```

### 11.3 Latence réseau Cameroun → France

| Segment réseau | Latence estimée |
|----------------|----------------|
| Utilisateur → Réseau Camtel | < 5 ms |
| Réseau Cameroun → Backbone international | 20 – 50 ms |
| Backbone → LWS France (câbles sous-marins) | 80 – 150 ms |
| **Latence totale aller-retour (RTT)** | **~150 – 200 ms** |

> **Note Camtel :** La présence d'un point de cache CDN ou d'un serveur miroir au Cameroun réduirait la latence à **< 20 ms** pour les ressources statiques (pages, JS, CSS), améliorant significativement l'expérience utilisateur locale.

---

## 12. Points d'évolution et plan de croissance

### 12.1 Points d'évolution identifiés

```plantuml
@startuml RISKS
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Points d'Evolution Infrastructure

rectangle "PRIORITAIRE" as Crit #F9E79F {
  card "E1 — Pusher Spark : 100 connexions WebSocket max\nEtat : Plan gratuit limite a 100 connexions simultanees\nEvolution : Upgrade Pusher Pro ($49/mois)\n10 000 connexions simultanees" as E1
}

rectangle "COURT TERME" as High #AED6F1 {
  card "E2 — SWAP non configure\nEtat : Pas de swap sur les serveurs de production\nEvolution : Configurer 4 Go de swap (zram ou fichier)" as E2
  card "E3 — Stockage HDD (rotatif) en PROD\nEtat : Disques rotatifs sur serveur applicatif et BD\nEvolution : Migration vers SSD NVMe" as E3
  card "E4 — Serveur PROD unique (pas de failover)\nEtat : Pas de redondance applicative\nEvolution : Replication ou failover secondaire" as E4
}

rectangle "MOYEN TERME" as Med #A9DFBF {
  card "E5 — Outlook SMTP : 300 emails/jour max\nEtat : Limite de 300 emails quotidiens\nEvolution : Migration vers SendGrid / Mailgun" as E5
  card "E6 — Pas de monitoring actif\nEtat : Pas de supervision ni d'alertes automatisees\nEvolution : UptimeRobot (gratuit) ou Grafana" as E6
  card "E7 — 2 applications sur 1 serveur (Xkorin + Xkorienta)\nEtat : Ressources partagees entre les deux applications\nEvolution : Serveur dedie par application" as E7
}

@enduml
```

### 12.2 Plan d'évolution pour 100 000 utilisateurs

```plantuml
@startuml EVOLUTION_Plan
skinparam backgroundColor #FAFAFA
skinparam ArrowColor #555555
skinparam roundcorner 10

title Plan d'Evolution Infrastructure — Vers 100 000 Utilisateurs

rectangle "Phase 1 — Immédiat (< 1 mois)\nBudget : ~$100/mois" as P1 #A9DFBF {
  card "Configurer SWAP (4 Go)\nUpgrade Pusher Pro ($49/mois)\nMettre en place UptimeRobot\nConfigurer backups MongoDB quotidiens" as P1D
}

rectangle "Phase 2 — Court terme (1-3 mois)\nBudget : ~$200-400/mois" as P2 #F9E79F {
  card "Migrer MongoDB vers SSD dedie\nConfigurer replication MongoDB\nOutlook -> Mailgun/SendGrid\nActiver CDN (Cloudflare gratuit)\nMettre en place CI/CD (GitHub Actions)" as P2D
}

rectangle "Phase 3 — Moyen terme (3-6 mois)\nBudget : ~$500-1000/mois" as P3 #F1948A {
  card "Serveur secondaire (failover)\nLoad balancer (HAProxy)\nScale horizontal API (2+ instances)\nNoeud CDN Cameroun (partenariat Camtel)\nMigration vers SSD NVMe\nMonitoring complet (Grafana + Prometheus)" as P3D
}

P1 --> P2 : apres stabilisation
P2 --> P3 : apres croissance confirmee

@enduml
```

---

## 13. Recommandations pour le partenariat Camtel

### 13.1 Besoins identifiés côté Camtel

```plantuml
@startuml CAMTEL_Reco
skinparam backgroundColor #FAFAFA
skinparam roundcorner 10

title Opportunites de Partenariat — Xkorienta x Camtel

rectangle "Xkorienta (Infrastructure actuelle)" as Xkorienta #EBF5FB {
  card "Serveur : France (LWS)\nLatence Cameroun : 150-200ms\nBande passante : 1 Gbit/s (LWS)\nSSL : Let's Encrypt\nDocker + Nginx" as XkDetail
}

rectangle "Apports potentiels Camtel" as Camtel #EAFAF1 {

  package "Option A — CDN Cameroun" as OptA #A9DFBF {
    card "Point de presence (PoP) Douala/Yaounde\nCache des ressources statiques (JS, CSS, images)\nLatence reduite a <20ms pour ressources cachees\nCout reseau reduit (moins de trafic international)" as OptAD
  }

  package "Option B — Hebergement Cameroun" as OptB #F9E79F {
    card "Serveur miroir dans datacenter Camtel\nLatence totale <5ms (reseau local)\nSouverainete des donnees au Cameroun\nResilience (2 datacenter actifs)" as OptBD
  }

  package "Option C — Bande passante dédiée" as OptC #AED6F1 {
    card "Lien dedie Xkorienta - Camtel\nBande passante garantie : 500 Mbit/s\nSLA de disponibilite (99,9%)\nQoS pour trafic pedagogique" as OptCD
  }
}

Xkorienta --> Camtel : Bande passante\nconsommee

note bottom of Camtel
  Bande passante requise selon les scenarios :
  1 000 utilisateurs simultanes : ~14 Mbit/s
  5 000 utilisateurs simultanes : ~66 Mbit/s
  10 000 utilisateurs simultanes : ~200-300 Mbit/s
end note

@enduml
```

### 13.2 Synthèse technique pour Camtel

| Critère | État actuel | Cible (100k users) |
|---------|------------|-------------------|
| **Serveur** | 1 VPS LWS 8 vCPUs / 22 Go RAM | 2 VPS (prod + failover) ou dédié |
| **Bande passante** | 1 Gbit/s (LWS datacenter) | **≥ 500 Mbit/s côté Cameroun** |
| **Latence Cameroun** | 150 – 200 ms | < 20 ms (avec CDN local Camtel) |
| **WebSocket** | 100 connexions max (Pusher Spark) | 10 000 connexions (Pusher Pro) |
| **Base de données** | MongoDB sur serveur dédié — 6 vCPUs, 11 Go RAM, HDD — sert Xkorienta + Xkorin | MongoDB SSD + réplication |
| **Disponibilité** | ~98 % estimé | ≥ 99,5 % avec SLA Camtel |
| **SSL** | Let's Encrypt (gratuit) | Maintenu |
| **Monitoring** | Aucun | Grafana + alertes Camtel |

### 13.3 Architecture cible avec partenariat Camtel

```plantuml
@startuml TARGET_Arch
skinparam backgroundColor #FAFAFA
skinparam nodeBorderColor #555555
skinparam componentBorderColor #888888
skinparam ArrowColor #444444
skinparam roundcorner 10

title Architecture Cible — Xkorienta x Camtel

cloud "Utilisateurs Cameroun\n(Mobile + Desktop)" as Users #ABEBC6

node "Infrastructure Camtel\n(Cameroun)" as CamtelInfra #A9DFBF {
  component "CDN / Cache Node\n(ressources statiques\nJS, CSS, images)" as CDN
  component "Load Balancer\nCamtel" as LB
  component "Lien dedie\n>= 500 Mbit/s" as Link
}

node "Serveur PROD Principal\n(LWS France)" as ProdFR #EBF5FB {
  component "Nginx + App\n(xkorienta-frontend + api)" as AppFR
  database "MongoDB (SSD)" as DBFR
}

node "Serveur PROD Secondaire\n(Failover — LWS ou Camtel DC)" as ProdSecondary #D6EAF8 {
  component "Nginx + App\n(replique)" as AppSec
  database "MongoDB Replica\n(secondaire)" as DBSec
}

cloud "Services Tiers" as Ext {
  component "Pusher Pro\n(10 000 connexions)" as PusherPro
  component "Outlook / Mailgun\n(SMTP)" as SMTPNew
}

Users --> CDN : HTTPS (assets caches\n< 20ms)
Users --> LB : HTTPS (requetes API)
LB --> Link
Link --> ProdFR
ProdFR --> ProdSecondary : Replication MongoDB\n(async)
AppFR --> PusherPro
AppFR --> SMTPNew
Users --> PusherPro : WSS (temps reel)

note right of CamtelInfra
  Apport Camtel :
  CDN local -> latence -90%
  Lien dedie -> qualite garantie
  Load Balancer -> haute dispo
  SLA 99,9%
end note

@enduml
```

---

## Annexe A — Checklist d'évolutions planifiées

| Priorité | Action | Responsable | Coût mensuel |
|----------|--------|-------------|--------------|
| 🔴 Prioritaire | Configurer SWAP (4 Go) sur le **serveur BD dédié** (`vps-5e2088d6`) | DevOps | 0 |
| 🔴 Prioritaire | Configurer SWAP (4 Go) sur le **serveur PROD applicatif** | DevOps | 0 |
| 🔴 Prioritaire | Upgrade Pusher → Pro ou équivalent | Tech | $49/mois |
| 🟠 Court terme | Mettre en place UptimeRobot (monitoring) | DevOps | 0 (gratuit) |
| 🟠 Court terme | Configurer backups MongoDB automatiques | DevOps | ~$5/mois (stockage) |
| 🟠 Court terme | Migrer SMTP vers Mailgun ou SendGrid | Tech | $0-15/mois |
| 🟡 Moyen terme | Activer Cloudflare CDN (plan gratuit) | DevOps | 0 |
| 🟡 Moyen terme | Migrer disque BD de HDD vers SSD (serveur dédié) | Infra | Upgrade LWS |
| 🟡 Moyen terme | Mettre en place second serveur (failover) | Infra | ~$30-80/mois |

---

## Annexe B — Commandes de diagnostic rapide

```bash
# Etat des conteneurs
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Consommation RAM par conteneur
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"

# Espace disque
df -h /

# Charge systeme
uptime && free -h
```

---

*Document rédigé pour présentation à Camtel (Cameroon Telecommunications)*
*Xkorienta — Plateforme d'évaluation et d'orientation scolaire — Mai 2026*
*Version 1.0 — Confidentiel*
