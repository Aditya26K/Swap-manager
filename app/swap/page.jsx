"use client";
import { useState, useEffect, useMemo } from "react";
import { useReadContract } from "wagmi";
import { Liquidity_abi } from "../Liquidity_abi";
import { RefreshCw, ArrowRightLeft } from "lucide-react";

const USDC_DAI_POOL = "0xa63b490aA077f541c9d64bFc1Cc0db2a752157b5";

export default function USDC_DAI_Converter() {
  const [invertedView, setInvertedView] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Read USDC-DAI pool data
  const { 
    data: usdcDaiSlot0, 
    refetch: refetchUsdcDai,
    isPending: isPoolLoading
  } = useReadContract({
    address: USDC_DAI_POOL,
    abi: Liquidity_abi,
    functionName: 'slot0',
  });

  // Format number with proper decimal handling
  const formatValue = (num) => {
    if (num === null || num === undefined) return "0.0000";
    
    // Handle extremely large/small numbers with scientific notation
    if (num > 1e6 || num < 1e-4) {
      return num.toExponential(4);
    }
    
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
  };

  // Calculate and format the conversion ratio
  const conversionRatio = useMemo(() => {
    if (!usdcDaiSlot0) return { usdcToDai: "0.0000", daiToUsdc: "0.0000" };

    const sqrtPrice = Number(usdcDaiSlot0[0]) / 2 ** 96;
    const price = (sqrtPrice * sqrtPrice);
    
    // Proper decimal adjustment (USDC has 6 decimals, DAI has 18 decimals)
    const usdcToDai = price * (10 ** 18) / (10 ** 6); // Corrected decimal adjustment
    const daiToUsdc = 1 / usdcToDai;

    return {
      usdcToDai: formatValue(usdcToDai),
      daiToUsdc: formatValue(daiToUsdc)
    };
  }, [usdcDaiSlot0]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetchUsdcDai();
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    handleRefresh();
    const interval = setInterval(handleRefresh, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg max-w-md w-full border border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          USDC/DAI Converter
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setInvertedView(!invertedView)}
            className="flex items-center gap-1 text-sm bg-gray-700 px-3 py-1 rounded-lg hover:bg-gray-600 transition-colors"
          >
            <ArrowRightLeft size={14} />
            {invertedView ? "USDC → DAI" : "DAI → USDC"}
          </button>
        </div>
      </div>

      {isPoolLoading || isRefreshing ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-gray-700/50 p-6 rounded-lg text-center border border-gray-600">
            {!invertedView ? (
              <>
                <p className="text-4xl font-mono font-bold text-white">
                  1 USDC = <span className="text-blue-300">{conversionRatio.usdcToDai}</span> DAI
                </p>
                <p className="text-sm text-gray-400 mt-3">
                  1 DAI = {conversionRatio.daiToUsdc} USDC
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl font-mono font-bold text-white">
                  1 DAI = <span className="text-purple-300">{conversionRatio.daiToUsdc}</span> USDC
                </p>
                <p className="text-sm text-gray-400 mt-3">
                  1 USDC = {conversionRatio.usdcToDai} DAI
                </p>
              </>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/90 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
              Refresh Data
            </button>
            {lastUpdated && (
              <p className="text-xs text-gray-400">
                Updated: {lastUpdated}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}