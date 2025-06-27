import { createConfig } from "ponder";

import { CoinbaseSmartWalletAbi } from "./abis/CoinbaseSmartWalletAbi";

export default createConfig({
  chains: {
    base: {
      id: 8453,
      rpc: process.env.PONDER_RPC_URL_8453!,
    },
  },
  contracts: {
    CoinbaseSmartWallet: {
      abi: CoinbaseSmartWalletAbi,
      chain: "base",
      startBlock: 32031000,
      filter: {
        event: "AddOwner",
        args: {},
      },
    },
  },
});
