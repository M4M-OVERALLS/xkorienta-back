import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStudentShortlist extends Document {
    _id: mongoose.Types.ObjectId;
    student: mongoose.Types.ObjectId; // Ref: User
    schools: mongoose.Types.ObjectId[]; // Refs: School
    specialties: mongoose.Types.ObjectId[]; // Refs: Specialty
    createdAt: Date;
    updatedAt: Date;
}

const StudentShortlistSchema = new Schema<IStudentShortlist>(
    {
        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        schools: [
            {
                type: Schema.Types.ObjectId,
                ref: "School"
            }
        ],
        specialties: [
            {
                type: Schema.Types.ObjectId,
                ref: "Specialty"
            }
        ]
    },
    {
        timestamps: true
    }
);

// Indexes
StudentShortlistSchema.index({ student: 1 }, { unique: true });
StudentShortlistSchema.index({ schools: 1 });
StudentShortlistSchema.index({ specialties: 1 });

// Prevent model recompilation in development
const StudentShortlist: Model<IStudentShortlist> =
    mongoose.models.StudentShortlist ||
    mongoose.model<IStudentShortlist>("StudentShortlist", StudentShortlistSchema);

export default StudentShortlist;
