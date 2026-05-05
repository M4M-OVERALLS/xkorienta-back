import connectDB from "@/lib/mongodb";
import { SchoolController } from "@/lib/controllers/SchoolController";

export async function GET(req: Request) {
    await connectDB();
    return SchoolController.getSchools(req);
}
