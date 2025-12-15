import { Xumm } from 'xumm';

const XAMAN_API_KEY = process.env.NEXT_PUBLIC_XAMAN_API_KEY;

let xumm: Xumm | null = null;

function getXumm(): Xumm {
  if (!xumm && XAMAN_API_KEY) {
    xumm = new Xumm(XAMAN_API_KEY);
  }
  if (!xumm) {
    throw new Error('Xaman API key not configured');
  }
  return xumm;
}

export interface MintRequest {
  metadataUri: string;
  transferFee?: number;
  flags?: number;
  taxon?: number;
}

export interface MintResult {
  success: boolean;
  nftTokenId?: string;
  txHash?: string;
  error?: string;
}

function stringToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex.toUpperCase();
}

export async function mintNFT(request: MintRequest): Promise<MintResult> {
  try {
    const sdk = getXumm();

    console.log('Creating NFT mint payload...');
    console.log('Metadata URI:', request.metadataUri);
    console.log('URI as hex:', stringToHex(request.metadataUri));

    const payload = await sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenMint',
        NFTokenTaxon: request.taxon || 0,
        Flags: request.flags || 8,
        TransferFee: request.transferFee || 200,
        URI: stringToHex(request.metadataUri),
      },
      custom_meta: {
        instruction: 'Sign to mint your music NFT on the XRP Ledger',
      },
    });

    console.log('Payload created:', payload);

    if (!payload) {
      throw new Error('Failed to create mint payload');
    }

    if (payload.next?.always) {
      console.log('Opening Xaman:', payload.next.always);
      window.open(payload.next.always, '_blank');
    } else {
      throw new Error('No sign URL returned from Xaman');
    }

    const result = await new Promise<MintResult>((resolve) => {
      let attempts = 0;
      const maxAttempts = 120;

      const checkStatus = async () => {
        attempts++;
        console.log(`Checking payload status (attempt ${attempts})...`);

        try {
          const status = await sdk.payload?.get(payload.uuid);
          console.log('Payload status:', status?.meta);

          if (status?.meta?.resolved) {
            if (status.meta.signed) {
              console.log('Transaction signed!', status.response);
              resolve({
                success: true,
                txHash: status.response?.txid ?? undefined,
                nftTokenId: status.response?.txid ?? undefined,
              });
            } else {
              console.log('Transaction rejected by user');
              resolve({
                success: false,
                error: 'Transaction rejected by user',
              });
            }
          } else if (attempts >= maxAttempts) {
            resolve({
              success: false,
              error: 'Transaction timed out - please try again',
            });
          } else {
            setTimeout(checkStatus, 2000);
          }
        } catch (err) {
          console.error('Error checking status:', err);
          if (attempts >= maxAttempts) {
            resolve({
              success: false,
              error: 'Failed to check transaction status',
            });
          } else {
            setTimeout(checkStatus, 2000);
          }
        }
      };

      checkStatus();
    });

    return result;
  } catch (error) {
    console.error('Mint error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Minting failed',
    };
  }
}

export async function createSellOffer(
  nftTokenId: string,
  priceInDrops: string
): Promise<MintResult> {
  try {
    const sdk = getXumm();

    const payload = await sdk.payload?.create({
      txjson: {
        TransactionType: 'NFTokenCreateOffer',
        NFTokenID: nftTokenId,
        Amount: priceInDrops,
        Flags: 1,
      },
      custom_meta: {
        instruction: 'Sign to list your NFT for sale',
      },
    });

    if (!payload) {
      throw new Error('Failed to create sell offer payload');
    }

    if (payload.next?.always) {
      window.open(payload.next.always, '_blank');
    }

    const result = await new Promise<MintResult>((resolve) => {
      let attempts = 0;
      const maxAttempts = 120;

      const checkStatus = async () => {
        attempts++;
        try {
          const status = await sdk.payload?.get(payload.uuid);

          if (status?.meta?.resolved) {
            if (status.meta.signed) {
              resolve({
                success: true,
                txHash: status.response?.txid ?? undefined,
              });
            } else {
              resolve({
                success: false,
                error: 'Sell offer rejected by user',
              });
            }
          } else if (attempts >= maxAttempts) {
            resolve({
              success: false,
              error: 'Transaction timed out',
            });
          } else {
            setTimeout(checkStatus, 2000);
          }
        } catch {
          if (attempts >= maxAttempts) {
            resolve({
              success: false,
              error: 'Failed to check transaction status',
            });
          } else {
            setTimeout(checkStatus, 2000);
          }
        }
      };

      checkStatus();
    });

    return result;
  } catch (error) {
    console.error('Create sell offer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sell offer',
    };
  }
}

export function xrpToDrops(xrp: number): string {
  return Math.floor(xrp * 1_000_000).toString();
}

export function dropsToXrp(drops: string | number): number {
  return Number(drops) / 1_000_000;
}
