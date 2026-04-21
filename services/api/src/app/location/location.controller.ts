import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { LocationService } from './location.service';

@Controller('location')
@ApiTags('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('autocomplete')
  @Roles('CLIENT', 'ADMIN')
  async autocomplete(@Query('q') q?: string) {
    const items = await this.locationService.autocomplete(String(q ?? ''));
    return { items };
  }

  @Get('place/:id')
  @Roles('CLIENT', 'ADMIN')
  async place(@Param('id') id: string) {
    return this.locationService.place(id);
  }

  @Get('reverse-geocode')
  @Roles('CLIENT', 'ADMIN')
  async reverseGeocode(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.locationService.reverseGeocode(Number(lat), Number(lng));
  }
}

