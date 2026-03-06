// @ts-nocheck
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/actions/user";
import EditUserInfoForm from "@/components/auth/EditUserInfoForm";

export const revalidate = 60;

export default async function ProfilePage(props) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }
  const userInfo = await getUserByEmail(session.user.email);

  console.log("User Info:", userInfo);

  if (!userInfo) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen dark:bg-card rounded px-4 py-12 sm:px-6 lg:px-8 transition-colors duration-200 bg-card/60 backdrop-blur">
      <div className="mx-auto max-w-3xl">
        {/* Header with decorative element */}
        <div className="mb-12">
          <div className="mb-3 inline-block">
            <div className="h-1 w-12 bg-sky-600 rounded-full"></div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
            My Profile
          </h1>
          <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">
            Manage your account information
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-card rounded shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow duration-300">
          {/* Decorative top border */}
          <div className="h-1.5 bg-sky-600"></div>

          <div className="p-8 sm:p-10">
            {/* Avatar Section */}
            <div className="flex items-start gap-6">
              {/* Avatar Circle */}
              <div className="shrink-0">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-linear-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-2xl font-semibold shadow-lg">
                    {userInfo?.name
                      ? userInfo.name.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  {/* Status indicator */}
                  <div className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-900"></div>
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">
                  {userInfo?.name ?? "Unnamed user"}
                </h2>

                {userInfo?.email && (
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="h-4 w-4 text-slate-400 dark:text-slate-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {userInfo.email}
                    </p>
                  </div>
                )}

                {/* Role Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-full">
                  <svg
                    className="h-4 w-4 text-sky-600 dark:text-sky-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span className="text-sm font-medium text-sky-700 dark:text-sky-400">
                    {userInfo?.role || "User"}
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="my-8 border-t border-slate-200 dark:border-slate-800"></div>

            {/* Additional Info Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Account Status
                </p>
                <p className="text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Active
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Member Since
                </p>
                <p className="text-base text-slate-900 dark:text-slate-100">
                  {new Date().toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Action Buttons - Uncomment when ready */}
            {/* <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <EditUserInfoForm userInfo={userInfo} />
            </div> */}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button className="group flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 hover:border-sky-600 dark:hover:border-sky-500 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all duration-200">
            <div className="shrink-0 h-10 w-10 rounded bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 dark:group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Edit Profile
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update your info
              </p>
            </div>
          </button>

          <button className="group flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 hover:border-sky-600 dark:hover:border-sky-500 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all duration-200">
            <div className="shrink-0 h-10 w-10 rounded bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 dark:group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Security
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage password
              </p>
            </div>
          </button>

          <button className="group flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 hover:border-sky-600 dark:hover:border-sky-500 hover:shadow-md dark:hover:shadow-slate-900/50 transition-all duration-200">
            <div className="shrink-0 h-10 w-10 rounded bg-sky-50 dark:bg-sky-950/50 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:bg-sky-600 dark:group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Settings
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preferences
              </p>
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
