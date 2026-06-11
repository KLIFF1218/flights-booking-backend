import { Module } from '@nestjs/common';
import { YookassaProvider } from './yoomoney.service';
import { YookassaModule } from 'nestjs-yookassa';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getYookassaConfig } from 'src/config/yookassa.config';

@Module({
  imports: [
    YookassaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getYookassaConfig,
      inject: [ConfigService],
    }),
  ],
  providers: [YookassaProvider],
  exports: [YookassaProvider],
})
export class YoomoneyModule {}
