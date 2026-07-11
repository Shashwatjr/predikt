import { IsIn } from 'class-validator';

export class ResultReactionDto {
  @IsIn(['🔥', '🎯', '👑', '😂', '😭', '🤝', '⚡', '🌧️', '🍕', '💪'])
  emoji: string;
}
