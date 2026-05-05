require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.DATABASE_URL;

async function checkExams() {
    try {
        await mongoose.connect(MONGODB_URI);

        const Exam = mongoose.model('Exam', new mongoose.Schema({}, { strict: false }));

        // Compter tous les exams
        const totalExams = await Exam.countDocuments();

        // Compter les exams avec isPublicDemo
        const publicDemoCount = await Exam.countDocuments({ isPublicDemo: true });

        // Compter les exams publiés
        const publishedCount = await Exam.countDocuments({ isPublished: true });

        // Compter les exams actifs
        const activeCount = await Exam.countDocuments({ isActive: true });

        // Compter avec tous les critères
        const matchingCount = await Exam.countDocuments({
            isPublicDemo: true,
            isPublished: true,
            isActive: true
        });

        // Afficher les détails des exams isPublicDemo
        const publicExams = await Exam.find({ isPublicDemo: true })
            .select('title isPublicDemo isPublished isActive status')
            .lean();
        publicExams.forEach((exam, i) => {
        });

    } catch (error) {
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

checkExams();
