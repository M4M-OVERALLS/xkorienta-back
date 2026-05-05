import Notification from "@/models/Notification";
import User from "@/models/User";
import { UserRole } from "@/models/enums";
import mongoose from "mongoose";
import { IObserver } from "../interfaces/IObserver";
import logger from "@/lib/utils/logger";
import {
  AttemptGradedEvent,
  BadgeEarnedEvent,
  Event,
  EventType,
  ExamCompletedEvent,
  LevelUpEvent,
  XPGainedEvent,
} from "../types";

/**
 * Observateur pour créer des notifications en base de données
 * selon le rôle de l'utilisateur (STUDENT, TEACHER, ADMIN, etc.)
 */
export class NotificationObserver implements IObserver {
  getName(): string {
    return "NotificationObserver";
  }

  getInterestedEvents(): string[] {
    return [
      EventType.SYLLABUS_CREATED,
      EventType.SYLLABUS_UPDATED,
      EventType.EXAM_CREATED,
      EventType.EXAM_COMPLETED,
      EventType.EXAM_PUBLISHED,
      EventType.EXAM_VALIDATED,
      EventType.EXAM_SUBMITTED_FOR_VALIDATION,
      EventType.BADGE_EARNED,
      EventType.LEVEL_UP,
      EventType.XP_GAINED,
      EventType.ATTEMPT_GRADED,
      EventType.LATE_CODE_GENERATED,
      EventType.USER_REGISTERED,
    ];
  }

  async update(event: Event): Promise<void> {
    try {
      switch (event.type) {
        // ... existing cases ...
        case EventType.EXAM_COMPLETED:
          await this.handleExamCompleted(event as ExamCompletedEvent);
          break;
        // ...
        case EventType.SYLLABUS_CREATED:
          await this.handleSyllabusCreated(event);
          break;
        case EventType.SYLLABUS_UPDATED:
          await this.handleSyllabusUpdated(event);
          break;
        case EventType.EXAM_CREATED:
          await this.handleExamCreated(event);
          break;
        // ...
        case EventType.BADGE_EARNED:
          await this.handleBadgeEarned(event as BadgeEarnedEvent);
          break;
        // ... (keep others)
        case EventType.LEVEL_UP:
          await this.handleLevelUp(event as LevelUpEvent);
          break;
        case EventType.XP_GAINED:
          await this.handleXPGained(event as XPGainedEvent);
          break;
        case EventType.EXAM_PUBLISHED:
          await this.handleExamPublished(event);
          break;
        case EventType.EXAM_VALIDATED:
          await this.handleExamValidated(event);
          break;
        case EventType.EXAM_SUBMITTED_FOR_VALIDATION:
          await this.handleExamSubmittedForValidation(event);
          break;
        case EventType.ATTEMPT_GRADED:
          await this.handleAttemptGraded(event as AttemptGradedEvent);
          break;
        case EventType.LATE_CODE_GENERATED:
          await this.handleLateCodeGenerated(event);
          break;
        case EventType.USER_REGISTERED:
          await this.handleUserRegistered(event);
          break;
      }
    } catch (error) {
      logger.error(
        "[NotificationObserver] Error creating notification:",
        error,
      );
    }
  }

  // ... existing handlers ...

