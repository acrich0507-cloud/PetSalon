-- Multi-tenant pet salon booking schema
-- Ownership model:
-- customer (platform-managed merchant customer)
--   -> shop (LINE Official Account deployed for a customer)
--      -> "user" (end users under one LINE Official Account)
--         -> pet (pets owned by one end user)

create schema if not exists petsalon;

-- 客戶主檔：由開發商控管
create table if not exists petsalon.customer (
  c_id text primary key,                           -- 客戶編號
  c_name text not null,                            -- 客戶姓名/公司名稱
  c_pw text null,                                  -- 密碼(若改由 LINE/OAuth 驗證可移除)
  c_phone text null,                               -- 客戶手機
  c_email text null,                               -- 客戶 email
  c_memo text null,                                -- 客戶備註
  c_flag boolean not null default true,            -- 客戶是否啟用
  create_time timestamptz not null default now(),  -- 建立時間
  update_time timestamptz not null default now()   -- 更新時間
);

-- 官方帳號主檔：由開發商控管已部署的 LINE 官方帳號
create table if not exists petsalon.shop (
  sh_id text primary key,                          -- 店家代碼(建議存 LINE Official Account ID)
  c_id text not null,                              -- 所屬客戶編號
  sh_liff_id text null,                            -- LIFF ID
  sh_channel_id text null,                         -- LINE Channel ID
  sh_acc_no text null,                             -- 店家銀行帳號
  sh_last_paydate date null,                       -- 最後繳費日期
  sh_pay_type text null check (sh_pay_type in ('Y', 'M')), -- 繳費方式(年繳:Y;月繳:M)
  sh_ctr_sdate date null,                          -- 合約開始日期
  sh_ctr_edate date null,                          -- 合約結束日期
  sh_flag boolean not null default true,           -- 店家是否啟用
  create_time timestamptz not null default now(),  -- 建立時間
  update_time timestamptz not null default now(),  -- 更新時間
  constraint shop_customer_fk
    foreign key (c_id) references petsalon.customer (c_id)
    on update cascade on delete restrict
);

-- 用戶主檔：各官方帳號底下的 LINE 使用者
create table if not exists petsalon."user" (
  sh_id text not null,                             -- 店家代碼
  u_id text not null,                              -- 使用者 ID (LINE userId)
  u_linename text null,                            -- LINE 暱稱
  u_name text null,                                -- 使用者名稱
  u_sex text null check (u_sex in ('M', 'F', 'O')),
  u_phone text null,                               -- 使用者電話
  u_addr text null,                                -- 使用者地址
  u_email text null,                               -- 使用者 Email
  u_birthday date null,                            -- 使用者生日
  u_marketing boolean not null default false,      -- 是否願意接收促銷訊息
  u_flag boolean not null default true,            -- 使用者是否啟用
  u_memo text null,                                -- 備註
  u_smemo text null,                               -- 店家備註
  create_time timestamptz not null default now(),  -- 建立時間
  update_time timestamptz not null default now(),  -- 更新時間
  constraint user_pkey primary key (sh_id, u_id),
  constraint user_shop_fk
    foreign key (sh_id) references petsalon.shop (sh_id)
    on update cascade on delete cascade
);

-- 寵物主檔：寵物屬於哪個 user
create table if not exists petsalon.pet (
  sh_id text not null,                             -- 店家代碼
  u_id text not null,                              -- 使用者 ID
  p_id text not null,                              -- 寵物 ID
  p_name text null,                                -- 寵物名稱
  p_type text null,                                -- 寵物類型
  p_breeds text null,                              -- 寵物品種
  p_ic text null,                                  -- 寵物晶片
  p_birthday date null,                            -- 寵物生日
  p_sex text null check (p_sex in ('M', 'F', 'O')),
  p_weight integer null check (p_weight >= 0),     -- 體重
  p_size text null,                                -- 體型
  p_memo text null,                                -- 飼主備註
  p_smemo text null,                               -- 店家備註
  create_time timestamptz not null default now(),  -- 建立時間
  update_time timestamptz not null default now(),  -- 更新時間
  constraint pet_pkey primary key (sh_id, u_id, p_id),
  constraint pet_user_fk
    foreign key (sh_id, u_id) references petsalon."user" (sh_id, u_id)
    on update cascade on delete cascade
);

-- 寵物健康檔：每個寵物一筆健康旗標
create table if not exists petsalon.pet_health (
  sh_id text not null,
  u_id text not null,
  p_id text not null,
  ph_none boolean not null default false,          -- 無疾病
  ph_ckd boolean not null default false,           -- 慢性腎衰竭
  ph_rv boolean not null default false,            -- 心絲蟲
  ph_hi boolean not null default false,            -- 聽力受損
  ph_vi boolean not null default false,            -- 視力受損
  ph_epi boolean not null default false,           -- 癲癇
  ph_cdv boolean not null default false,           -- 犬瘟熱
  ph_ehr boolean not null default false,           -- 艾莉希體
  ph_piv boolean not null default false,           -- 氣管塌陷
  ph_cardio boolean not null default false,        -- 心臟病
  ph_asth boolean not null default false,          -- 氣喘(易喘)
  ph_hip boolean not null default false,           -- 髖關節問題
  ph_hip_memo text null,                           -- 髖關節問題說明
  ph_para boolean not null default false,          -- 寄生蟲感染
  ph_para_memo text null,                          -- 寄生蟲感染說明
  ph_oa boolean not null default false,            -- 骨骼(骨折)舊傷
  ph_oa_memo text null,                            -- 骨骼(骨折)舊傷說明
  ph_ad boolean not null default false,            -- 皮膚疾病
  ph_ad_memo text null,                            -- 皮膚疾病說明
  ph_other boolean not null default false,         -- 其他
  ph_other_memo text null,                         -- 其他說明
  update_time timestamptz not null default now(),  -- 更新時間
  constraint pet_health_pkey primary key (sh_id, u_id, p_id),
  constraint pet_health_pet_fk
    foreign key (sh_id, u_id, p_id) references petsalon.pet (sh_id, u_id, p_id)
    on update cascade on delete cascade
);

-- 寵物注意事項檔：每個寵物一筆注意事項
create table if not exists petsalon.pet_wariness (
  sh_id text not null,
  u_id text not null,
  p_id text not null,
  pw_none boolean not null default false,          -- 無須注意事項
  pw_asb boolean not null default false,           -- 攻擊性
  pw_wn boolean not null default false,            -- 不親狗
  pw_mani boolean not null default false,          -- 易緊張
  pw_sad boolean not null default false,           -- 分離焦慮
  pw_dds boolean not null default false,           -- 掙扎
  pw_pd boolean not null default false,            -- 不親人
  pw_bwa boolean not null default false,           -- 敏感部位
  pw_bwa_memo text null,                           -- 敏感部位說明
  pw_other boolean not null default false,         -- 其他
  pw_other_memo text null,                         -- 其他說明
  update_time timestamptz not null default now(),
  constraint pet_wariness_pkey primary key (sh_id, u_id, p_id),
  constraint pet_wariness_pet_fk
    foreign key (sh_id, u_id, p_id) references petsalon.pet (sh_id, u_id, p_id)
    on update cascade on delete cascade
);

-- 查詢與關聯常用索引
create index if not exists idx_shop_c_id on petsalon.shop (c_id);
create index if not exists idx_user_sh_id on petsalon."user" (sh_id);
create index if not exists idx_pet_owner on petsalon.pet (sh_id, u_id);
