import { NotFoundException } from '@nestjs/common';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { extractFlightInstanceIds } from 'src/modules/flights/utils/offer/offer-flight-instances.util';
import { assertFlightInstancesBookable } from 'src/modules/flights/utils/offer/offer-schedule.util';
import type { BookingSnapshot } from '../../interfaces/booking-snapshot.interface';

export async function assertBookingFlightsStillBookable(
  prisma: PrismaService,
  snapshot: BookingSnapshot,
): Promise<void> {
  const flightInstanceIds = extractFlightInstanceIds(snapshot.offer);

  const instances = await prisma.flightInstance.findMany({
    where: { id: { in: flightInstanceIds } },
    select: { id: true, status: true },
  });

  if (instances.length !== flightInstanceIds.length) {
    const foundIds = new Set(instances.map((instance) => instance.id));
    const missingIds = flightInstanceIds.filter((id) => !foundIds.has(id));

    throw new NotFoundException(`Flight instance not found: ${missingIds.join(', ')}`);
  }

  assertFlightInstancesBookable(instances);
}
