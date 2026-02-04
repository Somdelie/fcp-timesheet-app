import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirectIfAuthenticated } from "@/lib/auth";

export default async function LoginPage() {
  // If the user is already logged in, send them to the main app.
  await redirectIfAuthenticated("/");

  return (
    <div
      suppressHydrationWarning
      className="w-full flex items-center min-h-screen justify-center"
    >
      <Card className="w-full max-w-lg p-2">
        <CardHeader className="flex items-center justify-between bg-gray-100 rounded py-1">
          <img src="/logo.png" alt="Logo" className="w-34 h-12  " />
          <CardTitle className="text-center text-2xl text-sky-900">
            Welcome Back
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
