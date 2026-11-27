import { redirect } from "next/navigation";
import { needsSetup } from "@/lib/auth/setup";
import { GOOGLE_SIGN_IN_ENABLED } from "@/lib/auth/server";
import { publicSignupAvailable } from "@/lib/auth/signup";
import { isDemoMode } from "@/lib/demo/mode";
import { safeFrom } from "@/components/auth/safeFrom";
import { splitVerifyError } from "@/components/auth/verifyError";
import { SignInForm } from "./SignInForm";

/** ACCESS_REQUEST_EMAIL read at request time, so it can change without a rebuild. Anything that is not a plain address is ignored. */
function accessRequestEmail(): string | null {
  const value = process.env.ACCESS_REQUEST_EMAIL?.trim();
  return value && /^[^\s@?&]+@[^\s@?&]+$/.test(value) ? value : null;
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ from?: string; error?: string }> }) {
  // A fresh instance has no one to sign in: send the visitor to first-run setup.
  if (!isDemoMode() && (await needsSetup())) redirect("/setup");
  const params = await searchParams;
  // A confirmation link that failed lands here with its error code inside `from`.
  const { from, code } = splitVerifyError(safeFrom(params.from), params.error);
  return (
    <SignInForm
      googleEnabled={GOOGLE_SIGN_IN_ENABLED}
      from={from}
      verifyError={code}
      signupAvailable={await publicSignupAvailable()}
      accessRequestEmail={accessRequestEmail()}
    />
  );
}
