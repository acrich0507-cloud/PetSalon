import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 8080);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_PETSALON_KEY = process.env.SUPABASE_SERVICE_PETSALON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESOLVED_SUPABASE_KEY = SUPABASE_SERVICE_PETSALON_KEY || SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || "petsalon";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

if (!SUPABASE_URL || !RESOLVED_SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_PETSALON_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, RESOLVED_SUPABASE_KEY, {
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
      .schema(SUPABASE_SCHEMA)
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

async function assertActiveShop(shopId) {
  const { data: shop, error: shopError } = await supabase
    .schema(SUPABASE_SCHEMA)
    .from("shop")
    .select("sh_id, sh_flag")
    .eq("sh_id", shopId)
    .limit(1)
    .maybeSingle();

  if (shopError) {
    return { ok: false, status: 500, error: "database query failed", detail: shopError };
  }
  if (!shop) {
    return { ok: false, status: 404, error: "shop not found" };
  }
  if (shop.sh_flag === false) {
    return { ok: false, status: 403, error: "shop is inactive" };
  }
  return { ok: true, shop };
}

function normalizeSex(value) {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();
  const map = {
    M: "M",
    F: "F",
    O: "O",
    男: "M",
    女: "F",
    其他: "O",
  };
  return map[raw] || null;
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    shopId: row.sh_id,
    uid: row.u_id,
    lineName: row.u_linename,
    name: row.u_name,
    sex: row.u_sex,
    phone: row.u_phone,
    email: row.u_email,
    addr: row.u_addr,
    birthday: row.u_birthday,
    memo: row.u_memo,
    marketing: row.u_marketing,
    flag: row.u_flag,
  };
}

// 查詢會員是否已建檔（僅檢查是否有資料列，不自動建立）
app.get("/api/public/user/check", async (req, res) => {
  try {
    const shopId = typeof req.query.shop_id === "string" ? req.query.shop_id.trim() : "";
    const uid = typeof req.query.uid === "string" ? req.query.uid.trim() : "";

    if (!shopId || !uid) {
      res.status(400).json({ ok: false, error: "shop_id and uid are required" });
      return;
    }

    const shopCheck = await assertActiveShop(shopId);
    if (!shopCheck.ok) {
      res.status(shopCheck.status).json({ ok: false, error: shopCheck.error });
      return;
    }

    const { data, error } = await supabase
      .schema(SUPABASE_SCHEMA)
      .from("user")
      .select("u_id, u_phone")
      .eq("sh_id", shopId)
      .eq("u_id", uid)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Check user failed:", error);
      res.status(500).json({ ok: false, error: "database query failed" });
      return;
    }

    // 有資料列且手機已填才視為「已完成註冊」；僅部分欄位不算完成
    const exists = Boolean(data && data.u_phone);

    res.json({ ok: true, exists, registered: exists });
  } catch (err) {
    console.error("Check user endpoint error:", err);
    res.status(500).json({ ok: false, error: "unexpected error" });
  }
});

// 讀取單一會員完整資料；查無資料回傳 data: null（新會員正常情況）
app.get("/api/public/user", async (req, res) => {
  try {
    const shopId = typeof req.query.shop_id === "string" ? req.query.shop_id.trim() : "";
    const uid = typeof req.query.uid === "string" ? req.query.uid.trim() : "";

    if (!shopId || !uid) {
      res.status(400).json({ ok: false, error: "shop_id and uid are required" });
      return;
    }

    const shopCheck = await assertActiveShop(shopId);
    if (!shopCheck.ok) {
      res.status(shopCheck.status).json({ ok: false, error: shopCheck.error });
      return;
    }

    const { data, error } = await supabase
      .schema(SUPABASE_SCHEMA)
      .from("user")
      .select(
        "sh_id, u_id, u_linename, u_name, u_sex, u_phone, u_email, u_addr, u_birthday, u_memo, u_marketing, u_flag"
      )
      .eq("sh_id", shopId)
      .eq("u_id", uid)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Get user failed:", error);
      res.status(500).json({ ok: false, error: "database query failed" });
      return;
    }

    res.json({ ok: true, data: toPublicUser(data) });
  } catch (err) {
    console.error("Get user endpoint error:", err);
    res.status(500).json({ ok: false, error: "unexpected error" });
  }
});

