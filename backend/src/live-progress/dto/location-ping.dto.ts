import { IsNumber } from 'class-validator';

export class LocationPingDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}
