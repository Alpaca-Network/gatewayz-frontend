import { render, screen, waitFor } from '@testing-library/react';
import { VerifyUsageDialog } from '../verify-usage-dialog';
import { makeAuthenticatedRequest } from '@/lib/api';
import { verifyProof } from '@/lib/usage-anchor';

jest.mock('lucide-react', () => ({
  CheckCircle: () => null,
  ExternalLink: () => null,
  Loader2: () => null,
  XCircle: () => null,
  X: () => null, // dialog close button
}));
jest.mock('@/lib/api', () => ({ makeAuthenticatedRequest: jest.fn() }));
jest.mock('@/lib/usage-anchor', () => ({
  ...jest.requireActual('@/lib/usage-anchor'),
  verifyProof: jest.fn(),
}));

const published = {
  configured: true,
  enabled: true,
  chain_id: 43114,
  network: 'mainnet',
  contract_address: '0x00000000000000000000000000000000000000aa',
  contract_explorer_url: null,
  anchorer: null,
  anchorer_explorer_url: null,
  proof_endpoint: '/v1/anchors/proof/{ledger_id}',
  anchors: [],
};
const proof = { day: '2026-10-27', explorer_url: 'https://snowtrace.io/tx/0x1' };
const respond = (status: number, body: object) =>
  (makeAuthenticatedRequest as jest.Mock).mockResolvedValue({ ok: status < 400, status, json: async () => body });

const renderDialog = () =>
  render(<VerifyUsageDialog ledgerId={1003} published={published} open onOpenChange={() => {}} />);

describe('VerifyUsageDialog', () => {
  beforeEach(() => jest.clearAllMocks());

  it('verifies the fetched proof against the published contract', async () => {
    respond(200, proof);
    (verifyProof as jest.Mock).mockResolvedValue({ ok: true, computedRoot: '0xabc', onchainRoot: '0xabc', leaf: {} });
    renderDialog();
    expect(await screen.findByText(/Verified: this record is in the root anchored for 2026-10-27/)).toBeInTheDocument();
    expect(makeAuthenticatedRequest).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/anchors\/proof\/1003$/));
    expect(verifyProof).toHaveBeenCalledWith(proof, published);
    expect(screen.getByText(/Anchor transaction/).closest('a')).toHaveAttribute('href', proof.explorer_url);
  });

  it('shows why a record fails', async () => {
    respond(200, proof);
    (verifyProof as jest.Mock).mockResolvedValue({ ok: false, reason: 'The record does not match the root on-chain.', computedRoot: '0xabc', onchainRoot: '0xdef' });
    renderDialog();
    expect(await screen.findByText(/Not verified\. The record does not match/)).toBeInTheDocument();
  });

  it("explains a day that isn't anchored yet", async () => {
    respond(409, { detail: '2026-10-28 is not anchored yet' });
    renderDialog();
    expect(await screen.findByText('2026-10-28 is not anchored yet')).toBeInTheDocument();
    await waitFor(() => expect(verifyProof).not.toHaveBeenCalled());
  });
});
