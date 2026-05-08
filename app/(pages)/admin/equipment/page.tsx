"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlantListPage from "../plant-list/page";
import PlantAssignmentsPage from "../plant-assignments/page";
import EquipmentInventoryPage from "../equipment-inventory/page";
import ProcurementProductsPage from "../procurement-products/page";

const TABS = [
  { value: "plants", label: "Plants" },
  { value: "deployed", label: "Deployed Equipments" },
  { value: "ppe", label: "PPE Catalogue" },
];

export default function EquipmentPage() {
  const [activeTab, setActiveTab] = useState<string>("plants");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipment</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Manage plant and equipment workflows with a single tabbed entry. Use
          the tabs to switch between equipment catalogue, deployed equipment,
          and PPE catalogue.
        </p>
      </div>

      <div className="rounded border border-muted/50 bg-card p-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <TabsContent value="plants" className="space-y-6">
              {activeTab === "plants" ? <PlantListPage /> : null}
            </TabsContent>
            <TabsContent value="deployed" className="space-y-6">
              {activeTab === "deployed" ? <PlantAssignmentsPage /> : null}
            </TabsContent>
            <TabsContent value="ppe" className="space-y-6">
              {activeTab === "ppe" ? (
                <ProcurementProductsPage defaultProductType="PPE" />
              ) : null}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
