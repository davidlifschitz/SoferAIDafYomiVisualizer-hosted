import { LoginForm } from "@/components/login-form";
import { sanitizeNextPath } from "@/lib/auth/redirect";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next, "/");
  const errorMessage = params.error;

  return (
    <div className="login-page">
      <LoginForm nextPath={nextPath} errorMessage={errorMessage} />
    </div>
  );
}