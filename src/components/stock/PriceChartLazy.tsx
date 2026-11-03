"use client";

import dynamic from "next/dynamic";
import { PriceChartSkeleton } from "@/components/stock/PriceChartSkeleton";

export const PriceChartLazy = dynamic(
  () => import("@/components/stock/PriceChart").then((mod) => mod.PriceChart),
  {
    ssr: false,
    loading: () => <PriceChartSkeleton />,
  }
);
