import { NextRequest, NextResponse } from "next/server";
import {
  getAppSettingsFromDb,
  saveAppSettingsToDb,
} from "@/services/app-settings";

export async function GET() {
  try {
    const settings = await getAppSettingsFromDb();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/settings", error);
    return NextResponse.json(
      { error: "Greška pri učitavanju podešavanja" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const settings = await saveAppSettingsToDb({
      ...(body.companyName !== undefined
        ? { companyName: String(body.companyName) }
        : {}),
      ...(body.logoDataUrl !== undefined
        ? {
            logoDataUrl:
              body.logoDataUrl === null || body.logoDataUrl === ""
                ? null
                : String(body.logoDataUrl),
          }
        : {}),
    });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT /api/settings", error);
    return NextResponse.json(
      { error: "Greška pri čuvanju podešavanja" },
      { status: 500 },
    );
  }
}
