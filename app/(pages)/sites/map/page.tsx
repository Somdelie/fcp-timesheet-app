import SitesMap, { SiteMapMarker } from "@/components/sites/SiteMap";

const SAMPLE_SITES: SiteMapMarker[] = [
  {
    id: "1",
    name: "Johannesburg Hub",
    code: "JHB-01",
    lat: -26.2041,
    lng: 28.0473,
    region: "Gauteng",
    status: "active",
  },
  {
    id: "2",
    name: "Cape Town Station",
    code: "CPT-02",
    lat: -33.9249,
    lng: 18.4241,
    region: "Western Cape",
    status: "active",
  },
  {
    id: "3",
    name: "Durban Terminal",
    code: "DBN-03",
    lat: -29.8587,
    lng: 31.0218,
    region: "KwaZulu-Natal",
    status: "warning",
  },
  {
    id: "4",
    name: "Pretoria Operations",
    code: "PTA-04",
    lat: -25.7461,
    lng: 28.2313,
    region: "Gauteng",
    status: "active",
  },
  {
    id: "5",
    name: "Port Elizabeth Depot",
    code: "PE-05",
    lat: -33.9841,
    lng: 25.6084,
    region: "Eastern Cape",
    status: "error",
  },
  {
    id: "6",
    name: "Bloemfontein Base",
    code: "BFN-06",
    lat: -29.1088,
    lng: 25.5184,
    region: "Free State",
    status: "active",
  },
  {
    id: "7",
    name: "Pietermaritzburg Center",
    code: "PMB-07",
    lat: -29.6252,
    lng: 30.3883,
    region: "KwaZulu-Natal",
    status: "active",
  },
  {
    id: "8",
    name: "Polokwane Office",
    code: "PLK-08",
    lat: -23.9012,
    lng: 29.4197,
    region: "Limpopo",
    status: "active",
  },
  {
    id: "9",
    name: "Nelspruit Facility",
    code: "NEL-09",
    lat: -25.4833,
    lng: 30.9667,
    region: "Mpumalanga",
    status: "warning",
  },
];

export default function SitesMapPage() {
  return <SitesMap sites={SAMPLE_SITES} />;
}
