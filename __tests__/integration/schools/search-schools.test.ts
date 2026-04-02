/**
 * Tests d'Intégration : Recherche d'Écoles avec Fuzzy Matching
 *
 * Agent 3 - Expert TDD
 * Endpoint: GET /api/schools/search
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import School from '@/models/School';

const API_URL = process.env.TEST_API_URL || 'http://localhost:3001';

describe('GET /api/schools/search - Recherche d\'écoles', () => {

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_DATABASE_URL || 'mongodb://localhost:27017/quizlock-test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await School.deleteMany({});

    // Seed: Créer des écoles de test
    await School.insertMany([
      {
        name: 'Lycée Bilingue de Yaoundé',
        type: 'SECONDARY',
        city: new mongoose.Types.ObjectId(),
        country: new mongoose.Types.ObjectId(),
        owner: new mongoose.Types.ObjectId(),
        status: 'ACTIVE'
      },
      {
        name: 'Collège Vogt',
        type: 'SECONDARY',
        city: new mongoose.Types.ObjectId(),
        country: new mongoose.Types.ObjectId(),
        owner: new mongoose.Types.ObjectId(),
        status: 'ACTIVE'
      },
      {
        name: 'Lycée de Douala',
        type: 'SECONDARY',
        city: new mongoose.Types.ObjectId(),
        country: new mongoose.Types.ObjectId(),
        owner: new mongoose.Types.ObjectId(),
        status: 'ACTIVE'
      },
      {
        name: 'École Primaire Central',
        type: 'PRIMARY',
        city: new mongoose.Types.ObjectId(),
        country: new mongoose.Types.ObjectId(),
        owner: new mongoose.Types.ObjectId(),
        status: 'ACTIVE'
      }
    ]);
  });

  describe('Recherche exacte', () => {

    it('should find exact match and return hasExactMatch: true', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'Lycée Bilingue de Yaoundé' })
        .expect(200);

      // Assert
      expect(response.body.hasExactMatch).toBe(true);
      expect(response.body.schools).toHaveLength(1);
      expect(response.body.schools[0].name).toBe('Lycée Bilingue de Yaoundé');
      expect(response.body.schools[0].matchScore).toBeGreaterThan(95);
    });

    it('should be case-insensitive', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'lycée bilingue de yaoundé' })
        .expect(200);

      // Assert
      expect(response.body.hasExactMatch).toBe(true);
      expect(response.body.schools[0].name).toBe('Lycée Bilingue de Yaoundé');
    });
  });

  describe('Recherche fuzzy (similarité)', () => {

    it('should find similar schools when there are typos', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'Lycee Billingue Yaounde' }) // Typos
        .expect(200);

      // Assert
      expect(response.body.schools).toHaveLength(1);
      expect(response.body.schools[0].name).toBe('Lycée Bilingue de Yaoundé');
      expect(response.body.schools[0].matchScore).toBeGreaterThan(70);
      expect(response.body.hasExactMatch).toBe(false);
    });

    it('should find partial matches', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'Bilingue Yaoundé' })
        .expect(200);

      // Assert
      expect(response.body.schools.length).toBeGreaterThan(0);
      expect(response.body.schools[0].name).toContain('Bilingue');
    });

    it('should return multiple matches sorted by relevance', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'Lycée' })
        .expect(200);

      // Assert
      expect(response.body.schools.length).toBeGreaterThan(1);

      // Vérifier que les résultats sont triés par matchScore décroissant
      for (let i = 0; i < response.body.schools.length - 1; i++) {
        expect(response.body.schools[i].matchScore)
          .toBeGreaterThanOrEqual(response.body.schools[i + 1].matchScore);
      }
    });
  });

  describe('Filtres additionnels', () => {

    it('should filter by city', async () => {
      // Arrange
      const yaoundeCity = (await School.findOne({ name: 'Lycée Bilingue de Yaoundé' }))?.city;

      // Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({
          q: 'Lycée',
          city: yaoundeCity?.toString()
        })
        .expect(200);

      // Assert
      expect(response.body.schools).toHaveLength(1);
      expect(response.body.schools[0].name).toContain('Yaoundé');
    });

    it('should filter by type', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({
          q: 'École',
          type: 'PRIMARY'
        })
        .expect(200);

      // Assert
      expect(response.body.schools).toHaveLength(1);
      expect(response.body.schools[0].name).toBe('École Primaire Central');
    });

    it('should respect limit parameter', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({
          q: 'Lycée',
          limit: 1
        })
        .expect(200);

      // Assert
      expect(response.body.schools).toHaveLength(1);
    });
  });

  describe('Cas limites', () => {

    it('should return empty array when no matches found', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'École Inexistante XYZ123' })
        .expect(200);

      // Assert
      expect(response.body.schools).toHaveLength(0);
      expect(response.body.hasExactMatch).toBe(false);
    });

    it('should handle empty query parameter', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: '' })
        .expect(400);

      // Assert
      expect(response.body.error).toBe('Le paramètre de recherche est requis');
    });

    it('should handle very long query string', async () => {
      // Arrange
      const longQuery = 'A'.repeat(300);

      // Act & Assert
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: longQuery })
        .expect(400);

      expect(response.body.error).toContain('trop long');
    });

    it('should sanitize special characters in query', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: '<script>alert("XSS")</script>Lycée' })
        .expect(200);

      // Assert
      // La requête doit être assainie et retourner des résultats normaux
      expect(response.body).toHaveProperty('schools');
    });
  });

  describe('Performance', () => {

    it('should complete search in under 500ms', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'Lycée Bilingue' })
        .expect(200);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent searches efficiently', async () => {
      // Arrange
      const searches = Array(10).fill(null).map((_, i) =>
        request(API_URL)
          .get('/api/schools/search')
          .query({ q: `Lycée ${i}` })
      );

      const startTime = Date.now();

      // Act
      await Promise.all(searches);

      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(2000); // 10 recherches en moins de 2s
    });
  });

  describe('Sécurité', () => {

    it('should prevent NoSQL injection in query', async () => {
      // Arrange & Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: JSON.stringify({ $ne: null }) })
        .expect(200);

      // Assert
      // Doit traiter comme une chaîne normale, pas comme un objet
      expect(response.body.schools).toBeDefined();
    });

    it('should not expose inactive/deleted schools', async () => {
      // Arrange
      await School.create({
        name: 'École Inactive',
        type: 'PRIMARY',
        city: new mongoose.Types.ObjectId(),
        country: new mongoose.Types.ObjectId(),
        owner: new mongoose.Types.ObjectId(),
        status: 'INACTIVE',
        isActive: false
      });

      // Act
      const response = await request(API_URL)
        .get('/api/schools/search')
        .query({ q: 'École Inactive' })
        .expect(200);

      // Assert
      expect(response.body.schools).toHaveLength(0);
    });
  });
});
