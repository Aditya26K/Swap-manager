"use client";
import { useState, useEffect, useMemo } from "react";
import { useReadContract } from "wagmi";
import { Liquidity_abi } from "../Liquidity_abi";
import { nearestUsableTick } from "@uniswap/v3-sdk";

const USDC_DAI_POOL = "0xa63b490aA077f541c9d64bFc1Cc0db2a752157b5";
const TICK_SPACING = 60;

const DAI = {
  address: "0x6b175474e89094c44da98b954eedeac495271d0f",
  decimals: 18,
};
const USDC = {
  address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  decimals: 6,
};

export default function USDC_Converter() {
  const [priceInput, setPriceInput] = useState("");
  const [tick, setTick] = useState("");
  const [priceAtTick, setPriceAtTick] = useState("");

  const [tickLower, setTickLower] = useState("");
  const [tickUpper, setTickUpper] = useState("");
  const [priceLower, setPriceLower] = useState("");
  const [priceUpper, setPriceUpper] = useState("");

  const {
    data: slot0,
    refetch,
    isPending: isLoading,
  } = useReadContract({
    address: USDC_DAI_POOL,
    abi: Liquidity_abi,
    functionName: "slot0",
  });

  const conversionRate = useMemo(() => {
    if (!slot0) return null;
    const sqrtPriceX96 = Number(slot0[0]);
    const sqrtPrice = sqrtPriceX96 / 2 ** 96;
    const poolPrice = sqrtPrice ** 2;
    return (1 / poolPrice) * Math.pow(10, DAI.decimals - USDC.decimals); // DAI per USDC
  }, [slot0]);

  const formatValue = (value, decimals = 6) => {
    if (!value) return "0.00";
    const num = Number(value);
    if (isNaN(num)) return "0.00";
    if (num > 1e6 || num < 1e-4) return num.toExponential(3);
    return num.toFixed(decimals);
  };

  const priceToTick = (price) => {
    const decimalsAdjustment = Math.pow(10, DAI.decimals - USDC.decimals);
    const poolPrice = (1 / price) * decimalsAdjustment;
    return Math.floor(Math.log(poolPrice) / Math.log(1.0001));
  };

  const tickToPrice = (tick) => {
    const poolPrice = Math.pow(1.0001, tick);
    const decimalsAdjustment = Math.pow(10, DAI.decimals - USDC.decimals);
    return (1 / poolPrice) * decimalsAdjustment;
  };

  const handlePriceChange = (value) => {
    setPriceInput(value);
    if (!value) {
      setTick("");
      setPriceAtTick("");
      return;
    }

    try {
      const price = parseFloat(value);
      const rawTick = priceToTick(price);
      const usableTick = nearestUsableTick(rawTick, TICK_SPACING);
      const recoveredPrice = tickToPrice(usableTick);

      setTick(usableTick);
      setPriceAtTick(formatValue(recoveredPrice));
    } catch (err) {
      console.error("Tick calc error:", err);
      setTick("");
      setPriceAtTick("");
    }
  };

  const handleBoundChange = (bound, value) => {
    const parsed = parseInt(value);
    const usable = isNaN(parsed) ? "" : nearestUsableTick(parsed, TICK_SPACING);

    if (bound === "lower") {
      setTickLower(value);
      if (!isNaN(usable)) {
        const price = tickToPrice(usable);
        setPriceLower(formatValue(price));
      } else {
        setPriceLower("");
      }
    } else if (bound === "upper") {
      setTickUpper(value);
      if (!isNaN(usable)) {
        const price = tickToPrice(usable);
        setPriceUpper(formatValue(price));
      } else {
        setPriceUpper("");
      }
    }
  };

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg max-w-md w-full border border-gray-700">
      <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-6">
        DAI to USDC Converter
      </h1>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-gray-700/50 p-6 rounded-lg border border-gray-600 space-y-4">
          {/* Price → Tick */}
          <div>
            <label className="block text-gray-300 text-sm mb-1">
              Custom Price (DAI per USDC)
            </label>
            <input
              type="number"
              value={priceInput}
              onChange={(e) => handlePriceChange(e.target.value)}
              className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
              placeholder="e.g. 1.002"
              step="0.0000001"
            />
          </div>

          <div className="text-sm text-gray-400 space-y-1">
            <p>Nearest Usable Tick: {tick || "N/A"}</p>
            <p>Price @ Tick: {priceAtTick ? `$${priceAtTick}` : "N/A"}</p>
          </div>

          <hr className="border-gray-600" />

          {/* Tick bounds */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Tick Lower</label>
              <input
                type="number"
                value={tickLower}
                onChange={(e) => handleBoundChange("lower", e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
              />
              <p className="text-xs text-gray-400 mt-1">
                Price: {priceLower ? `$${priceLower}` : "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Tick Upper</label>
              <input
                type="number"
                value={tickUpper}
                onChange={(e) => handleBoundChange("upper", e.target.value)}
                className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
              />
              <p className="text-xs text-gray-400 mt-1">
                Price: {priceUpper ? `$${priceUpper}` : "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}