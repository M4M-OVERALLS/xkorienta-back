import Notification, { INotification, NotificationCategory } from "@/models/Notification";
import User from "@/models/User";
import { UserRole } from "@/models/enums";
import mongoose from "mongoose";
import { IObserver } from "../interfaces/IObserver";
import logger from "@/lib/utils/logger";
import { FCMService } from "@/lib/services/FCMService";
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
 * selon le rôle de l'utilisateur (STUDENT, TEACHER, ADMIN, etc.),
 * puis envoyer une push FCM sur tous les devices enregistrés.
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
        case EventType.EXAM_COMPLETED:
          await this.handleExamCompleted(event as ExamCompletedEvent);
          break;
        case EventType.SYLLABUS_CREATED:
          await this.handleSyllabusCreated(event);
          break;
        case EventType.SYLLABUS_UPDATED:
          await this.handleSyllabusUpdated(event);
          break;
        case EventType.EXAM_CREATED:
          await this.handleExamCreated(event);
          break;
        case EventType.BADGE_EARNED:
          await this.handleBadgeEarned(event as BadgeEarnedEvent);
          break;
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

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Crée une notification en base, puis déclenche une push FCM (best-effort).
   */
  private async createNotifAndPush(data: {
    userId: mongoose.Types.ObjectId | string;
    type: string;
    category?: NotificationCategory;
    title: string;
    message: string;
    read: boolean;
    data?: Record<string, any>;
  }): Promise<void> {
    const notification = await Notification.create(data);
    FCMService.sendPushForNotification(notification as INotification).catch(
      (err) =>
        logger.error("[NotificationObserver] FCM push échouée:", err),
    );
  }

  /**
   * Crée des notifications en masse, puis déclenche une push FCM par utilisateur (best-effort).
   */
  private async createManyNotifAndPush(
    dataArray: Array<{
      userId: string | mongoose.Types.ObjectId;
      type: string;
      category?: NotificationCategory;
      title: string;
      message: string;
      read: boolean;
      data?: Record<string, any>;
    }>,
  ): Promise<void> {
    if (dataArray.length === 0) return;
    const notifications = await Notification.insertMany(dataArray);
    for (const notif of notifications) {
      FCMService.sendPushForNotification(notif as INotification).catch(
        (err) =>
          logger.error("[NotificationObserver] FCM push échouée:", err),
      );
    }
  }

  // ─── Handlers ────────────────────────────────────────────────────────────

  /**
   * Notification pour nouveau syllabus (STUDENTS & TEACHER)
   */
  private async handleSyllabusCreated(event: Event): Promise<void> {
    try {
      const syllabusId = event.data.syllabusId;
      const { default: Syllabus } = await import("@/models/Syllabus");
      const { default: Class } = await import("@/models/Class");

      const syllabus = await (Syllabus as any)
        .findById(syllabusId)
        .populate("classes")
        .populate("subject");
      if (!syllabus) return;

      const subjectName = syllabus.subject?.name || "Matière inconnue";
      const studentIds = new Set<string>();

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
          category: 'exam_pending' as NotificationCategory,
          title: "Nouveau Syllabus Disponible 📚",
          message: `Le Syllabus de ${subjectName} "${syllabus.title}" est maintenant disponible.`,
          read: false,
          data: { syllabusId: syllabus._id },
        }));

        await this.createManyNotifAndPush(notifications);
      }

      if (event.data.teacherId) {
        await this.createNotifAndPush({
          userId: new mongoose.Types.ObjectId(event.data.teacherId),
          type: "success",
          category: 'exam_pending',
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

      const syllabus = await (Syllabus as any)
        .findById(syllabusId)
        .populate("classes")
        .populate("subject");
      if (!syllabus) return;

      const subjectName = syllabus.subject?.name || "Matière inconnue";
      const studentIds = new Set<string>();

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
          category: 'exam_pending' as NotificationCategory,
          title: "Syllabus mis à jour 📝",
          message: `Le Syllabus de ${subjectName} "${syllabus.title}" a été mis à jour (v${syllabus.version}).`,
          read: false,
          data: { syllabusId: syllabus._id },
        }));

        await this.createManyNotifAndPush(notifications);
      }

      if (event.data.teacherId) {
        await this.createNotifAndPush({
          userId: new mongoose.Types.ObjectId(event.data.teacherId),
          type: "success",
          category: 'exam_pending',
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

      const exam = await (Exam as any).findById(examId);
      if (!exam || !exam.syllabus) return;

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
        category: 'exam_pending' as NotificationCategory,
        title: "Nouvel Examen Planifié 📝",
        message: `Un nouvel examen de ${subjectName} "${exam.title}" a été planifié.`,
        read: false,
        data: { examId: exam._id },
      }));

      await this.createManyNotifAndPush(notifications);

      if (event.data.teacherId) {
        await this.createNotifAndPush({
          userId: new mongoose.Types.ObjectId(event.data.teacherId),
          type: "success",
          category: 'exam_pending',
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

    await this.createNotifAndPush({
      userId: event.userId,
      type: event.data.passed ? "success" : "info",
      category: 'exam_result',
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

    await this.createNotifAndPush({
      userId: event.userId,
      type: "badge",
      category: 'rewards',
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

    await this.createNotifAndPush({
      userId: event.userId,
      type: "level_up",
      category: 'rewards',
      title: "Level Up! ⬆️",
      message: `Vous êtes maintenant niveau ${event.data.newLevel}`,
      read: false,
      data: event.data,
    });
  }

  /**
   * Notification pour XP gagné (STUDENT)
   * Ne notifie que pour les gros gains d'XP (>= 100)
   */
  private async handleXPGained(event: XPGainedEvent): Promise<void> {
    if (!event.userId) return;
    if (event.data.amount < 100) return;

    await this.createNotifAndPush({
      userId: event.userId,
      type: "xp",
      category: 'rewards',
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

      if (exam.createdById && typeof exam.createdById !== "string") {
        await this.createNotifAndPush({
          userId: (exam.createdById as any)._id,
          type: "success",
          category: 'exam_pending',
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

      await this.createNotifAndPush({
        userId: exam.createdById,
        type: "success",
        category: 'exam_result',
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

      const inspectors = await User.find({
        role: UserRole.INSPECTOR,
        isActive: true,
      });

      const notifications = inspectors.map((inspector) => ({
        userId: inspector._id,
        type: "info",
        category: 'exam_pending' as NotificationCategory,
        title: "Nouvel examen à valider 📋",
        message: `L'examen "${exam.title}" attend votre validation`,
        read: false,
        data: { examId: exam._id, createdBy: exam.createdById },
      }));

      await this.createManyNotifAndPush(notifications);
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

    await this.createNotifAndPush({
      userId: event.userId,
      type: "info",
      category: 'exam_result',
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

    await this.createNotifAndPush({
      userId: event.userId,
      type: "alert",
      category: 'exam_pending',
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

    await this.createNotifAndPush({
      userId: event.userId,
      type: "info",
      category: 'account',
      title: "Bienvenue sur Xkorienta! 👋",
      message:
        "Merci de vous être inscrit. Complétez votre profil pour commencer.",
      read: false,
      data: {},
    });
  }
}
