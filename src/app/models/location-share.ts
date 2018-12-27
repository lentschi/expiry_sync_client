import { AppModel, Column, HasOne } from '../../utils/orm/index';
import { User, Location } from './index';
import { ApiServer, ApiServerCall } from '../../utils/api-server';

export class LocationShare extends AppModel {
  static tableName = 'LocationShare';

  @HasOne('User')
  user: User;

  @HasOne('Location')
  location: Location;

  @Column()
  userId: string;

  @Column()
  locationId: string;

  async requestRemoval(): Promise<void> {
    const params: any = {
      location_id: this.location.serverId,
      user_id: this.user.serverId
    };

    await ApiServer.call(ApiServerCall.removeLocationShare, params);
  }
}
