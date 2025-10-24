// frontend/src/app/LightweightMarketChart.tsx
"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  CandlestickData,
  LineData,
  AreaData,
  SeriesType,
  ChartOptions,
  DeepPartial,
  // --- V5 Imports ---
  LineSeries,
  AreaSeries,
  CandlestickSeries,
  // --- V5 Imports ---
} from "lightweight-charts";

// --- Interfaces for Pyth UDF history response ---
interface UdfOkHistoryResponse {
  s: "ok";
  t: number[]; // time (seconds)
  o?: number[]; // open
  h?: number[]; // high
  l?: number[]; // low
  c: number[]; // close
  v?: number[]; // volume
  nextTime?: number;
}

interface UdfErrorResponse {
  s: "error";
  errmsg: string;
}
interface UdfNoDataResponse {
  s: "no_data";
  nextTime?: number;
}

type PythUdfResponse =
  | UdfOkHistoryResponse
  | UdfErrorResponse
  | UdfNoDataResponse;

// --- Type definition for the data Lightweight Charts expects ---
type ChartData = CandlestickData | LineData | AreaData; // Union of possible data types

// --- Chart Component Props ---
interface LightweightMarketChartProps {
  baseSymbol: string; // e.g., "ETH"
  quoteSymbol: string; // e.g., "USDC"
  chartType?: "Candlestick" | "Line" | "Area"; // Supported chart types
  interval?: string; // For data fetching, e.g., '60' for 1 hour
}

// --- Helper to fetch and calculate data ---
async function fetchAndCalculateSyntheticData(
  base: string,
  quote: string,
  resolution: string,
  startTime: number, // Unix timestamp in seconds
  endTime: number // Unix timestamp in seconds
): Promise<ChartData[]> {
  const pythApiBaseUrl = "https://benchmarks.pyth.network/v1/shims/tradingview";
  // Construct Pyth symbol names (assuming Crypto vs USD)
  const basePythSymbol = `Crypto.${base}/USD`;
  const quotePythSymbol = `Crypto.${quote}/USD`;

  const baseDataUrl = `${pythApiBaseUrl}/history?symbol=${basePythSymbol}&resolution=${resolution}&from=${startTime}&to=${endTime}`;
  const quoteDataUrl = `${pythApiBaseUrl}/history?symbol=${quotePythSymbol}&resolution=${resolution}&from=${startTime}&to=${endTime}`;

  console.log(`Fetching: ${baseDataUrl}`);
  console.log(`Fetching: ${quoteDataUrl}`);

  try {
    const [baseRes, quoteRes] = await Promise.all([
      fetch(baseDataUrl),
      fetch(quoteDataUrl),
    ]);

    if (!baseRes.ok || !quoteRes.ok) {
      const baseError = await baseRes.text();
      const quoteError = await quoteRes.text();
      throw new Error(
        `Failed to fetch Pyth data. Base: ${baseRes.statusText} (${baseError}). Quote: ${quoteRes.statusText} (${quoteError})`
      );
    }

    const baseData: PythUdfResponse = await baseRes.json();
    const quoteData: PythUdfResponse = await quoteRes.json();

    // --- FIX for TS2367: Check for errors first ---
    if (baseData.s === "error" || quoteData.s === "error") {
      const errorMsg =
        (baseData as UdfErrorResponse).errmsg ||
        (quoteData as UdfErrorResponse).errmsg ||
        "Unknown error from Pyth API";
      console.warn("Pyth API returned error:", errorMsg, baseData, quoteData);
      throw new Error(`Pyth API error: ${errorMsg}`);
    }

    // --- FIX for TS2367: Now check for no_data (s is 'ok' or 'no_data') ---
    if (
      baseData.s === "no_data" ||
      quoteData.s === "no_data" ||
      baseData.t.length === 0 ||
      quoteData.t.length === 0
    ) {
      console.warn("No data returned from Pyth for one or both symbols.");
      return [];
    }

    // --- If we're here, baseData.s and quoteData.s must be 'ok' ---

    // --- Align and Calculate ---
    const quotePriceMap = new Map<number, number>();
    for (let i = 0; i < quoteData.t.length; i++) {
      quotePriceMap.set(quoteData.t[i], quoteData.c[i]); // timestamp (s) -> close_price
    }

    const syntheticData: ChartData[] = [];
    for (let i = 0; i < baseData.t.length; i++) {
      const timeSeconds = baseData.t[i];
      const quotePrice = quotePriceMap.get(timeSeconds);

      if (quotePrice && quotePrice !== 0 && baseData.c) {
        const close = baseData.c[i] / quotePrice;

        if (
          baseData.o &&
          baseData.h &&
          baseData.l &&
          baseData.o.length > i &&
          baseData.h.length > i &&
          baseData.l.length > i
        ) {
          const open = baseData.o[i] / quotePrice;
          const high = baseData.h[i] / quotePrice;
          const low = baseData.l[i] / quotePrice;

          syntheticData.push({
            time: timeSeconds as UTCTimestamp,
            open: open,
            high: Math.max(open, high, low, close),
            low: Math.min(open, high, low, close),
            close: close,
          });
        } else {
          syntheticData.push({
            time: timeSeconds as UTCTimestamp,
            value: close,
          });
        }
      } else {
        console.warn(
          `Missing or invalid quote price for timestamp: ${new Date(timeSeconds * 1000).toISOString()}`
        );
      }
    }

    console.log(`Calculated ${syntheticData.length} synthetic data points.`);

    // --- FIX for TS2362/TS2363: Cast time to Number for sorting ---
    syntheticData.sort((a, b) => Number(a.time) - Number(b.time));
    return syntheticData;
  } catch (error) {
    console.error("Error fetching or calculating synthetic data:", error);
    return [];
  }
}

