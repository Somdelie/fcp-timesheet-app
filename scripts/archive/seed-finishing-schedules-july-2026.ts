import { prisma } from "@/lib/prisma";

type SupplierKey = "Dulux" | "DIY Savoy Plascon" | "Plascon";
type Zone = "INTERNAL" | "EXTERNAL";

type ItemSpec = {
  zone: Zone;
  position: string;
  quantity: string;
  product: string;
  colorCode?: string;
  supplierLabel?: string;
  supplierKey?: SupplierKey;
  note?: string;
};

type ScheduleSpec = {
  code: string;
  title: string;
  siteAddress?: string;
  contractManager?: string;
  siteForeman?: string;
  fcpContractManager?: string;
  fcpQs?: string;
  fcpSiteForeman?: string;
  client?: string;
  startDate?: Date;
  completionDate?: Date | null;
  delivery?: string;
  items: ItemSpec[];
};

const schedules: ScheduleSpec[] = [
  {
    code: "6471",
    title: "Gateway East Waterfall City",
    delivery: "From Dulux Midrand delivery to site",
    items: [
      {
        zone: "INTERNAL",
        position: "Basement columns",
        quantity: "1 x 20L",
        product: "Trade100",
        colorCode: "Y5-A1-1 Lavis Lemon",
        supplierLabel: "Dulux Midrand",
        supplierKey: "Dulux",
      },
      {
        zone: "INTERNAL",
        position: "Basement columns",
        quantity: "1 x 20L",
        product: "Trade100",
        colorCode: "01-A1-1 Clown",
        supplierLabel: "Dulux Midrand",
        supplierKey: "Dulux",
      },
      {
        zone: "INTERNAL",
        position: "Basement columns",
        quantity: "1 x 20L",
        product: "Trade100",
        colorCode: "G1-A1-1 Daring Lime",
        supplierLabel: "Dulux Midrand",
        supplierKey: "Dulux",
      },
    ],
  },
  {
    code: "6511",
    title: "Etwatwa Crossing",
    delivery: "From DIY Savoy delivery to site",
    items: [
      {
        zone: "INTERNAL",
        position: "Pattern wall",
        quantity: "1 x 5L",
        product: "TLS",
        colorCode: "Y3-B1-1 Gold Cadillac",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Pattern wall",
        quantity: "1 x 5L",
        product: "TLS",
        colorCode: "B4-E1-2 Urban Rock",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Pattern wall",
        quantity: "1 x 5L",
        product: "TLS",
        colorCode: "G3-D1-1 Conifer",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Pattern wall",
        quantity: "1 x 5L",
        product: "TLS",
        colorCode: "G1-D1-3 Spring Forest",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Pattern wall",
        quantity: "1 x 5L",
        product: "TLS",
        colorCode: "R7-B1-1 Burnt Horizon",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
    ],
  },
  {
    code: "6734",
    title: "Midrand Warehouse 6A",
    siteAddress: "162 Tonetti St, Halfway House, Johannesburg 1685",
    contractManager: "Johan Stayn",
    siteForeman: "Silas Skhosana",
    fcpContractManager: "Nicholas Kwinika",
    fcpQs: "Shelly Zhuwaki",
    fcpSiteForeman: "Michael Mpofu2",
    client: "Skystone",
    startDate: new Date("2026-04-07T00:00:00.000Z"),
    completionDate: null,
    delivery: "All paint from Plascon DIY Savoy",
    items: [
      {
        zone: "INTERNAL",
        position: "Restaurant - Internal walls",
        quantity: "",
        product: "TLS",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Restaurant - Soffits",
        quantity: "",
        product: "TSA",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Restaurant - Door and doorframe",
        quantity: "",
        product: "TVW",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Restaurant kitchen - Walls",
        quantity: "",
        product: "TLS",
        colorCode: "FPT 8 Russet",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Restaurant kitchen - Door and doorframe",
        quantity: "",
        product: "TVW",
        colorCode: "FPT Russet",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Back of house - Walls",
        quantity: "",
        product: "TLS",
        colorCode: "GR-Y06 Orchid Bay",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Back of house - Doors and doorframes",
        quantity: "",
        product: "TVW",
        colorCode: "GR-Y06 Orchid Bay",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Roastery - Walls",
        quantity: "",
        product: "TLS",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Roastery - Ceilings",
        quantity: "",
        product: "TSA",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Catering store - Walls",
        quantity: "",
        product: "TLS",
        colorCode: "GR-Y06 Orchid Bay",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Catering store - Doors and doorframes",
        quantity: "",
        product: "TVW",
        colorCode: "GR-Y06 Orchid Bay",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Catering store - Fire doors and doorframes",
        quantity: "",
        product: "TVW",
        colorCode: "GR-B12 Zanzibar Tarven",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Gym - Walls main colour",
        quantity: "",
        product: "TLS",
        colorCode: "GR-B12 Zanzibar Tarven",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Gym - Walls accent colour to bathroom passage",
        quantity: "",
        product: "TLS",
        colorCode: "RAL 2010 Signal Orange",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Gym - Wall for bend",
        quantity: "",
        product: "TLS",
        colorCode: "RAL 2009 Traffic Orange",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Gym - Soffits",
        quantity: "",
        product: "URP004 Plascon TradePro Roof Paint",
        colorCode: "TSA",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Gym - Female / Male locker room walls",
        quantity: "",
        product: "TLS",
        colorCode: "GR-B12 Zanzibar Tarven",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Future tenant - Walls",
        quantity: "",
        product: "TLS",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Future tenant - Ceilings",
        quantity: "",
        product: "TSA",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "EXTERNAL",
        position: "External staircase - Walls",
        quantity: "",
        product: "TLS",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "EXTERNAL",
        position: "External staircase - Ceilings",
        quantity: "",
        product: "TSA",
        colorCode: "07-B2-3 Whipped Cream",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "EXTERNAL",
        position: "External main colour on face brick and plastered walls",
        quantity: "",
        product: "URP004 Plascon TradePro Roof Paint",
        colorCode: "Black",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "EXTERNAL",
        position: "All external steel work",
        quantity: "",
        product: "VLW002 Waterbased Velvaglo",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
    ],
  },
  {
    code: "6777",
    title: "The Ingress 2026",
    siteAddress: "Cnr Lone Creek and Magwa Crescent, Waterfall Ext 67, 3652",
    contractManager: "Jaco",
    fcpContractManager: "Nicholas Kwinika",
    fcpQs: "Shelly Zhuwaki",
    fcpSiteForeman: "Zwelithini Ndlovu",
    startDate: new Date("2026-06-05T00:00:00.000Z"),
    completionDate: new Date("2026-07-10T00:00:00.000Z"),
    delivery: "From Plascon DIY Savoy delivery to site",
    items: [{ zone: "EXTERNAL", position: "External entrance walls", quantity: "", product: "Polvin", colorCode: "GR-Y11 Lisbon Cove", supplierLabel: "DIY Savoy", supplierKey: "DIY Savoy Plascon" }, { zone: "EXTERNAL", position: "All retaining and garden walls at podium", quantity: "", product: "TSA", colorCode: "GR-Y11 Lisbon Cove", supplierLabel: "DIY Savoy", supplierKey: "DIY Savoy Plascon" }, { zone: "EXTERNAL", position: "Main colour", quantity: "", product: "Polvin", colorCode: "AL-Y02 Stone Grey", supplierLabel: "DIY Savoy", supplierKey: "DIY Savoy Plascon" }, { zone: "EXTERNAL", position: "All steel work", quantity: "", product: "W/B Velvaglo", colorCode: "Black", supplierLabel: "DIY Savoy", supplierKey: "DIY Savoy Plascon" }],
  },
  {
    code: "6853",
    title: "Exemplar Maintenance 2026",
    delivery: "From DIY Savoy delivery to site",
    items: [
      {
        zone: "EXTERNAL",
        position: "External walls",
        quantity: "1 x 20L",
        product: "PWC520",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "EXTERNAL",
        position: "External walls",
        quantity: "1 x 20L",
        product: "Micatex",
        colorCode: "White",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
    ],
  },
  {
    code: "6156",
    title: "The Precinct",
    delivery: "From DIY Savoy delivery to site",
    items: [
      {
        zone: "EXTERNAL",
        position: "External ceiling",
        quantity: "2 x 5L",
        product: "TSA",
        colorCode: "GR-N02 New York Square",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
    ],
  },
  {
    code: "6779",
    title: "Moletsi Mall",
    delivery: "From DIY Savoy delivery to office",
    items: [
      {
        zone: "INTERNAL",
        position: "Internal Shoprite walls",
        quantity: "8 x 20L",
        product: "TSA",
        colorCode: "Y4-C2-3 Afternoon Shower",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Internal Shoprite bulk store main colour",
        quantity: "1 x 20L",
        product: "TSA",
        colorCode: "GR-Y01 Geneva Morn",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "INTERNAL",
        position: "Internal Shoprite bulk store bend colour",
        quantity: "1 x 20L",
        product: "TSA",
        colorCode: "GR-Y12 Canterbury Hills",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
      {
        zone: "EXTERNAL",
        position: "External main colour",
        quantity: "1 x 5L",
        product: "TLS",
        colorCode: "G1-E1-2 Garden Hedge",
        supplierLabel: "DIY Savoy",
        supplierKey: "DIY Savoy Plascon",
      },
    ],
  },
];

function itemNote(item: ItemSpec) {
  return [item.quantity ? `Quantity: ${item.quantity}` : null, item.note]
    .filter(Boolean)
    .join(". ");
}

function matchesSeedShape(
  schedule: {
    areas: {
      name: string;
      label: string | null;
      items: {
        zone: Zone;
        position: string;
        product: string | null;
        colorCode: string | null;
        supplier: string | null;
        note: string | null;
      }[];
    }[];
  },
  spec: ScheduleSpec,
) {
  if (schedule.areas.length !== 1) return false;

  const [area] = schedule.areas;
  if (area.name !== "Paint schedule") return false;
  if ((area.label ?? null) !== (spec.delivery ?? null)) return false;
  if (area.items.length !== spec.items.length) return false;

  return spec.items.every((item, index) => {
    const existing = area.items[index];
    return (
      existing?.zone === item.zone &&
      existing.position === item.position &&
      existing.product === item.product &&
      (existing.colorCode ?? null) === (item.colorCode ?? null) &&
      (existing.supplier ?? null) === (item.supplierLabel ?? null) &&
      (existing.note ?? null) === (itemNote(item) || null)
    );
  });
}

async function findSupplierIds() {
  const supplierNames: SupplierKey[] = ["Dulux", "DIY Savoy Plascon", "Plascon"];
  const suppliers = await prisma.supplier.findMany({
    where: { name: { in: supplierNames } },
    select: { id: true, name: true },
  });

  return new Map(suppliers.map((supplier) => [supplier.name, supplier.id]));
}

async function seedSchedule(
  spec: ScheduleSpec,
  supplierIds: Map<string, string>,
) {
  const site = await prisma.site.findUnique({
    where: { code: spec.code },
    select: {
      id: true,
      code: true,
      name: true,
      client: true,
      address: true,
      location: true,
      finishingSchedules: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          siteAddress: true,
          contractNo: true,
          client: true,
          isActive: true,
          areas: {
            orderBy: { sortOrder: "asc" },
            select: {
              name: true,
              label: true,
              items: {
                orderBy: { sortOrder: "asc" },
                select: {
                  zone: true,
                  position: true,
                  product: true,
                  colorCode: true,
                  supplier: true,
                  note: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!site) {
    console.warn(`Skipped ${spec.code}: site not found.`);
    return "skipped";
  }

  const existingSeed = site.finishingSchedules.find((schedule) =>
    matchesSeedShape(schedule, spec),
  );
  const emptySchedule = site.finishingSchedules.find(
    (schedule) => schedule.areas.length === 0,
  );
  const schedule = existingSeed ?? emptySchedule ?? null;

  const areaCreate = {
    name: "Paint schedule",
    label: spec.delivery ?? null,
    sortOrder: 0,
    items: {
      create: spec.items.map((item, index) => ({
        zone: item.zone,
        position: item.position,
        product: item.product,
        colorCode: item.colorCode ?? null,
        supplier: item.supplierLabel ?? null,
        supplierId: item.supplierKey
          ? (supplierIds.get(item.supplierKey) ?? null)
          : null,
        sortOrder: index,
        note: itemNote(item) || null,
      })),
    },
  };

  await prisma.$transaction(async (tx) => {
    if (schedule) {
      await tx.siteFinishingScheduleArea.deleteMany({
        where: { scheduleId: schedule.id },
      });

      await tx.siteFinishingSchedule.update({
        where: { id: schedule.id },
        data: {
          contractNo: spec.code,
          client: spec.client ?? site.client,
          siteAddress: spec.siteAddress ?? schedule.siteAddress ?? site.address ?? site.location,
          contractManager: spec.contractManager ?? null,
          siteForeman: spec.siteForeman ?? null,
          fcpContractManager: spec.fcpContractManager ?? null,
          fcpQs: spec.fcpQs ?? null,
          fcpSiteForeman: spec.fcpSiteForeman ?? null,
          startDate: spec.startDate ?? null,
          completionDate: spec.completionDate ?? null,
          isActive: true,
          areas: { create: areaCreate },
        },
      });
    } else {
      await tx.siteFinishingSchedule.create({
        data: {
          siteId: site.id,
          contractNo: spec.code,
          client: spec.client ?? site.client,
          siteAddress: spec.siteAddress ?? site.address ?? site.location,
          contractManager: spec.contractManager ?? null,
          siteForeman: spec.siteForeman ?? null,
          fcpContractManager: spec.fcpContractManager ?? null,
          fcpQs: spec.fcpQs ?? null,
          fcpSiteForeman: spec.fcpSiteForeman ?? null,
          startDate: spec.startDate ?? null,
          completionDate: spec.completionDate ?? null,
          isActive: true,
          areas: { create: areaCreate },
        },
      });
    }

    await tx.site.update({
      where: { id: site.id },
      data: { finishingScheduleDone: true },
    });
  });

  console.log(
    `${schedule ? "Updated" : "Created"} schedule for ${spec.code} ${site.name} (${spec.items.length} items)`,
  );
  return schedule ? "updated" : "created";
}

async function main() {
  const supplierIds = await findSupplierIds();
  const results = { created: 0, updated: 0, skipped: 0 };

  for (const spec of schedules) {
    const result = await seedSchedule(spec, supplierIds);
    results[result] += 1;
  }

  console.log(
    `Done. Created ${results.created}, updated ${results.updated}, skipped ${results.skipped}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
