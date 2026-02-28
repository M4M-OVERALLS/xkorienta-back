require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.DATABASE_URL;

async function checkExams() {
    try {
        console.log('Connexion à MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connecté à MongoDB\n');

        const Exam = mongoose.model('Exam', new mongoose.Schema({}, { strict: false }));

        // Compter tous les exams
        const totalExams = await Exam.countDocuments();
        console.log(`Total d'exams dans la DB: ${totalExams}`);

        // Compter les exams avec isPublicDemo
        const publicDemoCount = await Exam.countDocuments({ isPublicDemo: true });
        console.log(`Exams avec isPublicDemo=true: ${publicDemoCount}`);

        // Compter les exams publiés
        const publishedCount = await Exam.countDocuments({ isPublished: true });
        console.log(`Exams avec isPublished=true: ${publishedCount}`);

        // Compter les exams actifs
        const activeCount = await Exam.countDocuments({ isActive: true });
        console.log(`Exams avec isActive=true: ${activeCount}`);

        // Compter avec tous les critères
        const matchingCount = await Exam.countDocuments({
            isPublicDemo: true,
            isPublished: true,
            isActive: true
        });
        console.log(`Exams correspondant à TOUS les critères: ${matchingCount}\n`);

        // Afficher les détails des exams isPublicDemo
        const publicExams = await Exam.find({ isPublicDemo: true })
            .select('title isPublicDemo isPublished isActive status')
            .lean();

        console.log('Détails des exams avec isPublicDemo=true:');
        publicExams.forEach((exam, i) => {
            console.log(`\n${i + 1}. ${exam.title}`);
            console.log(`   - isPublicDemo: ${exam.isPublicDemo}`);
            console.log(`   - isPublished: ${exam.isPublished}`);
            console.log(`   - isActive: ${exam.isActive}`);
            console.log(`   - status: ${exam.status}`);
        });

    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n✓ Connexion fermée');
        process.exit(0);
    }
}

checkExams();
