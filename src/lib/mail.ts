import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'mail.xkorin.com',
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.MAIL_USER || 'contact@xkorin.com',
        pass: process.env.MAIL_PASSWORD,
    },
    tls: {
        rejectUnauthorized: false
    }
});

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

// Brand Colors
const COLORS = {
    primary: '#10B981', // Green (Secondary in app)
    secondary: '#7C3AED', // Purple
    text: '#1F2937',
    gray: '#6B7280',
    background: '#F3F4F6',
    white: '#FFFFFF',
    error: '#EF4444',
    warning: '#F59E0B'
};

const STYLES = {
    body: `font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${COLORS.background}; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;`,
    container: `max-width: 600px; margin: 40px auto; background-color: ${COLORS.white}; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); overflow: hidden;`,
    header: `background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%); padding: 40px 30px; text-align: center;`,
    headerTitle: `color: ${COLORS.white}; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;`,
    headerSubtitle: `color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 15px;`,
    content: `padding: 40px 30px; color: ${COLORS.text}; font-size: 16px; line-height: 1.6;`,
    button: `display: inline-block; padding: 14px 32px; background-color: ${COLORS.primary}; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.secondary} 100%); color: ${COLORS.white}; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; margin: 24px 0; text-align: center; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);`,
    infoBox: `background-color: #F0FDFA; border: 1px solid #CCFBF1; border-radius: 16px; padding: 20px; margin: 24px 0;`,
    infoBoxTitle: `color: ${COLORS.primary}; font-weight: 600; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;`,
    infoBoxText: `margin: 0; color: ${COLORS.text}; font-size: 15px;`,
    footer: `background-color: #F8FAFC; padding: 30px; text-align: center; border-top: 1px solid #E2E8F0;`,
    footerText: `color: ${COLORS.gray}; font-size: 13px; margin: 4px 0; line-height: 1.5;`
};

const emailWrapper = (title: string, subtitle: string, content: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <title>${title}</title>
</head>
<body style="${STYLES.body}">
    <div style="${STYLES.container}">
        <div style="${STYLES.header}">
            <div style="margin-bottom: 20px;">
                <!-- Logo placeholder icon -->
                <img src="https://img.icons8.com/fluency/96/graduation-cap.png" alt="Logo" width="48" height="48" style="filter: brightness(0) invert(1);">
            </div>
            <h1 style="${STYLES.headerTitle}">${title}</h1>
            ${subtitle ? `<p style="${STYLES.headerSubtitle}">${subtitle}</p>` : ''}
        </div>
        
        <div style="${STYLES.content}">
            ${content}
        </div>
        
        <div style="${STYLES.footer}">
            <p style="${STYLES.footerText}">© ${new Date().getFullYear()} Xkorin School. Tous droits réservés.</p>
            <p style="${STYLES.footerText}">Cet email a été envoyé automatiquement pour vous informer des activités liées à votre compte.</p>
            <div style="margin-top: 16px;">
                 <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: ${COLORS.primary}; text-decoration: none; font-size: 13px; font-weight: 600;">Accéder à la plateforme</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

export const sendEmail = async ({ to, subject, html }: MailOptions) => {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME || 'Xkorin School'}" <${process.env.MAIL_SOURCE || 'contact@xkorin.com'}>`,
            to,
            subject,
            html,
        });

        console.log("Message sent: %s", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email: ", error);
        return { success: false, error };
    }
};

