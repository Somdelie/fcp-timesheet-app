import { redirect } from "next/navigation";

export default function PpeOrdersRedirect() {
  redirect("/admin/orders");
}
