import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ClaimPacketDocument } from './ClaimPacketDocument';
import type { ClaimPacketPdfData } from './types';

export async function renderClaimPacketPdfBuffer(data: ClaimPacketPdfData): Promise<Buffer> {
  const element = React.createElement(ClaimPacketDocument, { data });
  const buf = await renderToBuffer(element as React.ReactElement);
  return Buffer.from(buf);
}
