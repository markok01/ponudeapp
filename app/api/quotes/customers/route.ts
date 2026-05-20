import { NextResponse } from "next/server";
import { listCustomerNames } from "@/services/quotes";

export async function GET() {
  try {
    const customers = await listCustomerNames();
    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/quotes/customers", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju kupaca" },
      { status: 500 },
    );
  }
}
