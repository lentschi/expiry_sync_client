import { AppModel, Column, PersistenceModel, RecordNotFoundError } from '../../utils/orm';
import { ApiServer, ApiServerCall, InvalidLogin } from '../../utils/api-server';
import { ProductEntry, Location, LocationShare, Setting } from './';

@PersistenceModel
export class User extends AppModel {
  static tableName = 'User';

  @Column()
  userName: string;

  @Column()
  email: string;

  @Column()
  serverId: number;

  @Column()
  password: string;

  @Column()
  usedForLogin: boolean;

  loggedIn: boolean;

  /**
   * either the user's userName or password
   * only used for login
   * @type {string}
   */
  public login: string;

  static async clearUserRelatedData() {
    await ProductEntry.all().delete();
    await LocationShare.all().delete();
    await Location.all().delete();
    await Setting.set('lastSync', '');
  }


  static createFromServerData(userData): User {
    const user: User = new User();
    user.loadFromServerData(userData);

    return user;
  }

  static createFromLogin(login: string): User {
    const user: User = new User();
    if (login.indexOf('@') !== -1) {
      user.email = login;
    } else {
      user.userName = login;
    }
    user.login = login;

    return user;
  }

  /**
   * login the user via the server api; on success: update serverId and userForLogin
   * fields in the db
   */
  async authenticate(): Promise<void> {
    if (!this.login) {
      throw new InvalidLogin(); // don't even try without a username
    }

    const userData = await ApiServer.call(ApiServerCall.login, { user: this.toServerData() });
    this.loadFromServerData(userData.user);

    let existingUser: User;
    try {
      existingUser = <User>await User.findBy('serverId', this.serverId);
    } catch (e) {
      if (!(e instanceof RecordNotFoundError)) {
        throw (e);
      }
    }

    if (!existingUser) {
      try {
        existingUser = <User>await User.all().filter('serverId', '=', null).one();
      } catch (e) {
        if (!(e instanceof RecordNotFoundError)) {
          throw (e);
        }
      }
    }

    if (existingUser) {
      this.id = existingUser.id;
    }
    await this.markAsLoggedIn();
  }

  private async markAsLoggedIn() {
    await this.clearPreviosUsersData();
    this.usedForLogin = true;
    await this.save();
    await Setting.set('lastUserId', this.id);
    this.loggedIn = true;
  }

  /**
   * logout the user via the server api
   */
  async logout(remotely = true, forgetPassword = true): Promise<void> {
    if (remotely) {
      await ApiServer.call(ApiServerCall.logout);
    }

    if (forgetPassword) {
      this.usedForLogin = false;
      this.password = null;
    }

    await this.save();
    this.loggedIn = false;
  }

  /**
   * register the server via the server api; on success: create user in the db
   */
  async register(): Promise<void> {
    const userData = await ApiServer.call(ApiServerCall.register, { user: this.toServerData() });

    let existingUser;
    try {
      existingUser = <User>await User.all().filter('serverId', '=', null).one();
    } catch (e) {
      if (!(e instanceof RecordNotFoundError)) {
        throw (e);
      }
    }
    if (existingUser) {
      this.id = existingUser.id;
    }

    this.loadFromServerData(userData.user);
    await this.markAsLoggedIn();
  }

  private async clearPreviosUsersData() {
    const previousUserId = Setting.cached('lastUserId');
    if (previousUserId === '' || previousUserId === this.id) {
      return;
    }

    console.log('Clearing previous user\'s data...');
    await User.clearUserRelatedData();
  }


  private toServerData() {
    const userData: any = {};

    if (this.login) {
      userData.login = this.login;
      userData.password = this.password;
    } else {
      userData.username = this.userName;
      userData.email = this.email;
      userData.password = this.password;
    }

    return userData;
  }

  private loadFromServerData(userData): void {
    this.serverId = userData.id;
    this.userName = userData.username;
    this.email = userData.email;
  }

  async updateOrAddByServerId(): Promise<User> {
    let user: User;
    try {
      user = <User>await User.findBy('serverId', this.serverId);

      // update:
      user.userName = this.userName;
      user.email = this.email;
    } catch (e) {
      // create:
      user = this;
    }

    await user.save();
    console.log('Done saving user');
    return user;
  }

  isTheSame(otherUser: User): boolean {
    return (
      (this.serverId && otherUser.serverId
        && this.serverId === otherUser.serverId)
      || (this.userName && otherUser.userName
        && this.userName === otherUser.userName)
      || (this.email && otherUser.email
        && this.email === otherUser.email));
  }

  /**
   * Assign product entries and locations missing user ids
   * this user's ID.
   * (Only called when when migrating up from v0.7, since
   * those tables didn't have a creator column back then.)
   */
  async assignMissingUserIds(): Promise<void> {
    await ProductEntry
      .all()
      .filter('creatorId', '=', null)
      .updateField('creatorId', this.id);

    await Location
      .all()
      .filter('creatorId', '=', null)
      .updateField('creatorId', this.id);
  }
}
