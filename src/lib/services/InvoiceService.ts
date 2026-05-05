import mongoose from "mongoose";
import { sendEmail } from "@/lib/mail";
import {
  invoiceRepository,
  PaginatedInvoices,
} from "@/lib/repositories/InvoiceRepository";
import { IInvoice } from "@/models/Invoice";
import { ITransaction } from "@/models/Transaction";
import { InvoiceStatus, InvoiceType, TransactionType } from "@/models/enums";

export class InvoiceService {
  /**
   * Génère les factures après un paiement COMPLETED :
   * - 1 reçu d'achat pour l'acheteur (PURCHASE_RECEIPT)
   * - 1 relevé de gains pour le vendeur si applicable (EARNINGS_STATEMENT)
   *
   * Envoie les deux par email automatiquement.
   */
  static async generateForTransaction(
    transaction: ITransaction,
    buyerName: string,
    buyerEmail?: string,
    sellerName?: string,
    sellerEmail?: string,
  ): Promise<{ buyerInvoice: IInvoice; sellerInvoice?: IInvoice }> {
    const now = new Date();
    const subtotal = Math.round(
      transaction.finalAmount / (1 - transaction.discountPercent / 100),
    );
    const discountAmount = subtotal - transaction.finalAmount;

    // --- Facture acheteur ---
    const buyerInvoiceNumber = await invoiceRepository.generateInvoiceNumber();
    const buyerInvoice = await invoiceRepository.create({
      invoiceNumber: buyerInvoiceNumber,
      type: InvoiceType.PURCHASE_RECEIPT,
      recipientId: transaction.userId,
      transactionId: transaction._id,
      paymentReference: transaction.paymentReference,
      productType: transaction.type,
      productDescription: this.getProductDescription(transaction),
      subtotal,
      discountAmount,
      discountPercent: transaction.discountPercent,
      total: transaction.finalAmount,
      currency: transaction.paymentCurrency,
      buyerName,
      buyerEmail,
      sellerName,
      status: InvoiceStatus.ISSUED,
      issuedAt: now,
    });

    // Envoi email acheteur
    if (buyerEmail) {
      await this.sendInvoiceEmail(buyerInvoice, buyerEmail, buyerName);
    }

    // --- Facture vendeur (uniquement pour les achats de livres) ---
    let sellerInvoice: IInvoice | undefined;
    if (
      transaction.type === TransactionType.BOOK_PURCHASE &&
      transaction.sellerId &&
      transaction.sellerAmount > 0
    ) {
      const sellerInvoiceNumber =
        await invoiceRepository.generateInvoiceNumber();
      sellerInvoice = await invoiceRepository.create({
        invoiceNumber: sellerInvoiceNumber,
        type: InvoiceType.EARNINGS_STATEMENT,
        recipientId: transaction.sellerId,
        transactionId: transaction._id,
        paymentReference: transaction.paymentReference,
        productType: transaction.type,
        productDescription: this.getProductDescription(transaction),
        subtotal: transaction.finalAmount,
        discountAmount: 0,
        discountPercent: 0,
        total: transaction.sellerAmount,
        currency: transaction.paymentCurrency,
        platformCommission: transaction.platformCommission,
        sellerAmount: transaction.sellerAmount,
        buyerName,
        buyerEmail,
        sellerName,
        status: InvoiceStatus.ISSUED,
        issuedAt: now,
      });

      if (sellerEmail) {
        await this.sendEarningsEmail(
          sellerInvoice,
          sellerEmail,
          sellerName ?? "Enseignant",
        );
      }
    }

    return { buyerInvoice, sellerInvoice };
  }


