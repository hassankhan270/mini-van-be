import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { configureCloudinary } from '../config/cloudinary.config';

@Injectable()
export class CloudinaryService {
  constructor(configService: ConfigService) {
    configureCloudinary(configService);
  }

  uploadBuffer(buffer: Buffer, publicId: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, folder: 'mini-van-rentals', overwrite: true },
        (error, result) => {
          if (error || !result) {
            reject(new Error(error?.message ?? 'Cloudinary upload failed'));
            return;
          }
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }
}
