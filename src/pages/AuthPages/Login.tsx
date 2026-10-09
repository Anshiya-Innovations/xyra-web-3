import PageMeta from "@/components/common/PageMeta";
import { XyraMark } from "@/components/common/XyraLogo";
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { ToastRegion } from "@/components/ui/toast/Toast";
import { AUTH_BASE_URL, TEST_SUBDOMAIN } from "@/lib/config";
import { MOCK_USERS, notifyBackendOffline } from "@/lib/mock-data";
import { saveSession } from "@/lib/session";
import { Key01 } from "@untitledui/icons";
import { useState } from "react";
import { useNavigate } from "react-router";
import AuthLayout from "./AuthPageLayout";

// Same 5 demo personas as xyra-web's Login.controller.js. xyra-core checks the
// persona's role against the user's membership in this tenant and returns a
// signed session token (see xyra-core AuthService.login). `route` mirrors
// xyra-web's ROUTE_FOR_ROLE dispatch table - REV1/REV2 share the same REVIEWER
// role, so only the exact email (not role alone) tells them apart.
const PERSONAS = [
  { id: "ADMIN", label: "Admin", role: "ADMIN", email: "admin@xyrademo.test", route: "/dashboard" },
  { id: "ACM", label: "Escalation Manager", role: "ESCALATION_MANAGER", email: "escalationmanager@xyrademo.test", route: "/escalation-manager" },
  { id: "REV1", label: "Reviewer 1", role: "REVIEWER", email: "reviewer1@xyrademo.test", route: "/reviewer-1" },
  { id: "REV2", label: "Reviewer 2", role: "REVIEWER", email: "reviewer2@xyrademo.test", route: "/reviewer-2" },
  { id: "AUDITOR", label: "Auditor", role: "AUDITOR", email: "auditor@xyrademo.test", route: "/auditor" },
] as const;

export default function Login() {
  const navigate = useNavigate();
  const [personaId, setPersonaId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onPersonaChange = (id: string) => {
    setPersonaId(id);
    const persona = PERSONAS.find((p) => p.id === id);
    if (persona) setEmail(persona.email);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const persona = PERSONAS.find((p) => p.id === personaId);
    if (!persona) {
      setError("Please select your persona.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${AUTH_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: TEST_SUBDOMAIN, email: email.trim(), persona: persona.role }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Could not sign in with that email.");
        return;
      }
      if (data.role !== persona.role || data.email !== persona.email) {
        setError("This email doesn't match the selected persona.");
        return;
      }

      saveSession({
        token: data.token,
        userId: data.userId,
        tenantId: data.tenantId,
        role: data.role,
        name: data.name,
        email: data.email,
      });
      navigate(persona.route);
    } catch {
      // xyra-core is unreachable, not just rejecting the login - let the
      // selected persona in anyway, backed by the same dummy fixtures
      // mock-data.ts falls back to everywhere else.
      const mockUser = MOCK_USERS.find((u) => u.role === persona.role && u.email === persona.email);
      if (!mockUser) {
        setError("Could not reach the server, and no dummy data is available for that persona.");
        return;
      }
      notifyBackendOffline();
      saveSession({
        token: "",
        userId: mockUser.id,
        tenantId: null,
        role: mockUser.role,
        name: mockUser.name,
        email: mockUser.email,
      });
      navigate(persona.route);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageMeta title="Sign In | Xyra" description="Sign in to Xyra" />
      <AuthLayout>
        <div className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
            <div className="mb-5 sm:mb-8">
              <XyraMark className="mb-6 h-10" />
              <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
                Welcome back!
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select your persona and enter your email to sign in.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
              <div>
                <Label htmlFor="persona">
                  Persona <span className="text-error-500">*</span>
                </Label>
                <Select
                  id="persona"
                  placeholder="Select persona"
                  value={personaId}
                  onChange={onPersonaChange}
                  options={PERSONAS.map((p) => ({ value: p.id, label: p.label }))}
                />
              </div>

              <div>
                <Label htmlFor="email">
                  Email <span className="text-error-500">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@xyrademo.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-error-500">{error}</p>}

              <Button type="submit" className="w-full" size="sm" loading={isLoading}>
                Sign In
              </Button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-5 text-gray-400 dark:bg-gray-900">Or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                size="sm"
                startIcon={<Key01 className="size-5" />}
                onClick={() => setError("SSO sign-on isn't configured yet — use Persona + Email for now.")}
              >
                Sign in with SSO
              </Button>
            </form>

            <div className="mt-8 flex flex-col items-center gap-0.5 text-xs text-gray-400">
              <span>Version 1.0.0</span>
              <span>© 2026 Forte Innovations</span>
            </div>
          </div>
        </div>
      </AuthLayout>
      <ToastRegion />
    </>
  );
}
