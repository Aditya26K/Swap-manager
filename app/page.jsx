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

const TOKENS = [
  { address: USDC, name: "USDC", color: "bg-purple-500", decimals: 6 },
  { address: DAI, name: "DAI", color: "bg-yellow-500", decimals: 18 }
];

export default function SwapComponent() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [ethAmount, setEthAmount] = useState("");
  const [quote, setQuote] = useState(0);
  const { writeContractAsync } = useWriteContract();
  const [isSwapping, setIsSwapping] = useState(false);
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
  const [activeTab, setActiveTab] = useState("swap"); // 'swap' or 'convert'

  // Common parameters
  const fee = 3000;
  const sqrtPriceLimitX96 = 0;
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // Fetch quotes
  const { data: tokenQuote , refetch} = useReadContract({
    address: QUOTER,
    abi: Quoter_abi,
    functionName: "quoteExactInputSingle",
    args: [
      WETH,
      selectedToken.address,
      fee,
      amount ? ethers.parseUnits(amount, 18) : 0n,
      sqrtPriceLimitX96
    ],
    enabled: !!amount && activeTab === "swap"
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

  // Update quote when data changes
  useEffect(() => {
    if (tokenQuote) {
      setQuote(parseFloat(ethers.formatUnits(tokenQuote, selectedToken.decimals)));
    }
  }, [tokenQuote, selectedToken]);

  // Convert balances to readable format
  const wethBalance = wethBalanceData ? parseFloat(formatEther(wethBalanceData)) : 0;
  const usdcBalance = usdcBalanceData ? parseFloat(ethers.formatUnits(usdcBalanceData, 6)) : 0;
  const daiBalance = daiBalanceData ? parseFloat(formatEther(daiBalanceData)) : 0;

  const handleSwap = async () => {
    if (!amount || !address || isSwapping) return;

    try {
      setIsSwapping(true);
      const amountIn = ethers.parseUnits(amount, 18);

      if (!tokenQuote) {
        throw new Error("Could not get price quote");
      }

      // Calculate slippage (1%)
      const slippage = 1;
      const amountOutMinimum = BigInt(tokenQuote) - 
        (BigInt(tokenQuote) * BigInt(slippage * 100)) / 10000n;

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
          tokenOut: selectedToken.address,
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
      setAmount("");
    } catch (error) {
      console.error("Swap failed:", error);
    } finally {
      setIsSwapping(false);
    }
  };

  const convertETHtoWETH = async () => {
    if (!ethAmount || !address || isSwapping) return;

    try {
      setIsSwapping(true);
      const amountIn = parseEther(ethAmount);
      await writeContractAsync({
        address: WETH,
        abi: Weth_abi,
        functionName: "deposit",
        args: [],
        value: amountIn,
      });
      await refetchWETH();
      setEthAmount("");
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
            <h1 className="text-2xl font-bold text-white">Token Exchange</h1>
            <ConnectKitButton className="rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-colors" />
          </div>
          
          {address && (
            <div className="text-sm text-gray-400">
              Connected: <span className="text-gray-300">{address.slice(0, 6)}...{address.slice(-4)}</span>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab("swap")}
              className={`flex-1 py-2 font-medium ${activeTab === "swap" ? "text-white border-b-2 border-green-500" : "text-gray-400"}`}
            >
              Swap
            </button>
            <button
              onClick={() => setActiveTab("convert")}
              className={`flex-1 py-2 font-medium ${activeTab === "convert" ? "text-white border-b-2 border-blue-500" : "text-gray-400"}`}
            >
              Convert ETH
            </button>
          </div>

          {activeTab === "swap" ? (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">From</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full" />
                    <span className="text-sm font-medium text-white">WETH</span>
                  </div>
                </div>
                <input
                  type="number"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onBlur={refetch}
                  className="w-full text-2xl font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 text-white placeholder-gray-500"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Balance: {wethBalance.toFixed(4)} WETH
                </div>
              </div>

              <div className="flex justify-center">
                <button className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
                  <ArrowRightLeft className="w-5 h-5 text-gray-300" />
                </button>
              </div>

              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">To</span>
                  <div className="relative">
                    <select
                      value={selectedToken.address}
                      onChange={(e) => {
                        const token = TOKENS.find(t => t.address === e.target.value);
                        if (token) setSelectedToken(token);
                      }}
                      className="appearance-none bg-gray-700 text-white rounded-md pl-3 pr-8 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-600"
                    >
                      {TOKENS.map((token) => (
                        <option key={token.address} value={token.address}>
                          {token.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                  </div>
                </div>
                <div className="text-2xl font-semibold text-white">
                  {quote ? quote.toFixed(selectedToken.decimals === 6 ? 2 : 4) : "0.00"} {selectedToken.name}
                </div>
              </div>

              <button
                onClick={handleSwap}
                disabled={!amount || isSwapping}
                className={`w-full h-12 text-lg rounded-xl ${selectedToken.address === USDC ? "bg-purple-600 hover:bg-purple-700" : "bg-yellow-600 hover:bg-yellow-700"} transition-colors disabled:opacity-50`}
              >
                {isSwapping ? "Swapping..." : `Swap to ${selectedToken.name}`}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">From</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-gray-300 rounded-full" />
                    <span className="text-sm font-medium text-white">ETH</span>
                  </div>
                </div>
                <input
                  type="number"
                  placeholder="0.0"
                  value={ethAmount}
                  onChange={(e) => setEthAmount(e.target.value)}
                  className="w-full text-2xl font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 text-white placeholder-gray-500"
                />
              </div>

              <div className="flex justify-center">
                <div className="p-2 rounded-full bg-gray-700">
                  <ArrowRightLeft className="w-5 h-5 text-gray-300" />
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">To</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full" />
                    <span className="text-sm font-medium text-white">WETH</span>
                  </div>
                </div>
                <div className="text-2xl font-semibold text-white">
                  {ethAmount || "0.0"} WETH
                </div>
              </div>

              <button
                onClick={convertETHtoWETH}
                disabled={!ethAmount || isSwapping}
                className="w-full h-12 text-lg rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSwapping ? "Converting..." : "Convert ETH to WETH"}
              </button>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
