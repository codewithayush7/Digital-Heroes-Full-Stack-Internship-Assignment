import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CharityService } from "@/lib/services/charity.service";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ charityId?: string; plan?: string }>;
}) {
  const { charityId, plan } = await searchParams;
  const supabase = await createClient();
  const { data: charities = [] } = await CharityService.getCharities(supabase);

  // Safely verify if charityId corresponds to an existing charity
  const matchedCharity = charityId
    ? charities.find((c) => c.id === charityId)
    : null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090D16]" />}>
      <SignupForm
        charities={charities}
        preSelectedCharityId={matchedCharity ? matchedCharity.id : null}
        preSelectedPlan={plan || null}
      />
    </Suspense>
  );
}
