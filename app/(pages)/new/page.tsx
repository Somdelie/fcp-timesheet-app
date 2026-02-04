import CreateSiteForm from "@/components/sites/CreateSiteForm";

export default function NewSitePage() {
  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold">Create site</h1>
      <div className="mt-4">
        <CreateSiteForm />
      </div>
    </div>
  );
}