// Email de bienvenue après inscription
export const sendWelcomeEmail = async (email: string, userName: string, className: string) => {
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;

    const content = `
        <p>Bonjour <strong>${userName}</strong>, 👋</p>
        <p>Bienvenue dans la communauté ! Votre compte a été créé avec succès et vous avez rejoint la classe <strong>${className}</strong>.</p>
        
        <div style="${STYLES.infoBox}">
            <div style="${STYLES.infoBoxTitle}">Vos informations</div>
            <p style="${STYLES.infoBoxText} margin-bottom: 8px;"><strong>🎓 Classe :</strong> ${className}</p>
            <p style="${STYLES.infoBoxText}"><strong>📧 Identifiant :</strong> ${email}</p>
        </div>
        
        <p>Vous pouvez dès maintenant accéder à vos cours, examens et ressources pédagogiques.</p>
        
        <div style="text-align: center;">
            <a href="${loginUrl}" style="${STYLES.button}">Accéder à mon espace</a>
        </div>
        
        <p style="text-align: center; color: ${COLORS.gray}; font-size: 14px;">Si le bouton ne fonctionne pas, copiez ce lien : <br>
        <a href="${loginUrl}" style="color: ${COLORS.primary};">${loginUrl}</a></p>
    `;

    const html = emailWrapper("Bienvenue sur Xkorin !", "Votre inscription est confirmée", content);
    return sendEmail({ to: email, subject: `Bienvenue dans la classe ${className} !`, html });
};

// Email d'invitation à rejoindre une classe
export const sendInvitationEmail = async (email: string, link: string, className: string) => {
    const content = `
        <p>Bonjour,</p>
        <p>Vous avez été invité à rejoindre la classe <strong>${className}</strong> sur notre plateforme d'apprentissage.</p>
        
        <p>Pour finaliser votre inscription et accéder au contenu, cliquez simplement sur le bouton ci-dessous :</p>
        
        <div style="text-align: center;">
            <a href="${link}" style="${STYLES.button}">Rejoindre la classe</a>
        </div>
        
        <div style="${STYLES.infoBox}">
            <div style="${STYLES.infoBoxTitle}">Note</div>
            <p style="${STYLES.infoBoxText}">Ce lien est personnel. Si vous n'êtes pas le destinataire prévu, merci d'ignorer cet email.</p>
        </div>
        
        <p style="text-align: center; color: ${COLORS.gray}; font-size: 14px;">Lien direct : <a href="${link}" style="color: ${COLORS.primary}; word-break: break-all;">${link}</a></p>
    `;

    const html = emailWrapper("Invitation reçue", `Rejoignez la classe ${className}`, content);
    return sendEmail({ to: email, subject: `Invitation : Rejoindre ${className}`, html });
};

// Email d'activation (Ajout manuel)
export const sendAccountActivationEmail = async (email: string, link: string, className: string, tempPassword?: string) => {
    let passwordSection = '';
    if (tempPassword) {
        passwordSection = `
            <div style="${STYLES.infoBox}; background-color: #FFFBEB; border-color: #FCD34D;">
                <div style="${STYLES.infoBoxTitle}; color: #D97706;">🔑 Mot de passe temporaire</div>
                <div style="font-family: monospace; font-size: 24px; letter-spacing: 2px; color: #D97706; background: white; padding: 12px; border-radius: 8px; text-align: center; margin-top: 8px;">
                    ${tempPassword}
                </div>
                <p style="font-size: 13px; color: #B45309; margin-top: 12px; text-align: center;">
                    Pensez à le modifier lors de votre première connexion.
                </p>
            </div>
        `;
    }

    const content = `
        <p>Bonjour,</p>
        <p>Un compte étudiant a été créé pour vous afin de rejoindre la classe <strong>${className}</strong>.</p>
        
        ${passwordSection}
        
        <p>Pour activer votre compte et commencer, cliquez sur le bouton ci-dessous :</p>
        
        <div style="text-align: center;">
            <a href="${link}" style="${STYLES.button}">Activer mon compte</a>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray}; text-align: center;">Ou utilisez ce lien : <a href="${link}" style="color: ${COLORS.primary};">${link}</a></p>
    `;

    const html = emailWrapper("Activez votre compte", `Bienvenue dans la classe ${className}`, content);
    return sendEmail({ to: email, subject: `Action requise : Activez votre compte Xkorin`, html });
};

