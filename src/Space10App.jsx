import React, { useState, useEffect, useCallback } from "react";
import {
  Home as HomeIcon,
  Package,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  LogOut,
  Rocket,
  Orbit,
  Zap,
  Cloud,
  Box,
  Sunrise,
  Gem,
  CircleDot,
  Star,
  Share2,
  Triangle,
  Circle,
  MessageCircle,
  Upload,
} from "lucide-react";
import { supabase, isConfigured } from "./supabaseClient";
import SupabaseSetupScreen from "./SupabaseSetupScreen";

const PRODUCT_ICONS = { Rocket, Orbit, Zap, Cloud, Box, Package, Sunrise, Gem, CircleDot, Star, Share2, Triangle, Circle };

// ---------------------------------------------------------------------------
// This is the real, Supabase-backed version of the app.
//
// REAL (backed by your Supabase project):
//   - Login / Register           -> supabase.auth (phone + password)
//   - Signup bonus (3,000 UGX)   -> credited automatically by a DB trigger
//   - Daily check-in (200 UGX)   -> supabase.rpc('claim_daily_checkin'), once/day
//   - Wallet balance             -> profiles.balance, live via Realtime
//   - Deposit                    -> direct insert into deposits table, admin-verified (no Edge Functions -- RPCs are called straight from the client)
//   - Withdraw                   -> supabase.rpc('request_withdrawal'), 14% fee held immediately, admin-verified payout
//   - Transaction history        -> merged from deposits + withdrawals + daily_checkins tables, live via Realtime
//   - Admin approve/reject       -> supabase.rpc('approve_deposit' / 'reject_deposit' / 'approve_withdrawal' / 'reject_withdrawal')
//
// STILL PREVIEW ONLY (no backend table/RPC exists yet -- flagged in the UI
// with a "Preview" pill so nothing fake is presented as real):
//   - Product catalog + "Buy now"  (no products/purchases table)
//   - Team downline levels          (no referral RPC yet -- code + link ARE real)
//   - Admin totals (users/deposits/invested/paid out) (no stats endpoint yet)
// ---------------------------------------------------------------------------

const tokens = {
  bgDeep: "#0E1029",
  bgPanel: "#161A3B",
  bgRaised: "#1E2350",
  accentMint: "#6FE7C7",
  accentGold: "#E8B95C",
  accentCoral: "#E8737A",
  textPrimary: "#F1F2FB",
  textMuted: "#8B90B8",
  border: "#2A2F5C",
};

const NETWORKS = {
  AIRTEL: { label: "Airtel Money", code: "7192512", name: "Essentials limited", ussd: "*185*9#" },
  MTN: { label: "MTN MoMo", code: "44867602", name: "Nabirye Flavia", ussd: "*165*3#" },
};
const MIN_DEPOSIT = 8000;
const MIN_WITHDRAWAL = 4000;
const WITHDRAWAL_FEE_RATE = 0.14;

function formatUGX(amount) {
  const rounded = Math.round(Number(amount) || 0);
  return `UGX ${rounded.toLocaleString()}`;
}

