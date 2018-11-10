import { Injectable } from '@angular/core';
import {Http, Response, Headers, RequestOptions, RequestMethod, URLSearchParams, QueryEncoder, ResponseContentType} from '@angular/http';
import 'rxjs/add/operator/timeout'
import { Setting } from '../models';
import * as escapeStringRegexp from 'escape-string-regexp';
import {Subscription} from 'rxjs/Subscription';
import * as moment from 'moment';
import { ExpirySync } from '../app.expiry-sync';

/**
 * Enum of available API call IDs
 */
export enum ApiServerCall {
  /**
   * get a list of alternate servers implementing the ExpirySync API
   */
  getAlternateServers,
  /**
   * login a user with username/email and password
   */
  login,
  /**
   * logout the current user
   */
  logout,
  /**
   * register a user with username/email and password
   */
  register,

  /**
   * retrieve locations changed or deleted after a specified timestamp (or all, if no timestamp is passed)
   */
  getLocations,
  /**
   * add a location
   */
  createLocation,
  /**
   * update a location
   */
  updateLocation,
  /**
   * delete a location
   */
  deleteLocation,
  /**
   * share a location with a specific user identified by their server ID
   */
  shareLocation,
  /**
   * remove a user identified by their server ID from a location
   */
  removeLocationShare,

  /**
   * fetch details about article by its barcode
   */
  getArticleByBarcode,

  /**
   * retrieve product entries changed or deleted after a specified timestamp (or all, if no timestamp is passed)
   */
  getProductEntries,
  /**
   * create a product entry
   */
  createProductEntry,
  /**
   * update a product entry
   */
  updateProductEntry,
  /**
   * delete a product entry
   */
  deleteProductEntry
}

/**
 * Abstracts API calls to an ExpirySync server
 * @return {[type]} [description]
 */
@Injectable()
export class ApiServer {
  /**
   * Available API calls
   */
  calls:Array<CallConfig> = [
      {id: ApiServerCall.getAlternateServers, method: RequestMethod.Get, path: '/alternate_servers'},
      {id: ApiServerCall.login, method: RequestMethod.Post, path: '/users/sign_in', errors: {'401': InvalidLogin}},
      {id: ApiServerCall.logout, method: RequestMethod.Delete, path: '/users/sign_out'},
      {id: ApiServerCall.register, method: RequestMethod.Post, path: '/users'},

      {id: ApiServerCall.getLocations, method: RequestMethod.Get, path: '/locations/index_mine_changed'},
      {id: ApiServerCall.createLocation, method: RequestMethod.Post, path: "/locations"},
      {id: ApiServerCall.updateLocation, method: RequestMethod.Put, path: "/locations/{{location_id}}"},
      {id: ApiServerCall.deleteLocation, method: RequestMethod.Delete, path: "/locations/{{location_id}}"},
      {id: ApiServerCall.shareLocation, method: RequestMethod.Post, path: "/locations/{{location_id}}/location_shares"},
      {id: ApiServerCall.removeLocationShare, method: RequestMethod.Delete, path: "/locations/{{location_id}}/location_shares/{{user_id}}", errors: {'403': LocationShareRemovalRefused}},

      {id: ApiServerCall.getArticleByBarcode, method: RequestMethod.Get, path: "/articles/by_barcode/{{barcode}}"},

      {id: ApiServerCall.getProductEntries, method: RequestMethod.Get, path: "/locations/{{location_id}}/product_entries/index_changed"},
      {id: ApiServerCall.createProductEntry, method: RequestMethod.Post, path: "/product_entries"},
      {id: ApiServerCall.updateProductEntry, method: RequestMethod.Put, path: "/product_entries/{{product_entry_id}}"},
      {id: ApiServerCall.deleteProductEntry, method: RequestMethod.Delete, path: "/product_entries/{{product_entry_id}}"}
  ];

  /**
   * Server path to download article images
   * The substring {{id}} will be replaced with the image's server ID
   */
  static readonly ARTICLE_IMAGE_PATH:string = '/article_images/{{id}}/serve';

  /**
   * Server path to the forgot password page (Currently not JSON-enabled)
   */
  static readonly FORGOT_PASSWORD_PATH:string = '/users/password/new';

  /**
   * Maximum of milliseconds to wait for a server response before throwing
   * an error
   */
  readonly REQUEST_TIMEOUT = 16000;


  /**
   * Default request options to use for api calls
   */
  private requestOpts:RequestOptions = new RequestOptions({
    headers: new Headers({
      Accept: "application/json; charset=utf-8",
      "Content-Type": "application/json; charset=utf-8",
    }),
    withCredentials: true
  });

