import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { getStripe, getStripeWebhookSecret, isStripeConfigured } from "@/lib/stripe";
import { applyStripeEvent, claimStripeEvent } from "@/services/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe nije podešen" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Nedostaje stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Neispravan potpis";
    console.warn("[stripe] webhook signature failed", message);
    return NextResponse.json({ error: "Neispravan potpis" }, { status: 400 });
  }

  try {
    const claimed = await claimStripeEvent(event);
    if (claimed) {
      try {
        await applyStripeEvent(event);
      } catch (error) {
        await execute(`DELETE FROM stripe_events WHERE id = ?`, [event.id]).catch(
          () => undefined,
        );
        throw error;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("POST /api/stripe/webhook", error);
    return NextResponse.json({ error: "Webhook obrada nije uspela" }, { status: 500 });
  }
}
