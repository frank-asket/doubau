import { SignUp } from "@clerk/nextjs";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const nextParam = typeof sp.next === "string" ? sp.next : undefined;
  const nextPath = nextParam ?? "/onboarding/career";
  const nextQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  return (
    <SignUp
      forceRedirectUrl={nextPath}
      signInUrl={`/login${nextQuery}`}
      appearance={{
        elements: {
          card: "bg-transparent shadow-none p-0 border-0",
          rootBox: "w-full",
        },
      }}
    />
  );
}

