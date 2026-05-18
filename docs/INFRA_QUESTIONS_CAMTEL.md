# Collecte d'informations — Document Infrastructure Camtel

> **Statut :** Partiellement complété — PROD collecté, DEV manquant
> **Objectif :** Rédiger le document technique d'infrastructure pour présentation à Camtel
> **Dernière mise à jour :** 2026-05-15

---

## ✅ SERVEUR PRODUCTION — Données collectées

> Hébergeur réel : **OVH SAS** (AS16276) — Datacenter Dunkerque, France
> ⚠️ Note : initialement mentionné comme LWS — à clarifier pour le document Camtel

| Champ | Valeur |
|-------|--------|
| **Hébergeur** | OVH SAS (AS16276) |
| **Type** | VPS (KVM / OpenStack Nova) |
| **Hostname** | vps-95ff4ce6.vps.ovh.net |
| **CPU** | Intel Core (Haswell, no TSX) — **8 vCPUs** |
| **RAM totale** | **22 Go** |
| **RAM utilisée** | 2.3 Go (10%) — 20 Go disponible |
| **Swap** | ⚠️ **0 — AUCUN SWAP configuré** |
| **Stockage** | **200 Go HDD** (ROTA=1 → disque rotatif, pas SSD) |
| **Espace utilisé** | 13 Go / 193 Go (7%) |
| **OS** | Ubuntu 25.04 (Plucky Puffin) |
| **Noyau** | Linux 6.14.0-15-generic |
| **Virtualisation** | KVM |
| **IP publique** | 137.74.46.148 |
| **Datacenter** | Dunkerque, Hauts-de-France, FR |
| **Docker** | ✅ Docker 28.5.0 (sans docker-compose) |
| **Nginx** | ✅ nginx:1.25-alpine (via Docker) |
| **PM2** | ❌ Non utilisé — Docker gère les processus |
| **MongoDB local** | ❌ Non installé → **MongoDB Atlas (externe)** |
| **SSL** | ✅ Let's Encrypt (TLS 1.2 / 1.3) |

### Domaines configurés (SSL actif)

| Domaine | Application |
|---------|-------------|
| **xkorienta.com** / www | Frontend Xkorienta (port 3000) + API (port 3001) |
| **gradeforcast.com** / www | Frontend Xkorienta (port 3000) + API (port 3001) |
| **xkorin.com** / www | Ancienne plateforme (xkorin-backend:4005 + Keycloak) |

### Conteneurs Docker actifs

| Conteneur | Image | Port | Statut | Durée |
|-----------|-------|------|--------|-------|
| `xkorienta-api` | nkot20/xkorienta-api:main | 3001 | ✅ healthy | 2 jours |
| `xkorienta-frontend` | nkot20/xkorienta-front:main | 3000 | ❌ **UNHEALTHY** | 3 jours |
| `xkorin-nginx` | nginx:1.25-alpine | 80, 443 | ✅ Up | 2 jours |
| `keycloak` | keycloak:25.0.6 | 8080, 8443 | ✅ Up | 3 semaines |
| `keycloak-db` | postgres:16 | 5432 | ✅ healthy | 3 semaines |
| `xkorin-backend` | nkot20/xkorin-backend-2.0.0:main | 4005 | ❌ **UNHEALTHY** | 3 semaines |
| `xkorin-frontend-prod` | nkot20/xkorin-frontend-2.0.0:latest | 8080 | ✅ Up | 7 semaines |

### Ports ouverts (PROD)
`80` (HTTP) · `443` (HTTPS) · `3000` (frontend) · `3001` (API) · `8080` (ancienne UI)

---

## ⚠️ ALERTES CRITIQUES DÉTECTÉES

| # | Sévérité | Problème | Impact |
|---|----------|----------|--------|
| 1 | 🔴 **CRITIQUE** | `xkorienta-frontend` container **UNHEALTHY** en production | L'application frontend est instable |
| 2 | 🔴 **CRITIQUE** | Pusher **plan gratuit (Spark) = 100 connexions WebSocket simultanées MAX** | Incompatible avec 100 000 utilisateurs — **bloquant pour Camtel** |
| 3 | 🟠 **HAUTE** | **Aucun swap** configuré (0B) | OOM (Out of Memory) possible en pic de charge |
| 4 | 🟠 **HAUTE** | Stockage **HDD** (non SSD, ROTA=1) | I/O lent, latences élevées sous charge |
| 5 | 🟡 **MOYENNE** | Serveur partagé entre 2 plateformes (xkorin + xkorienta) | Contention de ressources en pic |
| 6 | 🟡 **MOYENNE** | `xkorin-backend` **UNHEALTHY** depuis 3 semaines | Ancienne plateforme dégradée |
| 7 | 🟡 **MOYENNE** | Aucun monitoring en place | Aucune alerte en cas d'incident |

---

## ❓ INFORMATIONS ENCORE MANQUANTES

### Serveur DEV — À collecter
> Lancer les mêmes commandes sur le serveur DEV

| Champ | Valeur |
|-------|--------|
| Hébergeur | ? |
| Type (VPS / Dédié) | ? |
| CPU | ? |
| RAM | ? |
| Stockage | ? |
| OS | ? |
| IP publique | ? |
| Domaine DEV | ? |

### Questions métier — À répondre manuellement

**Charge attendue**
- [ ] Nombre d'établissements prévus : ___
- [ ] Nombre total d'utilisateurs (objectif) : **> 100 000** ✅ confirmé
- [ ] Nombre d'examens simultanés en pic : ___
- [ ] Nombre d'utilisateurs **simultanés** en pic (ex: 5 000 ? 10 000 ?) : ___
- [ ] Plages horaires critiques (ex: 8h-12h période d'examens) : ___

**Services externes**
- [ ] Plan Pusher : **Gratuit (Spark)** ✅ confirmé — ⚠️ limite 100 connexions, à documenter comme point d'évolution
- [ ] Plan HuggingFace : **Gratuit** ✅ confirmé
- [ ] Fournisseur SMTP : ___
- [ ] Tier MongoDB Atlas : M0 (gratuit 512MB) / M10 ($57/mois) / autre : ___
- [ ] Monitoring : ❌ aucun confirmé implicitement

**Contexte Camtel**
- [ ] Camtel fournit quoi exactement : bande passante Cameroun / hébergement local / partenariat distribution : ___
- [ ] Objectif du document : décrocher un contrat / présentation investisseur / dossier technique : ___
- [ ] Date limite de soumission : ___

---

## COMMANDES RESTANTES À LANCER SUR PROD

```bash
# Bande passante
curl -s https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py | python3 -

# Limite connexions système
ulimit -n

# Firewall
ufw status verbose 2>/dev/null

# Détail RAM
cat /proc/meminfo | grep -E "MemTotal|MemFree|MemAvailable|SwapTotal"
```

---

*Fichier source pour la rédaction de INFRA_CAMTEL.md*
