import { RequestRepository } from "@/lib/repositories/RequestRepository";
import { RequestType, RequestStatus, RequestPriority, TeacherType, IRequest } from "@/models/Request";
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
        
        if (role === UserRole.STUDENT) {
            let query: any = { studentId: userId };
            if (filters?.status) query.status = filters.status;
            if (filters?.type) query.type = filters.type;
            return await repo.find(query);
        } else if (role === UserRole.TEACHER) {
            // Teachers see:
            // 1. Direct requests assigned to them
            // 2. School requests without specific teacher (available to all school teachers)
            // 3. External requests that are available (not yet claimed)
            const directQuery: any = { teacherId: userId };
            const schoolGeneralQuery: any = { 
                teacherType: TeacherType.SCHOOL,
                teacherId: { $exists: false },
                status: RequestStatus.PENDING
            };
            const externalQuery: any = { 
                teacherType: TeacherType.EXTERNAL,
                status: RequestStatus.AVAILABLE 
            };
            
            if (filters?.status) {
                directQuery.status = filters.status;
                schoolGeneralQuery.status = filters.status;
                // For external, only show AVAILABLE unless filtering by status
                if (filters.status !== RequestStatus.AVAILABLE) {
                    externalQuery.status = filters.status;
                }
            }
            if (filters?.type) {
                directQuery.type = filters.type;
                schoolGeneralQuery.type = filters.type;
                externalQuery.type = filters.type;
            }
            
            // Get all types of requests
            const [directRequests, schoolGeneralRequests, externalRequests] = await Promise.all([
                repo.find(directQuery),
                repo.find(schoolGeneralQuery),
                repo.find(externalQuery)
            ]);
            
            return [...directRequests, ...schoolGeneralRequests, ...externalRequests];
        } else {
            throw new Error("Rôle non autorisé");
        }
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
        teacherId?: string;
        type: RequestType;
        subjectId?: string;
        title: string;
        message: string;
        priority?: RequestPriority;
        relatedExamId?: string;
        relatedConceptIds?: string[];
        teacherType?: TeacherType;
    }, studentId: string) {
        const repo = new RequestRepository();

        if (!data.type || !data.title || !data.message) {
            throw new Error("Champs requis manquants");
        }

        if (!Object.values(RequestType).includes(data.type)) {
            throw new Error("Type de demande invalide");
        }

        const isExternal = data.teacherType === TeacherType.EXTERNAL;
        
        // For school requests with specific teacher, validate the teacher
        // If no teacherId is provided for school request, it will be available to all school teachers

        // Build request data carefully - don't include undefined fields
        const requestData: any = {
            studentId: new mongoose.Types.ObjectId(studentId),
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority || RequestPriority.MEDIUM,
            teacherType: data.teacherType || TeacherType.SCHOOL,
            status: isExternal ? RequestStatus.AVAILABLE : RequestStatus.PENDING
        };

        // Only add optional fields if they have values
        if (data.subjectId) {
            requestData.subject = new mongoose.Types.ObjectId(data.subjectId);
        }
        if (data.relatedExamId) {
            requestData.relatedExam = new mongoose.Types.ObjectId(data.relatedExamId);
        }
        if (data.relatedConceptIds && data.relatedConceptIds.length > 0) {
            requestData.relatedConcepts = data.relatedConceptIds.map(id => new mongoose.Types.ObjectId(id));
        }

        // Only add teacherId for school requests with specific teacher
        if (data.teacherId) {
            requestData.teacherId = new mongoose.Types.ObjectId(data.teacherId);
        }

        // Add payment info for external requests
        if (isExternal) {
            requestData.payment = {
                amount: 5000,  // Fixed price for now
                currency: 'XOF',
                status: 'PENDING'
            };
        }

        const newRequest = await repo.create(requestData);

        // Only send notifications for school requests (external requests have no teacher yet)
        if (!isExternal && data.teacherId) {
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
        }

        return newRequest;
    }

    /**
     * Claim a request (teacher takes an available request - external or school general)
     */
    static async claimExternalRequest(requestId: string, teacherId: string) {
        const repo = new RequestRepository();
        const request = await repo.findByIdForUpdate(requestId);

        if (!request) {
            throw new Error("Demande non trouvée");
        }

        const requestData = request as any;

        // Handle external requests (status AVAILABLE)
        if (requestData.teacherType === TeacherType.EXTERNAL) {
            if (requestData.status !== RequestStatus.AVAILABLE) {
                throw new Error("Cette demande n'est plus disponible");
            }
        } 
        // Handle school general requests (no teacherId assigned yet)
        else if (requestData.teacherType === TeacherType.SCHOOL) {
            if (requestData.teacherId) {
                throw new Error("Cette demande est déjà assignée à un professeur");
            }
            if (requestData.status !== RequestStatus.PENDING) {
                throw new Error("Cette demande n'est plus disponible");
            }
        }
        else {
            throw new Error("Type de demande non pris en charge");
        }

        // Update the request
        requestData.teacherId = new mongoose.Types.ObjectId(teacherId);
        requestData.status = RequestStatus.PENDING;
        const updatedRequest = await repo.save(request);

        // Notify student
        const pusher = getPusherServer();
        if (pusher) {
            pusher.trigger(getRequestsChannel(requestData.studentId.toString()), 'request-claimed', {
                request: updatedRequest.toObject()
            });
        }

        return updatedRequest;
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
        const isTeacher = request.teacherId?._id?.toString() === userId;

        // For external requests that are available, only the student can access
        // For assigned requests, both student and teacher can access
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
                    teacherName: (request.teacherId as any)?.name || 'Enseignant',
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
                userId: isStudent ? request.teacherId?._id : request.studentId._id,
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
            const targetUserId = isTeacher ? request.studentId._id.toString() : request.teacherId?._id?.toString();
            if (targetUserId) {
                pusher.trigger(getRequestsChannel(targetUserId), 'request-updated', {
                    request: request.toObject()
                });
            }
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
