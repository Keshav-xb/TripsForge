import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Compass, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSupabaseErrorMessage, supabase } from "@/lib/supabase";
import { accountRedirectUrl } from "@/lib/accountRedirects";
import { BrandMark } from "@/components/SiteHeader";

type View = "signUp" | "signIn" | "recovery" | "reset";

const safeDestination = (raw: string | null) =>
  raw?.startsWith("/") && !raw.startsWith("//") ? raw : "/trips";

type FieldProps = {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  note?: string;
};

function Field({ label, icon, children, note }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      {note && <span className="text-xs font-medium text-[#71877f]">{note}</span>}
      <span className="relative">
        {icon}
        {children}
      </span>
    </label>
  );
}

export default function Account() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [view, setView] = useState<View>(() =>
    initial.get("mode") === "reset" || window.location.hash.includes("type=recovery") ? "reset" : "signUp",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const destination = useMemo(() => safeDestination(initial.get("next")), [initial]);
  const signUpRedirectTo = accountRedirectUrl({ next: destination });

  useEffect(() => {
    if (auth.isAuthenticated && view !== "reset" && initial.get("next")) {
      navigate(destination);
    }
  }, [auth.isAuthenticated, destination, initial, navigate, view]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      if (view === "signUp") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: signUpRedirectTo,
          },
        });

        if (error) throw error;

        if (data.session) {
          toast.success("Your TripsForge account is ready.");
          navigate(destination);
        } else {
          setNotice(
            "Your account was created, but immediate sign-in is not enabled yet. In Supabase, turn off Confirm Email under Authentication → Providers → Email, then sign in.",
          );
        }
      } else if (view === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back to TripsForge.");
        navigate(destination);
      } else if (view === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: accountRedirectUrl({ mode: "reset" }),
        });
        if (error) throw error;
        setNotice("If an account exists for this email, a reset link is on its way.");
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setNotice("Your password has been updated. You can now continue planning.");
        toast.success("Password updated.");
      }
    } catch (error) {
      toast.error(getSupabaseErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = async () => {
    try {
      await auth.logout();
      toast.success("You are signed out.");
    } catch (error) {
      toast.error(getSupabaseErrorMessage(error));
    }
  };

  const panelTitle =
    view === "signUp"
      ? "Make it yours."
      : view === "signIn"
        ? "Welcome back."
        : view === "recovery"
          ? "Find your way back."
          : "Choose a new password.";
  const panelLabel =
    view === "signUp"
      ? "Begin your archive"
      : view === "signIn"
        ? "Return to your routes"
        : view === "recovery"
          ? "Account recovery"
          : "Secure your account";
  const submitLabel =
    view === "signUp"
      ? "Create my account"
      : view === "signIn"
        ? "Sign in to TripsForge"
        : view === "recovery"
          ? "Send reset link"
          : "Update password";
  const profile = auth.isAuthenticated && !initial.get("next") && view !== "reset";

  const passwordInput = (
    <Field
      label="Password"
      note="At least 8 characters"
      icon={<LockKeyhole className="absolute left-4 top-3.5 h-4 w-4 text-[#69827c]" />}>
      <input
        required
        minLength={8}
        maxLength={72}
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="••••••••"
        className="w-full rounded-xl border border-[#123a35]/15 bg-[#fffdf8] py-3 pl-11 pr-12 font-medium outline-none transition focus:border-[#e6651b] focus:ring-2 focus:ring-[#e6651b]/15"
      />
      <button
        type="button"
        onClick={() => setShowPassword((value) => !value)}
        className="absolute right-3 top-2.5 rounded-lg p-1.5 text-[#69827c] hover:text-[#e6651b]"
        aria-label={showPassword ? "Hide password" : "Show password"}>
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </Field>
  );

  return (
    <div className="min-h-screen bg-[#f7f2e7] px-5 py-6 text-[#123a35] sm:px-8">
      <div className="mx-auto flex max-w-6xl justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-[1.45rem] tracking-[-.06em]">TripsForge</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#55716a] transition-colors hover:text-[#e6651b]">
          <ArrowLeft className="h-4 w-4" /> Back to routes
        </Link>
      </div>

      <main className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-[#123a35]/10 bg-[#fffdf8] shadow-[0_28px_70px_-42px_rgba(18,58,53,.55)] lg:mt-12 lg:grid-cols-[.9fr_1.1fr]">
        <section className="relative overflow-hidden bg-[#123a35] p-8 text-white sm:p-12">
          <div className="absolute -right-16 -top-12 h-72 w-72 rounded-full border-[30px] border-[#ffb34b]/15" />
          <div className="relative">
            <p className="atlas-label text-[#ffb34b]">Your TripsForge account</p>
            <h1 className="mt-5 max-w-md font-display text-5xl leading-[.96] tracking-[-.07em]">Keep every good route close.</h1>
            <p className="mt-6 max-w-md leading-7 text-[#c3d5cc]">Create a private archive for your itineraries, then share only the routes you choose.</p>
            <div className="mt-12 grid gap-5 text-sm text-[#e2ede6]">
              <p className="flex gap-3"><Compass className="mt-0.5 h-5 w-5 shrink-0 text-[#ffb34b]" /> Sessions persist securely, so your saved routes are ready when you return.</p>
              <p className="flex gap-3"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#ffb34b]" /> Authentication is powered by your TripsForge Supabase account.</p>
            </div>
          </div>
        </section>

        <section className="p-8 sm:p-12">
          {profile ? (
            <div>
              <p className="atlas-label text-[#e6651b]">Account details</p>
              <h2 className="mt-3 font-display text-4xl tracking-[-.06em]">You’re signed in.</h2>
              <div className="mt-8 rounded-2xl border border-[#123a35]/10 bg-[#f7f2e7] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-[#123a35] text-white"><UserRound className="h-5 w-5" /></div>
                  <div><p className="font-bold">{auth.user?.name}</p><p className="text-sm text-[#617b74]">{auth.user?.email}</p></div>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/trips" className="rounded-full bg-[#123a35] px-5 py-3 text-sm font-bold text-white">View my trips</Link>
                <button onClick={signOut} className="rounded-full border border-[#123a35]/15 px-5 py-3 text-sm font-bold text-[#123a35]">Sign out</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex rounded-full bg-[#f3eee3] p-1">
                <button onClick={() => { setView("signUp"); setNotice(null); }} className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors ${view === "signUp" ? "bg-[#fffdf8] text-[#123a35] shadow-sm" : "text-[#668078]"}`}>Create account</button>
                <button onClick={() => { setView("signIn"); setNotice(null); }} className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-colors ${view === "signIn" ? "bg-[#fffdf8] text-[#123a35] shadow-sm" : "text-[#668078]"}`}>Sign in</button>
              </div>
              <div className="mt-9"><p className="atlas-label text-[#e6651b]">{panelLabel}</p><h2 className="mt-3 font-display text-4xl tracking-[-.06em]">{panelTitle}</h2></div>
              <form onSubmit={submit} className="mt-8 grid gap-5">
                {view === "signUp" && (
                  <Field label="Your name" icon={<UserRound className="absolute left-4 top-3.5 h-4 w-4 text-[#69827c]" />}>
                    <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Aarav Sharma" className="w-full rounded-xl border border-[#123a35]/15 bg-[#fffdf8] py-3 pl-11 pr-4 font-medium outline-none transition focus:border-[#e6651b] focus:ring-2 focus:ring-[#e6651b]/15" />
                  </Field>
                )}
                {view !== "reset" && (
                  <Field label="Email address" icon={<Mail className="absolute left-4 top-3.5 h-4 w-4 text-[#69827c]" />}>
                    <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-[#123a35]/15 bg-[#fffdf8] py-3 pl-11 pr-4 font-medium outline-none transition focus:border-[#e6651b] focus:ring-2 focus:ring-[#e6651b]/15" />
                  </Field>
                )}
                {view !== "recovery" && passwordInput}
                {notice && <p className="rounded-xl bg-[#e8f0e9] px-4 py-3 text-sm leading-6 text-[#355752]">{notice}</p>}
                <button disabled={submitting} className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#123a35] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#1d514a] disabled:opacity-60"><Compass className="h-4 w-4 text-[#ffb34b]" /> {submitting ? "Please wait…" : submitLabel}</button>
              </form>
              {view === "signIn" && <button onClick={() => { setView("recovery"); setNotice(null); }} className="mt-5 block text-sm font-bold text-[#e6651b] hover:underline">Forgot your password?</button>}
              {view === "recovery" && <button onClick={() => { setView("signIn"); setNotice(null); }} className="mt-5 text-sm font-bold text-[#e6651b] hover:underline">Back to sign in</button>}
              <p className="mt-6 text-xs leading-5 text-[#71877f]">New accounts can sign in immediately while temporary immediate sign-up mode is enabled. Your password is handled by Supabase Auth and is never stored by TripsForge.</p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
