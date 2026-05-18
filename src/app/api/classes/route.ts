import { authOptions } from "@/lib/auth";
import { ClassController } from "@/lib/controllers/ClassController";
import connectDB from "@/lib/mongodb";
import "@/models/Class";
import "@/models/EducationLevel";
import { UserRole } from "@/models/enums";
import "@/models/Field";
import "@/models/School";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  await connectDB();
  return ClassController.getClasses(
    req,
    session.user.id,
    session.user.role as UserRole,
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== UserRole.TEACHER) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  await connectDB();
  return ClassController.createClass(req, session.user.id);
}
