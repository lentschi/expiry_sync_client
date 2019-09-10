import { HttpInterceptor, HttpRequest, HttpEvent, HttpHandler, HttpParams, HttpParameterCodec } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';


// see https://stackoverflow.com/questions/45428842/angular-url-plus-sign-converting-to-space
class CustomEncoder implements HttpParameterCodec {
    encodeKey(key: string): string {
      return encodeURIComponent(key);
    }

    encodeValue(value: string): string {
      return encodeURIComponent(value);
    }

    decodeKey(key: string): string {
      return decodeURIComponent(key);
    }

    decodeValue(value: string): string {
      return decodeURIComponent(value);
    }
  }

@Injectable()
export class AppHttpParamsInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const params = new HttpParams({encoder: new CustomEncoder(), fromString: req.params.toString()});
    return next.handle(req.clone({params}));
  }
}
