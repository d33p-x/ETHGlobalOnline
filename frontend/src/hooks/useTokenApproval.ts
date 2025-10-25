// Shared hook for token approval logic

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from "wagmi";
import { type Address, parseUnits, maxUint256 } from "viem";
import { erc20Abi } from "viem";

interface UseTokenApprovalProps {
  tokenAddress: Address | undefined;
  spenderAddress: Address | undefined;
  amount?: string;
  tokenDecimals?: number;
}

export function useTokenApproval({
  tokenAddress,
  spenderAddress,
  amount,
  tokenDecimals = 18,
}: UseTokenApprovalProps) {
  const { address: userAddress, isConnected, chain } = useAccount();
  const chainId = useChainId();
  const [needsApproval, setNeedsApproval] = useState(false);

  const {
    data: allowance,
    refetch: refetchAllowance,
    isLoading: isLoadingAllowance,
  } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      userAddress && spenderAddress ? [userAddress, spenderAddress] : undefined,
    chainId: chainId,
    query: {
      enabled:
        isConnected &&
        !!userAddress &&
        !!tokenAddress &&
        tokenAddress !== "0x" &&
        !!spenderAddress &&
        !!amount &&
        chain?.id === chainId,
    },
  });

  const {
    data: approveHash,
    error: approveError,
    status: approveStatus,
    writeContract: approveWriteContract,
  } = useWriteContract();

  const { isLoading: isApproving, isSuccess: isApproved } =
    useWaitForTransactionReceipt({ hash: approveHash });

  useEffect(() => {
    if (allowance === undefined || !amount || !tokenDecimals) {
      if (needsApproval) {
        setNeedsApproval(false);
      }
      return;
    }

    try {
      const requiredAmount = parseUnits(amount, tokenDecimals);
      const shouldNeedApproval = allowance < requiredAmount;
      if (needsApproval !== shouldNeedApproval) {
        setNeedsApproval(shouldNeedApproval);
      }
    } catch (error) {
      if (needsApproval) {
        setNeedsApproval(false);
      }
    }
  }, [allowance, amount, tokenDecimals, needsApproval]);

  useEffect(() => {
    if (isApproved) {
      refetchAllowance();
    }
  }, [isApproved, refetchAllowance]);

  const approve = () => {
    if (!tokenAddress || !spenderAddress) return;

    approveWriteContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress, maxUint256],
    });
  };

  return {
    needsApproval,
    allowance,
    isLoadingAllowance,
    approve,
    approveHash,
    approveError,
    approveStatus,
    isApproving,
    isApproved,
    refetchAllowance,
  };
}
