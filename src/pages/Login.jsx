
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  LoaderCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const isSignup = mode === "signup";

  const showFeedback = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (password.length < 6) {
      showFeedback("Your password must contain at least 6 characters.");
      return;
    }

    if (isSignup && username.trim().length < 3) {
      showFeedback("Your username must contain at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: username.trim(),
            },
            emailRedirectTo: `${window.location.origin}/home`,
          },
        });

        if (error) throw error;

        if (data.session) {
          navigate("/home", { replace: true });
        } else {
          showFeedback(
            "Account created! Check your email to confirm your account before signing in.",
            "success"
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        navigate("/home", { replace: true });
      }
    } catch (error) {
      showFeedback(
        error.message || "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/home`,
        },
      });

      if (error) throw error;
    } catch (error) {
      showFeedback(error.message || "Google sign-in failed.");
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showFeedback("Enter your email address first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      showFeedback(
        "If an account exists for this email, a password reset link will be sent.",
        "success"
      );
    } catch (error) {
      showFeedback(error.message || "Could not send the reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080608] text-white">
      {/* Zero Two background */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-35"
        style={{
          backgroundImage: "url('/images/zero-two-welcome.jpg')",
        }}
      />

      {/* Dark overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/65" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080608] via-transparent to-black/50" />

      {/* Pink ambient glow */}
      <div className="pointer-events-none absolute -left-40 top-40 h-96 w-96 rounded-full bg-pink-600/20 blur-[140px]" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-fuchsia-600/15 blur-[140px]" />

      {/* Navbar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <Link to="/" className="flex items-center">
          <img
            src="/logo.png"
            alt="DARLING"
            className="h-20 w-auto object-contain"
          />
        </Link>

        <div className="hidden items-center gap-2 text-xs tracking-[0.2em] text-zinc-400 sm:flex">
          YOUR ANIME
          <span className="text-pink-500">·</span>
          YOUR WORLD
        </div>
      </header>

      {/* Main */}
      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-100px)] max-w-7xl items-center gap-12 px-6 pb-16 pt-8 lg:grid-cols-2 lg:px-12">
        {/* Left content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="relative hidden lg:block"
        >
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-sm text-pink-300">
            <Sparkles size={15} />
            Your personal anime universe
          </div>

          <h2 className="text-6xl font-semibold leading-[1.15] xl:text-7xl">
            FALL IN LOVE
            <br />
            WITH YOUR
            <br />
            <span className="bg-gradient-to-r from-pink-300 via-pink-500 to-fuchsia-400 bg-clip-text text-transparent">
              NEXT STORY.
            </span>
          </h2>

          <p className="mt-6 max-w-md text-base leading-7 text-zinc-300">
            Discover incredible worlds, meet unforgettable characters,
            and make every anime experience your own.
          </p>

          <div className="mt-10 space-y-5">
            {[
              ["01", "Your Anime Universe", "Discover your next obsession."],
              ["02", "Anime Community", "Connect with fellow anime fans."],
              ["03", "Your Watchlist", "Keep your favourites close."],
            ].map(([number, title, description], i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.15 }}
                className="flex items-center gap-4"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-pink-500/30 bg-pink-500/10 text-sm font-medium text-pink-400">
                  {number}
                </div>

                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Zero Two sticker */}
          <motion.img
            src="/stickers/zero-two-welcome.png"
            alt="Zero Two"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            animate={{ y: [0, -10, 0], rotate: [-2, 2, -2] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-0 right-0 w-40 drop-shadow-[0_0_25px_rgba(236,72,153,0.4)] xl:w-48"
          />

          <p className="mt-10 text-sm italic text-pink-200/80">
            "Same anime. Different hearts. Still with you."
            <span className="ml-2 text-zinc-500">— Zero Two</span>
          </p>
        </motion.div>

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7 }}
          className="relative mx-auto w-full max-w-md pt-10"
        >
          {/* Zero Two peeking above the card */}
          <motion.img
            src="/stickers/zero-two-peek.png"
            alt="Zero Two peeking over the login card"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-1 right-7 z-20 w-28 drop-shadow-[0_0_20px_rgba(236,72,153,0.4)] sm:w-36"
          />

          <div className="rounded-[2rem] border border-pink-500/40 bg-[#0c090df0] p-6 shadow-[0_0_80px_rgba(236,72,153,0.12)] backdrop-blur-2xl sm:p-9">
            <div className="mb-7 text-center">
              <Heart
                size={28}
                fill="currentColor"
                className="mx-auto mb-4 text-pink-500"
              />

              <p className="mb-2 text-sm text-pink-300">
                {isSignup
                  ? "Your adventure begins here"
                  : "Welcome back to"}
              </p>

              <h2 className="text-4xl font-light tracking-[0.16em]">
                DARLING
              </h2>

              <p className="mt-3 text-[10px] tracking-[0.3em] text-zinc-500">
                YOUR ANIME. YOUR WORLD.
              </p>
            </div>

            {/* Tabs */}
            <div className="mb-6 grid grid-cols-2 border-b border-white/10">
              {[
                ["login", "Sign In"],
                ["signup", "Create Account"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setMessage("");
                  }}
                  className={`relative py-3 text-sm transition ${
                    mode === value
                      ? "text-pink-300"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  {label}

                  {mode === value && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-pink-500"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Authentication form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-pink-500/60 focus-within:ring-2 focus-within:ring-pink-500/10">
                  <Heart size={18} className="shrink-0 text-zinc-500" />

                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[A-Za-z0-9_]+"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-zinc-500"
                  />
                </label>
              )}

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-pink-500/60 focus-within:ring-2 focus-within:ring-pink-500/10">
                <Mail size={18} className="shrink-0 text-zinc-500" />

                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-zinc-500"
                />
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 transition focus-within:border-pink-500/60 focus-within:ring-2 focus-within:ring-pink-500/10">
                <Lock size={18} className="shrink-0 text-zinc-500" />

                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={
                    isSignup ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password (min. 6 characters)"
                  className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-zinc-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-zinc-500 transition hover:text-pink-400"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </label>

              {!isSignup && (
                <div className="flex items-center justify-between gap-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 text-zinc-400">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="accent-pink-500"
                    />
                    Remember me
                  </label>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-pink-400 hover:text-pink-300 disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {message && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  aria-live="polite"
                  className={`rounded-lg border p-3 text-center text-xs ${
                    messageType === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                      : "border-pink-500/20 bg-pink-500/10 text-pink-200"
                  }`}
                >
                  {message}
                </motion.p>
              )}

              <motion.button
                whileHover={{ scale: loading ? 1 : 1.02 }}
                whileTap={{ scale: loading ? 1 : 0.98 }}
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-pink-500 to-pink-400 py-4 font-semibold text-[#190711] shadow-lg shadow-pink-500/20 transition hover:shadow-pink-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={19} className="animate-spin" />
                    Please wait...
                  </>
                ) : (
                  <>
                    {isSignup ? "Create Account" : "Sign In"}
                    <ArrowRight size={19} />
                  </>
                )}
              </motion.button>
            </form>

            <div className="my-6 flex items-center gap-4 text-xs text-zinc-600">
              <div className="h-px flex-1 bg-white/10" />
              OR CONTINUE WITH
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm transition hover:border-pink-500/40 hover:bg-pink-500/10 disabled:opacity-60"
            >
              <span className="mr-2 font-bold text-pink-400">G</span>
              Continue with Google
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-pink-200/90">
                "Let's watch another world together..."
              </p>

              <p className="mt-2 text-xs text-zinc-500">
                — Zero Two
              </p>
            </div>
          </div>

          {/* Sleepy Zero Two */}
          <motion.img
            src="/stickers/zero-two-sleeping.png"
            alt="Sleepy Zero Two"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -bottom-7 -right-3 z-20 w-24 drop-shadow-[0_0_20px_rgba(236,72,153,0.3)] sm:-right-7 sm:w-28"
          />
        </motion.div>
      </section>

      <footer className="relative z-10 px-6 pb-5 text-center text-[10px] tracking-[0.2em] text-zinc-600">
        MADE FOR ANIME LOVERS
      </footer>
    </main>
  );
}
