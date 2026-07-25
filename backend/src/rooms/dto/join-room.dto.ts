import { IsOptional, IsString, Length } from 'class-validator';

export class JoinRoomDto {
  /**
   * Forward-share tracking: the userId of the participant whose forwarded invite
   * link this guest used. Present when a guest joins via a link forwarded by
   * someone other than the creator. Used to record the InviteForward chain so the
   * creator can see "<forwarder> invited N more friends to your room."
   */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  forwardedBy?: string;
}
