#!/bin/bash

# Script de test pour le système de gestion d'erreurs multilingue
# Usage: ./TEST_MULTILINGUAL.sh

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3001"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Test du Système Multilingue${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Test 1: Français (défaut)
echo -e "${BLUE}Test 1: Français (par défaut)${NC}"
echo -e "${YELLOW}Requête:${NC} POST /api/auth/login (sans langue spécifiée)"
curl -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Erreur: Endpoint non disponible ou jq non installé"
echo -e "\n"

# Test 2: Anglais via query parameter
echo -e "${BLUE}Test 2: Anglais (Query Parameter)${NC}"
echo -e "${YELLOW}Requête:${NC} POST /api/auth/login?lang=en"
curl -X POST "${BASE_URL}/api/auth/login?lang=en" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Erreur: Endpoint non disponible ou jq non installé"
echo -e "\n"

# Test 3: Anglais via header X-Language
echo -e "${BLUE}Test 3: Anglais (Header X-Language)${NC}"
echo -e "${YELLOW}Requête:${NC} POST /api/auth/login avec X-Language: en"
curl -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Language: en" \
  -d '{"email":"test@test.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Erreur: Endpoint non disponible ou jq non installé"
echo -e "\n"

# Test 4: Anglais via Accept-Language
echo -e "${BLUE}Test 4: Anglais (Header Accept-Language)${NC}"
echo -e "${YELLOW}Requête:${NC} POST /api/auth/login avec Accept-Language: en-US"
curl -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept-Language: en-US,en;q=0.9,fr;q=0.8" \
  -d '{"email":"test@test.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Erreur: Endpoint non disponible ou jq non installé"
echo -e "\n"

# Test 5: Erreur de validation (email manquant) - FR
echo -e "${BLUE}Test 5: Validation - Champs manquants (FR)${NC}"
echo -e "${YELLOW}Requête:${NC} POST /api/auth/login (sans email ni password)"
curl -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Erreur: Endpoint non disponible ou jq non installé"
echo -e "\n"

# Test 6: Erreur de validation (email manquant) - EN
echo -e "${BLUE}Test 6: Validation - Champs manquants (EN)${NC}"
echo -e "${YELLOW}Requête:${NC} POST /api/auth/login?lang=en (sans email ni password)"
curl -X POST "${BASE_URL}/api/auth/login?lang=en" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Erreur: Endpoint non disponible ou jq non installé"
echo -e "\n"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Tests terminés${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${YELLOW}Notes:${NC}"
echo "- Assurez-vous que le serveur est lancé sur ${BASE_URL}"
echo "- Installez jq pour un meilleur affichage: brew install jq (macOS)"
echo "- Adaptez les tests selon vos routes API existantes"
