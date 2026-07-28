/**
 * Seed script: create missing Site records and SupervisorSiteAssignment records.
 *
 * Usage:
 *   npx tsx prisma/seed-missing-sites-and-supervisor-assignments.ts
 *
 * Idempotent â€” safe to re-run. Does not create duplicates.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import * as fs from "fs";

// â”€â”€â”€ Prisma setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEFAULT_STARTS_ON = new Date("2026-01-01T00:00:00.000Z");

const SUPERVISOR_IDS = {
  TSHEPO: "cmmhwyz2p000dksplruef5ny0",
  GEOFREY: "cmmhwtdny000bksplyaz6awe0",
  LUCAS: "cmmdtjakq000109jvg28qbliq",
  MAWESI: "cmmdgymvv000209l5io3ztzxt",
  GRIFFITH: "cmmdgvrmm000109jrx0psyqci",
  LAWRENCE: "cmm4lctyy000309kwjjkufjnn",
  THOUSAND: "cmm4iy297000209l6ssh41ntd",
  NIC: "cmm3gntvs000g1spvvisqizyn",
  OWEN: "cmm3fk9u800071spv5co9oko4",
  THEMBA: "cmm32kesx000109jprlix5qra",
} as const;

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type RawSiteRow = {
  code: string;
  name: string;
  client: string;
  supervisorRaw: string;
};

type SupervisorKey = keyof typeof SUPERVISOR_IDS;

type ResolvedSiteRow = RawSiteRow & {
  supervisorKey: SupervisorKey;
  supervisorId: string;
};

type ManualReviewRow = {
  reason: string;
  row: Partial<RawSiteRow>;
  details?: string;
};

// â”€â”€â”€ Counters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let createdSites = 0;
let reusedSites = 0;
let updatedSites = 0;
let createdAssignments = 0;
let skippedAssignments = 0;
const manualReview: ManualReviewRow[] = [];

// â”€â”€â”€ Helper functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Collapse runs of whitespace and trim */
function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Map raw supervisor name (case-insensitive, trimmed) to a canonical key.
 * Returns undefined when no safe mapping exists.
 */
function normalizeSupervisorName(raw: string): SupervisorKey | undefined {
  const s = normalizeWhitespace(raw).toLowerCase();

  if (["temba", "themba"].includes(s)) return "THEMBA";
  if (["geofrey", "geoffrey", "geofry"].includes(s)) return "GEOFREY";
  if (["lucas"].includes(s)) return "LUCAS";
  if (["mawesi"].includes(s)) return "MAWESI";
  if (["griff", "griffith"].includes(s)) return "GRIFFITH";
  if (["lawrence"].includes(s)) return "LAWRENCE";
  if (["thousand"].includes(s)) return "THOUSAND";
  if (["nic", "nico", "nicholas", "nicolas"].includes(s)) return "NIC";
  if (["owen"].includes(s)) return "OWEN";
  if (["tshepo"].includes(s)) return "TSHEPO";

  return undefined;
}

/**
 * Normalize a site name for matching:
 * - uppercase, trim, collapse whitespace
 * - normalize dashes/en-dashes spacing
 * - keep &, -, /, numbers, punctuation
 */
function normalizeSiteName(name: string): string {
  let n = name.toUpperCase().trim();
  // collapse whitespace
  n = n.replace(/\s+/g, " ");
  // normalize en-dash / em-dash to hyphen
  n = n.replace(/[â€“â€”]/g, "-");
  // collapse spaces around hyphens: " - " or "- " or " -" => "-"
  n = n.replace(/\s*-\s*/g, "-");
  return n;
}

/** Parse the raw tab-separated text into RawSiteRow[] */
function parseRows(raw: string): RawSiteRow[] {
  const rows: RawSiteRow[] = [];
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("\t");
    if (parts.length < 4) {
      manualReview.push({
        reason: "malformed row (fewer than 4 tab-separated columns)",
        row: { code: parts[0] ?? "", name: parts[1] ?? "" },
        details: `Raw line: ${trimmed}`,
      });
      continue;
    }
    rows.push({
      code: parts[0].trim(),
      name: parts[1].trim(),
      client: parts[2].trim(),
      supervisorRaw: parts[3].trim(),
    });
  }
  return rows;
}

/**
 * Try to find an existing site by:
 *   1. Exact code match
 *   2. Normalized name match
 *
 * Returns { byCode, byName } â€” either or both may be undefined.
 */
async function findExistingSite(
  code: string,
  name: string,
): Promise<{
  byCode: { id: string; name: string; code: string | null } | null;
  byName: { id: string; name: string; code: string | null } | null;
}> {
  let byCode: { id: string; name: string; code: string | null } | null = null;
  let byName: { id: string; name: string; code: string | null } | null = null;

  if (code) {
    byCode = await prisma.site.findUnique({
      where: { code },
      select: { id: true, name: true, code: true },
    });
  }

  // Search by normalized name (case-insensitive via upper+trim compare)
  const normalized = normalizeSiteName(name);
  const candidates = await prisma.site.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });
  for (const c of candidates) {
    if (normalizeSiteName(c.name) === normalized) {
      byName = c;
      break;
    }
  }

  return { byCode, byName };
}

/**
 * Ensure a Site exists for the given row. Returns the site id.
 * Returns null if the row should be pushed to manual review.
 */
async function ensureSite(row: RawSiteRow): Promise<string | null> {
  const { byCode, byName } = await findExistingSite(row.code, row.name);

  // Both match but to *different* sites â†’ manual review
  if (byCode && byName && byCode.id !== byName.id) {
    manualReview.push({
      reason: "code and normalized name match different existing sites",
      row,
      details: `byCode.id=${byCode.id} (${byCode.name}), byName.id=${byName.id} (${byName.name})`,
    });
    return null;
  }

  // Existing site found by code
  if (byCode) {
    reusedSites++;
    // Optionally clean up name if raw is clearly better (only casing/spacing)
    const normalizedExisting = normalizeSiteName(byCode.name);
    const normalizedRaw = normalizeSiteName(row.name);
    if (
      normalizedExisting === normalizedRaw &&
      byCode.name !== row.name.trim()
    ) {
      // raw name is same meaning but raw version has better casing â€” update
      await prisma.site.update({
        where: { id: byCode.id },
        data: { name: row.name.trim() },
      });
      updatedSites++;
    }
    return byCode.id;
  }

  // Existing site found by normalized name (no code match)
  if (byName) {
    reusedSites++;
    // If existing site has no code and raw row provides one, fill it in
    if (!byName.code && row.code) {
      await prisma.site.update({
        where: { id: byName.id },
        data: { code: row.code },
      });
      updatedSites++;
    }
    return byName.id;
  }

  // No match â†’ check for blank code or name
  if (!row.code && !row.name) {
    manualReview.push({
      reason: "blank code and name",
      row,
    });
    return null;
  }

  // Create new site
  const created = await prisma.site.create({
    data: {
      code: row.code || null,
      name: row.name.trim(),
      isActive: true,
    },
    select: { id: true },
  });
  createdSites++;
  return created.id;
}

/**
 * Ensure a SupervisorSiteAssignment exists.
 * Skips if assignment already active.
 * Pushes to manualReview if a different supervisor is already assigned.
 */
async function ensureSupervisorAssignment(
  siteId: string,
  supervisorId: string,
  row: RawSiteRow,
): Promise<void> {
  // Check for existing active assignment for this exact pair
  const existingExact = await prisma.supervisorSiteAssignment.findFirst({
    where: {
      siteId,
      supervisorId,
      endsOn: null,
    },
  });
  if (existingExact) {
    skippedAssignments++;
    return;
  }

  // Check for active assignment to same site by a *different* supervisor
  const existingOther = await prisma.supervisorSiteAssignment.findFirst({
    where: {
      siteId,
      endsOn: null,
      NOT: { supervisorId },
    },
  });
  if (existingOther) {
    manualReview.push({
      reason: "different supervisor already actively assigned to this site",
      row,
      details: `existingAssignment.id=${existingOther.id}, existingSupervisorId=${existingOther.supervisorId}, newSupervisorId=${supervisorId}`,
    });
    skippedAssignments++;
    return;
  }

  // Create assignment
  await prisma.supervisorSiteAssignment.create({
    data: {
      supervisorId,
      siteId,
      startsOn: DEFAULT_STARTS_ON,
      endsOn: null,
    },
  });
  createdAssignments++;
}

