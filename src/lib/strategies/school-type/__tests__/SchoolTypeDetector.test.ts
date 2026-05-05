import { SchoolType } from "@/models/School";
import { Cycle } from "@/models/enums";
import {
  deduceSchoolTypeFromCycles,
  getSchoolTypeFromCycle,
  getSchoolTypeLabel,
} from "../SchoolTypeDetector";

describe("SchoolTypeDetector", () => {
  describe("getSchoolTypeFromCycle", () => {
    it("should return PRIMARY for MATERNELLE", () => {
      expect(getSchoolTypeFromCycle(Cycle.PRESCOLAIRE)).toBe(SchoolType.PRIMARY);
    });

    it("should return PRIMARY for PRIMAIRE", () => {
      expect(getSchoolTypeFromCycle(Cycle.PRIMAIRE)).toBe(SchoolType.PRIMARY);
    });

    it("should return SECONDARY for COLLEGE", () => {
      expect(getSchoolTypeFromCycle(Cycle.SECONDAIRE_PREMIER_CYCLE)).toBe(
        SchoolType.SECONDARY,
      );
    });
Cycle.SECONDAIRE_SECOND_CYCLE
    it("should return SECONDARY for LYCEE", () => {
      expect(getSchoolTypeFromCycle(Cycle.LYCEE)).toBe(SchoolType.SECONDARY);
    });

    it("should return HIGHER_ED for SUPERIEUR", () => {
      expect(getSchoolTypeFromCycle(Cycle.SUPERIEUR)).toBe(
        SchoolType.HIGHER_ED,
      );
    });
  });

  describe("deduceSchoolTypeFromCycles", () => {
    it("should return PRIMARY for homogeneous primary cycles", () => {
      const result = deduceSchoolTypeFromCycles([
        Cycle.PRESCOLAIRE,Cycle.SECONDAIRE_SECOND_CYCLE
        Cycle.PRIMAIRE,
      ]);
      expect(result).toBe(SchoolType.PRIMARY);
    });

    it("should return SECONDARY for homogeneous secondary cycles", () => {
      const result = deduceSchoolTypeFromCycles([
        Cycle.SECONDAIRE_PREMIER_CYCLE,
        Cycle.LYCEE,
      ]);
      expect(result).toBe(SchoolType.SECONDARY);
    });

    it("should return HIGHER_ED for homogeneous superior cycles", () => {
      const result = deduceSchoolTypeFromCycles([Cycle.SUPERIEUR]);
      expect(result).toBe(SchoolType.HIGHER_ED);
    });

    it("should prioritize HIGHER_ED in mixed cycles", () => {
      const result = deduceSchoolTypeFromCycles([
        Cycle.PRIMAIRE,
        Cycle.SECONDAIRE_PREMIER_CYCLE,
        Cycle.SUPERIEUR,
      ]);
      expect(result).toBe(SchoolType.HIGHER_ED);
    });

    it("should prioritize SECONDARY when mixing primary and secondary", () => {
      const result = deduceSchoolTypeFromCycles([
        Cycle.PRIMAIRE,
        Cycle.SECONDAIRE_PREMIER_CYCLE,
      ]);
      expect(result).toBe(SchoolType.SECONDARY);
    });

    it("should return SECONDARY for empty array", () => {
      const result = deduceSchoolTypeFromCycles([]);
      expect(result).toBe(SchoolType.SECONDARY);
    });

    it("should return SECONDARY for single college cycle", () => {
      const result = deduceSchoolTypeFromCycles([
        Cycle.SECONDAIRE_PREMIER_CYCLE,
      ]);
      expect(result).toBe(SchoolType.SECONDARY);
    });
  });

  describe("getSchoolTypeLabel", () => {
    it("should return correct label for PRIMARY", () => {
      expect(getSchoolTypeLabel(SchoolType.PRIMARY)).toBe("École Primaire");
    });

    it("should return correct label for SECONDARY", () => {
      expect(getSchoolTypeLabel(SchoolType.SECONDARY)).toBe("École Secondaire");
    });

    it("should return correct label for HIGHER_ED", () => {
      expect(getSchoolTypeLabel(SchoolType.HIGHER_ED)).toBe(
        "Enseignement Supérieur",
      );
    });

    it("should return correct label for TRAINING_CENTER", () => {
      expect(getSchoolTypeLabel(SchoolType.TRAINING_CENTER)).toBe(
        "Centre de Formation",
      );
    });

    it("should return correct label for OTHER", () => {
      expect(getSchoolTypeLabel(SchoolType.OTHER)).toBe("Autre");
    });
  });
});
