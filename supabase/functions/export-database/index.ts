import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "organizations",
  "profiles",
  "user_roles",
  "company_info",
  "company_branches",
  "company_admins",
  "work_schedules",
  "time_records",
  "adjustment_requests",
  "vacation_requests",
  "documents",
  "holidays",
  "hours_balance",
  "payroll_settings",
  "location_settings",
  "schedule_adjustments",
  "status_history",
  "monthly_overtime_decisions",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is suporte
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "suporte")
      .maybeSingle();

    if (!roleData) throw new Error("Forbidden: suporte role required");

    const { format, organization_id } = await req.json();

    if (!organization_id) throw new Error("organization_id required");

    const results: Record<string, any[]> = {};

    for (const table of TABLES) {
      let query = supabase.from(table).select("*");

      if (table === "organizations") {
        query = query.eq("id", organization_id);
      } else {
        query = query.eq("organization_id", organization_id);
      }

      const { data, error } = await query;
      if (error) {
        console.error(`Error fetching ${table}:`, error.message);
        results[table] = [];
      } else {
        results[table] = data || [];
      }
    }

    if (format === "sql") {
      let sql = `-- Export for organization: ${organization_id}\n-- Generated at: ${new Date().toISOString()}\n\n`;

      for (const table of TABLES) {
        const rows = results[table];
        if (!rows || rows.length === 0) continue;

        sql += `-- Table: ${table}\n`;
        for (const row of rows) {
          const cols = Object.keys(row);
          const vals = cols.map((c) => {
            const v = row[c];
            if (v === null) return "NULL";
            if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
            if (typeof v === "number") return String(v);
            if (Array.isArray(v)) return `ARRAY[${v.map((i: any) => `'${String(i).replace(/'/g, "''")}'`).join(",")}]::text[]`;
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          sql += `INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${vals.join(", ")});\n`;
        }
        sql += "\n";
      }

      return new Response(JSON.stringify({ data: sql, format: "sql" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CSV format
    const csvParts: Record<string, string> = {};
    for (const table of TABLES) {
      const rows = results[table];
      if (!rows || rows.length === 0) continue;

      const cols = Object.keys(rows[0]);
      const header = cols.join(",");
      const lines = rows.map((row) =>
        cols
          .map((c) => {
            const v = row[c];
            if (v === null) return "";
            const s = String(v);
            if (s.includes(",") || s.includes('"') || s.includes("\n")) {
              return `"${s.replace(/"/g, '""')}"`;
            }
            return s;
          })
          .join(",")
      );
      csvParts[table] = [header, ...lines].join("\n");
    }

    return new Response(JSON.stringify({ data: csvParts, format: "csv" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
