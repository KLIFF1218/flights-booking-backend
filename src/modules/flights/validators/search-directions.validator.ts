import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { resolveAirportTimezone } from '../utils/airport-timezone.util';
import {
  isDistinctOriginDestination,
  isIsoDateString,
  isReturnDateValid,
  isRoundTripRouteValid,
  isTodayOrFutureIsoDate,
  isValidIataCode,
} from '../utils/validate-search-directions.util';

type DirectionLike = {
  origin: string;
  destination: string;
  dateFrom: string;
};

@ValidatorConstraint({ name: 'iataCode', async: false })
export class IataCodeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidIataCode(value);
  }

  defaultMessage(): string {
    return 'must be a valid IATA code';
  }
}

@ValidatorConstraint({ name: 'distinctAirports', async: false })
export class DistinctAirportsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const direction = args.object as DirectionLike;
    return isDistinctOriginDestination(direction.origin, direction.destination);
  }

  defaultMessage(): string {
    return 'origin and destination must be different';
  }
}

@ValidatorConstraint({ name: 'isoDate', async: false })
export class IsoDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isIsoDateString(value);
  }

  defaultMessage(): string {
    return 'must be a valid ISO date (YYYY-MM-DD)';
  }
}

@ValidatorConstraint({ name: 'todayOrFutureDate', async: false })
export class TodayOrFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const direction = args.object as DirectionLike;
    const originTimeZone = resolveAirportTimezone(direction.origin ?? '');

    return typeof value === 'string' && isTodayOrFutureIsoDate(value, new Date(), originTimeZone);
  }

  defaultMessage(): string {
    return 'must be today or in the future in the origin airport timezone';
  }
}

@ValidatorConstraint({ name: 'roundTripRoute', async: false })
export class RoundTripRouteConstraint implements ValidatorConstraintInterface {
  validate(directions: DirectionLike[] | undefined): boolean {
    if (directions?.length !== 2) {
      return true;
    }

    return isRoundTripRouteValid(directions[0], directions[1]);
  }

  defaultMessage(): string {
    return 'Round-trip return must reverse outbound route';
  }
}

@ValidatorConstraint({ name: 'roundTripDates', async: false })
export class RoundTripDatesConstraint implements ValidatorConstraintInterface {
  validate(directions: DirectionLike[] | undefined): boolean {
    if (directions?.length !== 2) {
      return true;
    }

    return isReturnDateValid(directions[0], directions[1]);
  }

  defaultMessage(): string {
    return 'Return date must be on or after outbound date';
  }
}
