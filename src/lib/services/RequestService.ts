import { RequestRepository } from "@/lib/repositories/RequestRepository";
import { RequestType, RequestStatus, RequestPriority, IRequest } from "@/models/Request";
import { UserRole } from "@/models/enums";
import { getPusherServer, getRequestsChannel } from "@/lib/pusher";
import { publishEvent } from "@/lib/events/EventPublisher";
import { EventType } from "@/lib/events/types";
import mongoose from "mongoose";

export class RequestService {
    /**
     * Get requests for a user based on their role
     */
    static async getRequests(userId: string, role: UserRole, filters?: { status?: string; type?: string }) {
        const repo = new RequestRepository();
        let query: any = {};

        if (role === UserRole.STUDENT) {
            query.studentId = userId;
        } else if (role === UserRole.TEACHER) {
            query.teacherId = userId;
        } else {
            throw new Error("Rôle non autorisé");
        }

        if (filters?.status) {
            query.status = filters.status;
        }
        if (filters?.type) {
            query.type = filters.type;
        }

        return await repo.find(query);
    }

    /**
     * Get request by ID with access control
     */
    static async getRequestById(requestId: string, userId: string) {
        const repo = new RequestRepository();
        const request = await repo.findById(requestId);

        if (!request) {
            throw new Error("Demande non trouvée");
        }

        const requestData = request as any;
        const isStudent = requestData.studentId._id.toString() === userId;
        const isTeacher = requestData.teacherId._id.toString() === userId;

        if (!isStudent && !isTeacher) {
            throw new Error("Accès non autorisé");
        }

        return request;
    }

    /**
     * Create a new request
     */
    static async createRequest(data: {
        teacherId: string;
        type: RequestType;
        subjectId?: string;
        title: string;
        message: string;
        priority?: RequestPriority;
        relatedExamId?: string;
        relatedConceptIds?: string[];
    }, studentId: string) {
        const repo = new RequestRepository();

        if (!data.teacherId || !data.type || !data.title || !data.message) {
            throw new Error("Champs requis manquants");
        }

        if (!Object.values(RequestType).includes(data.type)) {
            throw new Error("Type de demande invalide");
        }

        const newRequest = await repo.create({
            studentId: new mongoose.Types.ObjectId(studentId),
            teacherId: new mongoose.Types.ObjectId(data.teacherId),
            type: data.type,
            subject: data.subjectId ? new mongoose.Types.ObjectId(data.subjectId) : undefined,
            title: data.title,
            message: data.message,
            priority: data.priority || RequestPriority.MEDIUM,
            relatedExam: data.relatedExamId ? new mongoose.Types.ObjectId(data.relatedExamId) : undefined,
            relatedConcepts: data.relatedConceptIds?.map(id => new mongoose.Types.ObjectId(id)),
            status: RequestStatus.PENDING
        });

        // Trigger Pusher for real-time notification to teacher
        const pusher = getPusherServer();
        if (pusher) {
            pusher.trigger(getRequestsChannel(data.teacherId), 'request-created', {
                request: newRequest.toObject()
            });
        }

        // Emit event for observer pattern
        publishEvent({
            type: EventType.REQUEST_CREATED,
            timestamp: new Date(),
            userId: new mongoose.Types.ObjectId(data.teacherId),
            data: {
                requestId: newRequest._id,
                studentId: studentId,
                studentName: (newRequest.studentId as any).name,
                type: newRequest.type,
                title: newRequest.title
            }
        });

        return newRequest;
    }

    /**
     * Update request status
     */
    static async updateRequest(
        requestId: string,
        userId: string,
        updateData: {
            status?: RequestStatus;
            responseMessage?: string;
            scheduledAt?: Date;
            scheduledDuration?: number;
            meetingLink?: string;
            feedback?: any;
        }
    ) {
        const repo = new RequestRepository();
        const request = await repo.findByIdForUpdate(requestId);

        if (!request) {
            throw new Error("Demande non trouvée");
        }

        const isStudent = request.studentId._id.toString() === userId;
        const isTeacher = request.teacherId._id.toString() === userId;

        if (!isStudent && !isTeacher) {
            throw new Error("Accès non autorisé");
        }

        // Update based on action
        if (updateData.status === RequestStatus.ACCEPTED && isTeacher) {
            request.status = RequestStatus.ACCEPTED;
            request.responseMessage = updateData.responseMessage;
            request.respondedAt = new Date();
            if (updateData.scheduledAt) request.scheduledAt = updateData.scheduledAt;
            if (updateData.scheduledDuration) request.scheduledDuration = updateData.scheduledDuration;
            if (updateData.meetingLink) request.meetingLink = updateData.meetingLink;

            // Notify student
            publishEvent({
                type: EventType.REQUEST_ACCEPTED,
                timestamp: new Date(),
                userId: request.studentId._id,
                data: {
                    requestId: request._id,
                    teacherName: (request.teacherId as any).name,
                    type: request.type,
                    title: request.title,
                    scheduledAt: request.scheduledAt
                }
            });
        } else if (updateData.status === RequestStatus.REJECTED && isTeacher) {
            request.status = RequestStatus.REJECTED;
            request.responseMessage = updateData.responseMessage;
            request.respondedAt = new Date();

            // Notify student
            publishEvent({
                type: EventType.REQUEST_REJECTED,
                timestamp: new Date(),
                userId: request.studentId._id,
                data: {
                    requestId: request._id,
                    teacherName: (request.teacherId as any).name,
                    type: request.type,
                    title: request.title,
                    reason: updateData.responseMessage
                }
            });
        } else if (updateData.status === RequestStatus.COMPLETED) {
            request.status = RequestStatus.COMPLETED;
            request.completedAt = new Date();
            if (updateData.feedback && isStudent) {
                request.feedback = updateData.feedback;
            }

            publishEvent({
                type: EventType.REQUEST_COMPLETED,
                timestamp: new Date(),
                userId: isStudent ? request.teacherId._id : request.studentId._id,
                data: {
                    requestId: request._id,
                    type: request.type,
                    title: request.title
                }
            });
        } else if (updateData.status === RequestStatus.CANCELLED && isStudent) {
            request.status = RequestStatus.CANCELLED;
        }

        await repo.save(request);

        // Trigger Pusher for real-time update
        const pusher = getPusherServer();
        if (pusher) {
            const targetUserId = isTeacher ? request.studentId._id.toString() : request.teacherId._id.toString();
            pusher.trigger(getRequestsChannel(targetUserId), 'request-updated', {
                request: request.toObject()
            });
        }

        return request;
    }

    /**
     * Cancel a request (student only, if pending)
     */
    static async cancelRequest(requestId: string, userId: string) {
        const repo = new RequestRepository();
        const request = await repo.findByIdForUpdate(requestId);

        if (!request) {
            throw new Error("Demande non trouvée");
        }

        // Only student can cancel, and only if pending
        if (request.studentId.toString() !== userId) {
            throw new Error("Non autorisé");
        }

        if (request.status !== RequestStatus.PENDING) {
            throw new Error("Seules les demandes en attente peuvent être annulées");
        }

        request.status = RequestStatus.CANCELLED;
        await repo.save(request);

        return request;
    }
}
