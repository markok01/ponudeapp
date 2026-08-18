import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAuthEnabled, SESSION_COOKIE } from "@/lib/auth";
import { attachLocaleCookie, getRequestLocale } from "@/lib/authI18n";
import { defaultCurrencyForLocale, normalizeCurrency } from "@/lib/currency";
import { normalizeLocale } from "@/lib/i18n/types";
import { getDefaultOrganizationId } from "@/services/organizations";
import {
  getAppSettingsFromDb,
  saveAppSettingsToDb,
} from "@/services/app-settings";

function emptySettings(locale = normalizeLocale(undefined)) {
  return {
    companyName: "",
    logoDataUrl: null as string | null,
    locale,
    currency: defaultCurrencyForLocale(locale),
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthEnabled()) {
      const settings = await getAppSettingsFromDb(await getDefaultOrganizationId());
      return NextResponse.json(settings);
    }

    const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user?.organizationId) {
      const locale = getRequestLocale(request);
      return NextResponse.json(emptySettings(locale));
    }

    const settings = await getAppSettingsFromDb(user.organizationId);
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

    if (!isAuthEnabled()) {
      const settings = await saveAppSettingsToDb(await getDefaultOrganizationId(), {
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
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.currency !== undefined
          ? { currency: normalizeCurrency(body.currency) }
          : {}),
      });
      const res = NextResponse.json(settings);
      if (body.locale !== undefined) {
        attachLocaleCookie(res, normalizeLocale(body.locale));
      }
      return res;
    }

    const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user?.organizationId) {
      if (body.locale === undefined) {
        return NextResponse.json({ error: "Niste prijavljeni" }, { status: 401 });
      }
      const locale = normalizeLocale(body.locale);
      const res = NextResponse.json(emptySettings(locale));
      attachLocaleCookie(res, locale);
      return res;
    }

    const settings = await saveAppSettingsToDb(user.organizationId, {
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
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
      ...(body.currency !== undefined
        ? { currency: normalizeCurrency(body.currency) }
        : {}),
    });
    const res = NextResponse.json(settings);
    if (body.locale !== undefined) {
      attachLocaleCookie(res, normalizeLocale(body.locale));
    }
    return res;
  } catch (error) {
    console.error("PUT /api/settings", error);
    return NextResponse.json(
      { error: "Greška pri čuvanju podešavanja" },
      { status: 500 },
    );
  }
}