// Accepts 07XXXXXXXX, 2567XXXXXXXX, or +2567XXXXXXXX and normalizes to the
// +256XXXXXXXXX format used everywhere in the UI and passed to Mobile Money.
function normalizePhoneUG(input) {
  const trimmed = (input || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  let normalized = null;
  if (digits.length === 9) normalized = `+256${digits}`;
  else if (digits.length === 10 && digits.startsWith("0")) normalized = `+256${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith("256")) normalized = `+${digits}`;
  return normalized && /^\+256\d{9}$/.test(normalized) ? normalized : null;
}

// Supabase's Phone auth provider requires an SMS provider (Twilio, etc.)
// to be configured, which this project doesn't have -- attempting
// supabase.auth.signUp({ phone }) on a project without it enabled fails
// with "Phone signups are disabled". Workaround: authenticate with Email
// auth instead, using a synthetic, non-deliverable email derived from the
// phone number as the "email" Supabase's auth system requires. The real
// phone number is never lost -- it's stored in both the signup metadata
// and profiles.phone_number (via the handle_new_user trigger), and is
// what's actually shown anywhere in the UI. Nobody ever sees or needs
// this synthetic address; it only exists to satisfy Supabase Auth's
// email-shaped identifier.
function phoneToAuthEmail(normalizedPhone) {
  const digits = normalizedPhone.replace(/\D/g, ""); // "+256701234567" -> "256701234567"
  return `${digits}@space10.vercel.app`;
}

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/EysSGOrzIyC6agfTmIt5ip?s=cl&p=a&mlu=4&ilr=4";

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------
function Card({ children, style }) {
  return (
    <div style={{ background: tokens.bgPanel, border: `1px solid ${tokens.border}`, borderRadius: 16, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Pill({ children, tone = "muted" }) {
  const toneColor = tone === "mint" ? tokens.accentMint : tone === "gold" ? tokens.accentGold : tone === "coral" ? tokens.accentCoral : tokens.textMuted;
  return (
    <span style={{ fontSize: 12, color: toneColor, border: `1px solid ${toneColor}55`, borderRadius: 999, padding: "3px 10px", fontFamily: "'Inter', sans-serif" }}>
      {children}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled, tone = "mint", style }) {
  const bg = tone === "mint" ? tokens.accentMint : tone === "coral" ? tokens.accentCoral : tokens.accentGold;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? `${bg}55` : bg,
        color: "#0E1029",
        border: "none",
        borderRadius: 10,
        padding: "10px 16px",
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "transparent",
        color: tokens.textPrimary,
        border: `1px solid ${tokens.border}`,
        borderRadius: 10,
        padding: "10px 16px",
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 14,
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, color: tokens.textPrimary, fontWeight: 600 }}>{children}</div>
      {sub && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FieldInput({ label, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginBottom: 6 }}>{label}</div>
      <input
        {...props}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: tokens.bgRaised,
          border: `1px solid ${tokens.border}`,
          borderRadius: 10,
          padding: "12px 14px",
          color: tokens.textPrimary,
          fontFamily: "'Inter', sans-serif",
          fontSize: 15,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth screens
// ---------------------------------------------------------------------------
function AuthShell({ children }) {
  return (
    <div style={{ padding: "60px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, color: tokens.textPrimary, fontWeight: 700, marginBottom: 4 }}>
        Space10
      </div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted, marginBottom: 28 }}>
        Earn daily. Grow your team.
      </div>
      <div style={{ width: "100%" }}>{children}</div>
    </div>
  );
}

function RegisterScreen({ onRegister, goToLogin, error, busy, defaultReferralCode }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(defaultReferralCode || "");

  return (
    <AuthShell>
      <Card>
        <SectionTitle sub="Set up your account to start earning.">Create account</SectionTitle>
        <FieldInput label="Full name" placeholder="e.g. Sarah Nakato" value={name} onChange={(e) => setName(e.target.value)} />
        <FieldInput label="Phone number" placeholder="e.g. 0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <FieldInput label="Password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FieldInput label="Referral code (optional)" placeholder="e.g. AB12CD34" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
        {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.accentCoral, marginBottom: 10 }}>{error}</div>}
        <PrimaryButton style={{ width: "100%" }} disabled={busy} onClick={() => onRegister({ name, phone, password, referralCode })}>
          {busy ? "Creating account…" : "Register"}
        </PrimaryButton>
        <div style={{ textAlign: "center", marginTop: 16, fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted }}>
          Already have an account?{" "}
          <span style={{ color: tokens.accentMint, cursor: "pointer" }} onClick={goToLogin}>
            Log in
          </span>
        </div>
      </Card>
    </AuthShell>
  );
}

function LoginScreen({ onLogin, goToRegister, onOpenSetup, error, notice, busy }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthShell>
      <Card>
        <SectionTitle sub="Log in with your phone number and password.">Log in</SectionTitle>
        {notice && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.accentMint, marginBottom: 10 }}>{notice}</div>}
        <FieldInput label="Phone number" placeholder="e.g. 0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <FieldInput label="Password" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.accentCoral, marginBottom: 10 }}>{error}</div>}
        <PrimaryButton style={{ width: "100%" }} disabled={busy} onClick={() => onLogin({ phone, password })}>
          {busy ? "Logging in…" : "Log in"}
        </PrimaryButton>
        <div style={{ textAlign: "center", marginTop: 16, fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted }}>
          New here?{" "}
          <span style={{ color: tokens.accentMint, cursor: "pointer" }} onClick={goToRegister}>
            Create an account
          </span>
        </div>
        <div style={{ textAlign: "center", marginTop: 10, fontFamily: "'Inter', sans-serif", fontSize: 11, color: tokens.textMuted, cursor: "pointer" }} onClick={onOpenSetup}>
          Supabase settings
        </div>
      </Card>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// User-facing tabs
// ---------------------------------------------------------------------------
function ProductArt({ icon, gradient, imageUrl }) {
  const Icon = PRODUCT_ICONS[icon] || Package;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        style={{
          aspectRatio: "1 / 1",
          width: "100%",
          borderRadius: 14,
          objectFit: "cover",
          marginBottom: 12,
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      style={{
        aspectRatio: "1 / 1",
        width: "100%",
        borderRadius: 14,
        background: gradient,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(14,16,41,0.35) 1px, transparent 1.5px)", backgroundSize: "14px 14px" }} />
      <Icon size={36} color="#0E1029" style={{ position: "relative", zIndex: 1 }} />
    </div>
  );
}

function HomeTab({ products, balance, profile, onCheckin, onPurchase }) {
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState("");
  const [purchasingId, setPurchasingId] = useState(null);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const alreadyCheckedInToday = profile.last_checkin === new Date().toISOString().slice(0, 10);

  const handleCheckin = async () => {
    setCheckinBusy(true);
    setCheckinMessage("");
    try {
      await onCheckin();
      setCheckinMessage("+200 UGX claimed!");
    } catch (err) {
      setCheckinMessage(err.message || "Could not check in.");
    } finally {
      setCheckinBusy(false);
    }
  };

  const handleBuy = async (product) => {
    setPurchasingId(product.id);
    setPurchaseMessage("");
    try {
      await onPurchase(product.id);
      setPurchaseMessage(`${product.name} purchased! Check My product for progress.`);
    } catch (err) {
      setPurchaseMessage(err.message || "Purchase failed.");
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div>
      <div
        style={{
          borderRadius: 20,
          padding: "26px 20px",
          marginBottom: 14,
          background:
            "radial-gradient(circle at 20% 20%, rgba(111,231,199,0.18), transparent 55%), radial-gradient(circle at 80% 0%, rgba(232,185,92,0.14), transparent 50%), #161A3B",
          border: `1px solid ${tokens.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: tokens.textMuted, fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
          <Sparkles size={14} color={tokens.accentGold} /> Wallet balance
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, color: tokens.textPrimary, fontWeight: 700, marginTop: 4 }}>
          {formatUGX(balance)}
        </div>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: tokens.textPrimary, fontWeight: 600 }}>
              Daily check-in
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
              {checkinMessage || "Claim 200 UGX once every day."}
            </div>
          </div>
          <PrimaryButton
            tone={alreadyCheckedInToday ? "gold" : "mint"}
            disabled={alreadyCheckedInToday || checkinBusy}
            onClick={handleCheckin}
          >
            {alreadyCheckedInToday ? "Claimed" : checkinBusy ? "Claiming…" : "Claim"}
          </PrimaryButton>
        </div>
      </Card>

      <SectionTitle sub="45-day cycle. Daily profit is credited automatically 24 hours after purchase.">Products</SectionTitle>
      {purchaseMessage && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.accentMint, marginBottom: 10 }}>{purchaseMessage}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {products.map((p) => (
          <Card key={p.id} style={{ padding: 12 }}>
            <ProductArt icon={p.icon} gradient={p.gradient} imageUrl={p.image_url} />
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: tokens.textPrimary, fontWeight: 600, lineHeight: 1.2 }}>
              {p.name}
            </div>
            <div style={{ marginTop: 6 }}>
              <Pill tone="gold">{p.tag}</Pill>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: tokens.textPrimary, fontWeight: 700 }}>
                {formatUGX(p.price)}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: tokens.accentMint, marginTop: 2 }}>
                +{formatUGX(p.daily_profit)}/day
              </div>
            </div>
            <PrimaryButton disabled={purchasingId === p.id} onClick={() => handleBuy(p)} style={{ width: "100%", marginTop: 10 }}>
              {purchasingId === p.id ? "Processing…" : "Buy now"}
            </PrimaryButton>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MyProductTab({ userProducts }) {
  return (
    <div>
      <SectionTitle sub="Progress resets to a new 45-day cycle with each purchase.">My product</SectionTitle>
      {userProducts.length === 0 ? (
        <Card>
          <div style={{ fontFamily: "'Inter', sans-serif", color: tokens.textMuted, fontSize: 14 }}>
            Nothing purchased yet. Head to Home to pick a product.
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {userProducts.map((m) => {
            const pct = Math.min(100, Math.round((m.days_credited / m.duration_days) * 100));
            return (
              <Card key={m.id}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: tokens.textPrimary, fontWeight: 600 }}>
                    {m.products?.name || "Product"}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.accentMint }}>
                    +{formatUGX(m.earned)} earned
                  </div>
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>
                  Day {m.days_credited} of {m.duration_days} · {formatUGX(m.daily_profit)}/day
                  {m.status === "completed" && " · Cycle complete"}
                </div>
                <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: tokens.bgRaised, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: m.status === "completed" ? tokens.accentGold : tokens.accentMint, borderRadius: 999 }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamTab({ profile }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [downline, setDownline] = useState({ 1: [], 2: [], 3: [] });
  const [downlineLoading, setDownlineLoading] = useState(true);
  const [downlineError, setDownlineError] = useState("");
  const [summary, setSummary] = useState({ total_referrals: 0, total_bonus: 0 });
  const [showTeam, setShowTeam] = useState(false);
  const code = profile.referral_code;
  const inviteLink = `${window.location.origin}/?ref=${code}`;

  useEffect(() => {
    let mounted = true;
    supabase
      .rpc("get_my_downline")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setDownlineError(error.message);
        } else {
          const grouped = { 1: [], 2: [], 3: [] };
          (data || []).forEach((row) => grouped[row.level]?.push(row));
          setDownline(grouped);
        }
        setDownlineLoading(false);
      });

    supabase
      .rpc("get_my_referral_summary")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (!error && data && data[0]) {
          setSummary({
            total_referrals: data[0].total_referrals || 0,
            total_bonus: Number(data[0].total_bonus || 0)
          });
        }
      });

    return () => { mounted = false; };
  }, []);

  const copyToClipboard = (text, setFlag) => {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    setFlag(true);
    setTimeout(() => setFlag(false), 1500);
  };

  const levels = [
    { level: 1, pct: "20%" },
    { level: 2, pct: "2%" },
    { level: 3, pct: "1%" },
  ];

  const allReferrals = [
    ...downline[1].map(u => ({ ...u, lvl: 1 })),
    ...downline[2].map(u => ({ ...u, lvl: 2 })),
    ...downline[3].map(u => ({ ...u, lvl: 3 }))
  ];

  return (
    <div>
      <SectionTitle sub="Invite others using your code or link.">Referrals</SectionTitle>

      {/* Summary Card */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: tokens.bgRaised, borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
              <Users size={14} color={tokens.accentMint} />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: tokens.textMuted }}>My Referrals</span>
            </div>
            <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 26, color: tokens.textPrimary, fontWeight: 700 }}>
              {summary.total_referrals}
            </div>
          </div>
          <div style={{ background: tokens.bgRaised, borderRadius: 12, padding: 16, textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
              <Sparkles size={14} color={tokens.accentGold} />
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: tokens.textMuted }}>Referral Bonus</span>
            </div>
            <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 22, color: tokens.accentMint, fontWeight: 700 }}>
              {formatUGX(summary.total_bonus)}
            </div>
          </div>
        </div>
      </Card>

      {/* Invitation Code */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: tokens.textMuted }}>Invitation Code</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, color: tokens.textPrimary, fontWeight: 600 }}>{code}</div>
          <GhostButton onClick={() => copyToClipboard(code, setCodeCopied)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px" }}>
            {codeCopied ? <Check size={14} color={tokens.accentMint} /> : <Copy size={14} />}
            {codeCopied ? "Copied" : "Copy"}
          </GhostButton>
        </div>
      </Card>

      {/* Invitation Link */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: tokens.textMuted }}>Invitation Link</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 10 }}>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: tokens.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{inviteLink}</div>
          <GhostButton onClick={() => copyToClipboard(inviteLink, setLinkCopied)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px" }}>
            {linkCopied ? <Check size={14} color={tokens.accentMint} /> : <Copy size={14} />}
            {linkCopied ? "Copied" : "Copy"}
          </GhostButton>
        </div>
      </Card>

      {/* WhatsApp Group */}
      <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
        <Card style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={20} color={tokens.accentMint} />
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: tokens.textPrimary, fontWeight: 600 }}>Join our WhatsApp Group</div>
          </div>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: tokens.accentMint }}>Open →</span>
        </Card>
      </a>

      {/* Referral Levels */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 16, color: tokens.textPrimary, fontWeight: 700 }}>Referral Levels</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 4 }}>Team commission overview</div>
          </div>
          <PrimaryButton onClick={() => setShowTeam(!showTeam)} style={{ padding: "10px 20px", fontSize: 13 }}>
            <Users size={14} /> {showTeam ? "Hide Team" : "Team"}
          </PrimaryButton>
        </div>

        {downlineLoading ? (
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: tokens.textMuted }}>Loading...</div>
        ) : downlineError ? (
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: tokens.accentCoral }}>{downlineError}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {levels.map(({ level, pct }) => {
              const list = downline[level] || [];
              const earned = list.reduce((sum, u) => {
                const invested = Number(u.total_invested || 0);
                const rate = level === 1 ? 0.20 : level === 2 ? 0.02 : 0.01;
                return sum + Math.floor(invested * rate);
              }, 0);
              const colors = { 1: tokens.accentMint, 2: "#3B82F6", 3: tokens.accentGold };
              return (
                <div key={level} style={{ background: tokens.bgRaised, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, background: colors[level], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Space Grotesk, sans-serif", fontSize: 16, fontWeight: 700 }}>{level}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 15, color: tokens.textPrimary, fontWeight: 700 }}>LV{level}</span>
                        <span style={{ background: `${colors[level]}33`, color: colors[level], padding: "2px 8px", borderRadius: 6, fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600 }}>{pct}</span>
                      </div>
                      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>Commission</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 14, color: tokens.textPrimary, fontWeight: 600 }}>{list.length} {list.length === 1 ? "Person" : "People"}</div>
                    <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 13, color: tokens.accentMint, fontWeight: 600, marginTop: 2 }}>{formatUGX(earned)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Team List (only when showTeam is true) */}
      {showTeam && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 15, color: tokens.textPrimary, fontWeight: 700, marginBottom: 12 }}>My Team</div>
          {allReferrals.length === 0 ? (
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: tokens.textMuted }}>No referrals yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allReferrals.map((u) => (
                <div key={u.id} style={{ background: tokens.bgRaised, borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 14, color: tokens.textPrimary, fontWeight: 600 }}>{u.full_name || u.phone_number}</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>{u.phone_number} · LV{u.lvl} · Joined {new Date(u.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{ background: u.has_purchased ? `${tokens.accentMint}33` : `${tokens.textMuted}22`, color: u.has_purchased ? tokens.accentMint : tokens.textMuted, padding: "4px 10px", borderRadius: 20, fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                    {u.has_purchased ? "Invested" : "Not Invested"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
                     }
function ModalShell({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,11,26,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 10 }}>
      <div style={{ background: tokens.bgPanel, borderTop: `1px solid ${tokens.border}`, borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxWidth: 420, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: tokens.textPrimary, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} color={tokens.textMuted} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalInput(props) {
  return (
    <input
      {...props}
      style={{ width: "100%", boxSizing: "border-box", background: tokens.bgRaised, border: `1px solid ${tokens.border}`, borderRadius: 10, padding: "12px 14px", color: tokens.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 15, marginBottom: 8 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Deposit: 4-step manual Mobile Money flow.
//   1. amount + phone -> 2. pick network, see merchant code + dial string
//   -> 3. enter the Mobile Money TXID -> 4. "wait for verification"
// ---------------------------------------------------------------------------
function DepositModal({ onClose, onSubmit, defaultPhone }) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [network, setNetwork] = useState(null);
  const [txid, setTxid] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const goToNetworkStep = () => {
    setError("");
    const value = parseFloat(amount);
    if (!value || value < MIN_DEPOSIT) return setError(`Minimum deposit is ${formatUGX(MIN_DEPOSIT)}.`);
    if (!normalizePhoneUG(phone)) return setError("Enter a valid Ugandan number, e.g. 0712345678.");
    setStep(2);
  };

  const submitDeposit = async () => {
    setError("");
    if (!txid.trim()) return setError("Enter the Mobile Money transaction ID from your payment confirmation.");
    setSubmitting(true);
    try {
      await onSubmit(parseFloat(amount), phone, network, txid.trim());
      setStep(4);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title={`Deposit funds${step < 4 ? ` · step ${step} of 3` : ""}`} onClose={onClose}>
      {step === 1 && (
        <>
          <ModalInput type="tel" placeholder="Mobile money number, e.g. 0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <ModalInput type="number" placeholder={`Amount (min ${formatUGX(MIN_DEPOSIT)})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.accentCoral, marginBottom: 8 }}>{error}</div>}
          <PrimaryButton style={{ width: "100%" }} onClick={goToNetworkStep}>
            Confirm
          </PrimaryButton>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted, marginBottom: 10 }}>Choose your network</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {Object.entries(NETWORKS).map(([key, net]) => (
              <button
                key={key}
                onClick={() => setNetwork(key)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 10,
                  border: `1px solid ${network === key ? tokens.accentMint : tokens.border}`,
                  background: network === key ? `${tokens.accentMint}22` : tokens.bgRaised,
                  color: tokens.textPrimary,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {net.label}
              </button>
            ))}
          </div>

          {network && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted }}>Merchant code</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, color: tokens.textPrimary, fontWeight: 700, marginTop: 2 }}>
                {NETWORKS[network].code}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>{NETWORKS[network].name}</div>
              <div style={{ height: 1, background: tokens.border, margin: "12px 0" }} />
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textPrimary }}>
                Dial <span style={{ color: tokens.accentMint, fontWeight: 600 }}>{NETWORKS[network].ussd}</span> and pay{" "}
                <span style={{ fontWeight: 600 }}>{formatUGX(parseFloat(amount) || 0)}</span> to the merchant code above.
              </div>
            </Card>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <GhostButton style={{ flex: 1 }} onClick={() => setStep(1)}>
              Back
            </GhostButton>
            <PrimaryButton style={{ flex: 1 }} disabled={!network} onClick={() => setStep(3)}>
              I have paid
            </PrimaryButton>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted, marginBottom: 10 }}>
            Enter the Mobile Money transaction ID from your payment confirmation SMS.
          </div>
          <ModalInput placeholder="e.g. MP240911.1234.A56789" value={txid} onChange={(e) => setTxid(e.target.value)} />
          {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.accentCoral, marginBottom: 8 }}>{error}</div>}
          <PrimaryButton style={{ width: "100%" }} disabled={submitting} onClick={submitDeposit}>
            {submitting ? "Submitting…" : "Submit deposit"}
          </PrimaryButton>
        </>
      )}

      {step === 4 && (
        <>
          <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
            <Check size={36} color={tokens.accentMint} />
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: tokens.textPrimary, fontWeight: 600, marginTop: 10 }}>
              Deposit submitted
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted, marginTop: 6 }}>
              Please allow 5–10 minutes while an admin verifies your payment. Your balance will update once it's approved.
            </div>
          </div>
          <PrimaryButton style={{ width: "100%", marginTop: 16 }} onClick={onClose}>
            Done
          </PrimaryButton>
        </>
      )}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal: amount + phone + full name, fee shown live before confirming.
