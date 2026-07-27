import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiConsumes,
  ApiHeader,
  ApiUnauthorizedResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { RateLimit, RATE_LIMIT_PRESETS } from 'src/common/decorators';
import { WebhookService } from './webhook.service';
import { YooKassaWebhookDto } from './dto/yookassa-webhook.dto';
import { ApiBadRequestError, SuccessResponseDto } from 'src/common/swagger/api-responses.decorator';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';

class WebhookHealthResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}

@ApiTags('Payment Webhook')
@RateLimit(RATE_LIMIT_PRESETS.webhook)
@Controller({ path: 'webhook', version: '1' })
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('yookassa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle YooKassa webhook' })
  @ApiConsumes('application/json')
  @ApiBody({ type: YooKassaWebhookDto })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Webhook received and processed' })
  @ApiBadRequestError()
  async handleYookassa(@Body() dto: YooKassaWebhookDto, @Ip() ip: string) {
    return this.webhookService.handleYookassa(dto, ip);
  }

  @Get('yookassa')
  @ApiOperation({ summary: 'Check webhook endpoint availability' })
  @ApiOkResponse({ type: WebhookHealthResponseDto, description: 'Webhook endpoint is available' })
  async greet() {
    return { ok: true };
  }

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Stripe webhook',
    description: 'Handles incoming Stripe payment events using the signature for verification.',
  })
  @ApiConsumes('application/json')
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature for payload verification',
    required: true,
  })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Webhook processed' })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid signature',
    type: ErrorResponseDto,
  })
  @ApiBadRequestError()
  async handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    if (!sig) throw new UnauthorizedException('Missing signature');
    return await this.webhookService.handleStripe(req.rawBody!, sig);
  }
}
