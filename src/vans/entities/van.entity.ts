import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Reservation } from '../../reservations/entities/reservation.entity';
import { VehicleType } from './vehicle-type.enum';

@Entity('vans')
export class Van {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column()
  imageUrl: string;

  @Column({ type: 'enum', enum: VehicleType, default: VehicleType.VAN })
  type: VehicleType;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  pricePerDay: number;

  @OneToMany(() => Reservation, (reservation) => reservation.van)
  reservations: Reservation[];

  @CreateDateColumn()
  createdAt: Date;
}