  /**
   * Notification pour nouveau syllabus (STUDENTS & TEACHER)
   */
  private async handleSyllabusCreated(event: Event): Promise<void> {
    try {
      const syllabusId = event.data.syllabusId;
      // Need to fetch syllabus to get classes, or trust event data?
      // Safer to fetch or we pass classes in event data.
      // Let's assume we fetch or pass. Passing is faster.
      // But let's verify with import.
      const { default: Syllabus } = await import("@/models/Syllabus"); // Dynamic import to avoid circular dep if any
      const { default: Class } = await import("@/models/Class");
      const { default: Subject } = await import("@/models/Subject"); // Import Subject

      const syllabus = await (Syllabus as any)
        .findById(syllabusId)
        .populate("classes")
        .populate("subject");
      if (!syllabus) return;

      const subjectName = syllabus.subject?.name || "Matière inconnue";
      const studentIds = new Set<string>();

      // Notify Students if classes are assigned
      if (syllabus.classes && syllabus.classes.length > 0) {
        for (const cls of syllabus.classes) {
          // Fetch full class to get students
          const fullClass = await (Class as any).findById(cls._id);
          if (fullClass && fullClass.students) {
            fullClass.students.forEach((s: any) =>
              studentIds.add(s.toString()),
            );
          }
        }

        const notifications = Array.from(studentIds).map((studentId) => ({
          userId: studentId,
          type: "info",
          title: "Nouveau Syllabus Disponible 📚",
          message: `Le Syllabus de ${subjectName} "${syllabus.title}" est maintenant disponible.`,
          read: false,
          data: { syllabusId: syllabus._id },
        }));

        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
        }
      }

      // Notify Teacher
      if (event.data.teacherId) {
        await Notification.create({
          userId: new mongoose.Types.ObjectId(event.data.teacherId),
          type: "success",
          title: "Syllabus créé avec succès ✅",
          message: `Votre Syllabus "${syllabus.title}" (${subjectName}) a été créé${studentIds.size > 0 ? ` et partagé avec ${studentIds.size} étudiants` : "."}`,
          read: false,
          data: { syllabusId: syllabus._id },
        });
      }
    } catch (error) {
      logger.error("Error in handleSyllabusCreated", error);
    }
  }

  /**
   * Notification pour syllabus modifié (STUDENTS & TEACHER)
   */
  private async handleSyllabusUpdated(event: Event): Promise<void> {
    try {
      const syllabusId = event.data.syllabusId;
      const { default: Syllabus } = await import("@/models/Syllabus");
      const { default: Class } = await import("@/models/Class");
      const { default: Subject } = await import("@/models/Subject");

      const syllabus = await (Syllabus as any)
        .findById(syllabusId)
        .populate("classes")
        .populate("subject");
      if (!syllabus) return;

      const subjectName = syllabus.subject?.name || "Matière inconnue";
      const studentIds = new Set<string>();

      // Notify Students if classes are assigned
      if (syllabus.classes && syllabus.classes.length > 0) {
        for (const cls of syllabus.classes) {
          const fullClass = await (Class as any).findById(cls._id);
          if (fullClass && fullClass.students) {
            fullClass.students.forEach((s: any) =>
              studentIds.add(s.toString()),
            );
          }
        }

        const notifications = Array.from(studentIds).map((studentId) => ({
          userId: studentId,
          type: "info",
          title: "Syllabus mis à jour 📝",
          message: `Le Syllabus de ${subjectName} "${syllabus.title}" a été mis à jour (v${syllabus.version}).`,
          read: false,
          data: { syllabusId: syllabus._id },
        }));

        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
        }
      }

      // Notify Teacher
      if (event.data.teacherId) {
        await Notification.create({
          userId: new mongoose.Types.ObjectId(event.data.teacherId),
          type: "success",
          title: "Syllabus mis à jour ✅",
          message: `Votre Syllabus "${syllabus.title}" (${subjectName}) a été mis à jour${studentIds.size > 0 ? ` et partagé avec ${studentIds.size} étudiants` : "."}`,
          read: false,
          data: { syllabusId: syllabus._id },
        });
      }
    } catch (error) {
      logger.error("Error in handleSyllabusUpdated", error);
    }
  }

  /**
   * Notification pour nouvel examen créé (STUDENTS & TEACHER)
   */
  private async handleExamCreated(event: Event): Promise<void> {
    try {
      const examId = event.data.examId;
      const { default: Exam } = await import("@/models/Exam");
      const { default: Syllabus } = await import("@/models/Syllabus");
      const { default: Class } = await import("@/models/Class");
      const { default: Subject } = await import("@/models/Subject");

      const exam = await (Exam as any).findById(examId);
      if (!exam || !exam.syllabus) return;

      // Find syllabus and its classes
      const syllabus = await (Syllabus as any)
        .findById(exam.syllabus)
        .populate("classes")
        .populate("subject");
      if (!syllabus || !syllabus.classes) return;

      const studentIds = new Set<string>();

      for (const cls of syllabus.classes) {
        const fullClass = await (Class as any).findById(cls._id);
        if (fullClass && fullClass.students) {
          fullClass.students.forEach((s: any) => studentIds.add(s.toString()));
        }
      }

      const subjectName = syllabus.subject?.name || "Matière inconnue";

      const notifications = Array.from(studentIds).map((studentId) => ({
        userId: studentId,
        type: "info",
        title: "Nouvel Examen Planifié 📝",
        message: `Un nouvel examen de ${subjectName} "${exam.title}" a été planifié.`,
        read: false,
        data: { examId: exam._id },
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      // Notify Teacher
      if (event.data.teacherId) {
        await Notification.create({
          userId: new mongoose.Types.ObjectId(event.data.teacherId),
          type: "success",
          title: "Examen planifié ✅",
          message: `L'examen "${exam.title}" (${subjectName}) a été notifié à ${studentIds.size} étudiants.`,
          read: false,
          data: { examId: exam._id },
        });
      }
    } catch (error) {
      logger.error("Error in handleExamCreated", error);
    }
  }

  /**
   * Notification pour examen complété (STUDENT)
   */
  private async handleExamCompleted(event: ExamCompletedEvent): Promise<void> {
    if (!event.userId) return;

    const user = await User.findById(event.userId);
    if (!user || user.role !== UserRole.STUDENT) return;

    await Notification.create({
      userId: event.userId,
      type: event.data.passed ? "success" : "info",
      title: event.data.passed ? "Examen réussi ! 🎉" : "Examen terminé",
      message: `Score: ${event.data.score}/${event.data.maxScore} (${event.data.percentage}%)`,
      read: false,
      data: {
        examId: event.data.examId,
        attemptId: event.data.attemptId,
        score: event.data.score,
        percentage: event.data.percentage,
      },
    });
  }

  /**
   * Notification pour badge gagné (STUDENT)
   */
  private async handleBadgeEarned(event: BadgeEarnedEvent): Promise<void> {
    if (!event.userId) return;

    await Notification.create({
      userId: event.userId,
      type: "badge",
      title: "Nouveau Badge! 🏆",
      message: `Badge "${event.data.badgeName}" débloqué`,
      read: false,
      data: event.data,
    });
  }

  /**
   * Notification pour montée de niveau (STUDENT)
   */
  private async handleLevelUp(event: LevelUpEvent): Promise<void> {
    if (!event.userId) return;

    await Notification.create({
      userId: event.userId,
      type: "level_up",
      title: "Level Up! ⬆️",
      message: `Vous êtes maintenant niveau ${event.data.newLevel}`,
      read: false,
      data: event.data,
    });
  }

  /**
   * Notification pour XP gagné (STUDENT)
   */
  private async handleXPGained(event: XPGainedEvent): Promise<void> {
    if (!event.userId) return;

    // Ne notifier que pour les gros gains d'XP (>= 100)
    if (event.data.amount < 100) return;

    await Notification.create({
      userId: event.userId,
      type: "xp",
      title: `+${event.data.amount} XP ⚡`,
      message: event.data.source,
      read: false,
      data: event.data,
    });
  }

  /**
   * Notification pour examen publié (TEACHER & STUDENTS concernés)
   */
  private async handleExamPublished(event: Event): Promise<void> {
    try {
      const { default: Exam } = await import("@/models/Exam");
      const exam = await (Exam as any)
        .findById(event.data.examId)
        .populate("createdById");
      if (!exam) return;

      // Notification pour le teacher créateur
      if (exam.createdById && typeof exam.createdById !== "string") {
        await Notification.create({
          userId: (exam.createdById as any)._id,
          type: "success",
          title: "Examen publié ✅",
          message: `Votre examen "${exam.title}" est maintenant accessible aux étudiants`,
          read: false,
          data: { examId: exam._id },
        });
      }

      // TODO: Notifier les étudiants concernés par cet examen
    } catch (error) {
      logger.error(
        "[NotificationObserver] Error in handleExamPublished:",
        error,
      );
    }
  }

  /**
   * Notification pour examen validé (TEACHER)
   */
  private async handleExamValidated(event: Event): Promise<void> {
    try {
      const { default: Exam } = await import("@/models/Exam");
      const exam = await (Exam as any).findById(event.data.examId);
      if (!exam) return;

      // Notifier le teacher créateur
      await Notification.create({
        userId: exam.createdById,
        type: "success",
        title: "Examen validé ✅",
        message: `Votre examen "${exam.title}" a été validé par un inspecteur`,
        read: false,
        data: {
          examId: exam._id,
          validatedBy: event.data.validatedBy,
        },
      });
    } catch (error) {
      logger.error(
        "[NotificationObserver] Error in handleExamValidated:",
        error,
      );
    }
  }

  /**
   * Notification pour examen soumis pour validation (INSPECTOR)
   */
  private async handleExamSubmittedForValidation(event: Event): Promise<void> {
    try {
      const { default: Exam } = await import("@/models/Exam");
      const exam = await (Exam as any).findById(event.data.examId);
      if (!exam) return;

      // Trouver tous les inspecteurs
      const inspectors = await User.find({
        role: UserRole.INSPECTOR,
        isActive: true,
      });

      // Créer une notification pour chaque inspecteur
      const notifications = inspectors.map((inspector) => ({
        userId: inspector._id,
        type: "info",
        title: "Nouvel examen à valider 📋",
        message: `L'examen "${exam.title}" attend votre validation`,
        read: false,
        data: { examId: exam._id, createdBy: exam.createdById },
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } catch (error) {
      logger.error(
        "[NotificationObserver] Error in handleExamSubmittedForValidation:",
        error,
      );
    }
  }

  /**
   * Notification pour tentative corrigée (STUDENT)
   */
  private async handleAttemptGraded(event: AttemptGradedEvent): Promise<void> {
    if (!event.userId) return;

    await Notification.create({
      userId: event.userId,
      type: "info",
      title: "Examen corrigé 📝",
      message: `Votre examen a été corrigé. Score: ${event.data.percentage}%`,
      read: false,
      data: event.data,
    });
  }

  /**
   * Notification pour code de retard généré (STUDENT)
   */
  private async handleLateCodeGenerated(event: Event): Promise<void> {
    if (!event.userId) return;

    await Notification.create({
      userId: event.userId,
      type: "alert",
      title: "Code de retard généré ⏰",
      message: `Votre code: ${event.data.code}. Validité: ${event.data.validityMinutes} minutes`,
      read: false,
      data: event.data,
    });
  }

  /**
   * Notification de bienvenue (ALL USERS)
   */
  private async handleUserRegistered(event: Event): Promise<void> {
    if (!event.userId) return;

    await Notification.create({
      userId: event.userId,
      type: "info",
      title: "Bienvenue sur Xkorienta! 👋",
      message:
        "Merci de vous être inscrit. Complétez votre profil pour commencer.",
      read: false,
      data: {},
    });
  }
}
