-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('GALLEY', 'LAVATORY', 'EXIT', 'STAIRS');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('WINDOW', 'AISLE', 'MIDDLE');

-- CreateEnum
CREATE TYPE "EnumTransport" AS ENUM ('KAFKA', 'RABBITMQ');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('LOCAL', 'VK', 'GOOGLE', 'GITHUB', 'APPLE');

-- CreateEnum
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'BOOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('SCHEDULED', 'DELAYED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TravelClass" AS ENUM ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST');

-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('ADULT', 'CHILD', 'HELD_INFANT');

-- CreateEnum
CREATE TYPE "BookingProvider" AS ENUM ('AMADEUS', 'MOCK');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PNR_CREATED', 'SEATS_SELECTED', 'PAYMENT_PENDING', 'PAID', 'TICKETING', 'TICKETED', 'CANCELED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('AUTHORIZED', 'PENDING', 'SUCCEED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'RUB');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('YOOKASSA', 'STRIPE', 'STARS');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('ISSUED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RevokedReason" AS ENUM ('LOGOUT', 'REFRESH_ROTATION', 'REPLAY_ATTACK', 'PASSWORD_CHANGED', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "vkId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "country" TEXT,
    "citizenship" TEXT,
    "city" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'RUB',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "lastIp" TEXT,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" "RevokedReason",
    "replacedById" TEXT,
    "userDeviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirportAlias" (
    "id" TEXT NOT NULL,
    "airportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lang" TEXT,

    CONSTRAINT "AirportAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "iataCode" VARCHAR(3) NOT NULL,
    "icaoCode" VARCHAR(4),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Airport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Airline" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Airline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "airlineId" TEXT NOT NULL,

    CONSTRAINT "Aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "departureAirportId" TEXT NOT NULL,
    "arrivalAirportId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightSegment" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "segmentOrder" INTEGER NOT NULL,
    "dayOffset" INTEGER NOT NULL DEFAULT 0,
    "departureAirportId" TEXT NOT NULL,
    "arrivalAirportId" TEXT NOT NULL,
    "departureTime" TEXT NOT NULL,
    "arrivalTime" TEXT NOT NULL,
    "carrierCode" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "aircraftId" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightInstance" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "aircraftId" TEXT,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "originalDepartureDate" TIMESTAMP(3),
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "FlightStatus" NOT NULL DEFAULT 'SCHEDULED',
    "seatsAvailable" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightFare" (
    "id" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "passengerType" "PassengerType" NOT NULL,
    "travelClass" "TravelClass" NOT NULL,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "currency" "Currency" NOT NULL,
    "checkedBags" INTEGER NOT NULL DEFAULT 0,
    "fareBasis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightFare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AircraftLayout" (
    "id" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "length" INTEGER NOT NULL,

    CONSTRAINT "AircraftLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatTemplate" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "seatType" "SeatType" NOT NULL,
    "travelClass" "TravelClass" NOT NULL DEFAULT 'ECONOMY',
    "deck" INTEGER NOT NULL,
    "isExitRow" BOOLEAN NOT NULL DEFAULT false,
    "isExtraLegroom" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SeatTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityTemplate" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,

    CONSTRAINT "FacilityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightSeat" (
    "id" TEXT NOT NULL,
    "flightInstanceId" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "deck" INTEGER NOT NULL,
    "seatType" "SeatType",
    "travelClass" "TravelClass" NOT NULL DEFAULT 'ECONOMY',
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isExitRow" BOOLEAN NOT NULL DEFAULT false,
    "isExtraLegroom" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FlightSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatHold" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "flightSeatId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "pdfKey" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BookingProvider" NOT NULL DEFAULT 'AMADEUS',
    "status" "BookingStatus" NOT NULL DEFAULT 'PNR_CREATED',
    "pnrLocator" TEXT NOT NULL,
    "flightOrderId" TEXT NOT NULL,
    "lastTicketingDate" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "currency" "Currency" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "flightInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Traveler" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "nationality" TEXT NOT NULL,
    "birthPlace" TEXT,
    "passportNumber" TEXT NOT NULL,
    "passportIssuanceDate" TIMESTAMP(3) NOT NULL,
    "passportExpiry" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "phoneCountryCode" TEXT,
    "phoneNumber" TEXT,
    "passengerType" "PassengerType" NOT NULL,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "currency" "Currency" NOT NULL,
    "travelClass" "TravelClass" NOT NULL,
    "fareBasis" TEXT,
    "checkedBags" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Traveler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatAssignment" (
    "id" TEXT NOT NULL,
    "travelerId" TEXT NOT NULL,
    "flightSeatId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" "Currency" NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "externalId" TEXT,
    "providerMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" TEXT NOT NULL,
    "aggregateId" TEXT,
    "aggregateType" TEXT,
    "topic" TEXT NOT NULL,
    "key" TEXT,
    "payload" JSONB NOT NULL,
    "transport" "EnumTransport" NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyOperation" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_vkId_key" ON "User"("vkId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userDeviceId_idx" ON "RefreshToken"("userDeviceId");

-- CreateIndex
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AirportAlias_name_idx" ON "AirportAlias"("name");

-- CreateIndex
CREATE INDEX "AirportAlias_airportId_idx" ON "AirportAlias"("airportId");

-- CreateIndex
CREATE UNIQUE INDEX "Airport_iataCode_key" ON "Airport"("iataCode");

-- CreateIndex
CREATE INDEX "Airport_iataCode_idx" ON "Airport"("iataCode");

-- CreateIndex
CREATE INDEX "Airport_city_idx" ON "Airport"("city");

-- CreateIndex
CREATE INDEX "Airport_name_idx" ON "Airport"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Airline_code_key" ON "Airline"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Aircraft_code_key" ON "Aircraft"("code");

-- CreateIndex
CREATE INDEX "Flight_departureAirportId_idx" ON "Flight"("departureAirportId");

-- CreateIndex
CREATE INDEX "Flight_departureAirportId_arrivalAirportId_idx" ON "Flight"("departureAirportId", "arrivalAirportId");

-- CreateIndex
CREATE INDEX "Flight_arrivalAirportId_idx" ON "Flight"("arrivalAirportId");

-- CreateIndex
CREATE INDEX "FlightSegment_departureAirportId_idx" ON "FlightSegment"("departureAirportId");

-- CreateIndex
CREATE INDEX "FlightSegment_arrivalAirportId_idx" ON "FlightSegment"("arrivalAirportId");

-- CreateIndex
CREATE INDEX "FlightSegment_flightId_segmentOrder_idx" ON "FlightSegment"("flightId", "segmentOrder");

-- CreateIndex
CREATE INDEX "FlightInstance_flightId_idx" ON "FlightInstance"("flightId");

-- CreateIndex
CREATE INDEX "FlightInstance_departureDate_idx" ON "FlightInstance"("departureDate");

-- CreateIndex
CREATE INDEX "FlightInstance_departureDate_flightId_idx" ON "FlightInstance"("departureDate", "flightId");

-- CreateIndex
CREATE INDEX "FlightInstance_status_departureDate_idx" ON "FlightInstance"("status", "departureDate");

-- CreateIndex
CREATE INDEX "FlightFare_flightInstanceId_passengerType_travelClass_idx" ON "FlightFare"("flightInstanceId", "passengerType", "travelClass");

-- CreateIndex
CREATE UNIQUE INDEX "FlightFare_flightInstanceId_passengerType_travelClass_key" ON "FlightFare"("flightInstanceId", "passengerType", "travelClass");

-- CreateIndex
CREATE UNIQUE INDEX "AircraftLayout_aircraftId_key" ON "AircraftLayout"("aircraftId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatTemplate_layoutId_x_y_key" ON "SeatTemplate"("layoutId", "x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityTemplate_layoutId_x_y_key" ON "FacilityTemplate"("layoutId", "x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "FlightSeat_flightInstanceId_seatNumber_key" ON "FlightSeat"("flightInstanceId", "seatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FlightSeat_flightInstanceId_x_y_key" ON "FlightSeat"("flightInstanceId", "x", "y");

-- CreateIndex
CREATE INDEX "SeatHold_expiresAt_idx" ON "SeatHold"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeatHold_flightSeatId_segmentId_key" ON "SeatHold"("flightSeatId", "segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_travelerId_key" ON "Ticket"("travelerId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_bookingId_travelerId_key" ON "Ticket"("bookingId", "travelerId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_pnrLocator_key" ON "Booking"("pnrLocator");

-- CreateIndex
CREATE INDEX "Booking_pnrLocator_idx" ON "Booking"("pnrLocator");

-- CreateIndex
CREATE INDEX "Booking_flightOrderId_idx" ON "Booking"("flightOrderId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Traveler_bookingId_idx" ON "Traveler"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAssignment_travelerId_segmentId_key" ON "SeatAssignment"("travelerId", "segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatAssignment_flightSeatId_segmentId_key" ON "SeatAssignment"("flightSeatId", "segmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_bookingId_key" ON "Transaction"("bookingId");

-- CreateIndex
CREATE INDEX "Transaction_externalId_idx" ON "Transaction"("externalId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "OutboxMessage_status_availableAt_idx" ON "OutboxMessage"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxMessage_aggregateId_idx" ON "OutboxMessage"("aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyOperation_provider_key_key" ON "IdempotencyOperation"("provider", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userDeviceId_fkey" FOREIGN KEY ("userDeviceId") REFERENCES "UserDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AirportAlias" ADD CONSTRAINT "AirportAlias_airportId_fkey" FOREIGN KEY ("airportId") REFERENCES "Airport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aircraft" ADD CONSTRAINT "Aircraft_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "Airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flight" ADD CONSTRAINT "Flight_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_departureAirportId_fkey" FOREIGN KEY ("departureAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_arrivalAirportId_fkey" FOREIGN KEY ("arrivalAirportId") REFERENCES "Airport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightInstance" ADD CONSTRAINT "FlightInstance_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightFare" ADD CONSTRAINT "FlightFare_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "FlightInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AircraftLayout" ADD CONSTRAINT "AircraftLayout_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatTemplate" ADD CONSTRAINT "SeatTemplate_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "AircraftLayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityTemplate" ADD CONSTRAINT "FacilityTemplate_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "AircraftLayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSeat" ADD CONSTRAINT "FlightSeat_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "FlightInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlightSeat" ADD CONSTRAINT "FlightSeat_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_flightSeatId_fkey" FOREIGN KEY ("flightSeatId") REFERENCES "FlightSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "FlightSegment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "Traveler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "Traveler"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_flightInstanceId_fkey" FOREIGN KEY ("flightInstanceId") REFERENCES "FlightInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Traveler" ADD CONSTRAINT "Traveler_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_travelerId_fkey" FOREIGN KEY ("travelerId") REFERENCES "Traveler"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_flightSeatId_fkey" FOREIGN KEY ("flightSeatId") REFERENCES "FlightSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "FlightSegment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
