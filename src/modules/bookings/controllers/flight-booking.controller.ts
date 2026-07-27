import {
  Body,
  Controller,
  Post,
  Get,
  Param,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { BookingWorkflowService } from '../services/booking-workflow.service';
import { BookingsService } from '../services/bookings.service';
import { BookingPaymentService } from '../services/booking-payment.service';
import { CreateFlightOrderInputDto } from '../dtos/create-flight-order.input.dto';
import { UserBookingsListDto, BookingDetailDto } from '../dtos/user-bookings-list.dto';
import { UserBookingsQueryDto } from '../dtos/user-bookings-query.dto';
import { Authorized, Protected, Roles } from 'src/common/decorators';
import { AddTravelersDto } from '../dtos/add-travelers.dto';
import { AddSeatsDto, AssignSeatsBodyDto } from '../dtos/add-seats.dto';
import { BookingCheckoutResponseDto } from '../dtos/booking-checkout.response.dto';
import { BookingPaymentResumeResponseDto } from '../dtos/booking-payment-resume.response.dto';
import { Role } from '@prisma/client';
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiNotFoundError,
  ApiUserAuthErrors,
} from 'src/common/swagger/api-responses.decorator';

@ApiTags('Bookings')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'booking', version: '1' })
export class FlightBookingController {
  constructor(
    private readonly bookingWorkflowService: BookingWorkflowService,
    private readonly bookingQueryService: BookingsService,
    private readonly bookingPaymentService: BookingPaymentService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all bookings for current user',
    description: 'Returns list of all flight bookings for the authenticated user',
  })
  @ApiOkResponse({
    type: UserBookingsListDto,
    description: 'List of user bookings',
  })
  @ApiUserAuthErrors()
  async getUserBookings(
    @Authorized('id') userId: string,
    @Query() query: UserBookingsQueryDto,
  ): Promise<UserBookingsListDto> {
    return this.bookingQueryService.findAllByUser(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Required idempotency key to safely retry booking creation',
  })
  @ApiBody({ type: CreateFlightOrderInputDto })
  @ApiOkResponse({ type: BookingDetailDto, description: 'Booking created' })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  @ApiNotFoundError('Offer not found')
  @ApiConflictError('A request with this idempotency key is already in progress')
  async booking(
    @Body() dto: CreateFlightOrderInputDto,
    @Authorized('id') userId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    return this.bookingWorkflowService.createBooking(dto, userId, idempotencyKey);
  }

  @Post(':bookingId/seats/confirm')
  @ApiOperation({ summary: 'Confirm seat selection and start payment' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiBody({ type: AddSeatsDto })
  @ApiOkResponse({
    type: BookingCheckoutResponseDto,
    description: 'Seat selection confirmed and payment initiated',
  })
  @ApiUserAuthErrors()
  @ApiNotFoundError('Booking not found')
  @ApiBadRequestError()
  async confirmSeatsAndPay(
    @Param('bookingId') bookingId: string,
    @Authorized('id') userId: string,
    @Body() dto: AddSeatsDto,
  ): Promise<BookingCheckoutResponseDto> {
    return this.bookingWorkflowService.confirmSeatsAndStartPayment(bookingId, dto, userId);
  }

  @Post(':bookingId/payment/resume')
  @ApiOperation({ summary: 'Resume or recreate a pending payment session' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiOkResponse({
    type: BookingPaymentResumeResponseDto,
    description: 'Payment redirect URL for an active or recreated session',
  })
  @ApiUserAuthErrors()
  @ApiNotFoundError('Booking not found')
  @ApiBadRequestError()
  async resumePayment(
    @Param('bookingId') bookingId: string,
    @Authorized('id') userId: string,
  ): Promise<BookingPaymentResumeResponseDto> {
    return this.bookingPaymentService.resumePayment(bookingId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiOkResponse({ type: BookingDetailDto, description: 'Booking found' })
  @ApiUserAuthErrors()
  @ApiNotFoundError('Booking not found')
  async getBookingById(@Param('id') id: string, @Authorized('id') userId: string) {
    return this.bookingWorkflowService.getById(id, userId);
  }

  @Post(':bookingId/travelers')
  @ApiOperation({ summary: 'Add travelers to booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiBody({ type: AddTravelersDto })
  @ApiOkResponse({ type: BookingDetailDto, description: 'Travelers added' })
  @ApiUserAuthErrors()
  @ApiNotFoundError('Booking not found')
  @ApiBadRequestError()
  async addTravelers(
    @Param('bookingId') bookingId: string,
    @Authorized('id') userId: string,
    @Body() dto: AddTravelersDto,
  ) {
    return this.bookingWorkflowService.addTravelers(bookingId, userId, dto.travelers);
  }

  @Post(':bookingId/seats')
  @ApiOperation({ summary: 'Assign seats for booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiBody({ type: AssignSeatsBodyDto })
  @ApiOkResponse({ type: BookingDetailDto, description: 'Seats assigned' })
  @ApiUserAuthErrors()
  @ApiNotFoundError('Booking not found')
  @ApiBadRequestError()
  async assignSeats(
    @Param('bookingId') bookingId: string,
    @Authorized('id') userId: string,
    @Body() dto: AssignSeatsBodyDto,
  ) {
    return this.bookingWorkflowService.assignSeats(bookingId, userId, dto.seats);
  }

  @Post(':bookingId/cancel')
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID' })
  @ApiOkResponse({ type: BookingDetailDto, description: 'Booking cancelled' })
  @ApiUserAuthErrors()
  @ApiNotFoundError('Booking not found')
  @ApiConflictError('Booking cannot be cancelled in the current status')
  async cancelBooking(@Param('bookingId') bookingId: string, @Authorized('id') userId: string) {
    return this.bookingQueryService.cancel(bookingId, userId);
  }
}
