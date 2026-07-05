/**
 * Big Fonts Pack — Next.js (next/font/google)
 * -----------------------------------------------------------------
 * 69 Google Fonts, self-hosted at build time via next/font.
 * Organized by category: Sans Serif, Serif, Display, Handwriting, Monospace, Decorative.
 *
 * Note: proprietary/licensed fonts exclusive to design tools like Canva
 * (e.g. Knockout family, Kaze, London) aren't on Google Fonts and can't
 * be self-hosted this way — the picks below are free equivalents covering
 * the same style range.
 *
 * Usage (app/layout.tsx):
 *   import { inter, playfairDisplay, bebasNeue } from './fonts';
 *   <html className={`${inter.variable} ${playfairDisplay.variable} ${bebasNeue.variable}`}>
 */

import {
  Abril_Fatface,
  Alfa_Slab_One,
  Amatic_SC,
  Anton,
  Archivo_Black,
  Baloo_2,
  Bangers,
  Bebas_Neue,
  Bitter,
  Bungee,
  Caveat,
  Chewy,
  Comfortaa,
  Cormorant_Garamond,
  Courgette,
  Creepster,
  Crimson_Text,
  DM_Sans,
  Dancing_Script,
  Domine,
  EB_Garamond,
  Faster_One,
  Fira_Code,
  Fjalla_One,
  Fredoka,
  Great_Vibes,
  IBM_Plex_Mono,
  Indie_Flower,
  Inter,
  JetBrains_Mono,
  Kalam,
  Karla,
  Lato,
  League_Gothic,
  Libre_Baskerville,
  Lora,
  Luckiest_Guy,
  Manrope,
  Merriweather,
  Monoton,
  Montserrat,
  Mulish,
  Noto_Serif,
  Nunito,
  Open_Sans,
  Oswald,
  Outfit,
  PT_Serif,
  Pacifico,
  Passion_One,
  Permanent_Marker,
  Playfair_Display,
  Poppins,
  Press_Start_2P,
  Righteous,
  Roboto,
  Roboto_Mono,
  Rubik,
  Sacramento,
  Satisfy,
  Shadows_Into_Light,
  Sora,
  Source_Code_Pro,
  Source_Serif_4,
  Space_Grotesk,
  Space_Mono,
  Staatliches,
  Titan_One,
  Work_Sans,
} from "next/font/google";

// ---- Sans Serif ----
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
export const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});
export const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-open-sans",
  display: "swap",
});
export const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
  display: "swap",
});
export const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
export const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
});
export const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-work-sans",
  display: "swap",
});
export const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-rubik",
  display: "swap",
});
export const mulish = Mulish({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-mulish",
  display: "swap",
});
export const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-karla",
  display: "swap",
});
export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});
export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-manrope",
  display: "swap",
});
export const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});
export const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

// ---- Serif ----
export const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-merriweather",
  display: "swap",
});
export const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-playfair-display",
  display: "swap",
});
export const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-lora",
  display: "swap",
});
export const ptSerif = PT_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-serif",
  display: "swap",
});
export const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});
export const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-libre-baskerville",
  display: "swap",
});
export const crimsonText = Crimson_Text({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-crimson-text",
  display: "swap",
});
export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-eb-garamond",
  display: "swap",
});
export const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});
export const bitter = Bitter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-bitter",
  display: "swap",
});
export const domine = Domine({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-domine",
  display: "swap",
});
export const notoSerif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-serif",
  display: "swap",
});

