import { UserRole } from '@/models/enums'

/** Roles administrateurs plateforme (DG M4M, support technique). */
export const PLATFORM_ADMIN_ROLES: UserRole[] = [UserRole.DG_M4M, UserRole.TECH_SUPPORT]

/** Indique si le role correspond a un administrateur plateforme. */
export function isPlatformAdmin(role?: string | null): boolean {
    return !!role && PLATFORM_ADMIN_ROLES.includes(role as UserRole)
}

/** Indique si le role correspond a un admin ecole ou plateforme. */
export function isSchoolOrPlatformAdmin(role?: string | null): boolean {
    return role === UserRole.SCHOOL_ADMIN || isPlatformAdmin(role)
}