  /**
   * Génère les factures pour un achat invité (sans compte utilisateur).
   * - 1 reçu d'achat envoyé par email à l'acheteur invité
   * - 1 relevé de gains pour le vendeur (si sellerId fourni)
   */
  static async generateForGuestPurchase(params: {
    guestPurchaseId: string
    paymentReference: string
    guestEmail: string
    finalAmount: number
    currency: string
    bookTitle: string
    sellerId?: string
    sellerName?: string
    sellerEmail?: string
    sellerAmount?: number
    platformCommission?: number
    /** Token de téléchargement — permet d'inclure un lien vers la facture HTML dans l'email */
    downloadToken?: string
  }): Promise<{ buyerInvoice: IInvoice; sellerInvoice?: IInvoice }> {
    const now = new Date()
    const guestPurchaseOid = new mongoose.Types.ObjectId(params.guestPurchaseId)

    // --- Reçu acheteur invité ---
    const buyerInvoiceNumber = await invoiceRepository.generateInvoiceNumber()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buyerInvoice = await invoiceRepository.create({
      invoiceNumber:      buyerInvoiceNumber,
      type:               InvoiceType.PURCHASE_RECEIPT,
      guestPurchaseId:    guestPurchaseOid,
      isGuestPurchase:    true,
      paymentReference:   params.paymentReference,
      productType:        TransactionType.BOOK_PURCHASE,
      productDescription: `Achat de livre numérique — ${params.bookTitle}`,
      subtotal:           params.finalAmount,
      discountAmount:     0,
      discountPercent:    0,
      total:              params.finalAmount,
      currency:           params.currency,
      buyerName:          params.guestEmail,
      buyerEmail:         params.guestEmail,
      sellerName:         params.sellerName,
      status:             InvoiceStatus.ISSUED,
      issuedAt:           now,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    await InvoiceService.sendInvoiceEmail(buyerInvoice, params.guestEmail, params.guestEmail, params.downloadToken)

    // --- Relevé de gains vendeur ---
    let sellerInvoice: IInvoice | undefined
    if (params.sellerId && params.sellerAmount !== undefined && params.sellerAmount > 0) {
      const sellerInvoiceNumber = await invoiceRepository.generateInvoiceNumber()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sellerInvoice = await invoiceRepository.create({
        invoiceNumber:      sellerInvoiceNumber,
        type:               InvoiceType.EARNINGS_STATEMENT,
        recipientId:        new mongoose.Types.ObjectId(params.sellerId),
        guestPurchaseId:    guestPurchaseOid,
        isGuestPurchase:    true,
        paymentReference:   params.paymentReference,
        productType:        TransactionType.BOOK_PURCHASE,
        productDescription: `Achat de livre numérique — ${params.bookTitle}`,
        subtotal:           params.finalAmount,
        discountAmount:     0,
        discountPercent:    0,
        total:              params.sellerAmount,
        currency:           params.currency,
        platformCommission: params.platformCommission ?? 0,
        sellerAmount:       params.sellerAmount,
        buyerName:          params.guestEmail,
        buyerEmail:         params.guestEmail,
        sellerName:         params.sellerName,
        status:             InvoiceStatus.ISSUED,
        issuedAt:           now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      if (params.sellerEmail) {
        await InvoiceService.sendEarningsEmail(
          sellerInvoice,
          params.sellerEmail,
          params.sellerName ?? 'Enseignant',
        )
      }
    }

    return { buyerInvoice, sellerInvoice }
  }


  /**
   * Historique des factures d'un utilisateur (paginé).
   * - Acheteur : voit ses reçus d'achat
   * - Vendeur : voit ses relevés de gains
   * - Admin : filtre libre
   */
  static async getInvoiceHistory(
    recipientId: string,
    type?: InvoiceType,
    page = 1,
    limit = 20,
  ): Promise<PaginatedInvoices> {
    return invoiceRepository.findPaginated({ recipientId, type, page, limit });
  }

  /**
   * Récupère une facture par son numéro.
   * Vérifie que l'appelant en est bien le destinataire (sauf admin).
   */
  static async getByNumber(
    invoiceNumber: string,
    requesterId: string,
    isAdmin = false,
  ): Promise<IInvoice | null> {
    const invoice = await invoiceRepository.findByInvoiceNumber(invoiceNumber);
    if (!invoice) return null;
    if (!isAdmin && invoice.recipientId?.toString() !== requesterId) return null;
    return invoice;
  }

  /**
   * Récupère une facture invité par numéro, validée via le guestPurchaseId.
   * Utilisé pour l'accès public avec le downloadToken (pas de session requise).
   */
  static async getByGuestToken(
    invoiceNumber: string,
    guestPurchaseId: string,
  ): Promise<IInvoice | null> {
    const invoice = await invoiceRepository.findByInvoiceNumber(invoiceNumber);
    if (!invoice) return null;
    if (!invoice.isGuestPurchase) return null;
    if (invoice.guestPurchaseId?.toString() !== guestPurchaseId) return null;
    return invoice;
  }

  /**
   * Retourne le HTML d'une facture pour impression/téléchargement PDF.
   */
  static renderHtml(invoice: IInvoice): string {
    if (invoice.type === InvoiceType.EARNINGS_STATEMENT) {
      return this.renderEarningsHtml(invoice);
    }
    return this.renderReceiptHtml(invoice);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private static getProductDescription(transaction: ITransaction): string {
    switch (transaction.type) {
      case TransactionType.BOOK_PURCHASE:
        return "Achat de livre numérique";
      case TransactionType.SUBSCRIPTION:
        return "Abonnement Xkorienta";
      case TransactionType.COURSE:
        return "Achat de cours";
      case TransactionType.TOP_UP:
        return "Recharge de compte";
      default:
        return "Produit Xkorienta";
    }
  }

  private static formatAmount(amount: number, currency: string): string {
    return `${new Intl.NumberFormat("fr-FR").format(amount)} ${currency}`;
  }

  private static formatDate(date: Date): string {
    return new Date(date).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  private static baseStyles(): string {
    return `
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: #fff; }
            .page { max-width: 800px; margin: 0 auto; padding: 40px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #4361ee; padding-bottom: 24px; margin-bottom: 32px; }
            .brand { font-size: 28px; font-weight: 800; color: #4361ee; letter-spacing: -0.5px; }
            .brand span { color: #f72585; }
            .invoice-meta { text-align: right; }
            .invoice-number { font-size: 20px; font-weight: 700; color: #1a1a2e; }
            .invoice-date { color: #6b7280; font-size: 14px; margin-top: 4px; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
            .badge-receipt { background: #dbeafe; color: #1d4ed8; }
            .badge-earnings { background: #d1fae5; color: #065f46; }
            .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
            .party-block h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; margin-bottom: 8px; }
            .party-block p { font-size: 14px; line-height: 1.6; }
            .party-name { font-weight: 600; font-size: 15px; color: #1a1a2e; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            thead th { background: #f3f4f6; padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
            tbody td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
            .totals { margin-left: auto; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
            .totals-row.total { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a2e; padding-top: 10px; margin-top: 4px; }
            .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
            .reference-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 32px; font-size: 13px; color: #4b5563; }
            .reference-box strong { color: #1a1a2e; }
        </style>`;
  }

  private static renderReceiptHtml(invoice: IInvoice): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Facture ${invoice.invoiceNumber}</title>${this.baseStyles()}</head>
<body><div class="page">
    <div class="header">
        <div>
            <div class="brand">Xkorienta</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Plateforme éducative numérique</div>
            <div style="margin-top:8px;"><span class="badge badge-receipt">Reçu d'achat</span></div>
        </div>
        <div class="invoice-meta">
            <div class="invoice-number">N° ${invoice.invoiceNumber}</div>
            <div class="invoice-date">Émise le ${this.formatDate(invoice.issuedAt)}</div>
        </div>
    </div>

    <div class="parties">
        <div class="party-block">
            <h3>Émetteur</h3>
            <p class="party-name">Xkorienta</p>
            <p>Plateforme éducative numérique</p>
            <p>support@Xkorienta.cm</p>
        </div>
        <div class="party-block">
            <h3>Destinataire</h3>
            <p class="party-name">${invoice.buyerName}</p>
            ${invoice.buyerEmail ? `<p>${invoice.buyerEmail}</p>` : ""}
        </div>
    </div>

    <div class="reference-box">
        <strong>Référence de paiement :</strong> ${invoice.paymentReference} &nbsp;|&nbsp;
        <strong>Type :</strong> ${invoice.productType.replace("_", " ")}
    </div>

    <table>
        <thead><tr><th>Description</th><th style="text-align:right">Montant</th></tr></thead>
        <tbody>
            <tr><td>${invoice.productDescription}</td><td style="text-align:right">${this.formatAmount(invoice.subtotal, invoice.currency)}</td></tr>
            ${invoice.discountPercent > 0 ? `<tr><td style="color:#10b981">Réduction (${invoice.discountPercent}%)</td><td style="text-align:right;color:#10b981">- ${this.formatAmount(invoice.discountAmount, invoice.currency)}</td></tr>` : ""}
        </tbody>
    </table>

    <div class="totals">
        ${invoice.discountPercent > 0 ? `<div class="totals-row"><span>Sous-total</span><span>${this.formatAmount(invoice.subtotal, invoice.currency)}</span></div><div class="totals-row" style="color:#10b981"><span>Réduction</span><span>- ${this.formatAmount(invoice.discountAmount, invoice.currency)}</span></div>` : ""}
        <div class="totals-row total"><span>Total payé</span><span>${this.formatAmount(invoice.total, invoice.currency)}</span></div>
    </div>

    <div class="footer">
        <p>Merci pour votre confiance — Xkorienta &copy; ${new Date().getFullYear()}</p>
        <p style="margin-top:4px;">Cette facture est générée automatiquement et ne nécessite pas de signature.</p>
    </div>
</div></body></html>`;
  }

  private static renderEarningsHtml(invoice: IInvoice): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Relevé de gains ${invoice.invoiceNumber}</title>${this.baseStyles()}</head>
<body><div class="page">
    <div class="header">
        <div>
            <div class="brand">Xkorienta</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Plateforme éducative numérique</div>
            <div style="margin-top:8px;"><span class="badge badge-earnings">Relevé de gains</span></div>
        </div>
        <div class="invoice-meta">
            <div class="invoice-number">N° ${invoice.invoiceNumber}</div>
            <div class="invoice-date">Émis le ${this.formatDate(invoice.issuedAt)}</div>
        </div>
    </div>

    <div class="parties">
        <div class="party-block">
            <h3>Plateforme</h3>
            <p class="party-name">Xkorienta</p>
            <p>support@Xkorienta.cm</p>
        </div>
        <div class="party-block">
            <h3>Vendeur</h3>
            <p class="party-name">${invoice.sellerName ?? "Enseignant"}</p>
        </div>
    </div>

    <div class="reference-box">
        <strong>Vente référencée :</strong> ${invoice.paymentReference} &nbsp;|&nbsp;
        <strong>Acheteur :</strong> ${invoice.buyerName}
    </div>

    <table>
        <thead><tr><th>Description</th><th style="text-align:right">Montant</th></tr></thead>
        <tbody>
            <tr><td>${invoice.productDescription} — vente réalisée</td><td style="text-align:right">${this.formatAmount(invoice.subtotal, invoice.currency)}</td></tr>
            <tr><td style="color:#f59e0b">Commission plateforme Xkorienta</td><td style="text-align:right;color:#f59e0b">- ${this.formatAmount(invoice.platformCommission ?? 0, invoice.currency)}</td></tr>
        </tbody>
    </table>

    <div class="totals">
        <div class="totals-row"><span>Montant de la vente</span><span>${this.formatAmount(invoice.subtotal, invoice.currency)}</span></div>
        <div class="totals-row" style="color:#f59e0b"><span>Commission (${Math.round(((invoice.platformCommission ?? 0) / invoice.subtotal) * 100)}%)</span><span>- ${this.formatAmount(invoice.platformCommission ?? 0, invoice.currency)}</span></div>
        <div class="totals-row total" style="color:#065f46"><span>Gains nets versés</span><span>${this.formatAmount(invoice.total, invoice.currency)}</span></div>
    </div>

    <div class="footer">
        <p>Ce relevé confirme le crédit de vos gains sur votre wallet Xkorienta.</p>
        <p style="margin-top:4px;">Xkorienta &copy; ${new Date().getFullYear()} — Conservez ce document pour votre comptabilité.</p>
    </div>
</div></body></html>`;
  }

  private static async sendInvoiceEmail(
    invoice: IInvoice,
    email: string,
    name: string,
    downloadToken?: string,
  ): Promise<void> {
    const isGuest = invoice.isGuestPurchase === true
    // For guests, the name IS the email — show a cleaner greeting
    const greeting = isGuest ? `Bonjour,` : `Bonjour ${name},`

    const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? appBase).replace(/\/$/, '')

    // Build invoice HTML link for guest (public, secured by download token)
    const invoiceHtmlPath = apiBase.endsWith('/api')
      ? `/invoices/${invoice.invoiceNumber}/html`
      : `/api/invoices/${invoice.invoiceNumber}/html`
    const invoiceLink = downloadToken
      ? `${apiBase}${invoiceHtmlPath}?token=${downloadToken}`
      : null

    const viewInvoiceBtn = invoiceLink
      ? `<div style="text-align:center;margin:16px 0;">
           <a href="${invoiceLink}"
              style="display:inline-block;padding:10px 28px;background:#114D5A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
             📄 Voir / Imprimer ma facture
           </a>
         </div>`
      : ''

    const footerNote = isGuest
      ? `<p style="color:#6b7280;font-size:13px;">
           Conservez cet email comme preuve d'achat. Votre lien de téléchargement vous a été envoyé séparément.
           <br>Vous pouvez aussi
           <a href="${appBase}/register" style="color:#114D5A;font-weight:600;">créer un compte gratuitement</a>
           pour accéder à plus de ressources et retrouver vos achats.
         </p>`
      : `<p style="color:#6b7280;font-size:13px;">Vous pouvez retrouver toutes vos factures dans votre espace personnel → <em>Mon compte → Mes factures</em>.</p>`

    try {
      await sendEmail({
        to: email,
        subject: `Votre reçu Xkorienta — ${invoice.invoiceNumber}`,
        html: `
<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#114D5A;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h1 style="font-size:24px;margin:0;">✅ Paiement confirmé</h1>
    </div>
    <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;">
        <p>${greeting}</p>
        <p style="margin-top:12px;">Votre paiement a bien été reçu. Voici votre reçu :</p>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
            <p><strong>N° Facture :</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Description :</strong> ${invoice.productDescription}</p>
            <p><strong>Montant :</strong> <span style="font-size:18px;font-weight:700;color:#114D5A;">${new Intl.NumberFormat("fr-FR").format(invoice.total)} ${invoice.currency}</span></p>
            <p><strong>Date :</strong> ${this.formatDate(invoice.issuedAt)}</p>
        </div>
        ${viewInvoiceBtn}
        ${footerNote}
        <p style="margin-top:16px;">Merci pour votre confiance !</p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">Xkorienta — Votre plateforme d'apprentissage</p>
</body></html>`,
      });
      await invoiceRepository.markAsSent(invoice.invoiceNumber);
    } catch {
      // Ne pas bloquer le flow si l'email échoue
    }
  }

  private static async sendEarningsEmail(
    invoice: IInvoice,
    email: string,
    name: string,
  ): Promise<void> {
    try {
      await sendEmail({
        to: email,
        subject: `Nouvelle vente — ${invoice.invoiceNumber}`,
        html: `
<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#059669;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h1 style="font-size:24px;margin:0;">💰 Nouvelle vente !</h1>
    </div>
    <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;">
        <p>Bonjour ${name},</p>
        <p style="margin-top:12px;">Un élève vient d'acheter votre livre. Vos gains ont été crédités sur votre wallet.</p>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
            <p><strong>N° Relevé :</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Produit :</strong> ${invoice.productDescription}</p>
            <p><strong>Prix de vente :</strong> ${new Intl.NumberFormat("fr-FR").format(invoice.subtotal)} ${invoice.currency}</p>
            <p><strong>Commission Xkorienta :</strong> - ${new Intl.NumberFormat("fr-FR").format(invoice.platformCommission ?? 0)} ${invoice.currency}</p>
            <p><strong>Gains nets crédités :</strong> <span style="font-size:18px;font-weight:700;color:#059669;">${new Intl.NumberFormat("fr-FR").format(invoice.total)} ${invoice.currency}</span></p>
        </div>
        <p style="color:#6b7280;font-size:13px;">Retrouvez tous vos relevés dans votre espace → <em>Mon compte → Mes gains</em>.</p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">Xkorienta — Merci pour votre contribution !</p>
</body></html>`,
      });
      await invoiceRepository.markAsSent(invoice.invoiceNumber);
    } catch {
      // Ne pas bloquer le flow si l'email échoue
    }
  }
}
