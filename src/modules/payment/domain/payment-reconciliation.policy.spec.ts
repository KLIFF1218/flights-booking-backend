import {
  hasTicketingCompensationCompleted,
  isLateSuccessRefundCompleted,
} from './payment-reconciliation.policy';

describe('payment-reconciliation.policy', () => {
  it('detects late-success refund flag in provider meta', () => {
    expect(isLateSuccessRefundCompleted({ lateSuccessRefunded: true })).toBe(true);
    expect(isLateSuccessRefundCompleted({})).toBe(false);
    expect(isLateSuccessRefundCompleted(null)).toBe(false);
  });

  it('detects completed ticketing compensation', () => {
    expect(
      hasTicketingCompensationCompleted(
        {
          ticketingFailedRefundCompleted: true,
          ticketingFailedInventoryReleased: true,
        },
        true,
      ),
    ).toBe(true);

    expect(
      hasTicketingCompensationCompleted({ ticketingFailedInventoryReleased: true }, false),
    ).toBe(true);
  });
});
