import { ethers } from 'ethers';
import { useMemo } from 'react';

/**
 * Converts a viem PublicClient to an ethers.js Provider.
 * @param {import('viem').PublicClient} publicClient - The viem PublicClient.
 * @returns {ethers.providers.JsonRpcProvider}
 */
export function publicClientToProvider(publicClient) {
  const { chain, transport } = publicClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  if (transport.type === 'fallback') {
    return new ethers.providers.FallbackProvider(
      transport.transports.map(
        ({ value }) => new ethers.providers.JsonRpcProvider(value?.url, network)
      )
    );
  }
  return new ethers.providers.JsonRpcProvider(transport.url, network);
}

/**
 * Hook to convert a viem PublicClient to an ethers.js Provider.
 * @param {import('viem').PublicClient} publicClient - The viem PublicClient.
 * @returns {ethers.providers.JsonRpcProvider}
 */
export function useEthersProvider({ chainId }) {
  const publicClient = usePublicClient({ chainId });
  return useMemo(() => publicClientToProvider(publicClient), [publicClient]);
}

/**
 * Converts a viem WalletClient to an ethers.js Signer.
 * @param {import('viem').WalletClient} walletClient - The viem WalletClient.
 * @returns {ethers.Signer}
 */
export function walletClientToSigner(walletClient) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethers.providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

/**
 * Hook to convert a viem WalletClient to an ethers.js Signer.
 * @returns {ethers.Signer | undefined}
 */
export function useEthersSigner({ chainId } = {}) {
  const { data: walletClient } = useWalletClient({ chainId });
  return useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient]
  );
}
