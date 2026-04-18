import { randomUUID } from "crypto"
import { mkdir, writeFile, unlink } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"

const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

/** Returns the absolute public URL for a given relative path stored in DB */
function toAbsoluteUrl(relativePath: string): string {
    const apiBase = process.env.NEXTAUTH_URL || "http://localhost:3001"
    // Already absolute (e.g. OAuth avatar from Google/GitHub)
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
        return relativePath
    }
    return `${apiBase}${relativePath}`
}

/** Deletes an old local avatar file. Silently ignores if the file doesn't exist. */
async function deleteOldAvatar(oldImageUrl: string | undefined): Promise<void> {
    if (!oldImageUrl) return
    // Only delete files we own (local uploads, not OAuth avatars)
    if (!oldImageUrl.includes("/uploads/avatars/")) return

    try {
        // Strip any base URL prefix to get just the path portion
        const relativePath = oldImageUrl.replace(/^https?:\/\/[^/]+/, "")
        const absolutePath = path.join(process.cwd(), "public", relativePath)
        await unlink(absolutePath)
    } catch {
        // File missing or already deleted — not a blocking error
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "Non autorisé" }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get("avatar")

        if (!(file instanceof File)) {
            return NextResponse.json({ success: false, message: "Fichier avatar manquant" }, { status: 400 })
        }

        const mimeType = file.type.toLowerCase()
        const ext = ALLOWED_MIME_TO_EXT[mimeType]
        if (!ext) {
            return NextResponse.json({ success: false, message: "Format non supporté (jpg, png, webp)" }, { status: 400 })
        }

        if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json({ success: false, message: "Taille invalide. Max 2MB." }, { status: 400 })
        }

        await connectDB()
        const user = await User.findById(session.user.id)
        if (!user) {
            return NextResponse.json({ success: false, message: "Utilisateur non trouvé" }, { status: 404 })
        }

        // Delete old avatar before writing the new one
        await deleteOldAvatar(user.image)

        // Write new file
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileName = `${session.user.id}-${randomUUID()}.${ext}`
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "avatars")
        const absolutePath = path.join(uploadsDir, fileName)
        const relativeUrl = `/uploads/avatars/${fileName}`
        const publicUrl = toAbsoluteUrl(relativeUrl)

        await mkdir(uploadsDir, { recursive: true })
        await writeFile(absolutePath, buffer)

        user.image = publicUrl
        user.metadata = {
            ...(user.metadata || {}),
            avatar: publicUrl,
        }
        await user.save()

        return NextResponse.json({
            success: true,
            message: "Avatar mis à jour",
            user: { image: publicUrl },
        })
    } catch (error: any) {
        console.error("[Avatar Upload] Error:", error)
        return NextResponse.json(
            { success: false, message: error.message || "Erreur serveur" },
            { status: 500 }
        )
    }
}
