"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconGithub, IconGoogle, IconLinkedIn } from "@/components/auth/oauth-icons";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildAuthCallbackUrl } from "@/lib/site-url";
import type { SupabaseClient } from "@supabase/supabase-js";

interface FormFieldProps {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
  showToggle?: boolean;
  onToggle?: () => void;
  showPassword?: boolean;
}

const AnimatedFormField: React.FC<FormFieldProps> = ({
  type,
  placeholder,
  value,
  onChange,
  icon,
  showToggle,
  onToggle,
  showPassword,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div className="group relative">
      <div
        className="relative overflow-hidden rounded-lg border border-border bg-background transition-all duration-300 ease-in-out"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary">
          {icon}
        </div>

        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full bg-transparent py-3 pl-10 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none"
          placeholder=""
        />

        <label
          className={`pointer-events-none absolute left-10 transition-all duration-200 ease-in-out ${
            isFocused || value
              ? "top-2 text-xs font-medium text-primary"
              : "top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          }`}
        >
          {placeholder}
        </label>

        {showToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}

        {isHovering ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(200px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(59, 130, 246, 0.1) 0%, transparent 70%)`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

const SocialButton: React.FC<{
  icon: React.ReactNode;
  name: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void | Promise<void>;
}> = ({ icon, name: _name, disabled, title, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      aria-label={_name}
      disabled={disabled}
      title={title}
      onClick={() => void onClick?.()}
      className="group relative overflow-hidden rounded-lg border border-border bg-background p-3 transition-all duration-300 ease-in-out hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 transition-transform duration-500 ${
          isHovered ? "translate-x-0" : "-translate-x-full"
        }`}
      />
      <div className="relative text-foreground transition-colors group-hover:text-primary">{icon}</div>
    </button>
  );
};

const FloatingParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const bounds = { w: 0, h: 0 };
    const setCanvasSize = () => {
      canvasEl.width = window.innerWidth;
      canvasEl.height = window.innerHeight;
      bounds.w = canvasEl.width;
      bounds.h = canvasEl.height;
    };

    setCanvasSize();
    window.addEventListener("resize", setCanvasSize);

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;

      constructor() {
        this.x = Math.random() * bounds.w;
        this.y = Math.random() * bounds.h;
        this.size = Math.random() * 2 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.3;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > bounds.w) this.x = 0;
        if (this.x < 0) this.x = bounds.w;
        if (this.y > bounds.h) this.y = 0;
        if (this.y < 0) this.y = bounds.h;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = `rgba(59, 130, 246, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles: Particle[] = [];
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    let frameId = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      for (const particle of particles) {
        particle.update();
        particle.draw();
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 1 }}
    />
  );
};

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/tool";
  }
  return raw;
}

type OAuthProviderId = "google" | "github" | "linkedin_oidc";

export function SignInFlo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    setSupabase(createClient());
    setClientReady(true);
  }, []);

  useEffect(() => {
    const err = searchParams.get("error");
    const details = searchParams.get("details");
    if (err === "auth") {
      setFormError("Could not complete sign-in. Try again or use email and password.");
    }
    if (err === "oauth") {
      const decoded = details
        ? (() => {
            try {
              return decodeURIComponent(details);
            } catch {
              return details;
            }
          })()
        : "";
      setFormError(
        decoded
          ? `Sign-in was cancelled or failed: ${decoded}`
          : "Sign-in was cancelled or the provider returned an error. Try again.",
      );
    }
    if (err === "config") {
      setFormError(
        "Supabase is not configured on the server. Locally: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or publishable key) to .env and restart. On Vercel: add the same variables under Environment Variables (Production) and redeploy so the client bundle rebuilds.",
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    const next = safeRedirectPath(searchParams.get("redirect"));

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: buildAuthCallbackUrl(next),
          },
        });
        if (error) {
          setFormError(error.message);
          return;
        }
        if (data.user && !data.session) {
          setFormSuccess("Check your email to confirm your account, then sign in.");
          return;
        }
        if (data.session) {
          router.push(next);
          router.refresh();
          return;
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setFormError(error.message);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const oauthSignIn = async (provider: OAuthProviderId) => {
    if (!supabase) return;
    setFormError(null);
    setOauthLoading(true);
    let navigated = false;
    try {
      const next = safeRedirectPath(searchParams.get("redirect"));
      const redirectTo = buildAuthCallbackUrl(next);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) {
        setFormError(error.message);
        return;
      }
      const url = data.url;
      if (!url || !/\/auth\/v1\/authorize\b/i.test(url)) {
        setFormError(
          "Could not start OAuth (invalid Supabase auth URL). In Vercel, set NEXT_PUBLIC_SUPABASE_URL to the exact Project URL from Supabase → Settings → API (https://….supabase.co, no /auth path).",
        );
        return;
      }
      navigated = true;
      window.location.assign(url);
    } finally {
      if (!navigated) setOauthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!supabase) return;
    setFormError(null);
    setFormSuccess(null);
    const addr = email.trim();
    if (!addr) {
      setFormError("Enter your email above, then click Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: buildAuthCallbackUrl("/tool"),
    });
    if (error) setFormError(error.message);
    else setFormSuccess("If an account exists, we sent a password reset link.");
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail("");
    setPassword("");
    setName("");
    setShowPassword(false);
    setFormError(null);
    setFormSuccess(null);
  };

  const oauthButtons: { id: OAuthProviderId; label: string; icon: React.ReactNode }[] = [
    { id: "google", label: "Google", icon: <IconGoogle className="size-5" /> },
    { id: "github", label: "GitHub", icon: <IconGithub className="size-5" /> },
    { id: "linkedin_oidc", label: "LinkedIn", icon: <IconLinkedIn className="size-5" /> },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <FloatingParticles />

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground">
              {isSignUp ? "Sign up to get started" : "Sign in to continue to 6 degree's"}
            </p>
          </div>

          {!clientReady ? (
            <p className="mb-6 text-center text-sm text-muted-foreground">Loading sign-in…</p>
          ) : null}
          {clientReady && !supabase ? (
            <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-left text-sm text-amber-950 dark:text-amber-100">
              Add{" "}
              <code className="rounded bg-amber-500/20 px-1 font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="rounded bg-amber-500/20 px-1 font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
              (or{" "}
              <code className="rounded bg-amber-500/20 px-1 font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
              </code>
              ) to your environment (see <code className="font-mono text-xs">.env.example</code>), then restart the
              dev server.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp ? (
              <AnimatedFormField
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<User size={18} />}
              />
            ) : null}

            <AnimatedFormField
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail size={18} />}
            />

            <AnimatedFormField
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock size={18} />}
              showToggle
              onToggle={() => setShowPassword(!showPassword)}
              showPassword={showPassword}
            />

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {formSuccess ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{formSuccess}</p> : null}

            <div className="flex items-center justify-between">
              {!isSignUp ? (
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              ) : (
                <span />
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !supabase || !clientReady}
              className="group relative w-full overflow-hidden rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-all duration-300 ease-in-out hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={`transition-opacity duration-200 ${isSubmitting ? "opacity-0" : "opacity-100"}`}>
                {isSignUp ? "Create Account" : "Sign In"}
              </span>

              {isSubmitting ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                </div>
              ) : null}

              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-in-out group-hover:translate-x-full" />
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {oauthButtons.map((b) => (
                <SocialButton
                  key={b.id}
                  name={b.label}
                  icon={b.icon}
                  title={b.label}
                  disabled={!supabase || !clientReady || oauthLoading}
                  onClick={() => void oauthSignIn(b.id)}
                />
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button type="button" onClick={toggleMode} className="font-medium text-primary hover:underline">
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use `SignInFlo` */
export const Component = SignInFlo;
