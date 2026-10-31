import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Van } from '../../vans/entities/van.entity';

@Entity('reservations')
@Index(['vanId', 'startDate', 'endDate'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Van, (van) => van.reservations, {
    eager: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vanId' })
  van: Van;

  @Column()
  vanId: string;

  @Column('date')
  startDate: string;

  @Column('date')
  endDate: string;

  @Column()
  customerName: string;

  @Column()
  customerEmail: string;

  @Column()
  customerPhone: string;

  @Column({ default: false })
  isLocked: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
