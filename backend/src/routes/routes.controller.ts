import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { RoutePreviewDto } from './dto/route-preview.dto';
import { CreateRoomFromRouteDto } from './dto/create-room-from-route.dto';

@Controller()
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get('routes/place-search')
  placeSearch(@Query('query') query: string) {
    return this.routesService.placeSearch(query ?? '');
  }

  @Get('routes/maps-config')
  mapsConfig() {
    return this.routesService.mapsConfig();
  }

  @Get('routes/reverse-geocode')
  reverseGeocode(@Query('latitude') latitude: string, @Query('longitude') longitude: string) {
    return this.routesService.reverseGeocode(Number(latitude), Number(longitude));
  }

  @Get('routes/place-details/:placeId')
  placeDetails(@Param('placeId') placeId: string) {
    return this.routesService.placeDetails(placeId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('routes/preview')
  preview(@Body() body: RoutePreviewDto) {
    return this.routesService.preview(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('rooms/from-route')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createRoomFromRoute(@Body() body: CreateRoomFromRouteDto, @CurrentUser() user: User) {
    return this.routesService.createRoomFromRoute(body, user);
  }
}