// 新增/更新會員資料（完整註冊）
app.post("/api/public/user", async (req, res) => {
  try {
    const body = req.body || {};
    const shopId = typeof body.shopId === "string" ? body.shopId.trim() : "";
    const uid = typeof body.uid === "string" ? body.uid.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const sex = normalizeSex(body.sex);

    if (!shopId || !uid || !name || !phone || !sex) {
      res.status(400).json({
        ok: false,
        error: "shopId, uid, name, phone and sex are required",
      });
      return;
    }

    const shopCheck = await assertActiveShop(shopId);
    if (!shopCheck.ok) {
      res.status(shopCheck.status).json({ ok: false, error: shopCheck.error });
      return;
    }

    const nowIso = new Date().toISOString();
    const payload = {
      sh_id: shopId,
      u_id: uid,
      u_linename: body.lineName || null,
      u_name: name,
      u_sex: sex,
      u_phone: phone,
      u_email: body.email || null,
      u_addr: body.addr || null,
      u_birthday: body.birthday || null,
      u_memo: body.memo || null,
      u_marketing: body.marketing !== false,
      u_flag: true,
      update_time: nowIso,
    };

    const { data, error } = await supabase
      .schema(SUPABASE_SCHEMA)
      .from("user")
      .upsert(payload, { onConflict: "sh_id,u_id" })
      .select(
        "sh_id, u_id, u_linename, u_name, u_sex, u_phone, u_email, u_addr, u_birthday, u_memo, u_marketing, u_flag"
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Upsert user failed:", error);
      res.status(500).json({
        ok: false,
        error: "upsert failed",
        detail: error.message || String(error),
      });
      return;
    }

    res.json({ ok: true, data: toPublicUser(data) });
  } catch (err) {
    console.error("Upsert user endpoint error:", err);
    res.status(500).json({ ok: false, error: "unexpected error" });
  }
});

// 相容舊路徑：僅更新 LINE 顯示名稱，不建立完整會員（避免誤判已註冊）
app.post("/api/public/line/bind-user", async (req, res) => {
  try {
    const { shopId, lineUserId, lineDisplayName } = req.body || {};

    if (!shopId || !lineUserId) {
      res.status(400).json({ ok: false, error: "shopId and lineUserId are required" });
      return;
    }

    const shopCheck = await assertActiveShop(shopId);
    if (!shopCheck.ok) {
      res.status(shopCheck.status).json({ ok: false, error: shopCheck.error });
      return;
    }

    const { data: existing, error: findError } = await supabase
      .schema(SUPABASE_SCHEMA)
      .from("user")
      .select("sh_id, u_id, u_name, u_linename, u_phone")
      .eq("sh_id", shopId)
      .eq("u_id", lineUserId)
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error("Bind lookup failed:", findError);
      res.status(500).json({ ok: false, error: "database query failed" });
      return;
    }

    // 新會員不在此自動建檔，導向註冊頁完成資料
    if (!existing) {
      res.json({
        ok: true,
        registered: false,
        user: null,
      });
      return;
    }

    const { data, error } = await supabase
      .schema(SUPABASE_SCHEMA)
      .from("user")
      .update({
        u_linename: lineDisplayName || existing.u_linename,
        update_time: new Date().toISOString(),
      })
      .eq("sh_id", shopId)
      .eq("u_id", lineUserId)
      .select("sh_id, u_id, u_name, u_linename, u_phone")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Bind user update failed:", error);
      res.status(500).json({ ok: false, error: "update failed", detail: error.message });
      return;
    }

    res.json({
      ok: true,
      registered: Boolean(data?.u_phone),
      user: data,
    });
  } catch (err) {
    console.error("Bind endpoint error:", err);
    res.status(500).json({ ok: false, error: "unexpected error" });
  }
});

app.listen(PORT, () => {
  console.log(`petsalon-backend listening on port ${PORT}`);
});
