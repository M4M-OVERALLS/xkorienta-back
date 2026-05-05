import mongoose from "mongoose";
import { payoutRepository } from "@/lib/repositories/PayoutRepository";
import { walletRepository } from "@/lib/repositories/WalletRepository";
import { paymentSDK } from "@/lib/payment";
import { IPayout } from "@/models/Payout";
import { Currency, MobileMoneyProvider, PayoutStatus } from "@/models/enums";
import { randomUUID } from "crypto";
import { WalletService } from "./WalletService";

/** Montant minimum de virement en XAF */
const MIN_PAYOUT_AMOUNT = 500;

export interface RequestPayoutParams {
  userId: string;
  amount: number;
  currency: Currency;
  recipientPhone: string;
  recipientName: string;
  recipientProvider: MobileMoneyProvider;
}

export interface ImmediateTransferParams {
  sellerId: string
  amount: number
  currency: Currency
  recipientPhone: string
  recipientName: string
  recipientProvider: MobileMoneyProvider
  /** Référence de la vente à l'origine du virement (pour description + traçabilité) */
  saleReference: string
}

export class PayoutService {
  /**
   * Virement immédiat vers le vendeur sans passer par le wallet interne.
   *
   * Option A — délégation à NotchPay :
   * - Chaque vente déclenche un transfer NotchPay en temps réel.
   * - Crée un Payout pour la traçabilité (audit trail).
   * - N'interagit PAS avec le wallet Mongoose.
   * - Si le transfer échoue, Payout est marqué FAILED.
   */
  static async transferImmediately(params: ImmediateTransferParams): Promise<IPayout> {
    const payoutReference = `EARN-${randomUUID().slice(0, 12).toUpperCase()}`
    const channel = this.mapProviderToChannel(params.recipientProvider)

    // Enregistrement avant l'appel API — trace même en cas d'échec réseau
    const payout = await payoutRepository.create({
      userId:            new mongoose.Types.ObjectId(params.sellerId),
      amount:            params.amount,
      currency:          params.currency,
      recipientPhone:    params.recipientPhone,
      recipientName:     params.recipientName,
      recipientProvider: params.recipientProvider,
      status:            PayoutStatus.PROCESSING,
      payoutReference,
      paymentProvider:   'notchpay',
    } as Partial<IPayout>)

    try {
      const provider = paymentSDK.providers.get('notchpay')
      const result = await provider.transfer({
        amount:        params.amount,
        currency:      params.currency,
        phone:         params.recipientPhone,
        channel,
        reference:     payoutReference,
        description:   `Gains vente ${params.saleReference}`,
        recipientName: params.recipientName,
      })

      const finalStatus =
        result.status === 'completed' || result.status === 'processing'
          ? PayoutStatus.COMPLETED
          : PayoutStatus.FAILED

      await payoutRepository.updateStatus(payoutReference, finalStatus, result.transferId)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Erreur inconnue'
      await payoutRepository.updateStatus(payoutReference, PayoutStatus.FAILED, undefined, reason)
      throw new Error(`Virement immédiat échoué : ${reason}`)
    }

    const updated = await payoutRepository.findByReference(payoutReference)
    return updated ?? payout
  }

  /**
   * Crée une demande de virement et l'envoie immédiatement à NotchPay.
   * Débite le wallet au moment de la demande (bloque les fonds).
   */
  static async requestPayout(params: RequestPayoutParams): Promise<IPayout> {
    if (params.amount < MIN_PAYOUT_AMOUNT) {
      throw new Error(
        `Le montant minimum de virement est ${MIN_PAYOUT_AMOUNT} ${params.currency}`,
      );
    }

    // Débiter le wallet (vérifie que le solde est suffisant)
    const wallet = await walletRepository.findByUserId(params.userId);
    if (!wallet)
      throw new Error("Wallet introuvable. Vous n'avez pas encore de gains.");

    await WalletService.debit(params.userId, params.amount);

    const payoutReference = `PAY-${randomUUID().slice(0, 12).toUpperCase()}`;
    const channel = this.mapProviderToChannel(params.recipientProvider);

    // Créer l'enregistrement en base AVANT l'appel API (en cas d'échec on peut retracer)
    const payout = await payoutRepository.create({
      userId: wallet.userId,
      walletId: wallet._id,
      amount: params.amount,
      currency: params.currency,
      recipientPhone: params.recipientPhone,
      recipientName: params.recipientName,
      recipientProvider: params.recipientProvider,
      status: PayoutStatus.PROCESSING,
      payoutReference,
      paymentProvider: "notchpay",
    });

    try {
      const provider = paymentSDK.providers.get("notchpay");
      const result = await provider.transfer({
        amount: params.amount,
        currency: params.currency,
        phone: params.recipientPhone,
        channel,
        reference: payoutReference,
        description: `Versement gains Xkorienta`,
        recipientName: params.recipientName,
      });

      const finalStatus =
        result.status === "completed" || result.status === "processing"
          ? PayoutStatus.COMPLETED
          : PayoutStatus.FAILED;

      await payoutRepository.updateStatus(
        payoutReference,
        finalStatus,
        result.transferId,
      );

      if (finalStatus === PayoutStatus.FAILED) {
        // Rembourser le wallet si le virement échoue
        await walletRepository.credit(
          params.userId,
          params.amount,
          params.currency,
        );
      }
    } catch (err) {
      // Rembourser et marquer comme échoué
      await walletRepository.credit(
        params.userId,
        params.amount,
        params.currency,
      );
      const reason = err instanceof Error ? err.message : "Erreur inconnue";
      await payoutRepository.updateStatus(
        payoutReference,
        PayoutStatus.FAILED,
        undefined,
        reason,
      );
      throw new Error(`Virement échoué : ${reason}`);
    }

    const updated = await payoutRepository.findByReference(payoutReference);
    return updated ?? payout;
  }

  /**
   * Historique des virements d'un vendeur.
   */
  static async getPayoutHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<IPayout[]> {
    return payoutRepository.findByUser(userId, page, limit);
  }

  /** Mappe le provider Mobile Money au code canal NotchPay */
  private static mapProviderToChannel(provider: MobileMoneyProvider): string {
    switch (provider) {
      case MobileMoneyProvider.ORANGE:
        return "cm.orange";
      case MobileMoneyProvider.MTN:
        return "cm.mtn";
      default:
        return "cm.mobile";
    }
  }
}