  /**
   * Milliseconds that the local time differs from the server's
   */
  timeSkew:number = 0;

  /**
   * Singleton instance
   */
  private static instance:ApiServer;

  /**
   * Subscription to the current http request
   */
  private currentRequestSubscription:Subscription;

  constructor(private http: Http) {
    ApiServer.instance = this;
  }

  /**
   * @return {ApiServer} Singleton instance
   */
  static getInstance():ApiServer {
    if (!ApiServer.instance) {
      throw "Tried to get api server instance, before component ini";
    }
    return ApiServer.instance;
  }

   /**
    * Perform an API call
    * @param  {number}        callId      ID of the API call (s. [[ApiServerCall]])
    * @param  {[key:string]: any}         requestData Call parameters - partly applied to the path templates (wrapped in curly braces), otherwise passed to the server via GET/POST/PUT/DELETE params respectively
    * @return {Promise<any>}              Resolved as soon as the server returned a successful answer, rejected on failure response, timeout, or parser error
    */
  static async call(callId:number, requestData?:{[key:string]: any}):Promise<any> {
    return ApiServer.getInstance().call(callId, requestData);
  }

  /**
   * cancel the current request
   */
  cancelCurrentRequest() {
    this.currentRequestSubscription.unsubscribe();
  }

  /**
   * @see [[ApiServer.call]]
   */
  async call(callId:number, requestData?:{[key:string]: any}):Promise<any> {
    let callData:CallConfig = this.calls.find((curCallData:CallConfig) => {
      return curCallData.id == callId;
    });

    if (!callData) {
      throw "No such server api call: " + callId;
    }

    let path:string = callData.path;
    if (requestData) {
      path = this.applyPathTemplate(path, requestData);
    }

    try {
      return await this.request(callData.method, path, requestData);
    }
    catch(e) {
      if (e instanceof Response && callData.errors && callData.errors[e.status]) {
        throw new callData.errors[e.status](e);
      }
      throw e;
    }
  }

  /**
   * Substitute a path's template placeholders (wrapped in curly braces) with actual values
   * @param  {string} path                    The path including the placeholders
   * @param  {[key:string]: any}  params      Key-value combination of templateKey => value
   * @return {string}                         The substituted path
   */
  applyPathTemplate(path:string, params:{[templateKey:string]: any}):string {
    for (let placeholderValue in params) {
      let reStr:string = escapeStringRegexp("{{" + placeholderValue + "}}");
      let re:RegExp = new RegExp(reStr);
      if (path.match(re)) {
        path = path.replace(re, params[placeholderValue]);
        delete params[placeholderValue];
      }
    }

    return path;
  }

  /**
   * Call the server with a specified method, path and data
   * @param  {RequestMethod}             method      GET/POST/PUT/DELETE
   * @param  {string}                    path        The server path to request
   * @param  {[key:string]: any}         requestData Call parameters - partly applied to the path templates (wrapped in curly braces), otherwise passed to the server via GET/POST/PUT/DELETE params respectively
   * @return {Promise<any>}              Resolved as soon as the server returned a successful answer, rejected on failure response, timeout, or parser error
   */
  private request(method:RequestMethod, path:string, requestData?:{[key:string]: any}):Promise<any> {
    console.log("API server request: ", new Date(), method, path, requestData);
    return new Promise((resolve, reject) => {
      let url:string = this.buildUrl(path);

      this.requestOpts.method = method;
      this.requestOpts.headers.set('Accept-Language', Setting.cached('localeId'));
      this.requestOpts.headers.set('X-Expiry-Sync-Api-Version', String(ExpirySync.API_VERSION));
      if (requestData) {
        if (method == RequestMethod.Get) {
          this.requestOpts.search = new URLSearchParams('', new FormQueryEncoder());
          for (let key in requestData) {
            this.requestOpts.search.set(key, requestData[key]);
          }
          this.requestOpts.body = null;
        }
        else {
          this.requestOpts.body = JSON.stringify(requestData);
          this.requestOpts.search = null;
        }
      }


      this.currentRequestSubscription = this.http
        .request(url, this.requestOpts)
        .timeout(this.REQUEST_TIMEOUT)
        .subscribe(async (response:Response) => {
          try {
            var data = response.json();
          }
          catch (e) {
            reject(e);
          }

          const permanentRedirectUrl = response.headers.get('X-Expiry-Sync-Permanent-Redirect');
          if (permanentRedirectUrl && Setting.cached('host') !== permanentRedirectUrl) {
            await Setting.set('host', permanentRedirectUrl);
            console.error('Permanent redirect: ' + permanentRedirectUrl);
            window.location.reload();
            return;
          }

          if (data.status != "success") {
            reject(new ValidationError(data));
          }

          this.updateTimeSkew(response);
          console.log("API success: ", new Date(), data);
          resolve(data);
      }, (response:Response) => {
        console.error("ApiServer error on "+url+": '" + response.toString());
        reject(response);
      });

    });
  }

