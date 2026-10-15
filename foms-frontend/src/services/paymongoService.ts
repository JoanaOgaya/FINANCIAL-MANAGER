interface PayMongoLinkResponse {
  data?: {
    attributes?: {
      checkout_url?: string;
      reference_number?: string;
    };
  };
  errors?: Array<{ detail?: string }>;
  error?: string;
}

export async function createPayMongoLink(
  secretKey: string,
  amountInCents: number,
  description: string,
  remarks: string,
): Promise<{ checkoutUrl: string; referenceNumber: string }> {
  const response = await fetch('https://api.paymongo.com/v1/links', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${secretKey}:`)}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: amountInCents,
          currency: 'PHP',
          description,
          remarks,
        },
      },
    }),
  });

  let data: PayMongoLinkResponse;
  try {
    data = await response.json() as PayMongoLinkResponse;
  } catch {
    throw new Error('PayMongo returned an unexpected response.');
  }

  if (!response.ok || data.errors?.length || data.error) {
    throw new Error(data.errors?.[0]?.detail ?? data.error ?? `PayMongo error (HTTP ${response.status}).`);
  }

  const checkoutUrl = data.data?.attributes?.checkout_url;
  const referenceNumber = data.data?.attributes?.reference_number;
  if (!checkoutUrl || !referenceNumber) {
    throw new Error('PayMongo response is missing checkout details.');
  }

  return { checkoutUrl, referenceNumber };
}
