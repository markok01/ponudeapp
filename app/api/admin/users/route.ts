import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createUser, deactivateUser, listUsers } from "@/services/users";

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }

  const users = await listUsers();
  return NextResponse.json(
    users.map(({ id, email, name, role, active, created_at }) => ({
      id,
      email,
      name,
      role,
      active,
      created_at,
    })),
  );
}

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const user = await createUser({
      email: body.email,
      password: body.password,
      name: body.name,
      role: "user",
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kreiranje naloga nije uspelo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Nedozvoljeno" }, { status: 403 });
  }

  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Neispravan ID" }, { status: 400 });
  }

  if (id === session.id) {
    return NextResponse.json(
      { error: "Ne možete deaktivirati sopstveni nalog" },
      { status: 400 },
    );
  }

  await deactivateUser(id);
  return NextResponse.json({ message: "Nalog deaktiviran" });
}