// --- Interval Options ---
const INTERVALS = [
  { label: "1m", value: "1", days: 1 },
  { label: "5m", value: "5", days: 2 },
  { label: "15m", value: "15", days: 3 },
  { label: "1h", value: "60", days: 7 },
  { label: "4h", value: "240", days: 30 },
  { label: "1D", value: "D", days: 90 },
] as const;

// --- The React Component ---
const LightweightMarketChart: React.FC<LightweightMarketChartProps> = ({
  baseSymbol,
  quoteSymbol,
  chartType = "Candlestick",
  interval = "60",
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState(interval);

  useEffect(() => {
    if (!chartContainerRef.current) {
      console.error("Chart container ref is not available.");
      return;
    }

    // --- Chart Configuration ---
    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { color: "#1A1A1A" }, // Dark theme
        textColor: "#DDD",
      },
      grid: {
        vertLines: { color: "#444" },
        horzLines: { color: "#444" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    };

    // --- Initialize Chart ---
    chartRef.current = createChart(chartContainerRef.current, chartOptions);
    console.log("Lightweight Chart created");

    // --- Function to Add or Replace Series (V5 SYNTAX) ---
    const setupSeries = (chart: IChartApi, type: typeof chartType) => {
      if (seriesRef.current) {
        console.log("Removing existing series");
        chart.removeSeries(seriesRef.current);
        seriesRef.current = null;
      }

      console.log(`Adding ${type} series`);
      try {
        // =================================================================
        // --- V5 FIX as per migration docs ---
        // =================================================================
        if (type === "Candlestick") {
          seriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: "#26a69a",
            downColor: "#ef5350",
            borderVisible: false,
            wickUpColor: "#26a69a",
            wickDownColor: "#ef5350",
          });
        } else if (type === "Line") {
          seriesRef.current = chart.addSeries(LineSeries, {
            color: "#2962FF",
            lineWidth: 2,
          });
        } else if (type === "Area") {
          seriesRef.current = chart.addSeries(AreaSeries, {
            lineColor: "#2962FF",
            topColor: "rgba(41, 98, 255, 0.4)",
            bottomColor: "rgba(41, 98, 255, 0)",
            lineWidth: 2,
          });
        } else {
          console.error("Unsupported chart type provided:", type);
          seriesRef.current = chart.addSeries(LineSeries); // Default to Line
        }
        // =================================================================
        // --- END OF V5 FIX ---
        // =================================================================
      } catch (e) {
        console.error("Error adding series:", e);
        setError("Failed to create chart series.");
      }
    };

    // --- Initial Series Setup ---
    if (chartRef.current) {
      setupSeries(chartRef.current, chartType);
    }

    // --- Fetch and Set Initial Data ---
    const loadData = async () => {
      if (!seriesRef.current) {
        console.error("Series reference is not available for data loading.");
        setError("Chart series not initialized.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const endTime = Math.floor(Date.now() / 1000);
      const intervalConfig = INTERVALS.find((i) => i.value === selectedInterval);
      const daysToFetch = intervalConfig?.days ?? 7;
      const startTime = endTime - 60 * 60 * 24 * daysToFetch;

      try {
        const data = await fetchAndCalculateSyntheticData(
          baseSymbol,
          quoteSymbol,
          selectedInterval,
          startTime,
          endTime
        );

        if (!seriesRef.current) {
          console.log("Series removed before data could be set.");
          return;
        }

        const currentSeriesType = seriesRef.current.seriesType();
        let finalData: ChartData[] = [];

        if (currentSeriesType === "Candlestick") {
          finalData = data.filter((d) => "open" in d) as CandlestickData[];
          if (finalData.length !== data.length) {
            console.warn(
              "Some data points were missing OHLC for Candlestick series and were filtered out."
            );
          }
        } else if (
          currentSeriesType === "Line" ||
          currentSeriesType === "Area"
        ) {
          finalData = data.map((d) => ({
            time: d.time,
            value: (d as CandlestickData).close ?? (d as LineData).value ?? 0,
          })) as (LineData | AreaData)[];
        }

        if (finalData.length > 0) {
          console.log(`Setting ${finalData.length} data points.`);
          seriesRef.current.setData(finalData);
          chartRef.current?.timeScale().fitContent();
        } else {
          console.log("No valid data to display.");
          seriesRef.current.setData([]);
        }
      } catch (fetchError: any) {
        console.error("Failed to load chart data:", fetchError);
        setError(`Failed to load data: ${fetchError.message}`);
        if (seriesRef.current) seriesRef.current.setData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // --- Handle Resizing ---
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.resize(
          chartContainerRef.current.clientWidth,
          chartContainerRef.current.clientHeight
        );
      }
    };

    chartContainerRef.current.style.height = "100%";
    handleResize();
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
    return () => {
      console.log("Cleaning up Lightweight Chart");
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
    };
  }, [baseSymbol, quoteSymbol, chartType, selectedInterval]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Interval Controls */}
      <div style={styles.controlsContainer}>
        {INTERVALS.map((intervalOption) => (
          <button
            key={intervalOption.value}
            onClick={() => setSelectedInterval(intervalOption.value)}
            style={{
              ...styles.intervalButton,
              ...(selectedInterval === intervalOption.value
                ? styles.intervalButtonActive
                : {}),
            }}
            disabled={loading}
          >
            {intervalOption.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={styles.loadingOverlay}>Loading Chart Data...</div>
      )}
      {error && <div style={styles.errorOverlay}>Error: {error}</div>}
      <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

// Simple overlay styles
const styles = {
  controlsContainer: {
    position: "absolute",
    top: "10px",
    right: "10px",
    display: "flex",
    gap: "5px",
    zIndex: 20,
    backgroundColor: "rgba(26, 26, 26, 0.9)",
    padding: "5px",
    borderRadius: "5px",
    border: "1px solid #444",
  } as React.CSSProperties,
  intervalButton: {
    backgroundColor: "#2A2A2A",
    color: "#DDD",
    border: "1px solid #444",
    borderRadius: "3px",
    padding: "5px 12px",
    fontSize: "12px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
  } as React.CSSProperties,
  intervalButtonActive: {
    backgroundColor: "#2962FF",
    color: "white",
    borderColor: "#2962FF",
  } as React.CSSProperties,
  loadingOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "white",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: "10px",
    borderRadius: "5px",
    zIndex: 10,
  } as React.CSSProperties,
  errorOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    color: "red",
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: "10px",
    borderRadius: "5px",
    zIndex: 10,
  } as React.CSSProperties,
};

export default memo(LightweightMarketChart);
