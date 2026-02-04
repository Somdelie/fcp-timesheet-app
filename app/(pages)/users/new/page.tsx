// @ts-nocheck
import CreateUserForm from "@/components/auth/CreateUserForm";
import { Card, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export default async function NewUserPage(props) {
  // Only admins can access this page
  await requireAuth({ roles: ["ADMIN"] });

  return (
    <div className="w-full flex items-center justify-center">
      <Card className="w-full max-w-lg p-4 gap-3">
        <CardHeader className="flex items-center justify-between rounded py-1 font-black text-2xl p-0 pb-1 border-b-2 border-primary">
          Fill in The Form to Create New User
        </CardHeader>
        <CreateUserForm />
      </Card>
    </div>
  );
}
