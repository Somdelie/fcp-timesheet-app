"use client";

import { motion } from "framer-motion";
import { useId } from "react";

interface MarkerProps {
  color: string;
  label: "Pen" | "Marker" | "Highlighter";
  pressed?: boolean;
  pulled?: boolean;
  size?: "fine" | "medium";
}

export default function Marker({
  color,
  label,
  pressed = false,
  pulled = false,
  size = "medium",
}: MarkerProps) {
  const rawId = useId().replace(/:/g, "");
  const shadowId = `${rawId}-marker-shadow`;
  const bodyId = `${rawId}-marker-body`;
  const bodyDepthId = `${rawId}-marker-body-depth`;
  const bodyClipId = `${rawId}-marker-body-clip`;
  const tipGlossId = `${rawId}-marker-tip-gloss`;
  const isHighlighter = label === "Highlighter";
  const pull = pulled ? 60 : 0;
  const pullTransition = { duration: 0.5, ease: "easeOut" as const };
  const tipPath = isHighlighter
    ? `M${104 + pull} 27h20c2.2 0 4 1.8 4 4v16c0 2.2-1.8 4-4 4h-20V27Z`
    : size === "fine"
      ? `M${104 + pull} 32.5h18.5c2.5 0 4.5 2 4.5 4.5v4c0 2.5-2 4.5-4.5 4.5H${104 + pull}v-13Z`
      : `M${104 + pull} 28h17.5c5.25 0 9.5 4.25 9.5 9.5v3c0 5.25-4.25 9.5-9.5 9.5H${104 + pull}V28Z`;
  const bodyPath = `M-2 16h${51 + pull}c11.5 0 16 7 25 9.25 8.5 2.13 18.5.75 30 .75v26c-11.5 0-21.5-1.38-30 .75C${65 + pull} 55 ${60.5 + pull} 62 ${49 + pull} 62H-2V16Z`;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      className={`group relative flex h-11 w-[104px] items-center justify-center rounded-xl transition ${
        pressed ? "bg-slate-100/80" : "hover:bg-slate-50/80"
      }`}
    >
      <svg
        width="100"
        height="52"
        viewBox="0 0 132 68"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <filter
            id={shadowId}
            x="-12"
            y="0"
            width="230"
            height="68"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="3.5"
              floodColor="#0f172a"
              floodOpacity=".15"
            />
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="1"
              floodColor="#64748b"
              floodOpacity=".1"
            />
          </filter>
          <linearGradient
            id={bodyId}
            x1="8"
            y1="13"
            x2="101"
            y2="59"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset=".52" stopColor="#fbfcfe" />
            <stop offset="1" stopColor="#eef2f7" />
          </linearGradient>
          <linearGradient
            id={bodyDepthId}
            x1="50"
            y1="16"
            x2="50"
            y2="62"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" stopOpacity=".72" />
            <stop offset=".5" stopColor="white" stopOpacity="0" />
            <stop offset="1" stopColor="#cbd5e1" stopOpacity=".42" />
          </linearGradient>
        </defs>

        <g filter={`url(#${shadowId})`}>
          <motion.path
            d={bodyPath}
            animate={{ d: bodyPath }}
            transition={pullTransition}
            fill={`url(#${bodyId})`}
          />
          <motion.path
            d={bodyPath}
            animate={{ d: bodyPath }}
            transition={pullTransition}
            fill={`url(#${bodyDepthId})`}
          />
          <motion.path
            d={`M7 21.5h${39 + pull}c8.5 0 13 4.6 20.5 6.3`}
            animate={{
              d: `M7 21.5h${39 + pull}c8.5 0 13 4.6 20.5 6.3`,
            }}
            transition={pullTransition}
            stroke="white"
            strokeLinecap="round"
            strokeWidth="5"
            opacity=".46"
          />
          <motion.path
            d={`M2 56h${46 + pull}c11 0 16-3.2 24-4.6`}
            animate={{
              d: `M2 56h${46 + pull}c11 0 16-3.2 24-4.6`,
            }}
            transition={pullTransition}
            stroke="#cbd5e1"
            strokeLinecap="round"
            strokeWidth="5"
            opacity=".2"
          />
          <motion.path
            d={bodyPath}
            animate={{ d: bodyPath }}
            transition={pullTransition}
            stroke="#dbe2ea"
            strokeWidth="1.4"
          />
          <motion.path
            d={`M0 17.5h${46.5 + pull}c11.5 0 15.2 5.8 24 8.55`}
            animate={{
              d: `M0 17.5h${46.5 + pull}c11.5 0 15.2 5.8 24 8.55`,
            }}
            transition={pullTransition}
            stroke="white"
            strokeLinecap="round"
            strokeWidth="2.2"
            opacity=".9"
          />
          <motion.path
            d={tipPath}
            animate={{ d: tipPath }}
            transition={pullTransition}
            fill={color}
          />
          <motion.path
            d={tipPath}
            animate={{ d: tipPath }}
            transition={pullTransition}
            fill={`url(#${tipGlossId})`}
            opacity={isHighlighter ? ".16" : ".22"}
          />
          <motion.path
            d={`M${46 + pull} 16h5v46h-5V16Z`}
            animate={{ d: `M${46 + pull} 16h5v46h-5V16Z` }}
            transition={pullTransition}
            fill={color}
            className="drop-shadow-[1px_0_1px_rgba(15,23,42,0.16)]"
          />
          <motion.path
            d={`M${52 + pull} 17.5h1.6v43H${52 + pull}v-43Z`}
            animate={{ d: `M${52 + pull} 17.5h1.6v43H${52 + pull}v-43Z` }}
            transition={pullTransition}
            fill="#cbd5e1"
            opacity=".55"
          />
          <motion.path
            d={`M0 17h${46 + pull}v44H0V17Z`}
            animate={{ d: `M0 17h${46 + pull}v44H0V17Z` }}
            transition={pullTransition}
            fill="white"
            opacity=".34"
          />
          <motion.path
            d={`M${pulled ? 45 : -24} 45c5.2-5.8 9.8-8.2 12-5.8 1.7 1.9-4.6 8.2-1.4 8.4 4.8.3 9.4-3.8 14.8-3.2`}
            animate={{
              d: `M${pulled ? 45 : -24} 45c5.2-5.8 9.8-8.2 12-5.8 1.7 1.9-4.6 8.2-1.4 8.4 4.8.3 9.4-3.8 14.8-3.2`,
            }}
            transition={pullTransition}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          <motion.path
            d={`M${104 + pull} 27v25`}
            animate={{ d: `M${104 + pull} 27v25` }}
            transition={pullTransition}
            stroke="#d8e0ea"
            strokeWidth="1.5"
            opacity=".8"
          />
        </g>
        <motion.path
          d={`M${106 + pull} 29.5h15`}
          animate={{ d: `M${106 + pull} 29.5h15` }}
          transition={pullTransition}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".35"
        />
        <defs>
          <linearGradient
            id={tipGlossId}
            x1="104"
            y1="27"
            x2="128"
            y2="51"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" />
            <stop offset=".45" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </button>
  );
}
