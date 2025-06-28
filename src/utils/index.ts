import {
  Address,
  createPublicClient,
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  PublicClient,
} from "viem";
import {
  BundlerClient,
  entryPoint06Abi,
} from "viem/account-abstraction";

export async function getUserOpFromCalldata(
    client: PublicClient,
    transactionHash: `0x${string}`
  ) {
    const deployReceipt = await client.getTransactionReceipt({
      hash: transactionHash,
    });
    const deployTransaction = await client.getTransaction({
      hash: transactionHash,
    });
  
    const userOpEventLog = deployReceipt.logs.find((log) => {
      try {
        const event = decodeEventLog({
          abi: entryPoint06Abi,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "UserOperationEvent";
      } catch {
        return false;
      }
    });
  
    if (!userOpEventLog) {
      throw new Error("User operation event not found");
    }
  
    const decodedEvent = decodeEventLog({
      abi: entryPoint06Abi,
      data: userOpEventLog.data,
      topics: userOpEventLog.topics,
    });
  
    if (decodedEvent.eventName !== "UserOperationEvent") {
      throw new Error("Invalid event name");
    }
  
    // Find userOp with hash
    const decodedCall = decodeFunctionData({
      abi: entryPoint06Abi,
      data: deployTransaction.input,
    });
  
    if (decodedCall.functionName !== "handleOps") {
      throw new Error("Transaction is not a handleOps call");
    }
    const userOp = decodedCall.args[0][0];
  
    if (!userOp) {
      throw new Error("User operation not found");
    }
  
    return userOp;
}

export async function getUserOpsFromTransaction({
    client,
    bundlerClient,
    transactionHash,
    sender,
  }: {
    client: ReturnType<typeof createPublicClient>;
    bundlerClient: BundlerClient;
    transactionHash: `0x${string}`;
    sender?: Address;
  }) {
    const deployReceipt = await client.getTransactionReceipt({
      hash: transactionHash,
    });
  
    const userOpEventLogs = deployReceipt.logs.filter((log) => {
      try {
        const event = decodeEventLog({
          abi: entryPoint06Abi,
          data: log.data,
          topics: log.topics,
        });
        return event.eventName === "UserOperationEvent";
      } catch {
        return false;
      }
    });
  
    const userOps = await Promise.all(
      userOpEventLogs.map(async (log) => {
        const decodedEvent = decodeEventLog({
          abi: entryPoint06Abi,
          data: log.data,
          topics: log.topics,
        });
  
        if (decodedEvent.eventName !== "UserOperationEvent") {
          return null;
        }
  
        if (
          sender &&
          getAddress(decodedEvent.args.sender) !== getAddress(sender)
        ) {
          return null;
        }
  
        const userOp = await bundlerClient.getUserOperation({
          hash: decodedEvent.args.userOpHash,
        });
  
        return userOp;
      })
    );
  
    const filteredUserOps = userOps.filter((userOp) => userOp !== null);
  
    return filteredUserOps;
  }