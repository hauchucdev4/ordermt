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

    // Check if superadmins already exist
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "superadmin");

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ message: "Superadmins already exist", count: existing.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accounts = [
      { email: "ordermaster1@ordermaster.app", password: "productions", name: "OrderMaster 1" },
      { email: "ordermaster2@ordermaster.app", password: "productions", name: "OrderMaster 2" },
    ];

    const results = [];
    for (const acc of accounts) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: acc.name, role: "superadmin" },
      });
      if (error) results.push({ email: acc.email, error: error.message });
      else results.push({ email: acc.email, success: true, id: data.user?.id });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
