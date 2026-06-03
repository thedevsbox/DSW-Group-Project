import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Missing Authorization header" },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.slice(7);

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return Response.json(
        { error: "Invalid JWT" },
        { status: 401, headers: corsHeaders }
      );
    }

    const adminUserId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUserId)
      .single();

    if (profileError || profile?.role !== "admin") {
      return Response.json(
        { error: "Forbidden: admin only" },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await req.json().catch(() => null);
    const userId = body?.userId;

    if (!userId) {
      return Response.json(
        { error: "Missing userId" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return Response.json(
        { error: `Auth delete failed: ${deleteAuthError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }

    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (deleteProfileError) {
      return Response.json(
        {
          error: `Auth user deleted, but profile delete failed: ${deleteProfileError.message}`,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Error in delete-user function:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    );
  }
});