// ---- Display ----
export const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas-neue",
  display: "swap",
});
export const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
  display: "swap",
});
export const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-oswald",
  display: "swap",
});
export const leagueGothic = League_Gothic({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-league-gothic",
  display: "swap",
});
export const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-archivo-black",
  display: "swap",
});
export const alfaSlabOne = Alfa_Slab_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-alfa-slab-one",
  display: "swap",
});
export const passionOne = Passion_One({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-passion-one",
  display: "swap",
});
export const fjallaOne = Fjalla_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-fjalla-one",
  display: "swap",
});
export const abrilFatface = Abril_Fatface({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-abril-fatface",
  display: "swap",
});
export const righteous = Righteous({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-righteous",
  display: "swap",
});
export const bungee = Bungee({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bungee",
  display: "swap",
});
export const bangers = Bangers({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bangers",
  display: "swap",
});
export const staatliches = Staatliches({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-staatliches",
  display: "swap",
});
export const titanOne = Titan_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-titan-one",
  display: "swap",
});
export const luckiestGuy = Luckiest_Guy({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-luckiest-guy",
  display: "swap",
});
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// ---- Handwriting ----
export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-caveat",
  display: "swap",
});
export const pacifico = Pacifico({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pacifico",
  display: "swap",
});
export const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-dancing-script",
  display: "swap",
});
export const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-great-vibes",
  display: "swap",
});
export const sacramento = Sacramento({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-sacramento",
  display: "swap",
});
export const satisfy = Satisfy({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-satisfy",
  display: "swap",
});
export const kalam = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-kalam",
  display: "swap",
});
export const shadowsIntoLight = Shadows_Into_Light({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-shadows-into-light",
  display: "swap",
});
export const indieFlower = Indie_Flower({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-indie-flower",
  display: "swap",
});
export const amaticSc = Amatic_SC({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-amatic-sc",
  display: "swap",
});
export const permanentMarker = Permanent_Marker({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-permanent-marker",
  display: "swap",
});
export const courgette = Courgette({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-courgette",
  display: "swap",
});

// ---- Monospace ----
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
export const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto-mono",
  display: "swap",
});
export const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-source-code-pro",
  display: "swap",
});
export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
export const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});
export const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-fira-code",
  display: "swap",
});

// ---- Decorative ----
export const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});
export const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-baloo2",
  display: "swap",
});
export const comfortaa = Comfortaa({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-comfortaa",
  display: "swap",
});
export const chewy = Chewy({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-chewy",
  display: "swap",
});
export const creepster = Creepster({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-creepster",
  display: "swap",
});
export const pressStart2p = Press_Start_2P({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-press-start2p",
  display: "swap",
});
export const monoton = Monoton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-monoton",
  display: "swap",
});
export const fasterOne = Faster_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-faster-one",
  display: "swap",
});

export const signatureFontCategories = [
  "Handwriting",
  "Corporate",
  "Display",
] as const;

export const signatureFontOptions = [
  { name: "Caveat", category: "Handwriting", className: caveat.className },
  { name: "Pacifico", category: "Handwriting", className: pacifico.className },
  {
    name: "Dancing Script",
    category: "Handwriting",
    className: dancingScript.className,
  },
  {
    name: "Great Vibes",
    category: "Handwriting",
    className: greatVibes.className,
  },
  {
    name: "Sacramento",
    category: "Handwriting",
    className: sacramento.className,
  },
  { name: "Satisfy", category: "Handwriting", className: satisfy.className },
  { name: "Kalam", category: "Handwriting", className: kalam.className },
  {
    name: "Shadows Into Light",
    category: "Handwriting",
    className: shadowsIntoLight.className,
  },
  {
    name: "Indie Flower",
    category: "Handwriting",
    className: indieFlower.className,
  },
  {
    name: "Permanent Marker",
    category: "Handwriting",
    className: permanentMarker.className,
  },
  {
    name: "Courgette",
    category: "Handwriting",
    className: courgette.className,
  },
  { name: "Inter", category: "Corporate", className: inter.className },
  { name: "Roboto", category: "Corporate", className: roboto.className },
  { name: "Open Sans", category: "Corporate", className: openSans.className },
  { name: "Lato", category: "Corporate", className: lato.className },
  { name: "Montserrat", category: "Corporate", className: montserrat.className },
  { name: "Poppins", category: "Corporate", className: poppins.className },
  { name: "Nunito", category: "Corporate", className: nunito.className },
  { name: "Work Sans", category: "Corporate", className: workSans.className },
  { name: "Rubik", category: "Corporate", className: rubik.className },
  { name: "Manrope", category: "Corporate", className: manrope.className },
  { name: "Bebas Neue", category: "Display", className: bebasNeue.className },
  { name: "Anton", category: "Display", className: anton.className },
  { name: "Oswald", category: "Display", className: oswald.className },
  { name: "League Gothic", category: "Display", className: leagueGothic.className },
  {
    name: "Archivo Black",
    category: "Display",
    className: archivoBlack.className,
  },
  { name: "Bungee", category: "Display", className: bungee.className },
  { name: "Bangers", category: "Display", className: bangers.className },
  { name: "Righteous", category: "Display", className: righteous.className },
  { name: "Titan One", category: "Display", className: titanOne.className },
  { name: "Monoton", category: "Display", className: monoton.className },
] as const;