// â”€â”€â”€ Raw data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RAW_SITE_ROWS = `
6005	Trilogy Phase 2	Barrow	Mawesi
6006	Builders Express Wonderboom	Hkampman	Mawesi
6007	Mehlareng SC	Mikebuyskes	Nic
6008	Steyn City Stand 2361	SRP Development	Griff
6009	Redhill School Repaints	Bantry	Owen
6010	Midstream Bowling Club	Direct	Nic
6011	Retire @Midstream X47 Woodwork	Direct	Nic
6012	TakeAlot CC Phase 2 Ext	Isipani	Geofrey
6013	CPT Flat	FCP	Sean
6014	Tricolt Offices 2024	Valobex	Thousand
6015	Riverview SC	Probest Projects (PTY) LTD	Temba
6016	Bongani Rainmaker	Bantry	Lucas
6017	Midstream Medical Centre	Bondev	Nic
6018	Liberty Promenade	Abbeycape	Geofrey
6019	Data Science	Baucor	Owen
6020	St Peters Gunn Pavillion	LVProjects	Owen
6021	Paarl Cycle Lab	Isipani	Geofrey
6022	Lighting Warehouse	RICP	Lucas
6023	FCP3828 Princeton Village	RESPUBLICA	Sean
6024	Unit 14 61 Shepherd Ave	Direct	Owen
6025	Engine-Co	Direct	Thousand
6026	Jeppe Highschool for Boys	Rocon	Thousand
6027	Princeton Village Gym	RESPUBLICA	Nic
6028	Renault Woodmead	JTSon	Owen
6029	Piazza Paola Unit 999	Abbeydale	Owen
6030	Houghton Phase 4 Core O-R	Direct	Thousand
6031	McCormick 2024	Direct	Nic
6032	Flender	Abbeydale	Lucas
6033	Stand 4131 Waterfall	Direct	Cautious
6034	Arcon Park	Caveleros	Temba
6035	Cape Town Office	FirstClass Projects	Sean
6036	Woolworths DC Midrand	Abbeydale	Nic
6037	Acudeo College Protea Glen	DLR	Temba
6038	SARB PTA	WBHO	Nic
6039	Mediclinic LTRoom	Direct	Nic
6040	House Ixopo	Direct	Sean
6041	FCP3848 Bosch	Direct	Lucas
6042	Bidvest International & Domestic Lounge	FRAMECORE CONSTRUCTION	Geofrey
6043	9 Alyth Road Forest Town	JTDooley	Owen
6044	AIE Greenside	Farquharson Construction	Owen
6045	LDS Meetinghouse Benoni	Millcon	Lucas
6046	St Johns Unit 5 St Marks Str	Direct	Lawrence
6047	The Signature Type E	African Kingdom Holdings	Lucas
6048	CWI Vanderbijl	JTDooley	Temba
6049	12C Mount 2024	Baucor	Owen
6050	Eskimo	Bantry	Nic
6051	Kingswood Retirement Waterkloof	Baucor	Mawesi
6052	Hatfield Square PR2838	RESPUBLICA	Mawesi
6053	Elim Hubyeni	Broll	Nic
6054	Isondo Precinct	JCRefurb	Lucas
6055	Midstream Hill Medical Park Repaints	Direct	Nic
6056	Alphen Park Inverter Room	Skystone	Mawesi
6057	21 8th Ave Parktown North	Direct	Owen
6058	FCP3831 M&D Offices	M&D Construction	Owen
6059	37 Commerce Crescent PO14145	Alchemy Props	Owen
6060	Eastport Gate House	Direct	Lucas
6061	Pineslopes SC Cladding	BJV	Griff
6062	Watch Tower 	Direct	Sean
6063	43 Chesham Boundary and Gate House	Millcon	Owen
6064	Midstream Mediclinic Paediatric Unit D	Millcon	Nic
6065	Rakesh Res	M&D Construction	Owen
6066	33 Commerce Crescent	Alchemy Props	Owen
6067	Tree Tops Exterior	Trencon Construction	Owen
6068	Unilever Boksburg	Abbeydale 	Lucas
6069	Anslow Akaru 	Farquharson Construction	Owen
6070	Upper East Side	Curasure	Lucas
6071	St Marks Str Unit 1	Direct	Lawrence
6072	26 Elray Street Unit 3	Direct	Owen
6073	Atlantic Hills Warehouse	Abbeydale	Geofrey
6074	Sandhurst OP	Redefine	Owen
6075	Parkdene Woolworths	WBHO	Lucas
6076	31 Mackay Street	FirstClass Projects	Sean
6077	Table Bay Hotel	WBHO	Geofrey
6078	NG Gesmylspruit	MBC	Nic
6079	31 Commerce Ave	Alchemy Props	Owen
6080	Metropolis On Park Unit 1310	Direct	Owen
6081	Leaping Frog SC	Probest Projects (PTY) LTD	Griff
6082	The Capital on Bath	Direct	Owen
6083	299 Lombardy Estate	DLR	Mawesi
6084	Lephalale Mall Exterior	GDM Group	Nic
6085	Brookfields @ Royal Repaints	Tricolt	Thousand
6086	Midfield  HOA	Bondev	Nic
6087	Ridge HOA	Bondev	Nic
6088	House Roller	Bartosch Construction	Temba
6089	House JP	Direct	Sean
6090	Ellipse Repaints	Barrow	Nic
6091	White House	GDM Group	Nic
6092	71 Beryl Str Bruma	JTDooley	Thousand
6093	Stor-Age Brooklyn 2024	Direct	Mawesi
6094	Stor-Age Bryanston 2024	Direct	Owen
6095	Rent A Store 2024	Direct	Lawrence
6096	Lluvia Sugar	Abbeycape	Geofrey
6097	Lavender Square Checkers	Hkampman	Mawesi
6098	Culross On Main Carports	Barrow	Owen
6099	St Mary's Gymnasium	LVProjects	Lucas
6100	447 Vale Avenue	LVProjects	Owen
6101	Wear Check 	JCRefurb	Lucas
6102	26 Pomona Road	Bantry	Lucas
6103	Idutywa Mall	Mikebuyskes	Nic
6104	Sky City Mall Pnp 	Central Developments	Temba
6105	Trilogy Phase 2 Interior	Menlyn Maine	Mawesi
6106	Royal View B2 Exterior	MBC	Owen
6107	11 Jameson	Direct	Owen
6108	The Ingress B1-3	Archstone Construction (PTY) LTD	Cautious
6109	Chamberlain Montana	MBC	Mawesi
6110	Innomotics 	Skystone	Nic
6111	Bedworth Centre	Edilcon Construction (Pty) Ltd	Temba
6112	Netcare Akasia	JCRefurb	Mawesi
6113	GHM Office and Warehouse	Edilcon Construction (Pty) Ltd	Lucas
6114	Unit 23 St David Rd	Direct	Lawrence
6115	24 Falcon Crescent 2024	Direct	Temba
6116	BC Warehouse	FRAMECORE CONSTRUCTION	Geofrey
6117	Nova Pioneer Midrand	DLR	Nic
6118	Stand 716 Bluehills	SRP Development	Nic
6119	FCP3883 Retire@Midstream	Direct	Nic
6120	88 Bergrivier Drive	JTDooley	Lucas
6121	South Block Unit 340C	Direct	Owen
6122	4 Epping	JTDooley	Lawrence
6123	Midlands HOA	Bondev	Nic
6124	Saintsbury Corner	M&M CONSTRUCTION	Temba
6125	Hertford Block L	Probest Projects (PTY) LTD	Nic
6126	McDonald's Westwood	Jovan	Lucas
6127	Oxglen Ph3 Rooftop	Barrow	Lawrence
6128	Safety Grip & Pride in Tyres	Abbeycape	Geofrey
6129	The Boardwalk Estate	Barrow	Geofrey
6130	Benmore SC	Redefine	Owen
6131	Shoprite Jacaranda	GDM Group	Mawesi
6132	Lagoon Beach Hotel	FRAMECORE CONSTRUCTION	Geofrey
6133	Waverley Phase 3	Barrow	Lawrence
6134	Kingdom Hall Soweto SC2337	Direct	Temba
6135	HS Block B Ablutions	RESPUBLICA	Mawesi
6136	Mias Angling and Scuba	SRP Development	Cautious
6137	34 Marbella Complax	Baucor	Nic
6138	Tasha's Constantia	Versus	Geofrey
6139	140 Woburn Ave	Direct	Lucas
6140	FCP3917 St Johns	Direct	Lawrence
6141	Nedbank Talis Roof Repair	Redefine	Sean
6142	Stoneridge McDonalds	Redefine	Lucas
6143	Bespoke By Barrow	Barrow	Lawrence
6144	House Tayob	Direct	Owen
6145	Sunward Management Office Staircase	JCRefurb	Lucas
6146	142 Mulberry Lane	Libera	Owen
6147	Paarl Gymnasium	Isipani	Geofrey
6148	Tashas Waffle House	Versus	Geofrey
6149	Stef Stocks Data Centre	Versus	Geofrey
6150	159 Arkansas Ave	JTDooley	Lawrence
6151	House Villion	Direct	Geofrey
6152	2 Bristol Rd 2024	Baucor	Owen
6153	14 Lawrence Rd	JTDooley	Lawrence
6154	Longlakes 19 Building 5	JTSon	Lucas
6155	Waterkloof High School	Airclima	Mawesi
6156	The Precinct Lifestyle	Archstone Construction (PTY) LTD	Nic
6157	Protea Wanderers 2024	Jovan	Lawrence
6158	Lakeview SC	Tri-Star	Temba
6159	Stand 2458 Midlands Estate 2024	Archstone Construction (PTY) LTD	Nic
6160	Clearview Square	Jovan	Temba
6161	Pencil Park	Bantry	Thousand
6162	Uitsig Estate Stand 9&33	Excelsus	Cautious
6163	St Peters College Pavillion	Baucor	Owen
6164	Roedean Boarding School	Barrow	Lawrence
6165	20 Inge-Le	Baucor	Nic
6166	E-Media	Barrow	Owen
6167	Scania Truck Warehouse	JTSon	Temba
6168	Midstream Mediclinic Compressor and Vacuum	Direct	Nic
6169	DB Schenker Hazmat Store	Bantry	Lucas
6170	Longlakes Warehouse 6	NDWALA(FARQUHARSON BEE)	Lucas
6171	Meadowview Site 3B	Abbeydale	Lucas
6172	Kempton Place	Baucor	Lucas
6173	The Lakes Unit 2811	African Kingdom Holdings	Lucas
6174	Siqalo Foods Phase 3	Archstone Construction (PTY) LTD	Lucas
6175	Golden Walk Entrance 1	Redefine	Sean
6176	Eastwood Village RSLPR_4008	RESPUBLICA	Mawesi
6177	Belcon Phase 2	Abbeycape	Geofrey
6178	V&A OCFM 	FRAMECORE CONSTRUCTION	Geofrey
6179	KDHS Hall	Direct	Temba
6180	Crusaders Reception Wall	Direct	Lucas
6181	KG Mall	MLC	Temba
6182	LDS Birch Acres Meeting House	Millcon	Lucas
6183	The Fields	Baucor	Mawesi
6184	Mineralia	Redefine	Sean
6185	Stoneridge Waterproofing Gutters and Flat Roofs	Redefine	Sean
6186	Stand 4126 Blue Valley 	Direct	Nic
6187	Heineken Cellar Springs	Archstone Construction (PTY) LTD	Lucas
6188	Ermelo Game Centre Walkway Canopy	Broll	Sean
6189	Waterfall Walk	MBC	Nic
6190	Boca Raton Unit 3	JTDooley	Owen
6191	106 16th Road Midrand	Redefine	Sean
6192	LDS Benoni Cultural Hall	Millcon	Lucas
6193	Tiber Head Office	Tiber	Owen
6194	Silky Oaks	Redefine	Owen
6195	Ravenscraig Student Apartments	W3O	Geofrey
6196	Empire Place Show Unit	Barrow	Lawrence
6197	Waterkloof on Main Remedial	Jovan	Mawesi
6198	SC Shop 211	Metrum	Griffith
6199	Saratoga Gym	RESPUBLICA	Lawrence
6200	Bosch PO000667	Direct	Lucas
6201	BMW Central Lab Rosslyn	RICP	Mawesi
6202	BP Waterfall	Barrow	Cautious
6203	Stand 625 Lanseria	JTSon	Temba
6204	The Signature Type D	African Kingdom Holdings	Lucas
6205	Shoprite Skycity	Airwaves	Temba
6206	24 Kearney Avenue Sunninghill	Direct	Owen
6207	324 Ben Viljoen Str	Skystone	Mawesi
6208	Bidvest MH Facility	NDWALA(FARQUHARSON BEE)	Lucas
6209	40 15th Str Parkhurst	Direct	Owen
6210	165 Umkomaas Road 	Baucor	Mawesi
6211	Eastwood Village Exterior	RESPUBLICA	Mawesi
6212	FCP3952 Princeton Village RSLPR4974	RESPUBLICA	Cautious
6213	NTT Hoedspruit	Mikebuyskes	Nic
6214	Shambala Lodge	Metrum	Nic
6215	ISASA	Direct	Lawrence
6216	460 Hugo Street	MBC	Nic
6217	Toms Place 63 Eagle Canyon	Excelsus	Temba
6218	Kramerville MW Office & Kitchen	MADISON HOLDING	Lawrence
6219	Cure Day Hospital	True Prop	Nic
6220	Princeton Village Waterproofing Block K, H & B	RESPUBLICA	Nic
6221	Digistics Repaint	Abbeydale	Lucas
6222	The Galleries 	Farquharson Construction	Lawrence
6223	Metropolis On Park Unit 1206	Barrow	Owen
6224	Bosch PO0708	Direct	Lucas
6225	Ingrain Canteen and Ablutions	GDM Group	Thousand
6226	AIE Midrand	Farquharson Construction	Nic
6227	The Wedding Venue	African Kingdom Holdings	Lucas
6228	Roodevalley Premier Hotel	Jovan	Mawesi
6229	Laser Transport AGS	Jovan	Nic
6230	TEVO Warehouse	Abbeycape	Geofrey
6231	Unit 207 512 On Second	Direct	Owen
6232	4 Molenaar Avenue	Baucor	Lucas
6233	Dr FD Morar Room 115	Direct	Nic
6234	Iron Mountain	Bantry	Lucas
6235	FCP3982 Hatfield Square	Respublica	Mawesi
6236	62 4th ave Inanda	Tricolt	Owen
6237	Norwood Mall	Cavaleros	Lawrence
6238	Tiber Yard	Tiber	Thousand
6239	3 St Davids Place	JTDooley	Lawrence
6240	Domus Dei	Hexad	Owen
6241	Arterial Industrial Ph2	Abbeycape	Geofrey
6242	336 Rosemary Rd	GDM Group	Mawesi
6243	Stand 8 Eagle Canyon 	Excelsus	Temba
6244	N4 Gateway	DLR	Mawesi
6245	Darragh House 2024	JTDooley	Thousand
6246	Heineken Decanting	Bantry	Temba
6247	LXX Sandhurst Signage	Cavaleros	Lawrence
6248	Crusaders Ph2	Archstone Construction (PTY) LTD	Lucas
6249	21 St David	JTDooley	Lawrence
6250	Nissan Woodmead	JTSon	Owen
6251	12 St Davids	Direct	Lawrence
6252	Intaba	Bantry	Nic
6253	25 Merlot 2024	Bantry	Lucas
6254	Ellipse Ph3	Barrow	Cautious
6255	25 Greenside Rd	JTDooley	Lawrence
6256	Exemplar Phase 2	Mikebuyskes Construction	Nic
6257	1 Adelpracht Glen Erasmia	Direct	Lucas
6258	Irene Link Building C Marmoran	Direct	Nic
6259	Leon's Paint Supply	MBC	Nic
6260	Nicol Corner Baffles	JTDooley	Thousand
6261	Waterfall Islamic Institute Boundary	SRP Development	Cautious
6262	Blanton Villas Ph2	Excelsus	Mawesi
6263	Princeton Village Rooms	Respublica	Cautious 
6264	West City Rooms	Respublica	Mawesi
6265	Eastwood Village Rooms	Respublica	Mawesi
6266	Urban Nest Rooms	Respublica	Mawesi
6267	Saratoga Rooms	Respublica	Lawrence
6268	Yale Village Rooms	Respublica	Thousand
6269	Hertz Jet Park	GDM Group	Lucas
6270	16 Innes Road	Direct	Lucas
6271	Howick Close	Capex	Nic
6272	McCarthy Toyota Woodmead	JTSon	Owen
6273	House Mvundlela	Direct	Owen
6274	Jabulani Mall	Project Lab	Temba
6275	St Peters Napier Block	LV Projects	Owen
6276	Dr Sundas Room 215	Direct	Nic
6277	Netcare Pretoria East	JCRefurb	Mawesi
6278	The Fields Rooms	Respublica	Lawrence
6279	FCP4019 Princeton Village External	Respublica	Caut
6280	Irene Link Restaurant Signage Wall	PROBEST Projects (PTY) LTD	Nic
6281	Midstream Mediclinic Wards 	Direct	Nic
6282	Hertford Block A and Gatehouse 	Direct 	Nic
6283	5 Winston Corner 21526	Direct	Owen
6284	Cash Sales 2025 	FirstClass Projects	Sean
6285	Hazelwood 	GDM Group	Mawesi
6286	2 ST Davids 	Direct 	Lawrence
6287	Saxon Rovers 	FRAMECORE CONSTRUCTION	Geofrey
6288	The Apex	FirstClass Projects	Owen
6289	Leeuwfontein Crossing SC 	Mikebuyskes Construction	Nic
6290	Rent A Store 2025	Direct	Lawrence 
6291	Afrihost 2025	Baucor	Lawrence
6292	LDS Weltevreden 	Millennium Construction (Pty) Ltd	Temba
6293	EASTGATE TAXI RANK	BANTRY	Lucas
6294	CRC WITKOPPEN ROAD	Mikebuyskes Construction	Griff
6295	MIAS ANGLING BOKSBURG	SRP DEVELOPMENT	Lucas
6296	Kyalami Cnr SC Internal	RDF	Nic
6297	THE NICHE	DIRECT	Geofrey
6298	ARDAGH BELVILLE	Abbeycape	Geofrey
6299	Princeton Village Lower	GDM Group	Nic
6300	CLUB COMO 	JTDOOLEY	Owen
6301	St Peters Keys Pavillion	LV Projects	Owen
6302	SU WILGEHOF	W30	Geofrey
6303	HOUSE JESSOPS	DIRECT	Geofrey
6304	MELOTE REPAINTS	Mikebuyskes Construction	nic
6305	BMW TORQUE	RICP	Mawesi
6306	BARLOW PARK EARLY BIRD CRECHE	GDM	Owen
6307	60 GLEN HOVE ROAD	BARROW	Lawrence
6308	WBHO HEAD OFFICE	WBHO	Owen
6309	SOUTHDALE SC	DIRECT	Thousand
6310	ABBEYDALE CAPE OFFICES	Abbeycape	Geofrey
6311	ROYAL VIEWS REMEDIAL	Mikebuyskes Construction	Owen
6312	RIVERFIELDS X97	JTSON	Lucas
6313	COSMO BUSINESS PARK ERF 15	JTSON	Griffith
6314	8 ST MARKS	JTDOOLEY	Lawrence
6315	GLENHOVE ROAD BOUNDARY	Direct	Lawrence
6316	SANDTON GATE PHASE 2	Tiber 	Lawrence
6317	STAND 1235 WATERFALL	Abbeydale	Nic
6318	2 ST MARK	Direct	Lawrence
6319	DISCOVERY BUILDING	WBHO	Owen
6320	LIBERTY PROMENADE ROOFS	Origin	Sean
6321	29 SPIER ROAD	Bantry	Lucas
6322	MENLYN PLACE UNIT 111	DLR	Mawesi
6323	MIDSTREAM MAINTENANCE 2025	Direct	Nic
6324	FCP3652 KING DAVID VP	Direct	Temba
6325	PARKDENE SNAGS	TEKCENT	Lucas
6326	MIDSTREAM HOA	DIRECT	Nic
6327	THE LAKES UNIT 2613	AFRICAN KINGDOM HOLDING	LUCAS
6328	CITY CENTRE PH8 PTN20	WBHO	
6329	385 LONG AVENUE	LV Projects	Owen
6330	FCP4061 TAKEALOT	Direct	Lucas
6331	MONAGHAN FARM STAND 8	Baucor	Griff
6332	WESTEND BUILDING F 	Mikebuyskes Construction	nic
6333	LWS PHASE 3 REMEDIAL	Mikebuyskes Construction	nic
6334	114 OXFORD BLD2 EMERGENCY STAIRCASE	DIRECT	Lawrence
6335	EMANZINI	Curasure	temba
6336	9 ALYTH ROAD FOREST TOWN 2025	JTDOOLEY	Owen
6337	WE BUY CARS AND ISUZU GERMISTON	BANTRY	Thousand
6338	THE MONROE UNIT 21&55	Farquharson Construction	Lawrence
6339	TAKEALOT DC3 OFFICES	BANTRY	Lucas
6340	LDS FAMILY RESEARCH CENTRE	Millennium Construction (Pty) Ltd	Owen
6341	MIDSTREAM FINANCIAL OFFICES	DIRECT 	Nic
6342	MALL OF AFRICA	ATTACQ	Nic
6343	GOSCOR FIRE DAMAGE 	Abbeydale 	Cautious
6344	GOLDEN OAK HOUSE	REDEFINE	Owen
6345	NGALA LODGE	Mikebuyskes Construction	Nic
6346	DISCOVERY DOMESTIC LOUNGE 	FRAMECORE CONSTRUCTION	Geofrey
6347	18A SPIER ROAD	Bantry	Lucas
6348	STEYN PLACE FLOORS	CITY PROPERTY	Mawesi
6349	FORD SILVERTON REPAINTS	ABBEYDALE	Mawesi
6350	OLIVES AND PLATES WATERFALL	DIRECT	Nic
6351	GUGULETHU MALL	Broll	Geofrey
6352	TERACO JB5 DATA CENTRE	WBHO	Lucas
6353	HEINEKEN KEG LINE MAINTENANCE	BANTRY	Temba
6354	ARROW PARK 2025	ABBEYDALE	nic
6355	GARDEN WALK MALL	Mikebuyskes Construction	Geofrey
6356	EASTPORT SPEC 5	BANTRY	Lucas
6357	THE SIGNATURE TYPE H	AFRICAN KINGDOM HOLDING	Lucas
6358	THE HOUGHTON HOTEL	DIRECT	Thousand
6359	MEADOWVIEW SITE 5	Archstone Construction 	Lucas
6360	SHOPRITE MIDDELBURG	GDM	Temba
6361	NICOL CORNER 11TH FLOOR	JTDOOLEY	Thousand
6362	SEW EURODRIVE	Direct	Temba
6363	STRATA UNIT 12	Direct	Owen
6364	The Signature Type E Facade 	Tricolt	Lucas
6365	Fortress Lowlardia	Direct	Cautious
6366	12 Nautica	Abbeycape	Geofrey
6367	R300 Salvino	Abbeycape	Geofrey
6368	TFG CHLOORKOP	Abbeydale	Nic
6369	KK SHELVING	BANTRY	Thousand
6370	14 WYNDOVER ROAD	DIRECT	Geofrey
6371	WESKUS MALL CHECKERS	W30	Geofrey
6372	METHODIST HOMES BENONI	M&M CONSTRUCTION	Lucas
6373	THE CAPITAL MBOMBELA	DIRECT	Nic
6374	LAVENDER SQUARE 	HKAMPMAN 	Mawesi
6375	16 SPIER ROAD	BANTRY 	Lucas
6376	CIBAPAC WAREHOUSE	SKYSTONE	Thousand
6377	LIQUOR RUNNERS	Archstone Construction (PTY) LTD	LUCAS
6378	CRESTA STORAGE REDEC	DIRECT	OWEN
6379	BG MINIS	ISIPANI	Geofrey
6380	IRENE BUILDING D- FIRE DOORS	DIRECT	Nic
6381	St Johns Pre Prep School	JT DOOLEY	Lawrence
6382	10 Arabian Avenue 2025 	Baucor	Cautious
6383	BOSCH PO930,31&32	DIRECT	Lucas
6384	ADT	EXCELSUS	Temba
6385	DALE'S HOUSE	DIRECT	GEOFREY
6386	HOUSE KUUN	DIRECT	Griff
6387	CITY CENTRE ONE â€“ SHOP 101, 204 & 214	Metrum	Griff
6388	ST LUKES SCHOOL	NDWALA(FARQUHARSON BEE)	Thousand
6389	BOWMANS TERRACE	Millennium Construction (Pty) Ltd	Owen
6390	M&D OFFICES 2025	Murray and Dickson	Owen
6391	BONDEV CONSULTING ROOM 206	DIRECT	NIC
6392	PV WATERPROOFING BLOCK D-I&STUDY	RESPUBLICA	CAUTIOUS
6393	47 ST DAVIDS	DIRECT	Lawrence
6394	DARRAGH HOUSE ROOFS	JTDOOLEY	Thousand
6395	MEDICLINIC HELIPAD	DIRECT	Nic
6396	MELROSE MANNER CARE CENTRE	GDM	OWEN
6397	FCP4120 THE SIGNATURE TYPE E	AFRICAN KINGDOM HOLDING	Lucas
6398	ELLIPSE CLUBHOUSE	BARROW	CAUTIOUS
6399	9 ST DAVID	Direct	Lawrence
6400	4 ST DAVID	Direct	Lawrence
6401	39 ST DAVID	DIRECT	Lawrence
6402	WOODMEAD RETAIL	GROWTHPOINT	SEAN
6403	SEQUENCE LOGISTICS 2025	ABBEYDALE	Temba
6404	THE CAPITAL MENLYN MAINE REMEDIAL WORK	DIRECT	MAWESI
6405	THE PANTRY HAZELWOOD 	GDM	MAWESI
6406	LONGLAKES SPE 141	NDWALA(FARQUHARSON BEE)	Lucas
6407	KSB	HEXAD	Thousand
6408	EMOYENI MALL	Mikebuyskes Construction	Nic
6409	THE PRECINCT CHECKERS	Archstone Construction (PTY) LTD	Nic
6410	BUSINESS PARTNERS 	FRAMECORE CONSTRUCTION	Geofrey
6411	CCBSA PRETORIA WEST	DLR	Mawesi
6412	216A 70TH STREET BRADEL	DIRECT	LUCAS
6413	CHAMBERLAIN KYALAMI 2025	Mikebuyskes Construction	NIC
6414	UNIT 27 ST DAVIDS	DIRECT	Lawrence
6415	DAINFERN GOLF ESTATE STAND 2215	Bartosch Construction	Griff
6416	90 DEGREES REMEDIAL	Bantry	OWEN
6417	ST JOHNS PALISADE FENCE 	DIRECT	Lawrence
6418	UNIT 202 NORTHDENE	ABBEYDALE	Thousand
6419	35 CURZON ROAD BRYANSTON	DIRECT	OWEN
6420	Shoprite Riverfields Steel Gates 	DIRECT	Lucas
6421	CITY CENTRE PILATES STUDIO	Metrum	Griff
6422	KG MALL ROOFS	CAPITAL 	SEAN
6423	MOUTSE MALL ROOFS	CAPITAL 	SEAN
6424	ST JOHNS PRE PREP SCHOOL	JTDOOLEY	Lawrence
6425	R300 FOURWAYS AIR	ABBEYDALE	GEOFREY
6426	BROOKFIELDS PH4	Tricolt	Thousand
6427	FCP4128 PRINCTON VILLAGE ROOMS	RESPUBLICA	CAUTIOUS
6428	AIE GREENSIDE GROUND FLOOR	Farquharson Construction	OWEN
6429	73 DEAN STREET RONDEBOSCH 	FRAMECORE CONSTRUCTION	GEOFREY
6430	DISTRICT FIT	DIRECT	OWEN
6431	FOUNDERS HILL -MAN FINANCIAL	Tiber	Thousand
6432	IMPERIAL	Farquharson Construction	Lucas
6433	UNIT 924 GREENSTONE RIDGE	JTDOOLEY	Lucas
6434	UNIT 147 VIA POLLINO, DOUGLASDALE	JTDOOLEY	OWEN
6436	KYALMI CORNER MCDONALDS	REDEFINE	NIC
6435	SEW EURODRIVE AEROTON	ABBEYDALE	TEmba
6437	TCG PHASE 2	ABBEYDALE	GEOFREY
6438	MOTHERKIND	DIRECT	OWEN
6439	CITY PARK OWL APARTMENTS	WBHO	GEOFREY
6440	HEALTH CONNECT	Baucor	Mawesi
6441	PRINCETON VILLAGE WATERPROOFING BLOCK D,F,G,I,STUDY	RESPUBLICA	NIC
6442	LP9 WH3 SINOTILE	Archstone Construction (PTY) LTD	CAUTIOUS
6443	ST JOHNS AEA SOUTH	DIRECT	Lawrence
6444	ST JOHNS NURSERYSCHOOL	DIRECT	Lawrence
6445	PHINDA STAFF ACCOMODATION	Mikebuyskes Construction	NIC
6446	CEREAL AND MALT INDUSTRIA	M&M CONSTRUCTION	Temba
6447	FCP4153 -FRONT RUNNER	DIRECT	Nic
6448	SAKATA EXISTING OFFICE REFURB	JOVAN	Griff
6449	47 ST DAVIDS COTTAGE	JTDOOLEY	Lawrence
6450	ONE ROSEBANK PHASE2	BARROW	Lawrence
6451	WOOLWORTHS DC PHASE2	Abbeydale	CAUTIOUS
6452	46 VALLEY ROAD	BARROW	Lawrence
6453	PFERD	BANTRY 	Lucas
6454	UNIT 203 THE NICHE	DIRECT	Geofrey
6455	SKY COLLEGE BLOCK B	Farquharson Construction	Temba
6456	YALE VILLAGE	RESPUBLICA	Thousand
6457	204 OXFORD	BJV	Owen
6458	7 BLACK PALMER CRESCENT	Tiber	Nic
6459	HOUSE SHABALALA	DIRECT	Nic
6460	PROTEA VILLAGE	FRAMECORE CONSTRUCTION	GEOFREY
6461	CITY CENTRE PH8 PTN22	WBHO	Griff
6462	25 FRENCH LANE	DIRECT	OWEN
6463	MEDICLINIC KLOOF 2025	DIRECT	Mawesi
6464	CHECKERS LEPHALALE	GDM	NIC
6465	PICK N PAY HENDRINA	BEURDEN	Temba
6466	SAPPI	BARROW	Lawrence
6467	FCP4167 PRINCETON VILLAGE	RESPUBLICA	CAUTIOUS
6468	SACS INDOOR CRICKET	FRAMECORE CONSTRUCTION	Geofrey
6469	SHOPRITE WALTER SISULU ROAD	GDM	Temba
6470	UNIT 114 THE KANYIN	Baucor	Nic
6471	GATEWAY EAST WATERFFALL CITY	Archstone Construction (PTY) LTD	Nic
6472	NH SANDTON	DIRECT	OWEN
6473	THE FIELDS 2025	RESPUBLICA	Lawrence
6474	INCOMAR AERONAUTICS	Abbeydale 	Mawesi
6475	GPM Krishna 	Abbeydale 	Thousand
6476	WATCH TOWER HILLBROW	DIRECT	Thousand
6477	UNIT 1 SANDTON VIEW ESTATE	JTDOOLEY	OWEN
6478	THE SIGNATURE PH1 UNIT 19	AFRICAN KINGDOM HOLDING	Lucas
6479	DHL WATERFALL 2025	ABBEYDALE	NIC
6480	VEGA 2025	ABBEYDALE	griff
6481	The Crossing 2025	Bantry	Owen
6482	6 LIBERTAS GLEN ERASMIA	direct	Lucas
6483	BOSCH PO001063	DIRECT	Lucas
6484	5 ASH STREET	JTDOOLEY	Lawrence
6485	102A RUTLAND AVENUE 	Direct	Craig
6486	OTTEN RESIDENCE	DIRECT	OWEN
6487	ALBERTON CITY GAME CONVERSION	Millennium Construction (Pty) Ltd	Thousand
6488	SIGNATURE PH1 UNIT 19 EXTERIOR	DIRECT	Lucas
6489	HOERSKOOL WATERKLOOF	GDM	Mawesi
6490	SANDTON LINK BRIDGE	PROBEST	Owen
6491	16 QUINN STREET PARKHURST	Tricolt	Lawrence
6492	WEST CITY PO 02919&02920	RESPUBLICA	MAWESI
6493	FCP4162- JSH	DIRECT	Temba
6494	BHBW WAREHOUSE AND OFFICES	JTSON	Lucas
6495	PICK N PAY HAZELDEAN	DIRECT	MAWESI
6496	GARDEN COURT ISANDO	WBHO	Lucas
6497	HOUSE HARILAL	EXCELSUS	Temba
6498	SAN SERENO	EXCELSUS	OWEN
6499	YALE VILLAGE GATE HOUSE	EXCELSUS	Thousand
6500	BIDVEST PROTEACOIN	BANTRY	OWEN
6501	SUPER GROUP	ABBEYDALE	GEOFREY
6502	PTA BOYS HIGH 	GDM	Mawesi
6503	JACKAL CREEK KFC	DIRECT	Temba
6504	3 LECHWE SERENGETI	Abbeydale	Lucas
6505	STEYN CITY DOORS	SRP	Temba
6506	4 VILJOEN STREET	Mikebuyskes Construction	NIC
6507	G FOX	Kumkanikulani	Thousand
6508	2 ST DAVIDS COTTAGE	JTDOOLEY	Lawrence 
6509	MIDSTREAM MEDICLINIC ROOM 212	DIRECT	NIC
6510	WE BUY CARS CPT	ABBEYDALE	GEOFREY
6511	ETWATWA CROSSING	Mikebuyskes Construction	NIC
6512	EASTPORT SIGNAGE WALL	DIRECT	LUCAS
6513	RHENUS WAREHOUSE KLERKSDORP	BANTRY	Temba
6514	HOUSE VELI	BANTRY	Temba
6515	UNIT 9 SOLEIL COMPLEX	DIRECT	OWEN
6516	CRUISE TERMINAL	FRAMECORE CONSTRUCTION	GEOFREY
6517	POSTHOUSE LINK	REDEFINE	Owen
6519	3B MEADOWVIEW	DIRECT	Lucas
6520	COMMERCE SQUARE	REDEFINE	Owen
6521	BIDVEST BURCHMORES	Kumkanikulani	Owen
6522	SPEAK EASY	GDM	Owen
6523	MIDSTREAM MEDICLINIC EXTERNAL WALL	DIRECT	NIC
6524	COSNOVA	DIRECT	TSHEPO
6525	RIVERFIELDS X57	NDWALA	Lucas
6526	Metropolis on Park Unit 211 	BARROW	OWEN
6527	PARK CENTRAL EAST WALL	Direct	Lawrence 
6528	FERREIRA RESIDENCE	JCREFURB	CAUTIOUS
6529	FCP 4219- MERINO MALL	Mikebuyskes Construction	NIC
6530	HOUSE BOTHA	BARROW	GEOFREY
6531	THE CAPITAL ON PARK	DIRECT	OWEN
6532	KAREN PARK	HEXAD	Mawesi
6533	RANDBURG SQUARE	BROLL	SEAN
6534	MIDSTREAM MEDICLINIC MEDICAL WARD	Direct	NIC
6535	NETCARE REHAB CENTRE	JCREFURB	Lawrence
6536	ZUKA LODGE	Mikebuyskes Construction	NIC
6537	CURRO WATERFALL	DIRECT	NIC
6538	CSIR BUILDING 15	JTDOOLEY	Mawesi
6539	WEST CITY PO03491	RESPUBLICA	Mawesi
6540	WEST CITY PO03311	RESPUBLICA	Mawesi
6541	CURRUSEAL BOKSBURG	ABBEYDALE	Lucas
6542	DHL METSO 	Farquharson Construction	Lucas
6543	LIBERTY CANTEEN	ABE	Thousand
6544	WONDERBOOM CARVENIENCE	EXCELLERATE JHI	Mawesi
6545	BIDVEST INTERNATIONAL	Kumkanikulani	Lucas
6546	37 DOUGLAS ROAD	JTDOOLEY	Owen
6547	NETCARE N17	JCREFURB	Lucas
6548	URBAN NES BATHROOM CEILINGS	RESPUBLICA	Mawesi
6549	OLIVETTI HOUSE LOBBY	BAUCOR	Mawesi
6550	BODY 20 RIVERLANDS	Direct	TSHEPO
6551	ISLAMIC INSTITUTE MOSQUE	SRP	Cautious
6552	HOUSE VILJOEN 	EXCELSUS	Mawesi
6553	SUN ADMIN A	W3O	GEOFREY
6554	MALL OF AFRICA REPAINTS	BAUCOR	CAUTIOUS
6555	WATERFALL CIRCLE REMEDIAL	BAUCOR	NIC
6556	FCP4207 HORIZON SC	REDEFINE	GRiff
6557	RIVERLANDS 2A EAST	WBHO	TSHEPO
6558	AO EXPANSION	BANTRY	Griff
6559	THULAMAHASHE	DIRECT	NIc
6560	27 CLARADALE	DIRECT	Mawesi
6561	TRILOGY PH1 16TH FLOOR	Menlyn Maine	Mawesi
6562	HPE AFRICA	EXCELSUS	Lucas
6563	NETCARE KRUGERSDORP	JCREFURB	TEMba
6564	PC UNIT 1804	DIRECT	Lawrence
6465	KNOCKANDO RES	ABE	Lawrence
6566	ACORNHOEK	Direct	Nic
6567	IRENE LINK BUILDING C 2025	PROBEST	NIC
6568	CITY CENTRE PTN17	WBHO	GRiff
6569	14 ST DAVIDS	DIRECT	Lawrence 
6570	UNIT 34 CENTRAL PARK	DIRECT	TEmba
6571	ABE OFFICES	ABE	Temba
6572	CROSSROADS SCHOOL	M&M	Temba
6573	FLEURHOF MALL	Mikebuyskes Construction	Nic
6574	SIGNATURA	DRACON	TSHEPO
6575	THE HOMAGE	BAUCOR	Thousand
6576	HAVAL MIDRAND 2ND SHOW ROOM	Whip Retail	CAUTIOUS
6577	THE PRECINCT SHOP 43	DIRECT	NIC
6578	BHC DOOR REPLACEMENT	Direct	OWEN
6579	GATEWAY CNR FOOD LOVERS	REDEFINE	NIC
6580	MBC YARD	Mikebuyskes Construction	caUTIOUS
6581	HERTFORD BUILDING D	DIRECT	NIC
6582	MENLYN MERCEDES BENZ	Kumkani Khulani Contracting	Mawesi
6583	HOUSE MORRIS 	Abbeydale	Geofrey
6584	LERATONG CITY MALL	Mikebuyskes Construction	Temba
6585	LEGENDS SAFARI WOODMEAD	SRP	caUTIOUS
6586	DIMAKO TRANDFORMERS	Archstone Construction (PTY) LTD	Temba
6587	SPRINGVALE PRIMARY SCHOOL	JOVAN	CAUTIOUS
6588	FCP4190 FORD SILVERTON	Direct	Mawesi
6589	MONTE CIRCLE BUILDING A	Direct	OWEN
6590	MIDRAND WAREHOUSE 5 OFFICES	SKYSTONE	CAUTIOUS
6591	MERCEDES CENTURION	Kumkani Khulani Contracting	CAUTIOUS
6592	6 12TH AVENUE PARKHURST	JTDOOLEY	Lawrence 
6593	EPX KUILS RIVER	Abbeydale	GEOFREY
6594	ROSCOMMON HOUSE 	RESPUBLICA	GEOFREY
6595	RACE SANDTON	JTDOOLEY	Lawrence
6596	ITALTILE BRYANSTON	PROBEST	OWEN
6597	RIETVLEI BUSINESS PARK 	Archstone Construction (PTY) LTD	CAUTIOUS
6598	HATFIELD SQUARE	EXCELSUS	Mawesi
6600	UNIT 176, 4 POPLAR AVENUE BROAD ACRES	Abbeydale	Griff
6601	THE REGENCY 2025	DIRECT	Mawesi
6602	M&D HO	M&D	OWEN
6603	LITEGLO WAREHOUSE	Farquharson Construction	Griff
6604	WE BUY CARS 2025	BANTRY	Thousand
6605	BREDELL SPEC WAREHOUSE	NDWALA	LUCAS
6606	INDUS MENLYN	BARROW	Mawesi
6607	SAPPHIRE WAREHOUSE	JOVAN	Geofrey
6608	STAND 2458 MIDLANDS ESTATE 2025	Archstone Construction (PTY) LTD	NIC
6609	UNIT S608	DRACON	TSHEPO
6610	57 6TH STREET PARKHURST	DIRECT	OWEN
6611	SERENGETI CLUBHOUSE ABLUTIONS	AFRICAN KINGDOM HOLDING	Lucas
6612	HOUSE HUNTER	DIRECT	OWEN
6613	HARBOUR ARCH	WBHO	TSHEPO
6614	TOYOTA HINO DEALERSHIP	Kumkani Khulani Contracting	CAUTIOUS
6615	86 18TH STREET PARKHURST	DIRECT	SEAN
6616	OXGLEN BUILDING 2 PARAPET WATERPROOFING	DIRECT	Lawrence
6617	MOTUS HO PH2	W30	Thousand
6618	KATHERINE TOWERS	DIRECT	OWEN
6619	CITY CENTRE PHASE 8 PTN21	WBHO	Griff
6620	ENSTRA 2025	Abbeydale	LUCAS
6621	EDENGLEN PRIMARY SCHOOL	EXCELSUS	LUCAS
6622	PARC NICOL FAÃ‡ADE REFURB	BARROW	OWEN
6623	THE SIGNATURE UNIT 118	Tricolt	Lucas
6624	B SURE INSURANCE	JTDOOLEY	Thousand
6625	BARLOW WORLD ISANDO	Abbeydale	LUCAS
6626	JOSHUA GEN CHURCH PH2	FRAMECORE CONSTRUCTION	Geofrey
6627	CATERPILLAR	BANTRY	LUCAS
6628	DATA SCIENCE 2025	BAUCOR	OWEN
6629	40 15TH STREET PARKHURST	DIRECT	OWEN
6630	HOUSE WOOD MONAGHAN FARM	BAUCOR	Griff
6631	HOUSE BLOEMHOF	Mikebuyskes Construction	NIC
6632	ONE ROSEBANK MAINTENANCE 	Direct	Lawrence
6633	PV BLOCK P	EXCELSUS	CAUTIOUS
6634	THUTHUKA PACKING DIE CUTTER	Archstone Construction (PTY) LTD	Thousand
6635	THE PRECINCT INTERCARE	Archstone Construction (PTY) LTD	NIC
6636	EASTWOOD DEC 2025	RESPUBLICA	Mawesi
6637	AIE GREENSIDE TOP FLOOR	Farquharson Construction	OWEN
6638	142 MULBERRY LANE 2025	LIBERA	OWEN
6639	THE TERRACE	Tiber	Lawrence
6640	URBAN NEST DEC 2025	RESPUBLICA	Mawesi
6641	HATFIELD SQUARE DEC 2025	RESPUBLICA	Mawesi
6642	WEST CITY DEC 2025	RESPUBLICA	Mawesi
6643	iTONKA SQUARE PH3	Mikebuyskes Construction	Lucas
6644	PV DEC 2025	RESPUBLICA	CAUTIOUS
6645	CHAMBERLAIN RANDBURG 2025	Millennium Construction (Pty) Ltd	OWEN
6646	SARATOGA DEC 2025	RESPUBLICA	Lawrence
6647	HEINEKEN SPRINGS	Abbeydale	Lucas
6648	ST JOHNS NEW OFFICE	JTDOOLEY	Lawrence
6649	STEINWEG 2025	BANTRY	Thousand
6650	JOHAN RESIDENCE	Abbeydale	Geofrey
6651	RICARDO RESIDENCE	WBHO	TSHEPO
6652	17 SUTHERLAND AVENUE	DIRECT	SEAN
6653	2 ARNOLD ROAD,ROSEBANK	DIRECT	OWEN
6654	CAMPUS COLLEGE 1ST-6TH FLOOR BATHROOMS	ABE	Lawrence
6655	BROOKLYN PAVILION	EXCELSUS	Mawesi
6656	KEMPTON PLACE 2026	BAUCOR	Lucas
6657	MIDSTREAM MEDICLINIC THEATRE	DIRECT	CAUTIOUS
6658	CHAMBERLAIN EASTRAND	Mikebuyskes Construction	Lucas
6659	ST JOHNS DRAMA ROOM	JTDOOLEY	Lawrence
6660	5 ST MARKS 2026	JTDOOLEY	Lawrence
6661	THE FIELDS STEEL STRUCTURE	EXCELSUS	Lawrence
6662	MIDRAND HQ SERVICES HQ	BANTRY	NIC
6663	RIETVLEI BP -RUGGED SA	Archstone Construction (PTY) LTD	NIC
6664	RIETVLEI BP -PACKAGE IT 	Archstone Construction (PTY) LTD	NIC
6665	ARCHSTONE OFFICES	Archstone Construction (PTY) LTD	Mawesi
6666	ATLANTIC HILLS SITE C	Abbeydale	Geofrey
6667	SASANI AFRICA	Rocon	Owen
6668	KYALAMI CORNER INTERIOR	REDEFINE	NIC
6669	HURLINGHAM GATE	DIRECT	owEN
6670	ST JOHNS ADMIN OFFICE	DIRECT	Lawrence
6671	AGRI PARK STELLENBOSCH	STRIVE	Geofrey
6672	BELA MALL SIGNAGE	JRD ENGINEERING	Nic
6673	41 SANET STR	Millennium Construction (Pty) Ltd	Owen
6674	7 VAAL RD	TRICOLT	Owen
6675	RENBRO HAMMANSKRAAL	BROLL	Mawesi
6676	7 ORCHARDS	Direct	Sean
6677	83 Protea	Bartosch Construction	Owen
6678	AISJ	JOVAN	Griff
6679	CULROSS BUILDING 7	BARROW	OWEN
6680	VLEI LODGE PHINDA	Mikebuyskes Construction	NIC
6681	BOSCH PO001306	DIRECT	LUCAS
6682	MIDRAND WAREHOUSE 7	SKYSTONE	NIC
6683	WONDERBOOM JUNCTION KIA &AXE	RETNING	Mawesi
6684	ADAMS &ADAMS	ATTAQ	SEAN
6685	RENT A STORE 2026	DIRECT	Lawrence
6686	SAKATA SVR OFFICES &CANTEEN	JOVAN	Griff
6687	67 KINGS DRIVE EDENVALE	BAUCOR	LUCAS
6688	AIRPORT STRATEGIC PARK	LIBERA	LUCAS
6689	DAINFERN STAND 2252	Bartosch Construction	Griff
6690	HILL ON EMPIRE	DIRECT	Thousand
6691	CITY CENTRE SHOP108, 109 -DR'S ROOMS	METRUM	Griff
6692	220 PETER AVENUE LINMEYER	Abbeydale	Thousand
6693	19 CEDAR WOOD, NEWLANDS	BARROW	TSHEPO
6694	SANDTON GATE PH1	DIRECT	Lawrence
6695	CLIPPA SALES	Abbeydale	Geofrey
6696	GEORGE HERWELL RES	DIRECT	Griff
6697	ETWATWA SHOPRITE DUCTING	AIRWAVES	NIC
6698	THE SIGNATURE UNIT 192	DIRECT	LUCAS
6699	SAKATA LABS	JOVAN	Griff
6700	FLENDER 2026	Abbeydale	LUCAS
6701	14 LADIES MILE CONSTATIA CPT	DIRECT	SEAN
6702	MIDSTREAM MEDICLINIC COMMON AREAS	DIRECT	NIC
6703	Castle Gate Mall Shop 47	EXCELSUS	Mawesi
6704	43 CHESHAM INTERIOR	Millennium Construction	Owen
6705	SC PTN 23 PERGOLA	METRUM	Griff
6706	IBP CONSTRUCTION	DIRECT	NIC
6707	TIBER WAREHOUSE	Tiber	Thousand
6708	NSIR HOUTBAY	FRAMECORE CONSTRUCTION	Geofrey
6709	CAR TRACK TOUCH UPS	TIBER	Lawrence
6710	HEREFORD COMPLEX	DIRECT	NIC
6711	THE SIGNATURE UNIT 11	AFRICAN KINGDOM HOLDING	LUCAS
6712	BARROW YARD	BARROW	Lawrence
6713	UNITS ON MAIN	Abbeydale	Geofrey
6714	MANN ROAD WAREHOUSE	NDWALA	NIC
6715	35 LINDEN ROAD BRAMLEY	DIRECT	Thousand
6716	KINGS WALK MALL	Mikebuyskes Construction	NIC
6717	JTDOOLEY OFFICES	JTDOOLEY	OWEN
6718	ATLANTIC HILLS AFCOM TI	Abbeydale	Geofrey
6719	BLANTON VILLAS PH3	DIRECT	Mawesi
`;

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main(): Promise<void> {
  console.log("=== Seed: Missing Sites & Supervisor Assignments ===\n");

  // 1. Parse raw rows
  const rawRows = parseRows(RAW_SITE_ROWS);
  console.log(`Parsed ${rawRows.length} raw rows.\n`);

  // 2. Resolve supervisor names â†’ keys
  const resolved: ResolvedSiteRow[] = [];
  for (const row of rawRows) {
    const key = normalizeSupervisorName(row.supervisorRaw);
    if (!key) {
      manualReview.push({
        reason: "unknown supervisor name",
        row,
        details: `raw supervisorName="${row.supervisorRaw}"`,
      });
      continue;
    }
    resolved.push({
      ...row,
      supervisorKey: key,
      supervisorId: SUPERVISOR_IDS[key],
    });
  }

  console.log(
    `Resolved ${resolved.length} rows. ${manualReview.length} already flagged for manual review.\n`,
  );

  // 3. Verify supervisor records exist in DB
  const uniqueSupervisorIds = [...new Set(resolved.map((r) => r.supervisorId))];
  const existingSupervisors = await prisma.supervisor.findMany({
    where: { id: { in: uniqueSupervisorIds } },
    select: { id: true },
  });
  const existingSupervisorIdSet = new Set(existingSupervisors.map((s) => s.id));
  const missingSupervisorIds = uniqueSupervisorIds.filter(
    (id) => !existingSupervisorIdSet.has(id),
  );
  if (missingSupervisorIds.length > 0) {
    console.error(
      `FATAL: These supervisor IDs do not exist in the DB: ${missingSupervisorIds.join(", ")}`,
    );
    process.exit(1);
  }
  console.log(
    `All ${existingSupervisors.length} supervisor IDs verified in DB.\n`,
  );

  // 4. Process each resolved row: ensure site, then ensure assignment
  for (let i = 0; i < resolved.length; i++) {
    const row = resolved[i];
    if ((i + 1) % 100 === 0) {
      console.log(`  Processing row ${i + 1}/${resolved.length}...`);
    }

    try {
      const siteId = await ensureSite(row);
      if (!siteId) {
        skippedAssignments++;
        continue;
      }

      await ensureSupervisorAssignment(siteId, row.supervisorId, row);
    } catch (rowErr: any) {
      const errMsg = `Error at row ${i + 1} (code=${row.code}, name=${row.name}): ${rowErr?.message}\n${rowErr?.stack}`;
      fs.appendFileSync("seed-error.log", errMsg + "\n\n", "utf-8");
      manualReview.push({
        reason: "db error",
        row,
        details: rowErr?.message,
      });
    }
  }

  // 5. Summary
  console.log("\n=== Summary ===");
  console.log(`Total raw rows parsed:       ${rawRows.length}`);
  console.log(`Resolved rows:               ${resolved.length}`);
  console.log(`Created sites:               ${createdSites}`);
  console.log(`Reused sites:                ${reusedSites}`);
  console.log(`Updated sites:               ${updatedSites}`);
  console.log(`Created assignments:         ${createdAssignments}`);
  console.log(`Skipped assignments:         ${skippedAssignments}`);
  console.log(`Manual review items:         ${manualReview.length}`);

  if (manualReview.length > 0) {
    console.log("\n=== Manual Review (first 50) ===");
    const toShow = manualReview.slice(0, 50);
    for (let i = 0; i < toShow.length; i++) {
      const mr = toShow[i];
      console.log(
        `  [${i + 1}] reason: ${mr.reason}` +
          `  | code=${mr.row.code ?? ""}` +
          `  | name=${mr.row.name ?? ""}` +
          `  | supervisor=${mr.row.supervisorRaw ?? ""}` +
          (mr.details ? `  | details: ${mr.details}` : ""),
      );
    }
    if (manualReview.length > 50) {
      console.log(`  ... and ${manualReview.length - 50} more.`);
    }
  }

  // Write summary to file for reliable capture
  const summaryObj = {
    totalRawRows: rawRows.length,
    resolvedRows: resolved.length,
    createdSites,
    reusedSites,
    updatedSites,
    createdAssignments,
    skippedAssignments,
    manualReviewCount: manualReview.length,
    manualReview: manualReview.slice(0, 100),
  };
  fs.writeFileSync(
    "seed-summary.json",
    JSON.stringify(summaryObj, null, 2),
    "utf-8",
  );
  console.log("\nSummary written to seed-summary.json");
}

main()
  .catch((err) => {
    const msg = `Fatal error: ${err?.message ?? err}\n${err?.stack ?? ""}`;
    console.error(msg);
    fs.writeFileSync("seed-error.log", msg, "utf-8");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
