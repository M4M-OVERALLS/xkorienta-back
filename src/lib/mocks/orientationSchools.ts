// Types locaux pour éviter d'importer mongoose dans les composants client
export const SchoolType = {
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY",
  HIGHER_ED: "HIGHER_ED",
  TRAINING_CENTER: "TRAINING_CENTER",
  OTHER: "OTHER",
} as const;

export const SchoolStatus = {
  PENDING: "PENDING",
  VALIDATED: "VALIDATED",
  REJECTED: "REJECTED",
} as const;

export type OrientationSchoolDTO = {
  _id: string;
  name: string;
  type: (typeof SchoolType)[keyof typeof SchoolType] | string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  status?: (typeof SchoolStatus)[keyof typeof SchoolStatus] | string;
  contactInfo?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  // Données pour l'orientation
  specialties?: string[];
  accreditation?: string[];
  tuitionFee?: { min: number; max: number; currency: string };
  modality?: "PRESENTIEL" | "HYBRIDE" | "DISTANCE";
  languages?: string[];
  xkorientaScore?: number; // 0-100
  badges?: {
    employment?: boolean;
    alternance?: boolean;
    certifications?: string[];
  };
  academicLevel?: string[];
  // Données pour la comparaison
  degrees?: string[]; // Diplômes délivrés
  duration?: { min: number; max: number; unit: "mois" | "ans" }; // Durée des formations
  employability?: number; // Taux d'employabilité en %
  partnerships?: string[]; // Partenariats avec entreprises/universités
  recognition?: string[]; // Reconnaissances officielles
  studentCount?: number; // Nombre d'étudiants
  foundedYear?: number; // Année de création
  // Données pour la page de détails
  description?: string; // Description complète de l'école
  learningOutcomes?: string[]; // Ce que tu vas apprendre
  careerPaths?: {
    title: string;
    salary: string;
    demand: "high" | "medium" | "low";
  }[]; // Débouchés professionnels
  programs?: {
    name: string;
    duration: string;
    degree: string;
    description: string;
  }[]; // Syllabuss détaillés
  tuitionDetails?: {
    registrationFee: number;
    tuitionPerYear: number;
    paymentOptions: string[];
    scholarships: boolean;
  }; // Détails des coûts
};

/**
 * Fallback data (mocks) used when DB is not reachable during development.
 * Keep it small and representative.
 */