// Notification Enseignant
export const sendTeacherNotification = async (
    teacherEmail: string,
    teacherName: string,
    studentName: string,
    studentEmail: string,
    className: string
) => {
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/teacher/classes`;

    const content = `
        <p>Bonjour <strong>${teacherName}</strong>,</p>
        <p>Excellente nouvelle ! La classe <strong>${className}</strong> s'agrandit.</p>
        
        <div style="${STYLES.infoBox}">
            <div style="${STYLES.infoBoxTitle}">Nouvel Apprenant inscrit</div>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 4px 0; color: ${COLORS.gray};">Nom :</td>
                    <td style="padding: 4px 0; font-weight: 600;">${studentName}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: ${COLORS.gray};">Email :</td>
                    <td style="padding: 4px 0; font-weight: 600;">${studentEmail}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0; color: ${COLORS.gray};">Date :</td>
                    <td style="padding: 4px 0;">${new Date().toLocaleDateString('fr-FR')}</td>
                </tr>
            </table>
        </div>
        
        <div style="text-align: center;">
            <a href="${dashboardUrl}" style="${STYLES.button}">Gérer ma classe</a>
        </div>
    `;

    const html = emailWrapper("Nouvelle inscription", `${studentName} a rejoint ${className}`, content);
    return sendEmail({ to: teacherEmail, subject: `Nouvel Apprenant : ${studentName}`, html });
};

// Rapport d'import
export const sendImportReportEmail = async (
    teacherEmail: string,
    teacherName: string,
    className: string,
    stats: { total: number; enrolled: number; invited: number; errors: number },
    errors: { email: string; message: string }[]
) => {
    let errorSection = '';
    if (errors.length > 0) {
        errorSection = `
            <div style="${STYLES.infoBox}; background-color: #FEF2F2; border-color: #FECACA;">
                <div style="${STYLES.infoBoxTitle}; color: ${COLORS.error};">⚠️ Erreurs rencontrées (${errors.length})</div>
                <ul style="margin: 10px 0; padding-left: 20px; color: #991B1B;">
                    ${errors.slice(0, 5).map(e => `<li><strong>${e.email}</strong> : ${e.message}</li>`).join('')}
                </ul>
                ${errors.length > 5 ? `<p style="font-size: 13px; color: #991B1B; margin-top: 8px;">...et ${errors.length - 5} autres.</p>` : ''}
            </div>
        `;
    }

    const content = `
        <p>Bonjour <strong>${teacherName}</strong>,</p>
        <p>Le traitement de votre fichier d'import pour la classe <strong>${className}</strong> est terminé.</p>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 25px 0;">
            <div style="background: #F0FDFA; padding: 15px; border-radius: 12px; text-align: center; border: 1px solid #CCFBF1;">
                <div style="font-size: 24px; font-weight: 700; color: ${COLORS.primary};">${stats.enrolled}</div>
                <div style="font-size: 13px; color: ${COLORS.gray};">Déjà inscrits</div>
            </div>
            <div style="background: #EFF6FF; padding: 15px; border-radius: 12px; text-align: center; border: 1px solid #BFDBFE;">
                <div style="font-size: 24px; font-weight: 700; color: #3B82F6;">${stats.invited}</div>
                <div style="font-size: 13px; color: ${COLORS.gray};">Nouveaux invités</div>
            </div>
        </div>

        ${stats.errors > 0 ? `
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="display: inline-block; padding: 6px 12px; background: #FEE2E2; color: ${COLORS.error}; border-radius: 20px; font-size: 14px; font-weight: 600;">
                    ${stats.errors} erreur(s)
                </span>
            </div>
        ` : ''}
        
        ${errorSection}
        
        <p>Les e-mails d'invitation ont été envoyés automatiquement aux nouveaux Apprenants.</p>
    `;

    const html = emailWrapper("Rapport d'import", `Résumé pour ${className}`, content);
    return sendEmail({ to: teacherEmail, subject: `Import terminé pour ${className}`, html });
};

// Email pour un utilisateur existant ajouté à une classe
export const sendAddedToClassEmail = async (email: string, userName: string, className: string, teacherName: string, loginLink: string) => {
    const content = `
        <p>Bonjour <strong>${userName}</strong>,</p>
        <p>Vous avez été ajouté(e) à la classe <strong>${className}</strong> par ${teacherName}.</p>
        
        <div style="${STYLES.infoBox}; background-color: #ECFDF5; border-color: #A7F3D0;">
            <div style="${STYLES.infoBoxTitle}; color: #059669;">✓ Accès immédiat</div>
            <p style="${STYLES.infoBoxText}">Votre compte est actif et vous pouvez accéder à la classe immédiatement.</p>
        </div>
        
        <p>Cliquez sur le bouton ci-dessous pour vous connecter et accéder à votre classe :</p>
        
        <div style="text-align: center;">
            <a href="${loginLink}" style="${STYLES.button}">Accéder à ma classe</a>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray}; text-align: center;">
            Ou connectez-vous à : <a href="${loginLink}" style="color: ${COLORS.primary};">${loginLink}</a>
        </p>
    `;

    const html = emailWrapper("Ajout à une classe", `Vous êtes maintenant dans ${className}`, content);
    return sendEmail({ to: email, subject: `Vous avez été ajouté à ${className}`, html });
};

// Code de vérification OTP
export const sendVerificationEmail = async (email: string, code: string, userName: string) => {
    const content = `
        <p>Bonjour <strong>${userName}</strong>,</p>
        <p>Pour sécuriser votre compte, veuillez utiliser le code de vérification suivant :</p>
        
        <div style="text-align: center; margin: 40px 0;">
            <div style="display: inline-block; background: #F3F4F6; color: ${COLORS.text}; padding: 16px 32px; border-radius: 16px; font-family: monospace; font-size: 32px; letter-spacing: 8px; font-weight: 700; border: 2px dashed #D1D5DB;">
                ${code}
            </div>
        </div>
        
        <div style="${STYLES.infoBox}">
            <div style="${STYLES.infoBoxTitle}">Sécurité</div>
            <p style="${STYLES.infoBoxText}">Ce code expire dans 10 minutes. Ne le partagez avec personne.</p>
        </div>
    `;

    const html = emailWrapper("Code de vérification", "Confirmez votre identité", content);
    return sendEmail({ to: email, subject: `Votre code : ${code}`, html });
};

// ============================================================================
// EMAILS POUR L'AJOUT D'ENSEIGNANTS
// ============================================================================

/**
 * Email envoyé quand un enseignant existant est ajouté à une classe
 */
export const sendTeacherAddedEmail = async (
    email: string,
    teacherName: string,
    className: string,
    addedByName: string,
    subjectNames: string[],
    loginUrl: string
) => {
    const subjectsList = subjectNames.length > 0 
        ? `<p style="${STYLES.infoBoxText}"><strong>📚 Matière(s) :</strong> ${subjectNames.join(', ')}</p>` 
        : '';

    const content = `
        <p>Bonjour <strong>${teacherName}</strong>,</p>
        <p>Vous avez été ajouté(e) comme enseignant(e) collaborateur(trice) dans la classe <strong>${className}</strong> par ${addedByName}.</p>
        
        <div style="${STYLES.infoBox}; background-color: #EFF6FF; border-color: #BFDBFE;">
            <div style="${STYLES.infoBoxTitle}; color: #3B82F6;">✓ Nouvel accès enseignant</div>
            <p style="${STYLES.infoBoxText}">Vous pouvez maintenant gérer les examens, noter les élèves et accéder aux statistiques de cette classe.</p>
            ${subjectsList}
        </div>
        
        <p>Cliquez sur le bouton ci-dessous pour accéder à la classe :</p>
        
        <div style="text-align: center;">
            <a href="${loginUrl}" style="${STYLES.button}">Accéder à la classe</a>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray}; text-align: center;">
            Ou connectez-vous à : <a href="${loginUrl}" style="color: ${COLORS.primary};">${loginUrl}</a>
        </p>
    `;

    const html = emailWrapper("Ajout comme enseignant", `Vous enseignez dans ${className}`, content);
    return sendEmail({ to: email, subject: `Vous êtes enseignant dans ${className}`, html });
};

/**
 * Email d'activation pour un nouvel enseignant invité
 * (compte créé avec mot de passe temporaire)
 */
export const sendTeacherActivationEmail = async (
    email: string,
    teacherName: string,
    className: string,
    addedByName: string,
    subjectNames: string[],
    activationLink: string
) => {
    const subjectsList = subjectNames.length > 0 
        ? `<p style="${STYLES.infoBoxText}"><strong>📚 Matière(s) :</strong> ${subjectNames.join(', ')}</p>` 
        : '';

    const content = `
        <p>Bonjour <strong>${teacherName}</strong>,</p>
        <p>${addedByName} vous a invité(e) à rejoindre <strong>${className}</strong> comme enseignant(e) collaborateur(trice) sur QuizLock.</p>
        
        <div style="${STYLES.infoBox}; background-color: #F0FDFA; border-color: #CCFBF1;">
            <div style="${STYLES.infoBoxTitle}; color: #0D9488;">🎓 Votre classe</div>
            <p style="${STYLES.infoBoxText}"><strong>Classe :</strong> ${className}</p>
            ${subjectsList}
        </div>
        
        <p>Un compte a été créé pour vous. Pour l'activer et définir votre mot de passe, cliquez sur le bouton ci-dessous :</p>
        
        <div style="text-align: center;">
            <a href="${activationLink}" style="${STYLES.button}">Activer mon compte</a>
        </div>
        
        <div style="${STYLES.infoBox}; background-color: #FFFBEB; border-color: #FCD34D; margin-top: 20px;">
            <div style="${STYLES.infoBoxTitle}; color: #D97706;">⚠️ Important</div>
            <p style="${STYLES.infoBoxText}">Ce lien est unique et expire dans 7 jours. Vous devrez définir votre mot de passe lors de la première connexion.</p>
        </div>
        
        <p style="font-size: 14px; color: ${COLORS.gray}; text-align: center;">
            Si le bouton ne fonctionne pas, utilisez ce lien : <a href="${activationLink}" style="color: ${COLORS.primary}; word-break: break-all;">${activationLink}</a>
        </p>
    `;

    const html = emailWrapper("Activez votre compte enseignant", `Bienvenue dans ${className}`, content);
    return sendEmail({ to: email, subject: `Invitation enseignant : ${className}`, html });
};

/**
 * Email de confirmation après activation du compte enseignant
 */
export const sendTeacherWelcomeEmail = async (
    email: string,
    teacherName: string,
    className: string,
    dashboardUrl: string
) => {
    const content = `
        <p>Bonjour <strong>${teacherName}</strong>,</p>
        <p>Votre compte enseignant a été activé avec succès ! 🎉</p>
        
        <div style="${STYLES.infoBox}; background-color: #ECFDF5; border-color: #A7F3D0;">
            <div style="${STYLES.infoBoxTitle}; color: #059669;">✓ Compte actif</div>
            <p style="${STYLES.infoBoxText}">Vous pouvez maintenant accéder à toutes les fonctionnalités enseignant de la classe <strong>${className}</strong>.</p>
        </div>
        
        <p>En tant qu'enseignant collaborateur, vous pouvez :</p>
        <ul style="margin: 16px 0; padding-left: 24px; color: ${COLORS.text};">
            <li>Créer et gérer des examens</li>
            <li>Noter les élèves</li>
            <li>Voir les statistiques de la classe</li>
            <li>Communiquer avec les élèves</li>
        </ul>
        
        <div style="text-align: center;">
            <a href="${dashboardUrl}" style="${STYLES.button}">Accéder au tableau de bord</a>
        </div>
    `;

    const html = emailWrapper("Bienvenue enseignant !", `Votre compte est actif`, content);
    return sendEmail({ to: email, subject: `Votre compte enseignant est activé`, html });
};