  /**
   * Download a file from the API server and return its contents
   * @param  {string}          path The path of the file on the API server
   * @return {Promise<string>}      The file's contents
   */
  fetchRemoteFileContents(path:string):Promise<string> {
    return new Promise((resolve, reject) => {
      let url:string = this.buildUrl(path);
      this.http.request(url, {responseType: ResponseContentType.Blob}).subscribe((response:Response) => {
        let reader:FileReader = new FileReader();
        reader.readAsDataURL(response.blob());
        reader.onloadend = () => {
          resolve(reader.result);
        };
      }, (response:Response) => {
        console.error("Error loading URL: '" + path + "'", response);
        reject(response);
      });
    });
  }

  /**
   * Update our guess of the time skew between client and API server
   * @param  {Response} response A server response to use to deduce the current time skew
   */
  private async updateTimeSkew(response:Response) {
    let responseTime = new Date(response.headers.get('Date'));
    this.timeSkew = parseInt(moment(responseTime).format('x')) - parseInt(moment().format('x'));
  }

  /**
   * Get a full URL for the currently configured API server
   * @param  {string} path The server path
   * @return {string}      The server path prefixed with the current 'host' setting
   */
  private buildUrl(path:string):string {
      let hostUrl =  Setting.cached('host');
      let url = hostUrl + path;

      return url;
  }

  /**
   * Convert a http date to a javascript date
   * @param  {string} httpDate http date to convert
   * @return {Date}            javascript date (or null, if the input was empty)
   */
  static parseHttpDate(httpDate:string):Date {
    return httpDate ? new Date(httpDate) : null;
  }

  /**
   * get a RFC2616 date
   * @param  {Date} date date to convert
   * @return string      RFC2616 date
   */
  static dateToHttpDate(date:Date):string {
    if (!date) {
      return null;
    }

    let timeZone:string = date.toLocaleTimeString('en-us', {timeZoneName:'short'}).split(' ')[2];
    return moment(date).locale('en').format('ddd, D MMM Y HH:mm:ss ') + timeZone;
  }

  /**
   * The URL to the forget password page for the configured API server
   */
  get forgotPasswordUrl():string {
    return this.buildUrl(ApiServer.FORGOT_PASSWORD_PATH);
  }

}

/**
 * An 'expected' error returned by the API server
 */
export class ApiErrorResponse extends Error {
  constructor(public response?:Response, errorData?) {
    super(errorData);
  }
}

/**
 * Thrown when the API server denied the auth data provided by the client
 */
export class InvalidLogin extends ApiErrorResponse {
  constructor(response?:Response) {
    super(response);
    Object.setPrototypeOf(this, InvalidLogin.prototype);
    // s. stackoverflow.com/questions/31626231/custom-error-class-in-typescript#answer-41429145
  }
}

/**
 * Thrown when a user couldn't be removed from a location (due to permissions / recent last login)
 */
export class LocationShareRemovalRefused extends ApiErrorResponse {
  constructor(response?:Response) {
    super(response);
    Object.setPrototypeOf(this, LocationShareRemovalRefused.prototype);
  }
}

/**
 * Thrown when the API server rejected the client's form data due to validation issues
 */
export class ValidationError extends Error {
  constructor(public errorData) {
    super();
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}


/**
 * API server call configuration
 */
export interface CallConfig {
  /**
   * The call ID (used for referencing an API call)
   */
  id: ApiServerCall,
  /**
   * GET/POST/PUT/DELETE
   */
  method: RequestMethod,
  /**
   * Path to call the server with
   */
  path: string,
  /**
   * Errors to throw upon specific HTTP return codes
   * Dictionary in the form {'http error code': ErrorClassToThrow}
   */
  errors?: {[code:string] : any}
}

/**
 * Custom @angular/http QueryEncoder
 */
class FormQueryEncoder extends QueryEncoder {
  /**
   * QueryEncoder won't encode characters such as '+' (which
   * is RFC3986 compliant)
   * However the api server seems to interpret values
   * as application/x-www-form-urlencoded
   * -> use encodeURIComponent instead
   */
  encodeValue(v: string): string {
    return encodeURIComponent(v);
  }
}
