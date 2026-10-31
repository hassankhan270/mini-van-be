import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { Admin } from './entities/admin.entity';

describe('AuthService', () => {
  let service: AuthService;
  let adminsRepository: { findOne: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  const passwordHash = bcrypt.hashSync('correct-password', 10);
  const admin = { id: 'admin-1', email: 'admin@example.com', passwordHash };

  beforeEach(async () => {
    adminsRepository = { findOne: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Admin), useValue: adminsRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns an access token for valid credentials', async () => {
    adminsRepository.findOne.mockResolvedValue(admin);

    const result = await service.login({
      username: 'admin@example.com',
      password: 'correct-password',
    });

    expect(result).toEqual({ accessToken: 'signed-token' });
  });

  it('rejects an unknown email', async () => {
    adminsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.login({
        username: 'nope@example.com',
        password: 'correct-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an incorrect password', async () => {
    adminsRepository.findOne.mockResolvedValue(admin);

    await expect(
      service.login({
        username: 'admin@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
