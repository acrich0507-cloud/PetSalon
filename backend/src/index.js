import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 8080);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (CORS_ORIGINS.length === 0 || CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "petsalon-backend", ts: new Date().toISOString() });
});

function extractShopCodeFromPath(pathValue) {
  if (!pathValue || typeof pathValue !== "string") {
    return null;
  }

  const parts = pathValue.split("/").filter(Boolean);
  const sIndex = parts.findIndex((part) => part === "s");
  if (sIndex !== -1 && parts[sIndex + 1]) {
    return parts[sIndex + 1];
  }

  return null;
}

app.get("/api/public/liff/resolve", async (req, res) => {
  try {
    const shopCode =
      (typeof req.query.shop_code === "string" && req.query.shop_code.trim()) ||
      extractShopCodeFromPath(typeof req.query.path === "string" ? req.query.path : "");

    if (!shopCode) {
      res.status(400).json({ ok: false, error: "shop_code is required" });
      return;
    }

    const { data, error } = await supabase
      .schema("petsalon")
      .from("shop")
      .select("sh_id, sh_liff_id, sh_flag")
      .eq("sh_id", shopCode)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Resolve query failed:", error);
      res.status(500).json({ ok: false, error: "database query failed" });
      return;
    }

    if (!data || !data.sh_liff_id) {
      res.status(404).json({ ok: false, error: "shop or liff_id not found" });
      return;
    }

    if (data.sh_flag === false) {
      res.status(403).json({ ok: false, error: "shop is inactive" });
      return;
    }

    res.json({
      ok: true,
      shopId: data.sh_id,
      liffId: data.sh_liff_id,
    });
  } catch (err) {
    console.error("Resolve endpoint error:", err);
    res.status(500).json({ ok: false, error: "unexpected error" });
  }
});

app.post("/api/public/line/bind-user", async (req, res) => {
  try {
    const { shopId, lineUserId, lineDisplayName } = req.body || {};

    if (!shopId || !lineUserId) {
      res.status(400).json({ ok: false, error: "shopId and lineUserId are required" });
      return;
    }

    const { data: shop, error: shopError } = await supabase
      .schema("petsalon")
      .from("shop")
      .select("sh_id, sh_flag")
      .eq("sh_id", shopId)
      .limit(1)
      .maybeSingle();

    if (shopError) {
      console.error("Shop check failed:", shopError);
      res.status(500).json({ ok: false, error: "database query failed" });
      return;
    }

    if (!shop) {
      res.status(404).json({ ok: false, error: "shop not found" });
      return;
    }

    if (shop.sh_flag === false) {
      res.status(403).json({ ok: false, error: "shop is inactive" });
      return;
    }

    const nowIso = new Date().toISOString();

    const payload = {
      sh_id: shopId,
      u_id: lineUserId,
      u_linename: lineDisplayName || null,
      u_name: lineDisplayName || null,
      u_flag: true,
      update_time: nowIso,
    };

    const { data, error } = await supabase
      .schema("petsalon")
      .from("user")
      .upsert(payload, { onConflict: "sh_id,u_id" })
      .select("sh_id, u_id, u_name, u_linename")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Bind user failed:", error);
      res.status(500).json({ ok: false, error: "upsert failed" });
      return;
    }

    res.json({
      ok: true,
      user: data || {
        sh_id: shopId,
        u_id: lineUserId,
      },
    });
  } catch (err) {
    console.error("Bind endpoint error:", err);
    res.status(500).json({ ok: false, error: "unexpected error" });
  }
});

app.listen(PORT, () => {
  console.log(`petsalon-backend listening on port ${PORT}`);
});
