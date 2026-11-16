import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/auth/setup";
import { GOOGLE_SIGN_IN_ENABLED } from "@/lib/auth/server";
import { publicSignupAvailable } from "@/lib/auth/signup";
import { isDemoMode } from "@/lib/demo/mode";
import { safeFrom } from "@/components/auth/safeFrom";
import { SignInForm } from "./SignInForm";

/** ACCESS_REQUEST_EMAIL read at request time, so it can change without a rebuild. Anything that is not a plain address is ignored. */
function accessRequestEmail(): string | null {
  const value = process.env.ACCESS_REQUEST_EMAIL?.trim();
  return value && /^[^\s@?&]+@[^\s@?&]+$/.test(value) ? value : null;
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  // A fresh instance has no one to sign in: send the visitor to first-run setup.
  if (!isDemoMode() && (await needsSetup())) redirect("/setup");
  const { from } = await searchParams;
  return (
    <SignInForm
      googleEnabled={GOOGLE_SIGN_IN_ENABLED}
      from={safeFrom(from)}
      signupAvailable={await publicSignupAvailable()}
      accessRequestEmail={accessRequestEmail()}
    />
  );
}
