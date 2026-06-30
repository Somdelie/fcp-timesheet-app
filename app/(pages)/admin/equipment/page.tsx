"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlantListPage from "../plant-list/page";
import PlantAssignmentsPage from "../plant-assignments/page";
import ProductsList from "@/components/products/ProductsList";
import { CreateProductDialog } from "@/components/products/CreateProductDialog";
import CapeTownStockPage from "../capetown-stock/page";

const TABS = [
  { value: "plants", label: "Plants" },
  { value: "deployed", label: "Deployed Equipments" },
  { value: "ppe", label: "PPE Catalogue" },
  { value: "tools", label: "Tools" },
];

export default function EquipmentPage() {
  const [activeTab, setActiveTab] = useState<string>("plants");

  return (
    <div className="mx-auto w-full space-y-6">
      <div className="rounded border border-muted/50 bg-card p-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                <>
                  <CreateProductDialog />
                  <Tabs defaultValue="jhb" className="space-y-4">
                    <TabsList className="grid w-full max-w-md grid-cols-2 gap-2">
                      <TabsTrigger value="jhb">JHB</TabsTrigger>
                      <TabsTrigger value="capetown">Cape Town</TabsTrigger>
                    </TabsList>
                    <TabsContent value="jhb" className="space-y-4">
                      <ProductsList
                        ppeProducts={[]}
                        toolProducts={[]}
                        defaultTab="PPE"
                        hideTabs
                        autoLoad
                        showSku={false}
                        showStatus={false}
                        includeInactive={false}
                      />
                    </TabsContent>
                    <TabsContent value="capetown" className="space-y-4">
                      <CapeTownStockPage
                        defaultCategory="PPE"
                        lockCategory
                        showHeader={false}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="tools" className="space-y-6">
              {activeTab === "tools" ? (
                <>
                  <CreateProductDialog />
                  <Tabs defaultValue="jhb" className="space-y-4">
                    <TabsList className="grid w-full max-w-md grid-cols-2 gap-2">
                      <TabsTrigger value="jhb">JHB</TabsTrigger>
                      <TabsTrigger value="capetown">Cape Town</TabsTrigger>
                    </TabsList>
                    <TabsContent value="jhb" className="space-y-4">
                      <ProductsList
                        ppeProducts={[]}
                        toolProducts={[]}
                        defaultTab="TOOL"
                        hideTabs
                        autoLoad
                        showSku={false}
                        showStatus={false}
                        includeInactive={false}
                      />
                    </TabsContent>
                    <TabsContent value="capetown" className="space-y-4">
                      <CapeTownStockPage
                        defaultCategory="TOOL"
                        lockCategory
                        showHeader={false}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              ) : null}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
