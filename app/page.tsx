"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSigningIn(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage("Invalid email or password");
      setIsSigningIn(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-6">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-4xl font-light tracking-tight text-white">nelo</h1>
          <p className="mt-3 text-sm text-white/60">Sign in to manage your pipeline.</p>
        </div>

        <form className="mt-10 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm text-white/70">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm text-white/70">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <button
            type="submit"
            disabled={isSigningIn}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSigningIn ? "Signing in..." : "Sign in"}
          </button>

          {errorMessage ? (
            <p className="text-sm text-red-400">{errorMessage}</p>
          ) : null}
        </form>
      </div>
    </main>
  );
}