// ---------------------------------------------------------------------------
function WithdrawModal({ onClose, onSubmit, defaultPhone }) {
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const fee = Math.round(numericAmount * WITHDRAWAL_FEE_RATE);
  const net = numericAmount - fee;

  const submit = async () => {
    setError("");
    setSuccess("");
    if (!numericAmount || numericAmount < MIN_WITHDRAWAL) return setError(`Minimum withdrawal is ${formatUGX(MIN_WITHDRAWAL)}.`);
    if (!normalizePhoneUG(phone)) return setError("Enter a valid Ugandan number, e.g. 0712345678.");
    if (!fullName.trim()) return setError("Enter your full name, exactly as on your ID.");

    setSubmitting(true);
    try {
      const message = await onSubmit(numericAmount, phone, fullName.trim());
      setSuccess(message || "Withdrawal requested.");
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Withdraw funds" onClose={onClose}>
      <ModalInput type="tel" placeholder="Mobile money number, e.g. 0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <ModalInput placeholder="Full name, as on your ID" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <ModalInput type="number" placeholder={`Amount (min ${formatUGX(MIN_WITHDRAWAL)})`} value={amount} onChange={(e) => setAmount(e.target.value)} />

      {numericAmount >= MIN_WITHDRAWAL && (
        <Card style={{ marginBottom: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted }}>
            <span>Withdrawal fee (14%)</span>
            <span style={{ color: tokens.accentCoral }}>-{formatUGX(fee)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Inter', sans-serif", fontSize: 14, color: tokens.textPrimary, fontWeight: 600, marginTop: 6 }}>
            <span>You'll receive</span>
            <span style={{ color: tokens.accentMint }}>{formatUGX(net)}</span>
          </div>
        </Card>
      )}

      {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.accentCoral, marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.accentMint, marginBottom: 8 }}>{success}</div>}
      <PrimaryButton tone="coral" style={{ width: "100%" }} disabled={submitting} onClick={submit}>
        {submitting ? "Processing…" : "Confirm withdrawal"}
      </PrimaryButton>
    </ModalShell>
  );
}

