import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { newPassword } = await req.json();
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      throw new Error("newPassword required (>=8 chars)");
    }

    // Get all profiles
    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, email, role")
      .order("role")
      .order("email");
    if (pErr) throw pErr;

    const results: Array<{ email: string; role: string; ok: boolean; error?: string }> = [];
    for (const p of profiles ?? []) {
      const { error } = await admin.auth.admin.updateUserById(p.id, { password: newPassword });
      results.push({ email: p.email, role: p.role, ok: !error, error: error?.message });
    }

    return new Response(JSON.stringify({ success: true, password: newPassword, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
