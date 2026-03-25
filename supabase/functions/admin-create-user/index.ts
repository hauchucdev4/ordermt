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

    // Verify caller is superadmin or admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error("Unauthorized");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["superadmin", "admin", "manager"].includes(callerProfile.role)) {
      throw new Error("Insufficient permissions");
    }

    const { email, password, fullName, role, restaurantId, lockUntil } = await req.json();

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: role || "admin" },
    });

    if (createError) throw createError;

    // Update profile with additional info
    if (newUser.user) {
      const updates: Record<string, unknown> = { status: "active" };
      if (restaurantId) updates.restaurant_id = restaurantId;
      if (lockUntil) updates.lock_until = lockUntil;
      
      await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", newUser.user.id);
    }

    return new Response(JSON.stringify({ success: true, userId: newUser.user?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
