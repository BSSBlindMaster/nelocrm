import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const { email, firstName, lastName, roleId, location, phone } = await request.json();

  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: "Welcome2Nelo!",
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: appUser, error: userError } = await supabaseAdmin
    .from("app_users")
    .insert({
      auth_user_id: authUser.user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone || null,
      role_id: roleId,
      location,
      active: true,
    })
    .select("id")
    .single();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId: authUser.user.id, appUserId: appUser.id });
}
