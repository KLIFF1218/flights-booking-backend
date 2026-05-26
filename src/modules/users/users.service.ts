import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}
  async getAll() {
    return await this.prismaService.user.findMany();
  }

  async getById(id: string) {
    return await this.prismaService.user.findUnique({
      where: {
        id,
      },
    });
  }

  async getSettings(userId: string) {
    return await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        country: true,
        citizenship: true,
        currency: true,
        city: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
      },
    });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    return await this.prismaService.user.update({
      where: {
        id: userId,
      },
      data: {
        country: dto.country,
        citizenship: dto.citizenship,
        city: dto.city,
        currency: dto.currency,
      },
    });
  }

  async findByVkId(vkId: string) {
    return this.prismaService.user.findUnique({
      where: { vkId },
    });
  }

  async create(data: { email: string; password: string; fullName: string }) {
    return await this.prismaService.user.create({ data });
  }

  async remove(id: string) {
    return await this.prismaService.user.delete({
      where: {
        id,
      },
    });
  }
}