function MineTab({ profile, transactions, userProducts, onDeposit, onWithdraw }) {
  const [modal, setModal] = useState(null); // 'deposit' | 'withdraw' | null
  const [filter, setFilter] = useState("all"); // 'all' | 'deposit' | 'withdrawal'
  const hasPurchased = userProducts.length > 0;

  const filteredTransactions = filter === "all" ? transactions : transactions.filter((tx) => tx.type === filter);

  return (
    <div style={{ position: "relative" }}>
      <SectionTitle sub="Your real wallet balance, deposits, withdrawals, and history.">Mine</SectionTitle>
      <Card style={{ marginBottom: 18, textAlign: "center", padding: 24 }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted }}>Account balance</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, color: tokens.textPrimary, fontWeight: 700, marginTop: 4 }}>
          {formatUGX(profile.balance)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center" }}>
          <PrimaryButton tone="mint" onClick={() => setModal("deposit")} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ArrowDownRight size={15} /> Deposit
          </PrimaryButton>
          <PrimaryButton
            tone="coral"
            onClick={() => hasPurchased && setModal("withdraw")}
            disabled={!hasPurchased}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <ArrowUpRight size={15} /> Withdraw
          </PrimaryButton>
        </div>
        {!hasPurchased && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: tokens.textMuted, marginTop: 10 }}>
            Buy a product first to unlock withdrawals.
          </div>
        )}
      </Card>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionTitle>Transaction history</SectionTitle>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { key: "all", label: "All" },
          { key: "deposit", label: "Deposits" },
          { key: "withdrawal", label: "Withdrawals" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${filter === f.key ? tokens.accentMint : tokens.border}`,
              background: filter === f.key ? `${tokens.accentMint}22` : "transparent",
              color: filter === f.key ? tokens.accentMint : tokens.textMuted,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filteredTransactions.length === 0 && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted }}>No transactions yet.</div>
        )}
        {filteredTransactions.map((tx) => {
          const isCredit = ["deposit", "bonus", "daily_profit", "referral"].includes(tx.type);
          return (
            <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${tokens.border}` }}>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: tokens.textPrimary, textTransform: "capitalize" }}>
                  {tx.type.replace("_", " ")}
                  {tx.network ? ` · ${tx.network}` : ""}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, textTransform: "capitalize" }}>
                  {new Date(tx.created_at).toLocaleString()} · {tx.status}
                  {tx.note ? ` · ${tx.note}` : ""}
                </div>
                {tx.type === "withdrawal" && tx.fee_amount > 0 && (
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
                    Fee {formatUGX(tx.fee_amount)} · Net {formatUGX(tx.net_amount)}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: isCredit ? tokens.accentMint : tokens.accentCoral }}>
                {isCredit ? "+" : "-"}{formatUGX(tx.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} onSubmit={onDeposit} defaultPhone={profile.phone_number} />}
      {modal === "withdraw" && hasPurchased && <WithdrawModal onClose={() => setModal(null)} onSubmit={onWithdraw} defaultPhone={profile.phone_number} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin console -- pending withdrawals are real; totals are not yet built.
// ---------------------------------------------------------------------------
function PendingCard({ item, kind, actioningId, onApprove, onReject }) {
  const busy = actioningId === item.id;
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, color: tokens.textPrimary, fontWeight: 600 }}>
            {item.profiles?.full_name || item.full_name || item.phone_number}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
            {item.phone_number} · {new Date(item.created_at).toLocaleString()}
          </div>
          {kind === "deposit" && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
              {item.network} · TXID {item.txid}
            </div>
          )}
          {kind === "withdrawal" && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
              Fee {formatUGX(item.fee_amount)} · Send {formatUGX(item.net_amount)}
            </div>
          )}
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
            Wallet balance: {formatUGX(item.profiles?.balance)}
          </div>
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, color: tokens.textPrimary, fontWeight: 700 }}>
          {formatUGX(item.amount)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <PrimaryButton tone="mint" disabled={busy} onClick={() => onApprove(item.id)} style={{ flex: 1 }}>
          {busy ? "Processing…" : "Approve"}
        </PrimaryButton>
        <PrimaryButton tone="coral" disabled={busy} onClick={() => onReject(item.id)} style={{ flex: 1 }}>
          {busy ? "Processing…" : "Reject"}
        </PrimaryButton>
      </div>
    </Card>
  );
}

