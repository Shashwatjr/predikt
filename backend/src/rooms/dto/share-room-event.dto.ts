import { IsIn, IsOptional, IsString } from 'class-validator';

export class ShareRoomEventDto {
  @IsString()
  @IsIn(['ROOM_INVITE_VIEWED', 'ROOM_INVITE_SHARED'])
  action: string;

  @IsOptional()
  @IsString()
  @IsIn(['copy', 'whatsapp', 'instagram', 'native_share', 'phone_manual', 'link'])
  channel?: string;
}
