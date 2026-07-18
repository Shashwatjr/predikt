import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GuestDto {
  /** Display handle the guest typed on the invite screen (e.g. "Sam"). */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/^@+/, '') : value))
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  handle: string;

  /**
   * Stable device key for returning-guest recognition. Absent on first join;
   * the client persists the value returned by the server and sends it next time.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  guestKey?: string;

  /**
   * Room the guest is joining. Used only to keep the display name unambiguous
   * within that room (auto-suffixed if another joined member already uses it).
   */
  @IsOptional()
  @IsString()
  roomId?: string;
}
