import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { UpsertCreatorDto } from './dto/upsert-creator.dto';

@UseGuards(JwtAuthGuard)
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post('me')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: UpsertCreatorDto) {
    return this.creatorsService.upsertMe(user, body);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.creatorsService.getMe(user);
  }

  @Patch('me')
  patch(@CurrentUser() user: AuthenticatedUser, @Body() body: UpsertCreatorDto) {
    return this.creatorsService.patchMe(user, body);
  }
}