function AdminConsole({ onLogout }) {
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [uploadingProductId, setUploadingProductId] = useState(null);
  const [stats, setStats] = useState({ deposited: 0, invested: 0, withdrawn: 0 });

  const loadPending = useCallback(async () => {
    setError("");
    try {
      const [{ data: depositRows, error: depositErr }, { data: withdrawalRows, error: withdrawalErr }] = await Promise.all([
        supabase
          .from("deposits")
          .select("id, amount, phone_number, network, transaction_id, status, created_at, profiles(full_name, phone_number, balance)")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("withdrawals")
          .select("id, amount, fee, net_amount, phone_number, full_name, status, created_at, profiles(full_name, phone_number, balance)")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ]);
      if (depositErr || withdrawalErr) throw new Error((depositErr || withdrawalErr).message);

      // Normalize each table's column names into the shape PendingCard expects.
      setDeposits((depositRows || []).map((d) => ({ ...d, txid: d.transaction_id })));
      setWithdrawals((withdrawalRows || []).map((w) => ({ ...w, fee_amount: w.fee })));
    } catch (err) {
      setError(err.message || "Failed to load pending items.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone_number, balance, is_admin, created_at")
      .order("created_at", { ascending: true });
    setUsers(data || []);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").order("price", { ascending: true });
    setProducts(data || []);
  }, []);

  const loadStats = useCallback(async () => {
    const [{ data: approvedDeposits }, { data: purchases }, { data: approvedWithdrawals }] = await Promise.all([
      supabase.from("deposits").select("amount").eq("status", "approved"),
      supabase.from("user_products").select("price"),
      supabase.from("withdrawals").select("net_amount").eq("status", "approved"),
    ]);
    setStats({
      deposited: (approvedDeposits || []).reduce((sum, d) => sum + Number(d.amount), 0),
      invested: (purchases || []).reduce((sum, p) => sum + Number(p.price), 0),
      withdrawn: (approvedWithdrawals || []).reduce((sum, w) => sum + Number(w.net_amount), 0),
    });
  }, []);

  useEffect(() => {
    loadPending();
    loadUsers();
    loadProducts();
    loadStats();
    const channel = supabase
      .channel("admin-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, () => { loadPending(); loadStats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, () => { loadPending(); loadStats(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadUsers())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => loadProducts())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_products" }, () => loadStats())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [loadPending, loadUsers, loadProducts, loadStats]);

  const handleImageUpload = async (product, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image is too large — please choose one under 5MB.");
      return;
    }

    setUploadingProductId(product.id);
    setError("");
    try {
      const previousImageUrl = product.image_url;
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${product.id}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from("products")
        .update({ image_url: publicUrlData.publicUrl })
        .eq("id", product.id);
      if (updateErr) throw updateErr;

      // Clean up the old photo now that the new one is live -- otherwise
      // every replace leaves an orphaned file sitting in storage forever.
      if (previousImageUrl) {
        const previousPath = previousImageUrl.split("/product-images/")[1];
        if (previousPath) {
          await supabase.storage.from("product-images").remove([previousPath]);
        }
      }

      await loadProducts();
    } catch (err) {
      setError(err.message || "Image upload failed.");
    } finally {
      setUploadingProductId(null);
    }
  };

  const runAction = async (id, rpcName, paramName, failMessage) => {
    setActioningId(id);
    setError("");
    try {
      const { error } = await supabase.rpc(rpcName, { [paramName]: id });
      if (error) throw error;
      await loadPending();
    } catch (err) {
      setError(err.message || failMessage);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div style={{ padding: "20px 20px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={20} color={tokens.accentGold} />
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: tokens.textPrimary, fontWeight: 700 }}>Admin console</div>
        </div>
        <GhostButton onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px" }}>
          <LogOut size={14} /> Log out
        </GhostButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted }}>Total deposited</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: tokens.accentMint, fontWeight: 700, marginTop: 4 }}>
            {formatUGX(stats.deposited)}
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted }}>Total invested</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: tokens.accentGold, fontWeight: 700, marginTop: 4 }}>
            {formatUGX(stats.invested)}
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted }}>Total withdrawn</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: tokens.accentCoral, fontWeight: 700, marginTop: 4 }}>
            {formatUGX(stats.withdrawn)}
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted }}>Total users</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: tokens.textPrimary, fontWeight: 700, marginTop: 4 }}>
            {users.length}
          </div>
        </Card>
      </div>

      <SectionTitle sub="Every registered account, live. The earliest signup is marked #1.">All users ({users.length})</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22, maxHeight: 280, overflowY: "auto" }}>
        {users.map((u, i) => (
          <Card key={u.id} style={{ padding: 12, border: i === 0 ? `1px solid ${tokens.accentGold}` : `1px solid ${tokens.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {i === 0 && <Pill tone="gold">★ #1 account</Pill>}
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: tokens.textPrimary, fontWeight: 600 }}>
                  {u.full_name || u.phone_number}
                </div>
                {u.is_admin && <Pill tone="mint">Admin</Pill>}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textPrimary, fontWeight: 600 }}>{formatUGX(u.balance)}</div>
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: tokens.textMuted, marginTop: 4 }}>
              {u.phone_number} · Joined {new Date(u.created_at).toLocaleDateString()}
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle sub="Tap a product's photo to upload one straight from your gallery. Square images work best.">
        Manage products ({products.length})
      </SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {products.map((p) => (
          <Card key={p.id} style={{ padding: 10 }}>
            <label style={{ display: "block", cursor: "pointer", position: "relative" }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(p, e.target.files?.[0])}
                style={{ display: "none" }}
                disabled={uploadingProductId === p.id}
              />
              <ProductArt icon={p.icon} gradient={p.gradient} imageUrl={p.image_url} />
              <div
                style={{
                  position: "absolute",
                  bottom: 20,
                  right: 6,
                  background: uploadingProductId === p.id ? tokens.accentGold : "rgba(14,16,41,0.75)",
                  borderRadius: 999,
                  padding: "5px 9px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Upload size={12} color={uploadingProductId === p.id ? "#0E1029" : tokens.textPrimary} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: uploadingProductId === p.id ? "#0E1029" : tokens.textPrimary }}>
                  {uploadingProductId === p.id ? "Uploading…" : p.image_url ? "Change" : "Add photo"}
                </span>
              </div>
            </label>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, color: tokens.textPrimary, fontWeight: 600, marginTop: 8 }}>
              {p.name}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: tokens.textMuted, marginTop: 2 }}>
              {formatUGX(p.price)}
            </div>
          </Card>
        ))}
      </div>

      {error && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.accentCoral, marginBottom: 12 }}>{error}</div>}

      <SectionTitle sub="Check your Mobile Money account for the TXID before approving.">Pending deposits</SectionTitle>
      {loading ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted, marginBottom: 22 }}>Loading…</div>
      ) : deposits.length === 0 ? (
        <Card style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", color: tokens.textMuted, fontSize: 14 }}>No pending deposits right now.</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {deposits.map((d) => (
            <PendingCard
              key={d.id}
              item={d}
              kind="deposit"
              actioningId={actioningId}
              onApprove={(id) => runAction(id, "approve_deposit", "p_deposit_id", "Failed to approve deposit.")}
              onReject={(id) => runAction(id, "reject_deposit", "p_deposit_id", "Failed to reject deposit.")}
            />
          ))}
        </div>
      )}

      <SectionTitle sub="Approve only after you've manually sent the net amount via Mobile Money.">Pending withdrawals</SectionTitle>
      {loading ? (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: tokens.textMuted }}>Loading…</div>
      ) : withdrawals.length === 0 ? (
        <Card>
          <div style={{ fontFamily: "'Inter', sans-serif", color: tokens.textMuted, fontSize: 14 }}>No pending withdrawal requests right now.</div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {withdrawals.map((w) => (
            <PendingCard
              key={w.id}
              item={w}
              kind="withdrawal"
              actioningId={actioningId}
              onApprove={(id) => runAction(id, "approve_withdrawal", "p_withdrawal_id", "Failed to approve withdrawal.")}
              onReject={(id) => runAction(id, "reject_withdrawal", "p_withdrawal_id", "Failed to reject withdrawal.")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
function getReferralCodeFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("ref") || "";
  } catch {
    return "";
  }
}

export default function Space10App() {
  const [configured, setConfigured] = useState(isConfigured());
  const [showSetupScreen, setShowSetupScreen] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [userProducts, setUserProducts] = useState([]);
  const [referralCodeFromUrl] = useState(getReferralCodeFromUrl);
  // A link like /register?ref=CODE should land straight on the Register
  // form, pre-filled -- not require an extra tap from the login screen.
  const [screen, setScreen] = useState(() => (getReferralCodeFromUrl() ? "register" : "login")); // login | register | app | admin
  const [tab, setTab] = useState("home");
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  // Restore/track the Supabase auth session. Skipped entirely until
  // configuration exists -- there's no client to call yet otherwise.
  useEffect(() => {
    if (!configured) {
      setInitializing(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  const loadProfileAndTransactions = useCallback(async (userId) => {
    const [
      { data: profileData, error: profileErr },
      { data: deposits },
      { data: withdrawals },
      { data: checkins },
      { data: purchases },
      { data: earnings },
      { data: referralEarnings },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("deposits").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("daily_checkins").select("*").eq("user_id", userId).order("claimed_at", { ascending: false }).limit(50),
      supabase.from("user_products").select("*, products(name)").eq("user_id", userId).order("purchased_at", { ascending: false }),
      supabase.from("earnings_log").select("*, user_products(products(name))").eq("user_id", userId).order("credited_at", { ascending: false }).limit(50),
      supabase.from("referral_earnings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (profileErr || !profileData) {
      setAuthError("Could not load your profile. Please try logging in again.");
      await supabase.auth.signOut();
      return;
    }

    // Every category above lives in its own table -- merge them into one
    // feed for the Transaction history list.
    const merged = [
      ...(deposits || []).map((d) => ({
        id: `deposit-${d.id}`,
        type: "deposit",
        amount: d.amount,
        status: d.status,
        created_at: d.created_at,
        network: d.network,
        txid: d.transaction_id,
      })),
      ...(withdrawals || []).map((w) => ({
        id: `withdrawal-${w.id}`,
        type: "withdrawal",
        amount: w.amount,
        status: w.status,
        created_at: w.created_at,
        fee_amount: w.fee,
        net_amount: w.net_amount,
      })),
      ...(checkins || []).map((c) => ({
        id: `checkin-${c.id}`,
        type: "bonus",
        amount: c.reward,
        status: "approved",
        created_at: c.claimed_at,
      })),
      ...(purchases || []).map((p) => ({
        id: `purchase-${p.id}`,
        type: "purchase",
        amount: p.price,
        status: "approved",
        created_at: p.purchased_at,
        note: p.products?.name,
      })),
      ...(earnings || []).map((e) => ({
        id: `earning-${e.id}`,
        type: "daily_profit",
        amount: e.amount,
        status: "approved",
        created_at: e.credited_at,
        note: e.user_products?.products?.name,
      })),
      ...(referralEarnings || []).map((r) => ({
        id: `referral-${r.id}`,
        type: "referral",
        amount: r.amount,
        status: "approved",
        created_at: r.created_at,
        note: `Level ${r.level} · ${r.reason}`,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setProfile(profileData);
    setTransactions(merged);
    setUserProducts(purchases || []);
    setScreen(profileData.is_admin ? "admin" : "app");
    setTab("home");
  }, []);

  // Product catalog rarely changes content-wise, but photos get updated by
  // admins at any time -- subscribe so a newly-uploaded image (or any other
  // product edit) shows up immediately, not just after a reload.
  useEffect(() => {
    if (!configured) return;
    const loadProducts = () => {
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true })
        .then(({ data }) => setProducts(data || []));
    };
    loadProducts();
    const channel = supabase
      .channel("products-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadProducts)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [configured]);

  // Whenever the session changes, (re)load profile + transaction data.
  useEffect(() => {
    if (initializing) return;
    if (!session) {
      setProfile(null);
      setTransactions([]);
      setScreen("login");
      return;
    }
    loadProfileAndTransactions(session.user.id);
  }, [session, initializing, loadProfileAndTransactions]);

  // Live updates: reflect admin approvals/rejections, purchases, and
  // scheduled daily-earnings/referral credits without the user needing to
  // refresh -- each category lives in its own table, so each gets its own
  // filtered subscription.
  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    const channel = supabase
      .channel(`wallet-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits", filter: `user_id=eq.${uid}` }, () => loadProfileAndTransactions(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${uid}` }, () => loadProfileAndTransactions(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins", filter: `user_id=eq.${uid}` }, () => loadProfileAndTransactions(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_products", filter: `user_id=eq.${uid}` }, () => loadProfileAndTransactions(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "earnings_log", filter: `user_id=eq.${uid}` }, () => loadProfileAndTransactions(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_earnings", filter: `user_id=eq.${uid}` }, () => loadProfileAndTransactions(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, () => loadProfileAndTransactions(uid))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session, loadProfileAndTransactions]);

  const handleRegister = async ({ name, phone, password, referralCode }) => {
    setAuthError("");
    const cleanName = name.trim();
    const normalizedPhone = normalizePhoneUG(phone);
    const cleanReferralCode = (referralCode || "").trim().toUpperCase();
    if (!cleanName || !password.trim()) return setAuthError("Fill in all fields.");
    if (!normalizedPhone) return setAuthError("Enter a valid Ugandan phone number, e.g. 0712345678.");

    setAuthBusy(true);
    const { error } = await supabase.auth.signUp({
      email: phoneToAuthEmail(normalizedPhone),
      password,
      options: { data: { full_name: cleanName, phone_number: normalizedPhone, referral_code: cleanReferralCode } },
    });
    setAuthBusy(false);

    if (error) return setAuthError(error.message);
    setAuthNotice("Account created — you've been credited a 3,000 UGX welcome bonus. Log in to continue.");
    setScreen("login");
  };

  const handleLogin = async ({ phone, password }) => {
    setAuthError("");
    const normalizedPhone = normalizePhoneUG(phone);
    if (!normalizedPhone || !password) return setAuthError("Enter your phone number and password.");

    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: phoneToAuthEmail(normalizedPhone), password });
    setAuthBusy(false);

    if (error) return setAuthError(error.message);
    // Profile load + routing happens in the session effect above.
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthError("");
    setAuthNotice("");
    setScreen("login");
  };

  // All three now talk to Supabase directly (table insert / RPC) -- no Edge
  // Functions in this architecture. Each throws on failure so the
  // deposit/withdraw modals' own try/catch can show the error inline.
  const handleDeposit = async (value, phoneInput, network, txid) => {
    const normalizedPhone = normalizePhoneUG(phoneInput);
    if (!normalizedPhone) throw new Error("Enter a valid Ugandan phone number, e.g. 0712345678.");

    const { error } = await supabase.from("deposits").insert({
      user_id: session.user.id,
      amount: value,
      phone_number: normalizedPhone,
      network,
      transaction_id: txid,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    await loadProfileAndTransactions(session.user.id);
    return "Deposit submitted. Please allow 5–10 minutes for an admin to verify your payment.";
  };

  const handleWithdraw = async (value, phoneInput, fullName) => {
    const normalizedPhone = normalizePhoneUG(phoneInput);
    if (!normalizedPhone) throw new Error("Enter a valid Ugandan phone number, e.g. 0712345678.");

    const { data, error } = await supabase.rpc("request_withdrawal", {
      p_amount: value,
      p_phone: normalizedPhone,
      p_name: fullName,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.message || "Withdrawal request failed.");

    await loadProfileAndTransactions(session.user.id);
    return data.message || `Withdrawal requested. You'll receive UGX ${Number(data.net_amount).toLocaleString()} after the 14% fee.`;
  };

  const handleDailyCheckin = async () => {
    const { data, error } = await supabase.rpc("claim_daily_checkin");
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.message || "Could not check in.");
    await loadProfileAndTransactions(session.user.id);
  };

  const handlePurchase = async (productId) => {
    const { error } = await supabase.rpc("purchase_product", { p_product_id: productId });
    if (error) throw new Error(error.message);
    await loadProfileAndTransactions(session.user.id);
  };

  const tabs = [
    { key: "home", label: "Home", icon: HomeIcon },
    { key: "product", label: "My product", icon: Package },
    { key: "team", label: "Team", icon: Users },
    { key: "mine", label: "Mine", icon: Wallet },
  ];

  const shellStyle = {
    fontFamily: "'Inter', sans-serif",
    maxWidth: 420,
    margin: "0 auto",
    background: tokens.bgDeep,
    minHeight: 720,
    position: "relative",
    borderRadius: 24,
    overflow: "hidden",
    border: `1px solid ${tokens.border}`,
  };

  if (!configured || showSetupScreen) {
    return (
      <div style={shellStyle}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
          input::placeholder { color: ${tokens.textMuted}; }
          input:focus { outline: 1px solid ${tokens.accentMint}; }
        `}</style>
        <SupabaseSetupScreen
          onSaved={() => {
            setConfigured(true);
            setShowSetupScreen(false);
          }}
          onCancel={configured ? () => setShowSetupScreen(false) : undefined}
        />
      </div>
    );
  }

  if (initializing) {
    return (
      <div style={{ ...shellStyle, display: "flex", alignItems: "center", justifyContent: "center", color: tokens.textMuted, fontFamily: "'Inter', sans-serif" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        input::placeholder { color: ${tokens.textMuted}; }
        input:focus { outline: 1px solid ${tokens.accentMint}; }
      `}</style>

      {screen === "login" && (
        <LoginScreen onLogin={handleLogin} goToRegister={() => { setAuthError(""); setScreen("register"); }} onOpenSetup={() => setShowSetupScreen(true)} error={authError} notice={authNotice} busy={authBusy} />
      )}
      {screen === "register" && (
        <RegisterScreen onRegister={handleRegister} goToLogin={() => { setAuthError(""); setScreen("login"); }} error={authError} busy={authBusy} defaultReferralCode={referralCodeFromUrl} />
      )}
      {screen === "admin" && <AdminConsole onLogout={handleLogout} />}

      {screen === "app" && profile && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 6px" }}>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, color: tokens.textPrimary, fontWeight: 700, letterSpacing: 0.3 }}>Space10</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: tokens.textMuted }}>
                Hi, {(profile.full_name || profile.phone_number || "there").split(" ")[0]}
              </div>
            </div>
            <button onClick={handleLogout} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: tokens.textMuted }}>
              <LogOut size={16} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12 }}>Log out</span>
            </button>
          </div>

          <div style={{ padding: "16px 20px 100px", minHeight: 600 }}>
            {tab === "home" && <HomeTab products={products} balance={profile.balance} profile={profile} onCheckin={handleDailyCheckin} onPurchase={handlePurchase} />}
            {tab === "product" && <MyProductTab userProducts={userProducts} />}
            {tab === "team" && <TeamTab profile={profile} />}
            {tab === "mine" && <MineTab profile={profile} transactions={transactions} userProducts={userProducts} onDeposit={handleDeposit} onWithdraw={handleWithdraw} />}
          </div>

          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "space-around", padding: "10px 8px 14px", background: tokens.bgPanel, borderTop: `1px solid ${tokens.border}` }}>
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = tab === key;
              return (
                <button key={key} onClick={() => setTab(key)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? tokens.accentMint : tokens.textMuted }}>
                  <Icon size={20} />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
