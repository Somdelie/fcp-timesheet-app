import { getAllUsers } from "@/actions/user";
import { requireServerAuth } from "@/lib/auth-server";
import UserList from "@/components/users/UserList";

export const revalidate = 300;

export default async function UsersPage() {
  const auth = await requireServerAuth();
  const users = await getAllUsers();
  // console.log(users);
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <UserList users={users} currentUserRole={auth.role} />
    </div>
  );
}
