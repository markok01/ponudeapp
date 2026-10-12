import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isAuthEnabled, SESSION_COOKIE } from "@/lib/auth";
import { attachLocaleCookie, getRequestLocale } from "@/lib/authI18n";
import {
  CATALOG_THEME_DEFAULT,
  isCatalogThemePreset,
  normalizeCatalogColors,
} from "@/lib/catalog-theme";
import { defaultCurrencyForLocale, normalizeCurrency } from "@/lib/currency";
import { normalizeLocale } from "@/lib/i18n/types";
import { isStaffRole } from "@/lib/roles";
import { getDefaultOrganizationId } from "@/services/organizations";
import {
  getAppSettingsFromDb,
  saveAppSettingsToDb,
} from "@/services/app-settings";
import type { CatalogColorPalette } from "@/types";

function emptySettings(locale = normalizeLocale(undefined)) {
  return {
    companyName: "",
    logoDataUrl: null as string | null,
    taxId: "",
    address: "",
    phone: "",
    bankAccount: "",
    stampDataUrl: null as string | null,
    membersCanLockQuotes: false,
    locale,
    currency: defaultCurrencyForLocale(locale),
    catalogThemePreset: "default" as const,
    catalogColors: { ...CATALOG_THEME_DEFAULT },
  };
}

function profilePatch(body: Record<string, unknown>) {
  return {
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
    ...(body.taxId !== undefined ? { taxId: String(body.taxId) } : {}),
    ...(body.address !== undefined ? { address: String(body.address) } : {}),
    ...(body.phone !== undefined ? { phone: String(body.phone) } : {}),
    ...(body.bankAccount !== undefined
      ? { bankAccount: String(body.bankAccount) }
      : {}),
    ...(body.stampDataUrl !== undefined
      ? {
          stampDataUrl:
            body.stampDataUrl === null || body.stampDataUrl === ""
              ? null
              : String(body.stampDataUrl),
        }
      : {}),
    ...(body.membersCanLockQuotes !== undefined
      ? { membersCanLockQuotes: Boolean(body.membersCanLockQuotes) }
      : {}),
    ...(body.currency !== undefined
      ? { currency: normalizeCurrency(String(body.currency)) }
      : {}),
    ...(body.locale !== undefined
      ? { locale: normalizeLocale(String(body.locale)) }
      : {}),
    ...(body.catalogThemePreset !== undefined &&
    isCatalogThemePreset(body.catalogThemePreset)
      ? { catalogThemePreset: body.catalogThemePreset }
      : {}),
    ...(body.catalogColors !== undefined &&
    body.catalogColors &&
    typeof body.catalogColors === "object"
      ? {
          catalogColors: normalizeCatalogColors(
            body.catalogColors as Partial<CatalogColorPalette>,
            CATALOG_THEME_DEFAULT,
          ),
        }
      : {}),
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
      const settings = await saveAppSettingsToDb(
        await getDefaultOrganizationId(),
        profilePatch(body),
      );
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

    const staff = isStaffRole(user.role);
    const patch = staff
      ? profilePatch(body)
      : body.locale !== undefined
        ? { locale: normalizeLocale(String(body.locale)) }
        : null;
    if (!patch) {
      return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
    }
    const settings = await saveAppSettingsToDb(user.organizationId, patch);
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
