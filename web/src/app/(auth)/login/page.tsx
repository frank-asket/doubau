import { SignIn } from "@clerk/nextjs";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const nextParam = typeof sp.next === "string" ? sp.next : undefined;
  const nextPath = nextParam ?? "/app/dashboard";
  const nextQuery = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  return (
    <SignIn
      forceRedirectUrl={nextPath}
      signUpUrl={`/signup${nextQuery}`}
      appearance={{
        elements: {
          card: "bg-transparent shadow-none p-0 border-0",
          rootBox: "w-full",
        },
      }}
    />
  );
}

