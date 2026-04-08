/**
 * Tests Unitaires : SchoolSearchService
 *
 * Agent 3 - Expert TDD
 * Service pour la recherche fuzzy d'écoles
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SchoolSearchService } from '@/lib/services/SchoolSearchService';

describe('SchoolSearchService', () => {

  describe('fuzzyMatch', () => {

    it('should return 100 score for exact match', () => {
      // Arrange
      const query = 'Lycée Bilingue de Yaoundé';
      const target = 'Lycée Bilingue de Yaoundé';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBe(100);
    });

    it('should be case-insensitive', () => {
      // Arrange
      const query = 'lycée bilingue';
      const target = 'LYCÉE BILINGUE';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeGreaterThan(95);
    });

    it('should handle accent variations', () => {
      // Arrange
      const query = 'Lycee'; // Sans accent
      const target = 'Lycée'; // Avec accent

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeGreaterThan(90);
    });

    it('should give high score for minor typos', () => {
      // Arrange
      const query = 'Lycee Billingue'; // Typo: double 'l'
      const target = 'Lycée Bilingue';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeGreaterThan(75);
      expect(score).toBeLessThan(100);
    });

    it('should give lower score for major differences', () => {
      // Arrange
      const query = 'Lycée de Douala';
      const target = 'Collège de Yaoundé';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeLessThan(50);
    });

    it('should handle partial matches', () => {
      // Arrange
      const query = 'Bilingue Yaoundé';
      const target = 'Lycée Bilingue de Yaoundé';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeGreaterThan(60);
    });

    it('should work with word reordering', () => {
      // Arrange
      const query = 'Yaoundé Bilingue Lycée';
      const target = 'Lycée Bilingue de Yaoundé';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeGreaterThan(70);
    });

    it('should normalize whitespace', () => {
      // Arrange
      const query = 'Lycée   Bilingue'; // Multiple espaces
      const target = 'Lycée Bilingue';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeGreaterThan(95);
    });
  });

  describe('normalizeSchoolName', () => {

    it('should convert to lowercase', () => {
      // Arrange
      const input = 'LYCÉE BILINGUE';

      // Act
      const result = SchoolSearchService.normalizeSchoolName(input);

      // Assert
      expect(result).toBe('lycée bilingue');
    });

    it('should trim whitespace', () => {
      // Arrange
      const input = '  Lycée Test  ';

      // Act
      const result = SchoolSearchService.normalizeSchoolName(input);

      // Assert
      expect(result).toBe('lycée test');
    });

    it('should remove extra spaces between words', () => {
      // Arrange
      const input = 'Lycée    Bilingue   de   Yaoundé';

      // Act
      const result = SchoolSearchService.normalizeSchoolName(input);

      // Assert
      expect(result).toBe('lycée bilingue de yaoundé');
    });

    it('should remove special characters except basic punctuation', () => {
      // Arrange
      const input = 'Lycée d\'Excellence & Innovation - Yaoundé';

      // Act
      const result = SchoolSearchService.normalizeSchoolName(input);

      // Assert
      expect(result).toMatch(/lycée d'?excellence.*innovation.*yaoundé/i);
      expect(result).not.toContain('&');
    });

    it('should handle empty string', () => {
      // Arrange
      const input = '';

      // Act
      const result = SchoolSearchService.normalizeSchoolName(input);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('calculateLevenshteinDistance', () => {

    it('should return 0 for identical strings', () => {
      // Arrange
      const str1 = 'test';
      const str2 = 'test';

      // Act
      const distance = SchoolSearchService.calculateLevenshteinDistance(str1, str2);

      // Assert
      expect(distance).toBe(0);
    });

    it('should calculate single character insertion', () => {
      // Arrange
      const str1 = 'test';
      const str2 = 'tests';

      // Act
      const distance = SchoolSearchService.calculateLevenshteinDistance(str1, str2);

      // Assert
      expect(distance).toBe(1);
    });

    it('should calculate single character deletion', () => {
      // Arrange
      const str1 = 'tests';
      const str2 = 'test';

      // Act
      const distance = SchoolSearchService.calculateLevenshteinDistance(str1, str2);

      // Assert
      expect(distance).toBe(1);
    });

    it('should calculate single character substitution', () => {
      // Arrange
      const str1 = 'test';
      const str2 = 'best';

      // Act
      const distance = SchoolSearchService.calculateLevenshteinDistance(str1, str2);

      // Assert
      expect(distance).toBe(1);
    });

    it('should handle completely different strings', () => {
      // Arrange
      const str1 = 'abc';
      const str2 = 'xyz';

      // Act
      const distance = SchoolSearchService.calculateLevenshteinDistance(str1, str2);

      // Assert
      expect(distance).toBe(3);
    });

    it('should be case-sensitive', () => {
      // Arrange
      const str1 = 'Test';
      const str2 = 'test';

      // Act
      const distance = SchoolSearchService.calculateLevenshteinDistance(str1, str2);

      // Assert
      expect(distance).toBe(1);
    });
  });

  describe('suggestCorrections', () => {

    it('should suggest corrections for typos', () => {
      // Arrange
      const query = 'Lycee Billingue'; // Typos
      const availableSchools = [
        'Lycée Bilingue de Yaoundé',
        'Lycée de Douala',
        'Collège Vogt'
      ];

      // Act
      const suggestions = SchoolSearchService.suggestCorrections(query, availableSchools);

      // Assert
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].name).toBe('Lycée Bilingue de Yaoundé');
      expect(suggestions[0].score).toBeGreaterThan(70);
    });

    it('should return top 5 suggestions by default', () => {
      // Arrange
      const query = 'Lycée';
      const availableSchools = Array(10).fill(null).map((_, i) => `Lycée ${i}`);

      // Act
      const suggestions = SchoolSearchService.suggestCorrections(query, availableSchools);

      // Assert
      expect(suggestions).toHaveLength(5);
    });

    it('should sort suggestions by score descending', () => {
      // Arrange
      const query = 'Lycée de Yaoundé';
      const availableSchools = [
        'Collège de Yaoundé',
        'Lycée Bilingue de Yaoundé',
        'Lycée de Yaoundé',
        'École de Douala'
      ];

      // Act
      const suggestions = SchoolSearchService.suggestCorrections(query, availableSchools);

      // Assert
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].score).toBeGreaterThanOrEqual(suggestions[i + 1].score);
      }

      expect(suggestions[0].name).toBe('Lycée de Yaoundé'); // Exact match en premier
    });

    it('should filter out suggestions with score < threshold', () => {
      // Arrange
      const query = 'Lycée de Yaoundé';
      const availableSchools = [
        'Lycée de Yaoundé',
        'École XYZ ABC' // Très différent
      ];

      // Act
      const suggestions = SchoolSearchService.suggestCorrections(query, availableSchools, 50);

      // Assert
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].name).toBe('Lycée de Yaoundé');
    });

    it('should return empty array if no matches above threshold', () => {
      // Arrange
      const query = 'Lycée de Yaoundé';
      const availableSchools = ['Totally Different School'];

      // Act
      const suggestions = SchoolSearchService.suggestCorrections(query, availableSchools, 80);

      // Assert
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {

    it('should complete fuzzy match in under 10ms', () => {
      // Arrange
      const query = 'Lycée Bilingue de Yaoundé';
      const target = 'Lycée Bilingue de Yaoundé';

      const startTime = performance.now();

      // Act
      for (let i = 0; i < 1000; i++) {
        SchoolSearchService.fuzzyMatch(query, target);
      }

      const duration = performance.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100); // 1000 itérations en moins de 100ms
    });

    it('should handle large school lists efficiently', () => {
      // Arrange
      const query = 'Lycée Test';
      const largeList = Array(1000).fill(null).map((_, i) => `École ${i}`);

      const startTime = performance.now();

      // Act
      SchoolSearchService.suggestCorrections(query, largeList);

      const duration = performance.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(500); // Moins de 500ms pour 1000 écoles
    });
  });

  describe('Edge Cases', () => {

    it('should handle empty query', () => {
      // Arrange
      const query = '';
      const target = 'Lycée Test';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBe(0);
    });

    it('should handle empty target', () => {
      // Arrange
      const query = 'Lycée Test';
      const target = '';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBe(0);
    });

    it('should handle both empty strings', () => {
      // Arrange
      const query = '';
      const target = '';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBe(100); // Deux chaînes vides sont identiques
    });

    it('should handle very long strings', () => {
      // Arrange
      const query = 'A'.repeat(500);
      const target = 'A'.repeat(500);

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBe(100);
    });

    it('should handle special Unicode characters', () => {
      // Arrange
      const query = 'École 中文 Émoji 😀';
      const target = 'École 中文 Émoji 😀';

      // Act
      const score = SchoolSearchService.fuzzyMatch(query, target);

      // Assert
      expect(score).toBeGreaterThan(95);
    });
  });
});
