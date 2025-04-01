"use client";
import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { parseEther, formatEther } from "viem";
import { Weth_abi } from "./Weth_abi";
import { USDC_abi } from "./USDC_abi";
import { DAI_abi } from "./DAI_abi";
import { ConnectKitButton } from "connectkit";
import { ethers } from "ethers";
import { Swap_abi } from "./Swap_abi";
import { ArrowRightLeft, ChevronDown } from "lucide-react";
import { Quoter_abi } from "./Quoter_abi";

// Contract addresses
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

export default function SwapComponent() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState({ usdc: 0, dai: 0 });
  const { writeContractAsync } = useWriteContract();
  const [isSwapping, setIsSwapping] = useState(false);

  // Common parameters
  const fee = 3000;
  const sqrtPriceLimitX96 = 0;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // Fetch quotes
  const { data: usdcQuote } = useReadContract({
    address: QUOTER,
    abi: Quoter_abi,
    functionName: "quoteExactInputSingle",
    args: [
      WETH,
      USDC,
      fee,
      amount ? ethers.parseUnits(amount, 18) : 0n,
      sqrtPriceLimitX96
    ],
    enabled: !!amount
  });

  const { data: daiQuote } = useReadContract({
    address: QUOTER,
    abi: Quoter_abi,
    functionName: "quoteExactInputSingle",
    args: [
      WETH,
      DAI,
      fee,
      amount ? ethers.parseUnits(amount, 18) : 0n,
      sqrtPriceLimitX96
    ],
    enabled: !!amount
  });

  // Fetch balances
  const { data: wethBalanceData, refetch: refetchWETH } = useReadContract({
    address: WETH,
    abi: Weth_abi,
    functionName: "balanceOf",
    args: [address],
    enabled: !!address,
  });

  const { data: usdcBalanceData, refetch: refetchUSDC } = useReadContract({
    address: USDC,
    abi: USDC_abi,
    functionName: "balanceOf",
    args: [address],
    enabled: !!address,
  });

  const { data: daiBalanceData, refetch: refetchDAI } = useReadContract({
    address: DAI,
    abi: DAI_abi,
    functionName: "balanceOf",
    args: [address],
    enabled: !!address,
  });

  // Update quotes when data changes
  useEffect(() => {
    if (usdcQuote && daiQuote) {
      setQuote({
        usdc: parseFloat(ethers.formatUnits(usdcQuote, 6)),
        dai: parseFloat(ethers.formatUnits(daiQuote, 18))
      });
    }
  }, [usdcQuote, daiQuote]);

  // Convert balances to readable format
  const wethBalance = wethBalanceData ? parseFloat(formatEther(wethBalanceData)) : 0;
  const usdcBalance = usdcBalanceData ? parseFloat(usdcBalanceData) / 10 ** 6 : 0;
  const daiBalance = daiBalanceData ? parseFloat(formatEther(daiBalanceData)) : 0;

  const handleSwap = async (tokenOut) => {
    if (!amount || !address || isSwapping) return;

    try {
      setIsSwapping(true);
      const amountIn = ethers.parseUnits(amount, 18);
      const currentQuote = tokenOut === USDC ? usdcQuote : daiQuote;
      const decimals = tokenOut === USDC ? 6 : 18;

      if (!currentQuote) {
        throw new Error("Could not get price quote");
      }

      // Calculate slippage (1%)
      const slippage = 1;
      const amountOutMinimum = BigInt(currentQuote) - 
        (BigInt(currentQuote) * BigInt(slippage * 100)) / 10000n;

      // First approve the router to spend WETH
      await writeContractAsync({
        address: WETH,
        abi: Weth_abi,
        functionName: "approve",
        args: [SWAP_ROUTER, amountIn],
      });

      // Execute swap
      await writeContractAsync({
        address: SWAP_ROUTER,
        abi: Swap_abi,
        functionName: "exactInputSingle",
        args: [{
          tokenIn: WETH,
          tokenOut: tokenOut,
          fee: fee,
          recipient: address,
          deadline: deadline,
          amountIn: amountIn,
          amountOutMinimum: amountOutMinimum,
          sqrtPriceLimitX96: sqrtPriceLimitX96
        }]
      });

      // Refresh balances
      await Promise.all([refetchWETH(), refetchUSDC(), refetchDAI()]);
    } catch (error) {
      console.error("Swap failed:", error);
    } finally {
      setIsSwapping(false);
    }
  };

  const convertETHtoWETH = async () => {
    if (!amount || !address || isSwapping) return;

    try {
      setIsSwapping(true);
      const amountIn = parseEther(amount);
      await writeContractAsync({
        address: WETH,
        abi: Weth_abi,
        functionName: "deposit",
        args: [],
        value: amountIn,
      });
      await refetchWETH();
    } catch (error) {
      console.error("ETH to WETH conversion failed:", error);
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="w-full max-w-md p-6 rounded-2xl shadow-lg border border-gray-700 bg-gray-850">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Swap Tokens</h1>
            <ConnectKitButton className="rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors" />
          </div>
          
          {address && (
            <div className="text-sm text-gray-400">
              Connected: <span className="text-gray-300">{address.slice(0, 6)}...{address.slice(-4)}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">From</span>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-blue-500 rounded-full" />
                  <span className="text-sm font-medium text-white">WETH</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-2xl font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 text-white placeholder-gray-500"
              />
            </div>

            <div className="flex justify-center">
              <button className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
                <ArrowRightLeft className="w-5 h-5 text-gray-300" />
              </button>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">To</span>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-purple-500 rounded-full" />
                  <span className="text-sm font-medium text-white">USDC/DAI</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <div className="text-2xl font-semibold text-white">
                {quote.usdc.toFixed(2)} USDC / {quote.dai.toFixed(2)} DAI
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleSwap(USDC)}
              disabled={!amount || isSwapping}
              className="w-full h-12 text-lg rounded-xl bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {isSwapping ? "Swapping..." : "Swap to USDC"}
            </button>
            <button
              onClick={() => handleSwap(DAI)}
              disabled={!amount || isSwapping}
              className="w-full h-12 text-lg rounded-xl bg-yellow-600 hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {isSwapping ? "Swapping..." : "Swap to DAI"}
            </button>
          </div>

          <div className="mt-4 text-white">
            <h3 className="text-lg font-semibold mb-2">Your Balances:</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-700 p-3 rounded-lg">
                <p className="text-sm text-gray-400">WETH</p>
                <p>{wethBalance.toFixed(4)}</p>
              </div>
              <div className="bg-gray-700 p-3 rounded-lg">
                <p className="text-sm text-gray-400">USDC</p>
                <p>{usdcBalance.toFixed(2)}</p>
              </div>
              <div className="bg-gray-700 p-3 rounded-lg">
                <p className="text-sm text-gray-400">DAI</p>
                <p>{daiBalance.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={convertETHtoWETH}
              disabled={!amount || isSwapping}
              className="w-full h-12 text-lg rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSwapping ? "Converting..." : "Convert ETH to WETH"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}