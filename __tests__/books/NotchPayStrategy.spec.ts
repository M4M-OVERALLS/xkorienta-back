import { NotchPayStrategy } from "@/lib/strategies/payment/NotchPayStrategy";
import crypto from "crypto";

global.fetch = jest.fn();

describe("NotchPayStrategy", () => {
  let strategy: NotchPayStrategy;

  beforeEach(() => {
    strategy = new NotchPayStrategy();
    process.env.NOTCHPAY_PUBLIC_KEY = "pk_test_123";
    process.env.NOTCHPAY_HASH = "test_hash_secret";
    jest.clearAllMocks();
  });

  describe("initiatePayment", () => {
    it("should return paymentUrl and reference on success", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "Accepted",
          authorization_url: "https://pay.notchpay.co/pay/abc123",
          transaction: { reference: "BOOK-XYZ-ABC" },
        }),
      });

      const result = await strategy.initiatePayment({
        amount: 5000,
        currency: "XAF",
        reference: "BOOK-XYZ-ABC",
        email: "student@test.com",
        description: "Achat livre: Math",
        callbackUrl: "https://app.Xkorienta.com/callback",
      });

      expect(result.paymentUrl).toBe("https://pay.notchpay.co/pay/abc123");
      expect(result.reference).toBe("BOOK-XYZ-ABC");
      expect(result.provider).toBe("notchpay");
    });

    it("should throw when API returns an error", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: "Bad Request",
        json: async () => ({ status: "error", message: "Invalid amount" }),
      });

      await expect(
        strategy.initiatePayment({
          amount: -1,
          currency: "XAF",
          reference: "REF",
          email: "test@test.com",
          description: "Test",
          callbackUrl: "https://callback.com",
        }),
      ).rejects.toThrow("Invalid amount");
    });

    it("should throw when NOTCHPAY_PUBLIC_KEY is not set", async () => {
      delete process.env.NOTCHPAY_PUBLIC_KEY;

      await expect(
        strategy.initiatePayment({
          amount: 1000,
          currency: "XAF",
          reference: "REF",
          email: "test@test.com",
          description: "Test",
          callbackUrl: "https://cb.com",
        }),
      ).rejects.toThrow("NOTCHPAY_PUBLIC_KEY");
    });
  });

  describe("handleWebhook", () => {
    it("should parse valid webhook with correct signature", async () => {
      const payload = {
        transaction: {
          reference: "BOOK-ABC",
          status: "complete",
          amount: 5000,
          currency: "XAF",
        },
      };
      const raw = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", "test_hash_secret")
        .update(raw)
        .digest("hex");

      const event = await strategy.handleWebhook(raw, signature);

      expect(event.reference).toBe("BOOK-ABC");
      expect(event.status).toBe("completed");
      expect(event.amount).toBe(5000);
    });

    it("should throw on invalid signature", async () => {
      const payload = JSON.stringify({
        transaction: {
          reference: "REF",
          status: "complete",
          amount: 100,
          currency: "XAF",
        },
      });

      await expect(
        strategy.handleWebhook(payload, "invalid-sig"),
      ).rejects.toThrow("Invalid NotchPay webhook signature");
    });

    it("should throw when payload has no transaction", async () => {
      const payload = JSON.stringify({ event: "test" });
      const signature = crypto
        .createHmac("sha256", "test_hash_secret")
        .update(payload)
        .digest("hex");

      await expect(strategy.handleWebhook(payload, signature)).rejects.toThrow(
        "missing transaction object",
      );
    });
  });

  describe("verifyPayment", () => {
    it("should return completed status", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          transaction: {
            reference: "BOOK-ABC",
            status: "complete",
            amount: 5000,
            currency: "XAF",
            paid_at: "2024-01-01T12:00:00Z",
          },
        }),
      });

      const result = await strategy.verifyPayment("BOOK-ABC");
      expect(result.status).toBe("completed");
      expect(result.amount).toBe(5000);
    });
  });
});