export const ORIENTATION_SCHOOLS_MOCK: OrientationSchoolDTO[] = [
  {
    _id: "mock-school-1",
    name: "ISSIMA - Institut Supérieur",
    type: SchoolType.HIGHER_ED,
    address: "Yaoundé, Cameroun",
    city: "Yaoundé",
    country: "Cameroun",
    logoUrl: "/logo_xkorienta.png",
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      website: "https://issima.cm",
      email: "contact@issima.cm",
      phone: "+237 222 123 456",
    },
    specialties: ["Informatique", "Génie Civil", "Management"],
    accreditation: ["MINESTERE", "CAMES"],
    tuitionFee: { min: 350000, max: 800000, currency: "FCFA" },
    modality: "HYBRIDE",
    languages: ["Français", "Anglais"],
    xkorientaScore: 92,
    badges: {
      employment: true,
      alternance: true,
      certifications: ["ISO 9001"],
    },
    academicLevel: ["Licence", "Master"],
    degrees: ["Licence Pro", "Master", "Ingénieur"],
    duration: { min: 3, max: 5, unit: "ans" },
    employability: 82,
    partnerships: [
      "Total Energies",
      "MTN",
      "Orange Cameroun",
      "Société Générale",
    ],
    recognition: ["MINESTERE", "CAMES", "Ordre des Ingénieurs"],
    studentCount: 1200,
    foundedYear: 2010,
    description:
      "ISSIMA est un institut supérieur de référence en Afrique centrale, offrant des formations de qualité dans les domaines de l'informatique, du génie civil et du management. Notre approche pédagogique combine théorie et pratique pour former des professionnels compétents et immédiatement opérationnels sur le marché du travail.",
    learningOutcomes: [
      "Maîtriser les technologies de pointe dans votre domaine",
      "Développer des compétences en gestion de projets",
      "Acquérir une expérience professionnelle via des stages",
      "Travailler sur des projets réels avec nos partenaires",
    ],
    careerPaths: [
      {
        title: "Ingénieur Logiciel",
        salary: "800k - 2M FCFA/an",
        demand: "high",
      },
      {
        title: "Chef de Projet IT",
        salary: "1.2M - 3M FCFA/an",
        demand: "high",
      },
      {
        title: "Ingénieur Génie Civil",
        salary: "900k - 2.5M FCFA/an",
        demand: "medium",
      },
      {
        title: "Consultant en Management",
        salary: "1M - 2.8M FCFA/an",
        demand: "medium",
      },
    ],
    programs: [
      {
        name: "Licence Informatique",
        duration: "3 ans",
        degree: "Licence Professionnelle",
        description:
          "Formation complète en développement logiciel, bases de données, réseaux et cybersécurité",
      },
      {
        name: "Master Génie Logiciel",
        duration: "2 ans",
        degree: "Master",
        description:
          "Spécialisation en architecture logicielle, cloud computing et intelligence artificielle",
      },
      {
        name: "Ingénieur Génie Civil",
        duration: "5 ans",
        degree: "Diplôme d'Ingénieur",
        description:
          "Formation d'ingénieur en construction, structures et gestion de projets BTP",
      },
    ],
    tuitionDetails: {
      registrationFee: 50000,
      tuitionPerYear: 500000,
      paymentOptions: [
        "Paiement annuel",
        "Paiement semestriel",
        "Paiement trimestriel",
      ],
      scholarships: true,
    },
  },
  {
    _id: "mock-school-2",
    name: "École Polytechnique de Douala",
    type: SchoolType.HIGHER_ED,
    address: "Douala, Cameroun",
    city: "Douala",
    country: "Cameroun",
    logoUrl: undefined,
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      email: "info@polytech-douala.cm",
      phone: "+237 233 456 789",
    },
    specialties: ["Génie Électrique", "Mécanique", "Télécommunications"],
    accreditation: ["MINESTERE"],
    tuitionFee: { min: 450000, max: 950000, currency: "FCFA" },
    modality: "PRESENTIEL",
    languages: ["Français"],
    xkorientaScore: 88,
    badges: {
      employment: true,
      alternance: false,
      certifications: [],
    },
    academicLevel: ["Licence", "Master", "Doctorat"],
    degrees: ["Licence", "Master", "Doctorat", "Ingénieur"],
    duration: { min: 3, max: 8, unit: "ans" },
    employability: 77,
    partnerships: ["Schneider Electric", "ENEO", "AES SONEL"],
    recognition: ["MINESTERE", "CTI (France)"],
    studentCount: 2500,
    foundedYear: 1995,
    description:
      "L'École Polytechnique de Douala est une institution d'excellence formant des ingénieurs dans les domaines du génie électrique, de la mécanique et des télécommunications. Nos diplômés sont reconnus pour leur expertise technique et leur capacité d'innovation.",
    learningOutcomes: [
      "Concevoir et réaliser des systèmes électriques complexes",
      "Maîtriser les outils de CAO/DAO industriels",
      "Gérer des projets d'ingénierie de grande envergure",
      "Innover dans les technologies de télécommunications",
    ],
    careerPaths: [
      {
        title: "Ingénieur Électricien",
        salary: "1M - 2.5M FCFA/an",
        demand: "high",
      },
      {
        title: "Ingénieur Télécoms",
        salary: "1.2M - 3M FCFA/an",
        demand: "high",
      },
      {
        title: "Ingénieur Maintenance",
        salary: "800k - 2M FCFA/an",
        demand: "medium",
      },
      {
        title: "Chef de Projet Industriel",
        salary: "1.5M - 3.5M FCFA/an",
        demand: "medium",
      },
    ],
    programs: [
      {
        name: "Génie Électrique",
        duration: "5 ans",
        degree: "Diplôme d'Ingénieur",
        description:
          "Formation complète en électrotechnique, automatisme et énergies renouvelables",
      },
      {
        name: "Télécommunications",
        duration: "5 ans",
        degree: "Diplôme d'Ingénieur",
        description:
          "Expertise en réseaux, systèmes de communication et technologies 5G",
      },
    ],
    tuitionDetails: {
      registrationFee: 75000,
      tuitionPerYear: 650000,
      paymentOptions: ["Paiement annuel", "Paiement semestriel"],
      scholarships: false,
    },
  },
  {
    _id: "mock-school-3",
    name: "Centre de Formation Tech",
    type: SchoolType.TRAINING_CENTER,
    address: "Bafoussam, Cameroun",
    city: "Bafoussam",
    country: "Cameroun",
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      email: "contact@cftech.cm",
      phone: "+237 233 789 012",
    },
    specialties: ["Développement Web", "Data Science", "Cybersécurité"],
    accreditation: ["Certifié MINEFOP"],
    tuitionFee: { min: 150000, max: 300000, currency: "FCFA" },
    modality: "HYBRIDE",
    languages: ["Français", "Anglais"],
    xkorientaScore: 75,
    badges: {
      employment: false,
      alternance: true,
      certifications: ["Cisco", "AWS"],
    },
    academicLevel: ["Certification", "Diplôme"],
    degrees: ["Certificat Pro", "Diplôme Technicien"],
    duration: { min: 6, max: 18, unit: "mois" },
    employability: 65,
    partnerships: ["Microsoft", "Google", "Huawei"],
    recognition: ["MINEFOP", "Cisco Academy"],
    studentCount: 450,
    foundedYear: 2018,
    description:
      "Le Centre de Formation Tech propose des formations courtes et intensives dans les métiers du numérique. Nous préparons nos apprenants aux certifications internationales reconnues par l'industrie tech mondiale.",
    learningOutcomes: [
      "Créer des applications web modernes avec React, Node.js",
      "Analyser des données avec Python et outils BI",
      "Sécuriser des systèmes informationnels",
      "Obtenir des certifications professionnelles internationales",
    ],
    careerPaths: [
      {
        title: "Développeur Web",
        salary: "400k - 1.5M FCFA/an",
        demand: "high",
      },
      { title: "Data Analyst", salary: "500k - 1.8M FCFA/an", demand: "high" },
      {
        title: "Analyste Cybersécurité",
        salary: "600k - 2M FCFA/an",
        demand: "high",
      },
      {
        title: "DevOps Engineer",
        salary: "700k - 2.5M FCFA/an",
        demand: "medium",
      },
    ],
    programs: [
      {
        name: "Développement Web Full Stack",
        duration: "12 mois",
        degree: "Certificat Professionnel",
        description:
          "HTML/CSS, JavaScript, React, Node.js, MongoDB - Formation pratique intensive",
      },
      {
        name: "Data Science & IA",
        duration: "18 mois",
        degree: "Diplôme Technicien",
        description:
          "Python, Machine Learning, Big Data, Visualisation de données",
      },
      {
        name: "Cybersécurité",
        duration: "12 mois",
        degree: "Certificat Cisco",
        description:
          "Sécurité réseau, Ethical Hacking, préparation certification Cisco CCNA Security",
      },
    ],
    tuitionDetails: {
      registrationFee: 25000,
      tuitionPerYear: 200000,
      paymentOptions: [
        "Paiement mensuel",
        "Paiement trimestriel",
        "Paiement complet",
      ],
      scholarships: true,
    },
  },
  {
    _id: "mock-school-4",
    name: "Université de Yaoundé I",
    type: SchoolType.HIGHER_ED,
    address: "Yaoundé, Cameroun",
    city: "Yaoundé",
    country: "Cameroun",
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      website: "https://uy1.cm",
      email: "info@uy1.cm",
      phone: "+237 222 234 567",
    },
    specialties: ["Sciences", "Médecine", "Droit", "Lettres"],
    accreditation: ["MINESTERE", "CAMES", "UNESCO"],
    tuitionFee: { min: 50000, max: 200000, currency: "FCFA" },
    modality: "PRESENTIEL",
    languages: ["Français", "Anglais"],
    xkorientaScore: 95,
    badges: {
      employment: true,
      alternance: false,
      certifications: ["Accréditation Internationale"],
    },
    academicLevel: ["Licence", "Master", "Doctorat"],
    degrees: ["Licence", "Master", "Doctorat", "Agrégation"],
    duration: { min: 3, max: 8, unit: "ans" },
    employability: 85,
    partnerships: [
      "Université Paris-Sorbonne",
      "Hôpitaux Publics",
      "Barreau du Cameroun",
    ],
    recognition: ["MINESTERE", "CAMES", "UNESCO", "AUF"],
    studentCount: 15000,
    foundedYear: 1962,
    description:
      "L'Université de Yaoundé I est la plus ancienne et prestigieuse université du Cameroun. Elle offre une formation académique de haut niveau dans de nombreux domaines, alliant excellence académique et recherche scientifique.",
    learningOutcomes: [
      "Acquérir des connaissances académiques solides",
      "Développer l'esprit critique et analytique",
      "Participer à la recherche scientifique",
      "Préparer des carrières dans l'enseignement et la recherche",
    ],
    careerPaths: [
      { title: "Médecin", salary: "1.5M - 5M FCFA/an", demand: "high" },
      { title: "Avocat", salary: "1M - 4M FCFA/an", demand: "medium" },
      { title: "Chercheur", salary: "800k - 2M FCFA/an", demand: "medium" },
      {
        title: "Enseignant Universitaire",
        salary: "1M - 2.5M FCFA/an",
        demand: "medium",
      },
    ],
    programs: [
      {
        name: "Médecine Générale",
        duration: "7 ans",
        degree: "Doctorat en Médecine",
        description:
          "Formation complète en médecine clinique et recherche médicale",
      },
      {
        name: "Droit",
        duration: "5 ans",
        degree: "Master en Droit",
        description: "Droit privé, public, international et des affaires",
      },
    ],
    tuitionDetails: {
      registrationFee: 25000,
      tuitionPerYear: 100000,
      paymentOptions: ["Paiement annuel"],
      scholarships: true,
    },
  },
  {
    _id: "mock-school-5",
    name: "Institut des Beaux-Arts",
    type: SchoolType.HIGHER_ED,
    address: "Douala, Cameroun",
    city: "Douala",
    country: "Cameroun",
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      email: "contact@iba-douala.cm",
      phone: "+237 233 567 890",
    },
    specialties: ["Design Graphique", "Architecture", "Arts Visuels"],
    accreditation: ["MINESTERE"],
    tuitionFee: { min: 250000, max: 500000, currency: "FCFA" },
    modality: "PRESENTIEL",
    languages: ["Français"],
    xkorientaScore: 80,
    badges: {
      employment: true,
      alternance: true,
      certifications: [],
    },
    academicLevel: ["Licence", "Master"],
    degrees: ["Licence Arts", "Master Design"],
    duration: { min: 3, max: 5, unit: "ans" },
    employability: 70,
    partnerships: ["Agences Pub Douala", "Studios d'Architecture"],
    recognition: ["MINESTERE", "Ordre des Architectes"],
    studentCount: 800,
    foundedYear: 2005,
    description:
      "L'Institut des Beaux-Arts forme des créatifs et designers capables de répondre aux besoins du marché local et international. Notre approche combine créativité artistique et maîtrise technique.",
    learningOutcomes: [
      "Maîtriser les logiciels de création (Adobe Suite, AutoCAD)",
      "Développer votre sens artistique et créatif",
      "Réaliser des projets professionnels concrets",
      "Comprendre les tendances du design contemporain",
    ],
    careerPaths: [
      {
        title: "Designer Graphique",
        salary: "400k - 1.5M FCFA/an",
        demand: "medium",
      },
      { title: "Architecte", salary: "1M - 3M FCFA/an", demand: "medium" },
      {
        title: "Directeur Artistique",
        salary: "800k - 2.5M FCFA/an",
        demand: "low",
      },
      { title: "UI/UX Designer", salary: "600k - 2M FCFA/an", demand: "high" },
    ],
    programs: [
      {
        name: "Design Graphique",
        duration: "3 ans",
        degree: "Licence Arts Appliqués",
        description:
          "Formation en design visuel, branding et communication visuelle",
      },
      {
        name: "Architecture",
        duration: "5 ans",
        degree: "Master Architecture",
        description:
          "Conception architecturale, urbanisme et gestion de projets BTP",
      },
    ],
    tuitionDetails: {
      registrationFee: 40000,
      tuitionPerYear: 350000,
      paymentOptions: ["Paiement annuel", "Paiement semestriel"],
      scholarships: false,
    },
  },
  {
    _id: "mock-school-6",
    name: "Business School Cameroun",
    type: SchoolType.HIGHER_ED,
    address: "Yaoundé, Cameroun",
    city: "Yaoundé",
    country: "Cameroun",
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      website: "https://bsc.cm",
      email: "admissions@bsc.cm",
      phone: "+237 222 345 678",
    },
    specialties: ["Finance", "Marketing", "Entrepreneuriat"],
    accreditation: ["AACSB", "EQUIS", "AMBA"],
    tuitionFee: { min: 1000000, max: 2500000, currency: "FCFA" },
    modality: "HYBRIDE",
    languages: ["Français", "Anglais"],
    xkorientaScore: 97,
    badges: {
      employment: true,
      alternance: true,
      certifications: ["Triple Couronne"],
    },
    academicLevel: ["Licence", "Master", "MBA"],
    degrees: ["Bachelor", "Master", "MBA", "Executive MBA"],
    duration: { min: 3, max: 5, unit: "ans" },
    employability: 93,
    partnerships: ["BNP Paribas", "Société Générale", "Deloitte", "PWC"],
    recognition: ["AACSB", "EQUIS", "AMBA", "Financial Times Top 100"],
    studentCount: 1800,
    foundedYear: 2000,
    description:
      "Business School Cameroun est la première école de commerce Triple Couronne d'Afrique centrale. Nous formons les leaders et entrepreneurs de demain avec une vision internationale et une expertise africaine.",
    learningOutcomes: [
      "Maîtriser les fondamentaux du business et de la finance",
      "Développer votre leadership et capacités managériales",
      "Créer et gérer votre propre entreprise",
      "Construire un réseau professionnel international",
    ],
    careerPaths: [
      {
        title: "Directeur Financier",
        salary: "2M - 6M FCFA/an",
        demand: "high",
      },
      {
        title: "Consultant en Stratégie",
        salary: "1.5M - 5M FCFA/an",
        demand: "high",
      },
      {
        title: "Chef de Produit Marketing",
        salary: "1.2M - 4M FCFA/an",
        demand: "medium",
      },
      { title: "Entrepreneur", salary: "Variable", demand: "high" },
    ],
    programs: [
      {
        name: "Bachelor in Business Administration",
        duration: "3 ans",
        degree: "Bachelor",
        description:
          "Formation généraliste en management, finance et marketing",
      },
      {
        name: "MBA Finance",
        duration: "2 ans",
        degree: "MBA",
        description:
          "Expertise en finance d'entreprise, marchés financiers et gestion de portefeuille",
      },
      {
        name: "Master Entrepreneuriat",
        duration: "2 ans",
        degree: "Master",
        description: "Création d'entreprise, innovation et gestion de start-up",
      },
    ],
    tuitionDetails: {
      registrationFee: 150000,
      tuitionPerYear: 1500000,
      paymentOptions: ["Paiement annuel", "Paiement semestriel"],
      scholarships: true,
    },
  },
  {
    _id: "mock-school-7",
    name: "Institut Supérieur de Technologie",
    type: SchoolType.TRAINING_CENTER,
    address: "Bamenda, Cameroun",
    city: "Bamenda",
    country: "Cameroun",
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      email: "info@ist-bamenda.cm",
      phone: "+237 233 890 123",
    },
    specialties: ["Réseau et Systèmes", "DevOps", "IoT"],
    accreditation: ["MINEFOP"],
    tuitionFee: { min: 200000, max: 400000, currency: "FCFA" },
    modality: "DISTANCE",
    languages: ["Anglais"],
    xkorientaScore: 70,
    badges: {
      employment: false,
      alternance: false,
      certifications: ["CompTIA", "Microsoft"],
    },
    academicLevel: ["Certification"],
    degrees: ["Certificat CompTIA", "Certificat Microsoft"],
    duration: { min: 3, max: 12, unit: "mois" },
    employability: 60,
    partnerships: ["Cisco", "Microsoft", "CompTIA"],
    recognition: ["MINEFOP", "CompTIA Authorized"],
    studentCount: 300,
    foundedYear: 2020,
    description:
      "IST Bamenda propose des formations 100% en ligne dans les technologies de l'information. Nos Syllabuss sont conçus pour les professionnels souhaitant se reconvertir ou monter en compétences.",
    learningOutcomes: [
      "Administrer des réseaux informatiques",
      "Gérer des infrastructures cloud (Azure, AWS)",
      "Automatiser le déploiement d'applications",
      "Obtenir des certifications reconnues mondialement",
    ],
    careerPaths: [
      {
        title: "Administrateur Réseau",
        salary: "500k - 1.5M FCFA/an",
        demand: "medium",
      },
      {
        title: "Ingénieur DevOps",
        salary: "800k - 2.5M FCFA/an",
        demand: "high",
      },
      {
        title: "Technicien Support IT",
        salary: "350k - 1M FCFA/an",
        demand: "medium",
      },
    ],
    programs: [
      {
        name: "Certification CompTIA Network+",
        duration: "6 mois",
        degree: "Certificat CompTIA",
        description:
          "Fondamentaux des réseaux, préparation à la certification Network+",
      },
      {
        name: "Microsoft Azure Administrator",
        duration: "4 mois",
        degree: "Certificat Microsoft",
        description: "Administration cloud Azure, préparation AZ-104",
      },
    ],
    tuitionDetails: {
      registrationFee: 20000,
      tuitionPerYear: 250000,
      paymentOptions: ["Paiement mensuel", "Paiement complet avec réduction"],
      scholarships: false,
    },
  },
  {
    _id: "mock-school-8",
    name: "École de Santé Publique",
    type: SchoolType.HIGHER_ED,
    address: "Douala, Cameroun",
    city: "Douala",
    country: "Cameroun",
    status: SchoolStatus.VALIDATED,
    contactInfo: {
      email: "contact@esp-douala.cm",
      phone: "+237 233 456 123",
    },
    specialties: ["Épidémiologie", "Santé Communautaire", "Nutrition"],
    accreditation: ["MINESTERE", "OMS"],
    tuitionFee: { min: 300000, max: 700000, currency: "FCFA" },
    modality: "PRESENTIEL",
    languages: ["Français", "Anglais"],
    xkorientaScore: 89,
    badges: {
      employment: true,
      alternance: true,
      certifications: ["OMS Certified"],
    },
    academicLevel: ["Licence", "Master"],
    degrees: ["Licence Santé Publique", "Master Épidémiologie"],
    duration: { min: 3, max: 5, unit: "ans" },
    employability: 88,
    partnerships: ["OMS", "Hôpitaux Régionaux", "Croix-Rouge"],
    recognition: ["MINESTERE", "OMS", "UNICEF Partner"],
    studentCount: 600,
    foundedYear: 2008,
    description:
      "L'École de Santé Publique forme des professionnels capables d'améliorer la santé des populations. Nos Syllabuss combinent sciences médicales, statistiques et politiques de santé.",
    learningOutcomes: [
      "Analyser les problèmes de santé des populations",
      "Concevoir des Syllabuss de prévention",
      "Gérer des projets de santé communautaire",
      "Collaborer avec les organisations internationales",
    ],
    careerPaths: [
      { title: "Épidémiologiste", salary: "1M - 2.5M FCFA/an", demand: "high" },
      {
        title: "Responsable Santé Publique",
        salary: "1.2M - 3M FCFA/an",
        demand: "medium",
      },
      {
        title: "Nutritionniste",
        salary: "600k - 1.8M FCFA/an",
        demand: "medium",
      },
      {
        title: "Consultant OMS/ONG",
        salary: "1.5M - 4M FCFA/an",
        demand: "high",
      },
    ],
    programs: [
      {
        name: "Licence Santé Publique",
        duration: "3 ans",
        degree: "Licence",
        description:
          "Fondamentaux de la santé publique, épidémiologie et prévention",
      },
      {
        name: "Master Épidémiologie",
        duration: "2 ans",
        degree: "Master",
        description:
          "Recherche épidémiologique, biostatistiques et gestion d'épidémies",
      },
    ],
    tuitionDetails: {
      registrationFee: 50000,
      tuitionPerYear: 450000,
      paymentOptions: ["Paiement annuel", "Paiement semestriel"],
      scholarships: true,
    },
  },
];
