import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { VansService } from './vans.service';
import { Van } from './entities/van.entity';
import { CreateVanDto } from './dto/create-van.dto';
import { UpdateVanDto } from './dto/update-van.dto';
import { AvailableVansQueryDto } from './dto/available-vans-query.dto';
import { ListVansQueryDto } from './dto/list-vans-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Controller('vans')
export class VansController {
  constructor(private readonly vansService: VansService) {}

  @Get()
  findAll(@Query() query: ListVansQueryDto): Promise<Van[]> {
    return this.vansService.findAll(query.type);
  }

  @Get('available')
  findAvailable(@Query() query: AvailableVansQueryDto): Promise<Van[]> {
    return this.vansService.findAvailable(
      query.startDate,
      query.endDate,
      query.type,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Van> {
    return this.vansService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateVanDto): Promise<Van> {
    return this.vansService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVanDto,
  ): Promise<Van> {
    return this.vansService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.vansService.remove(id);
  }

  @Patch(':id/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('File must be an image'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Van> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }
    return this.vansService.updateImage(id, file.buffer);
  }
}
