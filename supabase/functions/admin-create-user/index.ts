import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized: missing token");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !caller) throw new Error("Unauthorized: invalid token");

    const { data: callerProfile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (profErr) throw new Error(`Profile lookup failed: ${profErr.message}`);
    if (!callerProfile || !["superadmin", "admin", "manager"].includes(callerProfile.role)) {
      throw new Error(`Insufficient permissions (role=${callerProfile?.role ?? "none"})`);
    }

    const body = await req.json();
    const { email, password, fullName, role, restaurantId, lockUntil } = body;
    console.log("admin-create-user request:", { email, fullName, role, restaurantId, hasPassword: !!password });

    if (!email || !password || !fullName) {
      throw new Error("Missing required fields: email, password, fullName");
    }
    if (password.length < 6) {
      throw new Error("Mật khẩu phải có ít nhất 6 ký tự");
    }

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: role || "admin" },
    });

    if (createError) {
      console.error("createUser error:", createError);
      throw new Error(createError.message);
    }
    if (!newUser?.user) throw new Error("User creation returned no user");

    // Update profile with additional info
    const updates: Record<string, unknown> = { status: "active", full_name: fullName, role: role || "admin" };
    if (restaurantId) updates.restaurant_id = restaurantId;
    if (lockUntil) updates.lock_until = lockUntil;

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", newUser.user.id);

    if (updateErr) {
      console.error("profile update error:", updateErr);
      throw new Error(`Profile update failed: ${updateErr.message}`);
    }

    return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("admin-create-user failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
