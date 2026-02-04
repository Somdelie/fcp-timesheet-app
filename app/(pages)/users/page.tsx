import { getAllUsers } from "@/actions/user";
import React from "react";

export default async function UsersPage() {
  const users = await getAllUsers();
  console.log(users);
  return <div>UsersPage</div>;
}
